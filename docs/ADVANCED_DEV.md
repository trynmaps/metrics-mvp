# Advanced Development Notes

## Running backend command line scripts

There are several useful command line scripts within the backend/ directory, such as save_routes.py, compute_arrivals.py, etc.

When developing with Docker, first get a shell within the metrics-flask-dev
Docker container by running `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows) from the root directory of this repository.

Then, you can run the backend command line scripts from this shell within the Docker container (not directly on your host machine).

## Data storage

The backend stores data such as route configuration, computed arrival times, and wait time/trip time stats in a bucket in Amazon S3. By default, this data is stored in the `opentransit-data` bucket.
(This is different from the `orion-vehicles` S3 bucket used by orion and tryn-api for the raw vehicle location data.)

Most developers do not have access to write new data to the `opentransit-data` bucket. Writing data to S3 is generally not necessary for developers working on frontend React code.
If you are modifying backend code that stores data in S3, or if you would like to set up an independent instance of OpenTransit with your own data,
you can create an S3 bucket in your own AWS account.

The S3 bucket can be configured by setting the environment variable OPENTRANSIT_S3_BUCKET, for example by creating a docker-compose.override.yml file like so:

```
version: "3.7"
services:
  flask-dev:
    environment:
      OPENTRANSIT_S3_BUCKET: my-opentransit-data
```

If you create your own S3 bucket, it should have the following CORS configuration to allow the frontend JavaScript code to request files directly from S3:

```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
</CORSRule>
</CORSConfiguration>
```

The CORS configuration can be copied and pasted in the Amazon S3 web console under Permissions > CORS Configuration. It may take up to an hour for the CORS configuration to be effective.

## Configuring AWS Credentials

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

For more information on AWS credentials, see https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html

## Computing Arrival Times

The API and command-line scripts generate statistics based on vehicle arrival times that are precomputed from the raw GPS data.
The pre-computed arrival times are stored in S3 with a separate JSON file for each route for each day.

The first time that arrival times are requested for a particular route/day,
the backend will download the JSON file from S3 and cache it in the data/ directory.

If the arrival times for a particular route/day haven't been computed yet, you'll get an error when computing statistics.

To get arrival times for one or more routes/days that haven't been precomputed yet, run `compute_arrivals.py`
to generate the JSON files locally (if using Docker, run this command from a shell within the metrics-flask-dev Docker container), e.g:

```
python compute_arrivals.py --date=2019-11-19 --agency=muni --route 1 2 47 38 38X
```

The JSON files with computed arrivals will be stored in your local `data/` directory.

Saving computed arrivals to S3 allows other people to access the arrival times without needing to compute them again.
Adding the `--s3` flag to `compute_arrivals.py` will save the arrival times to S3. To use the `--s3` flag,
you'll need to get permission to write to the opentransit-data bucket (or create your own S3 bucket and set it via OPENTRANSIT_S3_BUCKET environment variable)
and save AWS credentials in `.aws/credentials`.

compute_arrivals.py will cache the raw state (GPS observations) in the local `data/` directory, so that if you run
compute_arrivals.py again with the same date and routes, it will be much faster.

## Command line scripts

Note: if using Docker, run these command line scripts from a shell within the metrics-flask-dev
Docker container via `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows), not directly on your host machine.

Show overview of routes and directions:
```
python routes.py --agency=muni
```

Show static configuration for a particular route:
```
python route.py --agency=muni --route=1
```

Show overall statistics for a particular route:
```
python route.py --agency=muni --route=1  --date=2019-11-19
```

Show arrival times and headways between buses at a particular stop:
```
python headways.py --date=2019-11-19 --agency=muni --route=1 --stop=16290
```

Compare arrival times and headways between buses at a particular stop, comparing with closest scheduled arrival times and headways:
```
python headways.py --date=2019-11-19 --agency=muni --route=1 --stop=16290 --comparison
```

Show trips between two stops:
```
python trips.py --date=2019-11-19 --agency=muni --route=1 --s1=16314 --s2=16304
```

Show stops visited by a particular vehicle:
```
python vehicle.py --date=2019-11-19 --agency=muni --route=1 --vid=5771
```

Show summary statistics of waiting times at a particular stop:
```
python waits.py --date=2019-11-19 --agency=muni --route=12 --stop=13476
```

Show scheduled timetable for a particular stop:
```
python timetables.py --agency=muni --route=12 --dir=1 --stop=13476 --date=2019-11-19
```

Compare scheduled timetable to actual arrival data, and show schedule adherence:
```
python timetables.py --agency=muni --route=12 --dir=1 --stop=13476 --date=2019-11-19 --comparison
```

Compute wait time statistics for all stops on a particular day:
```
python compute_wait_times.py --agency=muni --date=2019-11-19
```

Compute trip time statistics for all pairs of stops on a particular day:
```
python compute_trip_times.py --agency=muni --date=2019-11-19
```

Parse route configuration from GTFS feed:
```
python save_routes.py --agency=muni
```

Parse timetables from GTFS feed:
```
python save_timetables.py --agency=muni
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
python compare_versions.py --date=2018-11-14 --agency=muni --route=1 t2 v2
```

