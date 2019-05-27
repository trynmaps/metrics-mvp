from datetime import date, datetime, timedelta
import re
import os
import json
import requests
import pandas as pd
from . import nextbus, eclipses, util
import pytz
import boto3
from pathlib import Path
import gzip
import numpy as np

DefaultVersion = 'v3'

class ArrivalHistory:
    def __init__(self, agency, route_id, stops_data, start_time = None, end_time = None, version = DefaultVersion):
        self.agency = agency
        self.route_id = route_id
        self.start_time = start_time
        self.end_time = end_time
        self.stops_data = stops_data
        self.version = version

    def get_data_frame(self, stop_id = None, vehicle_id = None, direction_id = None,
            start_time_str = None, end_time_str = None,
            tz = None) -> pd.DataFrame:
        '''
        Returns a data frame for a subset of this arrival history, after filtering by the provided parameters:
            stop_id
            vehicle_id
            direction_id
            start_time_str ("00:00" to "24:00")
            end_time_str ("00:00" to "24:00")

        Local times are computed relative to the provided timezone tz.
        If tz is None, the columns DATE_TIME, DATE_STR, and TIME_STR will not be added,
        and local time filters will be ignored.
        '''
        stops = self.stops_data
        data = []

        d = datetime.fromtimestamp(self.start_time, tz).date()

        start_dt = util.get_localized_datetime(d, start_time_str, tz) if start_time_str is not None else None
        end_dt = util.get_localized_datetime(d, end_time_str, tz) if end_time_str is not None else None

        has_dist = has_departure_time = self.version and self.version[1] >= '3'

        columns = ("VID", "TIME", "DEPARTURE_TIME", "SID", "DID", "DIST")
        if tz:
            columns = columns + ("DATE_TIME", "DATE_STR", "TIME_STR")

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

                    departure_time = arrival['e'] if has_departure_time else timestamp
                    dist = arrival['d'] if has_dist else np.nan

                    values = (v, timestamp, departure_time, s, did, dist)
                    if tz:
                        dt = datetime.fromtimestamp(timestamp, tz)
                        if start_dt is not None and dt < start_dt:
                            continue
                        if end_dt is not None and dt >= end_dt:
                            break # arrivals for each stop+direction are in timestamp order, so can stop here
                        values = values + (dt, dt.strftime('%Y-%m-%d'), dt.strftime('%H:%M:%S'))

                    data.append(values)

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

    def find_next_arrival_time(self, stop_id, vehicle_id, after_time, before_time = None):
        '''
        Get the next timestamp when vehicle_id arrives at stop_id
        after the timestamp after_time and optionally before the timestamp before_time.
        '''
        if stop_id in self.stops_data:
            for direction_id, arrivals in self.stops_data[stop_id]['arrivals'].items():
                for arrival in arrivals:
                    arrival_time = arrival['t']
                    # todo: not necessarily the next arrival time if the stop has multiple directions
                    if arrival_time > after_time and \
                        (before_time is None or arrival_time < before_time) and \
                        (vehicle_id == arrival['v'] or vehicle_id is None):
                        return arrival_time
        return None

    @classmethod
    def from_data(cls, data):
        return cls(
            agency = data['agency'],
            route_id = data['route_id'],
            start_time = data['start_time'],
            end_time = data['end_time'],
            stops_data = data['stops'],
            version = data['version'] if 'version' in data else 'v2',
        )

    def get_data(self):
        return {
            'version': self.version,
            'agency': self.agency,
            'route_id': self.route_id,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'stops': self.stops_data,
        }

def compute_from_state(agency, route_id, start_time, end_time, route_state, d: date, tz) -> ArrivalHistory:
    # note: arrivals module uses timestamps in seconds, but tryn-api uses ms

    route_config = nextbus.get_route_config(agency, route_id)

    buses = eclipses.produce_buses(route_state)

    if not buses.empty:
        arrivals = eclipses.find_arrivals(buses, route_config, d, tz)
        stops_data = make_stops_data(arrivals)
    else:
        stops_data = {}

    return ArrivalHistory(agency, route_id, stops_data=stops_data, start_time=start_time, end_time=end_time)

def make_stops_data(arrivals: pd.DataFrame):
    stops_data = {}

    if not arrivals.empty:
        arrivals = arrivals.sort_values('TIME')

        for stop_id, stop_arrivals in arrivals.groupby(arrivals['SID']):
            stop_directions_data = {}

            for stop_direction_id, stop_direction_arrivals in stop_arrivals.groupby(stop_arrivals['STOP_DID']):
                arrivals_data = []

                for row in stop_direction_arrivals.itertuples():
                    arrivals_data.append({'t': row.TIME, 'e': row.DEPARTURE_TIME, 'd': round(row.DIST), 'v': row.VID})

                stop_directions_data[stop_direction_id] = arrivals_data

            stops_data[stop_id] = {
                'arrivals': stop_directions_data
            }
    return stops_data

def get_cache_path(agency: str, route_id: str, d: date, version = DefaultVersion) -> str:
    if version is None:
        version = DefaultVersion

    date_str = str(d)
    if re.match('^[\w\-]+$', agency) is None:
        raise Exception(f"Invalid agency: {agency}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")

    if re.match('^[\w\-]+$', version) is None:
        raise Exception(f"Invalid version: {version}")

    return os.path.join(util.get_data_dir(), f"arrivals_{version}_{agency}/{date_str}/arrivals_{version}_{agency}_{date_str}_{route_id}.json")

def get_s3_bucket() -> str:
    return 'opentransit-stop-arrivals'

def get_s3_path(agency: str, route_id: str, d: date, version = DefaultVersion) -> str:
    if version is None:
        version = DefaultVersion

    date_str = str(d)
    date_path = d.strftime("%Y/%m/%d")
    return f"{version}/{agency}/{date_path}/arrivals_{version}_{agency}_{date_str}_{route_id}.json.gz"

def get_by_date(agency: str, route_id: str, d: date, version = DefaultVersion) -> ArrivalHistory:

    cache_path = get_cache_path(agency, route_id, d, version)

    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return ArrivalHistory.from_data(json.loads(text))
    except FileNotFoundError as err:
        pass

    s3_bucket = get_s3_bucket()
    s3_path = get_s3_path(agency, route_id, d, version)

    s3_url = f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}"
    r = requests.get(s3_url)

    if r.status_code == 404:
        raise FileNotFoundError(f"{s3_url} not found")
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
    agency = history.agency
    route_id = history.route_id

    cache_path = get_cache_path(agency, route_id, d, version)

    cache_dir = Path(cache_path).parent
    if not cache_dir.exists():
        cache_dir.mkdir(parents = True, exist_ok = True)

    with open(cache_path, "w") as f:
        f.write(data_str)

    if s3:
        s3 = boto3.resource('s3')
        s3_path = get_s3_path(agency, route_id, d, version)
        s3_bucket = get_s3_bucket()
        print(f'saving to s3://{s3_bucket}/{s3_path}')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body=gzip.compress(bytes(data_str, 'utf-8')),
            ContentType='application/json',
            ContentEncoding='gzip',
            ACL='public-read'
        )