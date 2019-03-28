import argparse
import json
import sys
from datetime import datetime, timedelta
import pytz

import numpy as np
import pandas as pd

from models import nextbus, arrival_history, util, metrics, wait_times

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description = 'Compute wait times (in minutes) at a given stop in a given direction on a route, for one or more dates, optionally at particular times of day')
    parser.add_argument('--route', required = True, help = 'Route id')
    parser.add_argument('--stop', required = True, help = 'Stop id')
    parser.add_argument('--direction', required = True, help = 'Stop direction (I for inbound, O for outbound)')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')
    
    args = parser.parse_args()

    route_id = args.route
    date_str = args.date
    stop = args.stop
    direction = args.direction

    agency = 'sf-muni'

    start_time_str = "03:00" if args.start_time is None else args.start_time
    end_time_str = "23:59" if args.end_time is None else args.end_time

    route_config = nextbus.get_route_config(agency, route_id)
    
    stop_info = route_config.get_stop_info(stop)
    stop_dirs = route_config.get_directions_for_stop(stop)
    if len(stop_dirs) == 0 or stop_info is None:
        raise Exception(f"invalid stop id {stop}")
        
    stop_dir = [d for d in stop_dirs if direction in d]    
    if direction not in ["I", "O"] or len(stop_dir) == 0:
        raise Exception(f"invalid direction {direction}")
    
    dir_info = route_config.get_direction_info(stop_dir[0])

    date_strs = []
    tz = pytz.timezone('US/Pacific')

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Local Time Range: [{start_time_str}, {end_time_str})")
    print(f"Route: {route_id} ({route_config.title})")
    print(f"Stop: {stop} ({stop_info.title})")
    print(f"Direction: {stop_dir[0]} ({dir_info.title})")

    waits = []

    for d in dates:
        date = str(d)
        hist = arrival_history.get_by_date(agency, route_id, d)
        arrivals = hist.get_data_frame(stop_id = stop, direction_id = stop_dir[0], start_time_str = start_time_str, end_time_str = end_time_str, tz = tz)

        waits.append(wait_times.get_wait_times(arrivals, date, start_time_str))

    waits = pd.concat(waits)

    print(f'computed wait times = {len((waits))}')
    if len(waits) > 0:
        print(f'average wait time   = {round(np.average(waits),1)} min')
        print(f'standard deviation  = {round(np.std(waits),1)} min')
        print(f'shortest wait time  = {round(np.min(waits),1)} min')
        print(f'10% wait time       = {round(np.quantile(waits,0.1),1)} min')
        print(f'median wait time    = {round(np.median(waits),1)} min')
        print(f'90% wait time       = {round(np.quantile(waits,0.9),1)} min')
        print(f'longest wait time   = {round(np.max(waits),1)} min')
