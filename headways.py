import argparse
import json
import sys
from datetime import datetime, timedelta
from models import nextbus, arrival_history, util, metrics
import pytz
import time
import numpy
import pandas as pd

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute headways (in minutes) at stop s1 for a particular a route, for one or more dates, optionally at particular times of day')
    parser.add_argument('--route', required=True, help='Route id')
    parser.add_argument('--stop', required=True, help='Stop id')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    route_id = args.route
    date_str = args.date
    stop_id = args.stop

    agency = 'sf-muni'

    start_time_str = args.start_time
    end_time_str = args.end_time

    route_config = nextbus.get_route_config('sf-muni', route_id)

    stop_info = route_config.get_stop_info(stop_id)
    dir = route_config.get_direction_for_stop(stop_id)
    if dir is None or stop_info is None:
        raise Exception(f"invalid stop id {stop_id}")

    dir_info = route_config.get_direction_info(dir)

    date_strs = []
    tz = pytz.timezone('US/Pacific')

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Time of Day: [{start_time_str}, {end_time_str})")
    print(f"Route: {route_id} ({route_config.title})")
    print(f"Stop: {stop_id} ({stop_info.title})")
    print(f"Direction: {dir} ({dir_info.title})")

    headways_arr = []

    get_history_ms = 0
    get_data_frame_ms = 0
    compute_headway_ms = 0
    remove_null_ms = 0

    for d in dates:
        date_str = str(d)

        t1 = time.time()*1000

        history = arrival_history.get_by_date(agency, route_id, d)

        t2 = time.time()*1000

        df = history.get_data_frame(stop_id, tz=tz, start_time_str=start_time_str, end_time_str=end_time_str)

        t3 = time.time()*1000

        if df.empty:
            print(f"no arrival times found for stop {stop_id} on {date_str}")
            continue

        df['headway_min'] = metrics.compute_headway_minutes(df)

        t4 = time.time()*1000

        for index, row in df.iterrows():
            print(f"t={row.DATE_STR} {row.TIME_STR} ({row.TIME}) vid:{row.VID} headway:{round(row.headway_min,1)}")

        t5 = time.time()*1000

        day_headways = df.headway_min[df.headway_min.notnull()]

        t6 = time.time()*1000

        get_history_ms += t2 - t1
        get_data_frame_ms += t3 - t2
        compute_headway_ms += t4 - t3
        remove_null_ms += t6 - t5

        headways_arr.append(day_headways)

    t8 = time.time()*1000

    headways = pd.concat(headways_arr)

    t9 = time.time()*1000

    print(f"** runtime **")
    print(f"get arrival history = {round(get_history_ms)} ms")
    print(f"get data frame      = {round(get_data_frame_ms)} ms")
    print(f"compute headway     = {round(compute_headway_ms)} ms")
    print(f"remove null         = {round(remove_null_ms)} ms")
    print(f"concat data frames  = {round(t9-t8)} ms")
    print(f'** headway stats **')
    print(f'count              = {len((headways))}')
    if len(headways) > 0:
        print(f'average headway    = {round(numpy.average(headways),1)} min')
        print(f'standard deviation = {round(numpy.std(headways),1)} min')
        print(f'shortest headway   = {round(numpy.min(headways),1)} min')
        print(f'10% headway        = {round(numpy.quantile(headways,0.1),1)} min')
        print(f'median headway     = {round(numpy.median(headways),1)} min')
        print(f'90% headway        = {round(numpy.quantile(headways,0.9),1)} min')
        print(f'longest headway    = {round(numpy.max(headways),1)} min')