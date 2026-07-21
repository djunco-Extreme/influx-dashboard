"""InfluxDB Dashboard — Flask API."""
import hmac
import logging
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import influx_client
from auth import current_session, issue_token, login_required
from config import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("influx.app")

app = Flask(__name__)

# CORS: explicit origins + credentials so the httpOnly session cookie flows.
CORS(
    app,
    resources={r"/api/*": {"origins": config.CORS_ORIGINS}},
    supports_credentials=True,
)

# When deployed as a single service, Flask also serves the built React SPA.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "").strip()

# Paths reachable without the Basic gate (uptime checks).
_BASIC_AUTH_EXEMPT = {"/api/health"}


@app.before_request
def _basic_auth_gate():
    """Coarse HTTP Basic perimeter, active only when both creds are configured."""
    if not (config.BASIC_AUTH_USER and config.BASIC_AUTH_PASSWORD):
        return  # gate disabled
    if request.method == "OPTIONS" or request.path in _BASIC_AUTH_EXEMPT:
        return
    auth = request.authorization
    if (
        auth is not None
        and (auth.username or auth.password)  # a Basic credential, not a Bearer token
        and hmac.compare_digest(auth.username or "", config.BASIC_AUTH_USER)
        and hmac.compare_digest(auth.password or "", config.BASIC_AUTH_PASSWORD)
    ):
        return
    # Allow authenticated sessions to bypass Basic Auth gate
    session = current_session()
    if session:
        return
    resp = jsonify({"error": "unauthorized", "message": "Authentication required"})
    resp.status_code = 401
    resp.headers["WWW-Authenticate"] = 'Basic realm="InfluxDB Dashboard"'
    return resp


def _set_session_cookie(resp, token: str):
    resp.set_cookie(
        config.SESSION_COOKIE,
        token,
        httponly=True,
        secure=config.IS_PROD,           # require HTTPS in production
        samesite="Lax",
        max_age=config.SESSION_TTL_HOURS * 3600,
        path="/",
    )
    return resp


# ── Public ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    try:
        influx_client._get_client().close()
        return jsonify({
            "status": "ok",
            "service": "influx-dashboard-api",
            "influxdbAvailable": True,
        })
    except Exception as e:
        return jsonify({
            "status": "degraded",
            "service": "influx-dashboard-api",
            "influxdbAvailable": False,
            "error": str(e),
        }), 503


@app.post("/api/login")
def login():
    body = request.get_json(silent=True) or {}

    username = body.get("username")
    password = body.get("password")

    # Input validation
    if username is not None and not isinstance(username, str):
        return jsonify({"error": "bad_request", "message": "username must be a string"}), 400
    if password is not None and not isinstance(password, str):
        return jsonify({"error": "bad_request", "message": "password must be a string"}), 400

    if len(username or "") > 256 or len(password or "") > 1024:
        return jsonify({"error": "bad_request", "message": "field too long"}), 400

    try:
        mode = influx_client.authenticate(username or "", password or "")
    except influx_client.AuthError as exc:
        return jsonify({"error": "unauthorized", "message": str(exc)}), 401

    token = issue_token(subject=username or "")
    resp = jsonify({
        "user": username or "",
        "mode": mode,
        "message": "Authenticated",
    })
    return _set_session_cookie(resp, token), 200


@app.post("/api/logout")
def logout():
    session = current_session()
    if session:
        influx_client.invalidate_cache(session.get("sub"))
    resp = jsonify({"message": "logged out"})
    resp.delete_cookie(config.SESSION_COOKIE, path="/")
    return resp


@app.get("/api/auth/session")
def session_state():
    session = current_session()
    if not session:
        return jsonify({"authenticated": False}), 200
    return jsonify({
        "authenticated": True,
        "user": session.get("sub"),
    })


# ── Protected ────────────────────────────────────────────────────────────────

@app.get("/api/buckets")
@login_required
def buckets():
    try:
        buckets_list = influx_client.get_buckets(request.session_payload.get("sub"))
        return jsonify({"buckets": buckets_list})
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500


@app.get("/api/buckets/<bucket_name>/measurements")
@login_required
def measurements(bucket_name):
    if not bucket_name or len(bucket_name) > 256:
        return jsonify({"error": "bad_request"}), 400
    try:
        meas = influx_client.get_measurements(bucket_name)
        return jsonify({"measurements": meas})
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500


@app.get("/api/buckets/<bucket_name>/measurements/<measurement>/metadata")
@login_required
def measurement_metadata(bucket_name, measurement):
    if not bucket_name or len(bucket_name) > 256 or not measurement or len(measurement) > 256:
        return jsonify({"error": "bad_request"}), 400
    try:
        metadata = influx_client.get_measurement_metadata(bucket_name, measurement)
        return jsonify(metadata)
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500


@app.get("/api/buckets/<bucket_name>/measurements/<measurement>/data")
@login_required
def measurement_data(bucket_name, measurement):
    if not bucket_name or len(bucket_name) > 256 or not measurement or len(measurement) > 256:
        return jsonify({"error": "bad_request"}), 400
    field = request.args.get("field", "").strip() or None
    limit = int(request.args.get("limit", "100"))
    if limit > 1000:
        limit = 1000
    try:
        data = influx_client.get_recent_data(bucket_name, measurement, field, limit)
        return jsonify({"data": data})
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500


@app.post("/api/query")
@login_required
def query():
    body = request.get_json(silent=True) or {}
    bucket = body.get("bucket")
    flux = body.get("flux")

    if not bucket or not flux:
        return jsonify({"error": "bad_request", "message": "bucket and flux are required"}), 400
    if len(bucket) > 256 or len(flux) > 10000:
        return jsonify({"error": "bad_request", "message": "field too long"}), 400

    try:
        data = influx_client.query_data(bucket, flux)
        return jsonify({"data": data})
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500


@app.get("/api/buckets/<bucket_name>/report")
@login_required
def report(bucket_name):
    """Fetch report data from InfluxDB based on filters."""
    if not bucket_name or len(bucket_name) > 256:
        return jsonify({"error": "bad_request"}), 400

    # Get query parameters
    ssids_param = request.args.get("ssids", "").strip()
    time_range = request.args.get("timeRange", "12h").strip()

    ssids = [s.strip() for s in ssids_param.split(",") if s.strip()] if ssids_param else []

    try:
        # Flux queries based on Grafana template

        # 1. Throughput (Upload/Download)
        throughput_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and (r["_field"] == "RxBytesDelta" or r["_field"] == "TxBytesDelta"))
  |> aggregateWindow(every: 15m, fn: sum)
  |> sort(columns: ["_time"])
'''

        # 2. Clients over time
        clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> group(columns: ["_time"])
  |> unique(column: "MAC")
  |> group()
  |> aggregateWindow(every: 15m, fn: count)
  |> sort(columns: ["_time"])
'''

        # 3. Peak clients
        peak_clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> group(columns: ["_time"])
  |> unique(column: "MAC")
  |> group()
  |> aggregateWindow(every: 1m, fn: count)
  |> max()
'''

        # 4. Unique clients
        unique_clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> unique(column: "MAC")
  |> count()
'''

        # 5. Clients by Protocol
        protocol_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> group(columns: ["Protocol"])
  |> unique(column: "MAC")
  |> count()
'''

        # 6. Events
        events_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "Events")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 100)
'''

        # Fetch data
        throughput_data = influx_client.query_data(bucket_name, throughput_query, f"-{time_range}")
        clients_data = influx_client.query_data(bucket_name, clients_query, f"-{time_range}")
        peak_clients = influx_client.query_data(bucket_name, peak_clients_query, f"-{time_range}")
        unique_clients = influx_client.query_data(bucket_name, unique_clients_query, f"-{time_range}")
        protocol_data = influx_client.query_data(bucket_name, protocol_query, f"-{time_range}")
        events_data = influx_client.query_data(bucket_name, events_query, f"-{time_range}")

        # Transform throughput data
        def transform_throughput(data):
            result = {}
            for item in data:
                timestamp = item.get("_time", "")
                field = item.get("_field", "")
                value = item.get("_value", 0)

                if timestamp not in result:
                    result[timestamp] = {"time": timestamp}

                if field == "RxBytesDelta":
                    result[timestamp]["Upload"] = result[timestamp].get("Upload", 0) + (value / 15 if value else 0)
                elif field == "TxBytesDelta":
                    result[timestamp]["Download"] = result[timestamp].get("Download", 0) + (value / 15 if value else 0)

            return list(result.values())

        # Transform clients data
        def transform_clients(data):
            return [{"time": item.get("_time", ""), "count": item.get("_value", 0)} for item in data]

        # Transform events
        def transform_events(data):
            return [
                {
                    "time": item.get("_time", ""),
                    "type": item.get("component", "Event"),
                    "description": item.get("description", "")
                }
                for item in data
            ]

        # Get metrics
        peak_clients_value = peak_clients[0].get("_value", 0) if peak_clients else 0
        unique_clients_value = unique_clients[0].get("_value", 0) if unique_clients else 0

        # Calculate total traffic
        total_upload = sum([d.get("Upload", 0) for d in transform_throughput(throughput_data)]) / len(throughput_data) if throughput_data else 0
        total_download = sum([d.get("Download", 0) for d in transform_throughput(throughput_data)]) / len(throughput_data) if throughput_data else 0

        # Build response
        report_data = {
            "throughput": transform_throughput(throughput_data),
            "clients": transform_clients(clients_data),
            "peakClients": peak_clients_value,
            "uniqueClients": unique_clients_value,
            "totalTraffic": {
                "upload": total_upload,
                "download": total_download,
                "total": total_upload + total_download,
            },
            "clientsByProtocol": transform_protocol_data(protocol_data),
            "clientsByDeviceType": [],
            "clientsBySSID": [],
            "topClientsByThroughput": [],
            "events": transform_events(events_data),
            "appliedFilters": {
                "ssids": ssids,
                "timeRange": time_range,
                "bucket": bucket_name,
            }
        }

        return jsonify(report_data)
    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500
    except Exception as e:
        log.error(f"Report query error: {e}")
        return jsonify({"error": "server_error", "message": str(e)}), 500


def transform_protocol_data(data):
    """Transform protocol data into chart format."""
    protocols = {}
    colors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"]

    for item in data:
        protocol = item.get("protocol", "unknown")
        value = item.get("_value", 0)
        if protocol in protocols:
            protocols[protocol] += value
        else:
            protocols[protocol] = value

    result = []
    for idx, (protocol, count) in enumerate(protocols.items()):
        result.append({
            "name": protocol,
            "value": count,
            "color": colors[idx % len(colors)]
        })

    return sorted(result, key=lambda x: x["value"], reverse=True)


# ── Static SPA (single-service deploy) ───────────────────────────────────────

@app.get("/")
def spa_index():
    if FRONTEND_DIST:
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"service": "influx-dashboard-api", "health": "/api/health"})


@app.get("/<path:path>")
def spa_catchall(path):
    if path.startswith("api/"):
        return jsonify({"error": "not_found"}), 404
    if not FRONTEND_DIST:
        return jsonify({"error": "not_found"}), 404
    candidate = os.path.join(FRONTEND_DIST, path)
    if os.path.isfile(candidate):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "not_found"}), 404


@app.errorhandler(500)
def server_error(_e):
    return jsonify({"error": "server_error"}), 500


if __name__ == "__main__":
    log.info("Starting InfluxDB Dashboard API on :%s (env=%s)", config.API_PORT, config.FLASK_ENV)
    app.run(host="0.0.0.0", port=config.API_PORT, debug=not config.IS_PROD)
