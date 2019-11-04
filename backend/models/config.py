import os, re, yaml, pytz

config_yaml = os.environ.get('OPENTRANSIT_CONFIG_YAML')

if config_yaml is None:
    raise Exception("OPENTRANSIT_CONFIG_YAML environment variable not defined")

raw_config = yaml.safe_load(config_yaml)

trynapi_url = raw_config.get("trynapi_url", "https://06o8rkohub.execute-api.us-west-2.amazonaws.com/dev")

class Agency:
    def __init__(self, conf):
        self.id = conf['id']
        self.provider = conf['provider']
        self.timezone_id = conf['timezone_id']
        self.gtfs_url = conf.get("gtfs_url", None)
        self.gtfs_agency_id = conf.get("gtfs_agency_id", None)
        self.tz = pytz.timezone(self.timezone_id)
        self.route_id_gtfs_field = conf.get("route_id_gtfs_field", "route_id")

        # for standard routes start each "day" at 3 AM local time so midnight-3am buses are associated with previous day
        self.default_day_start_hour = conf.get('default_day_start_hour', 3)
        self.custom_day_start_hours = conf.get('custom_day_start_hours', [])

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
    "nextbus": NextbusAgency
}

def make_agency(conf):
    agency_id = conf['id']
    if re.match('^[\w\-]+$', agency_id) is None:
        raise Exception(f"Invalid agency: {agency_id}")

    # if agency has 'provider' key, use the agency config defined in the environment,
    # otherwise, load agency config from YAML file in /agencies/ directory
    if 'provider' not in conf:
        agency_path = f'{os.path.dirname(os.path.dirname(__file__))}/agencies/{agency_id}.yaml'
        with open(agency_path) as f:
            conf = yaml.safe_load(f)

    provider = conf["provider"]
    agency_cls = providers_map.get(provider, Agency)
    return agency_cls(conf)

agencies = [make_agency(agency_conf) for agency_conf in raw_config["agencies"]]

agencies_map = {agency.id: agency for agency in agencies}

def get_agency(id):
    if id not in agencies_map:
        raise KeyError(f"agency id {id} not defined in config")
    return agencies_map[id]
