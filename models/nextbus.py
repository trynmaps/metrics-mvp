import os
import time
import json
import requests
import re

class StopInfo:
    def __init__(self, data):
        self.id = data['tag']
        self.title = data['title']
        self.lat = data['lat']
        self.lon = data['lon']

class DirectionInfo:
    def __init__(self, data):
        self.id = data['tag']
        self.title = data['title']
        self.name = data['name']
        self.data = data

    def get_stop_ids(self):
        return [stop['tag'] for stop in self.data['stop']]

class RouteConfig:
    def __init__(self, data):
        self.data = data
        self.title = data['title']

    def get_direction_ids(self):
        return [direction['tag'] for direction in self.data['direction']]

    def get_stop_ids(self, direction_id = None):
        if direction_id is None:
            return [stop['tag'] for stop in self.data['stop']]
        else:
            dir_info = self.get_direction_info(direction_id)
            if dir_info is not None:
                return dir_info.get_stop_ids()
            else:
                return None

    def get_stop_info(self, stop_id):
        for stop in self.data['stop']:
            if stop['tag'] == stop_id:
                return StopInfo(stop)
        return None

    def get_direction_info(self, direction_id):
        for direction in self.data['direction']:
            if direction['tag'] == direction_id:
                return DirectionInfo(direction)
        return None

    def get_direction_for_stop(self, stop_id):
        for direction in self.data['direction']:
            for stop in direction['stop']:
                if stop['tag'] == stop_id:
                    return direction['tag']
        return None

def get_route_config(agency_id, route_id) -> RouteConfig:
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    # cache route config locally to reduce number of requests to nextbus API and improve performance
    cache_path = os.path.join(source_dir, 'data', f"route_{agency_id}_{route_id}.json")

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
