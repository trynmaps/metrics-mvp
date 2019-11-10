import requests
import urllib
import hashlib
import os
import re
import json
import math
import time
from pathlib import Path
from datetime import date

class CachedState:
    def __init__(self):
        self.cache_paths = {}

    def add(self, route_id, cache_path):
        self.cache_paths[route_id] = cache_path

    def get_for_route(self, route_id):
        cache_path = self.cache_paths[route_id]
        print(f'loading state for route {route_id} from cache: {cache_path}')
        with open(cache_path, "r") as f:
            return json.loads(f.read())

def get_state(agency, d: date, start_time, end_time, route_ids) -> CachedState:
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
        cache_path = get_cache_path(agency, d, start_time, end_time, route_id)
        if Path(cache_path).exists():
            state.add(route_id, cache_path)
        else:
            uncached_route_ids.append(route_id)

    if len(uncached_route_ids) == 0:
        print('state already cached')
        return state

    route_state_map = {}

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

    chunk_minutes = math.ceil(trynapi_max_chunk / len(route_ids))

    trynapi_min_chunk = 15

    chunk_minutes = max(chunk_minutes, trynapi_min_chunk)
    num_errors = 0

    print(f"chunk_minutes = {chunk_minutes}")

    chunk_start_time = start_time
    while chunk_start_time < end_time:

        chunk_end_time = min(chunk_start_time + 60 * chunk_minutes, end_time)

        chunk_state = get_state_raw(agency, chunk_start_time, chunk_end_time, uncached_route_ids)

        if 'errors' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
            raise Exception(f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['errors']}")

        if 'message' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
            error = f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}"
            if num_errors == 0 and chunk_minutes > 5:
                print(error)
                chunk_minutes = math.ceil(chunk_minutes / 2)
                num_errors += 1
                print(f"chunk_minutes = {chunk_minutes}")
                continue
            else:
                raise Exception(f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}")

        if not ('data' in chunk_state):
            print(chunk_state)
            raise Exception(f'trynapi returned no data')

        for chunk_route_state in chunk_state['data']['state']['routes']:
            route_id = chunk_route_state['routeId']
            if route_id not in route_state_map:
                route_state_map[route_id] = chunk_route_state
            else:
                route_state_map[route_id]['states'].extend(chunk_route_state['states'])

        chunk_start_time = chunk_end_time

    # cache state per route so we don't have to request it again if a route appears in a different list of routes
    for route_id in uncached_route_ids:
        cache_path = get_cache_path(agency, d, start_time, end_time, route_id)

        if route_id not in route_state_map:
            route_state_map[route_id] = None

        cache_dir = Path(cache_path).parent
        if not cache_dir.exists():
            cache_dir.mkdir(parents = True, exist_ok = True)

        with open(cache_path, "w") as f:
            print(f'writing state for route {route_id} to cache: {cache_path}')
            f.write(json.dumps(route_state_map[route_id]))

        state.add(route_id, cache_path)

    return state

def get_cache_path(agency_id: str, d: date, start_time, end_time, route_id) -> str:
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.join(source_dir, 'data', f"state_v2_{agency_id}/{str(d)}/state_{agency_id}_{route_id}_{int(start_time)}_{int(end_time)}.json")

def get_state_raw(agency, start_time, end_time, route_ids):
    tryn_agency = 'muni' if agency == 'sf-muni' else agency

    params = f'state(agencyId: {json.dumps(tryn_agency)}, startTime: {json.dumps(int(start_time))}, endTime: {json.dumps(int(end_time))}, routes: {json.dumps(route_ids)})'

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

    trynapi_url = os.environ.get('TRYNAPI_URL')
    if trynapi_url is None:
        trynapi_url = "http://tryn-api"

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

