import argparse
import json
import sys
from datetime import datetime, timedelta
from models import config, arrival_history, util, metrics
import pytz
import time
import numpy as np
import pandas as pd

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Compute headways (in minutes) at stop s1 for one or more routes, on one or more dates, optionally at particular times of day'
    )
    parser.add_argument('--agency', required=True, help='Agency id')
    parser.add_argument('--route', nargs='+', required=True, help='Route id(s)')
    parser.add_argument('--stop', required=True, help='Stop id')

    parser.add_argument('--version')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    agency = config.get_agency(args.agency)

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

    route_ids = args.route
    date_str = args.date
    stop_id = args.stop

    start_time_str = args.start_time
    end_time_str = args.end_time

    dir_infos = []
    route_configs = []

    for route_id in route_ids:
        route_config = agency.get_route_config(route_id)

        stop_info = route_config.get_stop_info(stop_id)
        if stop_info is None:
            raise Exception(f"Stop ID {stop_id} is not valid for route {route_id}")
        route_dirs = route_config.get_directions_for_stop(stop_id)
        if len(route_dirs) == 0:
            raise Exception(f"Stop ID does not have any directions for route {route_id}")

        route_configs.append(route_config)
        dir_infos.extend([route_config.get_direction_info(dir) for dir in route_dirs])

    date_strs = []
    tz = agency.tz

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Time of Day: [{start_time_str}, {end_time_str})")
    print(f"Route: {', '.join(route_ids)} ({', '.join([route_config.title for route_config in route_configs])})")
    print(f"Stop: {stop_id} ({stop_info.title})")
    print(f"Direction: {', '.join([dir_info.id for dir_info in dir_infos])} " +
        f"({', '.join([dir_info.title for dir_info in dir_infos])})")

    headways_arr = []

    get_history_ms = 0
    get_data_frame_ms = 0
    compute_headway_ms = 0
    remove_null_ms = 0

    for d in dates:
        date_str = str(d)

        route_dfs = []
        for route_id in route_ids:
            t1 = time.time()*1000

            history = arrival_history.get_by_date(agency.id, route_id, d, version)

            t2 = time.time()*1000

            route_df = history.get_data_frame(stop_id,
                start_time=util.get_timestamp_or_none(d, start_time_str, tz),
                end_time=util.get_timestamp_or_none(d, end_time_str, tz)
            )

            t3 = time.time()*1000

            if not route_df.empty:
                route_df['ROUTE'] = route_id
                route_dfs.append(route_df)

            get_history_ms += t2 - t1
            get_data_frame_ms += t3 - t2

        df = pd.concat(route_dfs)

        if df.empty:
            print(f"no arrival times found for stop {stop_id} on {date_str}")
            continue

        df = df.sort_values('TIME', axis=0)

        t4 = time.time()*1000

        df['headway_min'] = np.r_[np.nan, metrics.compute_headway_minutes(df['TIME'].values)]
        df['DATE_TIME'] = df.TIME.apply(lambda t: datetime.fromtimestamp(t, tz))

        t5 = time.time()*1000

        for row in df.itertuples():
            did = row.DID
            dir_info = [dir_info for dir_info in dir_infos if dir_info.id == did][0]
            dist_str = f'{row.DIST}'.rjust(3)
            dwell_time = util.render_dwell_time(row.DEPARTURE_TIME - row.TIME)
            headway_str = f'{round(row.headway_min, 1)}'.rjust(4)
            print(f"{row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.TIME}) {dwell_time} vid:{row.VID}  {dist_str}m  {headway_str} min   ({row.ROUTE} - {dir_info.title})")

        t6 = time.time()*1000

        day_headways = df.headway_min[df.headway_min.notnull()]

        t7 = time.time()*1000

        compute_headway_ms += t5 - t4
        remove_null_ms += t7 - t6

        headways_arr.append(day_headways)

    t8 = time.time()*1000

    headways = pd.concat(headways_arr)

    t9 = time.time()*1000

    print(f"** runtime **")
    print(f"get arrival history = {round(get_history_ms)} ms")
    print(f"get data frame      = {round(get_data_frame_ms)} ms")
    print(f"compute headway     = {round(compute_headway_ms)} ms")
    print(f"remove null         = {round(remove_null_ms)} ms")
    print(f'** headway stats **')
    print(f'count              = {len((headways))}')
    if len(headways) > 0:
        print(f'average headway    = {round(np.average(headways),1)} min')
        print(f'standard deviation = {round(np.std(headways),1)} min')
        print(f'shortest headway   = {round(np.min(headways),1)} min')
        print(f'10% headway        = {round(np.quantile(headways,0.1),1)} min')
        print(f'median headway     = {round(np.median(headways),1)} min')
        print(f'90% headway        = {round(np.quantile(headways,0.9),1)} min')
        print(f'longest headway    = {round(np.max(headways),1)} min')