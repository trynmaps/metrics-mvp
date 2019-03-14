import os
import time
import json
import requests
import re

def get_route_config(agency_id, route_id):
    source_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    # cache route config locally to reduce number of requests to nextbus API and improve performance
    cache_path = os.path.join(source_dir, 'data', f"route_{agency_id}_{route_id}.json")

    try:
        mtime = os.stat(cache_path).st_mtime

        now = time.time()

        if now - mtime < 86400:
            with open(cache_path, mode='r', encoding='utf-8') as f:
                data_str = f.read()
                try:
                    return json.loads(data_str)
                except Exception as err:
                    print(err)
                    pass
    except FileNotFoundError as err:
        pass

    response = requests.get(f"http://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a={agency_id}&r={route_id}&t=0&terse")

    data = response.json()

    if 'Error' in data and 'content' in data['Error']:
        raise Exception(data['Error']['content'])

    if not 'route' in data:
        raise Exception(f"Invalid response from Nextbus API: {response.text}")

    with open(cache_path, mode='w', encoding='utf-8') as f:
        f.write(response.text)

    return data
