import time
from datetime import date
import pandas as pd
import numpy as np
from . import routeconfig, util, config

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

def get_invalid_direction_times(agency: config.Agency, route_config: routeconfig.RouteConfig, direction_id: str):
    route_id = route_config.id
    invalid_times = []
    for invalid_direction_time in agency.invalid_direction_times:
        for (rid, did) in invalid_direction_time['directions']:
            if rid == route_id and did == direction_id:
                invalid_times.append((
                    invalid_direction_time.get('start_time', None),
                    invalid_direction_time.get('end_time', None)
                ))
    return invalid_times

def find_arrivals(agency: config.Agency, route_state: dict, route_config: routeconfig.RouteConfig, d: date) -> pd.DataFrame:

    tz = agency.tz

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

    print(f'{route_id}: {round(time.time() - t0, 1)} computing possible arrivals')

    for dir_info in route_config.get_direction_infos():

        direction_id = dir_info.id

        # exclude times of day when bus is not making stops in this direction
        # (e.g. commuter express routes that only serve one direction in the morning/afternoon)
        valid_buses = buses
        for start_time_str, end_time_str in get_invalid_direction_times(agency, route_config, direction_id):
            if start_time_str is not None:
                invalid_start_timestamp = util.get_localized_datetime(d, start_time_str, tz).timestamp()
                print(f"excluding buses after {invalid_start_timestamp} ({start_time_str}) for direction {direction_id}")
                valid_buses = valid_buses[valid_buses['TIME'] < invalid_start_timestamp]
            if end_time_str is not None:
                invalid_end_timestamp = util.get_localized_datetime(d, end_time_str, tz).timestamp()
                print(f"excluding buses before {invalid_end_timestamp} ({end_time_str}) for direction {direction_id}")
                valid_buses = valid_buses[valid_buses['TIME'] >= invalid_end_timestamp]

        dir_stops = dir_info.get_stop_ids()
        num_dir_stops = len(dir_stops)

        for stop_index, stop_id in enumerate(dir_stops):
            stop_info = route_config.get_stop_info(stop_id)

            is_terminal = False
            radius = 200
            adjacent_stop_ids = []

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

            possible_arrivals = get_possible_arrivals_for_stop(valid_buses, stop_id,
                direction_id=direction_id,
                stop_index=stop_index,
                adjacent_stop_ids=adjacent_stop_ids,
                radius=radius,
                is_terminal=is_terminal,
                use_reported_direction=False
            )

            possible_arrivals_arr.append(possible_arrivals)

    def concat_possible_arrivals():
        return pd.concat(possible_arrivals_arr, ignore_index=True)

    possible_arrivals = concat_possible_arrivals()

    if possible_arrivals.empty:
        arrivals, num_trips = possible_arrivals, 0
    else:
        print(f'{route_id}: {round(time.time() - t0, 1)} cleaning arrivals')

        arrivals = clean_arrivals(possible_arrivals, buses, route_config)

        num_trips = len(np.unique(arrivals['TRIP'].values))

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

def clean_arrivals(possible_arrivals: pd.DataFrame, buses: pd.DataFrame, route_config: routeconfig.RouteConfig) -> tuple:
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

    def get_arrivals_for_vehicle_direction(
        dir_arrivals: pd.DataFrame,
        vehicle_id: str,
        direction_id: str,
        obs_group: int,
        bus: pd.DataFrame,
        route_config: routeconfig.RouteConfig
    ) -> pd.DataFrame:

        nonlocal start_trip

        debug = False #vehicle_id == '8513' and direction_id == '1' # and obs_group == 1

        if debug:
            print(f"vehicle_id = {vehicle_id}, direction_id = {direction_id}, obs_group = {obs_group}")

        dir_info = route_config.get_direction_info(direction_id)

        dir_arrivals, start_trip = get_arrivals_with_ascending_stop_index(dir_arrivals, dir_info, start_trip, debug=debug)
        dir_arrivals = add_missing_arrivals_for_vehicle_direction(dir_arrivals, vehicle_id, direction_id, bus, route_config)

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

    return arrivals.sort_values('TIME')

class StopSequence:
    # helper used by get_arrivals_with_ascending_stop_index,
    # representing a possible subset of the rows in the dir_arrivals data frame
    # associated with one "trip".

    def __init__(self):
        self.last_stop_index = None
        self.last_departure_time = None
        self.stop_indexes = []
        self.row_indexes = []

    def append(self, row_index, stop_index, departure_time):
        self.last_stop_index = stop_index
        self.last_departure_time = departure_time
        self.stop_indexes.append(stop_index)
        self.row_indexes.append(row_index)

    def copy(self):
        other = StopSequence()
        other.last_stop_index = self.last_stop_index
        other.last_departure_time = self.last_departure_time
        other.stop_indexes = self.stop_indexes.copy()
        other.row_indexes = self.row_indexes.copy()
        return other

def get_arrivals_with_ascending_stop_index(
    dir_arrivals: pd.DataFrame,
    dir_info: routeconfig.DirectionInfo,
    start_trip: int,
    debug=False
) -> pd.DataFrame:
    # Given a data frame containing all "possible" arrivals
    # for one vehicle in one direction (sorted by arrival time),
    # returns a subset of rows in that data frame,
    # where arrivals are grouped into trips with a unique trip ID,
    # and each trip contains arrivals where the stop_index is ascending over time.
    #
    # The 'TRIP' column in the returned data frame is set to the unique trip ID, starting
    # at `start_trip`.
    #
    # For routes with 2 directions, the given data frame of possible arrivals contains
    # arrivals for stops in both directions. However, the stop_index values will typically be decreasing
    # over time for stops that are not in the direction that the vehicle is actually traveling.
    #
    # For twisty routes where a single direction doubles back on itself (or nearly so), such as
    # SF Muni's 39-Coit, 36-Teresita, 30-Stockton, 9-San Bruno, etc., it is possible that there may
    # be out-of-order stop indexes in the "possible" arrivals, e.g. 1,2,6,3,7,4,5,6,3,4,7,8,9.
    # In this case the "best" trip has the stop indexes 1,2,3,4,5,6,7,8,9. However, if the algorithm
    # only used the first ascending index it found, it would only find 1,2,6,7,8,9 and miss indexes 3,4,5.
    #
    # In order to handle these cases, the algorithm keeps track of multiple possible sequences
    # as it loops through the possible arrivals. To avoid needing to keep track of a large number of
    # possible sequences, it drops possible sequences if they are strictly worse than another possible sequence.
    # A sequence is worse than another sequence, for example,
    # if it is shorter than another sequence and ends in the same stop_index;
    # or if it is the same size as another sequence but ends in a larger stop_index.
    #
    # When all possible sequences end in a terminal, or if the algorithm processes several rows
    # without being able to extend any of the possible sequences with an ascending stop index,
    # it assumes that the trip has ended and chooses the longest possible sequence as the "best".
    #
    # After it finds the end of a trip, it resets the possible sequences and continues processing
    # possible arrivals where the previous sequence ended.

    stop_index_values = dir_arrivals['STOP_INDEX'].values

    num_arrivals = len(stop_index_values)
    if num_arrivals < 2:
        return make_arrivals_frame([]), start_trip

    arrival_time_values = dir_arrivals['TIME'].values
    departure_time_values = dir_arrivals['DEPARTURE_TIME'].values
    dist_values = dir_arrivals['DIST'].values

    if debug:
        #dir_arrivals = dir_arrivals.copy()
        #dir_arrivals['ROW_INDEX'] = np.arange(0, num_arrivals)

        with pd.option_context("display.max_rows", None):
            print(dir_arrivals)

    next_sequence_key = None
    possible_sequences = None

    next_trip = start_trip

    def reset_possible_sequences():
        nonlocal possible_sequences, next_sequence_key

        possible_sequences = {
            0: StopSequence()
        }
        next_sequence_key = 1

    reset_possible_sequences()

    def print_sequences():
        for sequence_key, sequence in possible_sequences.items():
            print(f'{sequence_key}: {sequence.stop_indexes} {sequence.row_indexes}')
        print('-')

    all_row_indexes = []
    trip_ids = []

    row_index = 0

    dir_stop_ids = dir_info.get_stop_ids()
    is_loop = dir_info.is_loop()
    num_stops = len(dir_stop_ids)
    terminal_stop_index = num_stops if is_loop else (num_stops - 1) # never reaches terminal_stop_index for loop routes

    min_trip_length = min(3, num_stops)
    max_small_gap_index_diff = 5
    max_large_gap_seconds = 300
    num_non_ascending_stop_indexes = 0

    def finish_trip():
        nonlocal row_index, next_trip, num_non_ascending_stop_indexes

        longest_sequence = None
        for sequence in possible_sequences.values():
            if longest_sequence is None:
                if len(sequence.row_indexes) > 0:
                    longest_sequence = sequence
            else:
                len_diff = len(sequence.row_indexes) - len(longest_sequence.row_indexes)

                # if multiple possible sequences have the same number of stops, choose the one that finishes first
                if len_diff > 0 or (len_diff == 0 and sequence.row_indexes[-1] < longest_sequence.row_indexes[-1]):
                    longest_sequence = sequence

        num_non_ascending_stop_indexes = 0

        if longest_sequence is not None:

            if len(longest_sequence.row_indexes) >= min_trip_length:

                trip_row_indexes = longest_sequence.row_indexes

                trip_len = len(trip_row_indexes)

                if debug:
                    print(f'trip {next_trip}:')
                    print(f'{longest_sequence.stop_indexes}')
                    print(f'{longest_sequence.row_indexes}')
                    print('---')

                all_row_indexes.extend(trip_row_indexes)

                for i in range(trip_len):
                    trip_ids.append(next_trip)

                next_trip += 1

            # loop may have continued a few rows past the end of the longest sequence.
            # in this case we back up the loop so it doesn't skip any rows
            # (row_index will be incremented once after this)
            row_index = longest_sequence.row_indexes[-1]

            reset_possible_sequences()

    while row_index < num_arrivals:
        stop_index = stop_index_values[row_index]
        arrival_time = arrival_time_values[row_index]
        departure_time = departure_time_values[row_index]

        if debug:
            print(f'row_index = {row_index} stop_index = {stop_index}')

        new_sequences = {}
        updated_sequences = False

        for sequence_key, sequence in possible_sequences.items():
            last_stop_index = sequence.last_stop_index

            if last_stop_index is None:
                updated_sequences = True
                if stop_index == 0 or is_loop:
                    sequence.append(row_index, stop_index, departure_time)
                else:
                    # if the first stop_index is not zero, leave an empty possible sequence
                    # which can still accept smaller stop indexes.
                    alt_sequence = sequence.copy()
                    new_sequences[next_sequence_key] = alt_sequence
                    next_sequence_key += 1
                    sequence.append(row_index, stop_index, departure_time)
            else:
                index_diff = stop_index - last_stop_index
                trip_time = arrival_time - sequence.last_departure_time

                if is_loop and index_diff < 0:
                    # make sure that index_diff is non-negative for loops so that
                    # we continue appending to the same trip after completing a loop
                    index_diff = (index_diff + num_stops) % num_stops

                if trip_time <= 0:
                    # arrival times within in a trip must be strictly ascending,
                    # otherwise it wouldn't be possible to ensure the correct sort order
                    # when displaying arrivals for a vehicle in order
                    pass
                elif index_diff == 1:
                    # if stops appear in sequential order, just append to this sequence
                    # without creating any more possibilities.
                    updated_sequences = True
                    sequence.append(row_index, stop_index, departure_time)
                elif index_diff > 1 and (index_diff <= max_small_gap_index_diff or trip_time < max_large_gap_seconds):
                    # if this arrival skipped one or more stops, create possibilities that
                    # contain or don't contain this arrival
                    updated_sequences = True
                    alt_sequence = sequence.copy()
                    new_sequences[next_sequence_key] = alt_sequence
                    next_sequence_key += 1
                    sequence.append(row_index, stop_index, departure_time)
                elif index_diff == 0:
                    # If there are two consecutive arrivals for the same vehicle at the same stop,
                    # use the arrival with the smaller distance.
                    last_row_index = sequence.row_indexes[-1]
                    if dist_values[row_index] < dist_values[last_row_index]:
                        sequence.row_indexes[-1] = row_index
                        sequence.last_departure_time = departure_time
                        updated_sequences = True
                        if debug:
                            print(f"stop_index = {stop_index} dist[{row_index}] = {dist_values[row_index]}")

        if not updated_sequences:
            num_non_ascending_stop_indexes += 1

            if debug:
                print(f'no updated sequences, num_non_ascending_stop_indexes = {num_non_ascending_stop_indexes}')

            # as a heuristic that seems to work in practice without making things too slow,
            # finish the current trip if 4 rows are processed without being able to extend any possible sequences.
            # (SF Muni's 39-Coit sometimes has 3 rows with non-ascending stop indexes before another ascending stop index.)
            if num_non_ascending_stop_indexes >= 4:
                finish_trip()
        else:
            num_non_ascending_stop_indexes = 0

            possible_sequences.update(new_sequences)

            if len(possible_sequences) > 1:
                # If there are multiple possible sequences, remove sequences that appear to be worse than
                # other sequences in order to avoid creating a large number of possible sequences

                terminal_sequence_keys = []

                longest_sequence_len = 0
                for sequence in possible_sequences.values():
                    sequence_len = len(sequence.row_indexes)
                    if sequence_len > longest_sequence_len:
                        longest_sequence_len = sequence_len

                # Construct a dict of sequence length => key in the `possible_sequences` dict
                # for the sequence of that length (or longer) with the smallest last_stop_index value.
                # These are the keys of the sequences we want to keep.
                #
                # Suppose the possible arrivals have the stop indexes [1,3,5] and the
                # possible sequences are:
                #
                # 0: [1, 3, 5]
                # 2: [1, 5]
                # 3: [5]
                # 4: [1, 3]
                # 5: [1]
                # 6: []
                #
                # There is only one sequence of length 3 or more, with key 0.
                # There are two sequences of length 2 or more, with keys 0, 2, and 4 (key 4 has the smallest last stop index).
                # There are two sequences of length 1 or more, with keys 0, 2, 3, and 5 (key 5 has the smallest last stop index).
                # There is one sequence of length 0, with key 6.
                #
                # smallest_last_index_keys_by_length should end up like this:
                # {0: 6, 1: 5, 2: 4, 3: 0}
                #
                # This indicates that we can remove the sequences 2 and 3 (which are not in the values)
                # since the sequences [5] and [1,5] are guaranteed to be worse than the sequence [1,3,5].
                #
                # The sequence [1,3] is kept because we might see 4,5 in the future.
                # The sequence [1] is kept because we might see 2,3,4,5 in the future.
                # The sequence [] is kept because we might see 0,1,2,3,4,5 in the future.

                smallest_last_index_keys_by_length = {}

                # as a heuristic to avoid losing long but incomplete sequences (e.g. missing stop index 0),
                # avoid creating new sequences that are much shorter than the best sequence
                min_sequence_len = max(0, longest_sequence_len - 3)

                for sequence_key, sequence in possible_sequences.items():
                    sequence_len = len(sequence.row_indexes)

                    if sequence_len < min_sequence_len:
                        continue

                    last_stop_index = sequence.last_stop_index

                    if last_stop_index == terminal_stop_index:
                        terminal_sequence_keys.append(sequence_key)

                    if sequence_len == 0:
                        smallest_last_index_keys_by_length[sequence_len] = sequence_key
                    else:
                        for seq_len in range(min_sequence_len, sequence_len+1):
                            if seq_len not in smallest_last_index_keys_by_length:
                                smallest_last_index_keys_by_length[seq_len] = sequence_key
                            else:
                                smallest_last_index_key = smallest_last_index_keys_by_length[seq_len]

                                if last_stop_index < possible_sequences[smallest_last_index_key].last_stop_index:
                                    smallest_last_index_keys_by_length[seq_len] = sequence_key

                unneded_sequence_keys = set(possible_sequences.keys()) - set(smallest_last_index_keys_by_length.values())

                if debug:
                    print(smallest_last_index_keys_by_length)

                # if a possible sequence ends in a terminal, keep it as a possibility even if
                # there is another sequence of the same length that ends before the terminal. this is needed to
                # avoid losing the terminal sequence if we only see the second-to-last stop *after* seeing the terminal
                # (which happens sometimes with with the 39-Coit at Coit Tower)
                if len(terminal_sequence_keys) > 0:
                    unneded_sequence_keys = unneded_sequence_keys - set(terminal_sequence_keys)

                for sequence_key in unneded_sequence_keys:
                    del possible_sequences[sequence_key]

            all_terminals = True
            for sequence in possible_sequences.values():
                if sequence.last_stop_index is None or sequence.last_stop_index < terminal_stop_index:
                    all_terminals = False
                    break

            # if all possible sequences end in a terminal, choose the best one as the actual trip.
            if all_terminals:
                finish_trip()

        if debug:
            print_sequences()

        row_index += 1

    finish_trip()

    ascending_dir_arrivals = dir_arrivals.iloc[all_row_indexes].copy()

    ascending_dir_arrivals['TRIP'] = trip_ids

    if debug:
        with pd.option_context("display.max_rows", None):
            print(ascending_dir_arrivals)

    return ascending_dir_arrivals, next_trip

def add_missing_arrivals_for_vehicle_direction(
    dir_arrivals: pd.DataFrame,
    vehicle_id: str,
    direction_id: str,
    bus: pd.DataFrame,
    route_config: routeconfig.RouteConfig
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

    row_index_after_prev_gap_arrival = 0
    num_gap_arrivals = 0
    new_row_indexes = []

    fixable_gap_indexes = np.nonzero(fixable_gaps_values)[0]

    all_time_values = bus['TIME'].values
    num_all_time_values = len(all_time_values)

    trip_values = dir_arrivals['TRIP'].values

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

            gap_arrival['TRIP'] = trip_values[i]

            all_arrivals.append(gap_arrival)
            new_row_indexes.extend(range(row_index_after_prev_gap_arrival, i))
            new_row_indexes.append(num_arrivals + num_gap_arrivals)
            row_index_after_prev_gap_arrival = i
            num_gap_arrivals += 1

    if len(all_arrivals) == 1:
        return dir_arrivals

    new_row_indexes.extend(range(row_index_after_prev_gap_arrival, num_arrivals))

    return pd.concat(all_arrivals, sort=False).iloc[new_row_indexes]
