import pandas as pd

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