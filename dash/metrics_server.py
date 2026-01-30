"""Simple metrics server for the swarm - serves JSON metrics from DB and files"""
from flask import Flask, jsonify
import json
import os
from swarm.db import SessionLocal, models

app = Flask(__name__)
METRICS_PATH = os.environ.get('X3_METRICS_PATH', 'out/metrics.json')

@app.route('/metrics')
def metrics():
    if not os.path.exists(METRICS_PATH):
        return jsonify({'error': 'no_metrics'}), 404
    with open(METRICS_PATH, 'r') as fh:
        data = json.load(fh)
    return jsonify(data)

@app.route('/ref_app')
def ref_app_page():
    from flask import render_template
    return render_template('ref_app.html')

@app.route('/ref_app/json')
def ref_app_json():
    path = os.environ.get('X3_REFAPP_OUT', 'out/ref_app_run.json')
    if not os.path.exists(path):
        return jsonify({'error': 'no_runs'}), 404
    with open(path, 'r') as fh:
        data = json.load(fh)
    return jsonify(data)

# GPU contributor endpoints
@app.route('/gpu/contrib')
def gpu_contrib_page():
    from flask import render_template
    return render_template('gpu_contrib.html')

@app.route('/gpu/contrib/json')
def gpu_contrib_json():
    session = SessionLocal()
    try:
        allocs = session.query(models.Allocation).all()
        contributors = []
        allocation = {}
        for alloc in allocs:
            allocation[alloc.contributor_id] = alloc.amount
            # Note: contributor details like hours/gflops not in DB, only from generation
        data = {'contributors': contributors, 'allocation': allocation}
        return jsonify(data)
    finally:
        session.close()

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/consents')
def api_consents():
    session = SessionLocal()
    try:
        consents = session.query(models.Consent).all()
        data = [{'id': c.id, 'contributor_id': c.contributor_id, 'wallet': c.wallet, 'kyc': c.kyc, 'ts': c.ts.isoformat()} for c in consents]
        return jsonify(data)
    finally:
        session.close()

@app.route('/api/claims')
def api_claims():
    session = SessionLocal()
    try:
        claims = session.query(models.Claim).all()
        data = [{'id': c.id, 'contributor_id': c.contributor_id, 'wallet': c.wallet, 'amount': c.amount, 'status': c.status, 'ts': c.ts.isoformat()} for c in claims]
        return jsonify(data)
    finally:
        session.close()

@app.route('/api/payouts')
def api_payouts():
    session = SessionLocal()
    try:
        payouts = session.query(models.PayoutFinalized).all()
        data = [{'id': p.id, 'contributor_id': p.contributor_id, 'wallet': p.wallet, 'amount': p.amount, 'finalized_at': p.finalized_at.isoformat()} for p in payouts]
        return jsonify(data)
    finally:
        session.close()

@app.route('/api/events')
def api_events():
    session = SessionLocal()
    try:
        events = session.query(models.Event).order_by(models.Event.id.desc()).limit(100).all()
        data = [{'id': e.id, 'type': e.type, 'payload': e.payload, 'ts': e.ts.isoformat()} for e in events]
        return jsonify(data)
    finally:
        session.close()
