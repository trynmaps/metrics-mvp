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

#
# Computes and caches statistics about wait times for all stops
# on all routes, for various time ranges in a particular day.
#

# Map of stat_id (string in file name) to the raw statistics that
# are stored for each stop pair.
#  p10 = 10th percentile
#  median = 50th percentile
#  p90 = 90th percentile
#  p<Nm = probability of a wait time less than N minutes

stat_groups = {
    'p10-median-p90': ['p10','median','p90'],
    'plt5m-30m': ['p<5m','p<10m','p<15m','p<20m','p<25m','p<30m'],
    'median': 'median',
}

def get_stat_value(stat_id, all_stat_values):
    # For a given stat_id (key in stat_groups dict), returns either
    # a single value or an array of values from all_stat_values
    # according to the definition of that stat_id.

    stat = stat_groups[stat_id]
    if isinstance(stat, list):
        return [all_stat_values[sub_stat] for sub_stat in stat]
    else:
        return all_stat_values[stat]


def add_wait_time_stats_for_stop(
    interval_wait_time_stats,
    stat_ids,
    route_id,
    dir_id,
    stop_id,
    wait_time_stats):

    quantiles = wait_time_stats.get_quantiles([0.1,0.5,0.9])
    if quantiles is None:
        return

    all_stat_values = {
        'p10': round(quantiles[0], 1),
        'median': round(quantiles[1], 1),
        'p90': round(quantiles[2], 1),
    }

    for wait_time in range(5, 31, 5):
        all_stat_values[f'p<{wait_time}m'] = round(wait_time_stats.get_probability_less_than(wait_time), 2)

    for stat_id in stat_ids:
        stat_value = get_stat_value(stat_id, all_stat_values)
        interval_wait_time_stats[stat_id][route_id][dir_id][stop_id] = stat_value

def add_median_wait_time_stats_for_direction(
    dir_wait_time_stats,
    stat_id
):
    dir_stat_values = np.array([stat_value for _, stat_value in dir_wait_time_stats.items()])

    if len(dir_stat_values) > 0:
        if isinstance(stat_groups[stat_id], list):
            median = np.median(dir_stat_values, axis=0).tolist()
        else:
            median = np.median(dir_stat_values)

        dir_wait_time_stats["median"] = median

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache wait times')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--stat', nargs='*')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agency_id = 'sf-muni'

    all_wait_time_stats = {}
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

    stat_ids = args.stat
    if stat_ids is None:
        stat_ids = stat_groups.keys()

    for interval_index, _ in enumerate(timestamp_intervals):
        all_wait_time_stats[interval_index] = {}
        for stat_id in stat_ids:
            all_wait_time_stats[interval_index][stat_id] = {}

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
                all_wait_time_stats[interval_index][stat_id][route_id] = {}

        df = history.get_data_frame()
        df = df.sort_values('TIME', axis=0)

        for dir_info in route_config.get_direction_infos():

            dir_id = dir_info.id

            for interval_index, _ in enumerate(timestamp_intervals):
                for stat_id in stat_ids:
                    all_wait_time_stats[interval_index][stat_id][route_id][dir_id] = {}

            stop_ids = dir_info.get_stop_ids()
            sid_values = df['SID'].values

            for i, stop_id in enumerate(stop_ids):
                stop_df = df[sid_values == stop_id]

                all_time_values = stop_df['TIME'].values

                for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
                    wait_time_stats = wait_times.get_stats(all_time_values, start_time, end_time)

                    add_wait_time_stats_for_stop(
                        all_wait_time_stats[interval_index],
                        stat_ids,
                        route_id,
                        dir_id,
                        stop_id,
                        wait_time_stats)

            for interval_index, _ in enumerate(timestamp_intervals):
                for stat_id in stat_ids:
                    add_median_wait_time_stats_for_direction(
                        all_wait_time_stats[interval_index][stat_id][route_id][dir_id],
                        stat_id
                    )

    for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
        start_time_str, end_time_str = time_str_intervals[interval_index]

        for stat_id in stat_ids:
            stat = stat_groups[stat_id]

            data_str = json.dumps({
                'version': wait_times.DefaultVersion,
                'start_time': start_time,
                'end_time': end_time,
                'stat': stat,
                'routes': all_wait_time_stats[interval_index][stat_id]
            }, separators=(',', ':'))

            cache_path = wait_times.get_cache_path(agency_id, d, stat_id, start_time_str, end_time_str)

            cache_dir = Path(cache_path).parent
            if not cache_dir.exists():
                cache_dir.mkdir(parents = True, exist_ok = True)

            print(f'saving to {cache_path}')
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
