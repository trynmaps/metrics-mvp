import math
import pytz
import sys
import time
from datetime import date
from . import wait_times, util, arrival_history, trip_times, errors, constants, timetables

import pandas as pd
import numpy as np

# Represents a range of days with a time range within each day.
# RouteMetrics can calculate various statistics over a range.
class Range:
    def __init__(self, dates: list, start_time_str: str, end_time_str: str, tz: pytz.timezone):
        self.dates = dates                      # list of datetime.date objects
        self.start_time_str = start_time_str    # if None, no start time filter
        self.end_time_str = end_time_str        # if None, no end time filter
        self.tz = tz

# RouteMetrics allows computing various metrics for a particular route,
# such as headways, wait times, and trip times,
# including over various date and time ranges.
#
# It caches the arrival history and data frames so that the different
# metrics calculations can reuse the same arrivals data without
# needing to reload it from disk each time.
#
class RouteMetrics:
    def __init__(self, agency_id, route_id):
        self.agency_id = agency_id
        self.route_id = route_id
        self.arrival_histories = {}
        self.data_frames = {}
        self.timetables = {}

    def get_arrival_history(self, d):
        if d in self.arrival_histories:
            return self.arrival_histories[d]

        print(f'loading arrival history for route {self.route_id} on {d}', file=sys.stderr)

        try:
            self.arrival_histories[d] = history = arrival_history.get_by_date(self.agency_id, self.route_id, d)
        except FileNotFoundError as ex:
            raise errors.ArrivalHistoryNotFoundError(f"Arrival history not found for route {self.route_id} on {d}")

        return history

    def get_history_data_frame(self, d, direction_id=None, stop_id=None):
        key = f'history_{str(d)}_{stop_id}_{direction_id}'

        if key in self.data_frames:
            return self.data_frames[key]

        history = self.get_arrival_history(d)

        print(f'loading data frame {key} for route {self.route_id}', file=sys.stderr)

        df = history.get_data_frame(stop_id=stop_id, direction_id=direction_id)
        self.data_frames[key] = df
        return df

    def get_timetable(self, d):
        if d not in self.timetables.keys():
            self.timetables[d] = timetables.get_by_date(self.agency_id, self.route_id, d)

        return self.timetables[d]

    def get_timetable_data_frame(self, d, direction_id=None, stop_id=None):
        timetable = self.get_timetable(d)

        timetable_key = f'timetable_{str(d)}_{stop_id}_{direction_id}'

        if timetable_key not in self.data_frames:
            self.data_frames[timetable_key] = timetable.get_data_frame(stop_id=stop_id, direction_id=direction_id)

        return self.data_frames[timetable_key]

    def get_wait_time_stats(self, direction_id, stop_id, rng: Range):
        return self._get_wait_time_stats(direction_id, stop_id, rng, self.get_history_data_frame)

    def get_scheduled_wait_time_stats(self, direction_id, stop_id, rng: Range):
        return self._get_wait_time_stats(direction_id, stop_id, rng, self.get_timetable_data_frame)

    def _get_wait_time_stats(self, direction_id, stop_id, rng: Range, get_data_frame):
        wait_stats_arr = []

        for d in rng.dates:
            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            df = get_data_frame(d, stop_id=stop_id, direction_id=direction_id)

            departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

            wait_stats = wait_times.get_stats(departure_time_values, start_time, end_time)

            wait_stats_arr.append(wait_stats)

        return wait_stats_arr

    def get_arrivals(self, direction_id, stop_id, rng: Range):
        return self._get_count(direction_id, stop_id, rng, self.get_history_data_frame, 'TIME')

    def get_departures(self, direction_id, stop_id, rng: Range):
        return self._get_count(direction_id, stop_id, rng, self.get_history_data_frame, 'DEPARTURE_TIME')

    def get_scheduled_arrivals(self, direction_id, stop_id, rng: Range):
        return self._get_count(direction_id, stop_id, rng, self.get_timetable_data_frame, 'TIME')

    def get_scheduled_departures(self, direction_id, stop_id, rng: Range):
        return self._get_count(direction_id, stop_id, rng, self.get_timetable_data_frame, 'DEPARTURE_TIME')

    def _get_count(self, direction_id, stop_id, rng: Range, get_data_frame, time_field):
        if stop_id is None:
            return None

        count = 0

        for d in rng.dates:
            df = get_data_frame(d, direction_id=direction_id, stop_id=stop_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                df = df[df[time_field] >= start_time]

            if end_time is not None:
                df = df[df[time_field] < end_time]

            count += len(df)

        return count

    def get_departure_schedule_adherence(self, direction_id, stop_id, early_sec, late_sec, rng: Range):
        return self._get_schedule_adherence(direction_id, stop_id, early_sec, late_sec, rng, 'DEPARTURE_TIME')

    def get_arrival_schedule_adherence(self, direction_id, stop_id, early_sec, late_sec, rng: Range):
        return self._get_schedule_adherence(direction_id, stop_id, early_sec, late_sec, rng, 'TIME')

    def _get_schedule_adherence(self, direction_id, stop_id, early_sec, late_sec, rng: Range, time_field):
        if stop_id is None:
            return None

        compared_timetable_arr = []

        now = time.time()

        for d in rng.dates:
            stop_timetable = self.get_timetable_data_frame(d, direction_id=direction_id, stop_id=stop_id)
            stop_arrivals = self.get_history_data_frame(d, direction_id=direction_id, stop_id=stop_id)

            scheduled_time_values = np.sort(stop_timetable[time_field].values)
            actual_time_values = np.sort(stop_arrivals[time_field].values)

            comparison_df = timetables.match_schedule_to_actual_times(
                scheduled_time_values,
                actual_time_values,
                early_sec = early_sec,
                late_sec = late_sec,
            )
            comparison_df[time_field] = scheduled_time_values

            if len(comparison_df) and comparison_df[time_field].iloc[-1] >= now:
                comparison_df = comparison_df[comparison_df[time_field] < now]

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                comparison_df = comparison_df[comparison_df[time_field] >= start_time]

            if end_time is not None:
                comparison_df = comparison_df[comparison_df[time_field] < end_time]

            compared_timetable_arr.append(comparison_df)

        return pd.concat(compared_timetable_arr)

    def get_headway_schedule_deltas(self, direction_id, stop_id, rng: Range):

        headway_delta_arr = []

        now = time.time()

        for d in rng.dates:
            timetable_df = self.get_timetable_data_frame(d, direction_id=direction_id, stop_id=stop_id)
            history_df = self.get_history_data_frame(d, direction_id=direction_id, stop_id=stop_id)

            departure_time_values = np.sort(history_df['DEPARTURE_TIME'].values)

            scheduled_departure_time_values = np.sort(timetable_df['DEPARTURE_TIME'].values)

            comparison_df = timetables.match_actual_times_to_schedule(
                departure_time_values,
                scheduled_departure_time_values
            )
            comparison_df['DEPARTURE_TIME'] = departure_time_values

            comparison_df['headway'] = np.r_[np.nan, compute_headway_minutes(departure_time_values)]

            comparison_df = comparison_df[np.isfinite(comparison_df['headway'].values) & np.isfinite(comparison_df['closest_scheduled_headway'].values)]

            if len(comparison_df) and comparison_df['DEPARTURE_TIME'].iloc[-1] >= now:
                comparison_df = comparison_df[comparison_df['DEPARTURE_TIME'] < now]

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                comparison_df = comparison_df[comparison_df['DEPARTURE_TIME'] >= start_time]

            if end_time is not None:
                comparison_df = comparison_df[comparison_df['DEPARTURE_TIME'] < end_time]

            headway_delta = comparison_df['headway'].values - comparison_df['closest_scheduled_headway'].values

            headway_delta_arr.append(headway_delta)

        return np.concatenate(headway_delta_arr)

    def get_scheduled_trip_times(self, direction_id, start_stop_id, end_stop_id, rng: Range):
        return self._get_trip_times(direction_id, start_stop_id, end_stop_id, rng, self.get_timetable_data_frame)

    def get_trip_times(self, direction_id, start_stop_id, end_stop_id, rng: Range):
        return self._get_trip_times(direction_id, start_stop_id, end_stop_id, rng, self.get_history_data_frame)

    def _get_trip_times(self, direction_id, start_stop_id, end_stop_id, rng: Range, get_data_frame):
        completed_trips_arr = []

        if end_stop_id is None:
            return None

        for d in rng.dates:
            s1_df = get_data_frame(d, stop_id=start_stop_id, direction_id=direction_id)
            s2_df = get_data_frame(d, stop_id=end_stop_id, direction_id=direction_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                s1_df = s1_df[s1_df['DEPARTURE_TIME'] >= start_time]

            if end_time is not None:
                s1_df = s1_df[s1_df['DEPARTURE_TIME'] < end_time]

            completed_trip_times = trip_times.get_completed_trip_times(
                s1_df['TRIP'].values,
                s1_df['DEPARTURE_TIME'].values,
                s2_df['TRIP'].values,
                s2_df['TIME'].values
            )
            completed_trips_arr.append(completed_trip_times)

        return np.concatenate(completed_trips_arr)

    def get_headways(self, direction_id, stop_id, rng: Range):
        return self._get_headways(direction_id, stop_id, rng, self.get_history_data_frame)

    def get_scheduled_headways(self, direction_id, stop_id, rng: Range):
        return self._get_headways(direction_id, stop_id, rng, self.get_timetable_data_frame)

    def _get_headways(self, direction_id, stop_id, rng: Range, get_data_frame):
        headway_min_arr = []

        for d in rng.dates:
            df = get_data_frame(d, direction_id=direction_id, stop_id=stop_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

            headway_min = compute_headway_minutes(departure_time_values, start_time, end_time)

            headway_min_arr.append(headway_min)

        return np.concatenate(headway_min_arr)

def compute_headway_minutes(time_values, start_time=None, end_time=None):
    if start_time is not None:
        start_index = np.searchsorted(time_values, start_time, 'left')
    else:
        start_index = 0

    if end_time is not None:
        end_index = np.searchsorted(time_values, end_time, 'left')
    else:
        end_index = len(time_values)

    if start_index == 0:
        start_index = 1
    if start_index > end_index:
        end_index = start_index

    return (time_values[start_index:end_index] - time_values[start_index - 1 : end_index - 1]) / 60
