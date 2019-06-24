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

    parser.add_argument('--version')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

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

    num_stops = 0

    for d in dates:
        history = arrival_history.get_by_date(agency, route_id, d, version)

        start_time = util.get_timestamp_or_none(d, start_time_str, tz)
        end_time = util.get_timestamp_or_none(d, end_time_str, tz)

        df = history.get_data_frame(vehicle_id=vid, start_time=start_time, end_time=end_time)

        if df.empty:
            print(f"no arrival times found for vehicle {vid} on {date_str}")
            continue

        df = df.sort_values('TIME', axis=0)
        df['DATE_TIME'] = df['TIME'].apply(lambda t: datetime.fromtimestamp(t, tz))

        for row in df.itertuples():
            stop_id = row.SID
            stop_info = route_config.get_stop_info(stop_id)
            dir_info = route_config.get_direction_info(row.DID)

            try:
                stop_index = dir_info.get_stop_ids().index(stop_id)
            except ValueError:
                stop_index = None

            dwell_time = util.render_dwell_time(row.DEPARTURE_TIME - row.TIME)
            dist_str = f'{row.DIST}'.rjust(3)

            print(f"t={row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.TIME}) {dwell_time} vid:{row.VID}  #{row.TRIP} {dist_str}m stop:{stop_id} {row.DID}[{stop_index}] {stop_info.title if stop_info else '?'} dir:{dir_info.title if dir_info else '?'}")

            num_stops += 1

    print(f'num_stops = {num_stops}')