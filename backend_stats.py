from datetime import date, time, timedelta
from flask import Response

import pandas as pd
import numpy as np

from models import metrics, util, nextbus
from constants import AGENCY, PACIFIC_TIMEZONE
from backend_data import fetch_wait_times, fetch_headways, fetch_trip_times

# package up stats
def fetch_wait_times_stats(params: dict, rc: nextbus.RouteConfig):
    df = fetch_wait_times(params, rc)
    wait_times_stats = metrics.get_wait_times_stats(df, PACIFIC_TIMEZONE) if len(df) > 0 else {
        'error': f"No wait times found."
    }

    return wait_times_stats

def fetch_headways_stats(params: dict, rc: nextbus.RouteConfig):
    df = fetch_headways(params, rc)
    headways_stats = metrics.get_headways_stats(df) if len(df) > 0 else {
        'error': f"No headways found."
    }

    return headways_stats

# implement after timetable stats can be computed
def fetch_timetables_stats(params: dict, rc: nextbus.RouteConfig):
    return {
        'hi': 'hi'
    }

def fetch_trip_times_stats(params: dict, rc: nextbus.RouteConfig):
    df = fetch_trip_times(params, rc)
    trip_times_stats = metrics.get_trip_times_stats(df, params['start_stop_id'], params['end_stop_id']) if len(df) > 0 else {
        'error': f"No trip times found."
    }

    return trip_times_stats