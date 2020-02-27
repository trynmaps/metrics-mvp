from models import arrival_history
import argparse
from datetime import datetime, timedelta, time as dt_time
import pytz
import csv

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Compute and cache arrival history from Muni timepoint CSV"
    )
    parser.add_argument("file", nargs="+", help="CSV timepoint file(s) from muni")
    parser.add_argument("--s3", dest="s3", action="store_true", help="store in s3")
    parser.set_defaults(s3=False)

    args = parser.parse_args()
    agency_id = "muni"
    history_version = "t2"

    paths = args.file
    print(paths)

    tz = pytz.timezone("America/Los_Angeles")

    incr = timedelta(days=1)

    all_data = {}

    start_hour = 3

    for path in paths:
        with open(path, newline="") as file:
            reader = csv.reader(file, delimiter=",", quotechar='"')
            header = next(reader)
            vehicle_index = header.index("VEHICLE")
            route_index = header.index("ROUTE")
            arrival_time_index = header.index("NEXT_BUS_ARRIVAL_TIME")
            stop_index = header.index("STOP")
            direction_index = header.index("PATTERN_NAME")

            line_num = 1

            for line in reader:
                line_num += 1
                vid = line[vehicle_index]
                route = line[route_index]
                time_str = line[arrival_time_index]
                stop = line[stop_index]
                direction = line[direction_index].replace(" ", "_")

                if not time_str:
                    continue

                try:
                    dt = tz.localize(datetime.strptime(time_str, "%m/%d/%Y %I:%M:%S %p"))
                except Exception as ex:
                    print(f"{path}:{line_num}: {ex}")
                    continue

                if dt.hour < start_hour:
                    date = (dt - incr).date()
                else:
                    date = dt.date()

                if date not in all_data:
                    all_data[date] = {}

                routes_data = all_data[date]

                if route not in routes_data:
                    routes_data[route] = {}

                stops_data = routes_data[route]

                if stop not in stops_data:
                    stops_data[stop] = {"arrivals": {}}

                directions_data = stops_data[stop]["arrivals"]

                if direction not in directions_data:
                    directions_data[direction] = []

                arrivals = directions_data[direction]

                arrivals.append({"t": int(dt.timestamp()), "v": vid})

                if line_num % 1000 == 0:
                    print(f"{path}:{line_num}: {time_str}")

    def time_key(arrival):
        return arrival["t"]

    for d, routes_data in all_data.items():
        next_day = d + incr

        start_time = int(tz.localize(datetime.combine(d, dt_time(hour=start_hour))).timestamp())
        end_time = int(
            tz.localize(datetime.combine(next_day, dt_time(hour=start_hour))).timestamp()
        )

        for route, stops_data in routes_data.items():

            route_id = route.replace(" ", "_")

            for stop, stop_data in stops_data.items():
                for direction, arrivals in stop_data["arrivals"].items():
                    arrivals.sort(key=time_key)

            history = arrival_history.ArrivalHistory(
                agency_id,
                route_id,
                start_time=start_time,
                end_time=end_time,
                stops_data=stops_data,
                version=history_version,
            )
            arrival_history.save_for_date(history, d, args.s3)
