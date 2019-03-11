from models import trynapi
import json
import argparse
import re
import pytz
import os
from datetime import datetime

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download raw state data from tryn-api')
    parser.add_argument('--route', required=True)
    parser.add_argument('--start', required=True, help='unix timestamp (seconds)')
    parser.add_argument('--end', required=True, help='unix timestamp (seconds)')

    args = parser.parse_args()

    route_id = args.route
    start_time = int(args.start)
    end_time = int(args.end)

    tz = pytz.timezone('US/Pacific')
    local_start = datetime.fromtimestamp(start_time, tz)
    local_end = datetime.fromtimestamp(end_time, tz)

    agency = 'sf-muni'

    if re.match('^[\w\-]+$', agency) is None:
        raise Exception(f"Invalid agency: {agency}")

    if re.match('^[\w\-]+$', route_id) is None:
        raise Exception(f"Invalid route id: {route_id}")

    source_dir = os.path.dirname(os.path.realpath(__file__))
    local_path = os.path.join(source_dir, 'data', f"state_{agency}_{route_id}_{start_time}_{end_time}.json")

    print(f"route = {route_id}")
    print(f"start = {local_start} ({start_time})")
    print(f"end = {local_end} ({end_time})")
    print(f"local_path = {local_path}")

    agency = 'sf-muni'
    data = trynapi.get_state(agency, start_time*1000, end_time*1000, [route_id])

    f = open(local_path, "w")
    f.write(json.dumps(data))
    f.close()
