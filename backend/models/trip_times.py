import numpy as np
import sortednp as snp

def get_completed_trip_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values,
    is_loop=False,
    assume_sorted=False):
    # Returns an array of trip times in minutes from stop s1 to stop s2
    # for trip IDs contained in both s1_trip_values and s2_trip_values.
    #
    # s1_trip_values and s1_departure_time_values are parallel arrays.
    # s2_trip_values and s2_arrival_time_values are parallel arrays.
    #
    # The s1 arrays and s2 arrays may have different lengths.
    #
    # The returned trip times are not necessarily parallel to s1 or s2 arrays.
    #
    # If assume_sorted is true, the s1 and s2 arrays should already be sorted by trip ID (if is_loop is false)
    # or by departure / arrival time (if is_loop is true).

    if (len(s1_trip_values) == 0) or (len(s2_trip_values) == 0):
        return np.array([])

    if is_loop:
        # If s1 and s2 are the same stop, this will compute the time to complete 1 full loop

        if not assume_sorted:
            s1_departure_time_values, s1_trip_values = sort_parallel(s1_departure_time_values, s1_trip_values)
            s2_arrival_time_values, s2_trip_values = sort_parallel(s2_arrival_time_values, s2_trip_values)

        s1_indexes, s2_indexes = find_indexes_of_next_arrival_times(
            s1_trip_values, s1_departure_time_values,
            s2_trip_values, s2_arrival_time_values
        )
    else:
        if not assume_sorted:
            s1_trip_values, s1_departure_time_values = sort_parallel(s1_trip_values, s1_departure_time_values)
            s2_trip_values, s2_arrival_time_values = sort_parallel(s2_trip_values, s2_arrival_time_values)

        _, (s1_indexes, s2_indexes) = snp.intersect(s1_trip_values, s2_trip_values, indices=True)

    return (s2_arrival_time_values[s2_indexes] - s1_departure_time_values[s1_indexes]) / 60

def find_indexes_of_next_arrival_times(
    sorted_s1_trip_values, sorted_s1_departure_time_values,
    sorted_s2_trip_values, sorted_s2_arrival_time_values
):
    # Given two pairs of parallel arrays for each stop with trip IDs and departure/arrival times,
    # already sorted by departure/arrival time, returns parallel lists of indexes into these pairs of arrays:
    # each pair of indexes corresponds to a departure time (from the first stop)
    # and the *next* arrival time (at the second stop) after that departure time.

    s1_len = len(sorted_s1_trip_values)
    s2_len = len(sorted_s2_trip_values)

    sorted_s1_indexes = []
    sorted_s2_indexes = []

    s2_start_index = 0
    for s1_index in range(s1_len):
        s1_departure_time = sorted_s1_departure_time_values[s1_index]
        s1_trip = sorted_s1_trip_values[s1_index]

        for s2_index in range(s2_start_index, s2_len):
            s2_arrival_time = sorted_s2_arrival_time_values[s2_index]

            if s2_arrival_time > s1_departure_time:
                s2_trip = sorted_s2_trip_values[s2_index]
                if s2_trip == s1_trip:
                    sorted_s1_indexes.append(s1_index)
                    sorted_s2_indexes.append(s2_index)
                    break
            else:
                s2_start_index = s2_index + 1

    return sorted_s1_indexes, sorted_s2_indexes

def get_matching_trips_and_arrival_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values,
    is_loop=False):

    # Returns a tuple (array of trip times in minutes, array of s2 arrival times).
    # The returned arrays are parallel to s1_trip_values and s1_departure_time_values.
    #
    # If no matching trip was found in s2_trip_values, the returned arrays will have the value np.nan
    # at that index.
    #
    # The input arrays do not need to be sorted.

    if is_loop:
        # for loop routes, there may be multiple arrivals at a particular stop with the same trip ID.
        # sort by departure or arrival time, then find the first arrival that appears after the departure time
        # with the same trip ID.

        sort_order = np.argsort(s1_departure_time_values)

        sorted_s1_departure_time_values = s1_departure_time_values[sort_order]
        sorted_s1_trip_values = s1_trip_values[sort_order]

        sorted_s2_arrival_time_values, sorted_s2_trip_values = sort_parallel(s2_arrival_time_values, s2_trip_values)

        sorted_s1_indexes, sorted_s2_indexes = find_indexes_of_next_arrival_times(
            sorted_s1_trip_values,
            sorted_s1_departure_time_values,
            sorted_s2_trip_values,
            sorted_s2_arrival_time_values
        )

    else:
        # for non-loop routes, there should be at most 1 departure/arrival for a particular trip ID.
        # sort by trip ID, then use snp for better performance to find the indexes of matching trip IDs
        sort_order = np.argsort(s1_trip_values)
        sorted_s1_trip_values = s1_trip_values[sort_order]

        sorted_s2_trip_values, sorted_s2_arrival_time_values = sort_parallel(s2_trip_values, s2_arrival_time_values)

        _, (sorted_s1_indexes, sorted_s2_indexes) = snp.intersect(sorted_s1_trip_values, sorted_s2_trip_values, indices=True)

    # start with an array of all nans
    s1_s2_arrival_time_values = np.full(len(s1_trip_values), np.nan)

    # find original s1 indexes corresponding to sorted s1 indexes
    result_indexes = sort_order[sorted_s1_indexes]

    s1_s2_arrival_time_values[result_indexes] = sorted_s2_arrival_time_values[sorted_s2_indexes]

    trip_min = (s1_s2_arrival_time_values - s1_departure_time_values) / 60

    return trip_min, s1_s2_arrival_time_values

def sort_parallel(arr, arr2):
    sort_order = np.argsort(arr)
    return arr[sort_order], arr2[sort_order]
