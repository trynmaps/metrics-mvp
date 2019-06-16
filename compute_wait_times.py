from models import metrics, nextbus, util, arrival_history, wait_times
import argparse
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache wait times')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)

    args = parser.parse_args()

    agency_id = 'sf-muni'

    all_wait_times = {}
    tz = pytz.timezone('US/Pacific')

    routes = nextbus.get_route_list(agency_id)

    date_str = args.date
    d = util.get_dates_in_range(date_str, date_str)[0]

    start_time_str = '07:00'
    end_time_str = '19:00'

    for route in routes:
        route_id = route.id

        print(route_id)
        route_config = nextbus.get_route_config(agency_id, route_id)

        try:
            history = arrival_history.get_by_date(agency_id, route_id, d)
        except FileNotFoundError as ex:
            print(ex)
            continue

        route_wait_times = {}
        all_wait_times[route_id] = route_wait_times

        for dir_info in route_config.get_direction_infos():
            dir_wait_times = {}
            route_wait_times[dir_info.id] = dir_wait_times

            stop_ids = dir_info.get_stop_ids()

            for i, stop_id in enumerate(stop_ids):
                df = history.get_data_frame(stop_id, tz = tz, start_time_str = start_time_str, end_time_str = end_time_str)

                if df.empty:
                    dir_wait_times[stop_id] = None
                else:
                    waits = metrics.compute_wait_times(wait_times.get_waits(df, None, d, tz, route_id, start_time_str, end_time_str))
                    dir_wait_times[stop_id] = round(np.average(waits), 1)

    data_str = json.dumps(all_wait_times)

    with open(f'{util.get_data_dir()}/wait_times_t2_sf-muni_{str(d)}.json', "w") as f:
        f.write(data_str)
