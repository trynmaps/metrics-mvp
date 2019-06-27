from datetime import datetime, date, timedelta
import os
import pytz

def quantile_sorted(sorted_arr, quantile):
    # For small arrays (less than about 4000 items) np.quantile is significantly
    # slower than sorting the array and picking the quantile out by index. Computing
    # quantiles this way significantly improves performance for computing
    # trip time stats across all stops.

    max_index = len(sorted_arr) - 1
    quantile_index = max_index * quantile
    quantile_index_int = int(quantile_index)
    quantile_index_fractional = quantile_index - quantile_index_int

    quantile_lower = sorted_arr[quantile_index_int]
    if quantile_index_fractional > 0:
        quantile_upper = sorted_arr[quantile_index_int + 1]
        return quantile_lower + (quantile_upper - quantile_lower) * quantile_index_fractional
    else:
        return quantile_lower

def parse_date(date_str):
    (y,m,d) = date_str.split('-')
    return date(int(y),int(m),int(d))

# todo: allow specifying day(s) of week
def get_dates_in_range(start_date_str, end_date_str, max_dates=1000):
    start_date = parse_date(start_date_str)
    end_date = parse_date(end_date_str)

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

def get_timestamp_or_none(d: date, time_str: str, tz: pytz.timezone):
    return int(get_localized_datetime(d, time_str, tz).timestamp()) if time_str is not None else None

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
