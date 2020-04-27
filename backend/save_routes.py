from models import gtfs, config, util
from compute_stats import compute_stats_for_dates
import argparse
from datetime import date, datetime, timedelta
import requests
from pathlib import Path
from secrets import transitfeeds_api_key # you may have to create this

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
    parser.add_argument('--gtfs_date', required=False)	
    parser.set_defaults(s3=False)
    parser.set_defaults(timetables=False)
    parser.set_defaults(scheduled_stats=False)
    parser.set_defaults(gtfs_date=None)	

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    save_to_s3 = args.s3
    gtfs_date = args.gtfs_date 

    errors = []
	
	# should probably change things so we supply gtfs_path 
	# instead of gtfs_date
	
    for agency in agencies:
	
        if gtfs_date is None:
            # save the normal way, downloading the most recent GTFS file
            date_to_use=date.today()
        else:
            # save with date suffix, using the GTFS file provided
            save_to_s3=False
            date_to_use=datetime.strptime(gtfs_date, "%Y-%m-%d").date()	
            
            gtfs_path = f'{util.get_data_dir()}/gtfs-{agency.id}-{gtfs_date}.zip'
            # check if this zip file exists
            loops = 0
            max_loops = 365
            gtfs_date_to_use = gtfs_date
            while Path(gtfs_path).is_file() == False and loops < max_loops:
                # go back one day and re-represent date as a string
                gtfs_date_to_use = (datetime.strptime(gtfs_date_to_use, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d') 		
                gtfs_path = f'{util.get_data_dir()}/gtfs-{agency.id}-{gtfs_date_to_use}.zip'
                gtfs_cache_dir_to_use = f'{util.get_data_dir()}/gtfs-{agency.id}-{gtfs_date_to_use}.zip'
                loops += 1

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
