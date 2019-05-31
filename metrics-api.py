import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import json
import numpy as np
import pandas as pd
import pytz
from datetime import datetime, timedelta
import time
import math
from models import metrics, util, arrival_history, wait_times, trip_times, nextbus
import constants
import sys
import backend_util
from errors import StopNotOnRouteError

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
    data = [{'id': route.id, 'title': route.title} for route in route_list]
    return Response(json.dumps(data, indent=2), mimetype='application/json')

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
    return Response(json.dumps(data, indent=2), mimetype='application/json')

@app.route('/metrics/wait_times', methods = ['GET'])
def wait_times_page():
    resp = backend_util.fetch_data()

    return resp

@app.route('/metrics/headways', methods = ['GET'])
def headways_page():
    resp = backend_util.fetch_data()

    return resp

@app.route('/metrics/trip_times', methods = ['GET'])
def trip_times_page():
    resp = backend_util.fetch_data()

    return resp

@app.route('/metrics/timetables', methods = ['GET'])
def timetables_page():
    resp = backend_util.fetch_data()

    return resp

@app.route('/metrics', methods=['GET'])
def metrics_page():
    resp = backend_util.fetch_data()
    # route_id = request.args.get('route_id')
    # if route_id is None:
    #     route_id = '12'
    # start_stop_id = request.args.get('start_stop_id')
    # if start_stop_id is None:
    #     start_stop_id = '3476'
    # end_stop_id = request.args.get('end_stop_id')

    # direction_id = request.args.get('direction_id')

    # start_date_str = request.args.get('start_date')
    # end_date_str = request.args.get('end_date')
    # date_str = request.args.get('date')

    # if date_str is not None:
    #     start_date_str = end_date_str = date_str
    # else:
    #     if start_date_str is None:
    #         start_date_str = '2019-04-08'
    #     if end_date_str is None:
    #         end_date_str = start_date_str

    # start_time_str = request.args.get('start_time') # e.g. "14:00" (24h time of day)
    # end_time_str = request.args.get('end_time') # e.g. "18:00" (24h time of day)
    # calc_metrics_args = {
    #     'start_stop_id': start_stop_id,
    #     'end_stop_id': end_stop_id,
    #     'route_id': route_id,
    #     'direction_id': direction_id,
    #     'start_date_str': start_date_str,
    #     'end_date_str': end_date_str,
    #     'date': date_str,
    #     'start_time_str': start_time_str,
    #     'end_time_str': end_time_str,
    # }
    # route_config = nextbus.get_route_config('sf-muni', calc_metrics_args['route_id'])
    # try:
    #     data = calc_metrics(calc_metrics_args, route_config)
    # except FileNotFoundError as ex:
    #     return Response(json.dumps({
    #         'params': calc_metrics_args,
    #         'error': f"Arrival history not found for route {calc_metrics_args['route_id']} on {calc_metrics_args['date'] or calc_metrics_args['start_date_str']}",
    #     }, indent=2), status=404, mimetype='application/json')
    # except IndexError as ex:
    #     return Response(json.dumps({
    #         'params': calc_metrics_args,
    #         'error': f"No arrivals found for stop {calc_metrics_args['start_stop_id']} on route {calc_metrics_args['route_id']} in direction {calc_metrics_args['direction_id']} on {calc_metrics_args['date'] or calc_metrics_args['start_date_str']}",
    #     }, indent = 2), status = 404, mimetype = 'application/json')
    # except StopNotOnRouteError as ex:
    #     return Response(json.dumps({
    #         'params': calc_metrics_args,
    #         'error': f"Stop {calc_metrics_args['start_stop_id']} is not on route {calc_metrics_args['route_id']}",
    #     }, indent=2), status=404, mimetype='application/json')
    # except Exception as ex:
    #     return Response(json.dumps({
    #         'params for calc_metrics func': calc_metrics_args,
    #         'error': str(ex),
    #     }, indent=2), status=400, mimetype='application/json')

    return resp

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
        'start_date_str': start_date_str,
        'end_date_str': end_date_str,
        'date': date_str,
        'start_time_str': start_time_str,
        'end_time_str': end_time_str,
    }

    if direction_id is None:
        return Response(json.dumps({
            'params': params,
            'error': 'direction_id not found ',
        }, indent=2), status=400, mimetype='application/json')

    route_config = nextbus.get_route_config('sf-muni', params['route_id'])

    data = {}

    if start_time_str is not None and end_time_str is not None:
        # round start_time down and end_time up to allow for even intervals
        start_time = datetime.strptime(start_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)
        end_time = datetime.strptime(end_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0) - timedelta(hours=1)

        hourly_time_intervals = []
        while start_time.hour != end_time.hour + 1:
            curr_interval = {}
            curr_interval['start_time'] = start_time.strftime('%H:%M')
            curr_interval['end_time'] = (start_time + timedelta(seconds=3600)).strftime('%H:%M')
            hourly_time_intervals.append(curr_interval)
            start_time += timedelta(seconds=3600)
        
    else:
        if start_time_str or end_time_str:
            return Response(json.dumps({
                'params': params,
                'error': 'Need both a start and end time'
            }, indent=2), status=404, mimetype='application/json')
        
        hourly_time_intervals = constants.DEFAULT_TIME_STR_INTERVALS
    try:
        data['intervals'] = create_intervals_list(hourly_time_intervals, params, route_config)
    except FileNotFoundError as ex:
        return Response(json.dumps({
            'params': params,
            'error': f"Arrival history not found for route {params['route_id']} on {params['date'] or params['start_date_str']}",
        }, indent=2), status=404, mimetype='application/json')
    except IndexError as ex:
        return Response(json.dumps({
            'params': params,
            'error': f"No arrivals found for stop {params['start_stop_id']} on route {params['route_id']} in direction {params['direction_id']} on {params['date'] or params['start_date_str']}",
        }, indent = 2), status = 404, mimetype = 'application/json')
    except StopNotOnRouteError as ex:
        return Response(json.dumps({
            'params': params,
            'error': f"Stop {params['start_stop_id']} is not on route {params['route_id']}",
        }, indent=2), status=404, mimetype='application/json')
    except Exception as ex:
        return Response(json.dumps({
            'params': params,
            'error': str(ex),
        }, indent=2), status=400, mimetype='application/json')

    data['params'] = params

    return Response(json.dumps(data, indent=2), mimetype='application/json')

def calc_metrics(args: dict, route_config: nextbus.RouteConfig) -> dict:
    route_id = args['route_id']
    start_stop_id = args['start_stop_id']
    end_stop_id = args['end_stop_id']
    direction_id = args['direction_id']
    start_date_str = args['start_date_str']
    end_date_str = args['end_date_str']
    start_time_str = args['start_time_str'] # e.g. "14:00" (24h time of day)
    end_time_str = args['end_time_str'] # e.g. "18:00" (24h time of day)

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

    dates = util.get_dates_in_range(start_date_str, end_date_str)

    tz = pytz.timezone('US/Pacific')

    start_stop_info = route_config.get_stop_info(start_stop_id)
    end_stop_info = route_config.get_stop_info(end_stop_id) if end_stop_id else None

    # 404 if the given stop isn't on the route
    # TODO: what should be done for the case where the start stop id is valid but the end stop id isn't?
    if start_stop_info is None:
        raise StopNotOnRouteError()

    if direction_id is not None:
        dir_info = route_config.get_direction_info(direction_id)
        if dir_info is not None:
            dir_infos = [dir_info]
        else:
            dir_infos = []
    else:
        # TODO: validation for end_stop_id directions if given (see trips.py)
        dirs = route_config.get_directions_for_stop(start_stop_id)
        dir_infos = [route_config.get_direction_info(direction) for direction in dirs]

    if end_stop_id:
        end_stop_dirs = route_config.get_directions_for_stop(end_stop_id)
        both_stops_same_dir = direction_id in end_stop_dirs

    directions = [{'id': dir_info.id, 'title': dir_info.title} for dir_info in dir_infos]

    headway_min_arr = []
    waits = []
    if end_stop_id:
        completed_trips  = []
    for d in dates:
        try:
            history = arrival_history.get_by_date('sf-muni', route_id, d)
            
            df = history.get_data_frame(start_stop_id, tz=tz, direction_id=direction_id, start_time_str=start_time_str, end_time_str=end_time_str)

            # get all headways for the selected stop (arrival time minus previous arrival time), computed separately for each day
            df['headway_min'] = metrics.compute_headway_minutes(df)

            # temporarily skip calculation of wait times until data is shown in front end
            waits.append(wait_times.get_waits(df, start_stop_info, d, tz, route_id, start_time_str, end_time_str))

            if end_stop_id and both_stops_same_dir:
                trips = trip_times.get_trip_times(df, history, tz, start_stop_id, end_stop_id)
                completed_trips.append(trips.trip_min[trips.trip_min.notnull()])

            headway_min = df.headway_min[df.headway_min.notnull()] # remove NaN row (first bus of the day)
            headway_min_arr.append(df.headway_min)
        except FileNotFoundError:
            # this is ugly, but it allows functions that call this to filter on this specific error.
            raise FileNotFoundError
        except IndexError:
            raise IndexError

    headway_min = pd.concat(headway_min_arr)
    waits = pd.concat(waits)
    if end_stop_id and both_stops_same_dir:
        completed_trips = pd.concat(completed_trips)
    headway_min_hist = None
    wait_times_hist = None
    trip_times_hist = None
    if not headway_min.empty:
        headway_min_hist = metrics.get_headways_stats(headway_min)
        wait_times_hist = metrics.get_wait_times_stats(waits, tz)
        trip_times_hist = metrics.get_trip_times_stats(completed_trips, start_stop_id, end_stop_id) if end_stop_id and both_stops_same_dir else None
        
    data = {
        'params': params,
        'route_title': route_config.title,
        'start_stop_title': start_stop_info.title if start_stop_info else None,
        'end_stop_title': end_stop_info.title if end_stop_info else None,
        'directions': directions,
        'headway_min': headway_min_hist,
        'wait_times': wait_times_hist,
        'trip_times': trip_times_hist,
    }
    return data

def create_intervals_list(time_intervals: dict, params: dict, route_config: nextbus.RouteConfig) -> list:
    intervals_arr = []
    for time_interval in time_intervals:
        params['start_time_str'] = time_interval['start_time']
        params['end_time_str'] = time_interval['end_time']
        curr_data = calc_metrics(params, route_config)

        intervals_arr.append({
            'start_time': params['start_time_str'],
            'end_time': params['end_time_str'],
            'headway_min': curr_data['headway_min'],
            'wait_times': curr_data['wait_times'],
            'trip_times': curr_data['trip_times'],
        })
    return intervals_arr

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
