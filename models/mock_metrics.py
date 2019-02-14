def test():
    return "test test test"

def get_average_waiting_time(stop_id, route_id, direction, time_range):
    """Gets average waiting time for all buses with given parameters.

    Uses historical data to compute this. Gets the average waiting time for all
    buses at the given stop, on the given route/direction, within the given
    time range.

    Can be used to answer questions like, "what's the average waiting time at
    the 9th & Mission stop on the outbound 14 line from 9am-5pm?"

    Args:
        stop_id (str): the numeric ID of the bus stop, e.g. "4970"
        route_id (str): the numeric ID of the bus route, e.g. "12"
        direction (str): "O" for outbound, "I" for inbound
        time_range ((int, int)): number of minutes from midnight to filter by. (540, 1020) means 9a-5p.

    Returns:
        double: average waiting time,, in minutes
    """

  # TODO: later on, add filtering for days of week, dates, and times of year

  # This is a stub function so we return some random number :)
  return 5.0

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


"""
