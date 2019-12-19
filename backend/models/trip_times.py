import numpy as np
import sortednp as snp
from datetime import date
import re
import requests
from pathlib import Path
import json
from . import util, config

def get_completed_trip_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values,
    assume_sorted=False):
    # Returns an array of trip times in minutes from stop s1 to stop s2
    # for trip IDs contained in both s1_trip_values and s2_trip_values.
    #
    # s1_trip_values and s1_departure_time_values are parallel arrays.
    # s2_trip_values and s2_arrival_time_values are parallel arrays.
    #
    # The s1 arrays and s2 arrays may have different lengths.
    #
    # The trip times are not necessarily parallel to s1 or s2 arrays.
    #
    # If assume_sorted is true, the s1 and s2 arrays should already be sorted by trip ID (not by time).

    if not assume_sorted:
        s1_trip_values, s1_departure_time_values = sort_parallel(s1_trip_values, s1_departure_time_values)
        s2_trip_values, s2_arrival_time_values = sort_parallel(s2_trip_values, s2_arrival_time_values)

    # if s1_trip_values and s2_trip_values are empty, this throws a ValueError
    if (len(s1_trip_values) > 0) and (len(s2_trip_values) > 0):
        _, (s1_indexes, s2_indexes) = snp.intersect(s1_trip_values, s2_trip_values, indices=True)

        return (s2_arrival_time_values[s2_indexes] - s1_departure_time_values[s1_indexes]) / 60
    else:
        return []

def get_matching_trips_and_arrival_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values):

    # Returns a tuple (array of trip times in minutes, array of s2 arrival times).
    # The returned arrays are parallel to s1_trip_values and s1_departure_time_values.
    #
    # If no matching trip was found in s2_trip_values, the returned arrays will have the value np.nan
    # at that index.
    #
    # The input arrays do not need to be sorted.

    sort_order = np.argsort(s1_trip_values)
    sorted_s1_trip_values = s1_trip_values[sort_order]

    sorted_s2_trip_values, sorted_s2_arrival_time_values = sort_parallel(s2_trip_values, s2_arrival_time_values)

    _, (sorted_s1_indexes, sorted_s2_indexes) = snp.intersect(sorted_s1_trip_values, sorted_s2_trip_values, indices=True)

    # start with an array of all nans
    s1_s2_arrival_time_values = np.full(len(s1_trip_values), np.nan)

    # find original s1 indexes corresponding to sorted s1 indexes
    result_indexes = sort_order[sorted_s1_indexes]

    s1_s2_arrival_time_values[result_indexes] = sorted_s2_arrival_time_values[sorted_s2_indexes]

    trip_min = (s1_s2_arrival_time_values - s1_departure_time_values) / 60

    return trip_min, s1_s2_arrival_time_values

def sort_parallel(arr, arr2):
    sort_order = np.argsort(arr)
    return arr[sort_order], arr2[sort_order]

DefaultVersion = 'v1c'

class CachedTripTimes:
    def __init__(self, trip_times_data):
        self.trip_times_data = trip_times_data

    def get_value(self, route_id, direction_id, start_stop_id, end_stop_id):
        routes_data = self.trip_times_data['routes']

        if route_id not in routes_data:
            return None

        route_data = routes_data[route_id]

        if direction_id not in route_data:
            return None

        direction_data = route_data[direction_id]

        if start_stop_id not in direction_data:
            return None

        start_stop_data = direction_data[start_stop_id]

        if end_stop_id not in start_stop_data:
            return None

        return start_stop_data[end_stop_id]

def get_cached_trip_times(agency_id, d: date, stat_id: str, start_time_str = None, end_time_str = None, version = DefaultVersion) -> CachedTripTimes:
    cache_path = get_cache_path(agency_id, d, stat_id, start_time_str, end_time_str, version)

    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return CachedTripTimes(json.loads(text))
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_s3_path(agency_id, d, stat_id, start_time_str, end_time_str, version)

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

    return CachedTripTimes(data)

def get_time_range_path(start_time_str, end_time_str):
    if start_time_str is None and end_time_str is None:
        return ''
    else:
        return f'_{start_time_str.replace(":","")}_{end_time_str.replace(":","")}'

def get_s3_path(agency_id: str, d: date, stat_id, start_time_str = None, end_time_str = None, version = DefaultVersion) -> str:
    time_range_path = get_time_range_path(start_time_str, end_time_str)
    date_str = str(d)
    date_path = d.strftime("%Y/%m/%d")
    return f"trip-times/{version}/{agency_id}/{date_path}/trip-times_{version}_{agency_id}_{date_str}_{stat_id}{time_range_path}.json.gz"

def get_cache_path(agency_id: str, d: date, stat_id: str, start_time_str = None, end_time_str = None, version = DefaultVersion) -> str:
    time_range_path = get_time_range_path(start_time_str, end_time_str)

    date_str = str(d)
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

    if re.match('^[\w\-]+$', date_str) is None:
        raise Exception(f"Invalid date: {date_str}")

    if re.match('^[\w\-]+$', version) is None:
        raise Exception(f"Invalid version: {version}")

    if re.match('^[\w\-]+$', stat_id) is None:
        raise Exception(f"Invalid stat id: {stat_id}")

    if re.match('^[\w\-\+]*$', time_range_path) is None:
        raise Exception(f"Invalid time range: {time_range_path}")

    return f'{util.get_data_dir()}/trip-times_{version}_{agency_id}/{date_str}/trip-times_{version}_{agency_id}_{date_str}_{stat_id}{time_range_path}.json'
