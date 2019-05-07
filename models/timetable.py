from datetime import date, datetime, timedelta, timezone
import os

import pandas as pd
import numpy as np
from . import nextbus, metrics, arrival_history

class Timetable:
    def __init__(self, agency, route_id, timetable, date):
        self.agency = agency
        self.route_id = route_id
        self.timetable = timetable
        self.date = date

    def get_data_frame(self, stop_id, direction = None):
        try:
            if direction is None:
                df = self.timetable[self.timetable.nextbus_id == int(stop_id)][["arrival_time", "departure_time"]]
            else:
                direction_name = "inbound" if "i" in direction.lower() else "outbound"
                df = self.timetable[(self.timetable.nextbus_id == int(stop_id)) & (self.timetable.direction == direction_name)][["arrival_time", "departure_time"]]

            df.index = range(len(df))
            df["arrival_headway"] = df.arrival_time - df.arrival_time.shift(1)
            df["departure_headway"] = df.departure_time - df.departure_time.shift(1)

            return df
        except Exception as err:
            print(f"Error attempting to fetch timetable for stop {stop_id}: {err}")

    def get_stop_direction(self, stop_id):
        return self.timetable[self.timetable.stop_id == int(stop_id)].direction.unique()[0]

    def pretty_print(self, stop_id, direction = None):
        try:
            df = self.get_data_frame(stop_id = stop_id, direction = direction)
            
            if len(df) > 0:
                print(f"Timetable for stop {stop_id} on route {self.route_id} on {self.date} going {self.get_stop_direction(stop_id)}:")
                print("Arrival Time | Arrival Headway | Departure Time | Departure Headway")
                for row in df.itertuples():
                    arr = row[1].time().isoformat()
                    arr_headway = round(row[3].total_seconds()/60, 1)
                    dep = row[2].time().isoformat()
                    dep_headway = round(row[4].total_seconds()/60, 1)
                    print(f"{arr.ljust(12)} | {(str(arr_headway) + ' min').ljust(15)} | {dep.ljust(14)} | {(str(dep_headway) + ' min').ljust(17)}")
                print("-----------")

                print(f"Number of stops: {len(df)}")
                print(f"First scheduled arrival: {df.arrival_time.min().time().isoformat()}")
                print(f"Last scheduled arrival: {df.arrival_time.max().time().isoformat()}")
                print(f"Average arrival headway: {round(df.arrival_headway.mean().total_seconds()/60, 1)} min")
                print(f"Average departure headway: {round(df.departure_headway.mean().total_seconds()/60, 1)} min")
            else:
                print(f"No timetable found for {stop_id} on route {self.route_id} on {self.date} going {self.get_stop_direction(stop_id)}.")
        except Exception as err:
            print(f"Error occurred while displaying timetable for {stop_id}: {err}")

def get_timetable_from_csv(path: str, agency: str, route_id: str, d: date):
    try:
        date_period = get_date_period(path, d)
        delta = d - date_period
        filepath = f"{path}/route_{route_id}_{date_period}_timetable.csv"
        timetable = pd.read_csv(filepath)
        timetable[["arrival_time", "departure_time"]] = timetable[["arrival_time", "departure_time"]].applymap(lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S%z") + delta)

        return Timetable(agency, route_id, timetable, d)
    except Exception as err:
        print(f"Error attempting to fetch timetable for route {route_id} on {d.isoformat()}: {err}")

        return pd.DataFrame()

def get_date_period(path: str, d: date):
    try:
        date_ranges = pd.read_csv(f"{path}/date_ranges.csv")
    except Exception as err:
        print(f"Error attempting to fetch date ranges for {d.isoformat()}: {err}")

    date_ranges["date_range"] = date_ranges.apply(lambda x: pd.date_range(start = x.start_date, end = x.end_date), axis = "columns")

    period = date_ranges[date_ranges.date_range.apply(lambda x: d in x)]

    # return the exception if it exists
    if len(period[period.type == "exception"]) > 0:
        return period[period.type == "exception"].date_range.squeeze().date[0]
    elif len(period) > 0:
        return period.date_range.squeeze().date[0]
    else:
        raise Exception(f"No timetable data for {d.isoformat()}")


