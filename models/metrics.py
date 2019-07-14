import math
import pytz
import sys
from . import wait_times, util, arrival_history, trip_times, errors, timetable, constants

import pandas as pd
import numpy as np

ROUND_DIGITS = 3
DEFAULT_STAT_KEYS = ['count', 'avg', 'min', 'median', 'max', 'percentiles', 'histogram']

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
# It also allows the client to fetch only the desired stats. Supported
# stats for headways, wait times, and trip times include:
#
#   count
#   avg
#   std (not implemented for wait times)
#   min
#   median
#   max
#   percentiles
#   histogram
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

    def get_data_frame(self, d, stop_id=None, direction_id=None):
        key = f'{str(d)}_{stop_id}_{direction_id}'

        if key in self.data_frames:
            return self.data_frames[key]

        history = self.get_arrival_history(d)

        print(f'loading data frame {key} for route {self.route_id}', file=sys.stderr)

        df = history.get_data_frame(stop_id=stop_id, direction_id=direction_id)
        self.data_frames[key] = df
        return df

    def get_route_timetable(self, d):
        if d.isoformat() not in self.timetables.keys():
            self.timetables[d.isoformat()] = timetable.get_timetable_from_csv(self.agency_id, self.route_id, d)

        return self.timetables[d.isoformat()]

    def get_stop_timetable(self, d, stop_id, direction_id):
        tt = self.get_route_timetable(d)
        timetable_key = f'{str(d)}_{stop_id}_{direction_id}_timetable'
        
        if timetable_key not in self.data_frames:
            self.data_frames[timetable_key] = tt.get_data_frame(stop_id, direction_id)
        
        return self.data_frames[timetable_key]
    
    def get_comparison_to_timetable(self, d, stop_id=None, direction_id=None):
        stop_timetable = self.get_stop_timetable(d, stop_id, direction_id)
        stop_arrivals = self.get_data_frame(d, stop_id, direction_id)

        # first headway is always nan
        arrival_headways = np.insert(compute_headway_minutes(stop_arrivals['TIME'].to_numpy()), 0, np.nan)
        stop_arrivals['headway'] = arrival_headways

        # for each scheduled arrival time, get the closest actual arrival (earlier or later), the next actual arrival, and the corresponding headways
        def get_adjacent_arrival_times(scheduled_arrivals, arrivals, arrival_headways):
            next_arrival_indices = np.searchsorted(arrivals, scheduled_arrivals)
            arrivals_padded = np.r_[arrivals, np.nan]
            headways_padded = np.r_[arrival_headways, np.nan]
            next_arrivals = arrivals_padded[next_arrival_indices]
            next_headways = headways_padded[next_arrival_indices]
            next_abs = np.absolute(next_arrivals - scheduled_arrivals)

            previous_arrivals = np.r_[np.nan, arrivals][next_arrival_indices]
            previous_headways = np.r_[np.nan, arrival_headways][next_arrival_indices]
            previous_abs = np.absolute(previous_arrivals - scheduled_arrivals)

            # compare the delta between scheduled arrival and next arrival to delta between scheduled arrival and previous arrival
            # replace nan values with the length of day (in seconds) to prevent runtime error and guarantee that the other value is smaller
            np.place(next_abs, np.isnan(next_abs), 86400)
            np.place(previous_abs, np.isnan(previous_abs), 86400)
            comparison = next_abs < previous_abs

            # returns, in order: next arrival, next headway, closest arrival, closest headway
            return next_arrivals, next_headways, np.where(comparison, next_arrivals, previous_arrivals), np.where(comparison, next_headways, previous_headways)

        next_arrivals, next_headways, closest_arrivals, closest_headways = get_adjacent_arrival_times(stop_timetable['arrival_time'].values, stop_arrivals['TIME'].values, arrival_headways)

        next_arrival_deltas = next_arrivals - stop_timetable['arrival_time'].values
        stop_timetable['next_arrival'] = next_arrivals
        stop_timetable['next_arrival_delta'] = next_arrival_deltas
        stop_timetable['next_arrival_headway'] = next_headways

        closest_deltas = closest_arrivals - stop_timetable['arrival_time'].values
        stop_timetable['closest_arrival'] = closest_arrivals
        stop_timetable['closest_arrival_delta'] = closest_deltas
        stop_timetable['closest_arrival_headway'] = closest_headways

        return stop_timetable[['arrival_time', 'arrival_headway', 'next_arrival', 'next_arrival_delta', 'next_arrival_headway', 'closest_arrival', 'closest_arrival_delta', 'closest_arrival_headway']] 
        
    def get_wait_time_stats(self, direction_id, stop_id, rng: Range, keys=DEFAULT_STAT_KEYS):
        averages = []

        needs_histogram = ('histogram' in keys)
        needs_avg = ('avg' in keys)

        if needs_histogram:
            histograms = []
            bin_size = 5
            bin_min = 0
            bin_max = 90
            bins = range(bin_min, bin_max + bin_size, bin_size)

        percentiles = range(0, 101, 5)

        percentile_values_arr = []

        for d in rng.dates:
            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            df = self.get_data_frame(d, stop_id=stop_id, direction_id=direction_id)

            departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

            wait_stats = wait_times.get_stats(departure_time_values, start_time, end_time)

            percentile_values = wait_stats.get_percentiles(percentiles)
            if percentile_values is not None:
                percentile_values_arr.append(percentile_values)

            if needs_histogram:
                histogram = wait_stats.get_histogram(bins)
                if histogram is not None:
                    histograms.append(histogram * 100) # convert to percentages

            if needs_avg:
                avg = wait_stats.get_average()
                if avg is not None:
                    averages.append(avg)

        data = {}

        if 'count' in keys:
            # account for the case where the time interval had no arrivals to sample (and therefore no percentile values)
            data['count'] = 0 if len(percentile_values_arr) == 0 else 100 # percent

        if 'avg' in keys and len(averages) > 0:
            data['avg'] = round(np.average(averages), ROUND_DIGITS)

        if len(percentile_values_arr) > 0:
            # todo handle multiple days
            percentile_values = percentile_values_arr[0]

            if 'min' in keys:
                data['min'] = round(percentile_values[0], ROUND_DIGITS)

            if 'median' in keys:
                data['median'] = round(percentile_values[10], ROUND_DIGITS)

            if 'max' in keys:
                data['max'] = round(percentile_values[20], ROUND_DIGITS)

            if 'percentiles' in keys:
                data['percentiles'] = self.get_percentiles_data(percentiles, percentile_values)

        if needs_histogram and len(histograms) > 0:
            # todo handle multiple days
            histogram = histograms[0]

            nonzero_buckets = np.nonzero(histogram)[0]

            if len(nonzero_buckets) > 0:
                histogram_end_index = nonzero_buckets[-1] + 1
            else:
                histogram_end_index = 0

            histogram = histogram[0:histogram_end_index]
            bins = bins[0:histogram_end_index]

            data['histogram'] = self.get_histogram_data(histogram, bins, bin_size)

        return data

    def get_timetable_headway_stats(self, direction_id, stop_id, rng: Range, keys = DEFAULT_STAT_KEYS):

        timetable_headways_arr = []

        for d in rng.dates:
            df = self.get_stop_timetable(d, stop_id, direction_id)
            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                df = df[df['arrival_time'] >= start_time]
            
            if end_time is not None:
                df = df[df['arrival_time'] < end_time]

            timetable_headways_arr.append(df['arrival_headway'].dropna().values)

        all_timetable_headways = np.concatenate(timetable_headways_arr)

        return self.get_array_stats(all_timetable_headways, keys)

    def get_timetable_comparison_stats(self, direction_id, stop_id, rng: Range, keys = DEFAULT_STAT_KEYS):

        compared_timetable_arr = []

        for d in rng.dates:
            df = self.get_comparison_to_timetable(d, stop_id, direction_id)
            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                df = df[df['arrival_time'] >= start_time]

            if end_time is not None:
                df = df[df['arrival_time'] < end_time]

            compared_timetable_arr.append(df[["next_arrival_delta", "closest_arrival_delta"]])

        # get array stats and threshold stats for deltas
        # returns stats in minutes
        all_compared_timetable_data = pd.concat(compared_timetable_arr)
        return {
            "next_arrival_delta_stats": self.get_array_stats(all_compared_timetable_data["next_arrival_delta"].dropna().values/60, keys),
            "closest_arrival_delta_stats": self.get_array_stats(all_compared_timetable_data["closest_arrival_delta"].values/60, keys)
        }

    def get_trip_time_stats(self, direction_id, start_stop_id, end_stop_id, rng: Range, keys=DEFAULT_STAT_KEYS):

        completed_trips_arr = []

        if end_stop_id is None:
            return None

        for d in rng.dates:
            history = self.get_arrival_history(d)
            s1_df = self.get_data_frame(d, stop_id=start_stop_id, direction_id=direction_id)
            s2_df = self.get_data_frame(d, stop_id=end_stop_id, direction_id=direction_id)

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

        completed_trips = np.concatenate(completed_trips_arr)

        return self.get_array_stats(completed_trips, keys)

    def get_headway_min_stats(self, direction_id, stop_id, rng: Range, keys=DEFAULT_STAT_KEYS):

        headway_min_arr = []

        for d in rng.dates:
            history = self.get_arrival_history(d)
            df = self.get_data_frame(d, stop_id=stop_id, direction_id=direction_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            departure_time_values = np.sort(df['DEPARTURE_TIME'].values)

            headway_min = compute_headway_minutes(departure_time_values, start_time, end_time)

            headway_min_arr.append(headway_min)

        headway_min = np.concatenate(headway_min_arr)

        return self.get_array_stats(headway_min, keys)

    def get_histogram_data_for_array(self, values):
        bin_size = 5
        percentile_values = np.percentile(values, [0, 100])

        bin_min = 0 # math.floor(percentile_values[0] / bin_size) * bin_size
        bin_max = math.ceil(percentile_values[-1] / bin_size) * bin_size + bin_size
        bins = range(bin_min, bin_max, bin_size)

        histogram, bin_edges = np.histogram(values, bins)

        return self.get_histogram_data(histogram, bins, bin_size)

    def get_histogram_data(self, histogram, bins, bin_size):
        return [{
                "value": f'{bin}-{bin+bin_size}',
                "count": round(float(count), ROUND_DIGITS),
                "bin_start": bin,
                "bin_end": bin + bin_size
            }
          for bin, count in zip(bins, histogram)]

    def get_percentiles_data_for_array(self, values):
        percentiles = range(0, 101, 5)
        percentile_values = np.percentile(values, percentiles)
        return self.get_percentiles_data(percentiles, percentile_values)

    def get_percentiles_data(self, percentiles, percentile_values):
        return [{"percentile": percentile, "value": round(value, ROUND_DIGITS)}
            for percentile, value in zip(percentiles, percentile_values)]

    def get_array_stats(self, values, keys):
        data = {}

        if 'count' in keys:
            data['count'] = len(values)

        if len(values) > 0:
            if 'avg' in keys:
                data['avg'] = round(np.average(values), ROUND_DIGITS)

            if 'std' in keys:
                data['std'] = round(np.std(values), ROUND_DIGITS)

            if ('min' in keys) or ('median' in keys) or ('max' in keys):
                quantiles = np.quantile(values, [0,0.5,1])

                if 'min' in keys:
                    data['min'] = round(quantiles[0], ROUND_DIGITS)

                if 'median' in keys:
                    data['median'] = round(quantiles[1], ROUND_DIGITS)

                if 'max' in keys:
                    data['max'] = round(quantiles[2], ROUND_DIGITS)

            if 'percentiles' in keys:
                data['percentiles'] = self.get_percentiles_data_for_array(values)

            if 'histogram' in keys:
                data['histogram'] = self.get_histogram_data_for_array(values)

        return data

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

def compare_delta_metrics(s: pd.Series, thresholds: list):
    no_nan = s.dropna()

    return {
        f"on-time rate (at most {thresholds[0]} minutes late)": len(no_nan[(no_nan <= thresholds[0]) & (no_nan >= 0)])/len(no_nan) * 100,
        "early rate": len(no_nan[no_nan < 0])/len(no_nan) * 100,
        f"gap percentage (more than {thresholds[0]} minutes late)": len(no_nan[no_nan > thresholds[0]])/len(no_nan) * 100,
        f"late percentage (between {thresholds[0]} and {thresholds[1]} minutes late)": len(no_nan[(no_nan > thresholds[0]) & (no_nan <= thresholds[1])])/len(no_nan) * 100,
        f"very late percentage (more than {thresholds[1]} minutes late)": len(no_nan[no_nan > thresholds[1]])/len(no_nan) * 100
    }