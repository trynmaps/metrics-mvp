import pandas as pd

from . import get_stops


def test():
    return "test test test"


def get_average_waiting_time(stop_id, route_id, direction,
                             date_range = [d.date().strftime("%Y-%m-%d") for d in pd.date_range(pd.datetime.today(), periods=30).tolist()],
                             time_range = ("00:00", "23:59")):
    """Gets average waiting time for all buses with given parameters.

    Uses historical data to compute this. Gets the average waiting time for all
    buses at the given stop, on the given route/direction, within the given
    time range and date range.

    Can be used to answer questions like, "what's the average waiting time at
    the 9th & Mission stop on the outbound 14 line from 9am-5pm in the last
    month?"

    Args:
        stop_id (str): the numeric ID of the bus stop, e.g. "4970"
        route_id (str): the numeric ID of the bus route, e.g. "12"
        direction (str): "O" for outbound, "I" for inbound
        date_range (list(str)): a list of strings representing dates to consider,
            formatted as `YYYY-MM-DD`. if not passed, defaults to the last month.
        time_range ((str, str)): a tuple with start and end times
            in Pacific Time (UTC-8), formatted as `HH:MM`

    Returns:
        double: average waiting time, in minutes
    """
    stops = get_stops.get_stops(date_range, [route_id], f"{route_id}___{direction}_F00", [stop_id], time_range)
    waits = get_stops.all_wait_times(stops, time_range, ['SID'])

    # TODO: later on, add filtering for days of week, dates, and times of year

    # This is a stub function so we return some random number :)
    return waits['WAIT'].mean()/60

"""
josh's comments

  # For
  #  - last weekday
  #  - last weekend day
  #  - last full work week
  #  - last full weekend
  #  - this month
  #  - last month
  #  - last 3 months
  #  - last year
  #  - last 5 years
  #  calculate average for each time_buckets
  #  calculate variability of each time buckets
  #  include comparison of actual to scheduled


# """