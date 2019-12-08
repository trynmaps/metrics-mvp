from models import metrics, eclipses, config, util, arrival_history
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Show overall arrival history for a particular route')
    parser.add_argument('--agency', required=True, help='Agency id')
    parser.add_argument('--route', required=True, help='Route id')
    parser.add_argument('--dir', help='Direction id')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')

    parser.add_argument('--version')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    args = parser.parse_args()

    agency = config.get_agency(args.agency)

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

    route_id = args.route
    direction_id = args.dir

    date_str = args.date
    start_time_str = args.start_time
    end_time_str = args.end_time

    tz = agency.tz

    stop_rows = []

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)

        print(f"Date: {', '.join([str(date) for date in dates])}")
        print(f"Time of Day: [{start_time_str}, {end_time_str})")
    else:
        dates = None

    def render_distance(dist):
        return '----' if np.isnan(dist) else ('%3dm' % dist)

    route_config = agency.get_route_config(route_id)
    if route_config is None:
        raise Exception(f"Invalid route {route_id}")

    df = pd.concat([
        arrival_history.get_by_date(agency.id, route_id, d, version) \
            .get_data_frame(
                start_time = util.get_timestamp_or_none(d, start_time_str, tz),
                end_time = util.get_timestamp_or_none(d, end_time_str, tz)
            )
            for d in dates
    ]) if dates is not None else None

    print(f"Route: {route_id} ({route_config.title})")

    dir_infos = route_config.get_direction_infos()
    if direction_id is not None:
        dir_infos = [dir_info for dir_info in dir_infos if dir_info.id == direction_id]
        if len(dir_infos) == 0:
            raise Exception(f"Invalid direction {direction_id}")

    for dir_info in dir_infos:

        print(f"Direction: {dir_info.title} ({dir_info.id})")

        prev_stop_info = None

        for dir_index, stop_id in enumerate(dir_info.get_stop_ids()):
            stop_info = route_config.get_stop_info(stop_id)

            if prev_stop_info is not None:
                delta_dist = util.haver_distance(stop_info.lat, stop_info.lon, prev_stop_info.lat, prev_stop_info.lon)
            else:
                delta_dist = np.nan

            stop_info_str = f'{stop_info.id} [{dir_index}] \u0394 {render_distance(delta_dist)} - {stop_info.title}'

            if df is not None:
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

                print(f"{'%3d' % num_arrivals} arrivals ({dwell_time_str}) ({min_dist_str}) @ {stop_info_str}")
            else:
                num_arrivals = None

                print(stop_info_str)

            stop_rows.append((route_id, dir_info.id, stop_id, dir_index, stop_info.lat, stop_info.lon, delta_dist, num_arrivals))
            prev_stop_info = stop_info

    stops = pd.DataFrame(stop_rows, columns=['ROUTE','DID','SID','DIR_INDEX','LAT','LON','DIST','NUM_ARRIVALS'])

    if dates is not None:
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
