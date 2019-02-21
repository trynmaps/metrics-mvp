# OpenTransit's Metrics MVP

The Flask app lives here, the React app lives in the subfolder.

## Getting started

Make sure you're using Python 3. `python --version` (without your virtual environment) should return `Python 3.x.x`.

Then run:

```
virtualenv -p python3 venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running

```
source venv/bin/activate
python app.py
```

## Notes for developers

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt` so other contributors have the latest versions of required packages.

If you'd like to run the React and Flask apps at the same time, do the following:
1. `cd metrics-mvp/frontend` (Ensure you're using npm 8.11.3 or above)
2. `yarn build`
3. `cd ..`
4. `FLASK_APP=metrics-api.py flask run`

Keep in mind this setup doesn't support hot reloading.
