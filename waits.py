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

        averages = []
        minimums = []
        medians = []
        p10s = []
        p90s = []
        maximums = []

        first_bus_date_times = []
        last_bus_date_times = []

        for d in dates:
            hist = arrival_history.get_by_date(agency, route_id, d)
            arrivals = hist.get_data_frame(stop_id = stop, direction_id = stop_dir)

            start_time = util.get_timestamp_or_none(d, start_time_str, tz)
            end_time = util.get_timestamp_or_none(d, end_time_str, tz)

            departure_times = np.sort(arrivals['DEPARTURE_TIME'].values)
            if len(departure_times) == 0:
                continue

            first_bus_date_times.append(datetime.fromtimestamp(departure_times[0], tz))
            last_bus_date_times.append(datetime.fromtimestamp(departure_times[-1], tz))

            stats = wait_times.get_stats(departure_times, start_time, end_time)
            average = stats.get_average()
            if average is not None:
                averages.append(average)

            quantiles = stats.get_quantiles([0,0.1,0.5,0.9,1])
            if quantiles is not None:
                minimums.append(quantiles[0])
                p10s.append(quantiles[1])
                medians.append(quantiles[2])
                p90s.append(quantiles[3])
                maximums.append(quantiles[4])

        print(f"Date: {', '.join([str(date) for date in dates])}")
        print(f"Local Time Range: [{start_time_str}, {end_time_str}]")
        print(f"Route: {route_id} ({route_config.title})")
        print(f"Stop: {stop} ({stop_info.title})")
        print(f"Direction: {stop_dir} ({dir_info.title})")

        if len(averages) > 0:
            print(f'first bus departure = {" ".join([str(dt) for dt in first_bus_date_times])}')
            print(f'last bus departure  = {" ".join([str(dt) for dt in last_bus_date_times])}')

            # approximate average over multiple days by taking average of averages
            print(f'average wait time   = {round(np.average(averages),1)} min')

            print(f'shortest wait time  = {round(np.min(minimums),1)} min')

            # approximate percentiles over multiple days by taking median of each percentile
            print(f'10% wait time       = {round(np.median(p10s),1)} min')
            print(f'median wait time    = {round(np.median(medians),1)} min')
            print(f'90% wait time       = {round(np.median(p90s),1)} min')

            print(f'longest wait time   = {round(np.max(maximums),1)} min')
