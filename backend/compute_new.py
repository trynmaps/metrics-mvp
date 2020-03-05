import argparse
import json
import requests
from datetime import datetime, timedelta
import boto3

from models import config, util

from compute_arrivals import compute_arrivals
from compute_stats import compute_stats

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description = '')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--agency', required=False, help='Agency ID')

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    s3_bucket = config.s3_bucket

    version = 'v1'

    for agency in agencies:
        agency_id = agency.id
        s3_path = f"state/{version}/state_{version}_{agency_id}.json"

        def save_state(state):
            state_str = json.dumps(state)
            s3 = boto3.resource('s3')
            print(f'saving state to s3://{s3_bucket}/{s3_path}')
            object = s3.Object(s3_bucket, s3_path)
            object.put(
                Body=bytes(state_str, 'utf-8'),
                ContentType='application/json',
                ACL='public-read'
            )

        s3_url = f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}"
        r = requests.get(s3_url)

        if r.status_code == 404 or r.status_code == 403:
            state = {}
        elif r.status_code != 200:
            raise Exception(f"Error fetching {s3_url}: HTTP {r.status_code}: {r.text}")
        else:
            state = json.loads(r.text)

        if args.start_date is not None:
            d = util.parse_date(args.start_date)
        elif 'last_complete_date' in state:
            d = util.parse_date(state['last_complete_date']) + timedelta(days=1)
        else:
            raise Exception(f"No compute state for agency {agency_id}, use --start-date parameter the first time")

        routes = agency.get_route_list()
        route_ids = [route.id for route in routes]

        tz = agency.tz

        now = datetime.now(tz)
        today = now.date()

        if now.time().hour < agency.default_day_start_hour:
            today -= timedelta(days=1)

        while d <= today:
            compute_start_time = datetime.now(tz)

            print(f'computing arrivals for {d}')
            compute_arrivals(d, agency, route_ids)

            print(f'computing stats for {d}')
            compute_stats(d, agency, routes)

            date_str = str(d)

            if d < today and ('last_complete_date' not in state or date_str > state['last_complete_date']):
                state['last_complete_date'] = date_str
                save_state(state)
            elif d == today:
                state['last_partial_date_time'] = str(compute_start_time)
                save_state(state)

            d += timedelta(days=1)
