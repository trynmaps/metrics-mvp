import backend_path
import unittest
import datetime
import numpy as np
from backend.models import util

class UtilTest(unittest.TestCase):

    def test_quantile_sorted(self):
        arr = [1.1,2.2,3.3,4.4,5.5,6.6,7.7,8.8,9.9,10.1]

        self.assertEqual(util.quantile_sorted(arr, 1), 10.2)
        self.assertEqual(util.quantile_sorted(arr, 0), 1.1)
        self.assertEqual(util.quantile_sorted(arr, 0.5), 6.05)
        self.assertEqual(util.quantile_sorted(arr[:-1], 0.5), 5.5)

    def test_parse_date(self):
        self.assertEqual(util.parse_date('2019-12-27'), datetime.date(2019,12,27))

    def test_get_dates_in_range(self):
        self.assertEqual(
            util.get_dates_in_range('2019-12-27', '2019-12-27'),
            [datetime.date(2019,12,27)]
        )
        self.assertEqual(
            util.get_dates_in_range('2019-12-29', '2020-01-02'),
            [
                datetime.date(2019,12,29),
                datetime.date(2019,12,30),
                datetime.date(2019,12,31),
                datetime.date(2020,1,1),
                datetime.date(2020,1,2)
            ]
        )
        self.assertEqual(
            util.get_dates_in_range('2019-12-29', '2020-01-08', weekdays=[0,1]),
            [
                datetime.date(2019,12,30),
                datetime.date(2019,12,31),
                datetime.date(2020,1,6),
                datetime.date(2020,1,7)
            ]
        )
        self.assertEqual(
            util.get_dates_in_range(datetime.date(2019,12,29), datetime.date(2020,1,1)),
            [
                datetime.date(2019,12,29),
                datetime.date(2019,12,30),
                datetime.date(2019,12,31),
                datetime.date(2020,1,1)
            ]
        )

    def test_haver_distance(self):

        lat1 = np.array([45.5181719,45.5245765])
        lon1 = np.array([-122.6676967,-122.6777818])

        lat2 = np.array([45.5169013,45.5212991])
        lon2 = np.array([-122.6720733,-122.6559808])

        self.assertEqual(
            np.round(util.haver_distance(lat1, lon1, lat2, lon2), 2).tolist(),
            [369.11, 1737.08]
        )
        self.assertEqual(
            np.round(util.haver_distance(lat1[0], lon1[0], lat2, lon2), 2).tolist(),
            [369.11, 976.78]
        )
        self.assertEqual(
            np.round(util.haver_distance(lat1, lon1, lat2[0], lon2[0]), 2).tolist(),
            [369.11, 962.37]
        )
        self.assertEqual(
            np.round(util.haver_distance(lat1[0], lon1[0], lat2[0], lon2[0]), 2),
            369.11
        )

if __name__ == '__main__':
    unittest.main()
