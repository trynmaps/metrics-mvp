import json
import time
import requests

from datetime import datetime, timedelta, timezone
from geopy.distance import distance

import pandas as pd
import numpy as np

from typing import List, Union

from . import nextbus

def produce_buses(data: list) -> pd.DataFrame:
     return pd.io.json.json_normalize(data,
                                      record_path=['routeStates', 'vehicles'],
                                      meta=[['routeStates', 'vtime']]) \
            .rename(columns={'lat': 'LAT',
                             'lon': 'LON',
                             'vid': 'VID',
                             'did': 'DID',
                             'routeStates.vtime': 'TIME'}) \
            .reindex(['TIME', 'VID', 'LAT', 'LON', 'DID'], axis='columns')

# haversine formula for calcuating distance between two coordinates in lat lon
# from bird eye view; seems to be +- 8 meters difference from geopy distance
def haver_distance(latstop,lonstop,latbus,lonbus):

    latstop,lonstop,latbus,lonbus = map(np.deg2rad,[latstop,lonstop,latbus,lonbus])
    eradius = 6371000

    latdiff = (latbus-latstop)
    londiff = (lonbus-lonstop)

    a = np.sin(latdiff/2)**2 + np.cos(latstop)*np.cos(latbus)*np.sin(londiff/2)**2
    c = 2*np.arctan2(np.sqrt(a),np.sqrt(1-a))

    distance = eradius*c
    return distance

def find_eclipses(buses, stop_info):
    """
    Find movement of buses relative to the stop, in distance as a function of time.
    """
    def split_eclipses(eclipses, threshold=30*60*1000) -> List[pd.DataFrame]:
        """
        Split buses' movements when they return to a stop after completing the route.
        """
        disjoint_eclipses = []
        for bus_id in eclipses['VID'].unique(): # list of unique VID's
            # obtain distance data for this one bus
            bus = eclipses[eclipses['VID'] == bus_id].sort_values('TIME')
            #pprint.pprint(bus)
            #pprint.pprint(bus['TIME'].shift())
            #pprint.pprint(bus['TIME'].shift() + threshold)
            #print('===============')
            # split data into groups when there is at least a `threshold`-ms gap between data points
            group_ids = (bus['TIME'] > (bus['TIME'].shift() + threshold)).cumsum()

            # store groups
            for _, group in bus.groupby(group_ids):
                disjoint_eclipses.append(group)
        return disjoint_eclipses

    eclipses = buses.copy()
    #eclipses['DIST'] = eclipses.apply(lambda row: distance(stop[['LAT','LON']],row[['LAT','LON']]).meters,axis=1)

    buscord = eclipses[['LAT', 'LON']]

    # calculate distances fast with haversine function
    eclipses['DIST'] = haver_distance(stop_info.lat, stop_info.lon, buscord['LAT'], buscord['LON'])
    # only keep positions within 750 meters within the given stop; (filtering out)
    eclipses = eclipses[eclipses['DIST'] < 750]

    # calculate distances again using geopy for the distance<750m values, because geopy is probably more accurate
    # dfromstop = []
    # for row in buscord:
    #     busdistance = distance(stopcord,row).meters
    #     dfromstop.append(busdistance)
    # eclipses['DIST'] = dfromstop

    eclipses['TIME'] = eclipses['TIME'].astype(np.int64)
    eclipses = eclipses[['TIME', 'VID', 'DIST']]

    eclipses = split_eclipses(eclipses)

    return eclipses

def find_nadirs(eclipses):
    """
    Find points where buses are considered to have encountered the stop.

    Nadir is an astronomical term that describes the lowest point reached by an orbiting body.
    """
    def calc_nadir(eclipse: pd.DataFrame) -> Union[pd.Series, None]:
        nadir = eclipse.iloc[eclipse['DIST'].values.argmin()]
        if nadir['DIST'] < 100:  # if min dist < 100, then reasonable candidate for nadir
            return nadir
        else:  # otherwise, hardcore datasci is needed
            rev_eclipse = eclipse.iloc[::-1]
            rev_nadir = rev_eclipse.iloc[rev_eclipse['DIST'].values.argmin()]
            if nadir['TIME'] == rev_nadir['TIME']:  # if eclipse has a global min
                return nadir  # then it's the best candidate for nadir
            else:  # if eclipse's min occurs at two times
                mid_nadir = nadir.copy()
                mid_nadir['DIST'] = (nadir['DIST'] + rev_nadir['DIST'])/2
                return mid_nadir  # take the midpoint of earliest and latest mins

    nadirs = []
    for eclipse in eclipses:
        nadirs.append(calc_nadir(eclipse)[['VID', 'TIME']])

    return pd.DataFrame(nadirs)