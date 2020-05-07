from models import gtfs, config, util
from compute_stats import compute_stats_for_dates
import argparse
from datetime import date, datetime, timedelta
import requests
from pathlib import Path
from secrets import transitfeeds_api_key # you may have to create this
import os

# Downloads and parses the GTFS specification
# and saves the configuration for all routes to S3.
# The S3 object contains data merged from GTFS and the Nextbus API (for agencies using Nextbus).
# The frontend can then request this S3 URL directly without hitting the Python backend.
#
# For each direction, the JSON object contains a coords array defining the shape of the route,
# where the values are objects containing lat/lon properties:
#
# "coords":[
#  {"lat":37.80707,"lon":-122.41727}
#  {"lat":37.80727,"lon":-122.41562},
#  {"lat":37.80748,"lon":-122.41398},
#  {"lat":37.80768,"lon":-122.41234},
#  ...
# ]
#
# For each direction, the JSON object also contains a stop_geometry object where the keys are stop IDs
# and the values are objects with a distance property (cumulative distance in meters to that stop along the GTFS # shape),
# and an after_index property (index into the coords array of the last coordinate before that stop).
#
# "stop_geometry":{
#    "5184":{"distance":8,"after_index":0},
#    "3092":{"distance":279,"after_index":1},
#    "3095":{"distance":573,"after_index":3},
#    "4502":{"distance":1045,"after_index":8},
#    ...
#}
#
#
# Currently the script just overwrites the one S3 path, but this process could be extended in the future to
# store different paths for different dates, to allow fetching historical data for route configurations.
# UPDATE: We are now saving some older routes in versioned directories in metrics-mvp/backend/data

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Save route configuration from GTFS and possibly Nextbus API')
    parser.add_argument('--agency', required=False, help='Agency ID')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--timetables', dest='timetables', action='store_true', help='also save timetables')
    parser.add_argument('--scheduled-stats', dest='scheduled_stats', action='store_true', help='also compute scheduled stats if the timetable has new dates (requires --timetables)')
    parser.add_argument('--date', required=False)	
    parser.set_defaults(s3=False)
    parser.set_defaults(timetables=False)
    parser.set_defaults(scheduled_stats=False)
    parser.set_defaults(gtfs_date=None)	

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    save_to_s3 = args.s3
    gtfs_date = args.date 

    errors = []
	
    for agency in agencies:
	
        if gtfs_date is None:
            # save the normal way, downloading the most recent GTFS file
            # should probably not be using both date_to_use and gtfs_date_to_use
            date_to_use=date.today()
            gtfs_date_to_use=date.today()
            gtfs_path = None
        else:
            # save with date suffix, using the GTFS file provided
            date_to_use=datetime.strptime(gtfs_date, "%Y-%m-%d").date()	
            gtfs_path = f'{util.get_data_dir()}/gtfs-{agency.id}-{gtfs_date}.zip'
 
            ''' 
            Find most recent zip file before gtfs_date.
            recentmost_date_qualified_zip_file is:
                "date qualified" and "recentmost"
            
            "date qualified" means the date of the file is no later than the date
            argument given.
            
            "recentmost" means it is the most recent file that qualifies.
            '''

            recentmost_date_qualified_zip_file = ""
            recentmost_date_qualified_date = gtfs_date
            smallest_timedelta_so_far = timedelta.max
            for candidate_zip_file in os.listdir(util.get_data_dir()):
                if f'gtfs-{agency.id}-' in candidate_zip_file and '.zip' in candidate_zip_file:
                    candidate_year = candidate_zip_file.split('-')[2]
                    candidate_month = candidate_zip_file.split('-')[3]
                    candidate_day = candidate_zip_file.split('-')[4]
                    candidate_day = candidate_day.split(".zip")[0]
                    candidate_date_string = candidate_year+"-"+candidate_month+"-"+candidate_day
                    candidate_date = datetime.strptime(candidate_date_string,"%Y-%m-%d").date()
                    if candidate_date - date_to_use <= smallest_timedelta_so_far and candidate_date <= date_to_use:
                        recentmost_date_qualified_date = candidate_date
                        recentmost_date_qualified_zip_file = candidate_zip_file

            gtfs_date_to_use = recentmost_date_qualified_date
            gtfs_path = recentmost_date_qualified_zip_file
            gtfs_path = f'{util.get_data_dir()}/{recentmost_date_qualified_zip_file}'

        # save the routes
        scraper = gtfs.GtfsScraper(agency, gtfs_path=gtfs_path)		
        scraper.save_routes(save_to_s3, date_to_use, version_date=gtfs_date_to_use)	
        errors += scraper.errors
			
			
        if args.timetables:
            timetables_updated = scraper.save_timetables(save_to_s3=save_to_s3, skip_existing=True)

            if timetables_updated and args.scheduled_stats:
                dates = sorted(scraper.get_services_by_date().keys())
                compute_stats_for_dates(dates, agency, scheduled=True, save_to_s3=save_to_s3)


    if errors:
        raise Exception("\n".join(errors))
