from datetime import date
from models import gtfs, nextbus, util
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

agency_id = 'sf-muni'
gtfs_url = 'http://gtfs.sfmta.com/transitdata/google_transit.zip'
center_lat = 37.772
center_lon = -122.442
save_to_s3 = True

gtfs_cache_dir = f'{util.get_data_dir()}/gtfs-{agency_id}'

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

gtfs_scraper = gtfs.GtfsScraper(gtfs_cache_dir, agency_id, 'v1')

routes = nextbus.get_route_list(agency_id)

routes_data = []

deg_lat_dist = util.haver_distance(center_lat, center_lon, center_lat-0.1, center_lon)*10
deg_lon_dist = util.haver_distance(center_lat, center_lon, center_lat, center_lon-0.1)*10

def project_xy(lon, lat, z=None):
    return (round((lon - center_lon) * deg_lon_dist, 1), round((lat - center_lat) * deg_lat_dist, 1))

def distance(x1, x2, y1, y2):
    return np.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)

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
        'stops': {stop.id: {'title': stop.title, 'lat': stop.lat, 'lon': stop.lon} for stop in route.get_stop_infos()}
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

        first_stop_xy = shapely.geometry.Point(project_xy(first_stop_info.lon, first_stop_info.lat))
        last_stop_xy = shapely.geometry.Point(project_xy(last_stop_info.lon, last_stop_info.lat))

        geometries = []

        for shape_id in route_shape_ids:
            geometry = shapes[shapes['shape_id'] == shape_id]['geometry'].values[0]
            geometries.append(geometry)

            shape_start_xy = shapely.geometry.Point(project_xy(*geometry.coords[0]))
            shape_end_xy = shapely.geometry.Point(project_xy(*geometry.coords[-1]))

            start_dist = distance(first_stop_xy.x, shape_start_xy.x, first_stop_xy.y, shape_start_xy.y)

            end_dist = distance(last_stop_xy.x, shape_end_xy.x, last_stop_xy.y, shape_end_xy.y)

            terminal_dist = start_dist + end_dist

            terminal_dists.append(terminal_dist)

        terminal_dist_order = np.argsort(terminal_dists)

        best_shape_index = terminal_dist_order[0]

        shape_id = route_shape_ids[best_shape_index]
        used_shape_ids[shape_id] = True

        print(f'  {direction_id} = {shape_id} (n={route_shape_id_counts[best_shape_index]})')

        geometry = geometries[best_shape_index]

        xy_geometry = shapely.ops.transform(project_xy, geometry)

        dir_data['gtfs_shape_id'] = shape_id
        dir_data['coords'] = [{'lat': round(coord[1], 5), 'lon': round(coord[0], 5)} for coord in geometry.coords]
        dir_data['distance'] = int(xy_geometry.length)

        geom_length = len(xy_geometry.coords)
        xy_array = np.array(xy_geometry)
        x_array = xy_array.T[0]
        y_array = xy_array.T[1]

        prev_x_array = np.r_[x_array[0], x_array[:-1]]
        prev_y_array = np.r_[y_array[0], y_array[:-1]]
        geom_dist = np.cumsum(distance(x_array, prev_x_array, y_array, prev_y_array))

        for stop_id in dir_stop_ids:
            stop_info = route.get_stop_info(stop_id)
            stop_xy = shapely.geometry.Point(project_xy(stop_info.lon, stop_info.lat))

            stop_geom_dist = distance(x_array, stop_xy.x, y_array, stop_xy.y)

            closest_index = int(np.argmin(stop_geom_dist))

            if closest_index == 0:
                stop_geom_index = 0
            elif closest_index + 1 >= geom_length:
                stop_geom_index = closest_index - 1
            else:
                next_line = shapely.geometry.LineString(xy_geometry.coords[closest_index:closest_index+2])
                next_line_dist = next_line.distance(stop_xy)

                prev_line = shapely.geometry.LineString(xy_geometry.coords[closest_index-1:closest_index+1])
                prev_line_dist = prev_line.distance(stop_xy)

                stop_geom_index = closest_index if next_line_dist < prev_line_dist else closest_index - 1

            stop_dist = geom_dist[stop_geom_index] + stop_geom_dist[stop_geom_index]

            dir_data['stop_geometry'][stop_id] = {'distance': int(stop_dist), 'after_index': stop_geom_index}

    if route_shape_ids is not None:
        for i, shape_id in enumerate(route_shape_ids):
            if shape_id not in used_shape_ids:
                print(f'  ? = {shape_id} (n={route_shape_id_counts[i]})')

data_str = json.dumps({
    'version': 'v1',
    'routes': routes_data
}, separators=(',', ':'))

cache_path = f'{util.get_data_dir()}/routes_v1_{agency_id}.json'

with open(cache_path, "w") as f:
    f.write(data_str)

if save_to_s3:
    s3 = boto3.resource('s3')
    s3_path = f'routes_v1_{agency_id}.json.gz'
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
