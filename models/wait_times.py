import json
import requests
import pytz
from datetime import datetime, date, timedelta, time

import pandas as pd
import numpy as np

from . import timetable, util

# assumes we have a df from one route, one stop, one direction
def get_waits(df: pd.DataFrame, d: date, tz: pytz.timezone, route: str, start_time_str = None, end_time_str = None):
    # for each arrival time, rounding down to the nearest minute gives us the
    # corresponding minute for which that arrival is first arrival
    waits = df['TIME'].copy(deep = True)
    waits = pd.DataFrame({"ARRIVAL" : waits,
                          "TIME_FLOOR" : waits - (waits % 60)})
    # get corresponding timetable to determine the time interval for which to compute wait times
    # TODO: get stop_id from route_config (enable route_config to do this)
    stop_id = "1" + df["SID"][0]
    route_timetable = timetable.get_timetable(route, stop_id, d)
    first_bus = route_timetable["DATE_TIME"].min().replace(second = 0)
    last_bus = route_timetable["DATE_TIME"].max().replace(second = 0)

    # get the minute range in timestamp form
    # truncate time interval to minute before first bus/minute after last bus leave
    if start_time_str is None or \
        (start_time_str is not None and (time.fromisoformat(start_time_str) < first_bus.time())):
        start_timestamp = first_bus.timestamp()
    else:
        start_timestamp = util.get_localized_datetime(d, start_time_str).timestamp()

    if end_time_str is None or \
        (end_time_str is not None and (time.fromisoformat(end_time_str) > last_bus.time())):
        end_timestamp = last_bus.timestamp()
    else:
        end_timestamp = util.get_localized_datetime(d, end_time_str).timestamp()

    minutes_range = [start_timestamp + (60 * i) for i in range(int((end_timestamp - start_timestamp)/60))]

    # the remaining first arrivals can be obtained by joining the existing waits to a df
    # containing the rest of the timestamps and backfilling
    all_waits = pd.DataFrame({'DATE_TIME' : minutes_range}).join(waits.set_index('TIME_FLOOR'), on = 'DATE_TIME', how = 'outer').sort_values("DATE_TIME")
    all_waits['ARRIVAL'] = all_waits['ARRIVAL'].fillna(method = 'bfill')
    all_waits.index = [datetime.fromtimestamp(t, tz = tz).time() for t in all_waits['DATE_TIME']]

    return all_waits