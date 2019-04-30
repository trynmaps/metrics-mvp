import os
import sys
import argparse
from datetime import datetime, date, time

import pandas as pd

from models import gtfs

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description = "Get timetables from GTFS data")
    parser.add_argument("--inpath", required = True, help = "Path to directory containing GTFS data")
    parser.add_argument("--outpath", help = "Destination directory for timetable CSVs")
    
    args = parser.parse_args()
    inpath = args.inpath
    outpath = "data" if args.outpath is None else args.outpath

    gtfs_scraper = gtfs.GtfsScraper(inpath)

    start_time = datetime.now()
    print(f"Begin scraping GTFS data: {start_time}")

    gtfs_scraper.save_all_stops(outpath)
    gtfs_scraper.save_date_ranges(outpath)

    end_time = datetime.now()
    print(f"Finished scraping GTFS data: {end_time}")
    print(f"Elapsed time: {end_time - start_time}")