from models import metrics, eclipses, nextbus, util, arrival_history
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Show overall arrival history for a particular route')
    parser.add_argument('--route', required=True, help='Route id')

    parser.add_argument('--date', help='Date (yyyy-mm-dd)', required=True)

    parser.add_argument('--version')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    agency_id = 'sf-muni'

    args = parser.parse_args()

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

    route_id = args.route
    date_str = args.date
    start_time_str = args.start_time
    end_time_str = args.end_time

    tz = pytz.timezone('US/Pacific')

    route_ids = [route_id]

    stop_rows = []

    dates = util.get_dates_in_range(args.date, args.date)

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Time of Day: [{start_time_str}, {end_time_str})")

    def render_distance(dist):
        return '----' if np.isnan(dist) else ('%3dm' % dist)

    for route_id in route_ids:
        route_config = nextbus.get_route_config(agency_id, route_id)

        df = pd.concat([
            arrival_history.get_by_date(agency_id, route_id, d, version) \
                .get_data_frame(
                    start_time = util.get_timestamp_or_none(d, start_time_str, tz),
                    end_time = util.get_timestamp_or_none(d, end_time_str, tz)
                )
                for d in dates
        ])

        print(f"Route: {route_id} ({route_config.title})")

        dir_infos = route_config.get_direction_infos()

        for dir_info in dir_infos:
            print(f"Direction: {dir_info.title} ({dir_info.id})")

            prev_stop_info = None

            for dir_index, stop_id in enumerate(dir_info.get_stop_ids()):
                stop_info = route_config.get_stop_info(stop_id)

                if prev_stop_info is not None:
                    delta_dist = eclipses.haver_distance(stop_info.lat, stop_info.lon, prev_stop_info.lat, prev_stop_info.lon)
                else:
                    delta_dist = np.nan

                stop_arrivals = df[(df['SID'] == stop_info.id) & (df['DID'] == dir_info.id)]
                dwell_time = (stop_arrivals['DEPARTURE_TIME'] - stop_arrivals['TIME'])

                if not stop_arrivals.empty:
                    min_dist_quantiles = np.quantile(stop_arrivals['DIST'], [0,0.5,1])
                    dwell_time_quantiles = np.quantile(dwell_time, [0,0.5,1])
                else:
                    min_dist_quantiles = []
                    dwell_time_quantiles = []

                num_arrivals = len(stop_arrivals['TIME'].values)

                dwell_time_str = ', '.join([util.render_dwell_time(q) for q in dwell_time_quantiles])
                min_dist_str = ', '.join([render_distance(min_dist) for min_dist in min_dist_quantiles])

                print(f"{'%3d' % num_arrivals} arrivals ({dwell_time_str}) ({min_dist_str}) \u0394 {render_distance(delta_dist)} @ {stop_info.id} [{dir_index}] - {stop_info.title}")
                stop_rows.append((route_id, dir_info.id, stop_id, dir_index, stop_info.lat, stop_info.lon, delta_dist, num_arrivals))
                prev_stop_info = stop_info

        '''
        arrivals1 = df[(df['SID'] == '3814')]
        arrivals2 = df[(df['SID'] == '3813')]

        for row in arrivals1.itertuples():
            same_arrival = arrivals1[(arrivals1['VID'] == row.VID) & (arrivals1['TIME'] < row.TIME + 900) & (arrivals1['TIME'] > row.TIME)]
            if not same_arrival.empty:
                print(f'{row.DATE_TIME} duplicate vid:{row.VID} sid:{row.SID}')

        for row in arrivals1.itertuples():

            next_arrival = arrivals2[(arrivals2['VID'] == row.VID) & (arrivals2['TIME'] < row.TIME + 900) & (arrivals2['TIME'] >= row.TIME)]
            if next_arrival.empty:
                print(f'{row.DATE_TIME} missing vid:{row.VID} sid:{row.SID}')
        '''

    stops = pd.DataFrame(stop_rows, columns=['ROUTE','DID','SID','DIR_INDEX','LAT','LON','DIST','NUM_ARRIVALS'])

    num_arrivals = stops['NUM_ARRIVALS']

    print('** num arrivals **')
    print(f'average # of arrivals   = {round(np.average(num_arrivals),1)}')
    print(f'standard deviation      = {round(np.std(num_arrivals),1)}')
    print(f'lowest # of arrivals    = {round(np.min(num_arrivals),1)}')
    print(f'10% # of arrivals       = {round(np.quantile(num_arrivals,0.10),1)}')
    print(f'median # of arrivals    = {round(np.median(num_arrivals),1)}')
    print(f'90% # of arrivals       = {round(np.quantile(num_arrivals,0.90),1)}')
    print(f'highest # of arrivals   = {round(np.max(num_arrivals),1)}')

    dist = stops[stops['DIR_INDEX'] > 0]['DIST']

    print('** stop distance **')
    print(f'average distance between stops   = {round(np.average(dist),1)} m')
    print(f'standard deviation               = {round(np.std(dist),1)} m')
    print(f'shortest distance between stops  = {round(np.min(dist),1)} m')
    print(f'10% distance between stops       = {round(np.quantile(dist,0.10),1)} m')
    print(f'median distance between stops    = {round(np.median(dist),1)} m')
    print(f'90% distance between stops       = {round(np.quantile(dist,0.90),1)} m')
    print(f'longest distance between stops   = {round(np.max(dist),1)} m')
