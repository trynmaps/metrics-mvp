import argparse
import json
import sys
from datetime import datetime, timedelta
from models import config, arrival_history, util, metrics, trip_times
import pytz
import numpy as np
import pandas as pd

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute trip lengths (in minutes) from stop s1 to stop s2 along a route, for one or more dates, optionally at particular times of day')
    parser.add_argument('--agency', required=True, help='Agency id')
    parser.add_argument('--route', required=True, help='Route id')
    parser.add_argument('--s1', required=True, help='Initial stop id')
    parser.add_argument('--s2', required=True, help='Destination stop id')

    parser.add_argument('--version')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

    route_id = args.route
    date_str = args.date
    s1 = args.s1
    s2 = args.s2

    agency = config.get_agency(args.agency)

    start_time_str = args.start_time
    end_time_str = args.end_time

    route_config = agency.get_route_config(route_id)

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

    is_loop = dir_info.is_loop()

    if not is_loop:
        for s in dir_info.get_stop_ids():
            if s == s1:
                break
            if s == s2:
                raise Exception(f"stop {s1} comes after stop {s2} in the {dir_info.name} direction")

    date_strs = []
    tz = agency.tz

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
        history = arrival_history.get_by_date(agency.id, route_id, d, version)

        start_time = util.get_timestamp_or_none(d, start_time_str, tz)
        end_time = util.get_timestamp_or_none(d, end_time_str, tz)

        s1_df = history.get_data_frame(stop_id=s1, start_time = start_time, end_time = end_time)
        s2_df = history.get_data_frame(stop_id=s2, start_time = start_time)

        s1_df['trip_min'], s1_df['dest_arrival_time'] = trip_times.get_matching_trips_and_arrival_times(
            s1_df['TRIP'].values,
            s1_df['DEPARTURE_TIME'].values,
            s2_df['TRIP'].values,
            s2_df['TIME'].values,
            is_loop
        )

        s1_df['DATE_TIME'] = s1_df['DEPARTURE_TIME'].apply(lambda t: datetime.fromtimestamp(t, tz))

        if s1_df.empty:
            print(f"no arrival times found for stop {s1} on {d}")
        else:
            for index, row in s1_df.iterrows():
                dest_arrival_time = row.dest_arrival_time
                dest_arrival_time_str = datetime.fromtimestamp(dest_arrival_time, tz).time() if dest_arrival_time is not None and not np.isnan(dest_arrival_time) else None

                trip_str = f'#{row.TRIP}'.rjust(5)

                print(f"s1_t={row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.DEPARTURE_TIME}) s2_t={dest_arrival_time_str} ({dest_arrival_time}) vid:{row.VID}  {trip_str}   {round(row.trip_min, 1)} min trip")

            completed_trips_arr.append(s1_df.trip_min[s1_df.trip_min.notnull()])

    trips = pd.concat(completed_trips_arr)

    print(f'completed trips     = {len((trips))}')
    if len(trips) > 0:
        print(f'average trip time   = {round(np.average(trips),1)} min')
        print(f'standard deviation  = {round(np.std(trips),1)} min')
        print(f'shortest trip time  = {round(np.min(trips),1)} min')
        print(f'10% trip time       = {round(np.quantile(trips,0.1),1)} min')
        print(f'median trip time    = {round(np.median(trips),1)} min')
        print(f'90% trip time       = {round(np.quantile(trips,0.9),1)} min')
        print(f'longest trip time   = {round(np.max(trips),1)} min')
