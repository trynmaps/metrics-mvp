import argparse
import json
import sys
from datetime import datetime, timedelta
from models import nextbus, arrival_history, util, metrics, trip_times
import pytz
import numpy
import pandas as pd

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute trip lengths (in minutes) from stop s1 to stop s2 along a route, for one or more dates, optionally at particular times of day')
    parser.add_argument('--route', required=True, help='Route id')
    parser.add_argument('--s1', required=True, help='Initial stop id')
    parser.add_argument('--s2', required=True, help='Destination stop id')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    route_id = args.route
    date_str = args.date
    s1 = args.s1
    s2 = args.s2

    agency = 'sf-muni'

    start_time_str = args.start_time
    end_time_str = args.end_time

    route_config = nextbus.get_route_config(agency, route_id)

    s1_info = route_config.get_stop_info(s1)
    s1_dirs = route_config.get_directions_for_stop(s1)
    if len(s1_dirs) == 0 or s1_info is None:
        raise Exception(f"invalid stop id {s1}")

    s2_info = route_config.get_stop_info(s2)
    s2_dirs = route_config.get_directions_for_stop(s2)
    if len(s1_dirs) == 0 or s2_info is None:
        raise Exception(f"invalid stop id {s2}")

    if s1 == s2:
        raise Exception(f"stop {s1} and {s2} are the same")

    common_dirs = [dir for dir in s1_dirs if dir in s2_dirs]

    if len(common_dirs) == 0:
        raise Exception(f"stop {s1} and {s2} are in different directions")

    dir_info = route_config.get_direction_info(common_dirs[0])

    for s in dir_info.get_stop_ids():
        if s == s1:
            break
        if s == s2:
            raise Exception(f"stop {s1} comes after stop {s2} in the {dir_info.name} direction")

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
    print(f"From: {s1} ({s1_info.title})")
    print(f"To: {s2} ({s2_info.title})")
    print(f"Direction: {','.join(common_dirs)} ({dir_info.title})")

    completed_trips_arr = []

    for d in dates:
        history = arrival_history.get_by_date(agency, route_id, d)

        s1_df = trip_times.get_trip_times(history, tz, start_time_str, end_time_str, s1, s2)
        
        if s1_df.empty:
            print(f"no arrival times found for stop {s1} on {date_str}")
        else:
            for index, row in s1_df.iterrows():
                print(f"s1_t={row.DATE_STR} {row.TIME_STR} ({row.TIME}) s2_t={row.dest_arrival_time_str} ({row.dest_arrival_time}) vid:{row.VID} trip_minutes:{round(row.trip_min, 1)}")

            completed_trips_arr.append(s1_df.trip_min[s1_df.trip_min.notnull()])

    trips = pd.concat(completed_trips_arr)

    print(f'completed trips     = {len((trips))}')
    if len(trips) > 0:
        print(f'average trip time   = {round(numpy.average(trips),1)} min')
        print(f'standard deviation  = {round(numpy.std(trips),1)} min')
        print(f'shortest trip time  = {round(numpy.min(trips),1)} min')
        print(f'10% trip time       = {round(numpy.quantile(trips,0.1),1)} min')
        print(f'median trip time    = {round(numpy.median(trips),1)} min')
        print(f'90% trip time       = {round(numpy.quantile(trips,0.9),1)} min')
        print(f'longest trip time   = {round(numpy.max(trips),1)} min')