from datetime import datetime, date, time, timedelta
from flask import request, Response
import json
from datetime import time

from constants import TEST_ROUTE, TEST_DATE_STR, AGENCY, TEST_STOP, TEST_END_STOP, TEST_DIRECTION, DEFAULT_TIME_STR_INTERVALS
from models import nextbus

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
    else: # test metrics endpoint for now
        params.update({
            'stop_id': request.args.get('stop_id'),
            'interval': request.args.get('interval')
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