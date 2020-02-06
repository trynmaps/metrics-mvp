import os
from flask import Flask, send_from_directory, request, Response
from flask_cors import CORS
import json
import sys
from models import schema, config, wait_times, trip_times, routeconfig, arrival_history
from flask_graphql import GraphQLView

"""
This is the app's main file!
"""

# configuration
DEBUG = os.environ.get('FLASK_DEBUG') == '1'

# Create the app
app = Flask(__name__, static_folder='../frontend/build')
CORS(app)

# Test endpoint
@app.route('/api/ping', methods=['GET'])
def ping():
    return "pong"

app.add_url_rule('/api/graphiql', view_func = GraphQLView.as_view('graphiql', schema = schema.metrics_api, graphiql = True))

app.add_url_rule('/api/graphql', view_func = GraphQLView.as_view('graphql', schema = schema.metrics_api, graphiql = False))

def make_error_response(params, error, status):
    data = {
        'params': params,
        'error': error,
    }
    return Response(json.dumps(data, indent=2), status=status, mimetype='application/json')

@app.route('/api/js_config', methods=['GET'])
def js_config():

    if DEBUG:
        config.load_agencies() # agency config may have changed on disk

    data = {
        'S3Bucket': config.s3_bucket,
        'ArrivalsVersion': arrival_history.DefaultVersion,
        'WaitTimesVersion': wait_times.DefaultVersion,
        'TripTimesVersion': trip_times.DefaultVersion,
        'RoutesVersion': routeconfig.DefaultVersion,
        'Agencies': [
            {
                'id': agency.id,
                'timezoneId': agency.timezone_id,
                **agency.js_properties,
            } for agency in config.agencies
        ]
    }

    res = Response(f'var OpentransitConfig = {json.dumps(data)};', mimetype='text/javascript')
    if not DEBUG:
        res.headers['Cache-Control'] = 'max-age=3600'
    return res

if os.environ.get('METRICS_ALL_IN_ONE') == '1':
    @app.route('/frontend/build/<path:path>')
    def frontend_build(path):
        return send_from_directory('../frontend/build', path)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def wildcard(path):
        return send_from_directory('../frontend/build', 'index.html')
else:
    @app.route('/')
    def root():
        return """<h2>Hello!</h2><p>This is the API server.<br /><br />Go to port 3000 to see the real app.</p>"""

if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.run(use_reloader=True, threaded=True, host='0.0.0.0', port=port)
