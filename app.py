import os
from flask import Flask, jsonify, render_template, send_from_directory
from flask_cors import CORS
from flask import request
from models import metrics

"""
This is the app's main file!
"""

# configuration
DEBUG = True


# instantiate the app
app = Flask(__name__, static_folder="./frontend/public")
app.config.from_object(__name__)


# enable CORS
CORS(app)


# sanity check route
@app.route('/ping', methods=['GET'])
def ping_pong():
    return jsonify('pong!')

# home
@app.route('/', methods=['GET'], defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists("frontend/build/" + path):
        return send_from_directory('frontend/build', path)
    else:
        return send_from_directory('frontend/build', 'index.html')


def home():
    return jsonify('hello! go to /metrics to see metrics')


# hello world
@app.route('/metrics', methods=['GET'])
def index():
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


@app.route('/react', methods=['GET'])
def react():
    return render_template("index.html")


if __name__ == '__main__':
    # using 0.0.0.0 makes it externally visible
    # so gitpod.io can run it
    app.run(host='0.0.0.0', port=os.environ["PORT"])
