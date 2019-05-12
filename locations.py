from models import metrics, eclipses, nextbus, util, arrival_history, geo
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Write locations')
    agency_id = 'sf-muni'

    args = parser.parse_args()

    locations = nextbus.get_all_stop_locations(agency_id)

    res = []
    for id, location in locations.locations_map.items():
        res.append({
            'id': location.id,
            'lat_lon': [location.lat, location.lon],
            'title': location.title,
            'stops': [{'route_id': s.route.id, 'id': s.id} for s in location.stop_infos],
        })

    with open(f'data/locations_t1_{agency_id}.json', 'w') as f:
        f.write(json.dumps(res))