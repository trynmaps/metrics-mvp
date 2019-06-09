import numpy as np

def get_completed_trip_times(s1_trip_values, s1_departure_time_values, s2_trip_values, s2_arrival_time_values):
    # Returns an array of trip times in minutes from stop s1 to stop s2
    # for trip IDs contained in both s1_trip_values and s2_trip_values.
    #
    # s1_trip_values and s1_departure_time_values are parallel arrays
    # s2_trip_values and s2_arrival_time_values are parallel arrays
    #
    # The s1 arrays and s2 arrays may have different lengths.
    #
    # The input arrays do not need to be sorted.

    trip_min = get_matching_trips_and_arrival_times(
        s1_trip_values,
        s1_departure_time_values,
        s2_trip_values,
        s2_arrival_time_values)[0]

    try:
        return trip_min[np.isfinite(trip_min)]
    except TypeError as ex: # happens when all trips are np.nan
        return np.empty(0)

def get_matching_trips_and_arrival_times(
    s1_trip_values,
    s1_departure_time_values,
    s2_trip_values,
    s2_arrival_time_values):

    # Returns a tuple (array of trip times in minutes, array of s2 arrival times).
    # The returned arrays are parallel to s1_trip_values and s1_departure_time_values.
    #
    # If no matching trip was found in s2_trip_values, the returned arrays will have the value np.nan
    # at that index.
    #
    # The input arrays do not need to be sorted.

    # sort parallel s2 arrays by trip ID
    s2_trip_sort_order = np.argsort(s2_trip_values)
    s2_trip_values = s2_trip_values[s2_trip_sort_order]
    s2_arrival_time_values = s2_arrival_time_values[s2_trip_sort_order]

    s2_arrival_time_values_extended = np.r_[s2_arrival_time_values, -1]

    s2_trip_values_extended = np.r_[s2_trip_values, -1]

    return get_matching_trips_and_arrival_times_presorted(
        s1_trip_values,
        s1_departure_time_values,
        s2_trip_values_extended,
        s2_arrival_time_values_extended
    )

def get_matching_trips_and_arrival_times_presorted(
    s1_trip_values,
    s1_departure_time_values,
    s2_trip_values_extended,
    s2_arrival_time_values_extended,
):
    # Fast helper function for matching s1 departures to s2 arrivals with the same trip ID.
    #
    # The parallel s2 arrays should already be sorted by trip ID and should have one extra
    # element at the end (which will be ignored).
    #
    # The s1 arrays do not need to be sorted.
    #
    # When the caller needs to compute trip times for many pairs of stops at once,
    # this function enables better performance by allowing the caller to pre-sort and pre-extend
    # the s2 arrays for each stop.

    # find potential indexes of s1 trip IDs in s2 array (ignoring extra value at the end of s2)
    possible_match_indexes = np.searchsorted(s2_trip_values_extended[:-1], s1_trip_values, side='left')

    # find the s1 trip IDs that actually matched s2 trip IDs.
    # np.searchsorted may return an index larger than the number of actual s2 trip IDs,
    # so the s2 arrays have an extra bogus value at the end to avoid an IndexError
    possible_matches = s2_trip_values_extended[possible_match_indexes]
    matches = (possible_matches == s1_trip_values)

    s1_s2_arrival_time_values = np.where(matches, s2_arrival_time_values_extended[possible_match_indexes], np.nan)

    trip_min = (s1_s2_arrival_time_values - s1_departure_time_values) / 60

    return trip_min, s1_s2_arrival_time_values
