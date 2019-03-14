from datetime import date, datetime, timedelta
import re
import os
import json
import requests
import pandas as pd
from . import nextbus, eclipses, trynapi
import pytz

class ArrivalHistory:
    def __init__(self, agency, route_id, start_time, end_time, stops_data):
        self.agency = agency
        self.route_id = route_id
        self.start_time = start_time
        self.end_time = end_time
        self.stops_data = stops_data

    def get_data_frame(self, stop_id = None, vid = None, start_time_str = None, end_time_str = None, tz = None) -> pd.DataFrame:
        '''
        Returns a data frame for a subset of this arrival history, after filtering by the provided parameters:
            stop_id
            vid (vehicle ID)
            start_time_str ("00:00" to "24:00")
            end_time_str ("00:00" to "24:00")

        Local times are computed relative to the provided timezone tz.
        If tz is None, the columns DATE_TIME, DATE_STR, and TIME_STR will not be added, and local time filters will be ignored.
        '''
        stops = self.stops_data
        data = []

        columns = ("VID", "TIME", "SID", "DID")
        if tz:
            columns = columns + ("DATE_TIME", "DATE_STR", "TIME_STR")

        def add_stop(s):
            stop_info = stops[s]
            did = stop_info['did']
            for arrival in stop_info['arrivals']:
                v = arrival['v']
                if vid is None or v == vid:
                    timestamp = arrival['t']
                    values = (v, timestamp, s, did)
                    if tz:
                        dt = datetime.fromtimestamp(timestamp, tz)
                        time_str = dt.strftime('%H:%M:%S')
                        if start_time_str is not None and time_str < start_time_str:
                            continue
                        if end_time_str is not None and time_str >= end_time_str:
                            break # arrivals for each stop are in timestamp order, so can stop here
                        values = values + (dt, dt.strftime('%Y-%m-%d'), time_str)
                    data.append(values)

        if stop_id is not None:
            if stop_id in stops:
                add_stop(stop_id)
        else:
            for s in stops:
                add_stop(s)

        return pd.DataFrame(data = data, columns = columns)

    def find_next_arrival_time(self, stop_id, vid, after_time, before_time = None):
        '''
        Get the next timestamp when vid arrives at stop_id after the timestamp after_time and optionally before the timestamp before_time.
        '''
        if stop_id in self.stops_data:
            for arrival in self.stops_data[stop_id]['arrivals']:
                arrival_time = arrival['t']
                if arrival_time > after_time and (before_time is None or arrival_time < before_time) and (vid == arrival['v'] or vid is None):
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
            'agency': self.agency,
            'route_id': self.route_id,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'stops': self.stops_data,
        }

def compute_from_state(agency, route_id, start_time, end_time) -> ArrivalHistory:
    # note: arrivals module uses timestamps in seconds, but tryn-api uses ms

    config = nextbus.get_route_config(agency, route_id)

    stop_ids = config.get_stop_ids()

    res = trynapi.get_state(agency, start_time*1000, end_time*1000, [route_id])

    if not ('data' in res):
        print('no data')
        return None

    data = res['data']['trynState']['routes']

    stops = eclipses.produce_stops(data, route_id)
    buses = eclipses.produce_buses(data)

    stops_data = {}

    for stop_id in stop_ids:
        print(f"route_id={route_id} stop_id={stop_id}")

        stop = stops[stops['SID'] == stop_id].squeeze()

        if stop.empty:
            print(f"stop {stop_id} not found")
            continue

        stop_did = stop['DID']

        buses_direction = buses[buses['DID'] == stop_did]

        e = eclipses.find_eclipses(buses_direction, stop)

        nadirs = eclipses.find_nadirs(e)

        arrivals = []
        did = stop['DID']

        sorted_nadirs = nadirs.sort_values('TIME')

        def add_arrival(nadir):
            vid = nadir['VID']
            time = int(nadir['TIME']/1000)
            arrivals.append({'t': time, 'v': vid})

        sorted_nadirs.apply(add_arrival,axis=1)

        stops_data[stop_id] = {
            'arrivals': arrivals,
            'did': did,
        }

    return ArrivalHistory(agency, route_id, start_time, end_time, stops_data)

def get_cache_path(agency: str, route_id: str, d: date) -> str:
    date_str = str(d)
    if re.match('^[\w\-]+$', agency) is None:
        raise Exception(f"Invalid agency: {agency}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")

    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.join(source_dir, 'data', f"arrivals_{agency}_{route_id}_{date_str}.json")

def get_s3_bucket() -> str:
    return 'opentransit-stop-arrivals'

def get_s3_path(agency: str, route_id: str, d: date) -> str:
    date_str = str(d)
    date_path = d.strftime("%Y/%m/%d")
    return f"v1/{agency}/{date_path}/arrivals_{agency}_{route_id}_{date_str}.json.gz"

t = None

def get_by_date(agency: str, route_id: str, d: date) -> ArrivalHistory:
    cache_path = get_cache_path(agency, route_id, d)

    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return ArrivalHistory.from_data(json.loads(text))
    except FileNotFoundError as err:
        pass

    s3_bucket = get_s3_bucket()
    s3_path = get_s3_path(agency, route_id, d)

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
