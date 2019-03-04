import json
import requests
from datetime import datetime, timedelta, timezone, time, date

import pandas as pd
import numpy as np

from eclipses import query_graphql, produce_buses, produce_stops, find_eclipses, find_nadirs


def get_stops(data = None, **kwargs):
    """Returns a DataFrame containing every instance of a bus arriving at a stop.
    
    Can be passed existing geolocation data, or specify a query with named parameters:

        dates: an array of dates, formatted as strings in the form YYYY-MM-DD
        routes: an array of routes, each represented as a string
        directions: an array of strings representing the directions to filter (optional)
        stops: an array of strings representing the stops to filter (optional)
        timespan: a tuple with the start and end times (in UTC -8:00) as strings in the form HH:MM (optional)
    """
    params = ["dates", "routes", "directions", "stops", "timespan"]

    if data is not None:
        return get_stops_from_data(data)
    else:
        print(kwargs)
        # first check for invalid params or missing params
        for key in kwargs.keys():
            # error handling here?
            if key not in params:
                return f"Error: {key} is an invalid parameter!"

        for param in ["dates", "routes"]:
            # error handling here?
            if param not in kwargs.keys():
                return f"Error: {param} is a required parameter!"
        
        return get_queried_stops(**kwargs)
     

# get all stops from raw json data from graphql
# getting all stops at once from the entire set of location data might take prohibitively long (~3-4 hours)
def get_stops_from_data(data):
    bus_stops = pd.DataFrame(columns = ["VID", "TIME", "SID", "DID", "ROUTE"])
    
    for route in {ele['rid'] for ele in data}:
        #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: Starting with {route}.")
        try:
            stop_ids = [stop['id']
                for stop
                in requests.get(f"http://restbus.info/api/agencies/sf-muni/routes/{route}").json()['stops']]
                 
            route_data = [ele for ele in data if ele['rid'] == route]

            for stop_id in stop_ids:
                bus_stops = bus_stops.append(get_arrivals(route, route_data, stop_id), sort = True)
                     
        except KeyError as err:
            print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: KeyError at {route}: {err}")
            continue
  
    return bus_stops


def get_queried_stops(dates, routes, directions=[], stops=[], timespan=("00:00", "23:59")):
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
    bus_stops = pd.DataFrame(columns = ["VID", "TIME", "SID", "DID", "ROUTE"])

    for route in routes:
        stop_ids = [stop['id']
            for stop
            in requests.get(f"http://restbus.info/api/agencies/sf-muni/routes/{route}").json()['stops']]

        for stop_id in stop_ids:
            # check if stops to filter were provided, or if the stop_id is in the list of filtered stops
            if (stop_id in stops) ^ (len(stops) == 0):
                for date in dates:
                    # parse date/time to pass to query                   
                    start_time = int(datetime.strptime(f"{date} {timespan[0]} -0800", "%Y-%m-%d %H:%M %z").timestamp())*1000
                    end_time   = int(datetime.strptime(f"{date} {timespan[1]} -0800", "%Y-%m-%d %H:%M %z").timestamp())*1000
    
                    dt_params = tuple(int(x) for x in date.split("-") + timespan[0].split(":") + ["0"])
                    hours = int((end_time - start_time)//36e5)

                    data = query_graphql([route], dt_params, hours)
                    #print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: performed query.")

                    if data is None:  # API might refuse to cooperate
                        print("API probably timed out")
                        continue
                    elif len(data) == 0:  # some days somehow have no data
                        print(f"no data for {date}")
                        continue
                    else:
                        bus_stops = bus_stops.append(get_arrivals(route, data, stop_id), sort = True)

    # filter for directions
    if len(directions) > 0:
        bus_stops = bus_stops.loc[bus_stops['DID'].apply(lambda x: x in directions)]

    return bus_stops


# get the arrivals to a single stop on a single route
def get_arrivals(route, route_data, stop_id):
    print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: starting processing for {stop_id} and {route}")
    try:
        stops = produce_stops(route_data, route)
        buses = produce_buses(route_data)

        stop = stops[stops['SID'] == stop_id].drop_duplicates().squeeze()
        buses = buses[buses['DID'] == stop['DID']]

        eclipses = find_eclipses(buses, stop)
        nadirs = find_nadirs(eclipses)

        nadirs["TIME"] = nadirs["TIME"].apply(lambda x: datetime.fromtimestamp(x//1000, timezone(timedelta(hours = -8))))
        nadirs["SID"] = stop_id
        nadirs["DID"] = stop["DID"]
        nadirs["ROUTE"] = route
        
        return nadirs
    except ValueError as err: # accounts for stops with no associated direction
        print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: skipping buses for stop {stop_id} and route {route} due to ValueError: {err}")
        return pd.DataFrame()
    except Exception as err:
        print(f"{datetime.now().strftime('%a %b %d %I:%M:%S %p')}: could not produce stops df for {stop_id} on route {route}: {err}")
        return pd.DataFrame()