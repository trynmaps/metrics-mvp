from datetime import date, time
from flask import request

from constants import TEST_ROUTE, TEST_DATE_STR, AGENCY, TEST_STOP, TEST_END_STOP
from backend_fetch import fetch_headways, fetch_wait_times, fetch_trip_times
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

def validate_params(params: dict):
    # keep track of missing/invalid parameters for error
    missing_params = []
    invalid_params = {}

    # validate common params
    if params['route_id'] is None:
        params['route_id'] = TEST_ROUTE
        # missing_params.append('route_id')

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
            params['start_date_str'] = TEST_DATE_STR
            # missing_params.append('start_date_str')
        else:
            try:
                date.fromisoformat(params['start_date_str'])
            except ValueError as err:
                invalid_params['start_date_str'] = f"{err}"

        if params['end_date_str'] is None:
            if params['start_date_str'] is not None:
                params['end_date_str'] = params['start_date_str']
            else:
                # missing_params.append('end_date_str')
                pass
        else:
            try:
                date.fromisoformat(params['end_date_str'])
            except ValueError as err:
                invalid_params['end_date_str'] = f"{err}"

    if params['start_time_str'] is None:
        missing_params.append('start_time_str')
    else:
        validate_time('start_time_str')

    if params['end_time_str'] is None:
        missing_params.append('end_time_str')
    else:
        validate_time('end_time_str')

    if params['direction_id'] is None:
        missing_params.append('direction_id')
        # there is a way to get the directions for a stop though...
    else:
        validate_direction('direction_id')

    # validation for each endpoint
    if ('wait_times' in request.path) or ('headways' in request.path):
        validate_one_stop_params()
        validate_interval('interval')
    elif 'trip_times' in request.path:
        validate_two_stops_params()
        validate_interval('interval')

    def validate_one_stop_params():
        if params['stop_id'] is None:
            params['stop_id'] = TEST_STOP
            # missing_params.append('stop_id')
    
        validate_stop('stop_id')

    def validate_two_stops_params():
        if params['start_stop_id'] is None:
            params['start_stop_id'] = TEST_STOP
            # missing_params.append('start_stop_id')

        validate_stop('start_stop_id')
        
        if params['end_stop_id'] is None:
            params['end_stop_id'] = TEST_END_STOP
            # missing_params.append('end_stop_id')

        # validate that the stops go in the same direction here

        validate_stop('end_stop_id')
        
    def validate_interval(key: str):
        try:
            int(params[key])
        except ValueError as err:
            if params[key] is None or params[key].lower() in ['true', 'false']:
                pass
            else:
                invalid_params[key] = f"{err}"

    def validate_stop(key: str):
        try:
            stop_info = rc.get_stop_info(params[key])

            if stop_info is None:
                invalid_params[key] = f"Couldn't find stop info for {params[key]}"
        except NameError as err:
            invalid_params[key] = f"Couldn't get RouteConfig for {params['route_id']}"

    def validate_time(key: str):
        try:
            time.fromisoformat(params[key])
        except ValueError as err:
            invalid_params[key] = f"{err}"

    def validate_direction(key: str):
        try:
            if 'stop_id' in params.keys():
                dirs = rc.get_directions_for_stop(params['stop_id'])

                if len(dirs) == 0:
                    invalid_params[key] = f"Couldn't get directions for {params['stop_id']}"
            elif 'start_stop_id' in params.keys():
                start_dirs = rc.get_directions_for_stop(params['start_stop_id'])
                end_dirs = rc.get_directions_for_sop(params['end_stop_id'])

                # if start or stop have no dirs, 'start/stop have no dirs'
                # if the direction isn't start or stop, 'stops don't go in the specified direction'    
        except NameError as err:
            params[key] = f"Couldn't get RouteConfig for {params['route_id']}"

    return {
        'missing_params': missing_params,
        'invalid_params': invalid_params
    } if len(missing_params) > 0 or len(invalid_params.keys()) > 0 else None

def process_params(params: dict):
    # for now interval is the only parameter that needs to be processed
    def process_interval(key: str):
        try:
            return int(params[key])
        except ValueError:
            if params[key] is None:
                return True
            else:
                return params[key].lower() == 'true'

    if 'interval' in params.keys():
        params['interval'] = process_interval('interval')

    return params

def fetch_data():
    params = get_params()
    params_validation = validate_params(params)

    if params_validation is not None:
        return Response(json.dumps({
            'params': params,
            'error': f"Missing values: {', '.join(params_validation['missing_params'])}\n \
                       Invalid values: {'\n'.join(f'{k}: {v}' for k, v in params_validation['invalid_params'])}",
        }, indent = 2), status = 400, mimetype = 'application/json')
    else:
        processed_params = process_params(params)

        # return only the data from the specified metric
        if 'headways' in request.path:
            return Response(json.dumps(fetch_headways(params), indent = 2), mimetype = 'application/json')
        elif 'wait_times' in request.path:
            return Response(json.dumps(fetch_wait_times(params), indent = 2), mimetype = 'application/json')
        elif 'trip_times' in request.path:
            return Response(json.dumps(fetch_trip_times(params), indent = 2), mimetype = 'application/json')
