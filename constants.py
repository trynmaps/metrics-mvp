from datetime import datetime
DEFAULT_TIME_INTERVALS = [
  {
    'start_time': datetime.strptime('03:00', '%H:%M'),
    'end_time': datetime.strptime('07:00', '%H:%M')
  },
  {
    'start_time': datetime.strptime('07:00', '%H:%M'),
    'end_time': datetime.strptime('10:00', '%H:%M')
  },
  {
    'start_time': datetime.strptime('10:00', '%H:%M'),
    'end_time': datetime.strptime('16:00', '%H:%M')
  },
  {
    'start_time': datetime.strptime('16:00', '%H:%M'),
    'end_time': datetime.strptime('19:00', '%H:%M')
  },
  {
    'start_time': datetime.strptime('19:00', '%H:%M'),
    'end_time': datetime.strptime('03:00', '%H:%M')
  }
]
