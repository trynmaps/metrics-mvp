import backend_path
import unittest
import datetime
import numpy as np
import pandas as pd
from backend.models import arrival_history

class ArrivalHistoryTest(unittest.TestCase):

    def test_get_data_frame(self):
        d = datetime.date(2019,12,28)
        start_time = 1577530800
        end_time = 1577617200

        arrivals_df = pd.DataFrame([
                ['V1', 1577530900, 1577530960, 3, 'S1', '1', 2],
                ['V1', 1577530990, 1577531010, 4, 'S2', '1', 2],
                ['V1', 1577531020, 1577531030, 5, 'S3', '1', 2],
                ['V2', 1577540900, 1577540960, 6, 'S1', '1', 3],
                ['V2', 1577540990, 1577541010, 7, 'S2', '1', 3],
                ['V2', 1577541020, 1577541030, 8, 'S3', '1', 3],
                ['V1', 1577550900, 1577550960, 9, 'S7', '0', 4],
                ['V1', 1577550990, 1577551010, 10, 'S8', '0', 4],
                ['V1', 1577551020, 1577551030, 11, 'S1', '0', 4],
            ],
            columns=[
                'VID','TIME','DEPARTURE_TIME','DIST','SID','DID','TRIP'
            ]
        )

        hist = arrival_history.from_data_frame('test', 'A', arrivals_df, start_time, end_time)
        arrival_history.save_for_date(hist, d)

        history = arrival_history.get_by_date('test', 'A', d)

        self.assertEqual(history.agency_id, 'test')
        self.assertEqual(history.route_id, 'A')
        self.assertEqual(history.start_time, start_time)
        self.assertEqual(history.end_time, end_time)
        self.assertEqual(history.version, arrival_history.DefaultVersion)

        df = history.get_data_frame().sort_values('TIME')
        self.assertEqual(len(df), 9)
        self.assertEqual(df['TIME'].values[0], 1577530900)
        self.assertEqual(df['DEPARTURE_TIME'].values[0], 1577530960)
        self.assertEqual(df['VID'].values[0], 'V1')
        self.assertEqual(df['DIST'].values[0], 3)
        self.assertEqual(df['SID'].values[0], 'S1')
        self.assertEqual(df['DID'].values[0], '1')
        self.assertEqual(df['TRIP'].values[0], 2)

        df = history.get_data_frame(direction_id='1').sort_values('TIME')
        self.assertEqual(len(df), 6)
        self.assertEqual(df['VID'].values[-1], 'V2')

        df = history.get_data_frame(stop_id='S2').sort_values('TIME')
        self.assertEqual(len(df), 2)
        self.assertEqual(df['SID'].values[0], 'S2')

        df = history.get_data_frame(stop_id='S1', direction_id='0').sort_values('TIME')
        self.assertEqual(len(df), 1)

        df = history.get_data_frame(vehicle_id='V2').sort_values('TIME')
        self.assertEqual(len(df), 3)
        self.assertEqual(df['VID'].values[0], 'V2')

        df = history.get_data_frame(start_time=1577530990, end_time=1577550990).sort_values('TIME')
        self.assertEqual(len(df), 6)
        self.assertEqual(df['TIME'].values[0], 1577530990)
        self.assertEqual(df['TIME'].values[-1], 1577550900)

if __name__ == '__main__':
    unittest.main()
