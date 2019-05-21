import json
from datetime import datetime, date
import argparse

import pandas as pd
import numpy as np
import partridge as ptg

from models import metrics, timetable, arrival_history, nextbus, util

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get the timetable for stops on a given route")
    parser.add_argument("--route", required = True, help = "Route id")
    parser.add_argument("--stops", required = True, help = "Comma-separated list of stops on the route (ex '3413,4416'")
    parser.add_argument("--date", required = True, help = "Date - YYYY-MM-DD")
    parser.add_argument("--comparison", help = "option to compare timetables to actual data - true or false")
    parser.add_argument("--thresholds", help = "comma-separated list of thresholds to define late/very late arrivals (ex '5,10')")

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

    thresholds = [5, 10] if args.thresholds is None else [int(x) for x in args.thresholds.split(',') if len(x) > 0]

    inpath = util.get_data_dir()
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
                    ah = arrival_history.get_by_date(agency, route, date(2019, 4, 8))
                    df = ah.get_data_frame(stop_id = stop, direction_id = direction)

                    if len(df) > 0:
                        stops_df = metrics.compare_timetable_to_actual(tt, df, direction)

                        if len(stops_df) > 0:
                            stops_df = stops_df.rename({
                                "actual_arrival_time": "Actual Arrival",
                                "closest_scheduled_arrival": "Closest Scheduled",
                                "closest_delta": "Delta (Closest Scheduled)",
                                "first_scheduled_after_arrival": "First Scheduled After Arrival",
                                "first_after_delta": "Delta (First Scheduled After)",
                                "headway": "Actual Headway",
                                "closest_scheduled_headway": "Closest Scheduled Headway",
                                "closest_headway_delta": "Delta (Closest Headway)",
                                "closest_first_after_headway": "First After Arrival Headway",
                                "first_headway_delta": "Delta (First After Headway)"
                            }, axis = "columns")
                            
                            times_df = stops_df[["Actual Arrival", "Closest Scheduled", "Delta (Closest Scheduled)", "First Scheduled After Arrival", "Delta (First Scheduled After)"]].copy(deep = True)
                            times_df[["Actual Arrival", "Closest Scheduled", "First Scheduled After Arrival"]] = times_df[["Actual Arrival", "Closest Scheduled", "First Scheduled After Arrival"]].applymap(lambda x: x.time() if not pd.isna(x) else np.nan)
                            times_df[["Delta (Closest Scheduled)", "Delta (First Scheduled After)"]] = times_df[["Delta (Closest Scheduled)", "Delta (First Scheduled After)"]].applymap(lambda x: f"{round(x, 1)} min")

                            headways_df = stops_df[["Actual Arrival", "Actual Headway", "Closest Scheduled Headway", "Delta (Closest Headway)", "First After Arrival Headway", "Delta (First After Headway)"]].copy(deep = True)
                            headways_df["Actual Arrival"] = headways_df["Actual Arrival"].apply(lambda x: x.time() if not pd.isna(x) else np.nan)
                            headways_df[["Actual Headway", "Closest Scheduled Headway", "Delta (Closest Headway)", "First After Arrival Headway", "Delta (First After Headway)"]] = headways_df[["Actual Headway", "Closest Scheduled Headway", "Delta (Closest Headway)", "First After Arrival Headway", "Delta (First After Headway)"]].applymap(lambda x: f"{round(x, 2) if not pd.isna(x) else np.nan} min")

                            with pd.option_context("display.max_rows", None, "display.max_columns", None, 'display.expand_frame_repr', False):
                                print("-----------")
                                print("Comparison of timetable schedule and actual arrival data:")
                                print(times_df.rename({
                                    "Delta (Closest Scheduled)": "Delta",
                                    "Delta (First Scheduled After)": "Delta"
                                }, axis = "columns"))

                                print("-----------")
                                print(stops_df[["Delta (Closest Scheduled)", "Delta (First Scheduled After)"]].describe().applymap(lambda x: round(x, 2)))
                                print("-----------")

                                compared_metrics = metrics.compare_delta_metrics(stops_df["Delta (Closest Scheduled)"], thresholds)

                                print("Comparison between arrival time and closest scheduled time:")
                                for k, v in compared_metrics.items():
                                    print(f"{k}: {round(v, 1)}%")

                                print(f"First arrival: {stops_df['Actual Arrival'].min().time().isoformat()}")
                                print(f"Last arrival: {stops_df['Actual Arrival'].max().time().isoformat()}")
                                print("-----------")

                                print("Comparison between arrival headways and closest scheduled time headways:")

                                print(headways_df.rename({
                                    "Delta (Closest Headway)": "Delta",
                                    "Delta (First After Headway)": "Delta"
                                }, axis = "columns"))
                                print("-----------")

                                compared_headway_metrics = metrics.compare_delta_metrics(stops_df["Delta (Closest Headway)"], thresholds)

                                print(stops_df[["Actual Headway", "Delta (Closest Headway)", "Delta (First After Headway)"]].describe().applymap(lambda x: round(x, 2)))
                                print("-----------")

                                for k, v in compared_headway_metrics.items():
                                    print(f"{k}: {round(v, 1)}%")
                    else:
                        print(f"Comparison failed - no arrival data was found for {stop}.")

    end_time = datetime.now()
    print("-----------")
    print(f"Done: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")