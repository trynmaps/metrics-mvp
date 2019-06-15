import numpy as np
import sortednp as snp

def get_completed_trip_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values,
    assume_sorted=False):

    # Returns an array of trip times in minutes from stop s1 to stop s2
    # for trip IDs contained in both s1_trip_values and s2_trip_values.
    #
    # s1_trip_values and s1_departure_time_values are parallel arrays.
    # s2_trip_values and s2_arrival_time_values are parallel arrays.
    #
    # The s1 arrays and s2 arrays may have different lengths.
    #
    # The trip times are not necessarily parallel to s1 or s2 arrays.
    #
    # If assume_sorted is true, the s1 and s2 arrays should already be sorted by trip ID (not by time).

    if not assume_sorted:
        s1_trip_values, s1_departure_time_values = sort_parallel(s1_trip_values, s1_departure_time_values)
        s2_trip_values, s2_arrival_time_values = sort_parallel(s2_trip_values, s2_arrival_time_values)

    _, (s1_indexes, s2_indexes) = snp.intersect(s1_trip_values, s2_trip_values, indices=True)

    return (s2_arrival_time_values[s2_indexes] - s1_departure_time_values[s1_indexes]) / 60

def get_matching_trips_and_arrival_times(
    s1_trip_values, s1_departure_time_values,
    s2_trip_values, s2_arrival_time_values):

    # Returns a tuple (array of trip times in minutes, array of s2 arrival times).
    # The returned arrays are parallel to s1_trip_values and s1_departure_time_values.
    #
    # If no matching trip was found in s2_trip_values, the returned arrays will have the value np.nan
    # at that index.
    #
    # The input arrays do not need to be sorted.

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
