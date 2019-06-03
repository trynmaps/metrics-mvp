from flask import request, Response
from datetime import datetime, date, time, timedelta
import pytz
import json

import pandas as pd
import numpy as np

from constants import AGENCY, PACIFIC_TIMEZONE, DEFAULT_TIME_STR_INTERVALS
from models import metrics, arrival_history, nextbus, util, wait_times, trip_times
from backend_util import get_params, validate_params, process_params
from backend_stats import fetch_timetables_stats, fetch_headways_stats, fetch_trip_times_stats, fetch_wait_times_stats

def fetch_data():
    start_time = datetime.now()
    params = get_params()
    params_validation = validate_params(params, True)

    if params_validation is not None:
        data = {
            'params': params,
            'missing_values': params_validation['missing_params'],
            'invalid_values': params_validation['invalid_params']
        }

        end_time = datetime.now()
        data['processing_time'] = (end_time - start_time)/timedelta(seconds = 1)

        return Response(json.dumps(data, indent = 2), status = 400, mimetype = 'application/json')
    else:
        processed_params = process_params(params)
        data = {
            **{
                'params': processed_params,
            },
            **fetch_intervals(processed_params)
        }

        return Response(json.dumps(data, indent = 2), mimetype = 'application/json')

def get_intervals(start_time_str: str, end_time_str: str, interval: str):
    if interval == False:
        # if interval is False, then the entire time range is treated as one interval
        return [{
            'start_time': start_time_str,
            'end_time': end_time_str
        }]
    else:
        # if interval is True, then use default intervals
        # else, interval is an int n, so the interval length is n hours
        if isinstance(interval, bool):
            time_intervals = DEFAULT_TIME_STR_INTERVALS
        else:
            interval_length = timedelta(seconds = 3600 * interval)

            # round down start and end time to allow for even intervals
            start_time = datetime.strptime(start_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)
            end_time = datetime.strptime(end_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)

            time_intervals = []

            while start_time.hour < end_time.hour:
                interval_start = start_time
                # if the next interval would go beyond the given time range, just cut it off
                interval_end = start_time + interval_length
                if interval_end > end_time:
                    interval_end = end_time

                time_intervals.append({
                    'start_time': interval_start.strftime('%H:%M'),
                    'end_time': interval_end.strftime('%H:%M')
                })
                
                start_time += interval_length

        return time_intervals

def fetch_intervals(params: dict):
    all_interval_data = []
    rc = nextbus.get_route_config(AGENCY, params['route_id'])
    time_intervals = get_intervals(params['start_time_str'], params['end_time_str'], params['interval'])
    data = {
        'route_title': rc.title
    }

    # add different information for stops depending on whether one or two stops were passed in
    if 'stop_id' in params.keys():
        data['stop_title'] = rc.get_stop_info(params['stop_id']).title
        data['directions'] = rc.get_directions_for_stop(params['stop_id'])
    else:
        data['start_stop_title'] = rc.get_stop_info(params['start_stop_id']).title
        data['end_stop_title'] = rc.get_stop_info(params['end_stop_id']).title
        data['directions'] = rc.get_directions_for_stop(params['start_stop_id'])

    for interval in time_intervals:
        # only need to pass some params to get stats
        params_subset = {
            'start_time_str': interval['start_time'],
            'end_time_str': interval['end_time'],
            'start_date_str': params['start_date_str'],
            'end_date_str': params['end_date_str'],
            'route_id': params['route_id'],
            'direction_id': params['direction_id']
        }
        interval_data = {
            'start_time': params_subset['start_time_str'],
            'end_time': params_subset['end_time_str']
        }

        if 'metrics/wait_times' in request.path:
            params_subset['stop_id'] = params['stop_id']
            interval_data['wait_times'] = fetch_wait_times_stats(params_subset, rc)
        elif 'metrics/headways' in request.path:
            params_subset['stop_id'] = params['stop_id']
            interval_data['headways'] = fetch_headways_stats(params_subset, rc)
        elif 'metrics/trip_times' in request.path:
            params_subset['start_stop_id'] = params['start_stop_id']
            params_subset['end_stop_id'] = params['end_stop_id']
            interval_data['trip_times'] = fetch_trip_times_stats(params_subset, rc)
        else: # test /metrics endpoint
            params_subset['stop_id'] = params['stop_id']
            interval_data['wait_times'] = fetch_wait_times_stats(params_subset, rc)

        all_interval_data.append(interval_data)
            
    data['intervals'] = all_interval_data
    return data