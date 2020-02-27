import os
import time
import json
import requests
import re
from . import util
import pandas as pd


class StopInfo:
    def __init__(self, route, data):
        self.id = data["tag"]

        if "stopId" in data:
            self.location_id = data["stopId"]
        else:
            self.location_id = self.id
        self.title = data["title"]
        self.lat = float(data["lat"])
        self.lon = float(data["lon"])
        self.route = route


class DirectionInfo:
    def __init__(self, data):
        self.id = data["tag"]
        self.title = data["title"]
        self.name = data["name"]
        self.data = data

    def get_stop_ids(self):
        return [stop["tag"] for stop in self.data["stop"]]


class RouteInfo:
    def __init__(self, nextbus_agency_id, data):
        self.nextbus_agency_id = nextbus_agency_id
        self.id = data["tag"]
        self.title = data["title"]


class RouteConfig:
    def __init__(self, nextbus_agency_id, data):
        self.nextbus_agency_id = nextbus_agency_id
        self.data = data
        self.id = data["tag"]
        self.title = data["title"]

    def get_direction_ids(self):
        return [direction["tag"] for direction in self._get_direction_data()]

    def get_stop_ids(self, direction_id=None):
        if direction_id is None:
            return [stop["tag"] for stop in self.data["stop"]]
        else:
            dir_info = self.get_direction_info(direction_id)
            if dir_info is not None:
                return dir_info.get_stop_ids()
            else:
                return None

    def get_stop_infos(self):
        return [StopInfo(self, stop) for stop in self.data["stop"]]

    def get_stop_info(self, stop_id):
        for stop in self.data["stop"]:
            if stop["tag"] == stop_id:
                return StopInfo(self, stop)
        return None

    def _get_direction_data(self):
        direction_data = self.data["direction"]
        if isinstance(direction_data, dict):
            # nextbus API returns dict if route has only one direction
            return [direction_data]
        else:
            return direction_data

    def get_direction_infos(self):
        return [DirectionInfo(direction) for direction in self._get_direction_data()]

    def get_direction_info(self, direction_id):
        for direction in self._get_direction_data():
            if direction["tag"] == direction_id:
                return DirectionInfo(direction)
        return None

    def get_directions_for_stop(self, stop_id):
        # Most stops appear in one direction for a particular route,
        # but some stops may not appear in any direction,
        # and some stops may appear in multiple directions.
        return [
            direction["tag"]
            for direction in self._get_direction_data()
            for stop in direction["stop"]
            if stop["tag"] == stop_id
        ]


class StopLocationInfo:
    def __init__(self, location_id, lat, lon, title):
        self.id = location_id
        self.lat = lat
        self.lon = lon
        self.title = title
        self.stop_infos = []

    def get_stop_infos(self):
        return self.stop_infos

    def add_stop_info(self, stop_info):
        self.stop_infos.append(stop_info)


class StopLocations:
    def __init__(self, nextbus_agency_id, locations_map):
        self.nextbus_agency_id = nextbus_agency_id
        self.locations_map = locations_map
        self.loc_df = pd.DataFrame(
            [(loc.id, loc.lat, loc.lon) for id, loc in locations_map.items()],
            columns=["LOCATION_ID", "LAT", "LON"],
        )

    def get_data_frame(self):
        return self.loc_df

    def get_location_by_id(self, loc_id):
        if loc_id in self.locations_map:
            return self.locations_map[loc_id]
        else:
            return None


def get_all_stop_locations(nextbus_agency_id) -> StopLocations:
    routes = get_route_list(nextbus_agency_id)
    locations_map = {}
    for route in routes:
        route_config = get_route_config(nextbus_agency_id, route.id)
        for stop_info in route_config.get_stop_infos():
            location_id = stop_info.location_id
            if not location_id in locations_map:
                locations_map[location_id] = StopLocationInfo(
                    stop_info.location_id, stop_info.lat, stop_info.lon, stop_info.title
                )
            locations_map[location_id].add_stop_info(stop_info)
    return StopLocations(nextbus_agency_id, locations_map)


def get_route_list(nextbus_agency_id):

    if re.match("^[\w\-]+$", nextbus_agency_id) is None:
        raise Exception(f"Invalid agency id: {nextbus_agency_id}")

    cache_path = os.path.join(util.get_data_dir(), f"routeList_{nextbus_agency_id}.json")

    def route_list_from_data(data):
        return [RouteInfo(nextbus_agency_id, route) for route in data["route"]]

    try:
        mtime = os.stat(cache_path).st_mtime
        now = time.time()
        if now - mtime < 86400:
            with open(cache_path, mode="r", encoding="utf-8") as f:
                data_str = f.read()
                try:
                    return route_list_from_data(json.loads(data_str))
                except Exception as err:
                    print(err)
    except FileNotFoundError as err:
        pass

    # note: routeList command works for all agencies, while routeConfig fails for agencies with more than 100 routes (like ttc)
    response = requests.get(
        f"http://webservices.nextbus.com/service/publicJSONFeed?command=routeList&a={nextbus_agency_id}&t=0&terse"
    )

    data = response.json()

    if "Error" in data and "content" in data["Error"]:
        raise Exception(data["Error"]["content"])

    if not "route" in data:
        raise Exception(f"Invalid response from Nextbus API: {response.text}")

    with open(cache_path, mode="w", encoding="utf-8") as f:
        f.write(response.text)

    return route_list_from_data(data)


def get_route_config(nextbus_agency_id, route_id) -> RouteConfig:

    if re.match("^[\w\-]+$", nextbus_agency_id) is None:
        raise Exception(f"Invalid agency id: {nextbus_agency_id}")

    if re.match("^[\w\-]+$", route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    # cache route config locally to reduce number of requests to nextbus API and improve performance
    cache_path = os.path.join(
        util.get_data_dir(), f"nextbus_routeConfig_{nextbus_agency_id}_{route_id}.json"
    )

    try:
        mtime = os.stat(cache_path).st_mtime

        now = time.time()

        if now - mtime < 86400:
            with open(cache_path, mode="r", encoding="utf-8") as f:
                data_str = f.read()
                try:
                    jsonRoute = json.loads(data_str)["route"]
                    return RouteConfig(nextbus_agency_id, jsonRoute)
                except Exception as err:
                    print(err)
    except FileNotFoundError as err:
        pass

    response = requests.get(
        f"http://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a={nextbus_agency_id}&r={route_id}&t=0&terse"
    )

    data = response.json()

    if "Error" in data and "content" in data["Error"]:
        raise Exception(data["Error"]["content"])

    if not "route" in data:
        raise Exception(f"Invalid response from Nextbus API: {response.text}")

    with open(cache_path, mode="w", encoding="utf-8") as f:
        f.write(response.text)

    return RouteConfig(nextbus_agency_id, data["route"])
