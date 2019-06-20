from models import metrics, nextbus, util, arrival_history, trip_times, constants
import json
import argparse
from pathlib import Path
from datetime import datetime, date
import pytz
import boto3
import gzip
import pandas as pd
import numpy as np
import time

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache trip times')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--stat', nargs='*')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agency_id = 'sf-muni'

    tz = pytz.timezone('US/Pacific')

    routes = nextbus.get_route_list(agency_id)

    date_str = args.date
    d = util.parse_date(date_str)

    time_str_intervals = constants.DEFAULT_TIME_STR_INTERVALS
    time_str_intervals.append(('07:00','19:00'))

    timestamp_intervals = [(
            int(util.get_localized_datetime(d, start_time_str, tz).timestamp()),
            int(util.get_localized_datetime(d, end_time_str, tz).timestamp())
        ) for start_time_str, end_time_str in time_str_intervals
    ]

    timestamp_intervals.append((None, None))
    time_str_intervals.append((None, None))

    stat_groups = {
        'p10-median-p90': ['p10','median','p90'],
        'median': 'median',
    }

    stat_ids = args.stat
    if stat_ids is None:
        stat_ids = stat_groups.keys()

    all_trip_times = {}
    for interval_index, _ in enumerate(timestamp_intervals):
        all_trip_times[interval_index] = {}
        for stat_id in stat_ids:
            all_trip_times[interval_index][stat_id] = {}

    for route in routes:
        route_id = route.id

        print(route_id)
        route_config = nextbus.get_route_config(agency_id, route_id)

        try:
            history = arrival_history.get_by_date(agency_id, route_id, d)
        except FileNotFoundError as ex:
            print(ex)
            continue

        for interval_index, _ in enumerate(timestamp_intervals):
            for stat_id in stat_ids:
                all_trip_times[interval_index][stat_id][route_id] = {}

        t1 = time.time()

        route_df = history.get_data_frame().sort_values('TRIP', axis=0)

        for dir_info in route_config.get_direction_infos():

            dir_id = dir_info.id

            for interval_index, _ in enumerate(timestamp_intervals):
                for stat_id in stat_ids:
                    all_trip_times[interval_index][stat_id][route_id][dir_id] = {}

            stop_ids = dir_info.get_stop_ids()
            num_stops = len(stop_ids)

            trip_values_by_stop = {}
            departure_time_values_by_stop = {}
            arrival_time_values_by_stop = {}

            def filter_by_stop(stop_id):
                return route_df[route_df['SID'] == stop_id]

            for stop_id in stop_ids:
                stop_df = filter_by_stop(stop_id)

                trip_values = stop_df['TRIP'].values

                trip_values_by_stop[stop_id] = trip_values
                departure_time_values_by_stop[stop_id] = stop_df['DEPARTURE_TIME'].values
                arrival_time_values_by_stop[stop_id] = stop_df['TIME'].values

            for i in range(0, num_stops-1):

                s1 = stop_ids[i]

                s1_trip_values = trip_values_by_stop[s1]

                if len(s1_trip_values) == 0:
                    continue

                s1_departure_time_values = departure_time_values_by_stop[s1]

                s1_trip_values_by_interval = []
                s1_departure_time_values_by_interval = []

                def filter_departures_by_interval():
                    for (start_time, end_time) in timestamp_intervals:
                        if start_time is None or end_time is None:
                            s1_departure_time_values_by_interval.append(s1_departure_time_values)
                            s1_trip_values_by_interval.append(s1_trip_values)
                        else:
                            interval_condition = np.logical_and(
                                s1_departure_time_values >= start_time,
                                s1_departure_time_values < end_time
                            )
                            s1_departure_time_values_by_interval.append(s1_departure_time_values[interval_condition])
                            s1_trip_values_by_interval.append(s1_trip_values[interval_condition])

                filter_departures_by_interval()

                for interval_index, _ in enumerate(timestamp_intervals):
                    for stat_id in stat_ids:
                        all_trip_times[interval_index][stat_id][route_id][dir_id][s1] = {}

                for j in range(i + 1, num_stops):
                    s2 = stop_ids[j]

                    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):

                        trip_min = trip_times.get_completed_trip_times(
                            s1_trip_values_by_interval[interval_index],
                            s1_departure_time_values_by_interval[interval_index],
                            trip_values_by_stop[s2],
                            arrival_time_values_by_stop[s2],
                            assume_sorted=True
                        )

                        if len(trip_min) > 0:
                            sorted_trip_min = np.sort(trip_min)
                            stats = {
                                'p10': round(util.quantile_sorted(sorted_trip_min, 0.1), 1),
                                'median': round(util.quantile_sorted(sorted_trip_min, 0.5), 1),
                                'p90': round(util.quantile_sorted(sorted_trip_min, 0.9), 1),
                                #'avg': round(np.average(trip_min), 1)
                            }

                            for stat_id in stat_ids:
                                stat = stat_groups[stat_id]
                                if isinstance(stat, list):
                                    stat_value = [stats[sub_stat] for sub_stat in stat]
                                else:
                                    stat_value = stats[stat]

                                all_trip_times[interval_index][stat_id][route_id][dir_id][s1][s2] = stat_value

        t2 = time.time()
        print(f' {round(t2-t1, 2)} sec')

    data_str = json.dumps(all_trip_times)

    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
        start_time_str, end_time_str = time_str_intervals[interval_index]

        for stat_id in stat_ids:
            stat = stat_groups[stat_id]
            data_str = json.dumps({
                'version': trip_times.DefaultVersion,
                'start_time': start_time,
                'end_time': end_time,
                'stat': stat,
                'routes': all_trip_times[interval_index][stat_id]
            }, separators=(',', ':'))

            cache_path = trip_times.get_cache_path(agency_id, d, stat_id, start_time_str, end_time_str)

            print(cache_path)

            cache_dir = Path(cache_path).parent
            if not cache_dir.exists():
                cache_dir.mkdir(parents = True, exist_ok = True)

            print(f'saving to {cache_path}')
            with open(cache_path, "w") as f:
                f.write(data_str)

            if args.s3:
                s3 = boto3.resource('s3')
                s3_path = trip_times.get_s3_path(agency_id, d, stat_id, start_time_str, end_time_str)
                s3_bucket = trip_times.get_s3_bucket()
                print(f'saving to s3://{s3_bucket}/{s3_path}')
                object = s3.Object(s3_bucket, s3_path)
                object.put(
                    Body=gzip.compress(bytes(data_str, 'utf-8')),
                    CacheControl='max-age=86400',
                    ContentType='application/json',
                    ContentEncoding='gzip',
                    ACL='public-read'
                )