from flask import Response
from datetime import datetime, timedelta
import json

from models import metrics, arrival_history, nextbus, util, wait_times, trip_times, constants, errors
from backend_util import get_params, validate_params, process_params, make_error_response

def fetch_data():
    metrics_start = datetime.now()
    params = get_params(False)
    
    try:
        validate_params(params)
    
        processed_params = process_params(params)

        try:
            data = {
                **{
                    'params': processed_params,
                },
                **fetch_intervals(processed_params)
            }
            metrics_end = datetime.now()
            data['processing_time'] = (metrics_end - metrics_start).total_seconds()

            return Response(json.dumps(data, indent = 2), mimetype = 'application/json')
        except errors.ArrivalHistoryNotFoundError as ex:
            return make_error_response(params, str(ex), 404)
    except errors.ValidationError as ex:
        return make_error_response(params, str(ex), 400)

def get_intervals(start_time_str: str, end_time_str: str, use_intervals: bool, interval_length: int):
    if not use_intervals:
        # if not using intervals, treat the entire time range as one interval
        return [(start_time_str, end_time_str)]
    else:
        # if interval_length is an int n > 0, so the interval length is n hours
        # otherwise, use default intervals
        if isinstance(interval_length, int) and interval_length > 0:
            interval_timedelta = timedelta(seconds = 3600 * interval_length)

            # round down start and end time to allow for even intervals
            start_time = datetime.strptime(start_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)
            end_time = datetime.strptime(end_time_str, '%H:%M').replace(microsecond=0, second=0, minute=0)

            time_intervals = []

            while start_time.hour < end_time.hour:
                interval_start = start_time
                # if the next interval would go beyond the given time range, just cut it off
                interval_end = start_time + interval_timedelta
                if interval_end > end_time:
                    interval_end = end_time

                time_intervals.append((interval_start.strftime('%H:%M'), interval_end.strftime('%H:%M')))
                
                start_time += interval_timedelta
        else:
            time_intervals = constants.DEFAULT_TIME_STR_INTERVALS

        return time_intervals

def fetch_intervals(params: dict):
    all_interval_data = []
    rc = nextbus.get_route_config(constants.AGENCY, params['route_id'])
    time_intervals = get_intervals(params['start_time_str'], params['end_time_str'], params['use_intervals'], params['interval_length'])
    date_range = util.get_dates_in_range(params['start_date_str'], params['end_date_str'])
    data = {
        'params': params,
        'route_title': rc.title,
        'start_time_title': rc.get_stop_info(params['start_stop_id']).title,
        'end_stop_title': rc.get_stop_info(params['end_stop_id']).title if params['end_stop_id'] else None,
        'directions': rc.get_directions_for_stop(params['start_stop_id'])
    }

    for interval in time_intervals:
        interval_data = {
            'start_time': interval[0],
            'end_time': interval[1]
        }

        rng = metrics.Range(
            date_range,
            interval[0],
            interval[1],
            constants.PACIFIC_TIMEZONE
        )

        route_metrics = metrics.RouteMetrics(constants.AGENCY, params['route_id'])

        # TODO: stats as params
        interval_data['wait_times'] = route_metrics.get_wait_time_stats(
            params['direction_id'], params['start_stop_id'],
            rng, params['keys']
        )

        interval_data['trip_times'] = route_metrics.get_trip_time_stats(
            params['direction_id'], params['start_stop_id'], params['end_stop_id'],
            rng, params['keys']
        )

        interval_data['headway_min'] = route_metrics.get_headway_min_stats(
            params['direction_id'], params['start_stop_id'],
            rng, params['keys']
        )

        all_interval_data.append(interval_data)
    
    if len(all_interval_data) > 1:
        data['intervals'] = all_interval_data
    else:
        data = {
            **data,
            'wait_times': interval_data['wait_times'],
            'trip_times': interval_data['trip_times'],
            'headway_min': interval_data['headway_min']
        }

    return data