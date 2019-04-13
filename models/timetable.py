from datetime import date, datetime, timedelta
import os

import pandas as pd
from datetime import time
import pytz

from . import util


# return the timetable from one stop on one route, for a given date
def get_timetable(route_id: str, stop_id: str, d: date):
    source_dir = util.get_data_dir()
    path = f'{source_dir}/../timetables/route_{route_id}_timetables_data.csv'
    tz = pytz.timezone('US/Pacific')

    # change timetable to the day being compared to
    day_of_week = d.weekday()
    timetable_type = "Weekday" if day_of_week < 5 else ("Saturday" if day_of_week == 5 else "Sunday")

    df = pd.read_csv(path)
    df['DATE_TIME'] = df['TIME'].apply(lambda x: util.get_localized_datetime(d, x.split(" ")[-1]))

    # TODO: time processing (find start/end of the day)
    timetable = df[(df['stop_id'] == int(stop_id)) & (df['timetable'] == timetable_type)].copy(deep = True)

    # mock data for stops that don't have a timetable yet
    timetable.index = range(len(timetable))
    if len(timetable) == 0:
      timetable = pd.DataFrame({
        "DATE_TIME" : [util.get_localized_datetime(d, t) for t in ["00:00", "23:59"]],
        "stop_id" : stop_id,
        "timetable" : timetable_type
        })

    # change all dates past the latest arrival of the day to the next day (times past midnight)
    latest_arrival = timetable["DATE_TIME"].idxmax()
    timetable.loc[timetable.index > latest_arrival, ["DATE_TIME"]] += timedelta(days = 1)

    return timetable