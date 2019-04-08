import json
import time
import requests

from datetime import datetime, timedelta, timezone
from geopy.distance import distance
import pytz
import pandas as pd
import numpy as np
import math

from typing import List, Union

from . import nextbus

def produce_buses(route_state: dict) -> pd.DataFrame:
    buses = pd.io.json.json_normalize(route_state,
                                      record_path=['routeStates', 'vehicles'],
                                      meta=[['routeStates', 'vtime']]) \
            .rename(columns={'lat': 'LAT',
                             'lon': 'LON',
                             'vid': 'VID',
                             'did': 'DID',
                             'secsSinceReport': 'AGE',
                             'routeStates.vtime': 'RAW_TIME_MS'}) \
            .reindex(['RAW_TIME_MS', 'VID', 'LAT', 'LON', 'DID', 'AGE'], axis='columns')

    # adjust each observation time for the number of seconds old the GPS location was when the observation was recorded
    # and convert time from milliseconds since Unix epoch to seconds since Unix epoch
    buses['TIME'] = (np.round(buses['RAW_TIME_MS'].astype(np.int64)/1000) - buses['AGE'].fillna(0)) #.astype(np.int64)
    buses = buses.drop(['RAW_TIME_MS','AGE'], axis=1)
    buses = buses.sort_values('TIME', axis=0)

    return buses

def resample_bus(bus: pd.DataFrame) -> pd.DataFrame:
    bus = bus.copy()

    # remove duplicates (positions are observed every 15 seconds, but usually only update every minute or so)
    bus = bus[(bus.TIME - bus.TIME.shift()) > 2]

    bus['PREV_TIME'] = bus.TIME.shift()
    bus['DT'] = bus.TIME - bus.PREV_TIME
    bus['PREV_LAT'] = bus.LAT.shift()
    bus['PREV_LON'] = bus.LON.shift()
    bus['LAT_DIFF'] = bus.LAT - bus.PREV_LAT
    bus['LON_DIFF'] = bus.LON - bus.PREV_LON
    bus['MOVED_DIST'] = haver_distance(bus.PREV_LAT, bus.PREV_LON, bus.LAT, bus.LON)

    # interpolate lat/lng/time values between Nextbus observations so that the distance moved between rows
    # is reasonably small (allowing a smaller radius around stop and more precise arrival times),
    # but not too small to create an unnecessarily large number of rows (slower to calculate)
    new_rows = []
    for row in bus.itertuples():
        if row.DT < 180 and row.MOVED_DIST >= 50 and row.MOVED_DIST < 2500:
            num_samples = math.floor(row.MOVED_DIST / 25)
            for i in range(1, num_samples):
                frac = i / num_samples
                new_rows.append((
                    row.VID,
                    row.DID,
                    row.PREV_LAT + row.LAT_DIFF * frac,
                    row.PREV_LON + row.LON_DIFF * frac,
                    row.PREV_TIME + row.DT * frac,
                    # 1 # uncomment for debugging
                ))
        new_rows.append((
            row.VID, row.DID, row.LAT, row.LON, row.TIME,
            # 0 # uncomment for debugging
        ))

    resampled_bus = pd.DataFrame(new_rows, columns=[
        'VID','DID','LAT','LON','TIME',
        # 'INTERP' # whether a sample was interpolated isn't needed by algorithm, but useful for debugging
    ])
    resampled_bus['TIME'] = resampled_bus['TIME'].astype(np.int64)
    return resampled_bus


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

def find_arrivals(buses: pd.DataFrame, route_config) -> pd.DataFrame:

    buses = pd.concat([
        resample_bus(bus) for vid, bus in buses.groupby(buses['VID'])
    ], ignore_index=True)

    # start with a series containing consecutive indexes
    # so that we can tell where rows are dropped later
    buses['ROW_INDEX'] = buses.index.to_series()

    # datetime not normally needed for computation, but useful for debugging
    # tz = pytz.timezone('US/Pacific')
    # buses['DATE_TIME'] = buses.TIME.apply(lambda t: datetime.fromtimestamp(t, tz))

    route_id = route_config.id

    possible_arrivals_arr = []
    for stop_id in route_config.get_stop_ids():
        stop_info = route_config.get_stop_info(stop_id)

        stop_direction_ids = route_config.get_directions_for_stop(stop_id)
        if len(stop_direction_ids) == 0:
            continue

        is_terminal = False
        max_dir_index = -1

        for stop_direction_id in stop_direction_ids:
            dir_info = route_config.get_direction_info(stop_direction_id)
            dir_stops = dir_info.get_stop_ids()
            dir_index = dir_stops.index(stop_id)
            is_terminal = (dir_index == 0) or (dir_index == len(dir_stops) - 1)
            max_dir_index = max(max_dir_index, dir_index)

        print(f"route_id={route_id} stop_id={stop_id} dir_index={dir_index} is_terminal={is_terminal} dir={','.join(stop_direction_ids)}")

        possible_arrivals = get_possible_arrivals_for_stop(buses, stop_info, is_terminal)

        possible_arrivals['SID'] = stop_info.id

        if len(stop_direction_ids) > 1:
            # if the stop has multiple directions, assume that the bus is going the direction
            # it said it was going on Nextbus, if valid. if the bus is not reporting a valid direction
            # for this stop, make a guess
            conditions = [possible_arrivals['REPORTED_DID'] == did for did in stop_direction_ids]
            choices = [did for did in stop_direction_ids]
            possible_arrivals['STOP_DID'] = np.select(conditions, choices, default = stop_direction_ids[0])
        else:
            possible_arrivals['STOP_DID'] = stop_direction_ids[0]

        # set DIR_INDEX to the maximum index in any direction where the stop appears.
        # DIR_INDEX should be monotonically increasing in the actual direction the vehicle is traveling
        # (may not be sequential for some directions)
        possible_arrivals['DIR_INDEX'] = max_dir_index

        possible_arrivals_arr.append(possible_arrivals)

    possible_arrivals = pd.concat(possible_arrivals_arr, ignore_index=True)
    possible_arrivals = possible_arrivals.sort_values('TIME')

    arrivals = pd.concat([
        filter_bus_arrivals_by_actual_direction(possible_bus_arrivals)
            for vid, possible_bus_arrivals in possible_arrivals.groupby('VID')
    ])

    return arrivals.sort_values('TIME')

def get_possible_arrivals_for_stop(buses: pd.DataFrame, stop_info, is_terminal) -> pd.DataFrame:
    eclipses = buses.copy()

    # the "possible" arrivals include times when the bus passes stops in the opposite direction,
    # which will be filtered out later. this ignores the stated direction of the bus according
    # to the Nextbus API, because sometimes the bus is not actually going in that direction.

    # calculate distances fast with haversine function
    eclipses['DIST'] = haver_distance(stop_info.lat, stop_info.lon, eclipses['LAT'], eclipses['LON'])

    #if stop_info.id == '4015':
    #    print(eclipses) #[(eclipses['TIME'] > 1542124300) & (eclipses['TIME'] < 1542125252)])

    # only keep positions within a maximum radius of the given stop.
    # somewhat generous since we only get GPS coordinates every minute.
    # if stop is at a corner where bus turns 90 degrees,
    # interpolation could cut across diagonal, so if bus travels more than
    # 2 * sqrt(2) * radius between Nextbus updates while traveling
    # around the corner, we might miss the stop even after interpolation.
    # useful stats to know:
    #   200 meters is about 2 short SF blocks or 1 long block
    #   median distance between all stops on SF muni is ~210m
    #   10% of SF muni stops are less than ~115m apart
    #   10% of SF muni stops are more than ~420m apart
    eclipses = eclipses[eclipses['DIST'] < 200] # meters

    # allow grouping rows by each time a bus leaves vicinity of stop.
    # if any rows were dropped by distance filter,
    # newly adjacent rows would have indexes that differ by more than 1.
    # note: rows must initially be ordered by bus, then by time,
    # and have consecutive ROW_INDEX values
    row_index = eclipses['ROW_INDEX']
    vid = eclipses['VID']

    eclipses['ECLIPSE_ID'] = ((row_index - row_index.shift() > 1) | (vid != vid.shift())).cumsum()

    # todo: near end of route, possible that a bus could pass vicinity of stop,
    # go less than 200m to end of route, then come back to stop going the other direction.
    # in this case the function may only return one possible arrival, where TIME is the
    # first time it passed the stop going the opposite direction.

    return pd.DataFrame([
        calc_nadir(eclipse, is_terminal) for eclipse_id, eclipse in eclipses.groupby('ECLIPSE_ID')
    ], columns=['VID','TIME','WAIT','DIST','REPORTED_DID'])

def calc_nadir(eclipse: pd.DataFrame, is_terminal) -> tuple:
    min_dist = eclipse['DIST'].values.min()

    # consider the bus to be "at" the stop whenever it is within some distance
    # of its closest approach to the stop (within 200m).
    # use larger fudge factor at a terminal where a bus might wait for a long time
    # somewhere slightly before the stop, then start moving again toward the stop when it is
    # ready to go in the opposite direction. without the fudge factor, the arrival time would
    # be calculated after the long wait.
    at_stop_dist = (min_dist + 75) if is_terminal else (min_dist + 25)
    at_stop = eclipse[eclipse['DIST'] <= at_stop_dist]
    arrival_time = at_stop['TIME'].values[0]

    return (
        at_stop['VID'].values[0],
        arrival_time,
        at_stop['TIME'].values[-1] - arrival_time,
        min_dist,
        at_stop['DID'].values[0]
    )

def filter_bus_arrivals_by_actual_direction(possible_arrivals: pd.DataFrame) -> pd.DataFrame:
    if possible_arrivals.empty:
        return possible_arrivals

    # only include arrivals for stops where DIR_INDEX is increasing over time
    # in relation to the previous or next 2 stops visited in the same direction.
    # this is needed because the direction reported on Nextbus is sometimes
    # not the actual direction the bus is going :(
    # note: assumes route has at least 4 stops
    def filter_direction_arrivals(dir_arrivals: pd.DataFrame) -> pd.DataFrame:
        dir_index = dir_arrivals['DIR_INDEX']
        prev2_dir_index = dir_index.shift(2)
        prev_dir_index = dir_index.shift(1)
        next_dir_index = dir_index.shift(-1)
        next2_dir_index = dir_index.shift(-2)

        return dir_arrivals[
            ((dir_index - prev_dir_index > 0) & (prev_dir_index - prev2_dir_index > 0)) |
            ((next_dir_index - dir_index > 0) & (next2_dir_index - next_dir_index > 0))
        ]

    return pd.concat([
        filter_direction_arrivals(dir_arrivals)
        for did, dir_arrivals in possible_arrivals.groupby(possible_arrivals['STOP_DID'])
    ])
