from models import arrival_history, util, trynapi, nextbus, eclipses
import json
import math
import argparse
from datetime import datetime, timedelta
import pytz
import time
import boto3
import gzip

OWL_LINES = ['90', '91', 'K_OWL', 'L_OWL', 'M_OWL', 'N_OWL', 'T_OWL']

def get_arrival_history(as_of_date: datetime, time_zone: pytz.timezone, increment: timedelta,
                        agency: str, route_ids: list, start_hour: int, continue_index):
    start_dt = time_zone.localize(datetime(as_of_date.year, as_of_date.month, as_of_date.day, hour=start_hour))
    end_dt = start_dt + increment

    start_time = int(start_dt.timestamp())
    end_time = int(end_dt.timestamp())

    print(f"time = [{start_dt}, {end_dt})")

    t1 = time.time()

    state = trynapi.get_state(agency, as_of_date, start_time, end_time, route_ids)

    print(f'retrieved state in {round(time.time()-t1,1)} sec')

    for i, route_id in enumerate(route_ids):
        if continue_index is not None and i < continue_index:
            continue

        route_state = state.get_for_route(route_id)

        if route_state is None:
            print(f'no state for route {route_id}')
            continue

        route_config = nextbus.get_route_config(agency, route_id)

        t1 = time.time()

        arrivals_df = eclipses.find_arrivals(route_state, route_config, as_of_date, time_zone)

        history = arrival_history.from_data_frame(agency, route_id, arrivals_df, start_time, end_time)

        print(f'{route_id}: {round(time.time()-t1,1)} saving arrival history')

        arrival_history.save_for_date(history, d, args.s3)

        print(f'{route_id}: {round(time.time()-t1,2)} done')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache arrival history')
    parser.add_argument('--route', nargs='*')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--continue-route', help='Continue at a particular route after an error')
    parser.set_defaults(s3=False)

    args = parser.parse_args()
    route_ids = args.route
    agency = 'sf-muni'

    if route_ids is None:
        route_ids = [route.id for route in nextbus.get_route_list(agency)]

    owl_routes = [x for x in route_ids if x in set(OWL_LINES)]

    date_str = args.date

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    tz = pytz.timezone('America/Los_Angeles')

    incr = timedelta(days=1)

    continue_index = route_ids.index(args.continue_route) if args.continue_route is not None else None

    for d in dates:
        # for standard routes start each "day" at 3 AM local time so midnight-3am buses are associated with previous day
        get_arrival_history(as_of_date=d,
                            time_zone=tz,
                            increment=incr,
                            agency=agency,
                            route_ids=list(set(route_ids) - set(owl_routes)),
                            start_hour=3,
                            continue_index=continue_index,
                            )
        # owl routes run from 1AM to 5AM so they are associated with the same day
        get_arrival_history(as_of_date=d,
                            time_zone=tz,
                            increment=incr,
                            agency=agency,
                            route_ids=owl_routes,
                            start_hour=0,
                            continue_index=continue_index,
                            )


