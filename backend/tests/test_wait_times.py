import backend_path
import unittest
import datetime
import numpy as np
import pandas as pd
from backend.models import wait_times

class WaitTimesTest(unittest.TestCase):

    def test_get_stats(self):

        time_values = np.array([
            300,
            600, # 300s = 5m
            900, # 300s = 5m
            1500, # 600s = 10m
            3600, # 2100s = 35m
            7200 # 3600 = 60m
        ]) # total interval: 115m

        stats = wait_times.get_stats(time_values)

        avg_wait_time = (5*5/2 + 5*5/2 + 10*10/2 + 35*35/2 + 60*60/2)/115

        self.assertEqual(stats.get_average(), avg_wait_time)

        prob_lt_5 = (5*5)/115
        self.assertEqual(stats.get_quantile(prob_lt_5), 5)
        self.assertEqual(stats.get_probability_less_than(5), prob_lt_5)
        self.assertEqual(stats.get_probability_greater_than(5), 1-prob_lt_5)

        prob_lt_10 = ((5*5)+(5*3))/115
        self.assertEqual(stats.get_quantile(prob_lt_10), 10)
        self.assertEqual(stats.get_probability_less_than(10), prob_lt_10)

        prob_lt_35 = ((5*5)+(5*3)+(25*2))/115
        self.assertEqual(stats.get_quantile(prob_lt_35), 35)
        self.assertEqual(stats.get_probability_less_than(35), prob_lt_35)

        self.assertEqual(stats.get_probability_less_than(18.75), 0.5)
        self.assertEqual(stats.get_probability_less_than(100), 1)
        self.assertEqual(stats.get_probability_less_than(-1), 0)

        histogram = stats.get_histogram([0,5,10,15,30,60,90])

        self.assertEqual(len(histogram), 6)
        self.assertEqual(histogram[0], prob_lt_5)
        self.assertEqual(histogram[1], prob_lt_10-prob_lt_5)
        self.assertEqual(round(histogram[2],5), round((prob_lt_35-prob_lt_10)/5,5))
        self.assertEqual(round(histogram[3],5), round((prob_lt_35-prob_lt_10)*3/5,5))
        self.assertEqual(histogram[4], 1-np.sum(histogram[0:4]))
        self.assertEqual(0, histogram[5])

        quantiles = stats.get_quantiles([0, 0.1, 0.5, 0.9, 1])

        self.assertEqual(len(quantiles), 5)
        self.assertEqual(quantiles[0], 0)
        self.assertEqual(round(quantiles[1], 5), 2.3)
        self.assertEqual(quantiles[2], 18.75)
        self.assertEqual(quantiles[3], 48.5)
        self.assertEqual(quantiles[4], 60)

        self.assertEqual(stats.get_percentiles([50,90]).tolist(), [18.75, 48.5])
        self.assertEqual(stats.get_percentile(100), 60)

        sampled_waits = stats.get_sampled_waits(60)
        self.assertEqual(len(sampled_waits), 115)
        self.assertEqual(np.min(sampled_waits), 0)
        self.assertEqual(round(np.average(sampled_waits), 1), 21.1)
        self.assertEqual(round(np.median(sampled_waits), 1), 18.0)
        self.assertEqual(np.max(sampled_waits), 59)

        # test arrival after end of interval

        stats = wait_times.get_stats(time_values, 600, 1020) # 7 minutes long
        self.assertEqual(round(stats.get_average(),5), round(((5*5)/2 + (2*2)/2 + (2*8))/7,5))

        self.assertEqual(stats.get_quantiles([0,1]).tolist(), [0,10])

        self.assertEqual(round(stats.get_probability_less_than(4), 5), round(4/7, 5))
        self.assertEqual(stats.get_probability_less_than(5), 5/7)
        self.assertEqual(stats.get_probability_less_than(8), 5/7)
        self.assertEqual(round(stats.get_probability_less_than(9), 5), round(6/7,5))

        # test no arrivals in interval
        stats = wait_times.get_stats(np.array([]))
        self.assertEqual(stats.get_average(), None)
        self.assertEqual(stats.get_percentile(50), None)
        self.assertEqual(stats.get_percentiles([50]), None)
        self.assertEqual(stats.get_probability_less_than(5), None)
        self.assertEqual(stats.get_probability_greater_than(5), None)
        self.assertEqual(stats.get_quantile(0), None)
        self.assertEqual(stats.get_quantiles([0,0.5]), None)
        self.assertEqual(stats.get_histogram([0,60]), None)
        self.assertEqual(stats.get_sampled_waits(), None)

    def test_combine_stats(self):

        stats1 = wait_times.get_stats(np.array([
            300,
            600,
            900,
            1500,
            3600,
            7200
        ])) # 115 min

        stats2 = wait_times.get_stats(np.array([
            30300,
            30360,
            31800,
            32100,
            33000,
            36000,
            39360,
        ])) # 151 min

        stats3 = wait_times.get_stats(np.array([]))

        stats4 = wait_times.get_stats(np.array([
            60300,
            63000,
            69600,
        ])) # 155 min

        combined = wait_times.combine_stats([stats1, stats2, stats3, stats4])

        self.assertEqual(round(combined.get_average(), 3), round((stats1.get_average() + stats2.get_average() + stats4.get_average()) / 3, 3))
        self.assertEqual(round(combined.get_percentile(50), 3), 23.664)
        self.assertEqual(combined.get_percentiles([0,100]).tolist(), [0,110])
        self.assertEqual(round(combined.get_probability_less_than(5), 3), 0.151)
        self.assertEqual(round(combined.get_probability_greater_than(5), 3), 1-0.151)
        self.assertEqual(round(combined.get_quantile(0.5), 3), 23.664)
        self.assertEqual(combined.get_quantiles([0,1]).tolist(), [0,110])

        histogram = combined.get_histogram([0,30,60,110])
        self.assertEqual(round(histogram[0], 3), 0.593)
        self.assertEqual(round(histogram[1], 3), 0.300)
        self.assertEqual(round(histogram[2], 3), 0.108)
        self.assertEqual(len(combined.get_sampled_waits()), 421)

if __name__ == '__main__':
    unittest.main()
