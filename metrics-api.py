import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import json
import numpy as np
import pandas as pd
import pytz
from datetime import datetime
import time
from models import metrics, util, arrival_history, wait_times, nextbus

"""
This is the app's main file!
"""

# configuration
DEBUG = True

# Create the app
app = Flask(__name__, static_folder='frontend/build')

# @app.route('/', methods=['GET'])
# def index():
#     return "<a href='/metrics'>/metrics</a>";

# Test endpoint
@app.route('/ping', methods=['GET'])
def ping():
    return "pong"

# "Command Line"-esque endpoints
@app.route('/metrics', methods=['GET'])
def metrics_page():
    metrics_start = time.time()

    route_id = request.args.get('route_id')
    if route_id is None:
        route_id = '12'
    stop_id = request.args.get('stop_id')
    if stop_id is None:
        stop_id = '4970'

    direction_id = request.args.get('direction_id')

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    date_str = request.args.get('date')
    if date_str is not None:
        start_date_str = end_date_str = date_str
    else:
        if start_date_str is None:
            start_date_str = '2019-02-01'
        if end_date_str is None:
            end_date_str = start_date_str

    start_time_str = request.args.get('start_time') # e.g. "14:00" (24h time of day)
    end_time_str = request.args.get('end_time') # e.g. "18:00" (24h time of day)

    params = {
        'stop_id': stop_id,
        'route_id': route_id,
        'direction_id': direction_id,
        'start_date': start_date_str,
        'end_date': end_date_str,
        'start_time': start_time_str,
        'end_time': end_time_str,
    }

    try:
        dates = util.get_dates_in_range(start_date_str, end_date_str)
    except Exception as ex:
        return Response(json.dumps({
            'params': params,
            'error': str(ex),
        }, indent=2), status=400, mimetype='application/json')

    tz = pytz.timezone('US/Pacific')

    route_config = nextbus.get_route_config('sf-muni', route_id)
    stop_info = route_config.get_stop_info(stop_id)

    if direction_id is not None:
        dirs = [direction_id]
        dir_info = route_config.get_direction_info(dir)
        if dir_info is not None:
            dir_infos = [dir_info]
        else:
            dir_infos = []
    else:
        dirs = route_config.get_directions_for_stop(stop_id)
        dir_infos = [route_config.get_direction_info(dir) for dir in dirs]

    headway_min_arr = []
    for d in dates:
        try:
            history = arrival_history.get_by_date('sf-muni', route_id, d)
        except FileNotFoundError as ex:
            return Response(json.dumps({
                'params': params,
                'error': f"Arrival history not found for route {route_id} on {d}",
            }, indent=2), status=404, mimetype='application/json')

        df = history.get_data_frame(stop_id, tz=tz, direction_id=direction_id, start_time_str=start_time_str, end_time_str=end_time_str)

        # get all headways for the selected stop (arrival time minus previous arrival time), computed separately for each day
        df['headway_min'] = metrics.compute_headway_minutes(df)

        headway_min = df.headway_min[df.headway_min.notnull()] # remove NaN row (first bus of the day)
        headway_min_arr.append(headway_min)

    headway_min = pd.concat(headway_min_arr)

    if headway_min.empty:
        return Response(json.dumps({
            'params': params,
            'error': "No arrivals for stop",
        }, indent=2), status=404, mimetype='application/json')

    percentiles = range(0,101,5)

    data = {
        'params': params,
        'route_title': route_config.title,
        'stop_title': stop_info.title if stop_info else None,
        'directions': [{'id': dir_info.id, 'title': dir_info.title} for dir_info in dir_infos],
        'headway_min': {
            'count': len(headway_min),
            'avg': np.average(headway_min),
            'std': np.std(headway_min),
            'percentiles': [{'percentile': percentile, 'value': value}
                for percentile, value in zip(percentiles, np.percentile(headway_min, percentiles))],
        },
    }

    metrics_end = time.time()
    data['processing_time'] = (metrics_end - metrics_start)

    return Response(json.dumps(data, indent=2), mimetype='application/json')

# Serve React App
# @app.route('/', defaults={'path': ''}, methods=['GET'])
# @app.route('/app/<path:path>')
@app.route('/', methods=['GET'])
def serve_react():
    print("hi")
    return send_from_directory('frontend/build', 'index.html')


# serve everything from the `frontend` folder directly
# (this is mostly static files)
@app.route('/frontend/<path:path>')
def send_frontend(path):
    return send_from_directory('frontend', path)


if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.run(use_reloader=True, threaded=True, host='0.0.0.0', port=port)
