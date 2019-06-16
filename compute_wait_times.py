from models import metrics, nextbus, util, arrival_history, wait_times, constants
import json
import argparse
from pathlib import Path
from datetime import datetime, date
import pytz
import boto3
import gzip
import pandas as pd
import numpy as np

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache wait times')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agency_id = 'sf-muni'

    all_wait_times = {}
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

    for interval_index, _ in enumerate(timestamp_intervals):
        all_wait_times[interval_index] = {}
        for stat_id in stat_groups.keys():
            all_wait_times[interval_index][stat_id] = {}

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
            for stat_id in stat_groups.keys():
                all_wait_times[interval_index][stat_id][route_id] = {}

        df = history.get_data_frame()
        df = df.sort_values('TIME', axis=0)

        for dir_info in route_config.get_direction_infos():

            dir_id = dir_info.id

            for interval_index, _ in enumerate(timestamp_intervals):
                for stat_id in stat_groups.keys():
                    all_wait_times[interval_index][stat_id][route_id][dir_id] = {}

            stop_ids = dir_info.get_stop_ids()
            sid_values = df['SID'].values

            for i, stop_id in enumerate(stop_ids):
                stop_df = df[sid_values == stop_id]

                all_time_values = stop_df['TIME'].values

                for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
                    wait_time_stats = wait_times.get_stats(all_time_values, start_time, end_time)

                    # waits = wait_time_stats.get_sampled_waits(60)
                    # quantiles = np.quantile(waits, [0.1, 0.5, 0.9]) if waits is not None else None

                    quantiles = wait_time_stats.get_quantiles([0.1,0.5,0.9])
                    if quantiles is not None:
                        stats = {
                            'p10': round(quantiles[0], 1),
                            'median': round(quantiles[1], 1),
                            'p90': round(quantiles[2], 1),
                        }

                        for stat_id, stat in stat_groups.items():
                            if isinstance(stat, list):
                                stat_value = [stats[sub_stat] for sub_stat in stat]
                            else:
                                stat_value = stats[stat]

                            all_wait_times[interval_index][stat_id][route_id][dir_id][stop_id] = stat_value

    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
        start_time_str, end_time_str = time_str_intervals[interval_index]

        for stat_id, stat in stat_groups.items():
            data_str = json.dumps({
                'version': wait_times.DefaultVersion,
                'start_time': start_time,
                'end_time': end_time,
                'stat': stat,
                'routes': all_wait_times[interval_index][stat_id]
            })

            cache_path = wait_times.get_cache_path(agency_id, d, stat_id, start_time_str, end_time_str)

            cache_dir = Path(cache_path).parent
            if not cache_dir.exists():
                cache_dir.mkdir(parents = True, exist_ok = True)

            with open(cache_path, "w") as f:
                f.write(data_str)

            if args.s3:
                s3 = boto3.resource('s3')
                s3_path = wait_times.get_s3_path(agency_id, d, stat_id, start_time_str, end_time_str)
                s3_bucket = wait_times.get_s3_bucket()
                print(f'saving to s3://{s3_bucket}/{s3_path}')
                object = s3.Object(s3_bucket, s3_path)
                object.put(
                    Body=gzip.compress(bytes(data_str, 'utf-8')),
                    CacheControl='max-age=86400',
                    ContentType='application/json',
                    ContentEncoding='gzip',
                    ACL='public-read'
                )
