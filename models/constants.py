import pytz

DEFAULT_TIME_STR_INTERVALS = [
    ('03:00', '07:00'),
    ('07:00', '10:00'),
    ('10:00', '16:00'),
    ('16:00', '19:00'),
    ('19:00', '03:00+1'),
]

PACIFIC_TIMEZONE = pytz.timezone('US/Pacific')

SIRI_API_KEY_TEST = '2b81cac7-b863-4f47-bc87-aab157fc052c'
