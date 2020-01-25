from models import metrics, util, arrival_history, trip_times, constants, config, timetables, precomputed_stats, wait_times
import argparse
from datetime import datetime, date
import pytz
import collections
import pandas as pd
import numpy as np
import time

all_stat_ids = [
    'combined',
    'median-trip-times',
]

def filter_departures_by_interval(s1_trip_values, s1_departure_time_values, timestamp_intervals):
    #
    # Given parallel arrays of trip IDs and departure times for the entire day, returns parallel
    # lists of arrays of trip IDs and departure times for each interval. The i-th element of each list
    # corresponds to the trips with departure times within the i-th interval.
    #
    s1_trip_values_by_interval = []
    s1_departure_time_values_by_interval = []

    for (start_time, end_time) in timestamp_intervals:
        if start_time is None or end_time is None:
            s1_departure_time_values_by_interval.append(s1_departure_time_values)
            s1_trip_values_by_interval.append(s1_trip_values)
        else:
            interval_condition = np.logical_and(
                s1_departure_time_values >= start_time,
                s1_departure_time_values < end_time
            )
            s1_departure_time_values_by_interval.append(s1_departure_time_values[interval_condition])
            s1_trip_values_by_interval.append(s1_trip_values[interval_condition])

    return s1_trip_values_by_interval, s1_departure_time_values_by_interval

def add_wait_time_stats_for_route(all_stats, timestamp_intervals, route_config, history_df):
    route_id = route_config.id
    history_df = history_df.sort_values('DEPARTURE_TIME', axis=0)
    sid_values = history_df['SID'].values
    did_values = history_df['DID'].values

    for dir_info in route_config.get_direction_infos():

        dir_id = dir_info.id
        stop_ids = dir_info.get_stop_ids()

        for i, stop_id in enumerate(stop_ids):
            stop_df = history_df[(sid_values == stop_id) & (did_values == dir_id)]

            all_time_values = stop_df['DEPARTURE_TIME'].values

            for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
                wait_time_stats = wait_times.get_stats(all_time_values, start_time, end_time)

                median_wait_time = wait_time_stats.get_quantile(0.5)
                if median_wait_time is not None:
                    dir_stats = all_stats['combined'][interval_index][route_id]['directions'][dir_id]
                    dir_stats['medianWaitTimes'][stop_id] = round(median_wait_time, 1)

        for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
            add_median_wait_time_stats_for_direction(
                all_stats['combined'][interval_index][route_id]['directions'][dir_id]
            )

def add_schedule_adherence_stats_for_route(all_stats, timestamp_intervals, route_config, history_df, timetable_df):
    route_id = route_config.id

    timetable_df = timetable_df.sort_values('DEPARTURE_TIME', axis=0)
    history_df = history_df.sort_values('DEPARTURE_TIME', axis=0)

    history_sid_values = history_df['SID'].values
    history_did_values = history_df['DID'].values

    timetable_sid_values = timetable_df['SID'].values
    timetable_did_values = timetable_df['DID'].values

    for dir_info in route_config.get_direction_infos():

        dir_id = dir_info.id
        stop_ids = dir_info.get_stop_ids()

        for i, stop_id in enumerate(stop_ids):
            stop_history_df = history_df[(history_sid_values == stop_id) & (history_did_values == dir_id)]
            stop_timetable_df = timetable_df[(timetable_sid_values == stop_id) & (timetable_did_values == dir_id)]

            stop_history_departure_times = stop_history_df['DEPARTURE_TIME'].values
            stop_timetable_departure_times = stop_timetable_df['DEPARTURE_TIME'].values

            comparison_df = timetables.match_schedule_to_actual_times(
                stop_timetable_departure_times,
                stop_history_departure_times,
                #late_sec=180
            )
            comparison_df['DEPARTURE_TIME'] = stop_timetable_departure_times

            for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):

                interval_comparison_df = comparison_df

                if start_time is not None:
                    interval_comparison_df = interval_comparison_df[interval_comparison_df['DEPARTURE_TIME'] >= start_time]

                if end_time is not None:
                    interval_comparison_df = interval_comparison_df[interval_comparison_df['DEPARTURE_TIME'] < end_time]

                num_scheduled_departures = len(interval_comparison_df)

                if num_scheduled_departures > 0:
                    on_time_rate = round(np.sum(interval_comparison_df['on_time']) / num_scheduled_departures, 3)
                    dir_stats = all_stats['combined'][interval_index][route_id]['directions'][dir_id]
                    dir_stats['onTimeRates'][stop_id] = on_time_rate

        for interval_index, _ in enumerate(timestamp_intervals):
            add_median_schedule_adherence_stats_for_direction(
                all_stats['combined'][interval_index][route_id]['directions'][dir_id]
            )

def add_median_schedule_adherence_stats_for_direction(
    dir_stats
):
    dir_stat_values = np.array([stat_value for _, stat_value in dir_stats['onTimeRates'].items()])

    if len(dir_stat_values) > 0:
        dir_stats['onTimeRates']["median"] = round(np.median(dir_stat_values), 3)

def add_median_wait_time_stats_for_direction(
    dir_stats
):
    dir_stat_values = np.array([stat_value for _, stat_value in dir_stats['medianWaitTimes'].items()])
    if len(dir_stat_values) > 0:
        dir_stats['medianWaitTimes']['median'] = round(np.median(dir_stat_values), 1)

def add_trip_time_stats_for_route(all_stats, timestamp_intervals, route_config, history_df):

    history_df = history_df.sort_values('TRIP', axis=0)

    route_id = route_config.id

    sid_values = history_df['SID'].values
    did_values = history_df['DID'].values

    for dir_info in route_config.get_direction_infos():
        dir_id = dir_info.id

        is_loop = dir_info.is_loop()

        stop_ids = dir_info.get_stop_ids()
        num_stops = len(stop_ids)

        departure_trip_values_by_stop = {}
        arrival_trip_values_by_stop = {}
        departure_time_values_by_stop = {}
        arrival_time_values_by_stop = {}

        for stat_id in ['combined','median-trip-times']:
            for interval_index, _ in enumerate(timestamp_intervals):
                all_stats[stat_id][interval_index][route_id]['directions'][dir_id]['medianTripTimes'] = collections.defaultdict(dict)

        for interval_index, _ in enumerate(timestamp_intervals):
            all_stats['combined'][interval_index][route_id]['directions'][dir_id]['tripTimeRanges'] = collections.defaultdict(dict)

        for stop_id in stop_ids:
            stop_df = history_df[(sid_values == stop_id) & (did_values == dir_id)]

            trip_values = stop_df['TRIP'].values
            departure_time_values = stop_df['DEPARTURE_TIME'].values
            arrival_time_values = stop_df['TIME'].values

            if is_loop:
                # for loop routes, pre-sort arrays by departure/arrival times for better performance.
                sorted_departure_time_values, sorted_departure_trip_values = trip_times.sort_parallel(departure_time_values, trip_values)
                sorted_arrival_time_values, sorted_arrival_trip_values = trip_times.sort_parallel(arrival_time_values, trip_values)
            else:
                # for non-loop routes, arrays are already sorted by trip ID.
                sorted_departure_trip_values = trip_values
                sorted_arrival_trip_values = trip_values
                sorted_departure_time_values = departure_time_values
                sorted_arrival_time_values = arrival_time_values

            departure_trip_values_by_stop[stop_id] = sorted_departure_trip_values
            departure_time_values_by_stop[stop_id] = sorted_departure_time_values
            arrival_trip_values_by_stop[stop_id] = sorted_arrival_trip_values
            arrival_time_values_by_stop[stop_id] = sorted_arrival_time_values

        i_end_index = num_stops if is_loop else (num_stops - 1)

        for i in range(0, i_end_index):

            s1 = stop_ids[i]

            s1_trip_values = departure_trip_values_by_stop[s1]

            if len(s1_trip_values) == 0:
                continue

            s1_departure_time_values = departure_time_values_by_stop[s1]

            s1_trip_values_by_interval, s1_departure_time_values_by_interval = filter_departures_by_interval(
                s1_trip_values,
                s1_departure_time_values,
                timestamp_intervals
            )

            j_start_index = 0 if is_loop else i + 1

            for j in range(j_start_index, num_stops):
                s2 = stop_ids[j]

                for interval_index, _ in enumerate(timestamp_intervals):
                    trip_min = trip_times.get_completed_trip_times(
                        s1_trip_values_by_interval[interval_index],
                        s1_departure_time_values_by_interval[interval_index],
                        arrival_trip_values_by_stop[s2],
                        arrival_time_values_by_stop[s2],
                        is_loop=is_loop,
                        assume_sorted=True
                    )

                    if len(trip_min) > 0:

                        sorted_trip_min = np.sort(trip_min)
                        median_trip_time = round(util.quantile_sorted(sorted_trip_min, 0.5), 1)

                        # save all pairs of stops in median-trip-times stat, used for the isochrone map
                        all_stats['median-trip-times'][interval_index][route_id]['directions'][dir_id]['medianTripTimes'][s1][s2] = median_trip_time

                        # only store median trip times for adjacent stops, or from the first two stops in combined stats
                        # to reduce file size and loading time, since the frontend only needs this for displaying segments
                        # and cumulative time along a route
                        if (i <= 1) or (j == (i + 1) % num_stops):
                            all_stats['combined'][interval_index][route_id]['directions'][dir_id]['medianTripTimes'][s1][s2] = median_trip_time

                        # only store trip time ranges between the first two and last two stops in the combined stats
                        # to reduce file size and loading time, since the frontend only needs these to display end-to-end variability
                        if (i <= 1) and (j >= num_stops - 2):
                            all_stats['combined'][interval_index][route_id]['directions'][dir_id]['tripTimeRanges'][s1][s2] = [
                                round(util.quantile_sorted(sorted_trip_min, 0.1), 1),
                                round(util.quantile_sorted(sorted_trip_min, 0.9), 1)
                            ]

def compute_stats(d: date, agency: config.Agency, routes, save_to_s3=True):

    tz = agency.tz
    stat_ids = all_stat_ids

    print(d)

    time_str_intervals = constants.DEFAULT_TIME_STR_INTERVALS.copy()
    time_str_intervals.append(('07:00','19:00'))

    timestamp_intervals = [(
            int(util.get_localized_datetime(d, start_time_str, tz).timestamp()),
            int(util.get_localized_datetime(d, end_time_str, tz).timestamp())
        ) for start_time_str, end_time_str in time_str_intervals
    ]

    timestamp_intervals.append((None, None))
    time_str_intervals.append((None, None))

    all_stats = {}

    for stat_id in stat_ids:
        all_stats[stat_id] = {}

        for interval_index, _ in enumerate(timestamp_intervals):
            all_stats[stat_id][interval_index] = {}

    for route in routes:
        route_id = route.id
        print(route_id)

        t1 = time.time()

        route_config = agency.get_route_config(route_id)

        try:
            history = arrival_history.get_by_date(agency.id, route_id, d)
        except FileNotFoundError as ex:
            print(ex)
            continue

        try:
            timetable = timetables.get_by_date(agency.id, route_id, d)
        except FileNotFoundError as ex:
            print(ex)
            continue

        timetable_df = timetable.get_data_frame()

        history_df = history.get_data_frame()

        for stat_id in stat_ids:
            for interval_index, _ in enumerate(timestamp_intervals):
                all_stats[stat_id][interval_index][route_id] = {'directions':{}}

                for dir_info in route_config.get_direction_infos():
                    dir_id = dir_info.id

                    all_stats[stat_id][interval_index][route_id]['directions'][dir_id] = collections.defaultdict(dict)

        add_trip_time_stats_for_route(all_stats, timestamp_intervals, route_config, history_df)
        add_wait_time_stats_for_route(all_stats, timestamp_intervals, route_config, history_df)
        add_schedule_adherence_stats_for_route(all_stats, timestamp_intervals, route_config, history_df, timetable_df)

        t2 = time.time()
        print(f' {round(t2-t1, 2)} sec')

    for stat_id in stat_ids:
        for interval_index, (start_time, end_time) in enumerate(timestamp_intervals):
            start_time_str, end_time_str = time_str_intervals[interval_index]

            data = {
                'routes': all_stats[stat_id][interval_index],
            }
            precomputed_stats.save_stats(agency.id, stat_id, d, start_time_str, end_time_str, data, save_to_s3)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute and cache statistics')
    parser.add_argument('--agency', help='Agency ID')
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.set_defaults(s3=False)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    for agency in agencies:
        routes = agency.get_route_list()
        for d in dates:
            compute_stats(d, agency, routes, save_to_s3=args.s3)
