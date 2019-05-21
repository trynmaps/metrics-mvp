import os
import sys
import argparse
from datetime import datetime, date, time

import pandas as pd

from models import gtfs, util

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get timetables from GTFS data")
    parser.add_argument("--inpath", required = True, help = "Path to directory containing GTFS data")
    parser.add_argument("--outpath", help = "Destination directory for timetable CSVs")
    parser.add_argument("--s3", help = "Option to upload files to the s3 bucket. true/false")
    
    args = parser.parse_args()
    inpath = args.inpath
    outpath = util.get_data_dir() if args.outpath is None else args.outpath
    s3 = args.s3

    if s3 and s3.lower() == "true":
        s3 = True
    else:
        s3 = False

    gtfs_scraper = gtfs.GtfsScraper(inpath)

    start_time = datetime.now()
    print(f"Begin scraping GTFS data: {start_time}")

    gtfs_scraper.save_all_stops(outpath, s3)
    gtfs_scraper.save_date_ranges(outpath, s3)

    end_time = datetime.now()
    print(f"Finished scraping GTFS data: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")