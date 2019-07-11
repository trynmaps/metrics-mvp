# OpenTransit's Metrics MVP
[Check out our demo!](http://muni.opentransit.city/)

## Getting started

### Option 1: Docker + Local IDE

Install [Docker Desktop](https://www.docker.com/products/docker-desktop) or another Docker distribution for your platform.

Build and run the Docker containers:
```
docker-compose up
```

This will run the React frontend in development mode at http://localhost:3000,
and will run the Flask backend in development mode at http://localhost:5000.

Your local directory will be shared within the Docker container at /app.
When you edit files in your local directory, the React and Flask containers should automatically update with the new code.

To start a shell within the Flask Docker container, run `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows).

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
NODE_ENV=development REACT_APP_METRICS_BASE_URL=http://localhost:5000 npm start
```

Then open `localhost:3000` in your browser to view the app!

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

## Deploying to Production

When changes are merged to the master branch on GitHub, Google Cloud Build will automatically build
the latest code and deploy it to a cluster on Google Kubernetes Engine. The build steps are defined in cloudbuild.yaml.

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

## Frontend code

The frontend React code is in the /frontend directory and is built using Create React App.
For more information, see https://facebook.github.io/create-react-app/docs/folder-structure

## Tech Stack Decisions

### Overall
- Docker - We use Docker to ensure a consistent environment across all machines
- Docker Compose - We use Docker Compose to run multiple containers at once

### Frontend
- NPM - Due to both the NPM and Yarn package managers offering roughly the same performance, Yarn being a superset of NPM, and there was nothing in the Yarn roadmap which would indicate it would make it worthwhile in the future, we went with NPM
- React - Our team members switched projects over from OpenTransit Map and decided to use the same frontend framework
- Material UI - We decided to migrate to Material UI, because it has zero dependence on jQuery (unlike Bootstrap), it is the most popular React framework, and it offers a more fluid and pleasant experience for mobile users
- Functional Components - We migrated away from ES6 React Components and introduced [Functional Components](https://reactjs.org/docs/components-and-props.html) instead due to the simplification of component logic and the ability to use React Hooks
- Redux Thunk - We use Redux for state management and to simplify our application and component interaction, and Thunk as middleware
- React Hooks - We use React Hooks to manage interactions with state management


## Notes for developers

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt`
so other contributors have the latest versions of required packages.

If you're developing within Docker on Windows, by default, React does not automatically recompile the frontend code when you make changes.
In order to allow React to automatically recompile the frontend code within the Docker container when you edit files shared from your
Windows host computer, you can create a docker-compose.override.yml to enable CHOKIDAR_USEPOLLING like this:

```
version: "3.7"
services:
  react-dev:
    environment:
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "2500"
```

This setting is not in the main docker-compose.yml file because CHOKIDAR_USEPOLLING causes high CPU/battery usage for developers using Mac OS X,
and CHOKIDAR_USEPOLLING is not necessary on Mac OS X to automatically recompile the frontend code when it changes.
