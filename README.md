# OpenTransit's Metrics MVP

## Getting started


### Option 1: Local Environment

Make sure you're using Python 3. `python --version` (without your virtual environment) should return `Python 3.x.x`.

And make sure you're using npm 8.11.3 or higher.

```
virtualenv -p python3 venv
source venv/bin/activate
pip install -r requirements.txt
cd frontend
npm install
yarn build
cd ..
```

### Option 2: Cloud Environment

If you don't want to handle configuring your system, installing packages,
wrangling Python versions, and stuff, just **[use this cloud editor](http://gitpod.io#https://github.com/trynmaps/metrics-mvp)**.
This will automatically install requirements on a cloud machine
and get the app running for you instantly.

To make changes, make sure you've been added to the trynmaps organization
on GitHub.


## Running

Just do:

```
FLASK_APP=metrics-api.py flask run --host 0.0.0.0
```

## Notes for developers

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt` so other contributors have the latest versions of required packages.

Keep in mind this setup doesn't support hot reloading.


## The new master instructions file

Setup:

```
cp -f pre.sh .git/hooks/pre-commit
virtualenv -p python3 venv
source venv/bin/activate
pip install -r requirements.txt
cd frontend
npm install
yarn build
cd ..
```

Running:

```
FLASK_APP=metrics-api.py flask run --host 0.0.0.0
```

=======
## Demo

[Check out this demo!](https://opentransit.herokuapp.com/metrics)
