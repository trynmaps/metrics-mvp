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

DEFAULT_STAT_KEYS = ['count', 'avg', 'min', 'median', 'max']