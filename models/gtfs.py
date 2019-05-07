import json
from datetime import datetime, date
from pathlib import Path
from itertools import product

import pandas as pd
import numpy as np
import partridge as ptg

from . import nextbus, util

class GtfsScraper:
    def __init__(self, inpath):
        self.inpath = inpath

    def get_gtfs_route_id(self, route):
        # convert nextbus naming convention for OWL routes to gtfs naming convention
        route_view = {
            "routes.txt": {"route_short_name": f"{route.replace('_', '-')}"}
        }
        gtfs_route_id = ptg.load_geo_feed(self.inpath, route_view).routes.route_id.values

        if len(gtfs_route_id) > 0:
            return gtfs_route_id[0]
        else:
            raise Exception(f"No gtfs route id found for route {route}.")

    def get_gtfs_route_ids(self):
        feed = ptg.load_geo_feed(self.inpath, {})
        routes = feed.routes        
        nextbus_route_ids = [route.id for route in nextbus.get_route_list("sf-muni")]
        # convert nextbus naming convention for OWL routes to gtfs naming convention
        gtfs_route_ids = [
            routes[routes.route_short_name == f"{route}"].route_id.values[0]
            for route in [route.replace("_", "-") for route in nextbus_route_ids]
            if len(routes[routes.route_short_name == f"{route}"].route_id.values) > 0
        ]

        return {
            nextbus_route_id:gtfs_route_id for nextbus_route_id, gtfs_route_id in zip(nextbus_route_ids, gtfs_route_ids)
        }

    def get_route_trips_by_date(self, route_id, d):
        feed = ptg.load_geo_feed(self.inpath, {})
        calendar = feed.calendar
        calendar_dates = feed.calendar_dates

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

        trip_view = {
            "trips.txt": {
                "route_id": self.get_gtfs_route_id(route_id),
                "service_id": list(service_ids)
            }
        }
        trips = ptg.load_geo_feed(self.inpath, trip_view).trips
        return trips

    def get_stop_times(self, route_id, d, route_config, direction):
        # get time string from the timestamps
        def get_time_isoformat(t: float):
            second = "{:02d}".format(int(t) % 60)
            minute = "{:02d}".format((int(t) // 60) % 60)
            hour = "{:02d}".format((int(t) // 3600) % 24)

            return f"{hour}:{minute}:{second}"

        # stop times past midnight happen on the next day
        def get_date(t: float):
            return d if t < 86400 else d.replace(day = d.day + 1)

        # convert "inbound" or "outbound" to gtfs direction id
        gtfs_direction = get_gtfs_direction_id(direction)
            
        trips = self.get_route_trips_by_date(route_id, d)

        if len(trips) > 0:
            trips_on_route = trips.trip_id.values
        else:
            print(f"No trips for route {route_id} on {d.isoformat()} in direction {direction}")
            return pd.DataFrame()

        stop_times_view = {
            "stop_times.txt": {"trip_id": list(trips_on_route)},
            "trips.txt": {"direction_id": gtfs_direction}
        }

        stop_times_feed = ptg.load_geo_feed(self.inpath, stop_times_view)
        stop_times = stop_times_feed.stop_times

        if len(stop_times) > 0:
            # account for discrepancies in gtfs/nextbus naming
            # excluded_stops = self.get_excluded_stops(route_id, stop_times, route_config, direction, d)

            # for gtfs_id, nextbus_id in excluded_stops["matches"].items():
            #     stop_times.loc[stop_times.stop_id == gtfs_id, ["stop_id"]] = nextbus_id

            # convert arrival and departure times
            stop_times[["arrival_time", "departure_time"]] = stop_times[["arrival_time", "departure_time"]].applymap(lambda x: util.get_localized_datetime(get_date(x), get_time_isoformat(x)))
            stop_times["direction"] = direction 

            # get nextbus stop_ids
            stop_times["nextbus_id"] = stop_times["stop_id"].apply(lambda x: get_nextbus_stop_id(x, gtfs_direction, route_config))

            return stop_times[["trip_id", "arrival_time", "departure_time", "stop_id", "nextbus_id", "stop_sequence", "direction"]].sort_values("arrival_time")
        else:
            print(f"Stop times df for route {route_id} on {date} going {direction} is empty")
            return pd.DataFrame()

    def get_excluded_stops(self, route_id, stop_times_df, route_config, direction, d):
        stop_dirs = {
            stop.id:(1 if "I" in route_config.get_directions_for_stop(stop.id)[0]
                    else 0) if len(route_config.get_directions_for_stop(stop.id)) > 0
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
        calendar_view = ptg.load_geo_feed(self.inpath, {})
        date_ranges = calendar_view.calendar[["start_date", "end_date"]].drop_duplicates()
        # flag whether or not each date range is normally scheduled (vs a holiday/etc)
        date_ranges["type"] = "normal_schedule"
        exceptions = pd.DataFrame({
            "start_date": calendar_view.calendar_dates.date.drop_duplicates(),
            "end_date": calendar_view.calendar_dates.date.drop_duplicates(),
            "type": "exception"
        })

        return date_ranges.append(exceptions)

    def save_date_ranges(self, outpath):
        self.get_date_ranges().to_csv(f"{outpath}/date_ranges.csv")

    def save_all_stops(self, outpath: str):
        date_ranges = self.get_date_ranges()
        # pull from each possible date range + nonstandard days in calendar_dates
        combined_date_range = date_ranges.start_date

        for d in combined_date_range:
            self.save_stops_by_date(outpath, d)

    def save_stops_by_date(self, outpath: str, d: date):
        routes = self.get_gtfs_route_ids()

        for nextbus_route_id, gtfs_route_id in routes.items():
            try:
                rc = nextbus.get_route_config("sf-muni", nextbus_route_id)
                csv_path = f"{outpath}/route_{nextbus_route_id}_{d.isoformat()}_timetable.csv"
                stops = []

                if Path(csv_path).is_file():
                    print(f"The file {csv_path} already exists, skipping: {datetime.now()}")
                else:
                    for direction in ["inbound", "outbound"]:
                        stops.append(self.get_stop_times(nextbus_route_id, d, rc, direction))
                        
                    pd.concat(stops).to_csv(csv_path)
                    print(f"Saved stop times for {nextbus_route_id} {direction}: {datetime.now()}")
                        
            except Exception as err:
                print(f"Error on route {nextbus_route_id} - {err}: {datetime.now()}")
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

    
