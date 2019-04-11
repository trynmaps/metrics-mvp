from datetime import date, datetime, timedelta
import os 

import pandas as pd

from . import util


# return the timetable from one stop on one route, for a given date
def get_timetable(route_id: str, stop_id: str, d: str):
    source_dir = util.get_data_dir()
    path = f'{source_dir}/data/timetables/route_{route_id}_timetables_data.csv'
    
    df = pd.read_csv(path)
    # change timetable to the day being compared to
    day = date.fromisoformat(d)
    df['DATE_TIME'] = df['TIME'].apply(lambda x: util.get_localized_datetime(f'{day} {x.split(" ")[-1]}'))
    day_of_week = day.weekday()
    timetable_type = "Weekday" if day_of_week < 5 else ("Saturday" if day_of_week == 5 else "Sunday")
    # TODO: time processing (find start/end of the day)
    timetable = df[(df['stop_id'] == int(stop_id)) & (df['timetable'] == timetable_type)].copy(deep = True)
    timetable.index = range(len(timetable))

    # change all dates past the latest arrival of the day to the next day (times past midnight)
    latest_arrival = timetable["DATE_TIME"].idxmax()
    timetable.loc[timetable.index > latest_arrival, ["DATE_TIME"]] += timedelta(days = 1)

    return timetable