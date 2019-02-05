from flask import Flask
import mock_metrics
app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'