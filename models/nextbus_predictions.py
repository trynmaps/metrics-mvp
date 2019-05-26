import re
import requests
import json
import os
from xml.etree import ElementTree
from datetime import datetime

from models import predictions as p, nextbus

STOPS_STR = '&stops='


'''
Generate a list of strings in the format '&stops={route_id}|{stop_id}...'
Since we can't substitute every stop on every route into an api call at once,
segment the number of strings created by num_stops_per_route
'''


def get_routes_to_stops_str(agency_id: str, num_stops_per_str: int) -> str:
    route_ids = [route.id for route in nextbus.get_route_list(agency_id)]
    route_id_to_stop_ids = {}
    for route_id in route_ids:
        route_config = nextbus.get_route_config(agency_id, route_id)
        route_id_to_stop_ids[route_id] = route_config.get_stop_ids()

    route_strs = []
    num_stops_so_far = 0
    route_str = ''
    for route_id in route_ids:
        ret = gen_stop_str_for_route(
            route_id, route_id_to_stop_ids[route_id], num_stops_so_far)
        route_str += ret['stop_str']
        num_stops_so_far += ret['num_stops_so_far']
        if num_stops_so_far >= num_stops_per_str:
            route_strs.append(route_str)
            route_str = ''
            num_stops_so_far = 0
    return route_strs


def gen_stop_str_for_route(route_id: str, stop_ids: list, num_stops_so_far: int) -> dict:
    num_stops_so_far += len(stop_ids)
    all_stops = STOPS_STR
    stops = [f"{route_id}|{stop_id}" for stop_id in stop_ids]
    all_stops += STOPS_STR.join(stops)
    return {'stop_str': all_stops, 'num_stops_so_far': num_stops_so_far}


def create_predictions_requests(agency_id: str) -> list:
    # TODO: error if response includes error

    # we can maximally add ~400 stops to the string before API complains it's too long
    multi_stops = get_routes_to_stops_str(agency_id, 400)
    requests = []
    for stops in multi_stops:
        requests.append(
            f"http://webservices.nextbus.com/service/publicJSONFeed?command=predictionsForMultiStops&a={agency_id}{stops}")
    return requests


def get_prediction_data(agency_id: str):
    queried_time = datetime.now()
    if re.match(r'^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    # TODO: cache responses
    route_id_to_predictions = {}
    for request_url in create_predictions_requests(agency_id):
        response = requests.get(request_url)
        if response.status_code != 200:
            response.raise_for_status()

        route_id_to_predictions.update(
            parse_prediction_response(queried_time, response))
    return route_id_to_predictions


def parse_prediction_response(queried_time, resp):
    route_id_to_predictions = {}
    resp_json = resp.json()
    predictions_by_route = resp_json['predictions']
    for prediction_info in predictions_by_route:
        # print(prediction_info)
        route_id = prediction_info['routeTag']
        stop_id = prediction_info['stopTag']
        if 'direction' not in prediction_info:
            continue
        directions = prediction_info['direction']
        if isinstance(directions, list):
            # meaning there are multiple directions at this stop
            for direction in directions:
                predictions = direction['prediction']
                curr_map = gen_route_id_to_predictions(
                    route_id, stop_id, queried_time, predictions, route_id_to_predictions)
                route_id_to_predictions.update(curr_map)
        else:
            predictions = directions['prediction']
            curr_map = gen_route_id_to_predictions(
                route_id, stop_id, queried_time, predictions, route_id_to_predictions)
            route_id_to_predictions.update(curr_map)

    return route_id_to_predictions


def gen_route_id_to_predictions(route_id, stop_id: str, queried_time, predictions: list, route_id_to_predictions: dict):
    if isinstance(predictions, list):
        for prediction in predictions:
            new_prediction = gen_prediction(
                prediction, route_id, stop_id, queried_time)
            if route_id not in route_id_to_predictions:
                route_id_to_predictions[route_id] = []
            route_id_to_predictions[route_id].append(new_prediction)
    else:
        new_prediction = gen_prediction(
            predictions, route_id, stop_id, queried_time)
        if route_id not in route_id_to_predictions:
            route_id_to_predictions[route_id] = []
            route_id_to_predictions[route_id].append(new_prediction)
    return route_id_to_predictions


def gen_prediction(prediction, route_id, stop_id, queried_time):
    vehicle = prediction['vehicle']
    minutes = prediction['minutes']
    epoch_time = prediction['epochTime']
    dir_tag = prediction['dirTag']
    new_prediction = p.Prediction(
        route_id, stop_id, vehicle, minutes, epoch_time, queried_time, dir_tag)
    return new_prediction
