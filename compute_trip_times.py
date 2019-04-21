from models import metrics, eclipses, nextbus, util, arrival_history, geo, trip_times
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    agency_id = 'sf-muni'

    all_trip_times = {}
    tz = pytz.timezone('US/Pacific')

    routes = nextbus.get_route_list(agency_id)

    d = date(2019,4,8)
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

        for dir_info in route_config.get_direction_infos():
            dir_trip_times = []
            all_trip_times[dir_info.id] = dir_trip_times

            stop_ids = dir_info.get_stop_ids()

            s0 = stop_ids[0]

            s0_df = history.get_data_frame(s0, tz = tz, start_time_str = start_time_str, end_time_str = end_time_str)

            for i, stop_id in enumerate(stop_ids):
                if i == 0:
                    dir_trip_times.append(0)
                else:
                    trips = trip_times.get_trip_times(s0_df, history, tz, s0, stop_id)
                    trip_min = trips.trip_min[trips.trip_min.notnull()]
                    if trip_min.empty:
                        dir_trip_times.append(None)
                    else:
                        dir_trip_times.append(round(np.average(trip_min), 1))

    data_str = json.dumps(all_trip_times)

    cache_path = geo.get_trip_times_cache_path(agency_id)
    with open(cache_path, "w") as f:
        f.write(data_str)