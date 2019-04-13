import requests
import urllib
import hashlib
import os
import json
import math

def get_state(agency, start_time, end_time, route_ids, cache=False):
    # Request data from trynapi in smaller chunks to avoid internal server errors.
    # The more routes we have, the smaller our chunk size needs to be in order to
    # avoid getting internal server errors from trynapi.

    if cache:
        cache_path = get_cache_path(agency, start_time, end_time, route_ids)
        try:
            with open(cache_path, "r") as f:
                print(f'state in cache: {cache_path}')
                text = f.read()
                return json.loads(text)
        except FileNotFoundError as err:
            pass

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

    route_state_map = {}
    chunk_start_time = start_time
    while chunk_start_time < end_time:

        chunk_end_time = min(chunk_start_time + 60 * chunk_minutes, end_time)

        # trynapi returns all route states in the UTC minute containing the end timestamp, *inclusive*.
        # This would normally cause trynapi to return duplicate route states at the end of one chunk and
        # the beginning of the next chunk. Since chunk_end_time is always the first second in a UTC minute,
        # subtracting 1 from the corresponding millisecond will be the last millisecond in the previous minute,
        # so it should avoid fetching duplicate vehicle states at chunk boundaries
        chunk_state = get_state_raw(agency, chunk_start_time*1000, chunk_end_time*1000 - 1, route_ids)

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

    if cache:
        with open(cache_path, "w") as f:
            print(f'writing state to cache: {cache_path}')
            f.write(json.dumps(route_state_map))

    return route_state_map

def get_cache_path(agency: str, start_time, end_time, route_ids) -> str:
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

    route_ids_slug = '+'.join(route_ids)

    if len(route_ids_slug) > 100:
        # avoid long filenames that may cause errors
        route_ids_slug = hashlib.sha1(route_ids_slug.encode('utf-8')).hexdigest()

    return os.path.join(source_dir, 'data', f"state_{agency}_{route_ids_slug}_{start_time}_{end_time}.json")

def get_state_raw(agency, start_time_ms, end_time_ms, route_ids):
    tryn_agency = 'muni' if agency == 'sf-muni' else agency

    # hack to avoid error when run against version of trynapi that does not provide secsSinceReport.
    # remove once default trynapi is upgraded to return secsSinceReport
    trynapi_version = os.environ.get('TRYNAPI_VERSION')
    if trynapi_version is None:
        trynapi_version = 1
    else:
        trynapi_version = int(trynapi_version)

    secs_since_report_field = 'secsSinceReport' if trynapi_version > 1 else ''

    params = f'trynState(agency: {json.dumps(tryn_agency)}, startTime: {json.dumps(str(start_time_ms))}, endTime: {json.dumps(str(end_time_ms))}, routes: {json.dumps(route_ids)})'

    query = f"""{{
       {params} {{
        agency
        startTime
        routes {{
          rid
          routeStates {{
            vtime
            vehicles {{ vid lat lon did {secs_since_report_field} }}
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

