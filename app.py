import os
import json
import time
import secrets
import threading
from flask import Flask, request, jsonify, render_template, Response

app = Flask(__name__)
VIEW_USER = os.environ.get('VIEW_USER', 'admin')
VIEW_PASSWORD = os.environ.get('VIEW_PASSWORD', '')
TTL = 7.0
IDS = [f'RADAR-{i:02d}' for i in range(1, 11)]
lock = threading.Lock()
state = {}  # Render Free: volatile memory; no durable storage
logs = {rid: [] for rid in IDS}  # up to 500 completed/active events per radar

def device_keys():
    try:
        raw = json.loads(os.environ.get('RADAR_KEYS', '{}'))
        if not isinstance(raw, dict): return {}
        return {k:v for k,v in raw.items() if k in IDS and isinstance(v,str) and len(v)>=16}
    except (ValueError,TypeError):
        return {}

def viewer_allowed():
    a=request.authorization
    return bool(a and VIEW_PASSWORD and secrets.compare_digest(a.username or '', VIEW_USER) and secrets.compare_digest(a.password or '', VIEW_PASSWORD))

def require_viewer():
    if not viewer_allowed():
        return Response('Authentication required', status=401, headers={'WWW-Authenticate':'Basic realm="COTON RADAR NETWORK"'})
    return None

def close_stale_alarm_locked(rid):
    """Close an active event when the associated radar stops reporting."""
    old = state.get(rid)
    history = logs[rid]
    if old and history and history[-1]['end'] is None:
        data, mono, wall = old
        if time.monotonic() - mono > TTL:
            history[-1]['end'] = wall + TTL


def serialized_events(rid):
    """Response is ISO-8601 UTC; active event duration increases in browser."""
    from datetime import datetime, timezone
    def stamp(epoch):
        return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat().replace('+00:00', 'Z') if epoch is not None else None
    with lock:
        close_stale_alarm_locked(rid)
        return [{'start':stamp(e['start']), 'end':stamp(e['end'])} for e in logs[rid]]

@app.get('/api/logs/<rid>')
def radar_logs(rid):
    denied = require_viewer()
    if denied:return denied
    if rid not in IDS:return jsonify(error='unknown radar'),404
    return jsonify(device_id=rid, events=serialized_events(rid))


def current(rid):
    with lock:
        close_stale_alarm_locked(rid)

        item = state.get(rid)
        if item:
            data, stamp, wall = item
            data = dict(data)
        else:
            data, stamp = None, None
    age = (max(0, time.monotonic()-stamp) if stamp is not None else None)
    if data is None or age > TTL:
        return {'device_id':rid, 'online':False, 'age_seconds':round(age,1) if age is not None else None,
                'alarm':False, 'targets':[], 'sensors':[False,False,False], 'heading_deg':None}
    return {'device_id':rid,'online':True,'age_seconds':round(age,1),**data}

@app.get('/health')
def health(): return jsonify(status='ok', devices=10)

@app.get('/')
def home():
    denied=require_viewer()
    return denied if denied else render_template('index.html')

@app.get('/radar/<rid>')
def single(rid):
    denied=require_viewer()
    if denied:return denied
    if rid not in IDS:return jsonify(error='unknown radar'),404
    return render_template('index.html')

@app.get('/api/states')
def states():
    denied=require_viewer()
    return denied if denied else jsonify(radars=[current(rid) for rid in IDS])

@app.get('/api/state')
def state_one():
    denied=require_viewer()
    if denied:return denied
    rid=request.args.get('device_id','RADAR-01')
    if rid not in IDS:return jsonify(error='unknown radar'),404
    return jsonify(current(rid))

@app.post('/api/ingest')
def ingest():
    if request.content_length is not None and request.content_length > 4096:
        return jsonify(error='payload too large'),413
    d=request.get_json(silent=True)
    if not isinstance(d,dict):return jsonify(error='JSON object required'),400
    rid=d.get('device_id','RADAR-01') # preserves existing single-radar firmware compatibility
    if rid not in IDS:return jsonify(error='invalid device_id'),400
    keys=device_keys()
    key=keys.get(rid)
    if rid=='RADAR-01' and not key:
        legacy=os.environ.get('DEVICE_KEY','')
        key=legacy if len(legacy)>=16 else None
    if not key:return jsonify(error='device key not configured'),503
    if not secrets.compare_digest(request.headers.get('X-Device-Key',''),key):
        return jsonify(error='unauthorized'),401
    sensors=d.get('sensors'); targets=d.get('targets'); seq=d.get('sequence',0)
    if not isinstance(sensors,list) or len(sensors)!=3 or any(type(x) is not bool for x in sensors):
        return jsonify(error='invalid sensors'),400
    if not isinstance(targets,list) or len(targets)>9:
        return jsonify(error='invalid targets'),400
    if type(seq) is not int or seq<0:return jsonify(error='invalid sequence'),400
    clean=[]
    for t in targets:
        if not isinstance(t,dict):return jsonify(error='invalid target'),400
        sector=t.get('sector'); x=t.get('x_mm'); y=t.get('y_mm'); v=t.get('speed_cm_s')
        if type(sector) is not int or sector not in (1,2,3):return jsonify(error='invalid sector'),400
        if not all(type(q) in (int,float) and -100000<=q<=100000 for q in (x,y,v)):
            return jsonify(error='invalid coordinate'),400
        if not sensors[sector-1]:return jsonify(error='target from offline sector'),400
        clean.append({'sector':sector,'x_mm':round(x),'y_mm':round(y),'speed_cm_s':round(v)})
    heading=d.get('heading_deg')
    if heading is not None and (type(heading) not in (int,float) or not -360<=heading<=720):
        return jsonify(error='invalid heading'),400
    normalized={'sequence':seq,'sensors':sensors,'targets':clean,'alarm':len(clean)>0,
                'heading_deg':(round(heading%360,1) if heading is not None else None)}
    with lock:
        now_mono, now_wall = time.monotonic(), time.time()
        close_stale_alarm_locked(rid)
        old = state.get(rid)
        previous_alarm = bool(old and old[0].get('alarm') and now_mono - old[1] <= TTL)
        history = logs[rid]
        if normalized['alarm'] and not previous_alarm:
            history.append({'start': now_wall, 'end': None})
            if len(history) > 500: del history[:-500]
        elif not normalized['alarm'] and previous_alarm and history and history[-1]['end'] is None:
            history[-1]['end'] = now_wall
        state[rid] = (normalized, now_mono, now_wall)
    return jsonify(ok=True,device_id=rid,received=len(clean))

if __name__=='__main__':
    app.run(host='0.0.0.0',port=int(os.environ.get('PORT','10000')))
