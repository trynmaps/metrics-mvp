# Import the packages needed

import numpy as np, pandas as pd
import urllib
import json
import os

# Load the data as a JSON dict using the API

with urllib.request.urlopen("http://api.511.org/transit/lines?api_key=f5c9c70c-3e13-4e76-8481-d3ecc866ef3f&operator_id=SF&format=json") as url:
    data = json.load(url)

IDs = []

i = 0

for item in data:
    ID = data[i]['Id']
    IDs.append(ID)
    
    i += 1


lines_to_scrape = IDs

i = 0

# Loop through each route in the API you want

for route in lines_to_scrape:

    with urllib.request.urlopen("http://api.511.org/transit/timetable?api_key=f5c9c70c-3e13-4e76-8481-d3ecc866ef3f&operator_id=SF&line_id="+lines_to_scrape[i]+"&format=json") as url:
        data = json.load(url)

    # Loops through each time table and for each trip id, prints the stop id and arrival time

    # First I will make a dataframe with all of the time tables and then think about splitting them by time table or just reassign the vars for that later

    lines, directions, timetables, trip_ids, stop_ids, arrival_times = [], [], [], [], [], []

    for timetable in data['Content']['TimetableFrame']:
        for servicejourney in timetable['vehicleJourneys']['ServiceJourney']:
            for call in servicejourney['calls']['Call']:

                # Grab the line
                line = timetable['Name'].split(':')
                lines.append(int(line[0]))
                
                # Inbound or outbound
                directions.append(line[1])
                
                # What time table it is
                timetables.append(line[2])
                
                # What the trip id is
                trip = servicejourney['id']
                trip_ids.append(trip)
                
                # What the stop id is
                stop = call['ScheduledStopPointRef']['ref']
                stop_ids.append(stop)
                
                # Grabs the arrival time
                arrival = call['Arrival']['Time']
                arrival_times.append(arrival)
    
    tidy_df = pd.DataFrame({'ROUTE':pd.Series(lines),
                       'direction':pd.Series(directions),
                       'timetable':pd.Series(timetables),
                       'trip_id':pd.Series(trip_ids),
                       'stop_id':pd.Series(stop_ids),
                       'TIME':pd.to_datetime(arrival_times)})

    filePath = os.path.join(r'','route_' + lines_to_scrape[i] + '_timetables_data' + '.csv')
    os.path.isfile(filePath)
    tidy_df.to_csv(filePath, index=False)

    print("Completed scraping route " + lines_to_scrape[i])

    i += 1 