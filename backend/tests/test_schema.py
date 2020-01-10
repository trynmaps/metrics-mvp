import backend_path
import unittest
import json
from graphene.test import Client
import pandas as pd
import datetime
from backend.models import arrival_history, routeconfig
from backend.models.schema import metrics_api

class SchemaTest(unittest.TestCase):

    def test_route_metrics_query(self):

        routeconfig.save_routes('test', [], save_to_s3=False)

        d = datetime.date(2019,12,28)
        start_time = 1577530800
        end_time = 1577617200

        arrivals_df = pd.DataFrame([
                ['V1', 1577530900, 1577530960, 3, 'S1', '1', 2],
                ['V1', 1577530990, 1577531010, 4, 'S2', '1', 2],
                ['V1', 1577531020, 1577531030, 5, 'S3', '1', 2],
                ['V2', 1577544900, 1577544960, 6, 'S1', '1', 3],
                ['V2', 1577544999, 1577545010, 7, 'S2', '1', 3],
                ['V2', 1577545020, 1577545030, 8, 'S3', '1', 3],
                ['V1', 1577550900, 1577550967, 9, 'S1', '0', 4],
                ['V1', 1577550990, 1577551016, 10, 'S2', '0', 4],
                ['V1', 1577551020, 1577551035, 11, 'S3', '0', 4],
                ['V2', 1577561900, 1577561977, 9, 'S1', '1', 4],
                ['V2', 1577561990, 1577562006, 10, 'S2', '1', 4],
                ['V2', 1577562020, 1577562032, 11, 'S3', '1', 4],
            ],
            columns=[
                'VID','TIME','DEPARTURE_TIME','DIST','SID','DID','TRIP'
            ]
        )

        hist = arrival_history.from_data_frame('test', 'A', arrivals_df, start_time, end_time)
        arrival_history.save_for_date(hist, d)

        client = Client(metrics_api)
        res = client.execute('''
query {
  routeMetrics(agencyId:"test",routeId:"A") {
    trip(startStopId:"S1", endStopId: "S2", directionId:"1") {
      interval(dates:["2019-12-28"]) {
        waitTimes {
          min
          median
          max
        }
        headways {
          min
          median
          max
          count
        }
        tripTimes {
          min
          median
          max
          count
        }
      }
    }
  }
}
''')
        #print(json.dumps(res))

        self.assertIn('data', res)
        self.assertIn('routeMetrics', res['data'])
        self.assertIn('trip', res['data']['routeMetrics'])
        self.assertIn('interval', res['data']['routeMetrics']['trip'])

        interval_metrics = res['data']['routeMetrics']['trip']['interval']

        self.assertIn('waitTimes', interval_metrics)
        self.assertIn('tripTimes', interval_metrics)
        self.assertIn('headways', interval_metrics)

        wait_times_metrics = interval_metrics['waitTimes']

        self.assertEqual(0.0, wait_times_metrics['min'])
        self.assertEqual(129.238, wait_times_metrics['median'])
        self.assertEqual(283.617, wait_times_metrics['max'])

        trip_times_metrics = interval_metrics['tripTimes']

        self.assertEqual(0.217, trip_times_metrics['min'])
        self.assertEqual(0.5, trip_times_metrics['median'])
        self.assertEqual(0.65, trip_times_metrics['max'])
        self.assertEqual(3, trip_times_metrics['count'])

        headways_metrics = interval_metrics['headways']

        self.assertEqual(233.333, headways_metrics['min'])
        self.assertEqual(258.475, headways_metrics['median'])
        self.assertEqual(283.617, headways_metrics['max'])
        self.assertEqual(2, headways_metrics['count'])

if __name__ == '__main__':
    unittest.main()
