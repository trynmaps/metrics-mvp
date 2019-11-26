import re, os, time, requests, json
from . import util, config

DefaultVersion = 'v3'

class StopInfo:
    def __init__(self, route, data):
        self.id = data['id']
        self.title = data['title']
        self.lat = data['lat']
        self.lon = data['lon']
        self.route = route

class DirectionInfo:
    def __init__(self, data):
        self.id = data['id']
        self.title = data['title']
        #self.name = data['name']
        self.data = data
        self.gtfs_direction_id = data['gtfs_direction_id']
        self.gtfs_shape_id = data['gtfs_shape_id']

    def get_stop_ids(self):
        return self.data['stops']

class RouteConfig:
    def __init__(self, agency_id, data):
        self.agency_id = agency_id
        self.data = data
        self.id = data['id']
        self.title = data['title']
        self.url = data['url']
        self.type = data['type']
        self.sort_order = data['sort_order']
        self.gtfs_route_id = data['gtfs_route_id']

    def get_direction_ids(self):
        return [direction['id'] for direction in self.data['directions']]

    def get_stop_ids(self, direction_id = None):
        if direction_id is None:
            return self.data['stops'].keys()
        else:
            dir_info = self.get_direction_info(direction_id)
            if dir_info is not None:
                return dir_info.get_stop_ids()
            else:
                return None

    def get_stop_infos(self):
        return [StopInfo(self, stop) for stop in self.data['stops'].values()]

    def get_stop_info(self, stop_id):
        if stop_id in self.data['stops']:
            return StopInfo(self, self.data['stops'][stop_id])
        return None

    def get_direction_infos(self):
        return [DirectionInfo(direction) for direction in self.data['directions']]

    def get_direction_info(self, direction_id):
        for direction in self.data['directions']:
            if direction['id'] == direction_id:
                return DirectionInfo(direction)
        return None

    def get_directions_for_stop(self, stop_id):
        # Most stops appear in one direction for a particular route,
        # but some stops may not appear in any direction,
        # and some stops may appear in multiple directions.
        return [
            direction['id']
            for direction in self.data['directions']
            for s in direction['stops'] if s == stop_id
        ]

def get_cache_path(agency_id, version=DefaultVersion):
    return f'{util.get_data_dir()}/routes_{version}_{agency_id}.json'

def get_s3_path(agency_id, version=DefaultVersion):
    return f'routes/{version}/routes_{version}_{agency_id}.json.gz'

def get_route_list(agency_id, version=DefaultVersion):
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency id: {agency_id}")

    cache_path = get_cache_path(agency_id, version)

    def route_list_from_data(data):
        return [RouteConfig(agency_id, route) for route in data['routes']]

    try:
        mtime = os.stat(cache_path).st_mtime
        now = time.time()
        if now - mtime < 86400:
            with open(cache_path, mode='r', encoding='utf-8') as f:
                data_str = f.read()
                try:
                    return route_list_from_data(json.loads(data_str))
                except Exception as err:
                    print(err)
    except FileNotFoundError as err:
        pass

    s3_bucket = config.s3_bucket
    s3_path = get_s3_path(agency_id, version)

    s3_url = f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}"

    r = requests.get(s3_url)

    if r.status_code == 404:
        raise FileNotFoundError(f"{s3_url} not found")
    if r.status_code == 403:
        raise FileNotFoundError(f"{s3_url} not found or access denied")
    if r.status_code != 200:
        raise Exception(f"Error fetching {s3_url}: HTTP {r.status_code}: {r.text}")

    data = r.json()

    if not 'routes' in data:
        raise Exception("S3 object did not contain 'routes' key")

    with open(cache_path, mode='w', encoding='utf-8') as f:
        f.write(r.text)

    return route_list_from_data(data)

def get_route_config(agency_id, route_id, version=DefaultVersion):
    for route in get_route_list(agency_id, version):
        if route.id == route_id:
            return route
    return None