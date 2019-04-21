from models import metrics, eclipses, nextbus, util, arrival_history, geo
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Show possible routes between two named places or lat lon')
    parser.add_argument('--from', dest='from_place', required=True, help='From place or lat,lon')
    parser.add_argument('--to', dest='to_place', required=True, help='To place or lat,lon')
    parser.add_argument('--direct', dest='direct', action='store_true', help='Show direct routes only')
    parser.add_argument('--max-walk', required=False, type=int, default=1000, help='Max walking distance (m)')
    parser.add_argument('--max-trip-time', required=False, type=int, default=None, help='Max trip time (min)')
    parser.set_defaults(direct=False)

    agency_id = 'sf-muni'

    args = parser.parse_args()

    from_place = args.from_place
    to_place = args.to_place
    max_walk = args.max_walk
    max_trip_time = args.max_trip_time
    direct = args.direct

    locations = nextbus.get_all_stop_locations(agency_id)

    from_lat_lon = geo.get_lat_lon(from_place)
    to_lat_lon = geo.get_lat_lon(to_place)

    print(f"From: {from_place} {from_lat_lon}")
    print(f"To: {to_place} {to_lat_lon}")

    trips = geo.get_possible_trips(locations, from_lat_lon, to_lat_lon, direct=direct, max_walk=max_walk)

    if max_trip_time is not None:
        trips = trips[trips['TRIP_MIN'] <= max_trip_time]

    def get_stop_title(route_id, stop_id):
        if not isinstance(route_id, str):
            return np.nan
        else:
            route = nextbus.get_route_config(locations.agency_id, route_id)
            stop_info = route.get_stop_info(stop_id)
            return stop_info.title if stop_info else np.nan

    if not trips.empty:
        trips['TITLE_1'] = trips.apply(lambda row: get_stop_title(row.ROUTE_1, row.SID_1), axis=1)
        if not direct:
            trips['XFER_TITLE_1'] = trips.apply(lambda row: get_stop_title(row.ROUTE_1, row.XFER_SID_1), axis=1)
            trips['XFER_TITLE_2'] = trips.apply(lambda row: get_stop_title(row.ROUTE_2, row.XFER_SID_2), axis=1)
        trips['TITLE_2'] = trips.apply(lambda row: get_stop_title(row.ROUTE_2, row.SID_2), axis=1)

    trips = trips.drop(['SID_1','SID_2'], axis=1)
    if not direct:
        trips = trips.drop(['XFER_SID_1','XFER_SID_2'], axis=1)

    print(trips)
