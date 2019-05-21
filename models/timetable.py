from datetime import date, time, datetime, timedelta
import pytz
import os
import requests

import pandas as pd
import numpy as np

from . import nextbus, arrival_history

class Timetable:
    def __init__(self, agency, route_id, timetable, date):
        self.agency = agency
        self.route_id = route_id
        self.timetable = timetable
        self.date = date

    def get_data_frame(self, stop_id, direction = None):
        if direction is None:
            df = self.timetable.loc[self.timetable.nextbus_id.apply(lambda x: x == stop_id) ["arrival_time", "departure_time"]].copy(deep = True)
        else:
            direction_name = "inbound" if "i" in direction.lower() else "outbound"
            df = self.timetable.loc[(self.timetable.nextbus_id.apply(lambda x: x == stop_id)) & (self.timetable.direction.apply(lambda x: x == direction_name)), ["arrival_time", "departure_time"]].copy(deep = True)

        df.index = range(len(df))
        df["arrival_headway"] = df.arrival_time - df.arrival_time.shift(1)
        df["departure_headway"] = df.departure_time - df.departure_time.shift(1)

        return df

    def get_stop_direction(self, stop_id):
        return self.timetable[self.timetable.stop_id == stop_id].direction.unique()[0]

    def pretty_print(self, stop_id, direction = None):
        df = self.get_data_frame(stop_id = stop_id, direction = direction)

        if len(df) > 0:
            df[["arrival_time", "departure_time"]] = df[["arrival_time", "departure_time"]].applymap(lambda x: x.time())
            df[["arrival_headway", "departure_headway"]] = df[["arrival_headway", "departure_headway"]].applymap(lambda x: f"{round(x.total_seconds()/60, 1)} min")
            df = df[["arrival_time", "arrival_headway", "departure_time", "departure_headway"]]

            with pd.option_context('display.max_rows', None, 'display.max_columns', None, 'display.expand_frame_repr', False):
                print(df.rename({
                    "arrival_time": "Arrival Time",
                    "departure_time": "Departure Time",
                    "arrival_headway": "Arrival Headway",
                    "departure_headway": "Departure Headway"
                }, axis = "columns"))
        else:
            print(f"No timetable found for {stop_id} on route {self.route_id} on {self.date} going {self.get_stop_direction(stop_id)}.")

def get_s3_bucket():
    return "opentransit-muni-schedules"

def csv_string_to_df(s: str):
    # remove empty rows
    elements = [list(map(lambda x: x.strip(), x.split(","))) for x in s.split("\n") if len(x) > 0]
    return pd.DataFrame(elements[1:], columns = elements[0])

def get_timetable_from_csv(path: str, agency: str, route_id: str, d: date):
    date_period = get_date_period(path, d)
    delta = datetime.combine(d, time(), tzinfo = pytz.timezone('US/Pacific')) - date_period[0]
    date_range_str = f"{date_period[0].date().isoformat()}_to_{date_period[-1].date().isoformat()}"
    filename = f"route_{route_id}_{date_range_str}_timetable.csv"
    
    # checks for a local file; if it doesn't exist, pull it from the s3 bucket and cache it locally
    try:
        with open(f"{path}/{filename}", "r") as f:
            data = f.read() 
    except FileNotFoundError as err:
        s3_bucket = get_s3_bucket()
        data = requests.get(f"http://{s3_bucket}.s3.amazonaws.com/{date_range_str}/{filename}").text

        with open(f"{path}/{filename}", "w") as f:
            f.write(data)

    timetable = csv_string_to_df(data)
    timetable[["arrival_time", "departure_time"]] = timetable[["arrival_time", "departure_time"]].applymap(lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S%z") + delta)

    return Timetable(agency, route_id, timetable, d)

def get_date_ranges(path: str):
    filename = "date_ranges.csv"
    
    # checks for a local file; if it doesn't exist, pull it from the s3 bucket and cache it locally
    try:
        with open(f"{path}/{filename}", "r") as f:
            data = f.read()
    except FileNotFoundError as err:
        s3_bucket = get_s3_bucket()
        data = requests.get(f"http://{s3_bucket}.s3.amazonaws.com/{filename}").text

        with open(f"{path}/{filename}", "w") as f:
            f.write(data)

    return csv_string_to_df(data)

def get_date_period(path: str, d: date):
    try:
        date_ranges = get_date_ranges(path)
    except Exception as err:
        print(f"Error attempting to fetch date ranges for {d.isoformat()}: {err}")

    date_ranges["date_range"] = date_ranges.apply(lambda x: pd.date_range(start = x.start_date, end = x.end_date), axis = "columns")

    period = date_ranges[date_ranges.date_range.apply(lambda x: d in x)]

    # return the exception if it exists
    if len(period[period.type == "exception"]) > 0:
        date_range = period[period.type == "exception"].date_range.squeeze()

        return list(map(lambda x: datetime.combine(x, time(), tzinfo = pytz.timezone('US/Pacific')), [date_range[0], date_range[-1]]))
    elif len(period) > 0:
        date_range = period.date_range.iloc[0]

        return list(map(lambda x: datetime.combine(x, time(), tzinfo = pytz.timezone('US/Pacific')), [date_range[0], date_range[-1]]))
    else:
        raise Exception(f"No timetable data for {d.isoformat()}")


