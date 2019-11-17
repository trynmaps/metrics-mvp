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
import hashlib
import math
import zipfile

# Downloads and parses the GTFS specification (hardcoded for Muni for now),
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

def get_stop_geometry(stop_xy, shape_lines_xy, shape_cumulative_dist, start_index):

    num_shape_lines = len(shape_lines_xy)

    best_offset = 99999999
    best_index = 0

    shape_index = start_index

    while shape_index < num_shape_lines:
        shape_line_offset = shape_lines_xy[shape_index].distance(stop_xy)

        if shape_line_offset < best_offset:
            best_offset = shape_line_offset
            best_index = shape_index

        if best_offset < 50 and shape_line_offset > best_offset:
            break

        shape_index += 1


    shape_point = shapely.geometry.Point(shape_lines_xy[best_index].coords[0])
    distance_after_shape_point = stop_xy.distance(shape_point)
    distance_to_shape_point = shape_cumulative_dist[best_index]
    stop_dist = distance_to_shape_point + distance_after_shape_point

    if best_offset > 30:
        print(f'   stop_dist = {int(stop_dist)} = ({int(distance_to_shape_point)} + {int(distance_after_shape_point)}),  offset = {int(best_offset)},  after_index = {best_index} ')

    return {
        'distance': int(stop_dist), # total distance in meters along the route shape to this stop
        'after_index': best_index, # the index of the coordinate of the shape just before this stop
        'offset': int(best_offset) # distance in meters between this stop and the closest line segment of shape
    }

def get_unique_shapes(direction_trips_df, stop_times_df, stops_map, normalize_gtfs_stop_id):

    stop_times_trip_id_values = stop_times_df['trip_id'].values

    direction_shape_id_values = direction_trips_df['shape_id'].values

    unique_shapes_map = {}

    direction_shape_ids, direction_shape_id_counts = np.unique(direction_shape_id_values, return_counts=True)
    direction_shape_id_order = np.argsort(-1 * direction_shape_id_counts)

    direction_shape_ids = direction_shape_ids[direction_shape_id_order]
    direction_shape_id_counts = direction_shape_id_counts[direction_shape_id_order]

    for shape_id, shape_id_count in zip(direction_shape_ids, direction_shape_id_counts):
        shape_trip = direction_trips_df[direction_shape_id_values == shape_id].iloc[0]
        shape_trip_id = shape_trip.trip_id
        shape_trip_stop_times = stop_times_df[stop_times_trip_id_values == shape_trip_id].sort_values('stop_sequence')

        shape_trip_stop_ids = [
            normalize_gtfs_stop_id(gtfs_stop_id)
            for gtfs_stop_id in shape_trip_stop_times['stop_id'].values
        ]

        unique_shape_key = hashlib.sha256(json.dumps(shape_trip_stop_ids).encode('utf-8')).hexdigest()[0:12]

        #print(f'  shape {shape_id} ({shape_id_count})')

        if unique_shape_key not in unique_shapes_map:
            for other_shape_key, other_shape_info in unique_shapes_map.items():
                #print(f"   checking match with {shape_id} and {other_shape_info['shape_id']}")
                if is_subsequence(shape_trip_stop_ids, other_shape_info['stop_ids']):
                    print(f"    shape {shape_id} is subsequence of shape {other_shape_info['shape_id']}")
                    unique_shape_key = other_shape_key
                    break
                elif is_subsequence(other_shape_info['stop_ids'], shape_trip_stop_ids):
                    print(f"    shape {other_shape_info['shape_id']} is subsequence of shape {shape_id}")
                    shape_id_count += other_shape_info['count']
                    del unique_shapes_map[other_shape_key]
                    break

        if unique_shape_key not in unique_shapes_map:
            unique_shapes_map[unique_shape_key] = {
                'count': 0,
                'shape_id': shape_id,
                'stop_ids': shape_trip_stop_ids
            }

        unique_shapes_map[unique_shape_key]['count'] += shape_id_count

    sorted_shapes = sorted(unique_shapes_map.values(), key=lambda shape: -1 * shape['count'])

    for shape_info in sorted_shapes:
        count = shape_info['count']
        shape_id = shape_info['shape_id']
        stop_ids = shape_info['stop_ids']

        first_stop_id = stop_ids[0]
        last_stop_id = stop_ids[-1]
        first_stop = stops_map[first_stop_id]
        last_stop = stops_map[last_stop_id]

        print(f'  shape_id: {shape_id} ({count}x) stops:{len(stop_ids)} from {first_stop_id} {first_stop.stop_name} to {last_stop_id} {last_stop.stop_name} {",".join(stop_ids)}')

    return sorted_shapes

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

def is_subsequence(smaller, bigger):
    smaller_len = len(smaller)
    bigger_len = len(bigger)
    if smaller_len > bigger_len:
        return False

    try:
        start_pos = bigger.index(smaller[0])
    except ValueError:
        return False

    end_pos = start_pos+smaller_len
    if end_pos > bigger_len:
        return False

    return smaller == bigger[start_pos:end_pos]

def save_routes_for_agency(agency: config.Agency, save_to_s3=True):
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

    # gtfs_stop_ids_map allows looking up row from stops.txt via GTFS stop_id
    gtfs_stop_ids_map = {stop.stop_id: stop for stop in stops_df.itertuples()}

    stop_id_gtfs_field = agency.stop_id_gtfs_field

    # get OpenTransit stop ID for GTFS stop_id (may be the same)
    def normalize_gtfs_stop_id(gtfs_stop_id):
        if stop_id_gtfs_field != 'stop_id':
            return getattr(gtfs_stop_ids_map[gtfs_stop_id], stop_id_gtfs_field)
        else:
            return gtfs_stop_id

    # stops_map allows looking up row from stops.txt via OpenTransit stop ID
    if stop_id_gtfs_field != 'stop_id':
        stops_map = {getattr(stop, stop_id_gtfs_field): stop for stop in stops_df.itertuples()}
    else:
        stops_map = gtfs_stop_ids_map

    if agency.provider == 'nextbus':
        nextbus_route_order = [route.id for route in nextbus.get_route_list(agency.nextbus_id)]

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

        route_id = getattr(route, agency.route_id_gtfs_field)

        if agency.provider == 'nextbus':
            route_id = route_id.replace('-', '_') # hack to handle muni route IDs where e.g. GTFS has "T-OWL" but nextbus has "T_OWL"
            try:
                nextbus_route_config = nextbus.get_route_config(agency.nextbus_id, route_id)
                title = nextbus_route_config.title
            except Exception as ex:
                print(ex)
                continue

            try:
                sort_order = nextbus_route_order.index(route_id)
            except ValueError as ex:
                print(ex)
                sort_order = None
        else:
            sort_order = int(route.route_sort_order) if hasattr(route, 'route_sort_order') else None

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

        directions = []

        route_directions_df = feed.get('route_directions.txt') # unofficial trimet gtfs extension
        if not route_directions_df.empty:
            route_directions_df = route_directions_df[route_directions_df['route_id'] == gtfs_route_id]
        else:
            route_directions_df = None

        routes_data.append(route_data)

        route_trips_df = trips_df[trips_df['route_id'] == gtfs_route_id]

        route_direction_id_values = route_trips_df['direction_id'].values

        def add_custom_direction(custom_direction_info):
            direction_id = custom_direction_info['id']
            print(f' custom direction = {direction_id}')

            gtfs_direction_id = custom_direction_info['gtfs_direction_id']

            direction_trips_df = route_trips_df[route_direction_id_values == gtfs_direction_id]

            contains_stop_ids = custom_direction_info.get('stop_ids', [])
            not_stop_ids = custom_direction_info.get('not_stop_ids', [])

            shapes = get_unique_shapes(
                direction_trips_df=direction_trips_df,
                stop_times_df=stop_times_df,
                stops_map=stops_map,
                normalize_gtfs_stop_id=normalize_gtfs_stop_id
            )

            def contains_required_stops(shape_stop_ids):
                min_index = 0
                for stop_id in contains_stop_ids:
                    try:
                        index = shape_stop_ids.index(stop_id, min_index)
                    except ValueError:
                        return False
                    min_index = index + 1
                return True

            def contains_prohibited_stop(shape_stop_ids):
                for stop_id in not_stop_ids:
                    try:
                        index = shape_stop_ids.index(stop_id)
                        return True
                    except ValueError:
                        pass
                return False

            matching_shapes = []
            for shape in shapes:
                shape_stop_ids = shape['stop_ids']
                if contains_required_stops(shape_stop_ids) and not contains_prohibited_stop(shape_stop_ids):
                    matching_shapes.append(shape)

            if len(matching_shapes) != 1:
                matching_shape_ids = [shape['shape_id'] for shape in matching_shapes]
                stops_desc = ''
                if len(contains_stop_ids) > 0:
                    stops_desc += f" containing {','.join(contains_stop_ids)}"

                if len(not_stop_ids) > 0:
                    stops_desc += f" not containing {','.join(not_stop_ids)}"

                raise Exception(f"{len(matching_shapes)} shapes found for route {route_id} with GTFS direction ID {gtfs_direction_id}{stops_desc}: {','.join(matching_shape_ids)}")

            matching_shape = matching_shapes[0]
            matching_shape_id = matching_shape['shape_id']
            matching_shape_count = matching_shape['count']

            print(f'  matching shape = {matching_shape_id} ({matching_shape_count} times)')

            add_direction(
                id=direction_id,
                gtfs_shape_id=matching_shape_id,
                gtfs_direction_id=gtfs_direction_id,
                stop_ids=matching_shape['stop_ids'],
                title=custom_direction_info.get('title', None)
            )

        def add_default_direction(direction_id):
            print(f' default direction = {direction_id}')

            direction_trips_df = route_trips_df[route_direction_id_values == direction_id]

            shapes = get_unique_shapes(
                direction_trips_df=direction_trips_df,
                stop_times_df=stop_times_df,
                stops_map=stops_map,
                normalize_gtfs_stop_id=normalize_gtfs_stop_id)

            best_shape = shapes[0]
            best_shape_id = best_shape['shape_id']
            best_shape_count = best_shape['count']

            print(f'  most common shape = {best_shape_id} ({best_shape_count} times)')

            add_direction(
                id=direction_id,
                gtfs_shape_id=best_shape_id,
                gtfs_direction_id=direction_id,
                stop_ids=best_shape['stop_ids']
            )

        def add_direction(id, gtfs_shape_id, gtfs_direction_id, stop_ids, title = None):

            if title is None:
                default_direction_info = agency.default_directions.get(gtfs_direction_id, {})
                title_prefix = default_direction_info.get('title_prefix', None)

                last_stop_id = stop_ids[-1]
                last_stop = stops_map[last_stop_id]

                if title_prefix is not None:
                    title = f"{title_prefix} to {last_stop.stop_name}"
                else:
                    title = f"To {last_stop.stop_name}"

            print(f'  title = {title}')

            dir_data = {
                'id': id,
                'title': title,
                'gtfs_shape_id': gtfs_shape_id,
                'gtfs_direction_id': gtfs_direction_id,
                'stops': stop_ids,
                'stop_geometry': {},
            }
            route_data['directions'].append(dir_data)

            for stop_id in stop_ids:
                stop = stops_map[stop_id]
                stop_data = {
                    'id': stop_id,
                    'lat': round(stop.geometry.y, 5), # stop_lat in gtfs
                    'lon': round(stop.geometry.x, 5), # stop_lon in gtfs
                    'title': stop.stop_name,
                    'url': stop.stop_url if hasattr(stop, 'stop_url') and isinstance(stop.stop_url, str) else None,
                }
                route_data['stops'][stop_id] = stop_data

            geometry = shapes_df[shapes_df['shape_id'] == gtfs_shape_id]['geometry'].values[0]

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
                # dir_data['title'] = best_nextbus_dir_info.title
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

            shape_lines_xy = [shapely.geometry.LineString(xy_geometry.coords[i:i+2]) for i in range(0, len(xy_geometry.coords) - 1)]

            # this is the total distance of the GTFS shape, which may not be exactly the same as the
            # distance along the route between the first and last Nextbus stop
            dir_data['distance'] = int(shape_cumulative_dist[-1])

            print(f"  distance = {dir_data['distance']}")

            # Find each stop along the route shape, so that the frontend can draw line segments between stops along the shape
            start_index = 0

            for stop_id in stop_ids:
                stop_info = route_data['stops'][stop_id]

                # Need to project lon/lat coords to x/y in order for shapely to determine the distance between
                # a point and a line (shapely doesn't support distance for lon/lat coords)

                stop_xy = shapely.geometry.Point(project_xy(stop_info['lon'], stop_info['lat']))

                stop_geometry = get_stop_geometry(stop_xy, shape_lines_xy, shape_cumulative_dist, start_index)

                if stop_geometry['offset'] > 100:
                    print(f"    !! bad geometry for stop {stop_id}: {stop_geometry['offset']} m from route line segment")
                    continue

                dir_data['stop_geometry'][stop_id] = stop_geometry

                start_index = stop_geometry['after_index']

        if route_id in agency.custom_directions:
            for custom_direction_info in agency.custom_directions[route_id]:
                add_custom_direction(custom_direction_info)
        else:
            for direction_id in np.unique(route_direction_id_values):
                add_default_direction(direction_id)

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

    if save_to_s3:
        s3 = boto3.resource('s3')
        s3_path = routeconfig.get_s3_path(agency_id)
        s3_bucket = config.s3_bucket
        print(f'saving to s3://{s3_bucket}/{s3_path}')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body=gzip.compress(bytes(data_str, 'utf-8')),
            CacheControl='max-age=86400',
            ContentType='application/json',
            ContentEncoding='gzip',
            ACL='public-read'
        )

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Save route configuration from GTFS and possibly Nextbus API')
    parser.add_argument('--agency', required=False, help='Agency ID')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    for agency in agencies:
        save_routes_for_agency(agency, args.s3)

