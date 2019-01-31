def get_average_waiting_time(stop_id, route_id, direction, time_bucket):
  # Returns the average waiting time for all buses with the given stop, route, and direction, filtered within the given time bucket 
  # and dates
  
  # Later on, add filtering for days of week and times of year
 
    
  return 5 # in minutes 


def test_average_waiting_time():
  # Example use of the get_average_waiting_time() function 
  return get_average_wait_time(
    "101", # stop id
    "14", # route number
    "O", # direction - O for outbound, I for inbound
    [360, 480] # number of minutes from midnight; this example means we only consider 6am-8am
  )

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
