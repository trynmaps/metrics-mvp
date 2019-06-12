from datetime import datetime, date
import pytz

import pandas as pd
import numpy as np

from . import arrival_history

def get_trip_times(df: pd.DataFrame, history: arrival_history.ArrivalHistory, tz: pytz.timezone, s1: str, s2: str):
    s1_df = df.copy(deep = True)

    if s1_df.empty:
        s1_df['trip_min'] = []
        return s1_df

    s1_df = s1_df.sort_values('TIME', axis=0)

    # in case we don't see the vehicle arrive at s2 in the current run,
    # look at the next time the same vehicle arrives back at s1, only look at s2 arrivals before that time
    def find_dest_arrival_time(row):
        next_return_time = history.find_next_arrival_time(s1, row.VID, row.TIME)
        return history.find_next_arrival_time(s2, row.VID, row.TIME, next_return_time)

    s1_df['dest_arrival_time'] = s1_df.apply(find_dest_arrival_time, axis=1)
    s1_df['trip_min'] = (s1_df.dest_arrival_time - s1_df.DEPARTURE_TIME)/60

    return s1_df