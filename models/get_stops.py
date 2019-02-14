import json
import requests

from datetime import datetime, timedelta, timezone, time, date
from itertools import product
from functools import reduce
from .eclipses import query_graphql, produce_buses, produce_stops, find_eclipses, find_nadirs

import pandas as pd
import numpy as np

def get_stops(dates, routes, directions = [], new_stops = [], timespan = ("00:00", "23:59")):
    """
    get_stops
    
    Description:
        Returns every instance of a bus stopping at a given set of stops, on a given set of routes, during a given time period.

    Parameters:
        dates: an array of dates, formatted as strings in the form YYYY-MM-DD
        routes: an array of routes, each represented as a string
        directions: an array of strings representing the directions to filter
        stops: an array of strings representing the stops to filter
        times: a tuple with the start and end times (in UTC -8:00) as strings in the form HH:MM 

    Returns:
        stops: a DataFrame, filtered by the given directions and stops, with the following columns:
            VID: the vehicle ID
            Time: a datetime object representing the date/time of the stop
            Route: the route on which the stop occurred
            Stop: the stop at which the stop occurred
            Dir: the direction in which the stop occurred
    """
    bus_stops = pd.DataFrame(columns = ["VID", "DATE", "TIME", "SID", "DID", "ROUTE"])
    
    for route in routes:
        stop_ids = [stop['id']
            for stop
            in requests.get(f"http://restbus.info/api/agencies/sf-muni/routes/{route}").json()['stops']]

        for stop_id in stop_ids:
            # check if stops to filter were provided, or if the stop_id is in the list of filtered stops
            if (stop_id in new_stops) ^ (len(new_stops) == 0):
                for date in dates:
                    #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: starting processing on stop {stop_id} on route {route} on {date}.")
                    start_time = int(datetime.strptime(f"{date} {timespan[0]} -0800", "%Y-%m-%d %H:%M %z").timestamp())*1000
                    end_time   = int(datetime.strptime(f"{date} {timespan[1]} -0800", "%Y-%m-%d %H:%M %z").timestamp())*1000

                    data = query_graphql(start_time, end_time, route)
                    #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: performed query.")
                          
                    if data is None:  # API might refuse to cooperate
                        print("API probably timed out")
                        continue
                    elif len(data) == 0:  # some days somehow have no data
                        print(f"no data for {date}")
                        continue
                    else:
                        stops = produce_stops(data, route)
                        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: produced stops.")
                              
                        buses = produce_buses(data)
                        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: produced buses.")

                        stop = stops[stops['SID'] == stop_id].squeeze()
                        buses = buses[buses['DID'] == stop['DID']]

                        eclipses = find_eclipses(buses, stop)
                        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: found eclipses.")
                              
                        nadirs = find_nadirs(eclipses)
                        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: found nadirs.")
                            
                        nadirs["TIME"] = nadirs["TIME"].apply(lambda x: datetime.fromtimestamp(x//1000, timezone(timedelta(hours = -8))))
                        nadirs['DATE'] = nadirs['TIME'].apply(lambda x: x.date())
                        nadirs['TIME'] = nadirs['TIME'].apply(lambda x: x.time())
                        nadirs["SID"] = stop_id
                        nadirs["DID"] = stop["DID"]
                        nadirs["ROUTE"] = route
                        bus_stops = bus_stops.append(nadirs, sort = True)
                        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: finished processing.")

    # filter for directions
    if len(directions) > 0:
        bus_stops = bus_stops.loc[bus_stops['DID'].apply(lambda x: x in directions)]

    # prepare timestamp data
    bus_stops['timestamp'] = bus_stops[['DATE', 'TIME']].apply(lambda x: datetime.strptime(f"{x['DATE'].isoformat()} {x['TIME'].isoformat()} -0800", 
                                                                                       "%Y-%m-%d %H:%M:%S %z"), axis = 'columns')

    
    return bus_stops

# find the smallest nonnegative waiting time
def absmin(series):
    return series[series >= 0].min()

# # input: df with entries from one day
# # possible optimzation: sort df by timestamp, then pick first timestamp > minute for each minute (need to time to make sure but should be faster)
def minimum_waiting_times(df, start_time, end_time, group):
    minute_range = [start_time + timedelta(minutes = i) for i in range((end_time - start_time).seconds//60)]
    wait_times = pd.DataFrame(columns = [])
    
    for minute in minute_range:
        df['WAIT'] = df['timestamp'].apply(lambda x: (x - minute).total_seconds())
        pivot = df[group + ['WAIT']].pivot_table(values = ['WAIT'], index = group, aggfunc = absmin)
        pivot['TIME'] = minute
        pivot = pivot.reset_index()
        wait_times = wait_times.append(pivot, sort = True)
        
    return wait_times

def all_wait_times(df, timespan, group):
    dates = df['DATE'].unique()
    avg_over_pd = pd.DataFrame(columns = group + ['DATE', 'TIME', 'WAIT'])
    
    for date in dates:
        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: start processing {date}.")
        start_time = datetime.strptime(f"{date.isoformat()} {timespan[0]} -0800", "%Y-%m-%d %H:%M %z")
        end_time   = datetime.strptime(f"{date.isoformat()} {timespan[1]} -0800", "%Y-%m-%d %H:%M %z")
        daily_wait = minimum_waiting_times(df[df['DATE'] == date], start_time, end_time, group)
        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: found waits for {date}.")      
        #daily_wait = daily_wait.pivot_table(values = ['WAIT'], index = group).reset_index()
        daily_wait['DATE'] = date
        daily_wait['TIME'] = daily_wait['TIME'].apply(lambda x: x.time())
        avg_over_pd = avg_over_pd.append(daily_wait, sort = True)
    
    return avg_over_pd
    
def quantiles(series):
    return [np.percentile(series, i) for i in [5, 25, 50, 75, 95]]

def get_summary_statistics(df, group):
    waits = df.pivot_table(values = ['WAIT'], index = group, aggfunc = {'WAIT': [np.mean, np.std, quantiles]}).reset_index()
    waits.columns = ['_'.join(col) if col[0] == 'WAIT' else ''.join(col) for col in waits.columns.values]
    waits[[f"{i}th percentile" for i in [5, 25, 50, 75, 95]]] = waits['WAIT_quantiles'].apply(lambda x: pd.Series(x))
    waits = waits.drop('WAIT_quantiles', axis = 1)
    return waits