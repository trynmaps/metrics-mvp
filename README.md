# OpenTransit's Metrics MVP

## Getting started

### Option 1: Docker + Local IDE

Install [Docker Desktop](https://www.docker.com/products/docker-desktop) or another Docker distribution for your platform.

Build and run the Docker containers:
```
docker-compose up
```

This will run the React frontend in development mode at http://localhost:3000,
and will run the Flask backend in development mode at http://localhost:5000.

Your local directory will be shared within the docker container at /app.
When you edit files in your local directory, the React and Flask containers should automatically update with the new code.

To start a shell within the Flask Docker container, run:
```
docker exec -it metrics-flask bash
```

You can run command line scripts like `compute_arrivals.py` and `headways.py` from the shell in the Docker container.

If you need to install some new dependencies in the Docker images, you can rebuild them via `docker-compose build`.

### Option 2: Cloud IDE

If you don't want to handle installing anything locally, just **[use this cloud editor](http://gitpod.io#https://github.com/trynmaps/metrics-mvp)**.
This will automatically install requirements on a cloud machine and get the app running for you instantly.

### Option 3: Run it manually
If you don't want to use the Cloud IDE and can't get Docker running, you can run the project manually.

To set up, first do:

```
virtualenv venv
```

To run, do this in one terminal tab:

```
source venv/bin/activate
pip3 install -r requirements.txt
FLASK_DEBUG=1 FLASK_APP=metrics-api.py python3 -m flask run --host=0.0.0.0
```

In another terminal tab, do:

```
(cd frontend && npm install)
CHOKIDAR_USEPOLLING=true NODE_ENV=development REACT_APP_METRICS_BASE_URL=http://localhost:5000 npm start
```

Then open `localhost:3000` in your browser to view the app! (Don't visit `0.0.0.0:5000` -- that won't work.)

## Commands to know

To rebuild the production files that are served on port 5000, run:
```
npm run build
```

## Computing Arrival Times

The API and command-line scripts generate statistics based on Muni arrival times that are precomputed from the raw GPS data.
The pre-computed arrival times are stored in S3 at http://opentransit-stop-arrivals.s3.amazonaws.com/?prefix=v2 with a separate JSON file
for each route for each day.

The first time that arrival times are requested for a particular route/day,
the backend will download the JSON file from S3 and cache it in the data/ directory.

If the arrival times for a particular route/day haven't been computed yet, you'll get an error when computing statistics.

To get arrival times for one or more routes/days that haven't been precomputed yet, run `compute_arrivals.py`
to generate the JSON files locally (if using Docker, run this command from a shell within the Docker container
`docker exec -it metrics-flask bash`), e.g:
```
python compute_arrivals.py --date=2019-03-01 --route 1 2 47 38 38X
```

The JSON files with computed arrivals will be stored in your local `data/` directory.

Saving computed arrivals to S3 allows other people to access the arrival times without needing to compute them again.
Adding the `--s3` flag to `compute_arrivals.py` will save the arrival times to S3. To use the `--s3` flag,
you'll need to get permission to write to the opentransit-stop-arrivals bucket and save AWS credentials in `~/.aws/credentials`.

Adding the `--cache-state` flag to compute_arrivals.py will cache the raw state (GPS observations) in the local `data/`
directory, so that if you run `compute_arrivals.py` again with the same date and routes, it will be much faster.

## Command line scripts

Show overall statistics for a particular route:
```
python route.py --date=2019-04-08 --route=1
```

Show headways between buses at a particular stop:
```
python headways.py --date=2019-04-08 --route=1 --stop=6290
```

Show trips between two stops:
```
python trips.py --date=2019-04-08 --route=1 --s1=6314 --s2=6304
```

Show stops visited by a particular vehicle:
```
python vehicle.py --date=2019-04-08 --route=1 --vid=5792
```

Show summary statistics of waiting times at a particular stop:
```
python waits.py --date=2019-04-08 --route=12 --stop=3476
```

Show scheduled timetable for a particular stop:
```
python timetables.py --route=12 --stops=3476 --date=2019-04-12
```

Compare scheduled timetable to collected arrival data, with 3 minutes as the on-time threshold (threshold is optional, the default value is 5 minutes)
```
python timetables.py --route=12 --stops=3476 --date=2019-04-12 --comparison=true --threshold=3
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

Scrape timetables from GTFS data stored locally in `inpath` and extract them to `outpath`:
```
python gtfs_scraper.py --inpath=inpath --outpath=outpath
```

## Deploying to Heroku

Anyone can create a free account on Heroku to deploy their local version of the repo.
Create an app in Heroku at https://dashboard.heroku.com/apps and follow the instructions to deploy using Heroku Git
with an existing Git repository.

The first time you deploy to Heroku, you'll need to tell it to build Docker containers using heroku.yml:
```
heroku stack:set container
```

To deploy the latest commit in your local master branch to Heroku (assuming you have set up a remote named "heroku"):
```
git push heroku master
```

If you are working on another branch besides master, deploy it like this:
```
git push heroku local-branch-name:master
```

## Contributing

To make changes, make sure you've been added to the trynmaps organization on GitHub.

Commit your local changes to a feature branch (i.e. not master), then submit a pull request on GitHub.

## Notes for developers

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt`
so other contributors have the latest versions of required packages.

## Demo

[Check out this demo!](https://opentransit.herokuapp.com/)
