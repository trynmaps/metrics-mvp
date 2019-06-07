from datetime import datetime, date, time, timedelta
import pytz
import json

import pandas as pd
import numpy as np

from constants import AGENCY, PACIFIC_TIMEZONE, DEFAULT_TIME_STR_INTERVALS
from models import util, arrival_history, nextbus, wait_times, trip_times, metrics

# implement after timetable stats can be computed
def fetch_timetables(params: dict, rc: nextbus.RouteConfig):
    return {
        'hi': 'hi'
    }

def fetch_headways(params: dict, rc: nextbus.RouteConfig):
    dates = util.get_dates_in_range(params['start_date_str'], params['end_date_str'])
    headways = []

    for d in dates:
        try:
            history = arrival_history.get_by_date(AGENCY, params['route_id'], d)
            df = history.get_data_frame(params['stop_id'], tz = PACIFIC_TIMEZONE, direction_id = params['direction_id'], start_time_str = params['start_time_str'], end_time_str = params['end_time_str'])

            df['headway_min'] = metrics.compute_headway_minutes(df)
            df['headway_min'] = df.headway_min[df.headway_min.notnull()] # remove NaN row (first bus of the day)
            headways.append(df.headway_min)
        except FileNotFoundError:
            raise FileNotFoundError
        except IndexError:
            raise IndexError
    
    return pd.concat(headways)

def fetch_wait_times(params: dict, rc: nextbus.RouteConfig):
    dates = util.get_dates_in_range(params['start_date_str'], params['end_date_str'])
    stop_info = rc.get_stop_info(params['stop_id'])
    waits = []

    for d in dates:
        try:
            history = arrival_history.get_by_date(AGENCY, params['route_id'], d)
            df = history.get_data_frame(params['stop_id'], tz = PACIFIC_TIMEZONE, direction_id = params['direction_id'], start_time_str = params['start_time_str'], end_time_str = params['end_time_str'])

            waits.append(wait_times.get_waits(df, stop_info, d, PACIFIC_TIMEZONE, params['route_id'], params['start_time_str'], params['end_time_str']))
        except FileNotFoundError:
            raise FileNotFoundError
        except IndexError:
            raise IndexError
    
    return pd.concat(waits)

def fetch_trip_times(params: dict, rc: nextbus.RouteConfig):
    dates = util.get_dates_in_range(params['start_date_str'], params['end_date_str'])
    trips = []

    for d in dates:
        try:
            history = arrival_history.get_by_date(AGENCY, params['route_id'], d)
            df = history.get_data_frame(params['start_stop_id'], tz = PACIFIC_TIMEZONE, direction_id = params['direction_id'], start_time_str = params['start_time_str'], end_time_str = params['end_time_str'])
            daily_trips = trip_times.get_trip_times(df, history, PACIFIC_TIMEZONE, params['start_stop_id'], params['end_stop_id'])
            
            trips.append(daily_trips.trip_min[daily_trips.trip_min.notnull()])
        except FileNotFoundError:
            raise FileNotFoundError
        except IndexError:
            raise IndexError

    return pd.concat(trips)