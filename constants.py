from datetime import datetime
from pytz import timezone

DEFAULT_TIME_STR_INTERVALS = [
  {
    'start_time': '03:00',
    'end_time': '07:00'
  },
  {
    'start_time': '07:00',
    'end_time': '10:00'
  },
  {
    'start_time': '10:00',
    'end_time': '16:00'
  },
  {
    'start_time': '16:00',
    'end_time': '19:00'
  },
  {
    'start_time': '19:00',
    'end_time': '03:00+1'
  }
]

PACIFIC_TIMEZONE = timezone('US/Pacific')