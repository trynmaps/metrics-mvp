from models import metrics, eclipses, config, util, arrival_history
import json
import argparse
from datetime import datetime, date
import pytz
import pandas as pd
import numpy as np

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='List routes for agency')
    parser.add_argument('--agency', required=True, help='Agency id')

    args = parser.parse_args()

    agency = config.get_agency(args.agency)

    routes = agency.get_route_list()

    for route in routes:
        print(f'{route.id} = {route.title}')
        for direction in route.get_direction_infos():
            print(f'   direction {direction.id} = {direction.title}')
