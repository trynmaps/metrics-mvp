import json
from datetime import datetime, date
from pathlib import Path
from itertools import product

import pandas as pd
import numpy as np
import partridge as ptg
import boto3
import gzip

from . import nextbus, util, timetable

class NoRouteError(Exception):
    pass

class GtfsScraper:
    def __init__(self, inpath, agency, version):
        self.inpath = inpath
        self.agency = agency
        self.version = version
        self.feed = ptg.load_geo_feed(self.inpath, {})

    def get_gtfs_route_id(self, route):
        # convert nextbus naming convention for OWL routes to gtfs naming convention
        # example - T_OWL in nextbus is T-OWL in gtfs
        routes = self.feed.routes
        gtfs_route_id = routes[routes.route_short_name == route.replace('_', '-')].route_id.values

        if len(gtfs_route_id) > 0:
            return gtfs_route_id[0]
        else:
            raise NoRouteError(f"No gtfs route id found for route {route}.")

    def get_gtfs_route_ids(self):
        routes = self.feed.routes        
        nextbus_route_ids = [route.id for route in nextbus.get_route_list(self.agency)]
        # convert nextbus naming convention for OWL routes to gtfs naming convention
        # example - T_OWL in nextbus is T-OWL in gtfs
        gtfs_route_ids = [
            routes[routes.route_short_name == f"{route}"].route_id.values[0]
            for route in [route.replace("_", "-") for route in nextbus_route_ids]
            if len(routes[routes.route_short_name == f"{route}"].route_id.values) > 0
        ]

        return {
            nextbus_route_id:gtfs_route_id for nextbus_route_id, gtfs_route_id in zip(nextbus_route_ids, gtfs_route_ids)
        }

    def get_route_trips_by_date(self, route_id: str, d: date):
        calendar = self.feed.calendar
        calendar_dates = self.feed.calendar_dates

        date_ranges = calendar[["start_date", "end_date"]].apply(lambda x: pd.date_range(start = x.start_date, end = x.end_date), axis = "columns")
        # filter out service_ids in date ranges not containing the given day and with the wrong day of week
        day_of_week = d.strftime("%A").lower()
        service_ids = calendar[date_ranges.apply(lambda x: d in x) & (calendar[day_of_week] == 1)].service_id

        # filter out special dates with calendar_dates.txt
        if d in calendar_dates.date.values:
            changed_service_ids = calendar_dates[calendar_dates.date == d]
            added_services = changed_service_ids[changed_service_ids.exception_type == 1].service_id
            removed_services = changed_service_ids[changed_service_ids.exception_type == 2].service_id

            # add service_ids that have been added that day (exception_type == 1)
            service_ids = service_ids.append(added_services)
            # remove service_ids that have been removed that day (exception_type == 2)
            service_ids = service_ids[~(service_ids.isin(removed_services))]

        trips_df = self.feed.trips
        trips = trips_df[(trips_df.route_id == self.get_gtfs_route_id(route_id)) & 
                          (trips_df.service_id.apply(lambda x: x in service_ids.values))]
        return trips

    def get_stop_times(self, route_id, d, route_config, direction):
        # stop times past midnight happen on the next day
        def get_date(t: float):
            return d if t < 60 * 60 * 24 else d.replace(day = d.day + 1)

        # convert "inbound" or "outbound" to gtfs direction id
        gtfs_direction = get_gtfs_direction_id(direction)
            
        trips = self.get_route_trips_by_date(route_id, d)

        if len(trips) > 0:
            trips_on_route = trips.trip_id.values
        else:
            print(f"No trips for route {route_id} on {d.isoformat()} in direction {direction}")
            return pd.DataFrame()

        all_trips = self.feed.trips
        valid_trips = set(trips_on_route) & set(all_trips[all_trips.direction_id == gtfs_direction].trip_id.values)
        all_stop_times = self.feed.stop_times
        stop_times = all_stop_times[all_stop_times.trip_id.apply(lambda x: x in valid_trips)].copy(deep = True)

        if len(stop_times) > 0:
            # account for discrepancies in gtfs/nextbus naming
            stop_times["direction"] = direction 

            # get nextbus stop_ids
            stop_times["nextbus_id"] = stop_times["stop_id"].apply(lambda x: get_nextbus_stop_id(x, gtfs_direction, route_config))

            return stop_times[["trip_id", "arrival_time", "departure_time", "stop_id", "nextbus_id", "stop_sequence", "direction"]].sort_values("arrival_time")
        else:
            print(f"Stop times df for route {route_id} on {date} going {direction} is empty")
            return pd.DataFrame()

    def get_excluded_stops(self, route_id, stop_times_df, route_config, direction, d):
        stop_dirs = {
            stop.id:get_gtfs_direction_id(route_config.get_directions_for_stop(stop.id)[0]) 
                    if len(route_config.get_directions_for_stop(stop.id)) > 0
                    else "N/A" 
            for stop in route_config.get_stop_infos()
        }
        # make feed with the trips on one route in one direction
        gtfs_direction_id = get_gtfs_direction_id(direction)
        trips = self.get_route_trips_by_date(route_id, d)
        trips_on_route = trips[trips.direction_id == gtfs_direction_id].values

        # get stops in this direction listed in stop_times
        stops = stop_times_df[stop_times_df.trip_id.apply(lambda x: x in trips_on_route)].stop_id.values

        # gtfs - stops that appear on gtfs but not nextbus
        # nextbus - stops that appear on nextbus but not gtfs
        # no direction - stops with no direction ID on nextbus
        # matches - pairs of stop IDs that refer to the same stop (the first/last stop on a line in differnt directions)
        excluded_stops = {
            "gtfs":
            list(set(stops) - set([k for k, v in stop_dirs.items() if v == direction])),
            "nextbus":
            list(set([k for k, v in stop_dirs.items() if v == direction]) - set(stops)),
        }

        excluded_stops["no direction"] = [
            k for k, v in stop_dirs.items() if (v == "N/A") and (
                any([stop in k for stop in stops])
            )
        ]

        excluded_stops["matches"] = {
            pair[0]:pair[1] for pair in product(stops, excluded_stops["nextbus"]) if pair[0] in pair[1]
        }

        return excluded_stops

    def get_date_ranges(self):
        date_ranges = self.feed.calendar[["start_date", "end_date"]].drop_duplicates()
        # flag whether or not each date range is normally scheduled (vs a holiday/etc)
        date_ranges["type"] = "normal_schedule"
        exceptions = pd.DataFrame({
            "start_date": self.feed.calendar_dates.date.drop_duplicates(),
            "end_date": self.feed.calendar_dates.date.drop_duplicates(),
            "type": "exception"
        })

        return date_ranges.append(exceptions)

    def upload_to_s3(self, s3_path: str, df: pd.DataFrame):
        client = boto3.client('s3')
        s3_bucket = timetable.get_s3_bucket(self.agency)
        search = client.list_objects(Bucket = s3_bucket, Prefix = s3_path)

        s3 = boto3.resource('s3')
        object = s3.Object(s3_bucket, s3_path)
        object.put(
            Body = gzip.compress(bytes(df.to_csv(), 'utf-8')),
            ContentEncoding = 'gzip',
            ContentType = 'text/csv',
            ACL = 'public-read'
        )
        
        print(f"{datetime.now().time().isoformat()}: Uploaded {s3_path} to s3 bucket.")

    def save_date_ranges(self, outpath, s3 = False):
        df = self.get_date_ranges()
        filepath = f"{outpath}/date_ranges.csv"

        if s3:
            s3_path = f"date_ranges.csv"
            self.upload_to_s3(s3_path, df)
        
        if Path(filepath).is_file():
            print(f"{datetime.now().time().isoformat()}: Date ranges have already been cached locally.")
        else:
            df.to_csv(filepath)

    def save_all_stops(self, outpath: str, s3 = False):
        date_ranges = self.get_date_ranges()

        for row in date_ranges.itertuples():
            self.save_stops_by_date(outpath, row[1], row[2], s3)

    def save_stops_by_date(self, outpath: str, start_date: date, end_date: date, s3 = False):
        routes = self.get_gtfs_route_ids()

        for nextbus_route_id, gtfs_route_id in routes.items():
            try:
                date_range_string = f"{start_date.isoformat()}_to_{end_date.isoformat()}"
                subdirectory = f"{timetable.get_s3_bucket(self.agency)}/{date_range_string}"
                Path(f"{outpath}/{subdirectory}").mkdir(parents = True, exist_ok = True)

                filename = f"{self.agency}_route_{nextbus_route_id}_{date_range_string}_timetable_{self.version}.csv"
                filepath = f"{subdirectory}/{filename}"
                csv_path = f"{outpath}/{filepath}"
                local_file_exists = Path(csv_path).is_file()
                stops = []

                if local_file_exists:
                    print(f"{datetime.now().time().isoformat()}: The file {filepath} already exists, skipping.")
                else:
                    rc = nextbus.get_route_config(self.agency nextbus_route_id)
                    for direction in ["inbound", "outbound"]:
                        stops.append(self.get_stop_times(nextbus_route_id, start_date, rc, direction))
                    
                    df = pd.concat(stops)
                    df.to_csv(Path(csv_path))

                # upload file to s3 bucket
                if s3:
                    s3_path = f"{date_range_string}/{filename}"

                    if local_file_exists:
                        df = pd.read_csv(csv_path)
                    else:
                        df = pd.concat(stops)

                    self.upload_to_s3(s3_path, df)
            except NoRouteError as err:
                print(f"{datetime.now()}: {err}")
                continue

def get_gtfs_direction_id(direction: str):
    if "i" in direction.lower():
        return 1
    elif "o" in direction.lower():
        return 0
    else:
        raise Exception("Direction must be either 'inbound' or 'outbound'.")

def get_nextbus_stop_id(gtfs_stop_id: str, direction_id: int, routeconfig: nextbus.RouteConfig):
    nextbus_stop_ids = routeconfig.get_stop_ids()
    # gtfs stop ids are a subset of nextbus stop ids
    stop_directions = routeconfig.get_directions_for_stop(gtfs_stop_id)

    # gtfs labels stops at the beginning/end of route with the same stop id
    # nextbus appends a number to the front of the stop id in one direction (ex/3476 vs 33476)
    if len(stop_directions) > 0:
        if get_gtfs_direction_id(stop_directions[0]) == direction_id:
            return gtfs_stop_id
        else:
            opposite_dir_stop = [stop_id for stop_id in nextbus_stop_ids if gtfs_stop_id in stop_id]

            try:
                return opposite_dir_stop[0]
            except Exception as err:
                raise Exception(f"Could not find nextbus stop id for {gtfs_stop_id}: {err}")
    else:
        # if there's no direction on nextbus...
        # for now just return nan (so it'll be effectively ignored)
        # TODO: deal with stops w/o direction (on nextbus)
        return np.nan

    
