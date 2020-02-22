import pytz
import sys
import time
from datetime import date
from . import wait_times, util, arrival_history, trip_times, constants, timetables, routeconfig, config, precomputed_stats

import pandas as pd
import numpy as np

# Represents a range of days with a time range within each day.
# RouteMetrics and AgencyMetrics can calculate various statistics over a range.
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
    def __init__(self, agency_metrics, route_id):
        self.agency_metrics = agency_metrics
        self.agency_id = agency_metrics.agency_id
        self.route_id = route_id
        self.arrival_histories = {}
        self.data_frames = {}
        self.timetables = {}
        self.wait_time_stats = {}
        self.trip_times = {}
        self.schedule_adherence = {}
        self.headways = {}
        self.counts = {}
        self.headway_schedule_deltas = {}

    def get_arrival_history(self, d):
        if d in self.arrival_histories:
            return self.arrival_histories[d]

        print(f'loading arrival history for route {self.route_id} on {d}', file=sys.stderr)

        try:
            self.arrival_histories[d] = history = arrival_history.get_by_date(self.agency_id, self.route_id, d)
        except FileNotFoundError as ex:
            print(f'Arrival history not found for route {self.route_id} on {d}', file=sys.stderr)
            history = arrival_history.ArrivalHistory(self.agency_id, self.route_id, {});
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

    def get_wait_time_stats(self, direction_id, stop_id, rng: Range, scheduled=False):
        wait_stats_arr = []

        get_data_frame = self.get_timetable_data_frame if scheduled else self.get_history_data_frame

        for d in rng.dates:
            key = f'{direction_id}-{stop_id}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}-{scheduled}'

            if key not in self.wait_time_stats:
                #print(f'_get_wait_time_stats {key}', file=sys.stderr)

                start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
                end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

                df = get_data_frame(d, stop_id=stop_id, direction_id=direction_id)

                departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

                wait_stats = wait_times.get_stats(departure_time_values, start_time, end_time)

                self.wait_time_stats[key] = wait_stats

            wait_stats_arr.append(self.wait_time_stats[key])

        if len(wait_stats_arr) == 1:
            return wait_stats_arr[0]
        else:
            return wait_times.combine_stats(wait_stats_arr)

    def _get_count(self, direction_id, stop_id, rng: Range, time_field, scheduled=False):
        if stop_id is None:
            return None

        count = 0

        get_data_frame = self.get_timetable_data_frame if scheduled else self.get_history_data_frame

        for d in rng.dates:
            key = f'{direction_id}-{stop_id}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}-{scheduled}-{time_field}'
            if key not in self.counts:
                #print(f'_get_count {key}', file=sys.stderr)

                df = get_data_frame(d, direction_id=direction_id, stop_id=stop_id)

                start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
                end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

                if start_time is not None:
                    df = df[df[time_field] >= start_time]

                if end_time is not None:
                    df = df[df[time_field] < end_time]

                self.counts[key] = len(df)

            count += self.counts[key]

        return count

    def _get_schedule_adherence(self, direction_id, stop_id, early_sec, late_sec, rng: Range, time_field):
        if stop_id is None:
            return None

        compared_timetable_arr = []

        now = time.time()

        for d in rng.dates:
            key = f'{direction_id}-{stop_id}-{early_sec}-{late_sec}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}-{time_field}'
            if key not in self.schedule_adherence:
                #print(f'_get_schedule_adherence {key}', file=sys.stderr)

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

                self.schedule_adherence[key] = comparison_df

            compared_timetable_arr.append(self.schedule_adherence[key])

        if len(compared_timetable_arr) == 1:
            return compared_timetable_arr[0]
        elif len(compared_timetable_arr) != 0:
            return pd.concat(compared_timetable_arr)
        else:
            return None

    def get_headway_schedule_deltas(self, direction_id, stop_id, rng: Range):

        headway_delta_arr = []

        now = time.time()

        for d in rng.dates:
            key = f'{direction_id}-{stop_id}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}'
            if key not in self.headway_schedule_deltas:
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

                self.headway_schedule_deltas[key] = comparison_df['headway'].values - comparison_df['closest_scheduled_headway'].values

            headway_delta_arr.append(self.headway_schedule_deltas[key])

        if len(headway_delta_arr) == 1:
            return headway_delta_arr[0]
        else:
            return np.concatenate(headway_delta_arr)

    def get_route_config(self):
        return self.agency_metrics.get_route_config(self.route_id)

    def get_trip_times(self, direction_id, start_stop_id, end_stop_id, rng: Range, scheduled=False):
        completed_trips_arr = []

        if end_stop_id is None:
            return None

        is_loop = False
        route_config = self.get_route_config()
        if route_config is not None:
            if direction_id is not None:
                dir_info = route_config.get_direction_info(direction_id)
            else:
                direction_ids = route_config.get_directions_for_stop(start_stop_id)
                dir_info = route_config.get_direction_info(direction_ids[0]) if len(direction_ids) > 0 else None

            if dir_info is not None:
                is_loop = dir_info.is_loop()

        get_data_frame = self.get_timetable_data_frame if scheduled else self.get_history_data_frame

        for d in rng.dates:
            key = f'{direction_id}-{start_stop_id}-{end_stop_id}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}-{scheduled}'

            if key not in self.trip_times:
                #print(f'_get_trip_time_stats {key}', file=sys.stderr)

                s1_df = get_data_frame(d, stop_id=start_stop_id, direction_id=direction_id)
                s2_df = get_data_frame(d, stop_id=end_stop_id, direction_id=direction_id)

                start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
                end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

                if start_time is not None:
                    s1_df = s1_df[s1_df['DEPARTURE_TIME'] >= start_time]

                if end_time is not None:
                    s1_df = s1_df[s1_df['DEPARTURE_TIME'] < end_time]

                self.trip_times[key] = trip_times.get_completed_trip_times(
                    s1_df['TRIP'].values,
                    s1_df['DEPARTURE_TIME'].values,
                    s2_df['TRIP'].values,
                    s2_df['TIME'].values,
                    is_loop = is_loop
                )

            completed_trips_arr.append(self.trip_times[key])

        if len(completed_trips_arr) == 1:
            return completed_trips_arr[0]
        elif len(completed_trips_arr) != 0:
            return np.concatenate(completed_trips_arr)
        else:
            return None

    def get_headways(self, direction_id, stop_id, rng: Range, scheduled=False):
        headway_min_arr = []

        get_data_frame = self.get_timetable_data_frame if scheduled else self.get_history_data_frame

        for d in rng.dates:
            key = f'{direction_id}-{stop_id}-{d}-{rng.start_time_str}-{rng.end_time_str}-{rng.tz}-{scheduled}'

            if key not in self.headways:
                #print(f'_get_headways {key}', file=sys.stderr)
                df = get_data_frame(d, direction_id=direction_id, stop_id=stop_id)

                start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
                end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

                departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

                self.headways[key] = compute_headway_minutes(departure_time_values, start_time, end_time)

            headway_min_arr.append(self.headways[key])

        if len(headway_min_arr) == 1:
            return headway_min_arr[0]
        elif len(headway_min_arr) != 0:
            return np.concatenate(headway_min_arr)
        else:
            return None

class TripMetrics:
    def __init__(self, route_metrics, direction_id, start_stop_id, end_stop_id):
        self.route_metrics = route_metrics
        self.direction_id = direction_id
        self.start_stop_id = start_stop_id
        self.end_stop_id = end_stop_id

class TripIntervalMetrics:
    def __init__(self, trip_metrics, rng: Range):
        self.trip_metrics = trip_metrics
        self.route_metrics = trip_metrics.route_metrics
        self.direction_id = trip_metrics.direction_id
        self.start_stop_id = trip_metrics.start_stop_id
        self.end_stop_id = trip_metrics.end_stop_id
        self.rng = rng

    def get_headways(self, scheduled=False):
        return self.route_metrics.get_headways(self.direction_id, self.start_stop_id, self.rng, scheduled=scheduled)

    def get_trip_times(self, scheduled=False):
        return self.route_metrics.get_trip_times(self.direction_id, self.start_stop_id, self.end_stop_id, self.rng, scheduled=scheduled)

    def get_departure_schedule_adherence(self, early_sec, late_sec):
        return self.route_metrics._get_schedule_adherence(self.direction_id, self.start_stop_id, early_sec, late_sec, self.rng, 'DEPARTURE_TIME')

    def get_arrival_schedule_adherence(self, early_sec, late_sec):
        return self.route_metrics._get_schedule_adherence(self.direction_id, self.end_stop_id, early_sec, late_sec, self.rng, 'TIME')

    def get_arrivals(self, scheduled=False):
        return self.route_metrics._get_count(self.direction_id, self.end_stop_id, self.rng, 'TIME', scheduled=scheduled)

    def get_departures(self, scheduled=False):
        return self.route_metrics._get_count(self.direction_id, self.start_stop_id, self.rng, 'DEPARTURE_TIME', scheduled=scheduled)

    def get_wait_time_stats(self, scheduled=False):
        return self.route_metrics.get_wait_time_stats(self.direction_id, self.start_stop_id, self.rng, scheduled=scheduled)

    def get_headway_schedule_deltas(self):
        return self.route_metrics.get_headway_schedule_deltas(self.direction_id, self.start_stop_id, self.rng)

class SegmentIntervalMetrics:
    def __init__(self, dir_interval_metrics, from_stop_id, to_stop_id):
        self.dir_interval_metrics = dir_interval_metrics
        self.from_stop_id = from_stop_id
        self.to_stop_id = to_stop_id

    def get_median_trip_time(self, scheduled=False):
        return self.dir_interval_metrics.get_median_trip_time(
            self.from_stop_id,
            self.to_stop_id,
            scheduled = scheduled
        )

    def get_num_trips(self, scheduled=False):
        return self.dir_interval_metrics.get_num_trips(
            self.from_stop_id,
            self.to_stop_id,
            scheduled = scheduled
        )

class DirectionIntervalMetrics:
    def __init__(self, agency_metrics, route_id, direction_id, rng):
        self.agency_metrics = agency_metrics
        self.rng = rng
        self.route_id = route_id
        self.direction_id = direction_id

    def get_direction_info(self):
        route = self.agency_metrics.get_route_config(self.route_id)
        if route is None:
            return None

        return route.get_direction_info(self.direction_id)

    def get_median_wait_time(self, scheduled=False):
        return self._get_direction_stat_value('medianWaitTime', scheduled=scheduled)

    def get_median_headway(self, scheduled=False):
        return self._get_direction_stat_value('medianHeadway', scheduled=scheduled)

    def get_on_time_rate(self):
        return self._get_direction_stat_value('onTimeRate', scheduled=False)

    def get_completed_trips(self, scheduled=False):
        dir_info = self.get_direction_info()
        if dir_info is None:
            return None

        first_stop_id, last_stop_id = dir_info.get_endpoint_stop_ids()
        return self.get_num_trips(first_stop_id, last_stop_id, scheduled=scheduled)

    def get_num_trips(self, start_stop_id, end_stop_id, scheduled=False):
        total_trips = None

        for d in self.rng.dates:
            stats = self.agency_metrics.get_precomputed_stats(
                precomputed_stats.StatIds.Combined,
                d, self.rng.start_time_str, self.rng.end_time_str,
                scheduled=scheduled
            )
            if stats is None:
                continue

            num_trips = stats.get_num_trips(self.route_id, self.direction_id, start_stop_id, end_stop_id)
            if num_trips is not None:
                if total_trips is None:
                    total_trips = num_trips
                else:
                    total_trips += num_trips

        return total_trips

    def get_segment_interval_metrics(self):
        dir_info = self.get_direction_info()
        if dir_info is None:
            return None

        stop_ids = dir_info.get_stop_ids()

        segment_metrics_arr = []

        for index in range(len(stop_ids) - 1):
            next_index = index + 1
            from_stop_id = stop_ids[index]
            to_stop_id = stop_ids[next_index]
            segment_metrics_arr.append(SegmentIntervalMetrics(self, from_stop_id, to_stop_id))

        if dir_info.is_loop():
            segment_metrics_arr.append(SegmentIntervalMetrics(self, stop_ids[len(stop_ids) - 1], stop_ids[0]))

        return segment_metrics_arr

    def get_cumulative_segment_interval_metrics(self):
        dir_info = self.get_direction_info()
        if dir_info is None:
            return None

        stop_ids = dir_info.get_stop_ids()

        segment_metrics_arr = []

        from_stop_id, end_stop_id = dir_info.get_endpoint_stop_ids()

        from_stop_index = stop_ids.index(from_stop_id)

        for index in range(from_stop_index + 1, len(stop_ids)):
            to_stop_id = stop_ids[index]
            segment_metrics_arr.append(SegmentIntervalMetrics(self, from_stop_id, to_stop_id))

            if to_stop_id == end_stop_id:
                break

        if dir_info.is_loop():
            segment_metrics_arr.append(SegmentIntervalMetrics(self, from_stop_id, from_stop_id))

        return segment_metrics_arr

    def _get_direction_stat_value(self, stat_key: str, scheduled=False):
        all_values = []

        rng = self.rng

        for d in rng.dates:
            stats = self.agency_metrics.get_precomputed_stats(
                precomputed_stats.StatIds.Combined,
                d, rng.start_time_str, rng.end_time_str,
                scheduled=scheduled
            )

            if stats is None:
                continue

            stat_value = stats.get_direction_stat_value(self.route_id, self.direction_id, stat_key)
            if stat_value is not None:
                all_values.append(stat_value)

        return np.median(all_values) if len(all_values) > 0 else None

    def get_median_trip_time(self, start_stop_id, end_stop_id, scheduled=False):
        all_trip_times = []

        rng = self.rng

        for d in rng.dates:
            stats = self.agency_metrics.get_precomputed_stats(
                precomputed_stats.StatIds.Combined,
                d, rng.start_time_str, rng.end_time_str,
                scheduled=scheduled
            )
            if stats is None:
                continue

            trip_time = stats.get_median_trip_time(self.route_id, self.direction_id, start_stop_id, end_stop_id)
            if trip_time is not None:
                all_trip_times.append(trip_time)

        return np.median(all_trip_times) if len(all_trip_times) > 0 else None

    def get_travel_time_variability(self):
        all_variabilities = []

        dir_info = self.get_direction_info()
        if dir_info is None:
            return None

        first_stop_id, last_stop_id = dir_info.get_endpoint_stop_ids()
        rng = self.rng

        for d in rng.dates:
            stats = self.agency_metrics.get_precomputed_stats(
                precomputed_stats.StatIds.Combined,
                d, rng.start_time_str, rng.end_time_str
            )
            if stats is None:
                continue

            p10_trip_time = stats.get_p10_trip_time(self.route_id, self.direction_id, first_stop_id, last_stop_id)
            p90_trip_time = stats.get_p90_trip_time(self.route_id, self.direction_id, first_stop_id, last_stop_id)
            #print(f'{route_id} {direction_id} {first_stop_id}->{last_stop_id} : {trip_time_arr}', file=sys.stderr)
            if p10_trip_time is not None and p90_trip_time is not None:
                all_variabilities.append(p90_trip_time - p10_trip_time)

        return np.median(all_variabilities) if len(all_variabilities) > 0 else None

    def get_average_speed(self, units=constants.MILES_PER_HOUR, scheduled=False):
        all_speeds = []

        dir_info = self.get_direction_info()
        if dir_info is None:
            return None

        if units == constants.KM_PER_HOUR:
            conversion_factor = 1000 / 60
        elif units == constants.MILES_PER_HOUR:
            conversion_factor = 1609.34 / 60
        else:
            raise Exception(f"Unsupported unit {units}")

        first_stop_id, last_stop_id = dir_info.get_endpoint_stop_ids()

        first_stop_geometry = dir_info.get_stop_geometry(first_stop_id)
        last_stop_geometry = dir_info.get_stop_geometry(last_stop_id)

        if first_stop_geometry is None or last_stop_geometry is None:
            raise Exception(
                f'Missing stop geometry on route {route_id}, {direction_id}, Stop {first_stop_id} to {last_stop_id}'
            )

        dist = last_stop_geometry['distance'] - first_stop_geometry['distance']
        if dist <= 0:
            return None

        rng = self.rng
        for d in rng.dates:
            stats = self.agency_metrics.get_precomputed_stats(
                precomputed_stats.StatIds.Combined,
                d, rng.start_time_str, rng.end_time_str,
                scheduled=scheduled
            )
            if stats is None:
                continue

            trip_time = stats.get_median_trip_time(self.route_id, self.direction_id, first_stop_id, last_stop_id)

            if trip_time is not None:
                all_speeds.append((dist / trip_time) / conversion_factor)

        return np.median(all_speeds) if len(all_speeds) > 0 else None

class RouteIntervalMetrics:
    def __init__(self, agency_metrics, route_id, rng: Range):
        self.agency_metrics = agency_metrics
        self.route_id = route_id
        self.rng = rng

    def get_direction_interval_metrics(self):
        route_config = self.agency_metrics.get_route_config(self.route_id)
        return [
            DirectionIntervalMetrics(self.agency_metrics, self.route_id, direction_id, self.rng)
            for direction_id in route_config.get_direction_ids()
        ]

class AgencyIntervalMetrics:
    def __init__(self, agency_metrics, rng: Range):
        self.agency_metrics = agency_metrics
        self.rng = rng

    def get_route_interval_metrics(self):
        agency_metrics = self.agency_metrics
        route_ids = agency_metrics.get_route_ids()

        return [
            RouteIntervalMetrics(
                agency_metrics,
                route_id,
                self.rng
            )
            for route_id in route_ids
        ]

class AgencyMetrics:
    def __init__(self, agency_id):
        self.agency_id = agency_id
        self.agency = config.get_agency(agency_id)
        self.precomputed_stats = {}
        self.route_metrics = {}
        self.date_keys = None
        self.route_configs = None

    def get_date_keys(self):
        if self.date_keys is None:
            self.date_keys = timetables.get_date_keys(self.agency_id)
        return self.date_keys

    def get_route_metrics(self, route_id):
        if route_id not in self.route_metrics:
            self.route_metrics[route_id] = RouteMetrics(self, route_id)
        return self.route_metrics[route_id]

    def get_route_configs(self):
        if self.route_configs is None:
            self.route_configs = {}
            for route in routeconfig.get_route_list(self.agency_id):
                self.route_configs[route.id] = route
        return self.route_configs

    def get_route_config(self, route_id):
        return self.get_route_configs().get(route_id, None)

    def get_precomputed_stats(self, stat_id, d: date, start_time_str, end_time_str, scheduled=False):
        if scheduled:
            date_keys = self.get_date_keys()
            date_str = str(d)
            if date_str not in date_keys:
                print(f'date {d} not in timetable', file=sys.stderr)
                return None
            stats_date = util.parse_date(date_keys[date_str])
        else:
            stats_date = d

        key = f'{stat_id}-{stats_date}-{start_time_str}-{end_time_str}-{scheduled}'
        if key not in self.precomputed_stats:
            try:
                self.precomputed_stats[key] = precomputed_stats.get_precomputed_stats(
                    self.agency_id, stat_id, stats_date,
                    start_time_str = start_time_str, end_time_str = end_time_str,
                    scheduled=scheduled
                )
            except FileNotFoundError as e:
                self.precomputed_stats[key] = None

        return self.precomputed_stats[key]

    def get_route_ids(self):
        return self.get_route_configs().keys()

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
