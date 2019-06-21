import os
import sys
import argparse
from datetime import datetime, date, time

import pandas as pd

from models import gtfs, util

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get timetables from GTFS data")
    parser.add_argument("--inpath", required = True, help = "Path to directory containing GTFS data")
    parser.add_argument("--s3", dest = "s3", action = "store_true", help = "Option to upload files to the s3 bucket")
    parser.add_argument("--agency", help = "Agency name - default is 'sf-muni'")
    parser.add_argument("--version", help = "Version number for timetable")
    parser.set_defaults(s3 = False)
    parser.set_defaults(agency = "sf-muni")
    parser.set_defaults(version = "v1")
    
    args = parser.parse_args()
    inpath = args.inpath
    outpath = util.get_data_dir()
    s3 = args.s3
    agency = args.agency
    version = args.version

    gtfs_scraper = gtfs.GtfsScraper(inpath, agency, version)

    start_time = datetime.now()
    print(f"Begin scraping GTFS data: {start_time}")

    gtfs_scraper.save_all_stops(s3)
    gtfs_scraper.save_date_ranges(s3)

    end_time = datetime.now()
    print(f"Finished scraping GTFS data: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")