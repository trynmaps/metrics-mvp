from datetime import date, time, datetime
import pytz
import json
import requests
import re
import numpy as np
import pandas as pd

from . import config, util, metrics

DefaultVersion = 'v1'

class Timetable:
    def __init__(self, agency_id, route_id, arrivals_data, date_start_time):
        self.agency_id = agency_id
        self.route_id = route_id
        self.arrivals_data = arrivals_data
        self.date_start_time = date_start_time

    def get_data_frame(self, direction_id = None, stop_id = None,
            start_time = None, end_time = None) -> pd.DataFrame:
        '''
        Returns a data frame for a subset of this timetable, after filtering by the provided parameters:
            stop_id
            vehicle_id
            direction_id
            start_time (unix timestamp)
            end_time (unix timestamp)

        '''
        arrivals_by_direction = self.arrivals_data
        data = []

        columns = ("TIME", "DEPARTURE_TIME", "SID", "DID", "TRIP")

        date_start_time = self.date_start_time

        def add_direction(did):
            stops_map = arrivals_by_direction[did]

            def add_stop(sid):
                stop_arrivals = stops_map[sid]
                for arrival in stop_arrivals:
                    arrival_time_offset = arrival['t']

                    arrival_time = date_start_time + arrival_time_offset

                    if start_time is not None and arrival_time < start_time:
                        continue
                    if end_time is not None and arrival_time >= end_time:
                        continue

                    departure_time = (arrival['e'] + date_start_time) if 'e' in arrival else arrival_time
                    trip = arrival['i']
                    data.append((arrival_time, departure_time, sid, did, trip))

            if stop_id is not None:
                if stop_id in stops_map:
                    add_stop(stop_id)
            else:
                for sid in stops_map:
                    add_stop(sid)

        if direction_id is not None:
            if direction_id in arrivals_by_direction:
                add_direction(direction_id)
        else:
            for did in arrivals_by_direction:
                add_direction(did)

        return pd.DataFrame(data = data, columns = columns)

def get_by_date(agency_id: str, route_id: str, d: date, version = DefaultVersion) -> Timetable:
    date_key = get_date_key(agency_id, d, version)
    data = get_data_by_date_key(agency_id, route_id, date_key, version)

    timezone_id = data['timezone_id']
    tz = pytz.timezone(timezone_id)

    date_start_time = int(tz.localize(datetime.combine(d, time())).timestamp())

    return Timetable(
        agency_id = agency_id,
        route_id = route_id,
        arrivals_data = data['arrivals'],
        date_start_time = date_start_time
    )

def match_arrivals_to_schedule(arrivals, scheduled_arrivals) -> pd.DataFrame:

    scheduled_headways = np.r_[np.nan, metrics.compute_headway_minutes(scheduled_arrivals)]

    next_scheduled_arrival_indices = np.searchsorted(scheduled_arrivals, arrivals)
    scheduled_arrivals_padded = np.r_[scheduled_arrivals, np.nan]
    scheduled_headways_padded = np.r_[scheduled_headways, np.nan]

    next_scheduled_arrivals = scheduled_arrivals_padded[next_scheduled_arrival_indices]
    next_scheduled_headways = scheduled_headways_padded[next_scheduled_arrival_indices]

    prev_scheduled_arrivals = np.r_[np.nan, scheduled_arrivals][next_scheduled_arrival_indices]
    prev_scheduled_headways = np.r_[np.nan, scheduled_headways][next_scheduled_arrival_indices]

    if len(arrivals):
        next_scheduled_arrival_deltas = arrivals - next_scheduled_arrivals
        prev_scheduled_arrival_deltas = arrivals - prev_scheduled_arrivals

        np.place(prev_scheduled_arrival_deltas, np.isnan(prev_scheduled_arrival_deltas), np.inf)
        np.place(next_scheduled_arrival_deltas, np.isnan(next_scheduled_arrival_deltas), -np.inf)

        is_next_closer = (prev_scheduled_arrival_deltas >= -next_scheduled_arrival_deltas)
    else:
        is_next_closer = False

    closest_scheduled_arrivals = np.where(is_next_closer, next_scheduled_arrivals, prev_scheduled_arrivals)
    closest_scheduled_headways = np.where(is_next_closer, next_scheduled_headways, prev_scheduled_headways)

    return pd.DataFrame({
        'next_scheduled_arrival': next_scheduled_arrivals,
        'prev_scheduled_arrival': prev_scheduled_arrivals,
        'closest_scheduled_arrival': closest_scheduled_arrivals,
        'closest_scheduled_delta': arrivals - closest_scheduled_arrivals,
        'closest_scheduled_headway': closest_scheduled_headways,
    })

def match_schedule_to_arrivals(scheduled_arrivals, arrivals, early_sec=60, late_sec=300) -> pd.DataFrame:
    # For each scheduled arrival time in the first array, finds the previous, next, and closest actual
    # arrival time from the second array.
    #
    # Each scheduled arrival time is matched with one actual arrival time
    # or np.nan if there was no match.
    #
    # It is possible that some actual arrival times may not match any scheduled arrival times.

    arrival_headways = np.r_[np.nan, metrics.compute_headway_minutes(arrivals)]

    # determine the next actual arrival time after each scheduled arrival time
    next_arrival_indices = np.searchsorted(arrivals, scheduled_arrivals)
    arrivals_padded = np.r_[arrivals, np.nan]
    headways_padded = np.r_[arrival_headways, np.nan]
    next_arrivals = arrivals_padded[next_arrival_indices]

    next_arrival_headways = headways_padded[next_arrival_indices]

    next_arrival_deltas = next_arrivals - scheduled_arrivals
    np.place(next_arrival_deltas, pd.isnull(next_arrival_deltas), np.inf)

    # determine the previous actual arrival time before each scheduled arrival time
    prev_arrivals = np.r_[np.nan, arrivals][next_arrival_indices]

    prev_arrival_headways = np.r_[np.nan, arrival_headways][next_arrival_indices]

    prev_arrival_deltas = prev_arrivals - scheduled_arrivals
    np.place(prev_arrival_deltas, pd.isnull(prev_arrival_deltas), -np.inf)

    # determine the 'closest' actual arrival time, either the next or previous.
    # however, if either the previous or next actual arrival time (but not both) are within the on-time interval,
    # then use the one that is within the on-time interval, even if it is not necessarily the closest to the scheduled time

    is_next_closer = (next_arrival_deltas <= -prev_arrival_deltas)
    prev_on_time = (prev_arrival_deltas >= -early_sec)
    next_on_time = (next_arrival_deltas <= late_sec)

    next_is_best = (((prev_on_time & next_on_time) | (~prev_on_time & ~next_on_time)) & is_next_closer) | (~prev_on_time & next_on_time)

    closest_arrivals = np.where(next_is_best, next_arrivals, prev_arrivals)
    closest_arrival_headways = np.where(next_is_best, next_arrival_headways, prev_arrival_headways)
    closest_arrival_deltas = closest_arrivals - scheduled_arrivals

    # it's possible that one actual arrival may be the closest arrival to multiple scheduled arrival times,
    # for example if some scheduled trips didn't actually occur.
    # find consecutive scheduled times with the same actual arrival time, and ignore all duplicate actual arrival times
    # except the one that is closest to the scheduled time.

    is_new_closest_arrival = np.diff(closest_arrivals, prepend=-999999) != 0
    is_next_new_closest_arrival = np.r_[is_new_closest_arrival[1:], True]

    next_closest_arrival_deltas = np.r_[closest_arrival_deltas[1:], 999999]
    prev_closest_arrival_deltas = np.r_[999999, closest_arrival_deltas[:-1]]

    abs_closest_arrival_deltas = np.abs(closest_arrival_deltas)
    abs_next_closest_arrival_deltas = np.abs(next_closest_arrival_deltas)
    abs_prev_closest_arrival_deltas = np.abs(prev_closest_arrival_deltas)

    closer_than_next = is_next_new_closest_arrival | (abs_closest_arrival_deltas <= abs_next_closest_arrival_deltas)
    closer_than_prev = (abs_closest_arrival_deltas < abs_prev_closest_arrival_deltas)

    is_match = (is_new_closest_arrival & closer_than_next) | (~is_new_closest_arrival & closer_than_prev & closer_than_next)
    no_match = ~is_match

    matching_arrivals = np.where(no_match, np.nan, closest_arrivals)
    matching_arrival_headways = np.where(no_match, np.nan, closest_arrival_headways)
    matching_arrival_deltas = np.where(no_match, np.inf, closest_arrival_deltas)

    # in some situations, a particular actual arrival time may not be the closest arrival time to any scheduled arrival time,
    # so matching_arrivals will have np.nan in that position even though the scheduled trip did actually occur.
    # to handle this case, determine if the previous or next actual arrival time didn't match the previous or next scheduled arrival time.
    # if this is the case, use this time to replace np.nan in matching_arrivals.

    if len(scheduled_arrivals):
        prev_matching_arrivals = np.r_[np.nan, matching_arrivals[:-1]]
        next_matching_arrivals = np.r_[matching_arrivals[1:], np.nan]

        prev_is_unmatched = no_match & np.greater(prev_arrivals, prev_matching_arrivals, where=(np.isfinite(prev_arrivals) & np.isfinite(prev_matching_arrivals)))
        next_is_unmatched = no_match & ~prev_is_unmatched & np.less(next_arrivals, next_matching_arrivals, where=(np.isfinite(next_arrivals) & np.isfinite(next_matching_arrivals)))

        matching_arrivals = np.where(prev_is_unmatched, prev_arrivals, matching_arrivals)
        matching_arrival_headways = np.where(prev_is_unmatched, prev_arrival_headways, matching_arrival_headways)
        matching_arrival_deltas = np.where(prev_is_unmatched, prev_arrival_deltas, matching_arrival_deltas)

        matching_arrivals = np.where(next_is_unmatched, next_arrivals, matching_arrivals)
        matching_arrival_headways = np.where(next_is_unmatched, next_arrival_headways, matching_arrival_headways)
        matching_arrival_deltas = np.where(next_is_unmatched, next_arrival_deltas, matching_arrival_deltas)

        is_match = is_match | prev_is_unmatched | next_is_unmatched
        no_match = ~is_match

    early = is_match & (matching_arrival_deltas < -early_sec)
    late = is_match & (matching_arrival_deltas > late_sec)
    on_time = is_match & ~early & ~late

    return pd.DataFrame({
        'prev_arrival': prev_arrivals,
        'prev_arrival_delta': prev_arrival_deltas,
        'prev_arrival_headway': prev_arrival_headways,

        'next_arrival': next_arrivals,
        'next_arrival_delta': next_arrival_deltas,
        'next_arrival_headway': next_arrival_headways,

        'closest_arrival': closest_arrivals,
        'closest_arrival_delta': closest_arrival_deltas,
        'closest_arrival_headway': closest_arrival_headways,

        'matching_arrival': matching_arrivals,
        'matching_arrival_delta': matching_arrival_deltas,
        'matching_arrival_headway': matching_arrival_headways,

        'on_time': on_time,
        'late': late,
        'early': early,
        'no_match': no_match,
    })

def get_data_by_date_key(agency_id: str, route_id: str, date_key: str, version = DefaultVersion) -> Timetable:
    cache_path = get_cache_path(agency_id, route_id, date_key, version)
    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return json.loads(text)
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_s3_path(agency_id, route_id, date_key, version)

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

    return data

def get_cache_path(agency_id, route_id, date_key, version = DefaultVersion):
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    if re.match('^[\w\-]+$', date_key) is None:
        raise Exception(f"Invalid date key: {date_key}")

    if re.match('^[\w\-]+$', version) is None:
        raise Exception(f"Invalid version: {version}")

    return f"{util.get_data_dir()}/timetables_{version}_{agency_id}/{date_key}/timetables_{version}_{agency_id}_{date_key}_{route_id}.json"

def get_s3_path(agency_id, route_id, date_key, version=DefaultVersion):
    return f'timetables/{version}/{agency_id}/{date_key}/timetables_{version}_{agency_id}_{date_key}_{route_id}.json.gz'

def get_date_key(agency_id, d: date, version = DefaultVersion):
    date_keys = get_date_keys(agency_id, version)
    return date_keys[str(d)]

def get_date_keys(agency_id, version = DefaultVersion):
    cache_path = get_date_keys_cache_path(agency_id, version)

    try:
        with open(cache_path, "r") as f:
            data = json.loads(f.read())
            return data['date_keys']
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_date_keys_s3_path(agency_id, version)

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

    return data['date_keys']

def get_date_keys_cache_path(agency_id, version = DefaultVersion):
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    return f"{util.get_data_dir()}/datekeys_{version}_{agency_id}/datekeys_{version}_{agency_id}.json"

def get_date_keys_s3_path(agency_id, version=DefaultVersion):
    return f'datekeys/{version}/datekeys_{version}_{agency_id}.json.gz'
