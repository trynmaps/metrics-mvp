import json
import requests
from datetime import datetime, timedelta, timezone, time, date
import pandas as pd
import numpy as np


# assumes we have a df from one route, one stop, one direction
def get_wait_times(df: pd.DataFrame, date: str, start_time: str):
    # for each arrival time, rounding down to the nearest minute gives us the
    # corresponding minute for which that arrival is first arrival
    pst = timezone(timedelta(hours = -8))
    waits = df['TIME'].copy(deep = True)
    waits = pd.DataFrame({"ARRIVAL" : waits,
                          "TIME_FLOOR" : waits - (waits % 60)})
    
    # get the minute range in timestamp form
    # end time is determined by the last time in the df
    end_time = str(datetime.fromtimestamp(waits.max()[0], tz = pst).replace(second = 0).time())
    start_timestamp = datetime.strptime(f"{date} {start_time} -0800", "%Y-%m-%d %H:%M %z").timestamp()
    end_timestamp = datetime.strptime(f"{date} {end_time} -0800", "%Y-%m-%d %H:%M:%S %z").timestamp()
    # account for end_time being 12-3 AM of the next day
    if end_time[0:2] in ["00", "01", "02"]:
        end_timestamp += 86400
        
    minutes_range = [start_timestamp + (60 * i) for i in range(int((end_timestamp - start_timestamp)/60))]
    
    # the remaining first arrivals can be obtained by joining the existing waits to a df
    # containing the rest of the timestamps and backfilling
    all_waits = pd.DataFrame({'TIME' : minutes_range}).join(waits.set_index('TIME_FLOOR'), on = 'TIME', how = 'outer')
    all_waits['ARRIVAL'] = all_waits['ARRIVAL'].fillna(method = 'bfill')
    all_waits.index = [datetime.fromtimestamp(t, tz = pst).time() for t in all_waits['TIME']]

    # return the wait times in minutes
    return (all_waits['ARRIVAL'] - all_waits['TIME'])/60