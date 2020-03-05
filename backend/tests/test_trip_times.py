import backend_path
import unittest
import datetime
import numpy as np
import pandas as pd
from backend.models import trip_times

class TripTimesTest(unittest.TestCase):

    def test_trip_times(self):

        trips1 = np.array([1,    2,    3,            5,            7,     9,     10])
        times1 = np.array([6000, 9000, 12000,        18000,        30000, 60000, 90000])
        trips2 = np.array([1,          3,     4,     5,     6,     7,     9])
        times2 = np.array([6300,       12600, 15000, 18900, 20000, 30510, 66000])
                           # 5m        # 10m         # 15m         # 8.5m   # 100m

        order1 = np.arange(len(trips1))
        np.random.shuffle(order1)

        order2 = np.arange(len(trips2))
        np.random.shuffle(order2)

        trips = trip_times.get_completed_trip_times(
            trips1[order1], times1[order1], trips2[order2], times2[order2],
            is_loop=False
        ).tolist()

        self.assertEqual(trips, [5, 10, 15, 8.5, 100])

        trip_min, arrival_times = trip_times.get_matching_trips_and_arrival_times(
            trips1[order1], times1[order1], trips2[order2], times2[order2],
            is_loop=False
        )

        inverse_order = np.argsort(order1)

        np.testing.assert_equal(trip_min[inverse_order], [5, np.nan, 10, 15, 8.5, 100, np.nan])
        np.testing.assert_equal(arrival_times[inverse_order], [ 6300, np.nan, 12600, 18900, 30510, 66000, np.nan])

        trips = trip_times.get_completed_trip_times(
            np.array([1]),
            np.array([6000]),
            np.array([99]),
            np.array([166000]),
            is_loop=False
        ).tolist()

        self.assertEqual(trips, [])

        trips = trip_times.get_completed_trip_times(
            np.array([]),
            np.array([]),
            np.array([]),
            np.array([]),
            is_loop=False
        ).tolist()

        self.assertEqual(trips, [])

        # test loop routes

        trips1 = np.array([1,    2,     1,            2,            1,     2,     1])
        times1 = np.array([6000, 9000,  12000,        18000,        30000, 60000, 90000])
        trips2 = np.array([1,    2,     1,     3,     2,     2,     1,     2])
        times2 = np.array([6300, 12600, 15000, 18900, 21090, 30480, 36000, 57000])
                           # 5m  # 60m   # 50m        # 51.5m       # 100m

        order1 = np.arange(len(trips1))
        np.random.shuffle(order1)

        order2 = np.arange(len(trips2))
        np.random.shuffle(order2)

        trips = trip_times.get_completed_trip_times(
            trips1[order1], times1[order1], trips2[order2], times2[order2],
            is_loop=True
        ).tolist()

        self.assertEqual(trips, [5,60,50,51.5,100])

        trip_min, arrival_times = trip_times.get_matching_trips_and_arrival_times(
            trips1[order1], times1[order1], trips2[order2], times2[order2],
            is_loop=True
        )

        inverse_order = np.argsort(order1)

        np.testing.assert_equal(trip_min[inverse_order], [5, 60, 50, 51.5, 100, np.nan, np.nan])
        np.testing.assert_equal(arrival_times[inverse_order], [ 6300, 12600, 15000, 21090, 36000, np.nan, np.nan])


if __name__ == '__main__':
    unittest.main()
