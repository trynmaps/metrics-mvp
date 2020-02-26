from datetime import datetime, date
import argparse

import pandas as pd
import numpy as np

from models import metrics, timetables, arrival_history, util, config

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get the timetable for stops on a given route")
    parser.add_argument('--agency', required=True, help='Agency id')
    parser.add_argument("--route", required = True, help = "Route id")
    parser.add_argument("--stop", required = True, help = "Stop ID")
    parser.add_argument("--dir", help = "Direction ID")
    parser.add_argument("--date", required = True, help = "Date - YYYY-MM-DD")
    parser.add_argument("--comparison", dest = "comparison", action = "store_true", help = "option to compare timetables to actual data - true or false")
    parser.add_argument("--early-min", type=int, default=1, help = "number of minutes before schedule defined as early")
    parser.add_argument("--late-min", type=int, default=5, help = "number of minutes after schedule defined as late")
    parser.add_argument('--verbose', dest='verbose', action='store_true', help='verbose output')
    parser.set_defaults(verbose=False)
    parser.set_defaults(comparison = False)

    args = parser.parse_args()
    route_id = args.route
    stop_id = args.stop
    d = date.fromisoformat(args.date)
    comparison = args.comparison

    early_min = args.early_min
    late_min = args.late_min

    agency = config.get_agency(args.agency)

    agency_id = agency.id

    start_time = datetime.now()
    print(f"Start: {start_time}")

    timetable = timetables.get_by_date(agency_id, route_id, d)
    route_config = agency.get_route_config(route_id)

    tz = agency.tz

    direction_id = args.dir

    timetable_df = timetable.get_data_frame(stop_id=stop_id, direction_id=direction_id).sort_values('TIME')

    early_sec = early_min * 60
    late_sec = late_min * 60

    timetable_df['scheduled_headway'] = np.r_[np.nan, metrics.compute_headway_minutes(timetable_df['TIME'].values)]

    if comparison:
        history = arrival_history.get_by_date(agency_id, route_id, d)
        arrivals_df = history.get_data_frame(stop_id=stop_id, direction_id=direction_id)

        comparison_df = timetables.match_schedule_to_actual_times(timetable_df['TIME'].values, arrivals_df['TIME'].values, early_sec=early_sec, late_sec=late_sec)

        timetable_df = pd.concat([timetable_df, comparison_df], axis=1)

    timetable_df['DATE_TIME'] = timetable_df['TIME'].apply(lambda t: datetime.fromtimestamp(t, tz))

    for row in timetable_df.itertuples():
        did = row.DID
        dwell_time = util.render_dwell_time(row.DEPARTURE_TIME - row.TIME)

        scheduled_headway = f'{round(row.scheduled_headway, 1)}'.rjust(4)

        if args.comparison:
            matching_actual_time = datetime.fromtimestamp(row.matching_actual_time, tz).time() if not np.isnan(row.matching_actual_time) else None

            status_text = ''

            if args.verbose:
                prev_actual_time = datetime.fromtimestamp(row.prev_actual_time, tz).time() if not np.isnan(row.prev_actual_time) else None
                next_actual_time = datetime.fromtimestamp(row.next_actual_time, tz).time() if not np.isnan(row.next_actual_time) else None
                closest_actual_time = datetime.fromtimestamp(row.closest_actual_time, tz).time() if not np.isnan(row.closest_actual_time) else None

                arrival_info = f'p:{prev_actual_time} n:{next_actual_time} c:{closest_actual_time} m:{matching_actual_time}'
            else:
                arrival_info = f'actual: {matching_actual_time}'

            if not row.no_match:
                if row.on_time:
                    status_text = ''
                elif row.late:
                    status_text = 'late'
                elif row.early:
                    status_text = 'early'

                matching_actual_headway = f'{round(row.matching_actual_headway,1)}'.rjust(5)

                headway_delta = row.matching_actual_headway - row.scheduled_headway if row.scheduled_headway > 0 else None

                arrival_info += f'  {status_text.ljust(5)} {util.render_delta(row.matching_actual_delta/60)} min   {matching_actual_headway} min headway ({util.render_delta(headway_delta)} min)'
        else:
            arrival_info = ''

        print(f"{row.DATE_TIME.date()} {row.DATE_TIME.time()} ({row.TIME}) {dwell_time}  dir:{did}  {scheduled_headway} min headway   {arrival_info}")

    num_scheduled = len(timetable_df)
    print('-----')
    print(f'{num_scheduled} scheduled arrivals')

    if comparison:
        on_time_rate = np.average(timetable_df['on_time'])
        late_rate = np.average(timetable_df['late'])
        early_rate = np.average(timetable_df['early'])
        missing_rate = np.average(timetable_df['no_match'])

        print(f"On-time  : {round(on_time_rate * 100, 1)}% ({np.sum(timetable_df['on_time'])}/{num_scheduled})")
        print(f"Late     : {round(late_rate * 100, 1)}% ({np.sum(timetable_df['late'])}/{num_scheduled}) more than {late_min} min late")
        print(f"Early    : {round(early_rate * 100, 1)}% ({np.sum(timetable_df['early'])}/{num_scheduled}) more than {early_min} min early")
        print(f"Missing  : {round(missing_rate * 100, 1)}% ({np.sum(timetable_df['no_match'])}/{num_scheduled})")
