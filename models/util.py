from datetime import datetime, date, timedelta
import os
import pytz

# todo: allow specifying day(s) of week
def get_dates_in_range(start_date_str, end_date_str, max_dates=1000):
    (start_year,start_month,start_day) = start_date_str.split('-')
    start_date = date(int(start_year),int(start_month), int(start_day))

    (end_year,end_month,end_day) = end_date_str.split('-')
    end_date = date(int(end_year),int(end_month), int(end_day))

    delta = end_date - start_date
    if delta.days < 0:
        raise Exception(f'start date after end date')

    incr = timedelta(days=1)

    res = []
    cur_date = start_date
    while True:
        res.append(cur_date)
        cur_date = cur_date + incr
        if cur_date > end_date:
            break

        if len(res) > max_dates:
            raise Exception(f'too many dates between {start_date_str} and {end_date_str}')

    return res

def render_dwell_time(seconds):
    # remove 0 hours and replace 00 minutes with spaces to make it easier to scan column for large durations
    return f'+{timedelta(seconds=round(seconds))}'.replace('+0:','+').replace('+00:','+  :')

def get_data_dir():
    return f"{os.path.dirname(os.path.dirname(os.path.realpath(__file__)))}/data"

def get_localized_datetime(d: date, time_str: str, tz: pytz.timezone):

    time_str_parts = time_str.split('+') # + number of days

    if len(time_str_parts[0].split(':')) == 2:
        format = "%Y-%m-%d %H:%M"
    else:
        format = "%Y-%m-%d %H:%M:%S"

    dt_str = f"{d.isoformat()} {time_str_parts[0]}"

    dt = datetime.strptime(dt_str, format)
    if len(time_str_parts) > 1:
        dt = dt + timedelta(days=int(time_str_parts[1]))

    return tz.localize(dt)