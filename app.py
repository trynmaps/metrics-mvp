from flask import Flask, jsonify, render_template
from flask_cors import CORS
import pandas as pd

from models import mock_metrics

"""
This is the app's main file!
"""

# configuration
DEBUG = True

# instantiate the app
app = Flask(__name__, template_folder="./frontend/public")
app.config.from_object(__name__)

# enable CORS
CORS(app)


# sanity check route
@app.route('/ping', methods=['GET'])
def ping_pong():
    return jsonify('pong!')

# hello world
@app.route('/', methods=['GET'])
def index():
    return "average waiting time is " + str(mock_metrics.get_average_waiting_time(
        stop_id="4970",
        route_id="12",
        direction="O",
        date_range=["2019-01-01", "2019-01-02", "2019-01-03"],
        # use the last month; calculate it and turn it into timestamps
        # date_range=[d.date().strftime("%Y-%m-%d") for d in
            # pd.date_range(pd.datetime.today(), periods=30).tolist()]
        time_range=("09:00", "17:00")))

@app.route('/react', methods=['GET'])
def react():
    return render_template("index.html")

if __name__ == '__main__':
    app.run()
