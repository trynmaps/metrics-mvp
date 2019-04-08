from models import arrival_history, util, trynapi, nextbus
import json
import math
import argparse
from datetime import datetime, timedelta
import pytz
import boto3
import gzip

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache arrival history')
    parser.add_argument('--route', nargs='*')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--cache-state', dest='cache_state', action='store_true', help='cache state on filesystem (make it faster when running multiple times)')
    parser.set_defaults(s3=False, cache_state=False)

    args = parser.parse_args()
    route_ids = args.route
    agency = 'sf-muni'

    if route_ids is None:
        route_ids = [route.id for route in nextbus.get_route_list(agency)]

    date_str = args.date

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    tz = pytz.timezone('America/Los_Angeles')

    incr = timedelta(days=1)

    for d in dates:
        start_dt = tz.localize(datetime(d.year,d.month, d.day, hour=3)) # start each "day" at 3 AM local time so midnight-3am buses are associated with previous day
        end_dt = start_dt + incr

        start_time = int(start_dt.timestamp())
        end_time = int(end_dt.timestamp())

        print(f"time = [{start_dt}, {end_dt})")

        route_state_map = trynapi.get_state(agency, start_time, end_time, route_ids, args.cache_state)

        for route_id in route_ids:
            if route_id not in route_state_map:
                print(f'no state for route {route_id}')
                continue

            route_state = route_state_map[route_id]

            history = arrival_history.compute_from_state(agency, route_id, start_time, end_time, route_state)
            arrival_history.save_for_date(history, d, args.s3)