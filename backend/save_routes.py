from datetime import date
from models import gtfs, config, util, nextbus, routeconfig
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

def match_nextbus_direction(nextbus_route_config, geometry):
    shape_start = geometry.coords[0]
    shape_end = geometry.coords[-1]

    nextbus_dir_infos = nextbus_route_config.get_direction_infos()

    terminal_dists = []

    for nextbus_dir_info in nextbus_dir_infos:

        nextbus_dir_stop_ids = nextbus_dir_info.get_stop_ids()

        first_stop_info = nextbus_route_config.get_stop_info(nextbus_dir_stop_ids[0])
        last_stop_info = nextbus_route_config.get_stop_info(nextbus_dir_stop_ids[-1])

        # Determine distance between first nextbus stop and start of GTFS shape,
        # plus distance between last stop and end of GTFS shape,
        # for all Nextbus directions for this route.
        start_dist = util.haver_distance(first_stop_info.lat, first_stop_info.lon, shape_start[1], shape_start[0])
        end_dist = util.haver_distance(last_stop_info.lat, last_stop_info.lon, shape_end[1], shape_end[0])

        terminal_dist = start_dist + end_dist
        terminal_dists.append(terminal_dist)

    terminal_dist_order = np.argsort(terminal_dists)

    best_nextbus_dir_index = terminal_dist_order[0] # index of the "best" shape for this direction, with the minimum terminal_dist

    best_nextbus_dir_info = nextbus_dir_infos[best_nextbus_dir_index]
    best_terminal_dist = terminal_dists[best_nextbus_dir_index]

    return best_nextbus_dir_info, best_terminal_dist

def get_stop_geometry(stop_info, xy_geometry, shape_lat, shape_lon, shape_cumulative_dist):

    stop_dist_to_shape_coords = util.haver_distance(shape_lat, shape_lon, stop_info['lat'], stop_info['lon'])

    closest_index = int(np.argmin(stop_dist_to_shape_coords))

    # determine the offset distance between the stop and the line after the closest coord,
    # and between the stop and the line after the closest coord.
    # Need to project lon/lat coords to x/y here in order for shapely to determine the distance between
    # a point and a line (shapely doesn't support distance for lon/lat coords)

    stop_xy = shapely.geometry.Point(project_xy(stop_info['lon'], stop_info['lat']))

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

    #print(f'   stop_dist = {stop_dist} offset = {offset}  after_index = {stop_after_index} ')

    return {
        'distance': int(stop_dist), # total distance in meters along the route shape to this stop
        'after_index': stop_after_index, # the index of the coordinate of the shape just before this stop
        'offset': int(offset) # distance in meters between this stop and the closest line segment of shape
    }

def download_gtfs_data(agency: config.Agency, gtfs_cache_dir):
    gtfs_url = agency.gtfs_url
    if gtfs_url is None:
        raise Exception(f'agency {agency.id} does not have gtfs_url in config')

    cache_dir = Path(gtfs_cache_dir)
    if not cache_dir.exists():
        print(f'downloading gtfs data from {gtfs_url}')
        r = requests.get(gtfs_url)

        if r.status_code != 200:
            raise Exception(f"Error fetching {gtfs_url}: HTTP {r.status_code}: {r.text}")

        zip_path = f'{util.get_data_dir()}/gtfs-{agency.id}.zip'

        with open(zip_path, 'wb') as f:
            f.write(r.content)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(gtfs_cache_dir)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Merge route information from Nextbus API and GTFS')
    parser.add_argument('--agency', required=False, help='Agency ID')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    for agency in agencies:
        agency_id = agency.id
        gtfs_cache_dir = f'{util.get_data_dir()}/gtfs-{agency_id}'

        download_gtfs_data(agency, gtfs_cache_dir)

        feed = ptg.load_geo_feed(gtfs_cache_dir, {})

        print(f"Loading {agency_id} routes...")
        routes_df = feed.routes
        if agency.gtfs_agency_id is not None:
            routes_df = routes_df[routes_df.agency_id == agency.gtfs_agency_id]

        routes_data = []

        print(f"Loading {agency_id} trips...")
        trips_df = feed.trips
        trips_df['direction_id'] = trips_df['direction_id'].astype(str)

        print(f"Loading {agency_id} stop times...")
        stop_times_df = feed.stop_times
        print(f"Loading {agency_id} shapes...")
        shapes_df = feed.shapes

        print(f"Loading {agency_id} stops...")
        stops_df = feed.stops
        stops_map = {stop.stop_id: stop for stop in stops_df.itertuples()}

        for route in routes_df.itertuples():

            gtfs_route_id = route.route_id

            short_name = route.route_short_name
            long_name = route.route_long_name

            if isinstance(short_name, str) and isinstance(long_name, str):
                title = f'{short_name} - {long_name}'
            elif isinstance(short_name, str):
                title = short_name
            else:
                title = long_name

            type = int(route.route_type) if hasattr(route, 'route_type') else None
            url = route.route_url if hasattr(route, 'route_url') and isinstance(route.route_url, str) else None
            #color = route.route_color
            #text_color = route.route_text_color

            sort_order = int(route.route_sort_order) if hasattr(route, 'route_sort_order') else None

            route_id = getattr(route, agency.route_id_gtfs_field)

            if agency.provider == 'nextbus':
                route_id = route_id.replace('-', '_') # hack to handle muni route IDs where e.g. GTFS has "T-OWL" but nextbus has "T_OWL"
                try:
                    nextbus_route_config = nextbus.get_route_config(agency.nextbus_id, route_id)
                    title = nextbus_route_config.title
                except Exception as ex:
                    print(ex)
                    continue

            print(f'route {route_id} {title}')

            route_data = {
                'id': route_id,
                'title': title,
                'url': url,
                'type': type,
                #'color': color,
                #'text_color': text_color,
                'gtfs_route_id': gtfs_route_id,
                'sort_order': sort_order,
                'stops': {},
                'directions': [],
            }


            # unofficial trimet gtfs extension
            directions = []

            route_directions_df = feed.get('route_directions.txt')
            if not route_directions_df.empty:
                route_directions_df = route_directions_df[route_directions_df['route_id'] == gtfs_route_id]
            else:
                route_directions_df = None

            routes_data.append(route_data)

            route_trips_df = trips_df[trips_df['route_id'] == gtfs_route_id]

            route_direction_ids = np.unique(route_trips_df['direction_id'].values)

            route_shape_ids, route_shape_id_counts = np.unique(route_trips_df['shape_id'].values, return_counts=True)

            # sort from most common -> least common (used as tiebreak for two shapes with the same total distance to first/last stop)
            route_shape_id_order = np.argsort(-1 * route_shape_id_counts)

            route_shape_ids = route_shape_ids[route_shape_id_order]
            route_shape_id_counts = route_shape_id_counts[route_shape_id_order]

            used_shape_ids = {}

            for direction_id in route_direction_ids:

                print(f' direction = {direction_id}')

                direction_trips_df = route_trips_df[route_trips_df['direction_id'] == direction_id]
                direction_shape_ids, direction_shape_id_counts = np.unique(direction_trips_df['shape_id'].values, return_counts=True)
                direction_common_shape_id_index = np.argmax(direction_shape_id_counts)
                direction_common_shape_id = direction_shape_ids[direction_common_shape_id_index]

                print(f'  most common shape = {direction_common_shape_id} ({direction_shape_id_counts[direction_common_shape_id_index]} times)')

                example_trip = direction_trips_df[direction_trips_df['shape_id'] == direction_common_shape_id].iloc[0]
                example_trip_id = example_trip.trip_id

                route_direction = route_directions_df[route_directions_df['direction_id'] == direction_id] if route_directions_df is not None else None

                if route_direction is not None and not route_direction.empty:
                    direction_title = route_direction['direction_name'].values[0]
                elif hasattr(example_trip, 'trip_headsign'):
                    direction_title = example_trip.trip_headsign
                else:
                    direction_title = direction_id

                dir_stop_ids = []

                dir_data = {
                    'id': direction_id,
                    'title': direction_title,
                    'gtfs_shape_id': direction_common_shape_id,
                    #'name': dir_info.name,
                    'stops': dir_stop_ids,
                    'stop_geometry': {},
                }
                route_data['directions'].append(dir_data)

                example_trip_stop_times = stop_times_df[stop_times_df['trip_id'] == example_trip_id].sort_values('stop_sequence')

                for stop_time in example_trip_stop_times.itertuples():
                    stop = stops_map[stop_time.stop_id]
                    #print(stop)
                    stop_data = {
                        'id': stop.stop_id,
                        'lat': round(stop.geometry.y, 5), # stop_lat in gtfs
                        'lon': round(stop.geometry.x, 5), # stop_lon in gtfs
                        'title': stop.stop_name,
                        'url': stop.stop_url if hasattr(stop, 'stop_url') and isinstance(stop.stop_url, str) else None,
                    }
                    route_data['stops'][stop.stop_id] = stop_data
                    dir_stop_ids.append(stop.stop_id)

                geometry = shapes_df[shapes_df['shape_id'] == direction_common_shape_id]['geometry'].values[0]

                # partridge returns GTFS geometries for each shape_id as a shapely LineString
                # (https://shapely.readthedocs.io/en/stable/manual.html#linestrings).
                # Each coordinate is an array in [lon,lat] format (note: longitude first, latitude second)
                dir_data['coords'] = [
                    {
                        'lat': round(coord[1], 5),
                        'lon': round(coord[0], 5)
                    } for coord in geometry.coords
                ]

                if agency.provider == 'nextbus':
                    # match nextbus direction IDs with GTFS direction IDs
                    best_nextbus_dir_info, best_terminal_dist = match_nextbus_direction(nextbus_route_config, geometry)
                    print(f'  {direction_id} = {best_nextbus_dir_info.id} (terminal_dist={int(best_terminal_dist)}) {" (questionable match)" if best_terminal_dist > 300 else ""}')

                    dir_data['title'] = best_nextbus_dir_info.title
                    dir_data['nextbus_direction_id'] = best_nextbus_dir_info.id

                start_lat = geometry.coords[0][1]
                start_lon = geometry.coords[0][0]

                #print(f"  start_lat = {start_lat} start_lon = {start_lon}")

                deg_lat_dist = util.haver_distance(start_lat, start_lon, start_lat-0.1, start_lon)*10
                deg_lon_dist = util.haver_distance(start_lat, start_lon, start_lat, start_lon-0.1)*10

                # projection function from lon/lat coordinates in degrees (z ignored) to x/y coordinates in meters.
                # satisfying the interface of shapely.ops.transform (https://shapely.readthedocs.io/en/stable/manual.html#shapely.ops.transform).
                # This makes it possible to use shapely methods to calculate the distance in meters between geometries
                def project_xy(lon, lat, z=None):
                    return (round((lon - start_lon) * deg_lon_dist, 1), round((lat - start_lat) * deg_lat_dist, 1))

                xy_geometry = shapely.ops.transform(project_xy, geometry)

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

                print(f"  distance = {dir_data['distance']}")

                prev_after_index = None

                for stop_id in dir_stop_ids:
                    stop_geometry = get_stop_geometry(route_data['stops'][stop_id], xy_geometry, shape_lat, shape_lon, shape_cumulative_dist)

                    if prev_after_index is not None and stop_geometry['after_index'] < prev_after_index:
                        print(f"    !! bad geometry for stop {stop_id}: after_index {stop_geometry['after_index']} not in ascending order")
                        continue

                    if stop_geometry['offset'] > 100:
                        print(f"    !! bad geometry for stop {stop_id}: {stop_geometry['offset']} m from route line segment")
                        continue

                    dir_data['stop_geometry'][stop_id] = stop_geometry

                    prev_after_index = stop_geometry['after_index']

            '''
            if route_shape_ids is not None:
                for i, shape_id in enumerate(route_shape_ids):
                    if shape_id not in used_shape_ids:
                        print(f'  ? = {shape_id} (n={route_shape_id_counts[i]})')
            '''

        if routes_data[0]['sort_order'] is not None:
            sort_key = lambda route_data: route_data['sort_order']
        else:
            sort_key = lambda route_data: route_data['id']

        routes_data = sorted(routes_data, key=sort_key)

        data_str = json.dumps({
            'version': routeconfig.DefaultVersion,
            'routes': routes_data
        }, separators=(',', ':'))

        cache_path = routeconfig.get_cache_path(agency_id)

        with open(cache_path, "w") as f:
            f.write(data_str)

        if args.s3:
            s3 = boto3.resource('s3')
            s3_path = routeconfig.get_s3_path(agency_id)
            s3_bucket = routeconfig.get_s3_bucket()
            print(f'saving to s3://{s3_bucket}/{s3_path}')
            object = s3.Object(s3_bucket, s3_path)
            object.put(
                Body=gzip.compress(bytes(data_str, 'utf-8')),
                CacheControl='max-age=86400',
                ContentType='application/json',
                ContentEncoding='gzip',
                ACL='public-read'
            )
