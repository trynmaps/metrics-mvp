from datetime import date, time, datetime
import pytz
import json
import requests
import re
import numpy as np
import pandas as pd
from pathlib import Path

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

def match_actual_times_to_schedule(actual_times, scheduled_times) -> pd.DataFrame:

    scheduled_headways = np.r_[np.nan, metrics.compute_headway_minutes(scheduled_times)]

    next_scheduled_time_indices = np.searchsorted(scheduled_times, actual_times)
    scheduled_times_padded = np.r_[scheduled_times, np.nan]
    scheduled_headways_padded = np.r_[scheduled_headways, np.nan]

    next_scheduled_times = scheduled_times_padded[next_scheduled_time_indices]
    next_scheduled_headways = scheduled_headways_padded[next_scheduled_time_indices]

    prev_scheduled_times = np.r_[np.nan, scheduled_times][next_scheduled_time_indices]
    prev_scheduled_headways = np.r_[np.nan, scheduled_headways][next_scheduled_time_indices]

    if len(actual_times):
        next_scheduled_time_deltas = actual_times - next_scheduled_times
        prev_scheduled_time_deltas = actual_times - prev_scheduled_times

        np.place(prev_scheduled_time_deltas, np.isnan(prev_scheduled_time_deltas), np.inf)
        np.place(next_scheduled_time_deltas, np.isnan(next_scheduled_time_deltas), -np.inf)

        is_next_closer = (prev_scheduled_time_deltas >= -next_scheduled_time_deltas)
    else:
        is_next_closer = False

    closest_scheduled_times = np.where(is_next_closer, next_scheduled_times, prev_scheduled_times)
    closest_scheduled_headways = np.where(is_next_closer, next_scheduled_headways, prev_scheduled_headways)

    return pd.DataFrame({
        'next_scheduled_time': next_scheduled_times,
        'prev_scheduled_time': prev_scheduled_times,
        'closest_scheduled_time': closest_scheduled_times,
        'closest_scheduled_delta': actual_times - closest_scheduled_times,
        'closest_scheduled_headway': closest_scheduled_headways,
    })

def match_schedule_to_actual_times(scheduled_times, actual_times, early_sec=60, late_sec=300) -> pd.DataFrame:
    # For each scheduled arrival/departure time in the first array, finds the previous, next, and closest actual
    # arrival/departure time from the second array.
    #
    # Each scheduled arrival/departure time is matched with one actual arrival/departure time
    # or np.nan if there was no match.
    #
    # It is possible that some actual arrival/departure times may not match any scheduled arrival/departure times.

    if len(actual_times) > 0:
        actual_headways = np.r_[np.nan, metrics.compute_headway_minutes(actual_times)]

        # determine the next actual arrival time after each scheduled arrival time
        next_actual_time_indices = np.searchsorted(actual_times, scheduled_times)
        actual_times_padded = np.r_[actual_times, np.nan]
        actual_headways_padded = np.r_[actual_headways, np.nan]
        next_actual_times = actual_times_padded[next_actual_time_indices]

        next_actual_headways = actual_headways_padded[next_actual_time_indices]

        next_actual_deltas = next_actual_times - scheduled_times
        np.place(next_actual_deltas, pd.isnull(next_actual_deltas), np.inf)

        # determine the previous actual arrival time before each scheduled arrival time
        prev_actual_times = np.r_[np.nan, actual_times][next_actual_time_indices]

        prev_actual_headways = np.r_[np.nan, actual_headways][next_actual_time_indices]

        prev_actual_deltas = prev_actual_times - scheduled_times
        np.place(prev_actual_deltas, pd.isnull(prev_actual_deltas), -np.inf)

        # determine the 'closest' actual arrival/departure time, either the next or previous.
        # however, if either the previous or next actual arrival/departure time (but not both) are within the on-time interval,
        # then use the one that is within the on-time interval, even if it is not necessarily the closest to the scheduled time

        is_next_closer = (next_actual_deltas <= -prev_actual_deltas)
        prev_on_time = (prev_actual_deltas >= -early_sec)
        next_on_time = (next_actual_deltas <= late_sec)

        next_is_best = (((prev_on_time & next_on_time) | (~prev_on_time & ~next_on_time)) & is_next_closer) | (~prev_on_time & next_on_time)

        closest_actual_times = np.where(next_is_best, next_actual_times, prev_actual_times)
        closest_actual_headways = np.where(next_is_best, next_actual_headways, prev_actual_headways)
        closest_actual_deltas = closest_actual_times - scheduled_times

        # it's possible that one actual arrival may be the closest arrival to multiple scheduled arrival times,
        # for example if some scheduled trips didn't actually occur.
        # find consecutive scheduled times with the same actual arrival time, and ignore all duplicate actual arrival times
        # except the one that is closest to the scheduled time.

        is_new_closest_actual_time = np.diff(closest_actual_times, prepend=-999999) != 0
        is_next_new_closest_actual_time = np.r_[is_new_closest_actual_time[1:], True]

        next_closest_actual_deltas = np.r_[closest_actual_deltas[1:], 999999]
        prev_closest_actual_deltas = np.r_[999999, closest_actual_deltas[:-1]]

        abs_closest_actual_deltas = np.abs(closest_actual_deltas)
        abs_next_closest_actual_deltas = np.abs(next_closest_actual_deltas)
        abs_prev_closest_actual_deltas = np.abs(prev_closest_actual_deltas)

        with np.errstate(invalid="ignore"):
            closer_than_next = is_next_new_closest_actual_time | (abs_closest_actual_deltas <= abs_next_closest_actual_deltas)
            closer_than_prev = (abs_closest_actual_deltas < abs_prev_closest_actual_deltas)

        is_match = (is_new_closest_actual_time & closer_than_next) | (~is_new_closest_actual_time & closer_than_prev & closer_than_next)
        no_match = ~is_match

        matching_actual_times = np.where(no_match, np.nan, closest_actual_times)
        matching_actual_headways = np.where(no_match, np.nan, closest_actual_headways)
        matching_actual_deltas = np.where(no_match, np.inf, closest_actual_deltas)

        # in some situations, a particular actual arrival time may not be the closest arrival time to any scheduled arrival time,
        # so matching_actual_times will have np.nan in that position even though the scheduled trip did actually occur.
        # to handle this case, determine if the previous or next actual arrival time didn't match the previous or next scheduled arrival time.
        # if this is the case, use this time to replace np.nan in matching_actual_times.

        if len(scheduled_times):
            prev_matching_arrivals = np.r_[np.nan, matching_actual_times[:-1]]
            next_matching_arrivals = np.r_[matching_actual_times[1:], np.nan]

            prev_is_unmatched = no_match & np.greater(prev_actual_times, prev_matching_arrivals, where=(np.isfinite(prev_actual_times) & np.isfinite(prev_matching_arrivals)))
            next_is_unmatched = no_match & ~prev_is_unmatched & np.less(next_actual_times, next_matching_arrivals, where=(np.isfinite(next_actual_times) & np.isfinite(next_matching_arrivals)))

            matching_actual_times = np.where(prev_is_unmatched, prev_actual_times, matching_actual_times)
            matching_actual_headways = np.where(prev_is_unmatched, prev_actual_headways, matching_actual_headways)
            matching_actual_deltas = np.where(prev_is_unmatched, prev_actual_deltas, matching_actual_deltas)

            matching_actual_times = np.where(next_is_unmatched, next_actual_times, matching_actual_times)
            matching_actual_headways = np.where(next_is_unmatched, next_actual_headways, matching_actual_headways)
            matching_actual_deltas = np.where(next_is_unmatched, next_actual_deltas, matching_actual_deltas)

            is_match = is_match | prev_is_unmatched | next_is_unmatched
            no_match = ~is_match

        with np.errstate(invalid="ignore"):
            early = is_match & (matching_actual_deltas < -early_sec)
            late = is_match & (matching_actual_deltas > late_sec)

        on_time = is_match & ~early & ~late
    else: # no actual times
        num_scheduled = len(scheduled_times)
        early = late = on_time = np.full(num_scheduled, False)
        no_match = np.full(num_scheduled, True)

        matching_actual_headways = matching_actual_deltas = matching_actual_times = \
            closest_actual_headways = closest_actual_deltas = closest_actual_times = \
            next_actual_headways = next_actual_deltas = next_actual_times = \
            prev_actual_headways = prev_actual_deltas = prev_actual_times = np.full(num_scheduled, np.nan)

    return pd.DataFrame({
        'prev_actual_time': prev_actual_times,
        'prev_actual_delta': prev_actual_deltas,
        'prev_actual_headway': prev_actual_headways,

        'next_actual_time': next_actual_times,
        'next_actual_delta': next_actual_deltas,
        'next_actual_headway': next_actual_headways,

        'closest_actual_time': closest_actual_times,
        'closest_actual_delta': closest_actual_deltas,
        'closest_actual_headway': closest_actual_headways,

        'matching_actual_time': matching_actual_times,
        'matching_actual_delta': matching_actual_deltas,
        'matching_actual_headway': matching_actual_headways,

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
