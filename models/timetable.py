from datetime import date, datetime
import os 

import pandas as pd

from . import util


# return the timetable from one stop on one route, for a given date
def get_timetable(route_id: str, stop_id: str, d: str):
    source_dir = util.get_data_dir()
    path = f'{source_dir}/data/timetables/route_{route_id}_timetables_data.csv'
    
    df = pd.read_csv(path)
    df['DATE_TIME'] = df['TIME'].apply(lambda x: util.get_localized_datetime(x))
    day = date.fromisoformat(d).weekday()
    timetable_type = "Weekday" if day < 5 else ("Saturday" if day == 5 else "Sunday")
    # TODO: time processing (find start/end of the day)
    
    return df[(df['stop_id'] == int(stop_id)) & (df['timetable'] == timetable_type)]