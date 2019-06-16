from models import metrics, eclipses, nextbus, util, arrival_history, trip_times
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np
import time

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache trip times')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)

    args = parser.parse_args()

    agency_id = 'sf-muni'

    all_trip_times = {}
    tz = pytz.timezone('US/Pacific')

    routes = nextbus.get_route_list(agency_id)

    date_str = args.date
    d = util.get_dates_in_range(date_str, date_str)[0]

    start_time_str = '07:00'
    end_time_str = '19:00'

    all_trip_times = {}

    for route in routes:
        route_id = route.id

        print(route_id)
        route_config = nextbus.get_route_config(agency_id, route_id)

        try:
            history = arrival_history.get_by_date(agency_id, route_id, d)
        except FileNotFoundError as ex:
            print(ex)
            continue

        route_trip_times = {}
        all_trip_times[route_id] = route_trip_times

        t1 = time.time()

        route_df = history.get_data_frame(tz = tz, start_time_str = start_time_str, end_time_str = end_time_str).sort_values('TIME', axis=0)

        for dir_info in route_config.get_direction_infos():
            dir_trip_times = {}
            route_trip_times[dir_info.id] = dir_trip_times

            stop_ids = dir_info.get_stop_ids()
            num_stops = len(stop_ids)

            stop_dfs = {}
            arrival_times_by_stop_by_vid = {}

            for stop_id in stop_ids:
                stop_dfs[stop_id] = route_df[route_df['SID'] == stop_id]
                arrival_times_by_stop_by_vid[stop_id] = {vid: dt['TIME'].values for vid, dt in stop_dfs[stop_id].groupby('VID')}

            for i in range(0, num_stops-1):
                s1 = stop_ids[i]
                print(f' {s1}')

                s1_df = stop_dfs[s1]
                if s1_df.empty:
                    continue
                #s1_df_by_vid = stop_dfs_by_vid[s1]

                s1_trip_times = {}
                dir_trip_times[s1] = s1_trip_times
                s1_arrival_times_by_vid = arrival_times_by_stop_by_vid[s1]

                for j in range(i + 1, num_stops):
                    s2 = stop_ids[j]

                    s2_arrival_times_by_vid = arrival_times_by_stop_by_vid[s2]
                    if len(s2_arrival_times_by_vid) == 0:
                        continue

                    def find_dest_arrival_time(row):
                        time = row.TIME

                        try:
                            s2_vid_arrival_times = s2_arrival_times_by_vid[row.VID]
                            next_s2_arrival_index = np.searchsorted(s2_vid_arrival_times, time, side='right')
                            next_s2_arrival_time = s2_vid_arrival_times[next_s2_arrival_index]
                        except (IndexError, KeyError):
                            return None

                        if next_s2_arrival_time - time > 900:
                            try:
                                s1_vid_arrival_times = s1_arrival_times_by_vid[row.VID]
                                next_s1_arrival_index = np.searchsorted(s1_vid_arrival_times, time, side='right')
                                next_s1_arrival_time = s1_vid_arrival_times[next_s1_arrival_index]

                                if next_s1_arrival_time < next_s2_arrival_time:
                                    return None
                            except (IndexError, KeyError):
                                pass

                        return next_s2_arrival_time

                    dest_arrival_time = s1_df.apply(find_dest_arrival_time, axis=1)
                    trip_min = (dest_arrival_time - s1_df.DEPARTURE_TIME)/60

                    trip_min = trip_min[trip_min.notnull()]

                    if not trip_min.empty:
                        s1_trip_times[s2] = round(np.average(trip_min), 1)

        t2 = time.time()
        print(f' {round(t2-t1, 2)}')

    data_str = json.dumps(all_trip_times)

    with open(f'{util.get_data_dir()}/trip_times_t1_sf-muni_{str(d)}.json', "w") as f:
        f.write(data_str)