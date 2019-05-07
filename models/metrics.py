import math
from datetime import datetime, time, date, timedelta, timezone
import pytz

import pandas as pd
import numpy as np

from . import timetable

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

def compare_timetable_to_actual(tt: timetable.Timetable, df: pd.DataFrame, direction: str):
    try:
        stops_df = df.copy(deep = True)
        stop_id = stops_df["SID"].unique().squeeze()
        timetable = tt.get_data_frame(stop_id, direction)

        #use dummy data for now
        delta = tt.date - date(2019, 4, 8)
        stops_df["headway"] = compute_headway_minutes(stops_df)
        stops_df["TIME"] = stops_df["TIME"].apply(lambda x: datetime.fromtimestamp(x, tz = timezone(timedelta(hours = -7))) + delta)

        def get_closest_nonnegative_timetable_time(dt: datetime):
            deltas = dt - timetable["arrival_time"]
            nonnegative_deltas = deltas[deltas.apply(lambda x: x.total_seconds() > 0)]
            
            return timetable.iloc[nonnegative_deltas.idxmin()].arrival_time if len(nonnegative_deltas) > 0 else np.nan

        def get_closest_timetable_time(dt: datetime):
            deltas = (timetable["arrival_time"] - dt).apply(lambda x: abs(x.total_seconds()))
            return timetable.iloc[deltas.idxmin()].arrival_time if ~np.isnan(deltas.idxmin()) else np.nan

        def get_corresponding_scheduled_headway(s: pd.Series):
            return pd.Series({
                "closest_scheduled_headway": timetable[timetable["arrival_time"] == s.closest_scheduled_arrival].arrival_headway.values[0],
                "closest_first_after_headway": timetable[timetable["arrival_time"] == s.first_scheduled_after_arrival].arrival_headway.values[0]
            })

        stops_df["closest_scheduled_arrival"] = stops_df["TIME"].apply(get_closest_timetable_time)
        stops_df["first_scheduled_after_arrival"] = stops_df["TIME"].apply(get_closest_nonnegative_timetable_time)

        stops_df["closest_delta"] = stops_df["TIME"] - stops_df["closest_scheduled_arrival"]
        stops_df["first_after_delta"] = stops_df["TIME"] - stops_df["first_scheduled_after_arrival"]
        stops_df[["closest_delta", "first_after_delta"]] = stops_df[["closest_delta", "first_after_delta"]].applymap(lambda x: x.total_seconds()/60 if isinstance(x, timedelta) else np.nan)

        stops_df[["closest_scheduled_headway", "closest_first_after_headway"]] = stops_df.apply(get_corresponding_scheduled_headway, axis = "columns")
        stops_df[["closest_scheduled_headway", "closest_first_after_headway"]] = stops_df[["closest_scheduled_headway", "closest_first_after_headway"]].applymap(lambda x: x.total_seconds()/60 if isinstance(x, timedelta) else np.nan)
        
        stops_df["closest_headway_delta"] = stops_df["headway"] - stops_df["closest_scheduled_headway"]
        stops_df["first_headway_delta"] = stops_df["headway"] - stops_df["closest_first_after_headway"]

        stops_df = stops_df.rename(mapper = {"TIME": "actual_arrival_time"}, axis = "columns")
        
        return stops_df[["actual_arrival_time", "closest_scheduled_arrival", "closest_delta", "first_scheduled_after_arrival", "first_after_delta", "headway", "closest_scheduled_headway", "closest_headway_delta",  "closest_first_after_headway", "first_headway_delta"]]
    except Exception as err:
        print(f"Error occurred while comparing timetable and actual data: {repr(err)}")
        return pd.DataFrame()

# compute the percentage of elements x in a numerical series such that |x| <= threshold
def percent_within_abs_threshold(s: pd.Series, threshold: float):
    return len(s[abs(s) <= threshold])/len(s) * 100

def compare_delta_metrics(s: pd.Series, threshold: float):
    return {
        f"on-time rate (at most {threshold} minutes late)": len(s[(s <= threshold) & (s > 0)])/len(s) * 100,
        "early rate": len(s[s < 0])/len(s) * 100,
        f"late rate (more than {threshold} minutes late)": len(s[s > threshold])/len(s) * 100
    }
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