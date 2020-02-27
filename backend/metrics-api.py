import os
from flask import Flask, send_from_directory, Response
from flask_cors import CORS
import json
from models import schema, config, routeconfig, arrival_history, precomputed_stats
from flask_graphql import GraphQLView

# import cProfile

"""
This is the app's main file!
"""

# configuration
DEBUG = os.environ.get("FLASK_DEBUG") == "1"

# Create the app
app = Flask(__name__, static_folder="../frontend/build")
CORS(app)

# Test endpoint
@app.route("/api/ping", methods=["GET"])
def ping():
    return "pong"


app.add_url_rule(
    "/api/graphiql",
    view_func=GraphQLView.as_view("graphiql", schema=schema.metrics_api, graphiql=True),
)

graphql_view = GraphQLView.as_view("metrics_api", schema=schema.metrics_api, graphiql=False)


def graphql_wrapper():
    # pr = cProfile.Profile()
    # pr.enable()
    res = graphql_view()
    # pr.disable()
    # pr.dump_stats('graphql.pstats')
    return res


app.add_url_rule("/api/graphql", view_func=graphql_wrapper)


def make_error_response(params, error, status):
    data = {"params": params, "error": error}
    return Response(json.dumps(data, indent=2), status=status, mimetype="application/json")


@app.route("/api/js_config", methods=["GET"])
def js_config():

    if DEBUG:
        config.load_agencies()  # agency config may have changed on disk

    data = {
        "S3Bucket": config.s3_bucket,
        "ArrivalsVersion": arrival_history.DefaultVersion,
        "PrecomputedStatsVersion": precomputed_stats.DefaultVersion,
        "RoutesVersion": routeconfig.DefaultVersion,
        "Agencies": [
            {"id": agency.id, "timezoneId": agency.timezone_id, **agency.js_properties}
            for agency in config.agencies
        ],
    }

    res = Response(f"var OpentransitConfig = {json.dumps(data)};", mimetype="text/javascript")
    if not DEBUG:
        res.headers["Cache-Control"] = "max-age=10"
    return res


if os.environ.get("METRICS_ALL_IN_ONE") == "1":

    @app.route("/frontend/build/<path:path>")
    def frontend_build(path):
        return send_from_directory("../frontend/build", path)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def wildcard(path):
        return send_from_directory("../frontend/build", "index.html")


else:

    @app.route("/")
    def root():
        return (
            "<h2>Hello!</h2><p>This is the API server.<br /><br />Go to"
            " port 3000 to see the real app.</p>"
        )


if __name__ == "__main__":
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get("PORT", 5000))
    app.run(use_reloader=True, threaded=True, host="0.0.0.0", port=port)
