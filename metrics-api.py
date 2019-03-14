import os
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS

from models import metrics

"""
This is the app's main file!
"""

# configuration
DEBUG = True

# Create the app
app = Flask(__name__, static_folder='frontend/build')

# Test endpoint
@app.route('/ping', methods=['GET'])
def ping():
    return "pong"


# "Command Line"-esque endpoints
@app.route('/metrics', methods=['GET'])
def metrics_page():
    route_id = request.args.get('route_id')
    if route_id is None:
        route_id = '12'
    stop_id = request.args.get('stop_id')
    if stop_id is None:
        stop_id = '4970'
    date = request.args.get('date')
    if date is None:
        date = "2019-02-01"

    return "average waiting time at stop " + stop_id + " for route " + route_id + "  on " + date + " is " + str(metrics.get_average_waiting_time(
        stop_id=stop_id,
        route_id=route_id,
        direction="O",
        date_range=[date],
        # use the last month; calculate it and turn it into timestamps
        # date_range=[d.date().strftime("%Y-%m-%d") for d in
        # pd.date_range(pd.datetime.today(), periods=30).tolist()]
        time_range=("09:00", "10:00")))


# Serve React App
# @app.route('/', defaults={'path': ''}, methods=['GET'])
# @app.route('/app/<path:path>')
@app.route('/', methods=['GET'])
def serve_react():
    print("hi")
    return send_from_directory('frontend/build', 'index.html')


# serve everything from the `frontend` folder directly
# (this is mostly static files)
@app.route('/frontend/<path:path>')
def send_frontend(path):
    return send_from_directory('frontend', path)


if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to something.
    port = int(os.environ.get('PORT', 5000))
    app.run(use_reloader=True, threaded=True, port=port)
