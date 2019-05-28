import json
import time
import requests
from datetime import datetime, date, timedelta, timezone
from geopy.distance import distance
import pytz
import pandas as pd
import numpy as np
import math

from typing import List, Union

from . import nextbus, util

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

    target_dist = 25

    bus_time = bus.TIME
    bus_lat = bus.LAT
    bus_lon = bus.LON
    prev_time = bus_time.shift()
    dt = bus_time - prev_time
    prev_lat = bus_lat.shift()
    prev_lon = bus_lon.shift()
    lat_diff = bus_lat - prev_lat
    lon_diff = bus_lon - prev_lon
    moved_dist = haver_distance(prev_lat, prev_lon, bus_lat, bus_lon)
    num_samples = np.floor(moved_dist / target_dist) # may be 0

    # interpolate lat/lng/time values between Nextbus observations so that the distance moved between rows
    # is reasonably small (allowing a smaller radius around stop and more precise arrival times),
    # but not too small to create an unnecessarily large number of rows (slower to calculate)
    new_rows = []

    if not bus.empty:
        # looping by index over all of these arrays is more verbose than adding these columns to
        # the bus dataframe and looping using itertuples(), but this is much faster!
        vid = bus['VID'].values[0]
        did_values = bus['DID'].values
        prev_lat_values = prev_lat.values
        prev_lon_values = prev_lon.values
        lon_diff_values = lon_diff.values
        lat_diff_values = lat_diff.values
        prev_time_values = prev_time.values
        dt_values = dt.values
        lat_values = bus_lat.values
        lon_values = bus_lon.values
        time_values = bus_time.values
        num_samples_values = num_samples.values

        num_samples_values[0] = 0

        for i in range(0, len(time_values)):
            did_i = did_values[i]
            num_samples_i = int(num_samples_values[i])
            if num_samples_i > 1 and num_samples_i < 100:
                dt_i = dt_values[i]
                if dt_i < 180:
                    prev_lat_i = prev_lat_values[i]
                    prev_lon_i = prev_lon_values[i]
                    prev_time_i = prev_time_values[i]
                    lon_diff_i = lon_diff_values[i]
                    lat_diff_i = lat_diff_values[i]
                    for j in range(1, num_samples_i):
                        frac = j / num_samples_i
                        new_rows.append((
                            vid,
                            did_i,
                            prev_lat_i + lat_diff_i * frac,
                            prev_lon_i + lon_diff_i * frac,
                            prev_time_i + dt_i * frac,
                            # 1 # uncomment for debugging
                        ))
            new_rows.append((
                vid,
                did_i,
                lat_values[i],
                lon_values[i],
                time_values[i]
                # 0 # uncomment for debugging
            ))

        # adding a separator row at the end of each vehicle's observations allows simplifying
        # get_possible_arrivals_for_stop() (and making it slightly faster).
        # this row will always be filtered out by find_arrivals
        # so the row index will always have a gap in it even if two vehicles adjacent in the buses
        # both happen to be near the same stop
        new_rows.append((
            vid,
            '',
            0,
            0,
            0
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

PM = [('12:00', None)]
AM = [(None, '12:00')]

invalid_direction_times_map = {
    'sf-muni': {
        'NX': {
            'NX___I_F00': PM,
            'NX___O_F00': AM,
        },
        '1AX': {
            '1AX__O_F00': AM,
            '1AX__I_F00': PM,
        },
        '1BX': {
            '1BX__I_F01': PM,
            '1BX__O_F00': AM,
        },
        '7X': {
            '7X___O_F00': AM,
            '7X___I_F00': PM,
        },
        '8AX': {
            '8AX__I_F00': PM,
            '8AX__O_F00': AM,
        },
        '8BX': {
            '8BX__I_F00': PM,
            '8BX__O_F00': AM,
        },
        '14X': {
            '14X__O_F00': AM,
            '14X__I_F00': PM,
        },
        '30X': {
            '30X__O_F01': AM,
            '30X__I_F01': PM,
        },
        '31AX': {
            '31AX_O_F00': AM,
            '31AX_I_F00': PM,
        },
        '31BX': {
            '31BX_O_F00': AM,
            '31BX_I_F00': PM,
        },
        '38AX': {
            '38AX_I_F00': PM,
            '38AX_O_F00': AM,
        },
        '38BX': {
            '38BX_I_F00': PM,
            '38BX_O_F00': AM,
        },
        '41': {
            '41___I_F00': PM,
            '41___O_F00': AM,
        },
        '82X': {
            '82X__O_F00': AM,
            '82X__I_F00': PM,
        },
    },
}

def get_invalid_direction_times(route_config, direction_id):

    try:
        return invalid_direction_times_map[route_config.agency_id][route_config.id][direction_id]
    except KeyError:
        return []

def find_arrivals(route_state, route_config, d: date, tz) -> pd.DataFrame:

    route_id = route_config.id

    t0 = time.time()

    print(f'{route_id}: {round(time.time() - t0, 1)} generating data frame of GPS observations')

    buses = produce_buses(route_state)

    if buses.empty:
        return make_arrivals_frame([])

    print(f'{route_id}: {round(time.time() - t0, 1)} resampling {len(buses["TIME"].values)} GPS observations')

    buses = pd.concat([
        resample_bus(bus)
        for vid, bus in buses.groupby(buses['VID'])
    ], ignore_index=True)

    def remove_bus_separators():
        return buses[buses['TIME'] != 0]

    buses = remove_bus_separators()

    print(f'{route_id}: {round(time.time() - t0, 1)} computing distances from {len(buses["TIME"].values)} resampled GPS observations to stops')

    # start with a series containing consecutive indexes
    # so that we can tell where rows are dropped later
    buses['ROW_INDEX'] = buses.index.to_series()

    # datetime not normally needed for computation, but useful for debugging
    #tz = pytz.timezone('US/Pacific')
    #buses['DATE_TIME'] = buses.TIME.apply(lambda t: datetime.fromtimestamp(t, tz))

    possible_arrivals_arr = []

    # add distance from each observation to each valid stop along this route
    # in a column named DIST_{stop_id} ... assumes there are not too many stops
    # that we run out of memory

    for stop_id in route_config.get_stop_ids():
        stop_info = route_config.get_stop_info(stop_id)
        stop_direction_ids = route_config.get_directions_for_stop(stop_id)
        if len(stop_direction_ids) > 0:
            buses[f'DIST_{stop_id}'] = haver_distance(stop_info.lat, stop_info.lon, buses['LAT'], buses['LON'])

    valid_buses_by_direction = {}

    #print(f'{route_id}: {round(time.time() - t0, 1)} computing possible arrivals')

    for stop_id in route_config.get_stop_ids():
        stop_info = route_config.get_stop_info(stop_id)

        stop_direction_ids = route_config.get_directions_for_stop(stop_id)
        if len(stop_direction_ids) == 0:
            continue

        first_direction = stop_direction_ids[0]

        # exclude times of day when bus is not making stops in this direction
        # (e.g. commuter express routes that only serve one direction in the morning/afternoon)
        if first_direction in valid_buses_by_direction:
            valid_buses = valid_buses_by_direction[first_direction]
        else:
            valid_buses = buses
            for start_time_str, end_time_str in get_invalid_direction_times(route_config, first_direction):
                if start_time_str is not None:
                    invalid_start_timestamp = util.get_localized_datetime(d, start_time_str, tz).timestamp()
                    print(f"excluding buses after {invalid_start_timestamp} ({start_time_str}) for direction {first_direction}")
                    valid_buses = valid_buses[valid_buses['TIME'] < invalid_start_timestamp]
                if end_time_str is not None:
                    invalid_end_timestamp = util.get_localized_datetime(d, end_time_str, tz).timestamp()
                    print(f"excluding buses before {invalid_end_timestamp} ({end_time_str}) for direction {first_direction}")
                    valid_buses = valid_buses[valid_buses['TIME'] >= invalid_end_timestamp]
            valid_buses_by_direction[first_direction] = valid_buses

        is_terminal = False
        stop_indexes = []
        radius = 200
        adjacent_stop_ids = []

        for stop_direction_id in stop_direction_ids:
            dir_info = route_config.get_direction_info(stop_direction_id)
            dir_stops = dir_info.get_stop_ids()
            stop_index = dir_stops.index(stop_id)

            stop_indexes.append(stop_index)

            num_dir_stops = len(dir_stops)

            is_terminal = (stop_index == 0) or (stop_index == num_dir_stops - 1)

            if stop_index > 0:
                prev_stop_id = dir_stops[stop_index - 1]
                if prev_stop_id not in adjacent_stop_ids:
                    adjacent_stop_ids.append(prev_stop_id)
            if stop_index < num_dir_stops - 1:
                next_stop_id = dir_stops[stop_index + 1]
                if next_stop_id not in adjacent_stop_ids:
                    adjacent_stop_ids.append(next_stop_id)

            for adjacent_stop_id in adjacent_stop_ids:
                adjacent_stop_info = route_config.get_stop_info(adjacent_stop_id)

                # set radius to be no larger than the distance to the previous/next stop.
                # this helps avoid odd results near the terminals of certain routes
                distance_to_adjacent_stop = haver_distance(stop_info.lat, stop_info.lon, adjacent_stop_info.lat, adjacent_stop_info.lon)
                radius = min(radius, round(distance_to_adjacent_stop))

        dirs_text = [f'{d}[{i}]' for d, i in zip(stop_direction_ids, stop_indexes)]
        print(f"{route_id}: {round(time.time() - t0, 1)} computing arrivals at stop {stop_id} {','.join(dirs_text)}  radius {radius} m  {'(terminal)' if is_terminal else ''}")

        use_reported_did = (len(stop_direction_ids) > 1)

        possible_arrivals = get_possible_arrivals_for_stop(valid_buses, stop_id,
            stop_did=stop_direction_ids[0],
            stop_index=stop_indexes[0],
            adjacent_stop_ids=adjacent_stop_ids,
            radius=radius,
            is_terminal=is_terminal,
            use_reported_did=use_reported_did
        )

        if use_reported_did:
            # if the stop has multiple directions, assume that the bus is going the direction
            # it said it was going on Nextbus, if valid. if the bus is not reporting a valid direction
            # for this stop, just use the first one
            did_conditions = [possible_arrivals['STOP_DID'] == did for did in stop_direction_ids]
            possible_arrivals['STOP_DID'] = np.select(did_conditions, stop_direction_ids, default = stop_direction_ids[0])
            possible_arrivals['STOP_INDEX'] = np.select(did_conditions, stop_indexes, default = stop_indexes[0])

        possible_arrivals_arr.append(possible_arrivals)

    possible_arrivals = pd.concat(possible_arrivals_arr, ignore_index=True)
    possible_arrivals = possible_arrivals.sort_values('TIME')

    buses_map = {vid: bus for vid, bus in buses.groupby('VID')}

    if possible_arrivals.empty:
        arrivals = possible_arrivals
    else:
        print(f'{route_id}: {round(time.time() - t0, 1)} cleaning arrivals')
        arrivals = pd.concat([
            clean_bus_arrivals(vid, possible_bus_arrivals, buses_map[vid], route_config)
                for vid, possible_bus_arrivals in possible_arrivals.groupby('VID')
        ])
        arrivals = arrivals.sort_values('TIME')

    print(f"{route_id}: {round(time.time() - t0, 1)} found {len(arrivals['TIME'].values)} arrivals")

    return arrivals

def get_possible_arrivals_for_stop(buses: pd.DataFrame, stop_id, stop_did, stop_index,
    adjacent_stop_ids=[], radius=200, use_reported_did=False, is_terminal=False) -> pd.DataFrame:

    # the "possible" arrivals include times when the bus passes stops in the opposite direction,
    # which will be filtered out later. this ignores the stated direction of the bus according
    # to the Nextbus API, because sometimes the bus is not actually going in that direction.

    # calculate distances fast with haversine function

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

    dist_column = f'DIST_{stop_id}'

    def filter_by_radius_to_stop():
        return buses[buses[dist_column] < radius] # meters

    eclipses = filter_by_radius_to_stop()

    def filter_by_adjacent_stop_distance(adjacent_stop_id):
        return eclipses[eclipses[dist_column] <= eclipses[f'DIST_{adjacent_stop_id}']]

    # require bus to be closer to this stop than to previous or next stop
    for adjacent_stop_id in adjacent_stop_ids:
        eclipses = filter_by_adjacent_stop_distance(adjacent_stop_id)

    # allow grouping rows by each time a bus leaves vicinity of stop.
    # if any rows were dropped by distance filter,
    # newly adjacent rows would have indexes that differ by more than 1.
    # note: rows must initially be ordered by bus, then by time,
    # and have consecutive ROW_INDEX values. there must also be a row
    # that is always filtered out between each bus
    row_index = eclipses['ROW_INDEX']
    vid = eclipses['VID']

    def get_eclipse_starts():
        return (row_index - row_index.shift() > 1)

    def get_eclipse_ids():
        return get_eclipse_starts().cumsum()

    eclipse_ids = get_eclipse_ids()

    def calc_nadir(eclipse: pd.DataFrame) -> tuple:
        # this is called in the inner loop so it needs to be very fast
        # or computing arrival times will take much longer!

        distances = eclipse[dist_column].values
        #min_dist_index = distances.argmin()
        #min_dist = distances[min_dist_index]
        min_dist = distances.min()

        # consider the bus to be "at" the stop whenever it is within some distance
        # of its closest approach to the stop (within 200m).
        # use larger fudge factor at a terminal where a bus might wait for a long time
        # somewhere slightly before the stop, then start moving again toward the stop when it is
        # ready to go in the opposite direction. without the fudge factor, the arrival time would
        # be calculated after the long wait.

        # at_stop_indexes is an array of indexes where the bus is considered 'at' the stop.
        # element 0 is the index of the arrival time
        # element -1 is the index of the departure time
        at_stop_indexes = np.where(distances <= ((min_dist + 75) if is_terminal else (min_dist + 25)))[0]

        # series.values[index] seems to be reliably faster than series.iloc[index] or series.array[index]
        times = eclipse['TIME'].values

        return (
            eclipse['VID'].values[0],
            times[at_stop_indexes[0]], # arrival time
            times[at_stop_indexes[-1]], # departure time
            min_dist,
            stop_id,
            eclipse['DID'].values[0] if use_reported_did else stop_did,
            stop_index
            # uncomment to get lat/lon for debugging:
            # eclipse['LAT'].values[min_dist_index],
            # eclipse['LON'].values[min_dist_index],
        )

    return make_arrivals_frame([
        calc_nadir(eclipse) for _, eclipse in eclipses.groupby(eclipse_ids)
    ])

def make_arrivals_frame(rows):
    return pd.DataFrame(rows, columns=[
        'VID','TIME','DEPARTURE_TIME','DIST',
        'SID','STOP_DID','STOP_INDEX',
        # 'LAT','LON'
    ])

def clean_bus_arrivals(vid: str, possible_arrivals: pd.DataFrame, bus: pd.DataFrame, route_config) -> pd.DataFrame:
    if possible_arrivals.empty:
        return possible_arrivals

    # only include arrivals for stops where STOP_INDEX is increasing over time
    # in relation to the previous or next 2 stops visited in the same direction.
    # this is needed because the direction reported on Nextbus is sometimes
    # not the actual direction the bus is going :(
    # note: assumes route has at least 4 stops
    def filter_arrivals_by_actual_direction(dir_arrivals: pd.DataFrame) -> pd.DataFrame:
        stop_index = dir_arrivals['STOP_INDEX']
        prev2_stop_index = stop_index.shift(2)
        prev_stop_index = stop_index.shift(1)
        next_stop_index = stop_index.shift(-1)
        next2_stop_index = stop_index.shift(-2)

        return dir_arrivals[
            ((stop_index - prev_stop_index > 0) & (prev_stop_index - prev2_stop_index > 0)) |
            ((next_stop_index - stop_index > 0) & (next2_stop_index - next_stop_index > 0))
        ]

    # If there is a small gap in STOP_INDEX, try looking for the missing stops
    # between the last departure time and the next arrival time. Maybe the radius
    # was too small or we never saw it closer to that stop than the prev/next stop.
    def add_missing_stops(did: str, dir_arrivals: pd.DataFrame) -> pd.DataFrame:
        stop_index = dir_arrivals['STOP_INDEX']
        prev_stop_index = stop_index.shift(1)
        gaps = stop_index - prev_stop_index > 1

        if not np.any(gaps):
            return dir_arrivals

        # only fix gaps of 1 or 2 stops, with less than 5 minutes
        small_gaps = (stop_index - prev_stop_index <= 3)
        prev_departure_time = dir_arrivals['DEPARTURE_TIME'].shift(1)
        gap_time = dir_arrivals['TIME'] - prev_departure_time
        fixable_gaps = gaps & small_gaps & (gap_time < 360) & (gap_time > 0)

        if not np.any(fixable_gaps):
            return dir_arrivals

        dir_arrivals_gaps = dir_arrivals.copy()
        dir_arrivals_gaps['PREV_STOP_INDEX'] = prev_stop_index
        dir_arrivals_gaps['PREV_DEPARTURE_TIME'] = prev_departure_time
        dir_arrivals_gaps['GAP_TIME'] = gap_time
        dir_arrivals_gaps = dir_arrivals_gaps[fixable_gaps]

        dir_info = route_config.get_direction_info(did)
        dir_stops = dir_info.get_stop_ids()

        all_arrivals = [dir_arrivals]

        for gap_row in dir_arrivals_gaps.itertuples():
            # get observations for this bus in times where we would expect to see it at the missing stops
            gap_bus = bus[(bus['TIME'] < gap_row.TIME) & (bus['TIME'] > gap_row.PREV_DEPARTURE_TIME)]
            if gap_bus.empty:
                continue
            for gap_stop_index in range(int(gap_row.PREV_STOP_INDEX) + 1, gap_row.STOP_INDEX):
                gap_stop_id = dir_stops[gap_stop_index]

                # detect possible arrival with larger radius without requiring it to be closer to this stop than prev/next stop
                gap_arrival = get_possible_arrivals_for_stop(gap_bus, gap_stop_id,
                    stop_did=did,
                    stop_index=gap_stop_index,
                    radius=300)

                if gap_arrival.empty:
                    continue

                if len(gap_arrival['TIME'].values) > 1:
                    print(f" found multiple arrivals in gap at stop {gap_stop_id}, skipping")
                    continue

                # uncomment to print debugging information about filled gaps
                #gap_stop_info = route_config.get_stop_info(gap_stop_id)
                #print(f'vid={vid} {did}[{gap_stop_index}] (gap {int(gap_row.STOP_INDEX-gap_row.PREV_STOP_INDEX)} stops, {round((gap_row.TIME-gap_row.PREV_DEPARTURE_TIME)/60,1)} min) {gap_stop_id} @ {gap_arrival["TIME"].values[0]} {round(gap_arrival["DIST"].values[0])} m ({gap_stop_info.title})')

                all_arrivals.append(gap_arrival)

        return pd.concat(all_arrivals)

    return pd.concat([
        #filter_arrivals_by_actual_direction(dir_arrivals)
        add_missing_stops(did, filter_arrivals_by_actual_direction(dir_arrivals))
        for did, dir_arrivals in possible_arrivals.groupby(possible_arrivals['STOP_DID'])
    ])
