import json
import requests
import pytz
from datetime import datetime, timedelta, time 

import pandas as pd
import numpy as np

from . import timetable, util


# assumes we have a df from one route, one stop, one direction
def get_waits(df: pd.DataFrame, d: str, tz: pytz.timezone, route: str, start_time = None, end_time = None):
    # for each arrival time, rounding down to the nearest minute gives us the
    # corresponding minute for which that arrival is first arrival
    waits = df['TIME'].copy(deep = True)
    waits = pd.DataFrame({"ARRIVAL" : waits,
                          "TIME_FLOOR" : waits - (waits % 60)})
    # get corresponding timetable to determine the time interval for which to compute wait times
    stop_id = "1" + df["SID"][0]
    route_timetable = timetable.get_timetable(route, stop_id, d)
    first_bus = route_timetable["DATE_TIME"].min().replace(second = 0).time()
    last_bus = route_timetable["DATE_TIME"].max().replace(second = 0).time()

    # get the minute range in timestamp form
    # truncate time interval to minute before first bus/minute after last bus leave
    if start_time is None or \
        (start_time is not None and (time.fromisoformat(start_time) < first_bus)):
        start_time = first_bus.isoformat()[:-3]

    if end_time is None or \
        (end_time is not None and (time.fromisoformat(end_time) > last_bus)):
        end_time = last_bus.isoformat()[:-3]
        
    start_timestamp = util.get_localized_datetime(f"{d} {start_time}").timestamp()
    end_timestamp = util.get_localized_datetime(f"{d} {end_time}").timestamp()
        
    minutes_range = [start_timestamp + (60 * i) for i in range(int((end_timestamp - start_timestamp)/60))]
    
    # the remaining first arrivals can be obtained by joining the existing waits to a df
    # containing the rest of the timestamps and backfilling
    all_waits = pd.DataFrame({'TIME' : minutes_range}).join(waits.set_index('TIME_FLOOR'), on = 'TIME', how = 'outer')
    all_waits['ARRIVAL'] = all_waits['ARRIVAL'].fillna(method = 'bfill')
    all_waits.index = [datetime.fromtimestamp(t, tz = tz).time() for t in all_waits['TIME']]
    
    # TODO: deal with NaN values at end of the day
    return all_waits