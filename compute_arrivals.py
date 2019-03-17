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
    parser.set_defaults(s3=False)

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

        # Request data from trynapi in smaller chunks to avoid internal server errors.
        # The more routes we have, the smaller our chunk size needs to be in order to
        # avoid getting internal server errors from trynapi.
        chunk_minutes = math.ceil(720 / len(route_ids))

        print(f"route = {route_ids}")
        print(f"time = [{start_dt}, {end_dt}) (chunk_minutes={chunk_minutes})")

        route_state_map = {}
        chunk_start_time = start_time
        while chunk_start_time < end_time:

            chunk_end_time = min(chunk_start_time + 60 * chunk_minutes, end_time)

            # trynapi returns all route states in the UTC minute containing the end timestamp, *inclusive*.
            # This would normally cause trynapi to return duplicate route states at the end of one chunk and
            # the beginning of the next chunk. Since chunk_end_time is always the first second in a UTC minute,
            # subtracting 1 from the corresponding millisecond will be the last millisecond in the previous minute,
            # so it should avoid fetching duplicate vehicle states at chunk boundaries
            chunk_state = trynapi.get_state(agency, chunk_start_time*1000, chunk_end_time*1000 - 1, route_ids)

            if 'message' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
                raise Exception(f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}")

            if not ('data' in chunk_state):
                print(chunk_state)
                raise Exception(f'trynapi returned no data')

            for chunk_route_state in chunk_state['data']['trynState']['routes']:
                route_id = chunk_route_state['rid']
                if route_id not in route_state_map:
                    route_state_map[route_id] = chunk_route_state
                else:
                    route_state_map[route_id]['routeStates'].extend(chunk_route_state['routeStates'])

            chunk_start_time = chunk_end_time

        for route_id, route_state in route_state_map.items():

            history = arrival_history.compute_from_state(agency, route_id, start_time, end_time, route_state)

            if history is not None:
                data_str = json.dumps(history.get_data())

                cache_path = arrival_history.get_cache_path(agency, route_id, d)
                with open(cache_path, "w") as f:
                    f.write(data_str)

                if args.s3:
                    s3 = boto3.resource('s3')
                    s3_path = arrival_history.get_s3_path(agency, route_id, d)
                    s3_bucket = arrival_history.get_s3_bucket()
                    print(f'saving to s3://{s3_bucket}/{s3_path}')
                    object = s3.Object(s3_bucket, s3_path)
                    object.put(
                        Body=gzip.compress(bytes(data_str, 'utf-8')),
                        ContentType='application/json',
                        ContentEncoding='gzip',
                        ACL='public-read'
                    )
