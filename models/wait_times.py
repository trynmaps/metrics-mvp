import json
import requests
import pytz
from datetime import datetime, date, timedelta, time

import pandas as pd
import numpy as np

from . import timetable, util, nextbus

# assumes we have a df from one route, one stop, one direction
def get_waits(df: pd.DataFrame, stopinfo: nextbus.StopInfo, d: date, tz: pytz.timezone, route: str, start_time_str = None, end_time_str = None):
    # for each arrival time, rounding down to the nearest minute gives us the
    # corresponding minute for which that arrival is first arrival
    waits = df['TIME'].copy(deep = True)
    waits = pd.DataFrame({"ARRIVAL" : waits,
                          "TIME_FLOOR" : waits - (waits % 60)})

    # stop_id = stopinfo.location_id
    # route_timetable = timetable.get_timetable(route, stop_id, d)
    first_bus = df["TIME"].min()
    last_bus = df["TIME"].max()

    # get the minute range in timestamp form
    # truncate time interval to minute before first bus/minute after last bus leave
    if start_time_str is None:
        start_timestamp = first_bus
    else:
        start_timestamp = max(first_bus, util.get_localized_datetime(d, start_time_str).timestamp())

    if end_time_str is None:
        end_timestamp = last_bus
    else:
        end_timestamp = min(last_bus, util.get_localized_datetime(d, end_time_str).timestamp())

    minutes_range = [start_timestamp + (60 * i) for i in range(int((end_timestamp - start_timestamp)/60))]

    # the remaining first arrivals can be obtained by joining the existing waits to a df
    # containing the rest of the timestamps and backfilling
    all_waits = pd.DataFrame({'DATE_TIME' : minutes_range}) \
        .join(waits.set_index('TIME_FLOOR'), on = 'DATE_TIME', how = 'outer').sort_values("DATE_TIME")
    all_waits['ARRIVAL'] = all_waits['ARRIVAL'].fillna(method = 'bfill')
    all_waits.index = [datetime.fromtimestamp(t, tz = tz).time() for t in all_waits['DATE_TIME']]

    return all_waits