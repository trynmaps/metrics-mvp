import argparse
import json
import sys
from datetime import datetime, timedelta, time
import pytz

import numpy as np
import pandas as pd

from models import nextbus, arrival_history, util, metrics, wait_times

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description = 'Compute wait times (in minutes) at a given stop in a given direction on a route, for one or more dates, optionally at particular times of day')
    parser.add_argument('--route', required = True, help = 'Route id')
    parser.add_argument('--stop', required = True, help = 'Stop id')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    route_id = args.route
    date_str = args.date
    stop = args.stop
    agency = 'sf-muni'

    start_time_str = args.start_time
    end_time_str = args.end_time

    route_config = nextbus.get_route_config(agency, route_id)

    stop_info = route_config.get_stop_info(stop)
    stop_dirs = route_config.get_directions_for_stop(stop)
    if len(stop_dirs) == 0 or stop_info is None:
        raise Exception(f"invalid stop id {stop}")

    date_strs = []
    tz = pytz.timezone('US/Pacific')

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    waits = []

    # print results for each direction
    for stop_dir in stop_dirs:
        dir_info = route_config.get_direction_info(stop_dir)

        for d in dates:
            hist = arrival_history.get_by_date(agency, route_id, d)
            arrivals = hist.get_data_frame(stop_id = stop, direction_id = stop_dir, start_time_str = start_time_str, end_time_str = end_time_str, tz = tz)

            # only get wait times if there are actually arrivals
            if len(arrivals) > 0:
                waits.append(wait_times.get_waits(arrivals, stop_info, d, tz, route_id, start_time_str, end_time_str))

        waits = pd.concat(waits)
        wait_lengths = metrics.compute_wait_times(waits).dropna()
        start = datetime.fromtimestamp(waits['DATE_TIME'].min(), tz = tz)
        end = datetime.fromtimestamp(waits['DATE_TIME'].max(), tz = tz)
        first_bus = datetime.fromtimestamp(waits['ARRIVAL'].min(), tz = tz)
        last_bus = datetime.fromtimestamp(waits['ARRIVAL'].max(), tz = tz)

        print(f"Date: {', '.join([str(date) for date in dates])}")
        print(f"Local Time Range: [{start.time().isoformat()}, {end.time().isoformat()}]")
        print(f"Route: {route_id} ({route_config.title})")
        print(f"Stop: {stop} ({stop_info.title})")
        print(f"Direction: {stop_dir} ({dir_info.title})")

        print(f'computed wait times = {len(wait_lengths)}')
        if len(wait_lengths) > 0:
            print(f'first bus departure = {first_bus.time().isoformat()}')
            print(f'last bus departure  = {last_bus.time().isoformat()}')
            print(f'average wait time   = {round(np.average(wait_lengths),1)} min')
            print(f'standard deviation  = {round(np.std(wait_lengths),1)} min')
            print(f'shortest wait time  = {round(np.min(wait_lengths),1)} min')
            print(f'10% wait time       = {round(np.quantile(wait_lengths,0.1),1)} min')
            print(f'median wait time    = {round(np.median(wait_lengths),1)} min')
            print(f'90% wait time       = {round(np.quantile(wait_lengths,0.9),1)} min')
            print(f'longest wait time   = {round(np.max(wait_lengths),1)} min')
