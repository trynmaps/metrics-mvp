Routes 81X and K-OWL failed to be scraped in current factorization of the code.

Error and the code that produced it: 

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
            lines.append(line[0])

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

tidy_df.head()

---------------------------------------------------------------------------
TypeError                                 Traceback (most recent call last)
<ipython-input-43-49c76d7e28de> in <module>
      9 
     10 for timetable in data['Content']['TimetableFrame']:
---> 11     for servicejourney in timetable['vehicleJourneys']['ServiceJourney']:
     12         for call in servicejourney['calls']['Call']:
     13 

TypeError: string indices must be integers