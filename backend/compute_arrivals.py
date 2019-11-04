from models import arrival_history, util, trynapi, eclipses, config
import json
import math
import argparse
from datetime import datetime, date, timedelta
import pytz
import time
import boto3
import gzip

def compute_arrivals_for_date_and_start_hour(d: date, start_hour: int,
                agency: config.Agency, route_ids: list,
                save_to_s3=True):

    tz = agency.tz

    start_dt = tz.localize(datetime(d.year, d.month, d.day, hour=start_hour))
    end_dt = start_dt + timedelta(days=1)

    start_time = int(start_dt.timestamp())
    end_time = int(end_dt.timestamp())

    print(f"time = [{start_dt}, {end_dt})")

    t1 = time.time()

    state = trynapi.get_state(agency.id, d, start_time, end_time, route_ids)

    print(f'retrieved state in {round(time.time()-t1,1)} sec')

    for i, route_id in enumerate(route_ids):
        route_state = state.get_for_route(route_id)

        if route_state is None:
            print(f'no state for route {route_id}')
            continue

        route_config = agency.get_route_config(route_id)

        t1 = time.time()

        arrivals_df = eclipses.find_arrivals(agency, route_state, route_config, d)

        history = arrival_history.from_data_frame(agency.id, route_id, arrivals_df, start_time, end_time)

        print(f'{route_id}: {round(time.time()-t1,1)} saving arrival history')

        arrival_history.save_for_date(history, d, save_to_s3)

        print(f'{route_id}: {round(time.time()-t1,2)} done')

def compute_arrivals(d: date, agency: config.Agency, route_ids: list, save_to_s3=True):

    all_custom_routes = []
    custom_start_hours = []

    for custom_day_start_conf in agency.custom_day_start_hours:
        custom_routes = [x for x in route_ids if x in set(custom_day_start_conf["routes"])]
        custom_start_hours.append((custom_day_start_conf["start_hour"], custom_routes))
        all_custom_routes.extend(custom_routes)

    compute_arrivals_for_date_and_start_hour(
        d, start_hour=agency.default_day_start_hour,
        agency=agency,
        route_ids=[r for r in route_ids if r not in all_custom_routes],
        save_to_s3=save_to_s3
    )

    for start_hour, custom_routes in custom_start_hours:
        compute_arrivals_for_date_and_start_hour(
            d, start_hour=start_hour,
            agency=agency,
            route_ids=custom_routes,
            save_to_s3=save_to_s3
        )

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache arrival history')
    parser.add_argument('--route', nargs='*')
    parser.add_argument('--agency', required=False, help='Agency ID')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    if args.route is not None and args.agency is None:
        raise Exception("Must specify --agency with --route")

    date_str = args.date

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    for agency in agencies:
        if args.agency is not None and args.route is not None:
            route_ids = args.route
        else:
            route_ids = [route.id for route in agency.get_route_list()]

        for d in dates:
            compute_arrivals(d, agency, route_ids, args.s3)
