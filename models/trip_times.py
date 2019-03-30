from datetime import datetime, date
import pytz

import pandas as pd
import numpy as np

from . import arrival_history


def get_trip_times(history: arrival_history.ArrivalHistory, tz: pytz.timezone, start_time_str: str,                           end_time_str: str, s1: str, s2: str):
    s1_df = history.get_data_frame(stop_id=s1, tz=tz, start_time_str=start_time_str, end_time_str=end_time_str)

    if s1_df.empty:
        return s1_df

    s1_df = s1_df.sort_values('TIME', axis=0)

    # in case we don't see the vehicle arrive at s2 in the current run,
    # look at the next time the same vehicle arrives back at s1, only look at s2 arrivals before that time
    def find_dest_arrival_time(row):
        next_return_time = history.find_next_arrival_time(s1, row.VID, row.TIME)
        return history.find_next_arrival_time(s2, row.VID, row.TIME, next_return_time)

    s1_df['dest_arrival_time'] = s1_df.apply(find_dest_arrival_time, axis=1)
    s1_df['trip_min'] = (s1_df.dest_arrival_time - s1_df.TIME)/60
    s1_df['dest_arrival_time_str'] = s1_df['dest_arrival_time'].apply(lambda timestamp: datetime.fromtimestamp(timestamp, tz).time() if not np.isnan(timestamp) else None)

    return s1_df