import requests
import os
import re
import json
import math
from . import config
import time
from pathlib import Path
from datetime import date
import pandas as pd

class CachedState:
    def __init__(self):
        self.cache_paths = {}

    def add(self, route_id, cache_path):
        self.cache_paths[route_id] = cache_path

    def get_for_route(self, route_id) -> pd.DataFrame:
        if route_id not in self.cache_paths:
            return None

        cache_path = self.cache_paths[route_id]
        print(f'loading state for route {route_id} from cache: {cache_path}')
        buses = pd.read_csv(
                cache_path,
                dtype={
                    'vid': str,
                    'did': str,
                },
                float_precision='high', # keep precision for rounding lat/lon
            ) \
            .rename(columns={
                'lat': 'LAT',
                'lon': 'LON',
                'vid': 'VID',
                'did': 'DID',
                'secsSinceReport': 'AGE',
                'timestamp': 'RAW_TIME'
            }) \
            .reindex(['RAW_TIME', 'VID', 'LAT', 'LON', 'DID', 'AGE'], axis='columns')

        # adjust each observation time for the number of seconds old the GPS location was when the observation was recorded
        buses['TIME'] = (buses['RAW_TIME'] - buses['AGE'].fillna(0)) #.astype(np.int64)

        buses = buses.drop(['RAW_TIME','AGE'], axis=1)
        buses = buses.sort_values('TIME', axis=0)

        return buses

def get_state(agency_id: str, d: date, start_time, end_time, route_ids) -> CachedState:
    # don't try to fetch historical vehicle data from the future
    now = int(time.time())
    if end_time > now:
        end_time = now
        print(f'end_time set to current time ({end_time})')

    # saves state to local file system, since keeping the state for all routes in memory
    # while computing arrival times causes causes Python to spend more time doing GC
    state = CachedState()

    uncached_route_ids = []
    for route_id in route_ids:
        cache_path = get_cache_path(agency_id, d, start_time, end_time, route_id)
        if Path(cache_path).exists():
            state.add(route_id, cache_path)
        else:
            uncached_route_ids.append(route_id)

    if len(uncached_route_ids) == 0:
        print('state already cached')
        return state

    # Request data from trynapi in smaller chunks to avoid internal server errors.
    # The more routes we have, the smaller our chunk size needs to be in order to
    # avoid getting internal server errors from trynapi.

    # likely need to set smaller max chunk size via TRYNAPI_MAX_CHUNK env var
    # if trynapi is reading from orion-raw bucket because trynapi loads a ton of extra
    # unused data into memory from the restbus API output, mostly from the _links field
    # returned by http://restbus.info/api/agencies/sf-muni/vehicles
    # which causes the memory usage to be probably 5x higher
    trynapi_max_chunk = os.environ.get('TRYNAPI_MAX_CHUNK')
    if trynapi_max_chunk is None:
        trynapi_max_chunk = 720
    else:
        trynapi_max_chunk = int(trynapi_max_chunk)
    trynapi_min_chunk = 15

    chunk_minutes = math.ceil(trynapi_max_chunk / len(route_ids))
    chunk_minutes = max(chunk_minutes, trynapi_min_chunk)

    print(f"chunk_minutes = {chunk_minutes}")

    chunk_start_time = start_time
    allow_chunk_error = True # allow up to one trynapi error before raising an exception

    state_cache_dir = Path(get_state_cache_dir(agency_id))
    if not state_cache_dir.exists():
        state_cache_dir.mkdir(parents = True, exist_ok = True)

    remove_route_temp_cache(agency_id)
    while chunk_start_time < end_time:
        # download trynapi data in chunks; each call return data for all routes
        chunk_end_time = min(chunk_start_time + 60 * chunk_minutes, end_time)
        chunk_states = get_chunk_state(
            agency_id,
            chunk_start_time,
            chunk_end_time,
            uncached_route_ids,
            chunk_minutes,
            allow_chunk_error,
        )
        chunk_start_time = chunk_end_time
        if chunk_states == False:
            allow_chunk_error = False
            continue
        for chunk_state in chunk_states:
            write_chunk_state(chunk_state, agency_id)

    # cache state per route so we don't have to request it again
    # if a route appears in a different list of routes
    for route_id in uncached_route_ids:
        cache_path = get_cache_path(agency_id, d, start_time, end_time, route_id)

        cache_dir = Path(cache_path).parent
        if not cache_dir.exists():
            cache_dir.mkdir(parents = True, exist_ok = True)

        temp_cache_path = get_route_temp_cache_path(agency_id, route_id)
        if not os.path.exists(temp_cache_path):
            # create empty cache file so that get_state doesn't need to request routes with no data again
            # if it is called again later
            write_csv_header(temp_cache_path)

        os.rename(temp_cache_path, cache_path)

        state.add(route_id, cache_path)

    return state


def validate_agency_id(agency_id: str):
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

def validate_agency_route_path_attributes(agency_id: str, route_id: str):
    validate_agency_id(agency_id)

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

def get_state_cache_dir(agency_id):
    validate_agency_id(agency_id)
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.join(
        source_dir,
        'data',
        f"state_v2_{agency_id}",
    )

def get_route_temp_cache_path(agency_id: str, route_id: str) -> str:
    validate_agency_route_path_attributes(agency_id, route_id)
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.join(
        get_state_cache_dir(agency_id),
        f"state_{agency_id}_{route_id}_temp_cache.csv",
    )

def remove_route_temp_cache(agency_id: str):
    """Removes all files with the ending temp_cache.csv in the
    source data directory"""
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    dir = os.path.join(
        source_dir,
        'data',
        f"state_v2_{agency_id}"
    )
    for path in os.listdir(dir):
        if path.endswith('_temp_cache.csv'):
            os.remove(os.path.join(dir, path))

def get_cache_path(agency_id: str, d: date, start_time, end_time, route_id) -> str:
    validate_agency_route_path_attributes(agency_id, route_id)
    return os.path.join(
        get_state_cache_dir(agency_id),
        f"{str(d)}/state_{agency_id}_{route_id}_{int(start_time)}_{int(end_time)}.csv",
    )


def get_chunk_state(
    agency_id,
    chunk_start_time,
    chunk_end_time,
    uncached_route_ids,
    chunk_minutes,
    allow_error,
):
    """Makes TrynAPI calls to assemble a chunk and returns list of chunk states,
    with each state having the fields of routeId and states.
    Returns False when allow_error is set to True, chunk_minutes is greater than 5,
    and TrynAPI has an internal server error (data request too large).
    """
    chunk_state = get_state_raw(
        agency_id,
        chunk_start_time,
        chunk_end_time,
        uncached_route_ids,
    )
    if 'errors' in chunk_state:
        # trynapi returns an internal server error if you ask for too much data at once
        raise Exception(
            f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['errors']}"
        )
    if 'message' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
        error = f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}"
        if allow_error and chunk_minutes > 5:
            print(error)
            chunk_minutes = math.ceil(chunk_minutes / 2)
            print(f"chunk_minutes = {chunk_minutes}")
            return False
        else:
            raise Exception(
                f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}"
            )
    if not ('data' in chunk_state):
        print(chunk_state)
        raise Exception(f'trynapi returned no data')
    return chunk_state['data']['state']['routes']


# Properties of each vehicle as returned from tryn-api,
# used for writing and reading chunk states to and from CSV files
vehicle_keys = ['vid', 'lat', 'lon', 'did', 'secsSinceReport']

def write_csv_header(path):
    header_keys = ['timestamp'] + vehicle_keys
    with open(path, 'w+') as chunk_out:
        chunk_out.writelines([','.join(header_keys) + '\n'])

def write_chunk_state(chunk_state, agency_id):
    # TODO - use the write functions part of PR #578
    """Writes chunks to a CSV for the given route in the given directory.
    Appends states and creates a new file if one does not exist."""
    route_id = chunk_state['routeId']
    path = get_route_temp_cache_path(agency_id, route_id)
    states = chunk_state['states']
    if len(states) == 0:
        return

    if not os.path.exists(path):
        write_csv_header(path)

    with open(path, 'a') as chunk_out:
        chunk_lines = []
        for state in states:
            timestamp = state['timestamp']
            for vehicle in state['vehicles']:
                chunk_line = ','.join(map(str, [timestamp]+ [
                    vehicle[vehicle_key]
                    for vehicle_key in vehicle_keys
                ])) + '\n'
                chunk_lines.append(chunk_line)
        chunk_out.writelines(chunk_lines)

def get_state_raw(agency_id, start_time, end_time, route_ids):

    params = f'state(agencyId: {json.dumps(agency_id)}, startTime: {json.dumps(int(start_time))}, endTime: {json.dumps(int(end_time))}, routes: {json.dumps(route_ids)})'

    query = f"""{{
       {params} {{
        agencyId
        startTime
        routes {{
          routeId
          states {{
            timestamp
            vehicles {{ vid lat lon did secsSinceReport }}
          }}
        }}
      }}
    }}"""

    trynapi_url = config.trynapi_url

    print(f'fetching state from {trynapi_url}')
    print(params)

    query_url = f"{trynapi_url}/graphql?query={query}"
    r = requests.get(query_url)

    print(f"   response length = {len(r.text)}")

    try:
        return json.loads(r.text)
    except:
        print(f'invalid response from {query_url}: {r.text}')
        raise

