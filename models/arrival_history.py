from datetime import date, datetime, timedelta
import re
import os
import json
import requests
import pandas as pd
from . import nextbus, eclipses
import pytz
import boto3
import gzip

DefaultVersion = 'v2'

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

        columns = ("VID", "TIME", "SID", "DID")
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
                    values = (v, timestamp, s, did)
                    if tz:
                        dt = datetime.fromtimestamp(timestamp, tz)
                        time_str = dt.strftime('%H:%M:%S')
                        if start_time_str is not None and time_str < start_time_str:
                            continue
                        if end_time_str is not None and time_str >= end_time_str:
                            break # arrivals for each stop+direction are in timestamp order, so can stop here
                        values = values + (dt, dt.strftime('%Y-%m-%d'), time_str)

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
            stops_data = data['stops']
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

def compute_from_state(agency, route_id, start_time, end_time, route_state) -> ArrivalHistory:
    # note: arrivals module uses timestamps in seconds, but tryn-api uses ms

    route_config = nextbus.get_route_config(agency, route_id)

    stop_ids = route_config.get_stop_ids()

    buses = eclipses.produce_buses(route_state)

    stops_data = {}
    buses_direction_map = {}

    for stop_id in stop_ids:
        stop_info = route_config.get_stop_info(stop_id)
        stop_direction_ids = route_config.get_directions_for_stop(stop_id)
        stop_directions_data = {}
        for stop_direction_id in stop_direction_ids:
            print(f"route_id={route_id} stop_id={stop_id} direction_id={stop_direction_id}")

            if stop_direction_id not in buses_direction_map:
                buses_direction_map[stop_direction_id] = buses[buses.DID == stop_direction_id]

            buses_direction = buses_direction_map[stop_direction_id]

            e = eclipses.find_eclipses(buses_direction, stop_info)

            nadirs = eclipses.find_nadirs(e)

            if not nadirs.empty:
                arrivals = []
                sorted_nadirs = nadirs.sort_values('TIME')

                def add_arrival(nadir):
                    vid = nadir['VID']
                    time = int(nadir['TIME']/1000)
                    arrivals.append({'t': time, 'v': vid})

                sorted_nadirs.apply(add_arrival, axis=1)
                stop_directions_data[stop_direction_id] = arrivals

        if len(stop_directions_data) > 0:
            stops_data[stop_id] = {
                'arrivals': stop_directions_data
            }

    return ArrivalHistory(agency, route_id, stops_data=stops_data, start_time=start_time, end_time=end_time)

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

    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.join(source_dir, 'data', f"arrivals_{version}_{agency}_{date_str}_{route_id}.json")

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

    with open(cache_path, "w") as f:
        f.write(r.text)

    return ArrivalHistory.from_data(data)

def save_for_date(history: ArrivalHistory, d: date, s3=False):
    data_str = json.dumps(history.get_data())

    version = history.version
    agency = history.agency
    route_id = history.route_id

    cache_path = get_cache_path(agency, route_id, d, version)
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