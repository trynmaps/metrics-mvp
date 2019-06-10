import argparse
import json
import sys
from datetime import datetime, timedelta
from models import nextbus, arrival_history, util, metrics
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compare two versions of arrival history')
    parser.add_argument('--route', nargs='*', help='Route id(s)')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--stop', help='Stop ID')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--diff-min', help='Print arrivals where difference is larger than this (minutes)', type=float, default=5)
    parser.add_argument('base_version')
    parser.add_argument('other_version')

    args = parser.parse_args()

    diff_min = args.diff_min

    base_version = args.base_version
    other_version = args.other_version

    stop_id = args.stop

    agency = 'sf-muni'

    route_ids = args.route
    if route_ids is None:
        route_ids = [route.id for route in nextbus.get_route_list(agency)]

    date_str = args.date

    tz = pytz.timezone('US/Pacific')

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Route: {route_ids}")

    base_df_arr = []

    max_difference = 900 # seconds

    route_configs = {}
    for route_id in route_ids:
        route_configs[route_id] = nextbus.get_route_config(agency, route_id)

    if stop_id:
        stop_info = route_configs[route_id].get_stop_info(stop_id) if route_id else None
        print(f"Stop: {stop_info.title if stop_info else '?'} ({stop_id})")

    for d in dates:
        for route_id in route_ids:
            base_history = arrival_history.get_by_date(agency, route_id, d, base_version)
            other_history = arrival_history.get_by_date(agency, route_id, d, other_version)

            base_df = base_history.get_data_frame(stop_id=stop_id).sort_values('TIME', axis=0)
            other_df = base_history.get_data_frame(stop_id=stop_id).sort_values('TIME', axis=0)

            def find_other_arrival_time(row):
                other_time = other_history.find_closest_arrival_time(row.SID, row.VID, row.TIME)
                if other_time is not None and abs(row.TIME - other_time) > max_difference:
                    return None
                return other_time

            base_df['ROUTE'] = route_id
            base_df['other_time'] = base_df.apply(find_other_arrival_time, axis=1)
            base_df['time_diff_min'] = (base_df.TIME - base_df.other_time)/60
            base_df['abs_time_diff_min'] = np.abs(base_df.time_diff_min)

            base_df_arr.append(base_df)

    df = pd.concat(base_df_arr)

    df['DATE_TIME'] = df['TIME'].apply(lambda t: datetime.fromtimestamp(t, tz))

    bad_df = df[(df.abs_time_diff_min.isnull()) | (df.abs_time_diff_min >= diff_min)]
    for row in bad_df.itertuples():
        other_time = int(row.other_time) if not np.isnan(row.other_time) else None
        other_time_str = datetime.fromtimestamp(other_time, tz).time() if other_time else None

        route_config = route_configs[row.ROUTE]
        stop_info = route_config.get_stop_info(row.SID)

        print(f"{base_version}={row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.TIME}) {other_version}={other_time_str} ({other_time})  diff: {round(row.time_diff_min,1)} min  v:{row.VID} s:{stop_info.title if stop_info else '?'} ({row.SID}) ({row.DID})")

    abs_time_diff_min = df.abs_time_diff_min[df.abs_time_diff_min.notnull()]

    num_no_match = len(df.abs_time_diff_min) - len(abs_time_diff_min)

    total_stops = len(df)
    match_percent = len(abs_time_diff_min) / total_stops * 100

    print(f'total stops in {base_version} = {total_stops}')

    for diff in [0.25, 0.5, 1, 2, 5, 10, 15]:
        close_matches = len(abs_time_diff_min[abs_time_diff_min < diff])
        close_match_percent = close_matches / total_stops * 100
        print(f'stops matched within {diff} min = {close_matches} ({round(close_match_percent, 1)}%)')

    no_match_percent = num_no_match / total_stops * 100
    print(f'stops not matched = {num_no_match} ({round(no_match_percent, 1)}%)')