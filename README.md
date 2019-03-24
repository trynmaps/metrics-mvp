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

## Computing Arrival Times

The API and command-line scripts generate statistics based on Muni arrival times that are precomputed from the raw GPS data.
The pre-computed arrival times are stored in S3 at http://opentransit-stop-arrivals.s3.amazonaws.com/?prefix=v2 with a separate JSON file
for each route for each day.

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

## Command line scripts

Show headways between buses at a particular stop:
```
python headways.py --date=2019-02-01 --route=1 --stop=6290
```

Show trips between two stops:
```
python trips.py --date=2019-02-01 --route=1 --s1=6314 --s2=6304
```

Show stops visited by a particular vehicle:
```
python vehicle.py --date=2019-02-01 --route=1 --vid=5737
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
