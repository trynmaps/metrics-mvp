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
import re
from models import metrics, util, arrival_history, wait_times, trip_times, nextbus, constants, errors

"""
This is the app's main file!
"""

# configuration
DEBUG = True

# Create the app
app = Flask(__name__, static_folder='frontend/build')
CORS(app)

# Test endpoint
@app.route('/ping', methods=['GET'])
def ping():
    return "pong"

@app.route('/routes', methods=['GET'])
def routes():
    route_list = nextbus.get_route_list('sf-muni')
    
    data = [{
        'id': route.id,
        'title': route.title,
        'directions': [{
            'id': dir.id,
            'title': dir.title,
            'name': dir.name,
            'stops': dir.get_stop_ids()
        } for dir in route.get_direction_infos()],
        'stops': {stop.id: {'title': stop.title, 'lat': stop.lat, 'lon': stop.lon} for stop in route.get_stop_infos()}
    } for route in route_list]
    
    return Response(json.dumps(data), mimetype='application/json') # no prettyprinting to save bandwidth

@app.route('/route', methods=['GET'])
def route_config():
    route_id = request.args.get('route_id')
    route = nextbus.get_route_config('sf-muni', route_id)

    data = {
        'id': route_id,
        'title': route.title,
        'directions': [{
            'id': dir.id,
            'title': dir.title,
            'name': dir.name,
            'stops': dir.get_stop_ids()
        } for dir in route.get_direction_infos()],
        'stops': {stop.id: {'title': stop.title, 'lat': stop.lat, 'lon': stop.lon} for stop in route.get_stop_infos()}
    }
    return Response(json.dumps(data), mimetype='application/json') # no prettyprinting to save bandwidth

@app.route('/metrics', methods=['GET'])
def metrics_page():
    metrics_start = time.time()
    route_id = request.args.get('route_id')
    if route_id is None:
        route_id = '12'
    start_stop_id = request.args.get('start_stop_id')
    if start_stop_id is None:
        start_stop_id = '3476'
    end_stop_id = request.args.get('end_stop_id')

    direction_id = request.args.get('direction_id')

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    date_str = request.args.get('date')

    if date_str is not None:
        start_date_str = end_date_str = date_str
    else:
        if start_date_str is None:
            start_date_str = '2019-04-08'
        if end_date_str is None:
            end_date_str = start_date_str

    start_time_str = request.args.get('start_time') # e.g. "14:00" (24h time of day)
    end_time_str = request.args.get('end_time') # e.g. "18:00" or "03:00+1" (24h time of day)

    params = {
        'start_stop_id': start_stop_id,
        'end_stop_id': end_stop_id,
        'route_id': route_id,
        'direction_id': direction_id,
        'start_date': start_date_str,
        'end_date': end_date_str,
        'start_time': start_time_str,
        'end_time': end_time_str,
    }

    data = {
        'params': params
    }

    try:
        route_config = nextbus.get_route_config('sf-muni', route_id)

        start_stop_info = route_config.get_stop_info(start_stop_id)
        if start_stop_info is None:
            raise errors.ValidationError(f"Stop {start_stop_id} is not on route {route_id}")

        data['start_stop_title'] = start_stop_info.title

        if end_stop_id:
            end_stop_info = route_config.get_stop_info(end_stop_id)
            if end_stop_info is None:
                raise errors.ValidationError(f"Stop {end_stop_id} is not on route {route_id}")
            data['end_stop_title'] = end_stop_info.title

        rng = metrics.Range(
            util.get_dates_in_range(start_date_str, end_date_str),
            start_time_str,
            end_time_str,
            pytz.timezone('US/Pacific')
        )

        route_metrics = metrics.RouteMetrics('sf-muni', route_id)

        keys = ['count','avg','min','median','max','percentiles','histogram']

        data['wait_times'] = route_metrics.get_wait_time_stats(
            direction_id, start_stop_id,
            rng, keys
        )

        data['trip_times'] = route_metrics.get_trip_time_stats(
            direction_id, start_stop_id, end_stop_id,
            rng, keys
        )

        data['headway_min'] = route_metrics.get_headway_min_stats(
            direction_id, start_stop_id,
            rng, keys
        )

    except errors.ArrivalHistoryNotFoundError as ex:
        return make_error_response(params, str(ex), 404)
    except errors.ValidationError as ex:
        return make_error_response(params, str(ex), 400)

    metrics_end = time.time()
    data['processing_time'] = (metrics_end - metrics_start)

    return Response(json.dumps(data, indent=2), mimetype='application/json')







##
# stuff from Jesse's isochrone branch
## 


def get_cached_json_file_from_s3(filename):
    cache_path = f'{util.get_data_dir()}/{filename}'
    try:
        with open(cache_path, 'r') as f:
            json_data = f.read()
    except FileNotFoundError:
        s3_bucket = arrival_history.get_s3_bucket()
        s3_path = filename

        s3_url = f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}"
        r = requests.get(s3_url)

        if r.status_code == 404:
            raise FileNotFoundError(f"{s3_url} not found")
        if r.status_code != 200:
            raise Exception(f"Error fetching {s3_url}: HTTP {r.status_code}: {r.text}")

        json_data = r.text

        with open(cache_path, "w") as f:
            f.write(json_data)

    res = Response(json_data, mimetype='application/json')
    res.headers['Cache-Control'] = 'max-age=3600'
    return res

@app.route('/trip-times', methods=['GET'])
def cached_trip_times():
    date_str = request.args.get('date')
    if date_str is None:
        date_str = '2019-05-24'
    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")
    return get_cached_json_file_from_s3(f'trip_times_t1_sf-muni_{date_str}.json')

@app.route('/wait-times', methods=['GET'])
def cached_wait_times():
    date_str = request.args.get('date')
    if date_str is None:
        date_str = '2019-05-24'
    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")
    return get_cached_json_file_from_s3(f'wait_times_t2_sf-muni_{date_str}.json')






 
 
 
def make_error_response(params, error, status):
    data = {
        'params': params,
        'error': error,
    }
    return Response(json.dumps(data, indent=2), status=status, mimetype='application/json')


@app.route('/metrics_by_interval', methods=['GET'])
def metrics_by_interval():
    route_id = request.args.get('route_id')
    if route_id is None:
        route_id = '12'
    start_stop_id = request.args.get('start_stop_id')
    if start_stop_id is None:
        start_stop_id = '3476'
    end_stop_id = request.args.get('end_stop_id')

    direction_id = request.args.get('direction_id')

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    date_str = request.args.get('date')

    if date_str is not None:
        start_date_str = end_date_str = date_str
    else:
        if start_date_str is None:
            start_date_str = '2019-04-08'
        if end_date_str is None:
            end_date_str = start_date_str

    start_time_str = request.args.get('start_time') # e.g. "14:00" (24h time of day)
    end_time_str = request.args.get('end_time') # e.g. "18:00" (24h time of day)

    params = {
        'start_stop_id': start_stop_id,
        'end_stop_id': end_stop_id,
        'route_id': route_id,
        'direction_id': direction_id,
        'start_date': start_date_str,
        'end_date': end_date_str,
        'date': date_str,
        'start_time': start_time_str,
        'end_time': end_time_str,
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
                    'start_time': start_time_str,
                    'end_time': end_time_str,
                    'wait_times': route_metrics.get_wait_time_stats(
                        direction_id, start_stop_id,
                        rng, keys
                    ),
                    'trip_times': route_metrics.get_trip_time_stats(
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

# Serve production build of React app
# @app.route('/', defaults={'path': ''}, methods=['GET'])
# @app.route('/app/<path:path>')
@app.route('/', methods=['GET'])
def serve_react():
    try:
        return send_from_directory('frontend/build', 'index.html')
    except Exception as e:
        source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        if not os.path.isfile(f'{source_dir}/frontend/build/index.html'):
            return """<h2>Hello!</h2>
            <p>This is where the production frontend assets would be, but they don't seem to have been built yet.</p>
            <p>To build the frontend assets, run <code>cd frontend && npm build</code> from the command line.<br />
            To view the frontend in dev mode, visit port 3000 instead.<br />
            To explore the backend API, try <a href="/metrics">/metrics</a></p>
            """
        else:
            raise e

# serve production build from the `frontend` folder directly
# (this is mostly static files)
@app.route('/frontend/<path:path>')
def send_frontend(path):
    return send_from_directory('frontend', path)

if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.run(use_reloader=True, threaded=True, host='0.0.0.0', port=port)
