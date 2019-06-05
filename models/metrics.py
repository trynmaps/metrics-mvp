import math
import pytz
import sys
from . import wait_times, util, arrival_history, trip_times, errors

import pandas as pd
import numpy as np

ROUND_DIGITS = 3
DEFAULT_STAT_KEYS = ['count', 'avg', 'min', 'median', 'max']

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

            wait_stats = wait_times.get_stats(df['TIME'].values, start_time, end_time)

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
            data['count'] = 100 # percent

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

    def get_trip_time_stats(self, direction_id, start_stop_id, end_stop_id, rng: Range, keys=DEFAULT_STAT_KEYS):

        completed_trips_arr = []

        if end_stop_id is None:
            return None

        for d in rng.dates:
            history = self.get_arrival_history(d)
            df = self.get_data_frame(d, stop_id=start_stop_id, direction_id=direction_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            if start_time is not None:
                df = df[df['TIME'] >= start_time]

            if end_time is not None:
                df = df[df['TIME'] < end_time]

            trips = trip_times.get_trip_times(df, history, rng.tz, start_stop_id, end_stop_id)
            completed_trips_arr.append(trips.trip_min[trips.trip_min.notnull()].values)

        completed_trips = np.concatenate(completed_trips_arr)

        return self.get_array_stats(completed_trips, keys)

    def get_headway_min_stats(self, direction_id, stop_id, rng: Range, keys=DEFAULT_STAT_KEYS):

        headway_min_arr = []

        for d in rng.dates:
            history = self.get_arrival_history(d)
            df = self.get_data_frame(d, stop_id=stop_id, direction_id=direction_id)

            start_time = util.get_timestamp_or_none(d, rng.start_time_str, rng.tz)
            end_time = util.get_timestamp_or_none(d, rng.end_time_str, rng.tz)

            time_values = df['TIME'].values

            headway_min = compute_headway_minutes(time_values, start_time, end_time)

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