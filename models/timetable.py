from datetime import date, datetime
import os 

import pandas as pd


# return the timetable from one stop on one route, for a given date
def get_timetable(route_id: str, stop_id: int, d: str):
    # TODO: make this work wherever this is being called from
    cwd = os.getcwd().split("\\")[-1]

    if cwd == "metrics-mvp":
      path = f"./data/timetables/route_{route_id}_timetables_data.csv"
    elif cwd == "models":
      path = f"./data/timetables/route_{route_id}_timetables_data.csv"
    
    df = pd.read_csv(path)
    df['TIME'] = df['TIME'].apply(lambda x: datetime.strptime(f"{x} -0800", "%Y-%m-%d %H:%M:%S %z"))
    day = date.fromisoformat(d).weekday()
    timetable_type = "Weekday" if day < 5 else ("Saturday" if day == 5 else "Sunday")
    
    return df[(df['stop_id'] == stop_id) & (df['timetable'] == timetable_type)]