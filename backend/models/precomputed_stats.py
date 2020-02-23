from . import util, config
from datetime import date
import re
import requests
from pathlib import Path
import json
import boto3
import gzip

DefaultVersion = 'v1'

class PrecomputedStats:
    def __init__(self, data):
        self.data = data

    def get_direction_stats(self, route_id, direction_id):
        routes_data = self.data['routes']

        route_data = routes_data.get(route_id, None)

        if route_data is None:
            return None

        return route_data['directions'].get(direction_id, None)

    def get_trip_time_stats(self, route_id, direction_id, start_stop_id, end_stop_id):
        dir_stats = self.get_direction_stats(route_id, direction_id)
        if dir_stats is None:
            return None

        trip_time_stats = dir_stats.get('tripTimes', None)
        if trip_time_stats is None:
            return None

        start_stop_stats = trip_time_stats.get(start_stop_id, None)
        if start_stop_stats is None:
            return None

        return start_stop_stats.get(end_stop_id, None)

    def get_median_trip_time(self, route_id, direction_id, start_stop_id, end_stop_id):
        trip_time_stats = self.get_trip_time_stats(route_id, direction_id, start_stop_id, end_stop_id)
        if trip_time_stats is None:
            return None
        return trip_time_stats[1]

    def get_p10_trip_time(self, route_id, direction_id, start_stop_id, end_stop_id):
        trip_time_stats = self.get_trip_time_stats(route_id, direction_id, start_stop_id, end_stop_id)
        if trip_time_stats is None:
            return None
        return trip_time_stats[0]

    def get_p90_trip_time(self, route_id, direction_id, start_stop_id, end_stop_id):
        trip_time_stats = self.get_trip_time_stats(route_id, direction_id, start_stop_id, end_stop_id)
        if trip_time_stats is None:
            return None
        return trip_time_stats[2]

    def get_num_trips(self, route_id, direction_id, start_stop_id, end_stop_id):
        trip_time_stats = self.get_trip_time_stats(route_id, direction_id, start_stop_id, end_stop_id)
        if trip_time_stats is None:
            return None
        return trip_time_stats[3]

    def get_median_wait_time(self, route_id, direction_id, stop_id):
        dir_stats = self.get_direction_stats(route_id, direction_id)
        if dir_stats is None:
            return None

        median_wait_times = dir_stats.get('medianWaitTimes', None)
        if median_wait_times is None:
            return None

        return median_wait_times.get(stop_id, None)

    def get_on_time_rate(self, route_id, direction_id, stop_id):
        dir_stats = self.get_direction_stats(route_id, direction_id)
        if dir_stats is None:
            return None

        on_time_rates = dir_stats.get('onTimeRates', None)
        if on_time_rates is None:
            return None

        return on_time_rates.get(stop_id, None)

def get_precomputed_stats(agency_id, stat_id: str, d: date, start_time_str = None, end_time_str = None, version = DefaultVersion) -> PrecomputedStats:
    cache_path = get_cache_path(agency_id, stat_id, d, start_time_str, end_time_str, version)

    try:
        text = util.read_from_file(cache_path)
        return PrecomputedStats(json.loads(text))
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_s3_path(agency_id, stat_id, d, start_time_str, end_time_str, version)

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

    util.write_to_file(cache_path, r.text)
    return PrecomputedStats(data)

def get_time_range_path(start_time_str, end_time_str):
    if start_time_str is None and end_time_str is None:
        return ''
    else:
        return f'_{start_time_str.replace(":","")}_{end_time_str.replace(":","")}'

def get_s3_path(agency_id: str, stat_id: str, d: date, start_time_str, end_time_str, version = DefaultVersion) -> str:
    time_range_path = get_time_range_path(start_time_str, end_time_str)
    date_str = str(d)
    date_path = d.strftime("%Y/%m/%d")
    return f"precomputed-stats/{version}/{agency_id}/{date_path}/precomputed-stats_{version}_{agency_id}_{stat_id}_{date_str}{time_range_path}.json.gz"

def get_cache_path(agency_id: str, stat_id: str, d: date, start_time_str, end_time_str, version = DefaultVersion) -> str:
    time_range_path = get_time_range_path(start_time_str, end_time_str)

    date_str = str(d)
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

    if re.match('^[\w\-]+$', stat_id) is None:
        raise Exception(f"Invalid stat id: {stat_id}")

    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")

    if re.match('^[\w\-]+$', version) is None:
        raise Exception(f"Invalid version: {version}")

    if re.match('^[\w\-\+]*$', time_range_path) is None:
        raise Exception(f"Invalid time range: {time_range_path}")

    return f'{util.get_data_dir()}/precomputed-stats_{version}_{agency_id}/{date_str}/precomputed-stats_{version}_{agency_id}_{stat_id}_{date_str}{time_range_path}.json'

def save_stats(agency_id, stat_id, d, start_time_str, end_time_str, data, save_to_s3=False):
    data_str = json.dumps({
        'version': DefaultVersion,
        'stat_id': stat_id,
        'start_time': start_time_str,
        'end_time': end_time_str,
        **data
    }, separators=(',', ':'))

    cache_path = get_cache_path(agency_id, stat_id, d, start_time_str, end_time_str)

    cache_dir = Path(cache_path).parent
    if not cache_dir.exists():
        cache_dir.mkdir(parents = True, exist_ok = True)

    print(f'saving to {cache_path}')

    util.write_to_file(cache_path, data_str)
    if save_to_s3:
        s3 = boto3.resource('s3')
        s3_path = get_s3_path(agency_id, stat_id, d, start_time_str, end_time_str)
        s3_bucket = config.s3_bucket
        print(f'saving to s3://{s3_bucket}/{s3_path}')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body=gzip.compress(bytes(data_str, 'utf-8')),
            CacheControl='max-age=86400',
            ContentType='application/json',
            ContentEncoding='gzip',
            ACL='public-read'
        )
