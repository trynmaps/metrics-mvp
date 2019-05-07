import json
from datetime import datetime, date
import argparse

import pandas as pd
import partridge as ptg

from models import metrics, timetable, arrival_history, nextbus

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get the timetable for stops on a given route")
    parser.add_argument("--route", required = True, help = "Route id")
    parser.add_argument("--stops", required = True, help = "Comma-separated list of stops on the route (ex '3413,4416'")
    parser.add_argument("--date", required = True, help = "Date - YYYY-MM-DD")
    parser.add_argument("--comparison", help = "option to compare timetables to actual data - true or false")
    parser.add_argument("--threshold", help = "threshold, in minutes for on-time adherence for comparison")

    args = parser.parse_args()
    route = args.route
    stops = [stop for stop in args.stops.split(",") if len(stop) > 0]
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

    tt = timetable.get_timetable_from_csv(inpath, agency, route, d)
    rc = nextbus.get_route_config(agency, route)

    for stop in stops:
        # get direction
        nextbus_dir = rc.get_directions_for_stop(stop)
        if len(nextbus_dir) == 0:
            raise Exception(f"Stop {stop} has no directions.")
        else:
            for direction in nextbus_dir:
                tt.pretty_print(stop, direction)
                
                if comparison:
                    # get dummy data for now
                    ah = arrival_history.get_by_date(agency, route, date(2019, 4, 8), version = "v3")

                    df = ah.get_data_frame(stop_id = stop, direction_id = direction)

                    if len(df) > 0:
                        stops_df = metrics.compare_timetable_to_actual(tt, df, direction)

                        if len(stops_df) > 0:
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
                            print(stops_df[["closest_delta", "first_after_delta"]].describe().applymap(lambda x: round(x, 2)).rename({
                                "closest_delta" : "Delta (Closest Scheduled)", 
                                "first_after_delta" : "Delta (First Scheduled After)"
                                }, axis = "columns"))
                            print("-----------")

                            compared_metrics = metrics.compare_delta_metrics(stops_df["closest_delta"], threshold)

                            print("Comparison between arrival time and closest scheduled time:")
                            for k, v in compared_metrics.items():
                                print(f"{k}: {round(v, 1)}%")

                            print(f"First arrival: {stops_df['actual_arrival_time'].min().time().isoformat()}")
                            print(f"Last arrival: {stops_df['actual_arrival_time'].max().time().isoformat()}")
                            print("-----------")

                            print("Comparison between arrival headways and closest scheduled time headways:")
                            print(f"Actual Arrival | Actual Headway | Closest Scheduled Headway | {'Delta'.ljust(9)} | First After Arrival Headway | {'Delta'.ljust(9)}")
                            for row in stops_df.itertuples():
                                actual_arrival = row[1].time().isoformat()
                                actual_headway = f"{round(row[6], 1)} min"
                                closest_scheduled_headway = f"{round(row[7], 1)} min"
                                closest_headway_delta = f"{round(row[8], 1)} min"
                                first_after_headway = f"{round(row[9], 1)} min"
                                first_after_headway_delta = f"{round(row[10], 1)} min"

                                print(f"{actual_arrival.ljust(14)} | {actual_headway.ljust(14)} | {closest_scheduled_headway.ljust(25)} | {closest_headway_delta.ljust(9)} | {first_after_headway.ljust(28)} | {first_after_headway_delta.ljust(9)}")
                            print("-----------")

                            compared_headway_metrics = metrics.compare_delta_metrics(stops_df["closest_headway_delta"], threshold)

                            print(stops_df[["headway", "closest_headway_delta", "first_headway_delta"]].describe().applymap(lambda x: round(x, 2)).rename({
                                "headway" : "Actual Headway",
                                "closest_headway_delta" : "Headway Delta (Closest Scheduled)", 
                                "first_headway_delta" : "Headway Delta (First Scheduled After)"
                                }, axis = "columns"))
                            print("-----------")

                            for k, v in compared_headway_metrics.items():
                                print(f"{k}: {round(v, 1)}%")
                    else:
                        print(f"Comparison failed - no arrival data was found for {stop}.")

    end_time = datetime.now()
    print("-----------")
    print(f"Done: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")