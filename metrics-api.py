import os
from flask import Flask, send_from_directory, jsonify

app = Flask(__name__, static_folder='frontend/build')

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists("frontend/build/" + path):
        return send_from_directory('frontend/build', path)
    else:
        return send_from_directory('frontend/build', 'index.html')

# sanity check route
@app.route('/ajaxCall', methods=['POST'])
def ping_pong():
    return jsonify('I just made an ajax call :)')

if __name__ == '__main__':
    app.run(use_reloader=True, port=5000, threaded=True)
