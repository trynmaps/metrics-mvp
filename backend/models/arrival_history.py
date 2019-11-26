from datetime import date, datetime, timedelta
import re
import os
import json
import requests
import pandas as pd
from . import eclipses, util, config
import boto3
from pathlib import Path
import gzip
import numpy as np

DefaultVersion = 'v4b'

class ArrivalHistory:
    def __init__(self, agency_id: str, route_id, stops_data, start_time = None, end_time = None, version = DefaultVersion):
        self.agency_id = agency_id
        self.route_id = route_id
        self.start_time = start_time
        self.end_time = end_time
        self.stops_data = stops_data
        self.version = version

    def get_data_frame(self, direction_id = None, stop_id = None, vehicle_id = None,
            start_time = None, end_time = None) -> pd.DataFrame:
        '''
        Returns a data frame for a subset of this arrival history, after filtering by the provided parameters:
            stop_id
            vehicle_id
            direction_id
            start_time (unix timestamp)
            end_time (unix timestamp)

        '''
        stops = self.stops_data
        data = []

        has_dist = has_departure_time = self.version and self.version[1] >= '3'
        has_trip = self.version and self.version[1] >= '4'

        columns = ("VID", "TIME", "DEPARTURE_TIME", "SID", "DID", "DIST", "TRIP")

        def add_stop(s):
            stop_info = stops[s]
            for did, arrivals in stop_info['arrivals'].items():
                if direction_id is not None and did != direction_id:
                    continue

                for arrival in arrivals:
                    v = arrival['v']
                    if vehicle_id is not None and v != vehicle_id:
                        continue

                    timestamp = arrival['t']

                    if start_time is not None and timestamp < start_time:
                        continue
                    if end_time is not None and timestamp >= end_time:
                        break # arrivals for each stop+direction are in timestamp order, so can stop here

                    departure_time = arrival['e'] if has_departure_time else timestamp
                    dist = arrival['d'] if has_dist else np.nan

                    trip = arrival['i'] if has_trip else -1

                    data.append((v, timestamp, departure_time, s, did, dist, trip))

        if stop_id is not None:
            if stop_id in stops:
                add_stop(stop_id)
        else:
            for s in stops:
                add_stop(s)

        return pd.DataFrame(data = data, columns = columns)

    def find_closest_arrival_time(self, stop_id, vehicle_id, time):

        closest_time = None
        closest_time_diff = None

        if stop_id in self.stops_data:
            for direction_id, arrivals in self.stops_data[stop_id]['arrivals'].items():
                for arrival in arrivals:
                    if (vehicle_id == arrival['v'] or vehicle_id is None):
                        arrival_time = arrival['t']
                        time_diff = abs(arrival_time - time)
                        if (closest_time is None) or (time_diff < closest_time_diff):
                            closest_time = arrival_time
                            closest_time_diff = time_diff

        return closest_time

    @classmethod
    def from_data(cls, data):
        return cls(
            agency_id = data['agency'],
            route_id = data['route_id'],
            start_time = data['start_time'],
            end_time = data['end_time'],
            stops_data = data['stops'],
            version = data['version'] if 'version' in data else 'v2',
        )

    def get_data(self):
        return {
            'version': self.version,
            'agency': self.agency_id,
            'route_id': self.route_id,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'stops': self.stops_data,
        }

def from_data_frame(agency_id: str, route_id, arrivals_df: pd.DataFrame, start_time, end_time) -> ArrivalHistory:
    # note: arrival_history module uses timestamps in seconds, but tryn-api uses ms
    return ArrivalHistory(agency_id, route_id, stops_data=make_stops_data(arrivals_df), start_time=start_time, end_time=end_time)

def make_stops_data(arrivals: pd.DataFrame):
    stops_data = {}

    if not arrivals.empty:
        arrivals = arrivals.sort_values('TIME')

        for stop_id, stop_arrivals in arrivals.groupby(arrivals['SID']):
            stop_directions_data = {}

            for stop_direction_id, stop_direction_arrivals in stop_arrivals.groupby(stop_arrivals['DID']):
                arrivals_data = []

                for row in stop_direction_arrivals.itertuples():
                    arrivals_data.append({'t': row.TIME, 'e': row.DEPARTURE_TIME, 'd': round(row.DIST), 'v': row.VID, 'i': row.TRIP})

                stop_directions_data[stop_direction_id] = arrivals_data

            stops_data[stop_id] = {
                'arrivals': stop_directions_data
            }
    return stops_data

def get_cache_path(agency_id: str, route_id: str, d: date, version = DefaultVersion) -> str:
    if version is None:
        version = DefaultVersion

    date_str = str(d)
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")

    if re.match('^[\w\-]+$', version) is None:
        raise Exception(f"Invalid version: {version}")

    return os.path.join(util.get_data_dir(), f"arrivals_{version}_{agency_id}/{date_str}/arrivals_{version}_{agency_id}_{date_str}_{route_id}.json")

def get_s3_path(agency_id: str, route_id: str, d: date, version = DefaultVersion) -> str:
    if version is None:
        version = DefaultVersion

    date_str = str(d)
    date_path = d.strftime("%Y/%m/%d")
    return f"arrivals/{version}/{agency_id}/{date_path}/arrivals_{version}_{agency_id}_{date_str}_{route_id}.json.gz"

def get_by_date(agency_id: str, route_id: str, d: date, version = DefaultVersion) -> ArrivalHistory:

    cache_path = get_cache_path(agency_id, route_id, d, version)

    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return ArrivalHistory.from_data(json.loads(text))
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_s3_path(agency_id, route_id, d, version)

    s3_url = f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}"
    r = requests.get(s3_url)

    if r.status_code == 404:
        raise FileNotFoundError(f"{s3_url} not found")
    if r.status_code == 403:
        raise FileNotFoundError(f"{s3_url} not found or access denied")
    if r.status_code != 200:
        raise Exception(f"Error fetching {s3_url}: HTTP {r.status_code}: {r.text}")

    data = json.loads(r.text)

    cache_dir = Path(cache_path).parent
    if not cache_dir.exists():
        cache_dir.mkdir(parents = True, exist_ok = True)

    with open(cache_path, "w") as f:
        f.write(r.text)

    return ArrivalHistory.from_data(data)

def save_for_date(history: ArrivalHistory, d: date, s3=False):
    data_str = json.dumps(history.get_data())

    version = history.version
    agency_id = history.agency_id
    route_id = history.route_id

    cache_path = get_cache_path(agency_id, route_id, d, version)

    cache_dir = Path(cache_path).parent
    if not cache_dir.exists():
        cache_dir.mkdir(parents = True, exist_ok = True)

    with open(cache_path, "w") as f:
        f.write(data_str)

    if s3:
        s3 = boto3.resource('s3')
        s3_path = get_s3_path(agency_id, route_id, d, version)
        s3_bucket = config.s3_bucket
        print(f'saving to s3://{s3_bucket}/{s3_path}')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body=gzip.compress(bytes(data_str, 'utf-8')),
            ContentType='application/json',
            ContentEncoding='gzip',
            ACL='public-read'
        )