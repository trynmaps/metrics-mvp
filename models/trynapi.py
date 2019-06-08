import requests
import urllib
import hashlib
import os
import re
import json
import math
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

    print(f"chunk_minutes = {chunk_minutes}")

    chunk_start_time = start_time
    while chunk_start_time < end_time:

        chunk_end_time = min(chunk_start_time + 60 * chunk_minutes, end_time)

        # trynapi returns all route states in the UTC minute containing the end timestamp, *inclusive*.
        # This would normally cause trynapi to return duplicate route states at the end of one chunk and
        # the beginning of the next chunk. Since chunk_end_time is always the first second in a UTC minute,
        # subtracting 1 from the corresponding millisecond will be the last millisecond in the previous minute,
        # so it should avoid fetching duplicate vehicle states at chunk boundaries
        chunk_state = get_state_raw(agency, chunk_start_time*1000, chunk_end_time*1000 - 1, uncached_route_ids)

        if 'errors' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
            raise Exception(f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['errors']}")

        if 'message' in chunk_state: # trynapi returns an internal server error if you ask for too much data at once
            raise Exception(f"trynapi error for time range {chunk_start_time}-{chunk_end_time}: {chunk_state['message']}")

        if not ('data' in chunk_state):
            print(chunk_state)
            raise Exception(f'trynapi returned no data')

        for chunk_route_state in chunk_state['data']['trynState']['routes']:
            route_id = chunk_route_state['rid']
            if route_id not in route_state_map:
                route_state_map[route_id] = chunk_route_state
            else:
                route_state_map[route_id]['routeStates'].extend(chunk_route_state['routeStates'])

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
    return os.path.join(source_dir, 'data', f"state_{agency_id}/{str(d)}/state_{agency_id}_{route_id}_{int(start_time)}_{int(end_time)}.json")

def get_state_raw(agency, start_time_ms, end_time_ms, route_ids):
    tryn_agency = 'muni' if agency == 'sf-muni' else agency

    params = f'trynState(agency: {json.dumps(tryn_agency)}, startTime: {json.dumps(str(int(start_time_ms)))}, endTime: {json.dumps(str(int(end_time_ms)))}, routes: {json.dumps(route_ids)})'

    query = f"""{{
       {params} {{
        agency
        startTime
        routes {{
          rid
          routeStates {{
            vtime
            vehicles {{ vid lat lon did secsSinceReport }}
          }}
        }}
      }}
    }}"""

    trynapi_url = os.environ.get('TRYNAPI_URL')
    if trynapi_url is None:
        trynapi_url = "https://06o8rkohub.execute-api.us-west-2.amazonaws.com/dev"

    print(f'fetching state from {trynapi_url}')
    print(params)

    query_url = f"{trynapi_url}/graphql?query={query}"
    r = requests.get(query_url)

    print(f"   response length = {len(r.text)}")

    return json.loads(r.text)

