import json
from datetime import datetime, date
import argparse

import pandas as pd
import partridge as ptg

from models import metrics, timetable, arrival_history

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get the timetable for stops on a given route")
    parser.add_argument("--route", required = True, help = "Route id")
    parser.add_argument("--stops", required = True, help = "Comma-separated list of stops on the route (ex '3413,4416'")
    parser.add_argument("--direction", required = True, help = "'inbound' or 'outbound'")
    parser.add_argument("--date", required = True, help = "Date - YYYY-MM-DD")
    parser.add_argument("--comparison", help = "option to compare timetables to actual data - true or false")
    parser.add_argument("--threshold", help = "threshold for on-time adherence for comparison")

    args = parser.parse_args()
    route = args.route
    stops = [stop for stop in args.stops.split(",") if len(stop) > 0]
    direction = args.direction
    d = date.fromisoformat(args.date)

    if args.comparison is None or args.comparison.lower() == 'false':
        comparison = False
    elif args.comparison.lower() == 'true':
        comparison = True
    else:
        raise Exception("comparison must be true or false")

    threshold = 5 if args.threshold is None else int(args.threshold)

    inpath = "data"
    agency = "sf-muni"

    start_time = datetime.now()
    print(f"Start: {start_time}")

    tt = timetable.get_timetable_from_csv(inpath, agency, route, direction, d)

    for stop in stops:
        tt.pretty_print(stop, with_metrics = True)
        
        if comparison:
            # get dummy data for now
            ah = arrival_history.get_by_date(agency, route, date(2019, 2, 1), version = "v2")
            stops_df = metrics.compare_timetable_to_actual(tt, ah.get_data_frame(stop, direction_id = "12___I_F00"))
            
            print("-----------")
            print("Comparison of timetable schedule and actual arrival data:")
            print(f"Actual Arrival | Closest Scheduled | {'Delta'.ljust(9)} | First Scheduled After Arrival | {'Delta'.ljust(9)}")
            for row in stops_df.itertuples():
                actual_arrival = row[1].time().isoformat()
                closest_scheduled = row[2].time().isoformat()
                closest_delta = f"{round(row[3], 1)} min"
                first_after = row[4].time().isoformat()
                first_after_delta = f"{round(row[5], 1)} min"

                print(f"{actual_arrival.ljust(14)} | {closest_scheduled.ljust(17)} | {closest_delta.ljust(9)} | {first_after.ljust(29)} | {first_after_delta.ljust(9)}")

            print("-----------")
            print(stops_df.describe().applymap(lambda x: round(x, 2)))
            print("-----------")

            compared_metrics = metrics.compare_delta_metrics(stops_df["closest_delta"], threshold)

            for k, v in compared_metrics.items():
                print(f"{k}: {round(v, 1)}%")

            print(f"First arrival: {stops_df['actual_arrival_time'].min().time().isoformat()}")
            print(f"Last arrival: {stops_df['actual_arrival_time'].max().time().isoformat()}")

    end_time = datetime.now()
    print("-----------")
    print(f"Done: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")