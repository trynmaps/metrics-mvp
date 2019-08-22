from models import trynapi, util, nextbus
import json
import argparse
import re
import pytz
import os
from datetime import datetime

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download raw state data from tryn-api')
    parser.add_argument('--route', nargs='*')
    parser.add_argument('--date', required=True, help='date')
    parser.add_argument('--start-time', required=False, help='start time (hh:mm)')
    parser.add_argument('--end-time', required=False, help='end time (hh:mm)')

    args = parser.parse_args()

    route_ids = args.route

    agency_id = 'sf-muni'

    if route_ids is None:
        route_ids = [route.id for route in nextbus.get_route_list(agency_id)]

    date_str = args.date

    d = util.parse_date(date_str)

    start_time_str = args.start_time
    if start_time_str is None:
        start_time_str = '03:00'

    end_time_str = args.end_time
    if end_time_str is None:
        end_time_str = '03:00+1'

    tz = pytz.timezone('US/Pacific')
    local_start = util.get_localized_datetime(d, start_time_str, tz)
    local_end = util.get_localized_datetime(d, end_time_str, tz)

    print(f"route_ids = {route_ids}")
    print(f"start = {local_start}")
    print(f"end = {local_end}")

    state = trynapi.get_state(agency_id, d, local_start.timestamp(), local_end.timestamp(), route_ids)

    
