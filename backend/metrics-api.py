import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import json
import numpy as np
import pandas as pd
import pytz
from datetime import datetime, timedelta
import time
import requests
import math
import sys
from models import metrics, util, arrival_history, wait_times, trip_times, nextbus, constants, errors

"""
This is the app's main file!
"""

# configuration
DEBUG = os.environ.get('FLASK_DEBUG') == '1'

# Create the app
app = Flask(__name__, static_folder='../frontend/build')
CORS(app)

# Test endpoint
@app.route('/api/ping', methods=['GET'])
def ping():
    return "pong"

@app.route('/api/metrics', methods=['GET'])
def metrics_page():
    metrics_start = time.time()
    route_id = request.args.get('routeId')
    if route_id is None:
        route_id = '12'
    start_stop_id = request.args.get('startStopId')
    if start_stop_id is None:
        start_stop_id = '3476'
    end_stop_id = request.args.get('endStopId')

    direction_id = request.args.get('directionId')

    start_date_str = request.args.get('startDate')
    end_date_str = request.args.get('endDate')
    date_str = request.args.get('date')

    if date_str is not None:
        start_date_str = end_date_str = date_str
    else:
        if start_date_str is None:
            start_date_str = '2019-04-08'
        if end_date_str is None:
            end_date_str = start_date_str

    start_time_str = request.args.get('startTime') # e.g. "14:00" (24h time of day)
    end_time_str = request.args.get('endTime') # e.g. "18:00" or "03:00+1" (24h time of day)

    params = {
        'startStopId': start_stop_id,
        'endStopId': end_stop_id,
        'routeId': route_id,
        'directionId': direction_id,
        'startDate': start_date_str,
        'endDate': end_date_str,
        'startTime': start_time_str,
        'endTime': end_time_str,
    }

    data = {
        'params': params
    }

    try:
        route_config = nextbus.get_route_config('sf-muni', route_id)

        start_stop_info = route_config.get_stop_info(start_stop_id)
        if start_stop_info is None:
            raise errors.ValidationError(f"Stop {start_stop_id} is not on route {route_id}")

        data['startStopTitle'] = start_stop_info.title

        if end_stop_id:
            end_stop_info = route_config.get_stop_info(end_stop_id)
            if end_stop_info is None:
                raise errors.ValidationError(f"Stop {end_stop_id} is not on route {route_id}")
            data['endStopTitle'] = end_stop_info.title

        rng = metrics.Range(
            util.get_dates_in_range(start_date_str, end_date_str),
            start_time_str,
            end_time_str,
            pytz.timezone('US/Pacific')
        )

        route_metrics = metrics.RouteMetrics('sf-muni', route_id)

        keys = ['count','avg','min','median','max','percentiles','histogram']

        data['waitTimes'] = route_metrics.get_wait_time_stats(
            direction_id, start_stop_id,
            rng, keys
        )

        data['tripTimes'] = route_metrics.get_trip_time_stats(
            direction_id, start_stop_id, end_stop_id,
            rng, keys
        )

        data['headwayMin'] = route_metrics.get_headway_min_stats(
            direction_id, start_stop_id,
            rng, keys
        )

    except errors.ArrivalHistoryNotFoundError as ex:
        return make_error_response(params, str(ex), 404)
    except errors.ValidationError as ex:
        return make_error_response(params, str(ex), 400)

    metrics_end = time.time()
    data['processingTime'] = (metrics_end - metrics_start)

    res = Response(json.dumps(data, indent=2), mimetype='application/json')
    if not DEBUG:
        res.headers['Cache-Control'] = 'max-age=60'
    return res

def make_error_response(params, error, status):
    data = {
        'params': params,
        'error': error,
    }
    return Response(json.dumps(data, indent=2), status=status, mimetype='application/json')

@app.route('/api/metrics_by_interval', methods=['GET'])
def metrics_by_interval():
    route_id = request.args.get('routeId')
    if route_id is None:
        route_id = '12'
    start_stop_id = request.args.get('startStopId')
    if start_stop_id is None:
        start_stop_id = '3476'
    end_stop_id = request.args.get('endStopId')

    direction_id = request.args.get('directionId')

    start_date_str = request.args.get('startDate')
    end_date_str = request.args.get('endDate')
    date_str = request.args.get('date')

    if date_str is not None:
        start_date_str = end_date_str = date_str
    else:
        if start_date_str is None:
            start_date_str = '2019-04-08'
        if end_date_str is None:
            end_date_str = start_date_str

    start_time_str = request.args.get('startTime') # e.g. "14:00" (24h time of day)
    end_time_str = request.args.get('endTime') # e.g. "18:00" (24h time of day)

    params = {
        'startStopId': start_stop_id,
        'endStopId': end_stop_id,
        'routeId': route_id,
        'directionId': direction_id,
        'startDate': start_date_str,
        'endDate': end_date_str,
        'date': date_str,
        'startTime': start_time_str,
        'endTime': end_time_str,
    }

    data = {
        'params': params
    }

    if start_time_str is not None and end_time_str is not None:
        # round start_time down and end_time up to allow for even intervals
        start_time = datetime.strptime(start_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)
        end_time = datetime.strptime(end_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0) - timedelta(hours=1)

        time_str_intervals = []
        while start_time.hour != end_time.hour + 1:
            time_str_intervals.append((
                start_time.strftime('%H:%M'),
                (start_time + timedelta(seconds=3600)).strftime('%H:%M')
            ))
            start_time += timedelta(seconds=3600)
    else:
        if start_time_str or end_time_str:
            return make_error_response(params, f'Need both a start and end time', 404)

        time_str_intervals = constants.DEFAULT_TIME_STR_INTERVALS

    try:
        route_metrics = metrics.RouteMetrics('sf-muni', route_id)

        dates = util.get_dates_in_range(start_date_str, end_date_str)

        keys = ['count','avg','min','median','max','percentiles']

        tz = pytz.timezone('US/Pacific')

        def get_interval_stats(start_time_str, end_time_str):

            rng = metrics.Range(dates, start_time_str, end_time_str, tz)

            return {
                    'startTime': start_time_str,
                    'endTime': end_time_str,
                    'waitTimes': route_metrics.get_wait_time_stats(
                        direction_id, start_stop_id,
                        rng, keys
                    ),
                    'tripTimes': route_metrics.get_trip_time_stats(
                        direction_id, start_stop_id, end_stop_id,
                        rng, keys
                    ),
            }

        data['intervals'] = [
            get_interval_stats(start_time_str, end_time_str)
            for start_time_str, end_time_str in time_str_intervals
        ]
    except errors.ArrivalHistoryNotFoundError as ex:
        return make_error_response(params, str(ex), 404)
    except errors.ValidationError as ex:
        return make_error_response(params, str(ex), 400)

    return Response(json.dumps(data, indent=2), mimetype='application/json')

@app.route('/api/config', methods=['GET'])
def config():
    res = Response(json.dumps({"mapbox_access_token": os.environ.get('MAPBOX_ACCESS_TOKEN')}), mimetype='application/json')
    if not DEBUG:
        res.headers['Cache-Control'] = 'max-age=3600'
    return res

if os.environ.get('METRICS_ALL_IN_ONE') == '1':
    @app.route('/frontend/build/<path:path>')
    def frontend_build(path):
        return send_from_directory('../frontend/build', path)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def wildcard(path):
        return send_from_directory('../frontend/build', 'index.html')
else:
    @app.route('/')
    def root():
        return """<h2>Hello!</h2><p>This is the API server Go to port 3000 to see the real app.</p>"""

if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.run(use_reloader=True, threaded=True, host='0.0.0.0', port=port)
