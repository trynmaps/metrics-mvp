import json
from datetime import datetime, date
import argparse

import pandas as pd
import numpy as np
import partridge as ptg

from models import metrics, timetable, arrival_history, nextbus, util, constants, errors

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get the timetable for stops on a given route")
    parser.add_argument("--route", required = True, help = "Route id")
    parser.add_argument("--stops", required = True, help = "Comma-separated list of stops on the route (ex '3413,4416'")
    parser.add_argument("--date", required = True, help = "Date - YYYY-MM-DD")
    parser.add_argument("--comparison", dest = "comparison", action = "store_true", help = "option to compare timetables to actual data - true or false")
    parser.add_argument("--thresholds", help = "comma-separated list of thresholds to define late/very late arrivals (ex '5,10')")
    # add version param for later
    parser.set_defaults(comparison = False)
    parser.set_defaults(thresholds = '5,10')

    args = parser.parse_args()
    route = args.route
    stops = [stop for stop in args.stops.split(",") if len(stop) > 0]
    d = date.fromisoformat(args.date)
    comparison = args.comparison
    ver = "v1"
    
    try:
        thresholds = [int(x) for x in args.thresholds.split(',') if len(x) > 0]

        if len(thresholds) != 2:
            raise errors.InvalidInputError
    except (TypeError, errors.InvalidInputError):
        print("Invalid thresholds, using the default of 5/10 minutes.")
        thresholds = [5, 10]

    agency = "sf-muni"
    
    start_time = datetime.now()
    print(f"Start: {start_time}")

    tt = timetable.get_timetable_from_csv(agency, route, d, ver)
    rc = nextbus.get_route_config(agency, route)

    for stop in stops:
        # get direction
        nextbus_dir = rc.get_directions_for_stop(stop)
        if len(nextbus_dir) == 0:
            print(f"Stop {stop} has no directions.")
        else:
            for direction in nextbus_dir:
                tt.pretty_print(stop, direction)
                
                if comparison:
                    route_metrics = metrics.RouteMetrics(agency, route)
                    df = route_metrics.get_comparison_to_timetable(d, stop, direction)

                    if len(df) > 0:
                        df = df.rename({
                            "arrival_time": "Scheduled Arrival",
                            "arrival_headway": "Scheduled Headway",
                            "next_arrival": "Next Arrival",
                            "next_arrival_delta": "Delta (Next Arrival)",
                            "next_arrival_headway": "Next Arrival Headway",
                            "closest_arrival": "Closest Arrival",
                            "closest_arrival_delta": "Delta (Closest Arrival)",
                            "closest_arrival_headway": "Closest Arrival Headway"
                        }, axis = "columns")
                    
                        times_df = df[["Scheduled Arrival", "Closest Arrival", "Delta (Closest Arrival)", "Next Arrival", "Delta (Next Arrival)"]].copy(deep = True)
                        times_df[["Scheduled Arrival", "Closest Arrival", "Next Arrival"]] = times_df[["Scheduled Arrival", "Closest Arrival", "Next Arrival"]].applymap(lambda x: datetime.fromtimestamp(x, constants.PACIFIC_TIMEZONE).time() if not pd.isna(x) else np.nan)
                        times_df[["Delta (Closest Arrival)", "Delta (Next Arrival)"]] = times_df[["Delta (Closest Arrival)", "Delta (Next Arrival)"]].applymap(lambda x: f"{round(x/60, 2)} min")

                        headways_df = df[["Scheduled Arrival", "Scheduled Headway", "Closest Arrival Headway", "Next Arrival Headway"]].copy(deep = True)
                        headways_df["Scheduled Arrival"] = headways_df["Scheduled Arrival"].apply(lambda x: datetime.fromtimestamp(x, constants.PACIFIC_TIMEZONE).time() if not pd.isna(x) else np.nan)
                        headways_df[["Scheduled Headway", "Closest Arrival Headway", "Next Arrival Headway"]] = headways_df[["Scheduled Headway", "Closest Arrival Headway", "Next Arrival Headway"]].applymap(lambda x: f"{round(x, 2) if not pd.isna(x) else np.nan} min")

                        with pd.option_context("display.max_rows", None, "display.max_columns", None, 'display.expand_frame_repr', False):
                            print("-----------")
                            print("Comparison of timetable schedule and actual arrival data:")
                            print(times_df.rename({
                                "Delta (Closest Arrival)": "Delta",
                                "Delta (Next Arrival)": "Delta"
                            }, axis = "columns"))

                            print("-----------")
                            print("Delta comparisons (in minutes)")
                            print(df[["Delta (Closest Arrival)", "Delta (Next Arrival)"]].describe().applymap(lambda x: round(x/60, 2)))
                            print("-----------")

                            closest_arrival_metrics = metrics.compare_delta_metrics(df["Delta (Closest Arrival)"]/60, thresholds)

                            print("Comparison between scheduled arrival times and closest arrival times:")
                            for k, v in closest_arrival_metrics.items():
                                print(f"{k}: {round(v, 1)}%")

                            print("-----------")

                            next_arrival_metrics = metrics.compare_delta_metrics(df["Delta (Next Arrival)"]/60, thresholds)

                            print("Comparison between scheduled arrival times and next arrival times:")
                            for k, v in next_arrival_metrics.items():
                                print(f"{k}: {round(v, 1)}%")

                            print("-----------")

                            print("Comparison between scheduled arrival headways and actual arrival headways:")

                            print(headways_df.rename({
                                "Delta (Closest Headway)": "Delta",
                                "Delta (First After Headway)": "Delta"
                            }, axis = "columns"))
                    else:
                        print(f"Comparison failed - no arrival data was found for {stop}.")

    end_time = datetime.now()
    print("-----------")
    print(f"Done: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")