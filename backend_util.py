from datetime import datetime, date, time, timedelta
from flask import request, Response
import json
from datetime import time

from constants import TEST_ROUTE, TEST_DATE_STR, AGENCY, TEST_STOP, TEST_END_STOP, TEST_DIRECTION, DEFAULT_TIME_STR_INTERVALS
from backend_stats import fetch_wait_times_stats, fetch_headways_stats, fetch_trip_times_stats
from models import nextbus

class InvalidParameterError(Exception):
    pass

def get_params():
    # get params common to all endpoints
    params = {
        'route_id': request.args.get('route_id'),
        'date_str': request.args.get('date'),
        'start_date_str': request.args.get('start_date'),
        'end_date_str': request.args.get('end_date'),
        'start_time_str': request.args.get('start_time'),
        'end_time_str': request.args.get('end_time'),
        'direction_id': request.args.get('direction_id'),
    }

    # get params specific to the endpoint
    if ('wait_times' in request.path) or ('headways' in request.path):
        params.update({
            'stop_id': request.args.get('stop_id'),
            'interval': request.args.get('interval')
        })
    elif 'trip_times' in request.path:
        params.update({
            'start_stop_id': request.args.get('start_stop_id'),
            'end_stop_id': request.args.get('end_stop_id'),
            'interval': request.args.get('interval')
        })
    elif 'timetables' in request.path:
        params.update({
            'stop_id': request.args.get('stop_id'),
        })

    return params

def validate_params(params: dict, test_params: bool):
    def validate_one_stop_params():
        if params['stop_id'] is None:
            if test_params:
                params['stop_id'] = TEST_STOP
            else:
                missing_params.append('stop_id')

        validate_stop('stop_id')

        # for one stop, have to check that the direction is valid and that the stop goes in that direction
        if ('stop_id' not in invalid_params.keys()) and ('stop_id' not in missing_params):
            validate_direction('stop_id')
        else:
            if ('route_id' in invalid_params.keys()) or ('route_id' in missing_params):
                invalid_params["direction_id_for_stop_id"] = f"Couldn't validate direction - couldn't get RouteConfig for {params['route_id']}"
            else:
                invalid_params["direction_id_for_stop_id"] = f"Couldn't validate direction - couldn't get stop info for {params['stop_id']}"

    def validate_two_stops_params():
        if params['start_stop_id'] is None:
            if test_params:
                params['start_stop_id'] = TEST_STOP
            else:
                missing_params.append('start_stop_id')

        validate_stop('start_stop_id')
        
        if params['end_stop_id'] is None:
            if test_params:
                params['end_stop_id'] = TEST_END_STOP
            else:
                missing_params.append('end_stop_id')

        validate_stop('end_stop_id')

        # for two stops, have to check that the direction is valid for both stops
        if all([('start_stop_id' != v) and ('end_stop_id' != v) for v in set(invalid_params.keys()) | set(missing_params)]):
            validate_direction('start_stop_id')
            validate_direction('end_stop_id')

            if any([('start_stop_id' in key) or ('end_stop_id' in key) for key in invalid_params.keys()]):
                invalid_params['direction_id'] = f"At least one of {params['start_stop_id']} and {params['end_stop_id']} don't go in the direction {params['direction_id']}"
        else:
            if ('route_id' in invalid_params.keys()) or ('route_id' in missing_params):
                invalid_params["direction_id_for_start_stop_id"] = f"Couldn't validate direction - couldn't get RouteConfig for {params['route_id']}"
            else:
                invalid_params["direction_id_for_start_stop_id"] = f"Couldn't validate direction - couldn't get stop info for {params['start_stop_id']}"

            if ('route_id' in invalid_params.keys()) or ('route_id' in missing_params):
                invalid_params["direction_id_for_end_stop_id"] = f"Couldn't validate direction - couldn't get RouteConfig for {params['route_id']}"
            else:
                invalid_params["direction_id_for_end_stop_id"] = f"Couldn't validate direction - couldn't get stop info for {params['end_stop_id']}"
               
    def validate_interval():
        try:
            int(params['interval'])
        except (ValueError, TypeError) as err:
            if params['interval'] is None or params['interval'].lower() in ['true', 'false']:
                pass
            else:
                invalid_params['interval'] = f"{err}"

    def validate_stop(key: str):
        try:
            stop_info = rc.get_stop_info(params[key])

            if stop_info is None:
                invalid_params[key] = f"Couldn't find stop info for {params[key]}"
        except NameError as err:
            invalid_params[key] = f"Couldn't validate stop - couldn't get RouteConfig for {params['route_id']}"

    def validate_time(key: str):
        try:
            time.fromisoformat(params[key])
        except ValueError as err:
            invalid_params[key] = f"{err}"

    def validate_direction(stop_key: str):
        direction_error_key = f"direction_id_for_{stop_key}"

        stop_info = rc.get_stop_info(params[stop_key])

        if stop_info is None:
            invalid_params[direction_error_key] = f"Couldn't validate direction - stop {params[stop_key]} could not be found on the route"
        else:
            dirs = rc.get_directions_for_stop(params[stop_key])

            if len(dirs) == 0:
                invalid_params[direction_error_key] = f"Couldn't get directions for stop {params[stop_key]}"
            elif all([params['direction_id'] != direction for direction in dirs]):
                invalid_params[direction_error_key] = f"{params['direction_id']} is not a valid direction for {params[stop_key]}"

    # keep track of missing/invalid parameters for error
    missing_params = []
    invalid_params = {}

    # validate common params
    if params['route_id'] is None:
        if test_params:
            params['route_id'] = TEST_ROUTE
        else:
            missing_params.append('route_id')

    # put in else statement up there later
    try:
        rc = nextbus.get_route_config(AGENCY, params['route_id'])
    except Exception as err:
        invalid_params['route_id'] = f"{err}"

    if params['date_str'] is not None:
        try:
            date.fromisoformat(params['date_str'])
            
            params['start_date_str'] = params['date_str']
            params['end_date_str'] = params['date_str']
        except ValueError as err:
            invalid_params['date_str'] = f"{err}"
    else:
        if params['start_date_str'] is None:
            if test_params:
                params['start_date_str'] = TEST_DATE_STR
            else:
                missing_params.append('start_date_str')

        if params['end_date_str'] is None:
            if params['start_date_str'] is not None:
                params['end_date_str'] = params['start_date_str']
            else:
                missing_params.append('end_date_str')

    for k, v in {k: params[k] for k in ['start_date_str', 'end_date_str']}.items():
        try:
            date.fromisoformat(v)
        except ValueError as err:
            invalid_params[k] = f"{err}"

    if params['start_time_str'] is None:
        missing_params.append('start_time_str')
    else:
        validate_time('start_time_str')

    if params['end_time_str'] is None:
        missing_params.append('end_time_str')
    else:
        validate_time('end_time_str')

    if params['direction_id'] is None:
        if test_params:
            params['direction_id'] = TEST_DIRECTION
        else:
            missing_params.append('direction_id')

    # validation for each endpoint
    if 'trip_times' in request.path:
        validate_two_stops_params()
        validate_interval()
    else:
        if ('wait_times' in request.path) or ('headways' in request.path):
            validate_interval()
        
        validate_one_stop_params()

    return {
        'missing_params': missing_params,
        'invalid_params': invalid_params
    } if len(missing_params) > 0 or len(invalid_params.keys()) > 0 else None

def process_params(params: dict):
    # for now interval is the only parameter that needs to be processed
    def process_interval(key: str):
        try:
            return int(params[key])
        except (ValueError, TypeError):
            if params[key] is None:
                return True
            else:
                return params[key].lower() == 'true'

    if 'interval' in params.keys():
        params['interval'] = process_interval('interval')

    return params

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
                'params': params,
            },
            **fetch_intervals(params)
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
        if 'metrics/headways' in request.path:
            params_subset['stop_id'] = params['stop_id']
            interval_data['headways'] = fetch_headways_stats(params_subset, rc)
        if 'metrics/trip_times' in request.path:
            params_subset['start_stop_id'] = params['start_stop_id']
            params_subset['end_stop_id'] = params['end_stop_id']
            interval_data['trip_times'] = fetch_trip_times_stats(params_subset, rc)

        all_interval_data.append(interval_data)
            
    data['intervals'] = all_interval_data
    return data