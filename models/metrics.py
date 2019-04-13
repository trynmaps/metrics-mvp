import math
from datetime import datetime, time
import pytz

import pandas as pd
import numpy as np

def get_bin_size(df: pd.Series):
    # uses Freedman-Diaconis rule to obtain bin size, then take the ceiling for integer bin edges
    # other possible methods: https://en.wikipedia.org/wiki/Histogram#Number_of_bins_and_width
    iqr = np.percentile(df, 75) - np.percentile(df, 25)
    bin_size = math.ceil(2 * iqr/(len(df) ** (1/3)))

    return bin_size

def get_histogram(df: pd.Series):
    bin_size = 5 # get_bin_size(df)
    percentile_values = np.percentile(df, [0, 100])

    bin_min = 0 # math.floor(percentile_values[0] / bin_size) * bin_size
    bin_max = math.ceil(percentile_values[-1] / bin_size) * bin_size + bin_size
    bins = range(bin_min, bin_max, bin_size)

    histogram, bin_edges = np.histogram(df, bins)

    return [{"value": f"{bin}-{bin + bin_size}", "count": int(count)}
      for bin, count in zip(bins, histogram)]

def get_percentiles(df: pd.Series):
    percentiles = range(0, 101, 5)
    percentile_values = np.percentile(df, percentiles)

    return [{"percentile": percentile, "value": value}
      for percentile, value in zip(percentiles, percentile_values)]

def get_series_stats(df: pd.Series):
    percentiles = get_percentiles(df)
    return {
      'count': len(df),
      'avg': np.average(df),
      'std': np.std(df),
      'min': percentiles[0]['value'],
      'median': percentiles[10]['value'],
      'max': percentiles[20]['value'],
      'histogram': get_histogram(df),
      'percentiles': percentiles,
    } if len(df) > 0 else {
        'count': 0,
        'avg': None,
        'std': None,
        'histogram': None,
        'percentiles': None,
    }

def get_wait_times_stats(df: pd.DataFrame, tz: pytz.timezone):
    first_bus = datetime.fromtimestamp(df["ARRIVAL"].min(), tz = tz)
    last_bus = datetime.fromtimestamp(df["ARRIVAL"].max(), tz = tz)
    wait_lengths = compute_wait_times(df).dropna()

    return {
        **{
            'first_bus': first_bus.time().isoformat(),
            'last_bus': last_bus.time().isoformat(),
        },
        **get_series_stats(wait_lengths)
    }

def get_trip_times_stats(df: pd.DataFrame, start_stop: str, end_stop: str):
    return {
        **{
            'start_stop': start_stop,
            'end_stop': end_stop,
        },
        **get_series_stats(df.dropna())
    }

def get_headways_stats(df: pd.Series):
    return get_series_stats(df.dropna())

def compute_wait_times(df: pd.DataFrame):
    return (df["ARRIVAL"] - df["DATE_TIME"])/60

def compute_headway_minutes(df: pd.DataFrame):
    return ((df.TIME - df.TIME.shift(1))/60)

def filter_by_time_of_day(df: pd.DataFrame, start_time_str, end_time_str) -> pd.DataFrame:
    if start_time_str is not None:
        df = df[df.TIME_STR >= start_time_str]
    if end_time_str is not None:
        df = df[df.TIME_STR < end_time_str]
    return df

"""
josh's comments

  # For
  #  - last weekday
  #  - last weekend day
  #  - last full work week
  #  - last full weekend
  #  - this month
  #  - last month
  #  - last 3 months
  #  - last year
  #  - last 5 years
  #  calculate average for each time_buckets
  #  calculate variability of each time buckets
  #  include comparison of actual to scheduled

# """