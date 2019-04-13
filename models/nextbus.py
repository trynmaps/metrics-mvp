import os
import time
import json
import requests
import re
from . import util

class StopInfo:
    def __init__(self, data):
        self.id = data['tag']
        self.title = data['title']
        self.lat = float(data['lat'])
        self.lon = float(data['lon'])

class DirectionInfo:
    def __init__(self, data):
        self.id = data['tag']
        self.title = data['title']
        self.name = data['name']
        self.data = data

    def get_stop_ids(self):
        return [stop['tag'] for stop in self.data['stop']]

class RouteInfo:
    def __init__(self, data):
        self.id = data['tag']
        self.title = data['title']

class RouteConfig:
    def __init__(self, data):
        self.data = data
        self.id = data['tag']
        self.title = data['title']

    def get_direction_ids(self):
        return [direction['tag'] for direction in self._get_direction_data()]

    def get_stop_ids(self, direction_id = None):
        if direction_id is None:
            return [stop['tag'] for stop in self.data['stop']]
        else:
            dir_info = self.get_direction_info(direction_id)
            if dir_info is not None:
                return dir_info.get_stop_ids()
            else:
                return None

    def get_stop_infos(self):
        return [StopInfo(stop) for stop in self.data['stop']]

    def get_stop_info(self, stop_id):
        for stop in self.data['stop']:
            if stop['tag'] == stop_id:
                return StopInfo(stop)
        return None

    def _get_direction_data(self):
        direction_data = self.data['direction']
        if isinstance(direction_data, dict):
            # nextbus API returns dict if route has only one direction
            return [direction_data]
        else:
            return direction_data

    def get_direction_infos(self):
        return [DirectionInfo(direction) for direction in self._get_direction_data()]

    def get_direction_info(self, direction_id):
        for direction in self._get_direction_data():
            if direction['tag'] == direction_id:
                return DirectionInfo(direction)
        return None

    def get_directions_for_stop(self, stop_id):
        # Most stops appear in one direction for a particular route,
        # but some stops may not appear in any direction,
        # and some stops may appear in multiple directions.
        return [
            direction['tag']
            for direction in self._get_direction_data()
            for stop in direction['stop'] if stop['tag'] == stop_id
        ]

def get_route_list(agency_id):

    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    cache_path = os.path.join(util.get_data_dir(), f"routes_{agency_id}.json")

    def route_list_from_data(data):
        return [RouteInfo(route) for route in data['route']]

    try:
        mtime = os.stat(cache_path).st_mtime
        now = time.time()
        if now - mtime < 86400:
            with open(cache_path, mode='r', encoding='utf-8') as f:
                data_str = f.read()
                try:
                    return route_list_from_data(json.loads(data_str))
                except Exception as err:
                    print(err)
    except FileNotFoundError as err:
        pass

    response = requests.get(f"http://webservices.nextbus.com/service/publicJSONFeed?command=routeList&a={agency_id}&t=0&terse")

    data = response.json()

    if 'Error' in data and 'content' in data['Error']:
        raise Exception(data['Error']['content'])

    if not 'route' in data:
        raise Exception(f"Invalid response from Nextbus API: {response.text}")

    with open(cache_path, mode='w', encoding='utf-8') as f:
        f.write(response.text)

    return route_list_from_data(data)

def get_route_config(agency_id, route_id) -> RouteConfig:

    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    # cache route config locally to reduce number of requests to nextbus API and improve performance
    cache_path = os.path.join(util.get_data_dir(), f"route_{agency_id}_{route_id}.json")

    try:
        mtime = os.stat(cache_path).st_mtime

        now = time.time()

        if now - mtime < 86400:
            with open(cache_path, mode='r', encoding='utf-8') as f:
                data_str = f.read()
                try:
                    return RouteConfig(json.loads(data_str)['route'])
                except Exception as err:
                    print(err)
    except FileNotFoundError as err:
        pass

    response = requests.get(f"http://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a={agency_id}&r={route_id}&t=0&terse")

    data = response.json()

    if 'Error' in data and 'content' in data['Error']:
        raise Exception(data['Error']['content'])

    if not 'route' in data:
        raise Exception(f"Invalid response from Nextbus API: {response.text}")

    with open(cache_path, mode='w', encoding='utf-8') as f:
        f.write(response.text)

    return RouteConfig(data['route'])
