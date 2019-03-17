import argparse
import json
import sys
from datetime import datetime, timedelta
from models import nextbus, arrival_history, util, metrics
import pytz
import numpy

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Show stop history for a particular vehicle')
    parser.add_argument('--route', required=True, help='Route id')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)
    parser.add_argument('--vid', help='Vehicle ID', required=True)

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    route_id = args.route
    date_str = args.date
    vid = args.vid

    agency = 'sf-muni'

    start_time_str = args.start_time
    end_time_str = args.end_time

    route_config = nextbus.get_route_config('sf-muni', route_id)

    tz = pytz.timezone('US/Pacific')

    dates = util.get_dates_in_range(args.date, args.date)

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Time of Day: [{start_time_str}, {end_time_str})")
    print(f"Route: {route_id} ({route_config.title})")
    print(f"Vehicle: {vid}")

    for d in dates:
        history = arrival_history.get_by_date(agency, route_id, d)

        df = history.get_data_frame(vehicle_id=vid, tz=tz, start_time_str=start_time_str, end_time_str=end_time_str)

        if df.empty:
            print(f"no arrival times found for vehicle {vid} on {date_str}")
            continue

        df = df.sort_values('TIME', axis=0)

        for index, row in df.iterrows():
            stop_id = row.SID
            stop_info = route_config.get_stop_info(stop_id)
            dir_info = route_config.get_direction_info(row.DID)

            print(f"t={row.DATE_STR} {row.TIME_STR} ({row.TIME}) vid:{row.VID} stop:{stop_info.title} ({stop_id}) dir:{dir_info.title} ({row.DID})")
