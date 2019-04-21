from models import metrics, eclipses, nextbus, util, arrival_history, geo
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Get isochrones')
    parser.add_argument('--from', dest='from_place', required=True, help='From place or lat,lon')
    parser.add_argument('--direct', dest='direct', action='store_true', help='Show direct routes only')
    parser.add_argument('--max-trip-time', required=True, type=int, default=None, help='Max trip time (min)')
    parser.set_defaults(direct=False)

    agency_id = 'sf-muni'

    args = parser.parse_args()

    from_place = args.from_place
    max_trip_time = args.max_trip_time
    direct = args.direct

    locations = nextbus.get_all_stop_locations(agency_id)

    from_lat_lon = geo.get_lat_lon(from_place)

    print(f"From: {from_place} {from_lat_lon}")

    circles = geo.find_reachable_circles(locations, from_lat_lon, max_trip_time,
        from_place,
        skip_route_ids = ['PH','PM','C']
    )

    res = []
    for circle in circles:
        res.append({
            'lat_lon': circle.lat_lon,
            'radius': circle.radius,
            'trip_min': circle.trip_min,
            'trip_items': circle.trip_items,
            'routes': circle.routes,
            'title': circle.title
        })
        print(f'{circle.radius} m @ {circle.title} {circle.lat_lon}')

    print(len(circles))

    with open(f'frontend/circles-{from_place}-{max_trip_time}.js', 'w') as f:
        f.write("circles.push(");
        f.write(json.dumps(res))
        f.write(");");