import os, re, yaml, pytz

trynapi_url = os.environ.get("TRYNAPI_URL", "http://tryn-api")

s3_bucket = os.environ.get("OPENTRANSIT_S3_BUCKET", 'opentransit-data')

agency_ids = os.environ.get("OPENTRANSIT_AGENCY_IDS", 'muni').split(',')

class Agency:
    def __init__(self, conf):
        self.id = conf['id']
        self.provider = conf.get('provider', 'default')

        # ID of the time zone that the transit agency operates in.
        # (see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones )
        self.timezone_id = conf['timezone_id']

        # list of objects with start_time/end_time/directions properties; directions is an array of (route id, direction id) tuples
        self.invalid_direction_times = conf.get('invalid_direction_times', [])

        self.js_properties = conf.get('js_properties', {})
        self.tz = pytz.timezone(self.timezone_id)

        self.gtfs_url = conf.get("gtfs_url", None)

        # if the GTFS file at gtfs_url contains data for multiple transit agencies, gtfs_agency_id can be specified
        # in the config to filter the routes with the matching agency_id
        self.gtfs_agency_id = conf.get("gtfs_agency_id", None)

        # allow OpenTransit's route id to be another field besides GTFS route_id, e.g. route_short_name.
        # for Nextbus agencies, OpenTransit's route ID must be the same as Nextbus's route tag.
        self.route_id_gtfs_field = conf.get("route_id_gtfs_field", "route_id")

        # allow OpenTransit's stop id to be another field besides GTFS stop_id, e.g. stop_code.
        self.stop_id_gtfs_field = conf.get("stop_id_gtfs_field", "stop_id")

        # by default, start each "day" at 3 AM local time so midnight-3am buses are associated with previous day
        self.default_day_start_hour = conf.get('default_day_start_hour', 3)
        self.custom_day_start_hours = conf.get('custom_day_start_hours', [])

        # custom_directions property is a map of GTFS route ID (string) to array of direction metadata objects for that route.
        # each direction metadata object must contain `id` and `gtfs_direction_id` properties, and may contain `title`,
        # `included_stop_ids` (list of stop IDs which must appear in the direction in order),
        # and `excluded_stop_ids` (list of stop IDs which must not appear in the direction).
        # If custom direction metadata is not present for a route, save_routes.py will determine directions by default
        # by finding the most common GTFS shape_id for each direction_id.
        self.custom_directions = conf.get('custom_directions', {})

        # map of GTFS direction_id (string) to object with metadata about that direction ID.
        # `title_prefix` property will be prepended to the title of the direction for display in the UI.
        self.default_directions = conf.get('default_directions', {})

        # map of custom default direction name to object containing a default_directions object
        # and routes, a list of route IDs that should use this type of directions.
        self.custom_default_directions = conf.get('custom_default_directions', {})
    
        self.conf = conf

    def get_route_list(self):
        from . import routeconfig
        return routeconfig.get_route_list(self.id)

    def get_route_config(self, route_id):
        from . import routeconfig
        return routeconfig.get_route_config(self.id, route_id)

class NextbusAgency(Agency):
    def __init__(self, conf):
        super().__init__(conf)
        self.nextbus_id = conf["nextbus_agency_id"]

providers_map = {
    "default": Agency,
    "nextbus": NextbusAgency
}

agencies = None
agencies_map = None

def load_agencies():
    global agencies, agencies_map
    agencies = [make_agency(agency_id) for agency_id in agency_ids]
    agencies_map = {agency.id: agency for agency in agencies}

def make_agency(agency_id):
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

    agency_path = f'{os.path.dirname(os.path.dirname(__file__))}/agencies/{agency_id}.yaml'
    with open(agency_path) as f:
        conf = yaml.safe_load(f)

    provider = conf.get('provider', 'default')

    if provider not in providers_map:
        raise Exception("Invalid provider for agency {agency_id}: {provider}")

    agency_cls = providers_map[provider]
    return agency_cls(conf)

load_agencies()

def get_agency(id):
    if id not in agencies_map:
        agencies_map[id] = make_agency(id)

    return agencies_map[id]
