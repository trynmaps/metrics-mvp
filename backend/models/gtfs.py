import shapely
import partridge as ptg
import numpy as np
from pathlib import Path
import requests
import json
import boto3
import gzip
import hashlib
import zipfile

from . import config, util, nextbus, routeconfig, timetables

def get_stop_geometry(stop_xy, shape_lines_xy, shape_cumulative_dist, start_index):
    # Finds the first position of a particular stop along a shape (after the start_index'th line segment in shape_lines_xy),
    # using XY coordinates in meters.
    # The returned dict is used by the frontend to draw line segments along a route between two stops.

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

def contains_included_stops(shape_stop_ids, included_stop_ids):
    min_index = 0
    for stop_id in included_stop_ids:
        try:
            index = shape_stop_ids.index(stop_id, min_index)
        except ValueError:
            return False
        min_index = index + 1 # stops must appear in same order as in included_stop_ids
    return True

def contains_excluded_stop(shape_stop_ids, excluded_stop_ids):
    for stop_id in excluded_stop_ids:
        try:
            index = shape_stop_ids.index(stop_id)
            return True
        except ValueError:
            pass
    return False

class GtfsScraper:
    def __init__(self, agency: config.Agency):
        self.agency = agency
        self.agency_id = agency_id = agency.id
        gtfs_cache_dir = f'{util.get_data_dir()}/gtfs-{agency_id}'

        download_gtfs_data(agency, gtfs_cache_dir)

        self.feed = ptg.load_geo_feed(gtfs_cache_dir, {})
        print(self.feed.routes.head())
        self.errors = []
        self.stop_times_by_trip = None
        self.stops_df = None
        self.trips_df = None
        self.routes_df = None
        self.stop_times_df = None
        self.shapes_df = None
        self.gtfs_stop_ids_map = None
        self.stops_map = None

    def get_stop_row(self, stop_id):
        # allows looking up row from stops.txt via OpenTransit stop ID
        if self.stops_map is None:
            stop_id_gtfs_field = self.agency.stop_id_gtfs_field
            self.stops_map = {getattr(stop, stop_id_gtfs_field): stop for stop in self.get_gtfs_stops().itertuples()}

        stop_row = self.stops_map.get(stop_id, None)

        if stop_row is None:
            stop_id, trip_occurrence = stop_id.split("-")
            return self.stops_map[stop_id]
        else:
            return stop_row

    def get_stop_row_by_gtfs_stop_id(self, gtfs_stop_id):
        # allows looking up row from stops.txt via GTFS stop_id
        if self.gtfs_stop_ids_map is None:
            self.gtfs_stop_ids_map = {stop.stop_id: stop for stop in self.get_gtfs_stops().itertuples()}

        return self.gtfs_stop_ids_map[gtfs_stop_id]

    def get_gtfs_stops(self):
        if self.stops_df is None:
            print(f"Loading {self.agency_id} stops...")
            self.stops_df = self.feed.stops

        return self.stops_df

    def get_gtfs_trips(self):
        if self.trips_df is None:
            print(f"Loading {self.agency_id} trips...")
            trips_df = self.feed.trips
            trips_df['direction_id'] = trips_df['direction_id'].astype(str)
            self.trips_df = trips_df

        return self.trips_df

    def get_gtfs_routes(self):
        if self.routes_df is None:
            print(f"Loading {self.agency_id} routes...")
            routes_df = self.feed.routes
            agency = self.agency
            if agency.gtfs_agency_id is not None:
                routes_df = routes_df[routes_df.agency_id == agency.gtfs_agency_id]
            self.routes_df = routes_df

        return self.routes_df

    def get_gtfs_shapes(self):
        if self.shapes_df is None:
            print(f"Loading {self.agency_id} shapes...")
            self.shapes_df = self.feed.shapes

        return self.shapes_df

    def get_gtfs_stop_times(self):
        if self.stop_times_df is None:
            print(f"Loading {self.agency_id} stop times...")
            self.stop_times_df = self.feed.stop_times

        return self.stop_times_df

    def get_services_by_date(self, ignore_day_of_week=False):
        """Returns map of a date object to a list of service_ids.
        Can optionally supply ignore_day_of_week, which includes all service_ids
        that are active on a date within a date range provided in calendar.txt
        regardless of the day of the week."""
        calendar_df = self.feed.calendar
        calendar_dates_df = self.feed.calendar_dates

        dates_map = {}

        for calendar_row in calendar_df.itertuples():
            # partridge library already parses date strings as Python date objects
            start_date = calendar_row.start_date
            end_date = calendar_row.end_date

            weekdays = []
            if calendar_row.monday == 1:
                weekdays.append(0)
            if calendar_row.tuesday == 1:
                weekdays.append(1)
            if calendar_row.wednesday == 1:
                weekdays.append(2)
            if calendar_row.thursday == 1:
                weekdays.append(3)
            if calendar_row.friday == 1:
                weekdays.append(4)
            if calendar_row.saturday == 1:
                weekdays.append(5)
            if calendar_row.saturday == 1:
                weekdays.append(6)

            if ignore_day_of_week:
                weekdays = [0, 1, 2, 3, 4, 5, 6]

            service_id = calendar_row.service_id

            for d in util.get_dates_in_range(start_date, end_date, weekdays=weekdays):
                if d not in dates_map:
                    dates_map[d] = []
                dates_map[d].append(service_id)

        for calendar_date_row in calendar_dates_df.itertuples():

            d = calendar_date_row.date

            service_id = calendar_date_row.service_id
            exception_type = calendar_date_row.exception_type
            if exception_type == 1: # 1 = add service to that date
                if d not in dates_map:
                    dates_map[d] = []
                dates_map[d].append(service_id)
            if exception_type == 2: # 2 = remove service from that date
                if d in dates_map:
                    if service_id in dates_map[d]:
                        dates_map[d].remove(service_id)
                    else:
                        print((
                            f"error in GTFS feed: service {service_id} removed "
                            f"from {d}, but it was not scheduled on that date"
                        ))

        return dates_map

    def save_timetables(self, save_to_s3=False, skip_existing=False):
        # If skip_existing is true, this will only save timetables if the GTFS feed contains any
        # new dates for which timetables haven't already been saved.
        #
        # Returns true if any new timetables were saved, and false otherwise.

        agency_id = self.agency_id

        dates_map = self.get_services_by_date()

        #
        # Typically, many dates have identical scheduled timetables (with times relative to midnight on that date).
        # Instead of storing redundant timetables for each date, store one timetable per route for each unique set of service_ids.
        # Each stored timetable is named with a string 'key' which is unique for each set of service_ids.
        #
        # A "date_keys" JSON object is stored in S3 and the local cache which maps dates to keys.
        #
        # Although the keys could be any string that is legal in paths, for ease of browsing, the keys are chosen to be
        # the string representation of one date with that set of service_ids.

        first_date_for_service_ids_map = {}

        try:
            old_date_keys = timetables.get_date_keys(agency_id)
        except FileNotFoundError as err:
            old_date_keys = {}

        date_keys = old_date_keys.copy()

        for d, service_ids in dates_map.items():
            service_ids = sorted(service_ids)
            service_ids_key = json.dumps(service_ids)
            if service_ids_key not in first_date_for_service_ids_map:
                first_date_for_service_ids_map[service_ids_key] = d

            date_keys[str(d)] = str(first_date_for_service_ids_map[service_ids_key])

        if skip_existing and date_keys == old_date_keys:
            print("No new dates in GTFS feed, skipping")
            return False

        trips_df = self.get_gtfs_trips()

        gtfs_route_id_map = {}

        route_configs = routeconfig.get_route_list(self.agency_id) # todo: use route config from parsing this GTFS file (will eventually be needed to process old GTFS feeds)
        for route_config in route_configs:
            gtfs_route_id_map[route_config.gtfs_route_id] = route_config

        for gtfs_route_id, route_trips in trips_df.groupby('route_id'):
            if gtfs_route_id not in gtfs_route_id_map:
                continue

            route_config = gtfs_route_id_map[gtfs_route_id]

            arrivals_by_service_id = {}
            trip_ids_map = {}

            for service_id, service_route_trips in route_trips.groupby('service_id'):
                arrivals_by_service_id[service_id] = self.get_scheduled_arrivals_by_service_id(service_id, route_config, service_route_trips, trip_ids_map)

            for service_ids_json, d in first_date_for_service_ids_map.items():
                service_ids = json.loads(service_ids_json)

                # merge scheduled arrivals for all service_ids that are in service on the same date
                merged_arrivals = {}

                for service_id in service_ids:
                    if service_id not in arrivals_by_service_id:
                        continue

                    service_id_arrivals = arrivals_by_service_id[service_id]

                    for dir_id, direction_arrivals in service_id_arrivals.items():
                        if dir_id not in merged_arrivals:
                            merged_arrivals[dir_id] = {}

                        direction_merged_arrivals = merged_arrivals[dir_id]

                        for stop_id, stop_arrivals in direction_arrivals.items():

                            if stop_id not in direction_merged_arrivals:
                                direction_merged_arrivals[stop_id] = []

                            direction_merged_arrivals[stop_id] = sorted(direction_merged_arrivals[stop_id] + stop_arrivals, key=lambda arr: arr['t'])

                date_key = str(d)

                cache_path = timetables.get_cache_path(agency_id, route_config.id, date_key)
                Path(cache_path).parent.mkdir(parents = True, exist_ok = True)

                data_str = json.dumps({
                    'version': timetables.DefaultVersion,
                    'agency': agency_id,
                    'route_id': route_config.id,
                    'date_key' : date_key,
                    'timezone_id': self.agency.timezone_id,
                    'service_ids': service_ids,
                    'arrivals': merged_arrivals,
                }, separators=(',', ':'))

                with open(cache_path, "w") as f:
                    f.write(data_str)

                if save_to_s3:
                    s3_path = timetables.get_s3_path(agency_id, route_config.id, date_key)
                    s3 = boto3.resource('s3')
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

        # save date keys last, so that if an error occurs while saving timetables,
        # the timetables will be saved again even with skip_existing=True

        date_keys_cache_path = timetables.get_date_keys_cache_path(agency_id)

        Path(date_keys_cache_path).parent.mkdir(parents = True, exist_ok = True)

        data_str = json.dumps({
            'version': timetables.DefaultVersion,
            'date_keys': {date_str: date_key for date_str, date_key in date_keys.items()},
        }, separators=(',', ':'))

        with open(date_keys_cache_path, "w") as f:
            f.write(data_str)

        if save_to_s3:
            s3 = boto3.resource('s3')
            s3_path = timetables.get_date_keys_s3_path(agency_id)
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

        return True

    def get_custom_direction_id(self, custom_directions_arr, gtfs_direction_id, stop_ids):

        possible_id = None

        for custom_direction in custom_directions_arr:

            if custom_direction['gtfs_direction_id'] == gtfs_direction_id:
                included_stop_ids = custom_direction.get('included_stop_ids', [])
                excluded_stop_ids = custom_direction.get('excluded_stop_ids', [])

                if not contains_excluded_stop(stop_ids, excluded_stop_ids):
                    if contains_included_stops(stop_ids, included_stop_ids):
                        return custom_direction['id']
                    elif possible_id is None:
                        possible_id = custom_direction['id']

        return possible_id

    def get_scheduled_arrivals_by_service_id(self, service_id, route_config, service_route_trips, trip_ids_map):

        # returns dict { direction_id => { stop_id => { 't': arrival_time, 'i': trip_int, 'e': departure_time } } }
        # where arrival_time and departure_time are the number of seconds after midnight,
        # and trip_int is a unique integer for each trip (instead of storing GTFS trip ID strings directly)

        agency = self.agency
        agency_id = agency.id

        route_id = route_config.id

        next_trip_int = 1
        if len(trip_ids_map) > 0:
            next_trip_int = max(trip_ids_map.values()) + 1

        print(f'service={service_id} route={route_id} #trips={len(service_route_trips)}')

        arrivals_by_direction = {}

        gtfs_direction_id_map = {}
        for dir_info in route_config.get_direction_infos():
            gtfs_direction_id_map[dir_info.gtfs_direction_id] = dir_info
            arrivals_by_direction[dir_info.id] = {}

        for route_trip in service_route_trips.itertuples():
            trip_id = route_trip.trip_id
            trip_stop_times = self.get_stop_times_for_trip(trip_id)

            if trip_id not in trip_ids_map:
                trip_ids_map[trip_id] = next_trip_int
                next_trip_int += 1

            trip_int = trip_ids_map[trip_id]

            gtfs_direction_id = route_trip.direction_id

            stop_ids = self.normalize_gtfs_stop_ids(trip_stop_times['stop_id'].values)

            if route_id in agency.custom_directions:
                custom_directions_arr = agency.custom_directions[route_id]
                custom_direction_id = self.get_custom_direction_id(custom_directions_arr, gtfs_direction_id, stop_ids)
                if custom_direction_id is None:
                    print(f"Unknown custom direction ID for trip {trip_id} ({gtfs_direction_id}, {stop_ids})")
                    continue

                print(f"Custom direction for route {route_id} trip {trip_id} = {custom_direction_id}")
                dir_info = route_config.get_direction_info(custom_direction_id)
            else:
                dir_info = gtfs_direction_id_map[gtfs_direction_id]

            direction_arrivals = arrivals_by_direction[dir_info.id]

            arrival_time_values = trip_stop_times['arrival_time'].values
            departure_time_values = trip_stop_times['departure_time'].values

            for i in range(len(trip_stop_times)):
                stop_id = stop_ids[i]

                arrival_time = int(arrival_time_values[i])
                departure_time = int(departure_time_values[i])

                arrival_data = {'t': arrival_time, 'i': trip_int}
                if departure_time != arrival_time:
                    arrival_data['e'] = departure_time

                if stop_id not in direction_arrivals:
                    direction_arrivals[stop_id] = []

                direction_arrivals[stop_id].append(arrival_data)

        for dir_info in route_config.get_direction_infos():
            if dir_info.is_loop():
                direction_arrivals = arrivals_by_direction[dir_info.id]
                self.clean_loop_schedule(dir_info, direction_arrivals)

        return arrivals_by_direction

    def clean_loop_schedule(self, dir_info, direction_arrivals):
        # For loop routes, the GTFS feed contains separate stop times for the end of one loop
        # and the beginning of the next loop. These stop times may be the same, or may be
        # slightly different if the vehicle waits a few minutes before beginning the next loop.
        #
        # Since the "end-of-loop" stop is not actually saved in our route configuration,
        # this function associates the end-of-loop times with the first stop. If there is an arrival time
        # at the first stop that is within a few minutes of the arrival time at the end-of-loop
        # stop, it is assumed to be the same 'trip' and will be updated to use the arrival time
        # of the end-of-loop stop.

        stop_ids = dir_info.get_stop_ids()
        first_stop_id = stop_ids[0]
        last_stop_id = stop_ids[0] + "-2"

        sort_key = lambda arr: arr['t']

        if (first_stop_id not in direction_arrivals) or (last_stop_id not in direction_arrivals):
            return

        first_stop_arrivals = sorted(direction_arrivals[first_stop_id], key=sort_key)
        last_stop_arrivals = sorted(direction_arrivals[last_stop_id], key=sort_key)

        prev_trip_ints = {}

        # avoid creating duplicate arrivals at the first stop
        # when the previous trip did not complete the entire loop.
        non_duplicate_arrivals = []
        prev_stop_arrival_time = None
        for i, stop_arrival in enumerate(first_stop_arrivals):
            stop_arrival_time = stop_arrival['t']
            if stop_arrival_time != prev_stop_arrival_time:
                non_duplicate_arrivals.append(stop_arrival)
            else:
                prev_trip_ints[stop_arrival['i']] = first_stop_arrivals[i-1]['i']

            prev_stop_arrival_time = stop_arrival_time

        first_stop_arrivals = direction_arrivals[first_stop_id] = non_duplicate_arrivals

        first_stop_arrival_index = 0
        num_first_stop_arrivals = len(first_stop_arrivals)

        unmatched_last_stop_arrivals = []

        for last_stop_arrival in last_stop_arrivals:
            last_stop_arrival_time = last_stop_arrival['t']

            is_matched = False

            while first_stop_arrival_index < num_first_stop_arrivals:
                first_stop_arrival = first_stop_arrivals[first_stop_arrival_index]
                first_stop_arrival_time = first_stop_arrival['t']

                first_stop_arrival_index += 1

                if first_stop_arrival_time >= last_stop_arrival_time:
                    # assume the next loop is a continuation of the same trip if the times are close
                    if first_stop_arrival_time <= last_stop_arrival_time + 360:
                        prev_trip_ints[first_stop_arrival['i']] = last_stop_arrival['i']
                        is_matched = True
                        if 'e' not in first_stop_arrival:
                            first_stop_arrival['t'] = last_stop_arrival_time
                            first_stop_arrival['e'] = first_stop_arrival_time

                    break

            if not is_matched:
                unmatched_last_stop_arrivals.append(last_stop_arrival)

        if len(unmatched_last_stop_arrivals) > 0:
            direction_arrivals[first_stop_id].extend(unmatched_last_stop_arrivals)

        # find the first integer trip ID associated with each continuous loop
        orig_trip_ints = {}
        for trip_int, prev_trip_int in prev_trip_ints.items():
            orig_trip_int = orig_trip_ints.get(prev_trip_int, prev_trip_int)
            orig_trip_ints[trip_int] = orig_trip_int

        # don't actually store schedule for "-2" stop which is not in route config
        del direction_arrivals[last_stop_id]

        # update arrivals so that all arrivals that are probably the same "trip"
        # have the same integer trip id, so that it is possible to compute
        # trip times across the beginning/end point of the loop
        for stop_id, stop_arrivals in direction_arrivals.items():
            for stop_arrival in stop_arrivals:
                orig_trip_int = orig_trip_ints.get(stop_arrival['i'], None)
                if orig_trip_int is not None:
                    stop_arrival['i'] = orig_trip_int

    def get_stop_times_for_trip(self, trip_id):
        if self.stop_times_by_trip is None:
            all_stop_times = self.get_gtfs_stop_times()
            self.stop_times_by_trip = {trip_id: stop_times for trip_id, stop_times in all_stop_times.groupby('trip_id')}
        return self.stop_times_by_trip[trip_id]

    def normalize_gtfs_stop_id(self, gtfs_stop_id, trip_occurrence=1):
        # get OpenTransit stop ID for GTFS stop_id (may be the same)
        stop_id_gtfs_field = self.agency.stop_id_gtfs_field
        if stop_id_gtfs_field != 'stop_id':
            base_stop_id = getattr(self.get_stop_row_by_gtfs_stop_id(gtfs_stop_id), stop_id_gtfs_field)
        else:
            base_stop_id = gtfs_stop_id

        if trip_occurrence > 1:
            return f'{base_stop_id}-{trip_occurrence}'
        else:
            return base_stop_id

    def normalize_gtfs_stop_ids(self, gtfs_stop_ids):
        # Returns a list of OpenTransit stop IDs given a list of GTFS stop IDs in one trip.
        #
        # The frontend assumes that each stop ID only appears once per direction.
        # However, some GTFS routes contain the same stop ID multiple times in one trip.
        #
        # This can occur if the route contains a figure-eight like SF Muni's 36-Teresita,
        # or if it is a loop like Portland Streetcar's A and B Loop.
        #
        # If the same GTFS stop ID appears multiple times in one trip, append
        # "-2" (or "-3" etc) to the stop ID so that we can uniquely identify where each stop ID
        # occurs in the trip.
        #
        # For loop routes, the ending "-2" stop will not actually be saved in the route config,
        # however "-2" stops will appear in the route config for figure-eight routes.
        #

        trip_occurrences_map = {}
        stop_ids = []

        for gtfs_stop_id in gtfs_stop_ids:
            trip_occurrence = trip_occurrences_map.get(gtfs_stop_id, 0) + 1
            stop_ids.append(self.normalize_gtfs_stop_id(gtfs_stop_id, trip_occurrence))
            trip_occurrences_map[gtfs_stop_id] = trip_occurrence

        return stop_ids

    def get_unique_shapes(self, direction_trips_df):
        # Finds the unique shapes associated with a GTFS route/direction, merging shapes that contain common subsequences of stops.
        # These unique shapes may represent multiple branches of a route.
        # Returns a list of dicts with properties 'shape_id', 'count', and 'stop_ids', sorted by count in descending order.

        stop_times_df = self.get_gtfs_stop_times()

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

            shape_trip_stop_ids = self.normalize_gtfs_stop_ids(shape_trip_stop_times['stop_id'].values)

            unique_shape_key = hashlib.sha256(json.dumps(shape_trip_stop_ids).encode('utf-8')).hexdigest()[0:12]

            #print(f'  shape {shape_id} ({shape_id_count})')

            matching_shape_ids = [shape_id]

            if unique_shape_key not in unique_shapes_map:
                for other_shape_key, other_shape_info in unique_shapes_map.items():
                    #print(f"   checking match with {shape_id} and {other_shape_info['shape_id']}")
                    if is_subsequence(shape_trip_stop_ids, other_shape_info['stop_ids']):
                        print(f"    shape {shape_id} is subsequence of shape {other_shape_info['shape_id']}")
                        unique_shape_key = other_shape_key
                        other_shape_info['shape_ids'].append(shape_id)
                        break
                    elif is_subsequence(other_shape_info['stop_ids'], shape_trip_stop_ids):
                        print(f"    shape {other_shape_info['shape_id']} is subsequence of shape {shape_id}")
                        shape_id_count += other_shape_info['count']
                        matching_shape_ids.extend(other_shape_info['shape_ids'])
                        del unique_shapes_map[other_shape_key]
                        break

            if unique_shape_key not in unique_shapes_map:
                unique_shapes_map[unique_shape_key] = {
                    'count': 0,
                    'shape_id': shape_id,
                    'stop_ids': shape_trip_stop_ids,
                    'shape_ids': matching_shape_ids,
                }

            unique_shapes_map[unique_shape_key]['count'] += shape_id_count

        sorted_shapes = sorted(unique_shapes_map.values(), key=lambda shape: -1 * shape['count'])

        for shape_info in sorted_shapes:
            count = shape_info['count']
            shape_id = shape_info['shape_id']
            stop_ids = shape_info['stop_ids']

            first_stop_id = stop_ids[0]
            last_stop_id = stop_ids[-1]
            first_stop = self.get_stop_row(first_stop_id)
            last_stop = self.get_stop_row(last_stop_id)

            print(f'  shape_id: {shape_id} ({count}x) stops:{len(stop_ids)} from {first_stop_id} {first_stop.stop_name} to {last_stop_id} {last_stop.stop_name} {",".join(stop_ids)}')

        return sorted_shapes

    def get_custom_direction_data(self, custom_direction_info, route_trips_df, route_id):
        direction_id = custom_direction_info['id']
        print(f' custom direction = {direction_id}')

        gtfs_direction_id = custom_direction_info['gtfs_direction_id']

        route_direction_id_values = route_trips_df['direction_id'].values

        direction_trips_df = route_trips_df[route_direction_id_values == gtfs_direction_id]

        included_stop_ids = custom_direction_info.get('included_stop_ids', [])
        excluded_stop_ids = custom_direction_info.get('excluded_stop_ids', [])

        shapes = self.get_unique_shapes(direction_trips_df)

        matching_shapes = []
        for shape in shapes:
            shape_stop_ids = shape['stop_ids']
            if contains_included_stops(shape_stop_ids, included_stop_ids) and not contains_excluded_stop(shape_stop_ids, excluded_stop_ids):
                matching_shapes.append(shape)

        if len(matching_shapes) == 0:
            error_message = f'No shapes found for {self.agency_id} route {route_id} custom direction {direction_id} with GTFS direction ID {gtfs_direction_id}'
            if len(included_stop_ids) > 0:
                error_message += f" including {','.join(included_stop_ids)}"

            if len(excluded_stop_ids) > 0:
                error_message += f" excluding {','.join(excluded_stop_ids)}"

            # Redundant custom directions shouldn't cause an exception
            # self.errors.append(error_message)
            print(f'  {error_message}')
            return None
        elif len(matching_shapes) > 1:
            # Matching shapes already sorted by count in descending order
            print("   multiple matching shapes found: " + ', '.join([f"{shape['shape_id']} ({shape['count']} times)" for shape in matching_shapes]))

        matching_shape = matching_shapes[0]
        matching_shape_id = matching_shape['shape_id']
        matching_shape_count = matching_shape['count']

        print(f'  matching shape = {matching_shape_id} ({matching_shape_count} times)')

        return self.get_direction_data(
            id=direction_id,
            gtfs_shape_id=matching_shape_id,
            gtfs_direction_id=gtfs_direction_id,
            stop_ids=matching_shape['stop_ids'],
            route_id=route_id,
            title=custom_direction_info.get('title', None),
        )

    def get_default_direction_data(self, direction_id, route_trips_df, route_id):
        print(f' default direction = {direction_id}')

        route_direction_id_values = route_trips_df['direction_id'].values

        direction_trips_df = route_trips_df[route_direction_id_values == direction_id]

        shapes = self.get_unique_shapes(direction_trips_df)

        best_shape = shapes[0]
        best_shape_id = best_shape['shape_id']
        best_shape_count = best_shape['count']

        print(f'  most common shape = {best_shape_id} ({best_shape_count} times)')

        return self.get_direction_data(
            id=direction_id,
            gtfs_shape_id=best_shape_id,
            gtfs_direction_id=direction_id,
            stop_ids=best_shape['stop_ids'],
            route_id=route_id,
        )

    def get_direction_data(self, id, gtfs_shape_id, gtfs_direction_id, stop_ids, route_id, title=None):
        agency = self.agency
        if title is None:
            # use the first directions map each route matches.
            title_prefix = None
            for default_direction in agency.default_directions:
                if 'routes' not in default_direction or route_id in default_direction['routes']:
                    title_prefix = default_direction['directions'][id].get(
                        'title_prefix',
                        None,
                    )
                    break

            last_stop_id = stop_ids[-1]
            last_stop = self.get_stop_row(last_stop_id)

            if title_prefix is not None:
                title = f"{title_prefix} to {last_stop.stop_name}"
            else:
                title = f"To {last_stop.stop_name}"

        print(f'  title = {title}')

        is_loop = stop_ids[0] + '-2' == stop_ids[-1]
        if is_loop:
            # remove last stop id from the list to simplify handling of loop routes
            stop_ids = stop_ids[:-1]

        dir_data = {
            'id': id,
            'title': title,
            'gtfs_shape_id': gtfs_shape_id,
            'gtfs_direction_id': gtfs_direction_id,
            'stops': stop_ids,
            'loop': is_loop,
            'stop_geometry': {},
        }

        shapes_df = self.get_gtfs_shapes()

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
        shape_cumulative_dist = np.cumsum(util.haver_distance(shape_lat, shape_lon, shape_prev_lat, shape_prev_lon))

        shape_lines_xy = [shapely.geometry.LineString(xy_geometry.coords[i:i+2]) for i in range(0, len(xy_geometry.coords) - 1)]

        # this is the total distance of the GTFS shape, which may not be exactly the same as the
        # distance along the route between the first and last Nextbus stop
        dir_data['distance'] = int(shape_cumulative_dist[-1])

        print(f"  distance = {dir_data['distance']}")

        # Find each stop along the route shape, so that the frontend can draw line segments between stops along the shape
        start_index = 0

        for stop_id in stop_ids:
            stop = self.get_stop_row(stop_id)

            # Need to project lon/lat coords to x/y in order for shapely to determine the distance between
            # a point and a line (shapely doesn't support distance for lon/lat coords)
            stop_xy = shapely.geometry.Point(project_xy(stop.geometry.x, stop.geometry.y))

            stop_geometry = get_stop_geometry(stop_xy, shape_lines_xy, shape_cumulative_dist, start_index)

            if stop_geometry['offset'] > 300:
                # Throw as skipping it will result in speed metrics API calls failing
                raise Exception(
                    f"Bad geometry for stop {stop_id}: {stop_geometry['offset']}m from route line segment"
                )

            dir_data['stop_geometry'][stop_id] = stop_geometry

            start_index = stop_geometry['after_index']

        return dir_data

    def get_route_data(self, route):
        agency = self.agency
        agency_id = agency.id

        trips_df = self.get_gtfs_trips()
        stops_df = self.get_gtfs_stops()
        stop_times = self.get_gtfs_stop_times()

        gtfs_route_id = route.route_id

        short_name = route.route_short_name
        long_name = route.route_long_name

        if isinstance(short_name, str) and isinstance(long_name, str):
            title = f'{short_name}-{long_name}'
        elif isinstance(short_name, str):
            title = short_name
        elif isinstance(long_name, str):
            title = long_name
        else:
            title = gtfs_route_id

        type = int(route.route_type) if hasattr(route, 'route_type') else None
        url = route.route_url if hasattr(route, 'route_url') and isinstance(route.route_url, str) else None
        color = route.route_color if hasattr(route, 'route_color') and isinstance(route.route_color, str) else None
        text_color = route.route_text_color if hasattr(route, 'route_text_color') and isinstance(route.route_text_color, str) else None
        sort_order = int(route.route_sort_order) if hasattr(route, 'route_sort_order') else None

        route_id = getattr(route, agency.route_id_gtfs_field)

        if agency.provider == 'nextbus':
            route_id = route_id.replace('-', '_') # hack to handle muni route IDs where e.g. GTFS has "T-OWL" but nextbus has "T_OWL"
            try:
                nextbus_route_config = nextbus.get_route_config(agency.nextbus_id, route_id)
                title = nextbus_route_config.title
            except Exception as ex:
                print(ex)

        print(f'route {route_id} {title}')

        route_data = {
            'id': route_id,
            'title': title,
            'url': url,
            'type': type,
            'color': color,
            'text_color': text_color,
            'gtfs_route_id': gtfs_route_id,
            'sort_order': sort_order,
            'stops': {},
        }

        route_trips_df = trips_df[trips_df['route_id'] == gtfs_route_id]

        if route_id in agency.custom_directions:
            route_data['directions'] = []
            for custom_direction_info in agency.custom_directions[route_id]:
                custom_direction_data = self.get_custom_direction_data(custom_direction_info, route_trips_df, route_id)
                if custom_direction_data is not None:
                    route_data['directions'].append(custom_direction_data)
        else:
            route_data['directions'] = [
                self.get_default_direction_data(direction_id, route_trips_df, route_id)
                for direction_id in np.unique(route_trips_df['direction_id'].values)
            ]

        min_lat = None
        min_lon = None
        max_lat = None
        max_lon = None

        for dir_data in route_data['directions']:
            for stop_id in dir_data['stops']:
                stop = self.get_stop_row(stop_id)
                stop_lat = round(stop.geometry.y, 5) # stop_lat in gtfs
                stop_lon = round(stop.geometry.x, 5) # stop_lon in gtfs

                if min_lat is None or min_lat > stop_lat:
                    min_lat = stop_lat
                if min_lon is None or min_lon > stop_lon:
                    min_lon = stop_lon
                if max_lat is None or max_lat < stop_lat:
                    max_lat = stop_lat
                if max_lon is None or max_lon < stop_lon:
                    max_lon = stop_lon

                stop_data = {
                    'id': stop_id,
                    'lat': stop_lat,
                    'lon': stop_lon,
                    'title': stop.stop_name,
                    'url': stop.stop_url if hasattr(stop, 'stop_url') and isinstance(stop.stop_url, str) else None,
                }
                route_data['stops'][stop_id] = stop_data

        route_data['bounds'] = [
            {'lat': min_lat, 'lon': min_lon},
            {'lat': max_lat, 'lon': max_lon}
        ]

        return route_data

    def get_active_routes(self, routes_df, d):
        """Returns routes in routes_df whose service_ids all have a
        start_date that is at or before and an end_date that is at or
        after the given date."""
        trips_df = self.get_gtfs_trips()
        dates_map = self.get_services_by_date(ignore_day_of_week=True)
        before_service_ids = []
        after_service_ids = []
        for service_date in dates_map:
            if service_date <= d:
                before_service_ids += dates_map[service_date]
            if service_date >= d:
                after_service_ids += dates_map[service_date]
        active_services = set.intersection(
            set(before_service_ids),
            set(after_service_ids),
        )
        def has_active_service_id(service_ids):
            for (_, service_id) in service_ids.iteritems():
                if service_id in active_services:
                    return True
            return False
        # Obtain is_active_routes_df by grouping trips_df, then join
        # with routes_df to add in the route columns.
        # Only return active routes from is_active_routes_df.
        #
        # Note that route_id represents the GTFS route_id, which is
        # unique and is not necessarily the route number,
        # as is the case for Muni.
        is_active_routes_df = trips_df.groupby('route_id').agg({
            'service_id': has_active_service_id,
        }).merge(
            routes_df.set_index('route_id'),
            left_index=True,
            right_index=True,
            validate='one_to_one',
        ).rename(columns={
            'service_id': 'has_active_service_id',
        }).reset_index()
        active_routes_df = is_active_routes_df[
            is_active_routes_df['has_active_service_id']
        ]
        active_routes_df = active_routes_df.drop(
            columns='has_active_service_id'
        )
        return active_routes_df

    def sort_routes(self, routes_data):
        agency = self.agency
        if agency.provider == 'nextbus':
            nextbus_route_order = [
                route.id for route in nextbus.get_route_list(agency.nextbus_id)
            ]
        use_sort_order = False
        for route_data in routes_data:
            if agency.provider == 'nextbus':
                try:
                    sort_order = nextbus_route_order.index(route_data['id'])
                    use_sort_order = True
                except ValueError as ex:
                    print(ex)
                    sort_order = None
            else:
                if route_data['sort_order'] is not None:
                    use_sort_order = True

        def get_sort_key(route_data):
            if use_sort_order:
                if route_data['sort_order'] is None:
                    if route_data['type'] == 1:
                        # place subways at the front if they don't have a sort_order
                        return 0
                    return 9999
                return route_data['sort_order']
            return route_data['title']
        return sorted(routes_data, key=get_sort_key)

    def save_routes(self, save_to_s3, d, included_stop_ids):
        agency = self.agency
        agency_id = agency.id
        routes_df = self.get_gtfs_routes()
        routes_df = self.get_active_routes(routes_df, d)
        if len(routes_df) == 0:
            self.errors.append((
                f'Zero active routes for {agency_id}, the routes config was not updated. '
                f'Ensure the GTFS is active for the given date {d}'
            ))
            return

        # Only return routes that we want to include
        routes_df = routes_df[
            routes_df[agency.route_id_gtfs_field].isin(included_stop_ids)
        ]

        routes_data = [
            self.get_route_data(route)
            for route in routes_df.itertuples()
        ]
        routes_data = self.sort_routes(routes_data)

        routes = [routeconfig.RouteConfig(agency_id, route_data) for route_data in routes_data]

        routeconfig.save_routes(agency_id, routes, save_to_s3=save_to_s3)
