import time
from datetime import datetime, date, timedelta, timezone
import pytz
import pandas as pd
import numpy as np
from . import nextbus, util

def produce_buses(route_state: dict) -> pd.DataFrame:
    buses = pd.io.json.json_normalize(route_state,
                                      record_path=['states', 'vehicles'],
                                      meta=[['states', 'timestamp']]) \
            .rename(columns={'lat': 'LAT',
                             'lon': 'LON',
                             'vid': 'VID',
                             'did': 'DID',
                             'secsSinceReport': 'AGE',
                             'states.timestamp': 'RAW_TIME'}) \
            .reindex(['RAW_TIME', 'VID', 'LAT', 'LON', 'DID', 'AGE'], axis='columns')

    # adjust each observation time for the number of seconds old the GPS location was when the observation was recorded
    buses['TIME'] = (buses['RAW_TIME'] - buses['AGE'].fillna(0)) #.astype(np.int64)

    buses = buses.drop(['RAW_TIME','AGE'], axis=1)
    buses = buses.sort_values('TIME', axis=0)

    return buses

def resample_bus(bus: pd.DataFrame) -> pd.DataFrame:

    time_diffs = np.diff(bus['TIME'].values, prepend=0)

    # remove duplicates (positions are observed every 15 seconds, but usually only update every minute or so)
    bus = bus[time_diffs > 2]

    new_rows = []

    def make_separator_row(vid):
        # adding a separator row at the end of each vehicle's observations allows simplifying
        # get_possible_arrivals_for_stop() (and making it slightly faster).
        # this row will always be filtered out by find_arrivals
        # so the row index will always have a gap in it even if two vehicles
        # adjacent in the buses frame both happen to be near the same stop
        return (
            vid,
            '',
            0,
            0,
            0,
            0,
            # 0 # uncomment for debugging
        )

    if not bus.empty:
        # faster to use numpy arrays instead of pandas series
        time_values = bus['TIME'].values
        lat_values = bus['LAT'].values
        lon_values = bus['LON'].values

        target_dist = 25

        prev_time_values = np.r_[np.nan, time_values[:-1]]
        prev_lat_values = np.r_[np.nan, lat_values[:-1]]
        prev_lon_values = np.r_[np.nan, lon_values[:-1]]

        dt_values = time_values - prev_time_values
        lat_diff_values = lat_values - prev_lat_values
        lon_diff_values = lon_values - prev_lon_values

        moved_dist_values = util.haver_distance(prev_lat_values, prev_lon_values, lat_values, lon_values)
        num_samples_values = np.floor(moved_dist_values / target_dist) # may be 0
        num_samples_values[0] = 0

        # interpolate lat/lng/time values between Nextbus observations so that the distance moved between rows
        # is reasonably small (allowing a smaller radius around stop and more precise arrival times),
        # but not too small to create an unnecessarily large number of rows (slower to calculate)

        # looping by index over all of these arrays is more verbose than adding these columns to
        # the bus dataframe and looping using itertuples(), but this is much faster!
        vid = bus['VID'].values[0]
        did_values = bus['DID'].values

        # obs_group is a counter associated with each resampled GPS observation
        # that lets us group consecutive GPS observations for a particular vehicle.
        # If a vehicle is missing GPS observations for a certain amount of time,
        # we increment the obs_group counter.
        obs_group = 1

        for i in range(0, len(time_values)):
            did_i = did_values[i]
            num_samples_i = int(num_samples_values[i])
            dt_i = dt_values[i]

            if num_samples_i > 1 and num_samples_i < 100 and dt_i < 180:
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
                        obs_group,
                        # 1 # uncomment for debugging
                    ))
            elif dt_i > 1800:
                # if a vehicle does not report any GPS observations for more than 30 minutes,
                # increment the "observation group" counter and add a separator row
                # so that the algorithm will consider observations before and after the gap
                # as belonging to separate trips.

                obs_group += 1
                new_rows.append(make_separator_row(vid))

            new_rows.append((
                vid,
                did_i,
                lat_values[i],
                lon_values[i],
                time_values[i],
                obs_group,
                # 0 # uncomment for debugging
            ))

        new_rows.append(make_separator_row(vid))

    resampled_bus = pd.DataFrame(new_rows, columns=[
        'VID','DID','LAT','LON','TIME','OBS_GROUP'
        # 'INTERP' # whether a sample was interpolated isn't needed by algorithm, but useful for debugging
    ])
    resampled_bus['TIME'] = resampled_bus['TIME'].astype(np.int64)

    return resampled_bus

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

def get_invalid_direction_times(route_config: nextbus.RouteConfig, direction_id: str):
    try:
        return invalid_direction_times_map[route_config.agency_id][route_config.id][direction_id]
    except KeyError:
        return []

def find_arrivals(route_state: dict, route_config: nextbus.RouteConfig, d: date, tz: pytz.timezone) -> pd.DataFrame:

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

    # datetime not normally needed for computation, but useful for debugging
    #tz = pytz.timezone('US/Pacific')
    #buses['DATE_TIME'] = buses.TIME.apply(lambda t: datetime.fromtimestamp(t, tz))

    possible_arrivals_arr = []

    # add distance from each observation to each valid stop along this route
    # in a column named DIST_{stop_id} ... assumes there are not too many stops
    # that we run out of memory
    def compute_distances_to_all_stops():
        lat_values = buses['LAT'].values
        lon_values = buses['LON'].values

        for stop_id in route_config.get_stop_ids():
            stop_info = route_config.get_stop_info(stop_id)
            stop_direction_ids = route_config.get_directions_for_stop(stop_id)
            if len(stop_direction_ids) > 0:
                # calculate distances fast with haversine function
                buses[f'DIST_{stop_id}'] = util.haver_distance(stop_info.lat, stop_info.lon, lat_values, lon_values)

    compute_distances_to_all_stops()

    valid_buses_by_direction = {}

    print(f'{route_id}: {round(time.time() - t0, 1)} computing possible arrivals')

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
                distance_to_adjacent_stop = util.haver_distance(stop_info.lat, stop_info.lon, adjacent_stop_info.lat, adjacent_stop_info.lon)
                radius = min(radius, round(distance_to_adjacent_stop))

        #dirs_text = [f'{d}[{i}]' for d, i in zip(stop_direction_ids, stop_indexes)]
        #print(f"{route_id}: {round(time.time() - t0, 1)} computing arrivals at stop {stop_id} {','.join(dirs_text)}  radius {radius} m  {'(terminal)' if is_terminal else ''}")

        use_reported_direction = (len(stop_direction_ids) > 1)

        possible_arrivals = get_possible_arrivals_for_stop(valid_buses, stop_id,
            direction_id=stop_direction_ids[0],
            stop_index=stop_indexes[0],
            adjacent_stop_ids=adjacent_stop_ids,
            radius=radius,
            is_terminal=is_terminal,
            use_reported_direction=use_reported_direction
        )

        if use_reported_direction:
            # if the stop has multiple directions, assume that the bus is going the direction
            # it said it was going on Nextbus, if valid. if the bus is not reporting a valid direction
            # for this stop, just use the first one
            direction_conditions = [possible_arrivals['DID'] == did for did in stop_direction_ids]
            possible_arrivals['DID'] = np.select(direction_conditions, stop_direction_ids, default = stop_direction_ids[0])
            possible_arrivals['STOP_INDEX'] = np.select(direction_conditions, stop_indexes, default = stop_indexes[0])

        possible_arrivals_arr.append(possible_arrivals)

    def concat_possible_arrivals():
        return pd.concat(possible_arrivals_arr, ignore_index=True)

    possible_arrivals = concat_possible_arrivals()

    if possible_arrivals.empty:
        arrivals, num_trips = possible_arrivals, 0
    else:
        print(f'{route_id}: {round(time.time() - t0, 1)} cleaning arrivals')

        arrivals, num_trips = clean_arrivals(possible_arrivals, buses, route_config)

    print(f"{route_id}: {round(time.time() - t0, 1)} found {len(arrivals['TIME'].values)} arrivals in {num_trips} trips")

    return arrivals

def get_possible_arrivals_for_stop(buses: pd.DataFrame, stop_id: str,
    direction_id=None,            # if use_reported_direction is False, the DID field will have this value
    use_reported_direction=False, # if use_reported_direction is True, the DID field will have the reported value from the buses frame
    stop_index=-1,                # STOP_INDEX field will be set to this value
    adjacent_stop_ids=[],
    radius=200,
    is_terminal=False
) -> pd.DataFrame:

    # the "possible" arrivals include times when the bus passes stops in the opposite direction,
    # which will be filtered out later. this ignores the stated direction of the bus according
    # to the Nextbus API (when use_reported_direction is False), because sometimes the bus is not actually
    # going in that direction.

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
    # if any rows were dropped by the filters above,
    # newly adjacent rows would have indexes that differ by more than 1.
    # note: rows must initially be ordered by bus, then by time,
    # and have consecutive index values. there must also be a row
    # that is always filtered out between each bus

    row_index_values = eclipses.index.values

    num_rows = len(row_index_values)
    if num_rows == 0:
        return make_arrivals_frame([])

    eclipse_start_values = np.diff(row_index_values, prepend=-999999) > 1
    eclipse_start_indexes = np.nonzero(eclipse_start_values)[0]
    eclipse_end_indexes = np.r_[eclipse_start_indexes[1:], num_rows]

    all_distance_values = eclipses[dist_column].values
    all_time_values = eclipses['TIME'].values
    all_vid_values = eclipses['VID'].values
    all_obs_group_values = eclipses['OBS_GROUP'].values

    if use_reported_direction:
        all_did_values = eclipses['DID'].values

    def calc_nadir(eclipse_start_index, eclipse_end_index) -> tuple:
        # this is called in the inner loop so it needs to be very fast
        # or computing arrival times will take much longer!

        distance_values = all_distance_values[eclipse_start_index:eclipse_end_index]

        min_dist = np.min(distance_values)

        # consider the bus to be "at" the stop whenever it is within some distance
        # of its closest approach to the stop (within 200m).
        # use larger fudge factor at a terminal where a bus might wait for a long time
        # somewhere slightly before the stop, then start moving again toward the stop when it is
        # ready to go in the opposite direction. without the fudge factor, the arrival time would
        # be calculated after the long wait.

        # at_stop_indexes is an array of indexes into distance_values
        # where the bus is considered 'at' the stop.
        # element 0 is the index of the arrival time
        # element -1 is the index of the departure time
        at_stop_indexes = np.nonzero(
            distance_values <= ((min_dist + 75) if is_terminal else (min_dist + 25))
        )[0]

        time_values = all_time_values[eclipse_start_index:eclipse_end_index]

        return (
            all_vid_values[eclipse_start_index],
            time_values[at_stop_indexes[0]], # arrival time
            time_values[at_stop_indexes[-1]], # departure time
            min_dist,
            stop_id,
            all_did_values[eclipse_start_index] if use_reported_direction else direction_id,
            stop_index,
            all_obs_group_values[eclipse_start_index],
            -1
        )

    return make_arrivals_frame([
        calc_nadir(eclipse_start_index, eclipse_end_index)
        for eclipse_start_index, eclipse_end_index in zip(eclipse_start_indexes, eclipse_end_indexes)
    ])

def make_arrivals_frame(rows: list) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=[
        'VID','TIME','DEPARTURE_TIME','DIST',
        'SID','DID','STOP_INDEX','OBS_GROUP','TRIP'
    ])

def clean_arrivals(possible_arrivals: pd.DataFrame, buses: pd.DataFrame, route_config: nextbus.RouteConfig) -> tuple:
    def make_buses_map():
        return {vid: bus for vid, bus in buses.groupby('VID')}
        '''
        vid_values = buses['VID'].values
        prev_vid_values = np.hstack(('', vid_values[:-1]))
        start_values = vid_values != prev_vid_values
        start_indexes = np.nonzero(start_values)[0]
        end_indexes = np.r_[start_indexes[1:], len(vid_values)]

        return {
            vid_values[start_index]: buses.iloc[start_index:end_index]
                for start_index, end_index in zip(start_indexes, end_indexes)
        }
        '''

    buses_map = make_buses_map()

    possible_arrivals = possible_arrivals.sort_values('TIME')

    start_trip = 0

    '''
    arrival_time_diffs = []
    trip_times = []
    '''

    def set_trip(dir_arrivals):
        nonlocal start_trip

        stop_index_values = dir_arrivals['STOP_INDEX'].values
        if len(stop_index_values) == 0:
            return dir_arrivals

        stop_index_diff = np.diff(stop_index_values, prepend=-999999)

        # if vehicle not observed at 3 or more stops in a row, count it as starting a new trip
        new_trip = (stop_index_diff <= 0) | (stop_index_diff > 3)

        # The trip ID is an arbitrary integer that is the same for a group
        # of arrivals for the same vehicle and direction that have an ascending stop index.
        # Storing this in the arrival history makes it easy and fast to compute trip times between two stops.

        trip_id = np.cumsum(new_trip) + start_trip

        dir_arrivals = dir_arrivals.copy()
        dir_arrivals['TRIP'] = trip_id

        # uncomment to print information about adjacent arrivals in the same trip with long travel times in between
        '''
        arrival_time_values = dir_arrivals['TIME'].values
        departure_time_values = dir_arrivals['DEPARTURE_TIME'].values
        prev_departure_time_values = np.r_[arrival_time_values[0], departure_time_values[:-1]]
        arrival_time_diff = np.diff(arrival_time_values, prepend=arrival_time_values[0])

        arrival_time_diffs.append(arrival_time_diff[~new_trip])

        trip_time = arrival_time_values - prev_departure_time_values

        trip_times.append(trip_time[~new_trip])

        trip_time_1 = np.r_[trip_time[1:],0]

        gap_arrivals = dir_arrivals.copy()
        gap_arrivals['NT'] = new_trip

        new_trip_1 = np.r_[new_trip[1:],False]
        gap_arrivals['NT1'] = new_trip_1

        gap_arrivals['TT'] = trip_time
        gap_arrivals['TT_1'] = trip_time_1
        gap_arrivals['DWELL'] = gap_arrivals['DEPARTURE_TIME'].values - gap_arrivals['TIME'].values
        gap_arrivals = gap_arrivals[((trip_time > 1800) & (~new_trip)) | ((trip_time_1 > 1800) & (~new_trip_1))]

        if not gap_arrivals.empty:
            print(gap_arrivals)
        '''

        start_trip = trip_id[-1] + 1

        return dir_arrivals

    def get_arrivals_for_vehicle_direction(
        dir_arrivals: pd.DataFrame,
        vehicle_id: str,
        direction_id: str,
        obs_group: int,
        bus: pd.DataFrame,
        route_config: nextbus.RouteConfig
    ) -> pd.DataFrame:
        dir_arrivals = get_arrivals_with_ascending_stop_index(dir_arrivals)
        dir_arrivals = add_missing_arrivals_for_vehicle_direction(dir_arrivals, vehicle_id, direction_id, bus, route_config)
        dir_arrivals = filter_duplicates(dir_arrivals)
        dir_arrivals = set_trip(dir_arrivals)

        return dir_arrivals

    arrivals = pd.concat([
        get_arrivals_for_vehicle_direction(dir_arrivals, vehicle_id, direction_id, obs_group, buses_map[vehicle_id], route_config)
            for (vehicle_id, direction_id, obs_group), dir_arrivals in possible_arrivals.groupby(['VID', 'DID', 'OBS_GROUP'])
    ])

    '''
    if len(arrival_time_diffs) > 0:
        arrival_time_diffs = np.concatenate(arrival_time_diffs)
        diff_quantiles = np.quantile(arrival_time_diffs, [0.5, 0.9, 1])

        print(f' arrival time diffs median={diff_quantiles[0]} 90%={diff_quantiles[1]} max={diff_quantiles[2]}')

        trip_times = np.concatenate(trip_times)
        diff_quantiles = np.quantile(trip_times, [0.5, 0.9, 1])

        print(f' adjacent stop times median={diff_quantiles[0]} 90%={diff_quantiles[1]} max={diff_quantiles[2]}')
    '''

    return arrivals.sort_values('TIME'), start_trip

def filter_duplicates(dir_arrivals):
    # If there are two consecutive arrivals for the same vehicle at the same stop,
    # remove whichever arrival has the larger distance.

    stop_index_values = dir_arrivals['STOP_INDEX'].values
    if len(stop_index_values) == 0:
        return dir_arrivals

    stop_index_diff = np.diff(stop_index_values, prepend=-999999)

    prev_is_duplicate = stop_index_diff == 0

    if not np.any(prev_is_duplicate):
        return dir_arrivals

    dist_values = dir_arrivals['DIST'].values

    worse_than_prev = np.diff(dist_values, prepend=-1) > 0

    worse_than_next = np.logical_not(np.r_[worse_than_prev[1:], True])
    next_is_duplicate = np.r_[prev_is_duplicate[1:], False]

    # create a boolean array with the indexes of the arrivals to remove:
    # where the previous arrival has the same STOP_INDEX and where this arrival has a larger distance than the previous one,
    # or where the next arrival has the same STOP_INDEX and where this arrival has a larger distance than the next one

    worse_duplicates = np.logical_or(
        np.logical_and(
            prev_is_duplicate,
            worse_than_prev
        ),
        np.logical_and(
            next_is_duplicate,
            worse_than_next
        )
    )

    #dir_arrivals['prev_duplicate_stop'] = prev_duplicate_stop
    #dir_arrivals['worse_than_prev'] = worse_than_prev
    #dir_arrivals['next_duplicate_stop'] = next_duplicate_stop
    #dir_arrivals['worse_than_next'] = worse_than_next
    #print(dir_arrivals[np.logical_or(prev_is_duplicate, next_is_duplicate)])
    #print(dir_arrivals[worse_duplicates])

    return dir_arrivals[np.logical_not(worse_duplicates)]


def get_arrivals_with_ascending_stop_index(dir_arrivals: pd.DataFrame) -> pd.DataFrame:
    # only include arrivals for stops where STOP_INDEX is increasing over time
    # for 3 stops visited consecutively in the same direction (either looking back at previous 2 stops,
    # looking ahead at next 2 stops, or looking at previous and next stop).
    # this is needed because the direction reported on Nextbus is sometimes
    # not the actual direction the bus is going :(
    # note: assumes route has at least 3 stops

    stop_index_values = dir_arrivals['STOP_INDEX'].values

    num_arrivals = len(stop_index_values)
    if num_arrivals < 2:
        return make_arrivals_frame([])

    padded_stop_index_values = np.r_[999999, 999999, stop_index_values, -999999, -999999]

    padded_stop_index_ascending = np.diff(padded_stop_index_values) > 0

    # previous stop index > previous previous stop index
    stop_index_prev2_ascending = padded_stop_index_ascending[:-3]

    # current stop index > previous stop index
    stop_index_prev_ascending = padded_stop_index_ascending[1:-2]

    # next stop index > current stop index
    stop_index_next_ascending = padded_stop_index_ascending[2:-1]

    # next next stop index > next stop index
    stop_index_next2_ascending = padded_stop_index_ascending[3:]

    return dir_arrivals[np.logical_or(
        np.logical_or(
            np.logical_and(
                stop_index_prev_ascending,
                stop_index_prev2_ascending,
            ),
            np.logical_and(
                stop_index_next_ascending,
                stop_index_next2_ascending
            )
        ),
        np.logical_and(
            stop_index_prev_ascending,
            stop_index_next_ascending,
        )
    )]

def add_missing_arrivals_for_vehicle_direction(
    dir_arrivals: pd.DataFrame,
    vehicle_id: str,
    direction_id: str,
    bus: pd.DataFrame,
    route_config: nextbus.RouteConfig
) -> pd.DataFrame:

    # If there is a small gap in STOP_INDEX, try looking for the missing stops
    # between the last departure time and the next arrival time. Maybe the radius
    # was too small or we never saw it closer to that stop than the prev/next stop.

    stop_index = dir_arrivals['STOP_INDEX']

    stop_index_values = stop_index.values

    num_arrivals = len(stop_index_values)

    if num_arrivals < 1:
        return make_arrivals_frame([])

    prev_stop_index_values = np.r_[999999, stop_index_values[:-1]]

    stop_index_diff_values = stop_index_values - prev_stop_index_values

    gaps_values = stop_index_diff_values > 1

    if not np.any(gaps_values):
        return dir_arrivals

    # only fix gaps of 1 or 2 stops, with less than a few minutes gap
    prev_departure_time_values = np.r_[0, dir_arrivals['DEPARTURE_TIME'].values[:-1]]
    time_values = dir_arrivals['TIME'].values
    gap_time_values = time_values - prev_departure_time_values

    fixable_gaps_values = np.logical_and(
        np.logical_and(
            gaps_values,
            stop_index_diff_values < 4
        ),
        np.logical_and(
            gap_time_values < 360,
            gap_time_values > 0
        )
    )

    if not np.any(fixable_gaps_values):
        return dir_arrivals

    dir_info = route_config.get_direction_info(direction_id)
    dir_stops = dir_info.get_stop_ids()

    all_arrivals = [dir_arrivals]

    fixable_gap_indexes = np.nonzero(fixable_gaps_values)[0]

    all_time_values = bus['TIME'].values
    num_all_time_values = len(all_time_values)

    for i in fixable_gap_indexes:
        next_arrival_time = time_values[i]
        prev_departure_time = prev_departure_time_values[i]

        # get observations for this bus in times where we would expect to see it at the missing stops
        def find_gap_bus():
            return bus[np.logical_and(
                (all_time_values < next_arrival_time),
                (all_time_values > prev_departure_time)
            )]

        gap_bus = find_gap_bus()

        if gap_bus.empty:
            continue

        prev_stop_index = prev_stop_index_values[i]
        next_stop_index = stop_index_values[i]

        prev_gap_arrival_time = None

        for gap_stop_index in range(prev_stop_index + 1, next_stop_index):
            gap_stop_id = dir_stops[gap_stop_index]

            # detect possible arrival with larger radius without requiring it to be closer to this stop than prev/next stop
            def find_gap_arrival():
                return get_possible_arrivals_for_stop(gap_bus, gap_stop_id,
                    direction_id=direction_id,
                    stop_index=gap_stop_index,
                    radius=300
                )

            gap_arrival = find_gap_arrival()

            if gap_arrival.empty:
                continue

            gap_arrival_times = gap_arrival['TIME'].values

            if len(gap_arrival_times) > 1:
                print(f" found multiple arrivals in gap at stop {gap_stop_id}, skipping")
                continue
            if prev_gap_arrival_time is not None and gap_arrival_times[0] <= prev_gap_arrival_time:
                print(f" found out of order arrival in gap at stop {gap_stop_id}, skipping")
                continue

            # uncomment to print debugging information about filled gaps
            #gap_stop_info = route_config.get_stop_info(gap_stop_id)
            #dt = datetime.fromtimestamp(gap_arrival["TIME"].values[0], pytz.timezone('US/Pacific'))
            #print(f'vid={vehicle_id} {direction_id}[{gap_stop_index}] (gap {next_stop_index-prev_stop_index} stops, {round((next_arrival_time-prev_departure_time)/60,1)} min) {gap_stop_id} @ {gap_arrival["TIME"].values[0]} {dt.time()} {round(gap_arrival["DIST"].values[0])} m ({gap_stop_info.title})')

            prev_gap_arrival_time = gap_arrival_times[0]

            all_arrivals.append(gap_arrival)

    if len(all_arrivals) == 1:
        return dir_arrivals

    return pd.concat(all_arrivals).sort_values('TIME', axis=0)