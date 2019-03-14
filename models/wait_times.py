import json
import requests
from datetime import datetime, timedelta, timezone, time, date

import pandas as pd
import numpy as np


# find the smallest nonnegative waiting time
def absmin(series):
    return series[series >= 0].min()


# finds the wait times for data from a single day
def get_daily_wait_times(df, start_time, end_time, group):
    minute_range = [start_time + timedelta(minutes=i) for i in range(
        (end_time - start_time).seconds//60)]
    wait_times = pd.DataFrame(columns=[])

    for minute in minute_range:
        # TODO (jtanquil): we get this error, see if you can fix it
        # A value is trying to be set on a copy of a slice from a DataFrame.
        # Try using .loc[row_indexer,col_indexer] = value instead
        # See the caveats in the documentation: http://pandas.pydata.org/pandas-docs/stable/indexing.html#indexing-view-versus-copy
        #   df['WAIT'] = df['timestamp'].apply(lambda x: (x - minute).total_seconds())
        df['WAIT'] = df['TIME'].apply(lambda x: (x - minute).total_seconds())
        pivot = df[group + ['WAIT']].pivot_table(values = ['WAIT'], index = group, aggfunc = absmin)
        pivot['TIME'] = minute
        pivot = pivot.reset_index()
        wait_times = wait_times.append(pivot, sort = True)

    return wait_times


def get_all_wait_times(df, timespan = ("00:00", "23:59"), group = ['ROUTE']): #probably restrict timespan to when buses are actually running
    # process arrivals df
    arrivals = df.copy(deep = True)
    arrivals['DATE'] = arrivals['TIME'].apply(lambda x: x.date())

    dates = arrivals['DATE'].unique()
    avg_over_pd = pd.DataFrame(columns = group + ['DATE', 'TIME', 'WAIT'])

    for date in dates:
        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: start processing {date}.")
        start_time = datetime.strptime(f"{date.isoformat()} {timespan[0]} -0800", "%Y-%m-%d %H:%M %z")
        end_time   = datetime.strptime(f"{date.isoformat()} {timespan[1]} -0800", "%Y-%m-%d %H:%M %z")
        daily_wait = get_daily_wait_times(arrivals[arrivals['DATE'] == date], start_time, end_time, group)
        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: found waits for {date}.")
        #daily_wait = daily_wait.pivot_table(values = ['WAIT'], index = group).reset_index()
        daily_wait['DATE'] = date
        daily_wait['TIME'] = daily_wait['TIME'].apply(lambda x: x.time())
        avg_over_pd = avg_over_pd.append(daily_wait, sort = True)

    return avg_over_pd


def quantiles(series):
    return [np.percentile(series, i) for i in [5, 25, 50, 75, 95]]


def get_summary_statistics(df, group):
    waits = df.pivot_table(values = ['WAIT'], index = group, aggfunc = {'WAIT': [np.mean, np.std, quantiles]}).reset_index()
    waits.columns = ['_'.join(col) if col[0] == 'WAIT' else ''.join(col) for col in waits.columns.values]
    waits[[f"{i}th percentile" for i in [5, 25, 50, 75, 95]]] = waits['WAIT_quantiles'].apply(lambda x: pd.Series(x))
    waits = waits.drop('WAIT_quantiles', axis = 1)
    return waits


def get_avg_wait_times(df, timespan = ("05:00", "23:59"), group = ['ROUTE']): # defaulting to muni operating hours
    return get_summary_statistics(get_all_wait_times(df, timespan, group), group)

def get_average_waiting_time(waits):
    """
    Can be used to answer questions like, "what's the average waiting time at
    the 9th & Mission stop on the outbound 14 line from 9am-5pm in the last
    """
    return waits['WAIT'].mean()/60
