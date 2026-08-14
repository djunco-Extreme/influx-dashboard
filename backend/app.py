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


@app.get("/api/buckets/<bucket_name>/ssids")
@login_required
def get_ssids(bucket_name):
    """Fetch available SSIDs from a bucket using MuStats measurement."""
    if not bucket_name or len(bucket_name) > 256:
        return jsonify({"error": "bad_request"}), 400

    try:
        # Query to get distinct SSID values from MuStats measurement
        # Using a simpler approach - get all MuStats data and extract SSID values
        ssid_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "MuStats")
  |> unique(column: "SSID")
'''
        ssids_data = influx_client.query_data(bucket_name, ssid_query, "-30d")

        # Extract distinct SSID values
        ssids = set()
        for item in ssids_data:
            # SSID could be a tag or field
            ssid_value = None

            # Try getting from SSID tag
            if "SSID" in item and item["SSID"]:
                ssid_value = str(item.get("SSID", "")).strip()

            # Also check if SSID is in the field
            if (not ssid_value or ssid_value == "") and item.get("_field") == "SSID":
                ssid_value = str(item.get("_value", "")).strip()

            # Add if valid
            if ssid_value and ssid_value not in ("NA", "Unknown", ""):
                ssids.add(ssid_value)

        ssid_list = sorted(list(ssids))
        log.info(f"Discovered {len(ssid_list)} SSIDs in bucket {bucket_name}")
        return jsonify({"ssids": ssid_list})
    except Exception as e:
        log.error(f"Failed to fetch SSIDs for bucket {bucket_name}: {e}")
        return jsonify({"ssids": []})


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
        # Flux queries based on available data structure

        # 1. Throughput (Upload/Download) - query all numeric fields and aggregate
        throughput_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> aggregateWindow(every: 15m, fn: mean)
  |> sort(columns: ["_time"])
'''

        # 2. Clients over time - count records per time window
        clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> aggregateWindow(every: 15m, fn: count)
  |> sort(columns: ["_time"])
'''

        # 3. Peak clients - max count in any time window
        peak_clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> aggregateWindow(every: 1m, fn: count)
  |> max()
'''

        # 4. Unique clients - distinct count (simplified)
        unique_clients_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats")
  |> aggregateWindow(every: {time_range}, fn: count)
'''

        # 5. Clients by Protocol - query protocol field if available
        protocol_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "ApStats")
  |> aggregateWindow(every: {time_range}, fn: count)
'''

        # 6. Events
        events_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "Events")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 100)
'''

        # Fetch data with error handling
        throughput_data = []
        clients_data = []
        peak_clients = []
        unique_clients = []
        protocol_data = []
        events_data = []

        try:
            throughput_data = influx_client.query_data(bucket_name, throughput_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch throughput data: {e}")

        try:
            clients_data = influx_client.query_data(bucket_name, clients_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch clients data: {e}")

        try:
            peak_clients = influx_client.query_data(bucket_name, peak_clients_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch peak clients: {e}")

        try:
            unique_clients = influx_client.query_data(bucket_name, unique_clients_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch unique clients: {e}")

        try:
            protocol_data = influx_client.query_data(bucket_name, protocol_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch protocol data: {e}")

        try:
            events_data = influx_client.query_data(bucket_name, events_query, f"-{time_range}") or []
        except Exception as e:
            log.warning(f"Failed to fetch events: {e}")

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


@app.get("/api/buckets/<bucket_name>/xiqc-dashboard")
@login_required
def xiqc_dashboard(bucket_name):
    """Fetch comprehensive XIQ-C dashboard data from florida bucket."""
    if bucket_name != "florida":
        return jsonify({"error": "bad_request", "message": "This endpoint is for florida bucket only"}), 400

    time_range = request.args.get("timeRange", "3h").strip()
    selected_ssid = request.args.get("ssid", "").strip()

    try:
        # Simplified Flux queries that work with the actual data

        # 1. Raw MAC data - count by time and calculate peaks/unique
        mac_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "MAC")
  |> limit(n: 5000)
'''

        # 2. RxBytesDelta and TxBytesDelta - throughput data
        throughput_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and (r["_field"] == "RxBytesDelta" or r["_field"] == "TxBytesDelta"))
  |> limit(n: 5000)
'''

        # 3. Protocol field - for distribution
        protocol_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "Protocol")
  |> limit(n: 5000)
'''

        # 4. OsClassName - device type distribution
        device_type_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "OsClassName")
  |> limit(n: 5000)
'''

        # 5. ApName - access point distribution
        ap_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "ApName")
  |> limit(n: 5000)
'''

        # 6. SSID - network distribution
        ssid_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "SSID")
  |> limit(n: 5000)
'''

        # 7. Hostname - for top clients
        hostname_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "MuStats" and r["_field"] == "Hostname")
  |> limit(n: 5000)
'''

        # 8. Events
        events_query = f'''
from(bucket: "{bucket_name}")
  |> range(start: -{time_range})
  |> filter(fn: (r) => r["_measurement"] == "Events")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 100)
'''

        # Execute all queries with error handling
        data = {
            "throughput": [],
            "peakClients": 0,
            "uniqueClients": 0,
            "clientsOverTime": [],
            "totalTraffic": {"upload": 0, "download": 0, "total": 0},
            "protocolDistribution": [],
            "deviceTypeDistribution": [],
            "clientsBySSID": [],
            "clientsByAP": [],
            "topClients": [],
            "events": [],
            "timeRange": time_range,
        }

        try:
            result = influx_client.query_data(bucket_name, mac_query, f"-{time_range}")
            data["peakClients"], data["uniqueClients"], data["clientsOverTime"] = _transform_mac_data(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch MAC data: {e}")

        try:
            result = influx_client.query_data(bucket_name, throughput_query, f"-{time_range}")
            data["throughput"], data["totalTraffic"] = _transform_throughput_data_new(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch throughput data: {e}")

        try:
            result = influx_client.query_data(bucket_name, protocol_query, f"-{time_range}")
            data["protocolDistribution"] = _transform_distribution_data_new(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch protocol data: {e}")

        try:
            result = influx_client.query_data(bucket_name, device_type_query, f"-{time_range}")
            data["deviceTypeDistribution"] = _transform_distribution_data_new(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch device type data: {e}")

        try:
            result = influx_client.query_data(bucket_name, ap_query, f"-{time_range}")
            data["clientsByAP"] = _transform_ap_data(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch AP data: {e}")

        try:
            result = influx_client.query_data(bucket_name, ssid_query, f"-{time_range}")
            data["clientsBySSID"] = _transform_ssid_data(result or [])
        except Exception as e:
            log.warning(f"Failed to fetch SSID data: {e}")

        try:
            result = influx_client.query_data(bucket_name, hostname_query, f"-{time_range}")
            data["topClients"] = _transform_top_clients_data(result or [], selected_ssid)
        except Exception as e:
            log.warning(f"Failed to fetch top clients: {e}")

        try:
            result = influx_client.query_data(bucket_name, events_query, f"-{time_range}")
            data["events"] = _transform_events(result or [])
        except Exception as e:
            log.warning(f"Failed to fetch events: {e}")

        return jsonify(data)

    except influx_client.InfluxError as e:
        return jsonify({"error": "influx_error", "message": str(e)}), 500
    except Exception as e:
        log.error(f"XIQ-C Dashboard query error: {e}")
        return jsonify({"error": "server_error", "message": str(e)}), 500


def _transform_throughput_data(data):
    """Transform throughput data into time series format."""
    result = {}
    for item in data:
        time = item.get("_time", "")
        field = item.get("_field", "")
        value = item.get("_value", 0)

        if time not in result:
            result[time] = {"time": time, "upload": 0, "download": 0}

        if field == "RxBytesDelta":
            result[time]["upload"] = (result[time].get("upload", 0) or 0) + (value or 0) / 15
        elif field == "TxBytesDelta":
            result[time]["download"] = (result[time].get("download", 0) or 0) + (value or 0) / 15

    return sorted(result.values(), key=lambda x: x["time"])


def _transform_clients_over_time(data):
    """Transform client count data."""
    return [{"time": item.get("_time", ""), "count": item.get("_value", 0)} for item in data]


def _transform_total_traffic(data):
    """Transform total traffic data."""
    upload = 0
    download = 0
    for item in data:
        field = item.get("_field", "")
        value = item.get("_value", 0)
        if field == "RxBytesDelta":
            upload += value or 0
        elif field == "TxBytesDelta":
            download += value or 0
    return {"upload": upload, "download": download, "total": upload + download}


def _transform_distribution_data(data, label_key):
    """Transform distribution data for pie/donut charts."""
    result = []
    colors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"]

    for idx, item in enumerate(data):
        result.append({
            "name": item.get("_value", "Unknown"),
            "value": item.get("_value", 0),
            "color": colors[idx % len(colors)]
        })

    return sorted(result, key=lambda x: x["value"], reverse=True)


def _transform_clients_by_group(data, group_key):
    """Transform data grouped by category."""
    grouped = {}
    for item in data:
        group = item.get(group_key, "Unknown")
        if group not in grouped:
            grouped[group] = {"name": group, "time": item.get("_time", ""), "count": 0}
        grouped[group]["count"] += item.get("_value", 0)

    return list(grouped.values())


def _transform_top_clients(data):
    """Transform top clients data."""
    result = []
    for item in data:
        result.append({
            "hostname": item.get("Hostname", "Unknown"),
            "mac": item.get("MAC", "Unknown"),
            "throughput": item.get("_value", 0)
        })
    return result[:10]


def _transform_events(data):
    """Transform events data."""
    return [
        {
            "time": item.get("_time", ""),
            "component": item.get("component", "Unknown"),
            "description": item.get("description", "")
        }
        for item in data
    ]


def _transform_mac_data(data, selected_ssid=""):
    """Transform MAC data to get peak clients, unique clients, and clients over time."""
    mac_set = set()
    time_counts = {}
    peak = 0

    for item in data:
        mac_value = item.get("value", "")
        time = item.get("time", "")

        # Filter by SSID if specified
        if selected_ssid:
            # For MAC field queries, we need to check if this matches the SSID
            # In practice, we'd need tag data, but for raw MAC counts we process all
            pass

        if mac_value:
            mac_set.add(mac_value)

        if time:
            if time not in time_counts:
                time_counts[time] = 0
            time_counts[time] += 1
            peak = max(peak, time_counts[time])

    clients_over_time = sorted(
        [{"time": t, "count": c} for t, c in time_counts.items()],
        key=lambda x: x["time"]
    )

    return peak, len(mac_set), clients_over_time


def _transform_throughput_data_new(data, selected_ssid=""):
    """Transform throughput data and calculate total traffic."""
    throughput_by_time = {}
    upload_total = 0
    download_total = 0

    for item in data:
        field = item.get("field", "")
        time = item.get("time", "")
        value = item.get("value", 0)

        if not isinstance(value, (int, float)):
            try:
                value = float(value)
            except:
                value = 0

        if time not in throughput_by_time:
            throughput_by_time[time] = {"time": time, "upload": 0, "download": 0}

        if field == "RxBytesDelta":
            throughput_by_time[time]["upload"] += value
            upload_total += value
        elif field == "TxBytesDelta":
            throughput_by_time[time]["download"] += value
            download_total += value

    throughput_list = sorted(
        throughput_by_time.values(),
        key=lambda x: x["time"]
    )

    total_traffic = {
        "upload": upload_total,
        "download": download_total,
        "total": upload_total + download_total
    }

    return throughput_list, total_traffic


def _transform_distribution_data_new(data, selected_ssid=""):
    """Transform distribution data for pie/donut charts."""
    distribution = {}
    colors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"]

    for item in data:
        value = item.get("value")
        if value and value != "NA":
            distribution[value] = distribution.get(value, 0) + 1

    result = []
    for idx, (name, count) in enumerate(sorted(distribution.items(), key=lambda x: x[1], reverse=True)[:10]):
        result.append({
            "name": str(name),
            "value": count,
            "color": colors[idx % len(colors)]
        })

    return result


def _transform_ap_data(data, selected_ssid=""):
    """Transform AP data into distribution by access point."""
    ap_counts = {}

    for item in data:
        ap_name = item.get("value", "Unknown")
        time = item.get("time", "")

        if ap_name not in ap_counts:
            ap_counts[ap_name] = {"name": ap_name, "count": 0, "time": time}
        ap_counts[ap_name]["count"] += 1

    return list(ap_counts.values())[:20]


def _transform_ssid_data(data):
    """Transform SSID data into distribution by network."""
    ssid_counts = {}

    for item in data:
        ssid = item.get("value", "Unknown")
        time = item.get("time", "")

        if ssid not in ssid_counts:
            ssid_counts[ssid] = {"name": ssid, "count": 0, "time": time}
        ssid_counts[ssid]["count"] += 1

    return list(ssid_counts.values())[:20]


def _transform_top_clients_data(data, selected_ssid=""):
    """Transform hostname data into top clients."""
    client_counts = {}

    for item in data:
        hostname = item.get("value", "Unknown")
        if hostname and hostname != "":
            client_counts[hostname] = client_counts.get(hostname, 0) + 1

    result = []
    for hostname, count in sorted(client_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        result.append({
            "hostname": hostname,
            "mac": "N/A",
            "throughput": count
        })

    return result


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
