from datetime import datetime, date, time
from flask import request, Response
import json
from datetime import time

from models import nextbus, constants, errors

def get_params(use_test_params: bool):
    params = constants.TEST_PARAMS if use_test_params else {
        'route_id': request.args.get('route_id'),
        'date_str': request.args.get('date'),
        'start_stop_id': request.args.get('start_stop_id'),
        'end_stop_id': request.args.get('end_stop_id'),
        'start_date_str': request.args.get('start_date'),
        'end_date_str': request.args.get('end_date'),
        'start_time_str': request.args.get('start_time'),
        'end_time_str': request.args.get('end_time'),
        'direction_id': request.args.get('direction_id'),
        'use_intervals': request.args.get('use_intervals'),
        'interval_length': request.args.get('interval_length'),
        'keys': request.args.get('keys')
    }

    return params

def validate_params(params: dict):
    # validate route_id
    if params['route_id'] is None:
            raise errors.ValidationError("Route ID is missing.")
    else:
        try:
            rc = nextbus.get_route_config(constants.AGENCY, params['route_id'])
        except Exception:
            raise errors.ValidationError(f"Could not get RouteConfig for route {params['route_id']}.")
    
    # validate date/start_date/end_date
    # two cases - pass one date (for one day's worth of metrics) or two (for a range)
    if params['date_str']:
        try:
            date.fromisoformat(params['date_str'])
            
            params['start_date_str'] = params['date_str']
            params['end_date_str'] = params['date_str']
        except ValueError:
            raise errors.ValidationError("Could not parse date parameter. (format: YYYY-MM-DD)")
    else:
        # if date is None, then start_date can't be None
        if params['start_date_str'] is None:
            raise errors.ValidationError("Need either a date or start_date parameter.")
        else:
            if params['end_date_str'] is None:
                params['end_date_str'] = params['start_date_str']

        for k in ['start_date_str', 'end_date_str']:
            try:
                date.fromisoformat(params[k])
            except ValueError:
                raise errors.ValidationError(f"Could not parse {k} parameter. (format: YYYY-MM-DD)")

    # validate start_time/end_time
    def validate_time(key: str):
        try:
            time.fromisoformat(params[key])
        except ValueError:
            raise errors.ValidationError(f"Could not parse {key} parameter. (format: HH:MM)")

    for k in ['start_time_str', 'end_time_str']:
        if params[k] is None:
            raise errors.ValidationError(f"Parameter {k} is missing.")
        else:
            validate_time(k)

    # check for direction_id - validation happens with stop validation
    if params['direction_id'] is None:
        raise errors.ValidationError("Direction ID is missing.")

    # validate start_stop_id/end_stop_id
    def validate_stop(key: str):
        if params[key] is None:
            raise errors.ValidationError(f"Parameter {key} is missing.")
        else:
            try:
                stop_info = rc.get_stop_info(params[key])

                if stop_info is None:
                    raise errors.ValidationError(f"Couldn't find stop info for {params[key]}")
                else:
                    validate_stop_direction(key)
            except NameError:
                raise errors.ValidationError(f"Couldn't get RouteConfig for {params['route_id']}")

    def validate_stop_direction(stop_key: str):
        dirs = rc.get_directions_for_stop(params[stop_key])

        if len(dirs) == 0:
            raise errors.ValidationError(f"Couldn't get directions for stop {params[stop_key]}.")
        elif all([params['direction_id'] != direction for direction in dirs]):
            raise errors.ValidationError(f"{params['direction_id']} is not a valid direction for {params[stop_key]}.")

    # start_stop_id is required, but end_stop_id is optional
    validate_stop('start_stop_id')
    if params['end_stop_id']:
        validate_stop('end_stop_id')

    # use intervals if use_intervals is 'true', otherwise don't
    try:
        if params['use_intervals'].lower() == 'true':
            # interval_length validation:
            # must be a positive integer n (for intervals of length n hours) or None (use default intervals)
            try:
                interval_length = int(params['interval_length'])

                if interval_length <= 0:
                    raise errors.ValidationError("Parameter interval_length must be None or a positive integer.")
            except ValueError:
                raise errors.ValidationError("Parameter interval_length must be None or a positive integer.")
            except TypeError:
                pass
    # catches case where use_intervals is None
    except AttributeError:
        pass

    # validate keys
    if params['keys']:
        for key in params['keys'].split(','):
            if not key in constants.DEFAULT_KEYS:
                raise errors.ValidationError(f"{key} is not a valid key! The keys parameter must be a comma-separated list of keys.")

def make_error_response(params, error, status):
    data = {
        'params': params,
        'error': error,
    }
    return Response(json.dumps(data, indent=2), status=status, mimetype='application/json')

def process_params(params: dict):
    # process interval-related params
    params['use_intervals'] = (params['use_intervals'].lower() == 'true') if params['use_intervals'] else False

    params['interval_length'] = int(params['interval_length']) if params['interval_length'] else None

    # process keys - if no keys were passed, use default ones
    params['keys'] = params['keys'].split(',') if params['keys'] else constants.DEFAULT_KEYS

    return params