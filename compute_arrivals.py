from models import arrival_history, util
import json
import argparse
from datetime import datetime, timedelta
import pytz
import boto3
import gzip

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache arrival history')
    parser.add_argument('--route', required=True)
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()
    route_id = args.route
    date_str  = args.date

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    tz = pytz.timezone('America/Los_Angeles')

    agency = 'sf-muni'

    incr = timedelta(days=1)

    for d in dates:
        start_dt = tz.localize(datetime(d.year,d.month, d.day, hour=3)) # start each "day" at 3 AM local time so midnight-3am buses are associated with previous day
        end_dt = start_dt + incr

        start_time = int(start_dt.timestamp())
        end_time = int(end_dt.timestamp())

        print(f"route = {route_id}")
        print(f"time = [{start_dt}, {end_dt})")

        history = arrival_history.compute_from_state(agency, route_id, start_time, end_time)

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
