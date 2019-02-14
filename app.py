from flask import Flask, jsonify
from flask_cors import CORS

"""
This is the app's main file!
"""

from models import mock_metrics

# configuration
DEBUG = True

# instantiate the app
app = Flask(__name__)
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
    return "hello, this is a message: " + mock_metrics.test()


if __name__ == '__main__':
    app.run()
