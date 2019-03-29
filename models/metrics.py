import pandas as pd
import numpy as np
import math
from . import wait_times

def get_histogram(df: pd.Series, bin_size: int):
    percentiles = range(0, 101, bin_size)
    percentile_values = np.percentile(df, percentiles)

    bin_min = math.floor(percentile_values[0] / bin_size) * bin_size
    bin_max = math.ceil(percentile_values[-1] / bin_size) * bin_size + bin_size
    bins = range(bin_min, bin_max, bin_size)

    histogram, bin_edges = np.histogram(df, bins)

    return [{"value": f"{bin} - {bin + bin_size - 1}", "count": int(count)}
      for bin, count in zip(bins, histogram)]

def get_percentiles(df: pd.Series, bin_size: int):
    percentiles = range(0, 101, bin_size)
    percentile_values = np.percentile(df, percentiles)

    return [{"percentile": percentile, "value": value}
      for percentile, value in zip(percentiles, percentile_values)]

def compute_wait_times(df: pd.DataFrame):
    return (df["ARRIVAL"] - df["TIME"])/60

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