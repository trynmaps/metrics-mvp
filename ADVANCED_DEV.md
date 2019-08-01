# Advanced Development Notes

## Computing Arrival Times
The API and command-line scripts generate statistics based on vehicle arrival times that are precomputed from the raw GPS data.
The pre-computed arrival times are stored in S3 at http://opentransit-stop-arrivals.s3.amazonaws.com/?prefix=v4 with a separate JSON file
for each route for each day.

The first time that arrival times are requested for a particular route/day,
the backend will download the JSON file from S3 and cache it in the data/ directory.

If the arrival times for a particular route/day haven't been computed yet, you'll get an error when computing statistics.

To get arrival times for one or more routes/days that haven't been precomputed yet, run `compute_arrivals.py`
to generate the JSON files locally (if using Docker, run this command from a shell within the metrics-flask-dev Docker container), e.g:
```
python compute_arrivals.py --date=2019-06-06 --route 1 2 47 38 38X
```

The JSON files with computed arrivals will be stored in your local `data/` directory.

Saving computed arrivals to S3 allows other people to access the arrival times without needing to compute them again.
Adding the `--s3` flag to `compute_arrivals.py` will save the arrival times to S3. To use the `--s3` flag,
you'll need to get permission to write to the opentransit-stop-arrivals bucket and save AWS credentials in `.aws/credentials`.

compute_arrivals.py will cache the raw state (GPS observations) in the local `data/` directory, so that if you run
compute_arrivals.py again with the same date and routes, it will be much faster.

## Command line scripts

Note: if using Docker, run these command line scripts from a shell within the metrics-flask-dev
Docker container via `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows), not directly on your host machine.

Show overall statistics for a particular route:
```
python route.py --date=2019-06-06 --route=1
```

Show headways between buses at a particular stop:
```
python headways.py --date=2019-06-06 --route=1 --stop=6290
```

Show trips between two stops:
```
python trips.py --date=2019-06-06 --route=1 --s1=6314 --s2=6304
```

Show stops visited by a particular vehicle:
```
python vehicle.py --date=2019-06-06 --route=1 --vid=5760
```

Show summary statistics of waiting times at a particular stop:
```
python waits.py --date=2019-06-06 --route=12 --stop=3476
```

Compute wait time statistics for all stops on a particular day:
```
python compute_wait_times.py --date=2019-06-06
```

Compute trip time statistics for all pairs of stops on a particular day:
```
python compute_trip_times.py --date=2019-06-06
```

Show scheduled timetable for a particular stop:
```
python timetables.py --route=12 --stops=3476 --date=2019-04-12
```

Compare scheduled timetable to collected arrival data, with 3/5 minutes as the on-time/late thresholds(thresholds optional, the default value are 5/10 minutes)
```
python timetables.py --route=12 --stops=3476 --date=2019-06-06 --comparison --threshold=3,5
```

You can add the argument `--version=t2` to headways.py, trips.py, or vehicle.py to use the timepoint data from Muni
(available for 2018-09-01 to 2018-11-30), instead of the arrival times computed from GPS coordinates from Nextbus.
Muni's timepoint data only contains a small subset of stops for each route, so the arrival history does not include all stops.

Parse [CSV timepoint files from Muni](https://muni-timepoint-avl-data.s3.amazonaws.com/muni_timepoint_data_fall_2018.zip)
 and save arrival history with version `t2` in data/ directory:
```
python parse_timepoint_csv.py path/to/next_bus_avl_20180901_20181001.csv path/to/next_bus_avl_20181001_20181101.csv path/to/next_bus_avl_20181101_20181201.csv
```

Compare timepoints from Muni with arrival times computed from Nextbus GPS coordinates,
and show discrepancies between the two data sets based on differences between arrival times of each bus at each stop:
```
python compare_versions.py --date=2018-11-14 --route=1 t2 v2
```

Scrape timetables from GTFS data stored locally in `inpath` and extract them to the `data` directory:
```
python gtfs_scraper.py --inpath=path/to/google_transit
```


## AWS Credentials

If you need to write files to S3 from your development environment (e.g. running compute_arrivals.py with the --s3 flag),
you will need to get AWS credentials from one of the project admins.

The scripts load AWS credentials from the standard locations, such as ~/.aws/credentials, using the "default" profile by default.

The ~/.aws/credentials file should look something like this:

```
[default]
aws_access_key_id = ....
aws_secret_access_key = ....
```

However, if you are using Docker, the command line scripts will load the ~/.aws/credentials file from within the flask-dev Docker container.

To make it easy to access AWS credentials in your Docker container, you can create a .aws directory
somewhere on your host machine (e.g. in your host home directory) and share it with your Docker container
by creating a docker-compose.override.yml file like this:

```
version: "3.7"
services:
  flask-dev:
    volumes:
      - /host/path/to/.aws:/root/.aws
```

For more information on AWS credentials see https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html
