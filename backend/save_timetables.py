from models import gtfs, config
import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Save timetables from GTFS")
    parser.add_argument("--agency", required=False, help="Agency ID")
    parser.add_argument("--s3", dest="s3", action="store_true", help="store in s3")
    parser.add_argument(
        "--skip-existing",
        dest="skip_existing",
        action="store_true",
        help="skip updating timetable if there are no new dates",
    )
    parser.set_defaults(s3=False)
    parser.set_defaults(skip_existing=False)

    args = parser.parse_args()

    agencies = [config.get_agency(args.agency)] if args.agency is not None else config.agencies

    save_to_s3 = args.s3
    skip_existing = args.skip_existing

    for agency in agencies:
        scraper = gtfs.GtfsScraper(agency)
        scraper.save_timetables(save_to_s3=save_to_s3, skip_existing=skip_existing)
