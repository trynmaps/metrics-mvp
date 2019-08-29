from datetime import date
from models import gtfs, nextbus, util
import argparse
import shapely
import partridge as ptg
import numpy as np
from pathlib import Path
import requests
import json
import boto3
import gzip
import math
import zipfile

# Downloads and parses the GTFS specification (hardcoded for Muni for now),
# matches up GTFS shapes with Nextbus directions and stops,
# and saves the configuration for all routes to S3.
# The S3 object contains data merged from Nextbus and GTFS.
# The frontend can then request this S3 URL directly without hitting the Python backend.

# For each direction, the JSON object contains a coords array defining the shape of the route,
# where the values are objects containing lat/lon properties:
#
# "coords":[
#  {"lat":37.80707,"lon":-122.41727}
#  {"lat":37.80727,"lon":-122.41562},
#  {"lat":37.80748,"lon":-122.41398},
#  {"lat":37.80768,"lon":-122.41234},
#  ...
# ]
#
# For each direction, the JSON object also contains a stop_geometry object where the keys are stop IDs
# and the values are objects with a distance property (cumulative distance in meters to that stop along the GTFS # shape),
# and an after_index property (index into the coords array of the last coordinate before that stop).
#
# "stop_geometry":{
#    "5184":{"distance":8,"after_index":0},
#    "3092":{"distance":279,"after_index":1},
#    "3095":{"distance":573,"after_index":3},
#    "4502":{"distance":1045,"after_index":8},
#    ...
#}
#
# In order to match a Nextbus direction with a GTFS shape_id, this finds the GTFS shape_id for that route where
# distance(first coordinate of shape, first stop location) + distance(last coordinate of shape, last stop location)
# is a minimum.
#
# In order to determine where a Nextbus stop appears along a GTFS shape, this finds the closest coordinate of the
# GTFS shape to the Nextbus stop, then determines whether the stop is closer to the line between that GTFS shape coordinate
# and the previous GTFS coordinate, or the line between that GTFS shape coordinate and the next GTFS coordinate.
# (This may not always be correct for shapes that loop back on themselves.)
#
# Currently the script just overwrites the one S3 path, but this process could be extended in the future to
# store different paths for different dates, to allow fetching historical data for route configurations.
#

agency_id = 'sf-muni'
gtfs_url = 'http://gtfs.sfmta.com/transitdata/google_transit.zip'
center_lat = 37.772
center_lon = -122.442
version = 'v2'

deg_lat_dist = util.haver_distance(center_lat, center_lon, center_lat-0.1, center_lon)*10
deg_lon_dist = util.haver_distance(center_lat, center_lon, center_lat, center_lon-0.1)*10

# projection function from lon/lat coordinates in degrees (z ignored) to x/y coordinates in meters.
# satisfying the interface of shapely.ops.transform (https://shapely.readthedocs.io/en/stable/manual.html#shapely.ops.transform).
# This makes it possible to use shapely methods to calculate the distance in meters between geometries
def project_xy(lon, lat, z=None):
    return (round((lon - center_lon) * deg_lon_dist, 1), round((lat - center_lat) * deg_lat_dist, 1))

def get_stop_geometry(route, stop_id, xy_geometry, shape_lat, shape_lon, shape_cumulative_dist):
    stop_info = route.get_stop_info(stop_id)

    stop_dist_to_shape_coords = util.haver_distance(shape_lat, shape_lon, stop_info.lat, stop_info.lon)

    closest_index = int(np.argmin(stop_dist_to_shape_coords))

    # determine the offset distance between the stop and the line after the closest coord,
    # and between the stop and the line after the closest coord.
    # Need to project lon/lat coords to x/y here in order for shapely to determine the distance between
    # a point and a line (shapely doesn't support distance for lon/lat coords)

    stop_xy = shapely.geometry.Point(project_xy(stop_info.lon, stop_info.lat))

    geom_length = len(xy_geometry.coords)

    if closest_index < geom_length - 1:
        next_line = shapely.geometry.LineString(xy_geometry.coords[closest_index:closest_index+2])
        next_line_offset = next_line.distance(stop_xy)

    if closest_index > 0:
        prev_line = shapely.geometry.LineString(xy_geometry.coords[closest_index-1:closest_index+1])
        prev_line_offset = prev_line.distance(stop_xy)

    if closest_index == 0:
        stop_after_index = 0
        offset = next_line_offset
    elif closest_index + 1 >= geom_length:
        stop_after_index = closest_index - 1
        offset = prev_line_offset
    else:
        offset = min(next_line_offset, prev_line_offset)
        stop_after_index = closest_index if next_line_offset < prev_line_offset else closest_index - 1

    stop_dist = shape_cumulative_dist[stop_after_index] + stop_dist_to_shape_coords[stop_after_index]

    return {
        'distance': int(stop_dist), # total distance in meters along the route shape to this stop
        'after_index': stop_after_index, # the index of the coordinate of the shape just before this stop
        'offset': int(offset) # distance in meters between this stop and the closest line segment of shape
    }

def download_gtfs_data(agency_id, gtfs_url, gtfs_cache_dir):
    cache_dir = Path(gtfs_cache_dir)
    if not cache_dir.exists():
        print(f'downloading gtfs data from {gtfs_url}')
        r = requests.get(gtfs_url)

        if r.status_code != 200:
            raise Exception(f"Error fetching {gtfs_url}: HTTP {r.status_code}: {r.text}")

        zip_path = f'{util.get_data_dir()}/gtfs-{agency_id}.zip'

        with open(zip_path, 'wb') as f:
            f.write(r.content)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(gtfs_cache_dir)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Merge route information from Nextbus API and GTFS')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    gtfs_cache_dir = f'{util.get_data_dir()}/gtfs-{agency_id}'

    download_gtfs_data(agency_id, gtfs_url, gtfs_cache_dir)

    gtfs_scraper = gtfs.GtfsScraper(gtfs_cache_dir, agency_id, 'v1')

    routes = nextbus.get_route_list(agency_id)

    routes_data = []

    for route in routes:

        route_id = route.id

        try:
            gtfs_route_id = gtfs_scraper.get_gtfs_route_id(route_id)
        except gtfs.NoRouteError as ex:
            print(ex)
            gtfs_route_id = None

        trips_df = gtfs_scraper.feed.trips
        shapes = gtfs_scraper.feed.shapes

        print(f'{route_id} = {gtfs_route_id}')

        route_data = {
            'id': route.id,
            'title': route.title,
            'gtfs_route_id': gtfs_route_id,
            'directions': [],
            'stops': {
                stop.id: {
                    'title': stop.title,
                    'lat': stop.lat,
                    'lon': stop.lon
                } for stop in route.get_stop_infos()
            }
        }
        routes_data.append(route_data)

        if gtfs_route_id is not None:
            route_trips = trips_df[(trips_df['route_id'] == gtfs_route_id)]
            route_shape_ids, route_shape_id_counts = np.unique(route_trips['shape_id'].values, return_counts=True)

            # sort from most common -> least common (used as tiebreak for two shapes with the same total distance to first/last stop)
            route_shape_id_order = np.argsort(-1 * route_shape_id_counts)

            route_shape_ids = route_shape_ids[route_shape_id_order]
            route_shape_id_counts = route_shape_id_counts[route_shape_id_order]
        else:
            route_shape_ids = None

        used_shape_ids = {}

        for direction_id in route.get_direction_ids():
            dir_info = route.get_direction_info(direction_id)

            dir_data = {
                'id': dir_info.id,
                'title': dir_info.title,
                'name': dir_info.name,
                'stops': dir_info.get_stop_ids(),
                'stop_geometry': {},
            }
            route_data['directions'].append(dir_data)

            if gtfs_route_id is None:
                continue

            dir_stop_ids = dir_info.get_stop_ids()

            terminal_dists = []

            first_stop_info = route.get_stop_info(dir_stop_ids[0])
            last_stop_info = route.get_stop_info(dir_stop_ids[-1])

            # partridge returns GTFS geometries for each shape_id as a shapely LineString
            # (https://shapely.readthedocs.io/en/stable/manual.html#linestrings).
            # Each coordinate is an array in [lon,lat] format (note: longitude first, latitude second)
            geometries = []

            # Determine distance between first stop and start of GTFS shape,
            # plus distance between last stop and end of GTFS shape,
            # for all GTFS shapes for this route.
            for shape_id in route_shape_ids:
                geometry = shapes[shapes['shape_id'] == shape_id]['geometry'].values[0]
                geometries.append(geometry)

                shape_start = geometry.coords[0]
                shape_end = geometry.coords[-1]

                start_dist = util.haver_distance(first_stop_info.lat, first_stop_info.lon, shape_start[1], shape_start[0])
                end_dist = util.haver_distance(last_stop_info.lat, last_stop_info.lon, shape_end[1], shape_end[0])

                terminal_dist = start_dist + end_dist
                terminal_dists.append(terminal_dist)

            terminal_dist_order = np.argsort(terminal_dists)

            best_shape_index = terminal_dist_order[0] # index of the "best" shape for this direction, with the minimum terminal_dist

            shape_id = route_shape_ids[best_shape_index]
            best_terminal_dist = terminal_dists[best_shape_index]

            used_shape_ids[shape_id] = True

            print(f'  {direction_id} = {shape_id} (n={route_shape_id_counts[best_shape_index]}) (terminal_dist={int(best_terminal_dist)}) {" (questionable match)" if best_terminal_dist > 300 else ""}')

            geometry = geometries[best_shape_index]

            xy_geometry = shapely.ops.transform(project_xy, geometry)

            dir_data['gtfs_shape_id'] = shape_id
            dir_data['coords'] = [
                {
                    'lat': round(coord[1], 5),
                    'lon': round(coord[0], 5)
                } for coord in geometry.coords
            ]

            shape_lon_lat = np.array(geometry).T
            shape_lon = shape_lon_lat[0]
            shape_lat = shape_lon_lat[1]

            shape_prev_lon = np.r_[shape_lon[0], shape_lon[:-1]]
            shape_prev_lat = np.r_[shape_lat[0], shape_lat[:-1]]

            # shape_cumulative_dist[i] is the cumulative distance in meters along the shape geometry from 0th to ith coordinate
            shape_cumulative_dist = np.cumsum(util.haver_distance(shape_lon, shape_lat, shape_prev_lon, shape_prev_lat))

            # this is the total distance of the GTFS shape, which may not be exactly the same as the
            # distance along the route between the first and last Nextbus stop
            dir_data['distance'] = int(shape_cumulative_dist[-1])

            prev_after_index = None

            for stop_id in dir_stop_ids:
                stop_geometry = get_stop_geometry(route, stop_id, xy_geometry, shape_lat, shape_lon, shape_cumulative_dist)

                if prev_after_index is not None and stop_geometry['after_index'] < prev_after_index:
                    print(f"    !! bad geometry for stop {stop_id}: after_index {stop_geometry['after_index']} not in ascending order")
                    continue

                if stop_geometry['offset'] > 100:
                    print(f"    !! bad geometry for stop {stop_id}: {stop_geometry['offset']} m from route line segment")
                    continue

                dir_data['stop_geometry'][stop_id] = stop_geometry

                prev_after_index = stop_geometry['after_index']


        if route_shape_ids is not None:
            for i, shape_id in enumerate(route_shape_ids):
                if shape_id not in used_shape_ids:
                    print(f'  ? = {shape_id} (n={route_shape_id_counts[i]})')

    data_str = json.dumps({
        'version': version,
        'routes': routes_data
    }, separators=(',', ':'))

    cache_path = f'{util.get_data_dir()}/routes_{version}_{agency_id}.json'

    with open(cache_path, "w") as f:
        f.write(data_str)

    if args.s3:
        s3 = boto3.resource('s3')
        s3_path = f'routes_{version}_{agency_id}.json.gz'
        s3_bucket = 'opentransit-precomputed-stats'
        print(f'saving to s3://{s3_bucket}/{s3_path}')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body=gzip.compress(bytes(data_str, 'utf-8')),
            CacheControl='max-age=86400',
            ContentType='application/json',
            ContentEncoding='gzip',
            ACL='public-read'
        )
