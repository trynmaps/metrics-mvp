import argparse
from datetime import datetime
from models import config, arrival_history, util, metrics, timetables
import time
import numpy as np
import pandas as pd

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Compute headways (in minutes) at stop s1 for a route, on one or more dates, optionally at particular times of day'
    )
    parser.add_argument('--agency', required=True, help='Agency id')
    parser.add_argument('--route', required=True, help='Route id')
    parser.add_argument('--stop', required=True, help='Stop id')
    parser.add_argument("--dir", help = "Direction ID")
    parser.add_argument('--version')
    parser.add_argument("--comparison", dest = "comparison", action = "store_true", help = "option to compare timetables to actual data - true or false")
    parser.add_argument('--date', help='Date (yyyy-mm-dd)')
    parser.add_argument('--start-date', help='Start date (yyyy-mm-dd)')
    parser.add_argument('--end-date', help='End date (yyyy-mm-dd), inclusive')

    parser.add_argument('--start-time', help='hh:mm of first local time to include each day')
    parser.add_argument('--end-time', help='hh:mm of first local time to exclude each day')

    parser.set_defaults(comparison = False)

    args = parser.parse_args()

    agency_id = args.agency

    agency = config.get_agency(agency_id)

    version = args.version
    if version is None:
        version = arrival_history.DefaultVersion

    route_id = args.route
    date_str = args.date
    stop_id = args.stop

    start_time_str = args.start_time
    end_time_str = args.end_time

    dir_infos = []
    route_configs = []

    direction_id = args.dir

    route_config = agency.get_route_config(route_id)

    stop_info = route_config.get_stop_info(stop_id)
    if stop_info is None:
        raise Exception(f"Stop ID {stop_id} is not valid for route {route_id}")

    route_dirs = route_config.get_directions_for_stop(stop_id)
    if len(route_dirs) == 0:
        raise Exception(f"Stop ID does not have any directions for route {route_id}")

    if direction_id is None:
        dir_infos.extend([route_config.get_direction_info(dir) for dir in route_dirs])
    else:
        dir_infos.append(route_config.get_direction_info(direction_id))

    date_strs = []
    tz = agency.tz

    if args.date:
        dates = util.get_dates_in_range(args.date, args.date)
    elif args.start_date is not None and args.end_date is not None:
        dates = util.get_dates_in_range(args.start_date, args.end_date)
    else:
        raise Exception('missing date, start-date, or end-date')

    print(f"Date: {', '.join([str(date) for date in dates])}")
    print(f"Time of Day: [{start_time_str}, {end_time_str})")
    print(f"Route: {route_id} ({route_config.title})")
    print(f"Stop: {stop_id} ({stop_info.title})")
    print(f"Direction: {', '.join([dir_info.id for dir_info in dir_infos])} " +
        f"({', '.join([dir_info.title for dir_info in dir_infos])})")

    headways_arr = []

    get_history_ms = 0
    get_data_frame_ms = 0
    compute_headway_ms = 0
    remove_null_ms = 0

    for d in dates:
        date_str = str(d)

        t1 = time.time()*1000

        history = arrival_history.get_by_date(agency.id, route_id, d, version)

        t2 = time.time()*1000

        df = history.get_data_frame(stop_id=stop_id, direction_id=direction_id,
            start_time=util.get_timestamp_or_none(d, start_time_str, tz),
            end_time=util.get_timestamp_or_none(d, end_time_str, tz)
        )

        t3 = time.time()*1000

        if args.comparison:
            timetable = timetables.get_by_date(agency_id, route_id, d)
            timetable_df = timetable.get_data_frame(stop_id=stop_id, direction_id=direction_id)

            comparison_df = timetables.match_actual_times_to_schedule(df['TIME'].values, timetable_df['TIME'].values)

            df = pd.concat([df, comparison_df], axis=1)

        get_history_ms += t2 - t1
        get_data_frame_ms += t3 - t2

        if df.empty:
            print(f"no arrival times found for stop {stop_id} on {date_str}")
            continue

        df = df.sort_values('TIME', axis=0)

        t4 = time.time()*1000

        df['headway_min'] = np.r_[np.nan, metrics.compute_headway_minutes(df['TIME'].values)]
        df['DATE_TIME'] = df.TIME.apply(lambda t: datetime.fromtimestamp(t, tz))

        t5 = time.time()*1000

        for row in df.itertuples():
            did = row.DID
            dir_info = [dir_info for dir_info in dir_infos if dir_info.id == did][0]
            dist_str = f'{row.DIST}'.rjust(3)
            dwell_time = util.render_dwell_time(row.DEPARTURE_TIME - row.TIME)
            headway_str = f'{round(row.headway_min, 1)}'.rjust(4)

            if args.comparison:
                closest_scheduled_time = datetime.fromtimestamp(row.closest_scheduled_time, tz).time() if not np.isnan(row.closest_scheduled_time) else None

                headway_diff = row.headway_min - row.closest_scheduled_headway if not np.isnan(row.closest_scheduled_headway) else None

                comparison_info = f'scheduled: {closest_scheduled_time} ({util.render_delta(row.closest_scheduled_delta/60)} min) @ {round(row.closest_scheduled_headway, 1)} min headway ({util.render_delta(headway_diff).rjust(5)} min)'
            else:
                comparison_info = ''

            print(f"{row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.TIME}) {dwell_time} vid:{row.VID}  dir:{did}  {dist_str}m  {headway_str} min   {comparison_info}")

        t6 = time.time()*1000

        day_headways = df.headway_min[df.headway_min.notnull()]

        t7 = time.time()*1000

        compute_headway_ms += t5 - t4
        remove_null_ms += t7 - t6

        headways_arr.append(day_headways)

    t8 = time.time()*1000

    headways = pd.concat(headways_arr) if headways_arr else None

    t9 = time.time()*1000

    print(f"** runtime **")
    print(f"get arrival history = {round(get_history_ms)} ms")
    print(f"get data frame      = {round(get_data_frame_ms)} ms")
    print(f"compute headway     = {round(compute_headway_ms)} ms")
    print(f"remove null         = {round(remove_null_ms)} ms")
    if headways is not None and len(headways) > 0:
        print(f'** headway stats **')
        print(f'count              = {len((headways))}')
        print(f'average headway    = {round(np.average(headways),1)} min')
        print(f'standard deviation = {round(np.std(headways),1)} min')
        print(f'shortest headway   = {round(np.min(headways),1)} min')
        print(f'10% headway        = {round(np.quantile(headways,0.1),1)} min')
        print(f'median headway     = {round(np.median(headways),1)} min')
        print(f'90% headway        = {round(np.quantile(headways,0.9),1)} min')
        print(f'longest headway    = {round(np.max(headways),1)} min')
