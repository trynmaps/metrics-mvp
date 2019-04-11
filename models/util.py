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

def get_data_dir():
    return f"{os.path.dirname(os.path.dirname(os.path.realpath(__file__)))}/data"

def get_localized_datetime(d: date, time_str: str):
    dt_str = f"{d.isoformat()} {time_str}"
    pst = pytz.timezone('US/Pacific')

    try:
        return pst.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S"))
    except ValueError:
        return pst.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M"))
