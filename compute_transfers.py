from models import metrics, eclipses, nextbus, util, arrival_history, geo
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    agency_id = 'sf-muni'

    locations = nextbus.get_all_stop_locations(agency_id)

    all_transfers = {}

    def get_transfer_dist(row):
        return row[0]

    max_dist = 750 # meters

    routes = nextbus.get_route_list(agency_id)
    for route in routes:
        route_id = route.id
        print(route_id)
        route_config = nextbus.get_route_config(agency_id, route_id)

        for dir_info in route_config.get_direction_infos():
            for i, stop_id in enumerate(dir_info.get_stop_ids()):
                stop_info = route_config.get_stop_info(stop_id)

                nearby_stops = geo.get_nearby_stops(locations, (stop_info.lat, stop_info.lon), max_dist)
                nearby_stops = nearby_stops[nearby_stops['ROUTE'] != route_id]

                if dir_info.id not in all_transfers:
                    all_transfers[dir_info.id] = {}

                dir_transfers = all_transfers[dir_info.id]

                for row in nearby_stops.itertuples():
                    other_did = row.DID
                    if other_did not in dir_transfers:
                        dir_transfers[other_did] = []

                    dir_transfers[other_did].append((round(row.DIST), route_id, stop_id, i, row.ROUTE, row.SID, row.DIR_INDEX))

    closest_transfers = []
    for did, dir_transfers in all_transfers.items():
        for other_did, candidates in dir_transfers.items():
            candidates.sort(key=get_transfer_dist)
            closest_transfer = candidates[0]
            closest_transfers.append((did, other_did) + closest_transfer)

    data_str = json.dumps(closest_transfers)

    cache_path = geo.get_transfers_cache_path(agency_id)

    stops = pd.DataFrame(closest_transfers, columns=['DID_1','DID_2','TRANSFER_DIST','ROUTE_1','SID_1','DIR_INDEX_1','ROUTE_2','SID_2','DIR_INDEX_2'])
    stops.to_csv(cache_path, index=False)
