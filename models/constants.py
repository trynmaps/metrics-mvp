import pytz

DEFAULT_TIME_STR_INTERVALS = [
  ('03:00','07:00'),
  ('07:00','10:00'),
  ('10:00','16:00'),
  ('16:00','19:00'),
  ('19:00','03:00+1'),
]

PACIFIC_TIMEZONE = pytz.timezone('US/Pacific')

AGENCY = 'sf-muni'

DEFAULT_KEYS = ['count','avg','min','median','max','percentiles','histogram']

# test params
TEST_PARAMS = {
    'route_id': '12',
    'start_stop_id': '3476',
    'end_stop_id': None,
    'date_str': '2019-06-06',
    'start_date_str': None,
    'end_date_str': None,
    'direction_id': "12___I_F00",
    'start_time_str': '00:00',
    'end_time_str': '23:59',
    'use_intervals': 'true',
    'interval_length': None,
    'keys': None
}