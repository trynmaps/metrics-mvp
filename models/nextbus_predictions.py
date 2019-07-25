import re
import requests
import json
import os
from datetime import datetime

from models import predictions as p, nextbus

STOPS_STR = '&stops='

def create_prediction_request_for_route(agency_id: str, route_id: str, stops: list) -> str:
    stops = [f"{route_id}|{stop_id}" for stop_id in stops]
    stop_str = STOPS_STR + STOPS_STR.join(stops)
    return f"http://webservices.nextbus.com/service/publicJSONFeed?command=predictionsForMultiStops&a={agency_id}{stop_str}"

# returns { route_id: [predictions] }
def get_prediction_data_for_request(request_url: str) -> dict:
    queried_time = datetime.now().timestamp()
    response = requests.get(request_url)
    if response.status_code != 200:
        response.raise_for_status()
    resp_json = response.json()
    if 'predictions' not in resp_json:
        # request errored out, will raise an error here later
        return
    return parse_prediction_response(queried_time, resp_json)

def parse_prediction_response(queried_time, resp_json: dict) -> list:
    predictions_for_route = []
    predictions_by_route = resp_json['predictions']
    for prediction_info in predictions_by_route:
        route_id = prediction_info['routeTag']
        stop_id = prediction_info['stopTag']
        if 'direction' not in prediction_info:
            continue
        directions = prediction_info['direction']
        if isinstance(directions, list):
            # meaning there are multiple directions at this stop
            for direction in directions:
                predictions = direction['prediction']
                predictions_for_route += gen_predictions(route_id, stop_id, queried_time, predictions)
        else:
            predictions = directions['prediction']
            predictions_for_route += gen_predictions(route_id, stop_id, queried_time, predictions)

    return predictions_for_route

def gen_predictions(route_id, stop_id: str, queried_time, predictions: list):
    ret_predictions = []
    if isinstance(predictions, list):
        for prediction in predictions:
            new_prediction = gen_prediction(
                prediction, route_id, stop_id, queried_time)
            ret_predictions.append(new_prediction)
    else:
        new_prediction = gen_prediction(
            predictions, route_id, stop_id, queried_time)
        ret_predictions.append(new_prediction)
    return ret_predictions


def gen_prediction(prediction, route_id, stop_id, queried_time):
    vehicle = prediction['vehicle']
    minutes = prediction['minutes']
    dir_tag = prediction['dirTag']
    new_prediction = p.Prediction(
        route_id, stop_id, vehicle, minutes, queried_time, dir_tag)
    return new_prediction
