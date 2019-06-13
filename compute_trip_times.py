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

    stat_ids = ['avg','median','p10','p90','count']

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

            stop_dfs = {}
            trip_values_by_stop = {}
            extended_trip_values_by_stop = {}

            departure_time_values_by_stop = {}
            extended_arrival_time_values_by_stop = {}

            arrival_times_by_stop_by_vid = {}

            def filter_by_stop(stop_id):
                #return history.get_data_frame(stop_id=stop_id).sort_values('TRIP', axis=0
                return route_df[route_df['SID'] == stop_id]

            for stop_id in stop_ids:
                stop_df = filter_by_stop(stop_id)

                trip_values = stop_df['TRIP'].values

                trip_values_by_stop[stop_id] = trip_values
                extended_trip_values_by_stop[stop_id] = np.r_[trip_values, -1]
                departure_time_values_by_stop[stop_id] = stop_df['DEPARTURE_TIME'].values
                extended_arrival_time_values_by_stop[stop_id] = np.r_[stop_df['TIME'].values, -1]

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
                            interval_indexes = np.nonzero(interval_condition)[0]

                            s1_departure_time_values_by_interval.append(s1_departure_time_values[interval_indexes])
                            s1_trip_values_by_interval.append(s1_trip_values[interval_indexes])

                filter_departures_by_interval()

                for interval_index, _ in enumerate(timestamp_intervals):
                    for stat_id in stat_ids:
                        all_trip_times[interval_index][stat_id][route_id][dir_id][s1] = {}

                for j in range(i + 1, num_stops):
                    s2 = stop_ids[j]

                    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):

                        trip_min, _ = trip_times.get_matching_trips_and_arrival_times_presorted(
                            s1_trip_values_by_interval[interval_index],
                            s1_departure_time_values_by_interval[interval_index],
                            extended_trip_values_by_stop[s2],
                            extended_arrival_time_values_by_stop[s2],
                        )

                        try:
                            trip_min = trip_min[np.isfinite(trip_min)]
                        except TypeError as ex: # happens when all trips are np.nan
                            continue

                        if len(trip_min) > 0:

                            def get_average():
                                return round(np.average(trip_min), 1)

                            all_trip_times[interval_index]['avg'][route_id][dir_id][s1][s2] = get_average()

                            quantiles = np.quantile(trip_min, [0.1, 0.5, 0.9])

                            all_trip_times[interval_index]['p10'][route_id][dir_id][s1][s2] = round(quantiles[0], 1)
                            all_trip_times[interval_index]['median'][route_id][dir_id][s1][s2] = round(quantiles[1], 1)
                            all_trip_times[interval_index]['p90'][route_id][dir_id][s1][s2] = round(quantiles[2], 1)

                            all_trip_times[interval_index]['count'][route_id][dir_id][s1][s2] = len(trip_min)

                            #print(s1_trip_times[s2])

        t2 = time.time()
        print(f' {round(t2-t1, 2)} sec')

    data_str = json.dumps(all_trip_times)

    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
        start_time_str, end_time_str = time_str_intervals[interval_index]

        for stat_id in stat_ids:
            data_str = json.dumps({
                'start_time': start_time,
                'end_time': end_time,
                'stat_id': stat_id,
                'routes': all_trip_times[interval_index][stat_id]
            })

            cache_path = trip_times.get_cache_path(agency_id, d, stat_id, start_time_str, end_time_str)

            print(cache_path)

            cache_dir = Path(cache_path).parent
            if not cache_dir.exists():
                cache_dir.mkdir(parents = True, exist_ok = True)

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