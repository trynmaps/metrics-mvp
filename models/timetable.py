from datetime import date, time, datetime, timedelta
import pytz
import os
import requests
import gzip
from io import StringIO

import pandas as pd
import numpy as np

from . import nextbus, arrival_history, util, gtfs

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
        
        midnight = datetime.combine(self.date, time(), tzinfo = pytz.timezone('America/Los_Angeles'))
        df.index = range(len(df))
        df[["arrival_time", "departure_time"]] = df[["arrival_time", "departure_time"]].applymap(lambda x: midnight + timedelta(seconds = x))
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

def read_file(local_path: str, s3_path: str, filename: str):
    # checks for a local file; if it doesn't exist, pull it from the s3 bucket and cache it locally
    try:
        with open(f"{gtfs.get_schedule_dir()}/{filename}", "r") as f:
            data = f.read()
    except FileNotFoundError as err:
        s3_bucket = gtfs.get_s3_bucket()
        data = requests.get(f"http://{s3_bucket}.s3.amazonaws.com/{s3_path}{filename}").text

        with open(f"{gtfs.get_schedule_dir()}/{filename}", "w") as f:
            f.write(data)

    return pd.read_csv(StringIO(data), dtype = {'stop_id': str, 'nextbus_id': str})

def get_timetable_from_csv(agency: str, route_id: str, d: date, ver: str):
    date_period = get_date_period(d, ver)
    date_range_str = f"{date_period[0].date().isoformat()}_to_{date_period[-1].date().isoformat()}"
    local_path = f"{gtfs.get_s3_bucket()}/{date_range_str}"
    s3_path = f"{date_range_str}/"
    filename = f"{agency}_route_{route_id}_{date_range_str}_timetable_{ver}.csv"
    
    timetable = read_file(local_path, s3_path, filename)
    return Timetable(agency, route_id, timetable, d)

def get_date_ranges(ver: str):
    local_path = f"{gtfs.get_s3_bucket()}"
    s3_path = ""
    filename = f"date_ranges_{ver}.csv"

    return read_file(local_path, s3_path, filename)

def get_date_period(d: date, ver: str):
    date_ranges = get_date_ranges(ver)
    date_ranges["date_range"] = date_ranges.apply(lambda x: pd.date_range(start = x.start_date, end = x.end_date), axis = "columns")

    period = date_ranges[date_ranges.date_range.apply(lambda x: d in x)]

    # return the exception if it exists
    if len(period[period.type == "exception"]) > 0:
        date_range = period[period.type == "exception"].date_range.squeeze()
    elif len(period) > 0:
        date_range = period.date_range.iloc[0]
    else:
        raise Exception(f"No timetable data for {d.isoformat()}")

    return [date_range[0], date_range[-1]]