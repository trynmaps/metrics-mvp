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
@app.route('/', defaults={'path': ''}, methods=['GET'])
# @app.route('/app/<path:path>')
def serve(path):
    if path != "" and os.path.exists("frontend/build/" + path):
        return send_from_directory('frontend/build', path)
    else:
        return send_from_directory('frontend/build', 'index.html')


if __name__ == '__main__':
    app.run(use_reloader=True, port=5000, threaded=True, host='0.0.0.0')
    # TODO: figure out why host='0.0.0.0' doesn't work
