from models import gtfs, config
from compute_stats import compute_stats_for_dates
import argparse
from datetime import date

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
#

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Save route configuration from GTFS and possibly Nextbus API')
    parser.add_argument('--agency', required=False, help='Agency ID')
    parser.add_argument('--s3', dest='s3', action='store_true', help='store in s3')
    parser.add_argument('--timetables', dest='timetables', action='store_true', help='also save timetables')
    parser.add_argument('--scheduled-stats', dest='scheduled_stats', action='store_true', help='also compute scheduled stats if the timetable has new dates (requires --timetables)')
    parser.add_argument('--routes', dest='routes', required=False, help='Comma-separated string of routes to include, otherwise include all')
    parser.set_defaults(s3=False)
    parser.set_defaults(timetables=False)
    parser.set_defaults(scheduled_stats=False)
    parser.set_defaults(routes=None)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    save_to_s3 = args.s3
    routes = args.routes

    d = date.today()


    errors = []

    for agency in agencies:
        scraper = gtfs.GtfsScraper(agency)
        include_route_ids = []
        if routes is not None:
            include_route_ids = routes.split(',')
        scraper.save_routes(save_to_s3, d, include_route_ids)

        if args.timetables:
            timetables_updated = scraper.save_timetables(save_to_s3=save_to_s3, skip_existing=True)

            if timetables_updated and args.scheduled_stats:
                dates = sorted(scraper.get_services_by_date().keys())
                compute_stats_for_dates(dates, agency, scheduled=True, save_to_s3=save_to_s3)

        errors += scraper.errors

    if errors:
        raise Exception("\n".join(errors))
