import os
import time
import secrets
import threading
from flask import Flask, request, jsonify, render_template, Response

app = Flask(__name__)
DEVICE_KEY = os.environ.get('DEVICE_KEY', '')
VIEW_USER = os.environ.get('VIEW_USER', 'radar')
VIEW_PASSWORD = os.environ.get('VIEW_PASSWORD', '')
TTL_SECONDS = 7
_lock = threading.Lock()
_state = None
_received = 0.0


def is_viewer():
    auth = request.authorization
    return bool(auth and VIEW_PASSWORD and secrets.compare_digest(auth.username or '', VIEW_USER) and secrets.compare_digest(auth.password or '', VIEW_PASSWORD))


def protected():
    if not is_viewer():
        return Response('Authentication required', 401, {'WWW-Authenticate': 'Basic realm="COTON RADAR 360"'})
    return None

@app.get('/health')
def health():
    return jsonify(status='ok', service='COTON RADAR 360')

@app.get('/')
def index():
    denied = protected()
    if denied: return denied
    return render_template('index.html')

@app.get('/api/state')
def state():
    denied = protected()
    if denied: return denied
    with _lock:
        data = _state
        age = max(0, time.monotonic() - _received) if data else None
    if data is None or age > TTL_SECONDS:
        return jsonify(online=False, age_seconds=round(age, 1) if age is not None else None, alarm=False, sensors=[False]*3, targets=[]), 200
    return jsonify(online=True, age_seconds=round(age,1), **data)

@app.post('/api/ingest')
def ingest():
    if not DEVICE_KEY:
        return jsonify(error='DEVICE_KEY not configured'), 503
    token = request.headers.get('X-Device-Key', '')
    if not secrets.compare_digest(token, DEVICE_KEY):
        return jsonify(error='unauthorized'), 401
    if request.content_length is not None and request.content_length > 4096:
        return jsonify(error='payload too large'), 413
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error='JSON object required'), 400
    targets = data.get('targets')
    sensors = data.get('sensors')
    if not isinstance(targets, list) or len(targets) > 9 or not isinstance(sensors, list) or len(sensors) != 3 or not all(type(x) is bool for x in sensors):
        return jsonify(error='invalid sensors or targets'), 400
    clean_targets = []
    for t in targets:
        if not isinstance(t, dict): return jsonify(error='invalid target'), 400
        sector, x, y, speed = t.get('sector'), t.get('x_mm'), t.get('y_mm'), t.get('speed_cm_s')
        if type(sector) is not int or sector not in (1,2,3): return jsonify(error='invalid sector'), 400
        if not all(type(v) in (int,float) and -100000 <= v <= 100000 for v in (x,y,speed)):
            return jsonify(error='invalid coordinates'), 400
        clean_targets.append({'sector':sector,'x_mm':round(x),'y_mm':round(y),'speed_cm_s':round(speed)})
    seq = data.get('sequence', 0)
    if type(seq) is not int or seq < 0: return jsonify(error='invalid sequence'), 400
    sanitized = {'sequence':seq,'sensors':sensors,'targets':clean_targets,'alarm':bool(clean_targets)}
    global _state, _received
    with _lock:
        _state = sanitized
        _received = time.monotonic()
    return jsonify(ok=True, received=len(clean_targets))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT','10000')))
