"""InfluxDB client and utilities."""
import logging
from typing import Optional, List, Dict, Any
import time

from influxdb_client import InfluxDBClient

from config import config
from cache import cache

log = logging.getLogger("influx.client")


class InfluxError(Exception):
    """InfluxDB operation error."""
    pass


class AuthError(InfluxError):
    """Authentication error."""
    pass


def _get_client() -> InfluxDBClient:
    """Create and return an InfluxDB client."""
    try:
        client = InfluxDBClient(
            url=config.INFLUXDB_URL,
            username=config.INFLUXDB_USERNAME,
            password=config.INFLUXDB_PASSWORD,
            org=config.INFLUXDB_ORG,
        )
        # Test connection
        health = client.health()
        if health.status != "pass":
            raise AuthError("InfluxDB health check failed")
        return client
    except Exception as e:
        log.error(f"Failed to connect to InfluxDB: {e}")
        raise AuthError(f"Failed to connect to InfluxDB: {e}")


def authenticate(username: str, password: str) -> str:
    """Authenticate against InfluxDB. Returns 'live' on success."""
    try:
        client = InfluxDBClient(
            url=config.INFLUXDB_URL,
            username=username,
            password=password,
            org=config.INFLUXDB_ORG,
        )
        health = client.health()
        client.close()
        if health.status != "pass":
            raise AuthError("InfluxDB health check failed")
        return "live"
    except Exception as e:
        log.error(f"Authentication failed: {e}")
        raise AuthError(f"Authentication failed: {str(e)}")


def get_buckets(username: str = None) -> List[Dict[str, Any]]:
    """Fetch all available buckets."""
    cache_key = f"buckets:{username or 'default'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = _get_client()
        buckets_api = client.buckets_api()
        buckets = buckets_api.find_buckets()
        client.close()

        result = []
        for bucket in buckets.buckets:
            retention = []
            if bucket.retention_rules:
                for rule in bucket.retention_rules:
                    retention.append({
                        "everySeconds": rule.every_seconds if hasattr(rule, 'every_seconds') else rule.everySeconds,
                        "shardGroupDurationSeconds": rule.shard_group_duration_seconds if hasattr(rule, 'shard_group_duration_seconds') else getattr(rule, 'shardGroupDurationSeconds', None),
                    })

            result.append({
                "id": bucket.id,
                "name": bucket.name,
                "type": bucket.type,
                "retentionRules": retention,
                "createdAt": bucket.created_at.isoformat() if hasattr(bucket, 'created_at') else None,
            })

        cache.set(cache_key, result)
        return result
    except Exception as e:
        log.error(f"Error fetching buckets: {e}")
        raise InfluxError(f"Failed to fetch buckets: {str(e)}")


def get_measurements(bucket_name: str) -> List[str]:
    """Fetch all measurement names in a bucket."""
    cache_key = f"measurements:{bucket_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = _get_client()
        query_api = client.query_api()

        # Flux query to get all measurement names
        flux_query = f'import "influxdata/influxdb/schema" schema.measurements(bucket: "{bucket_name}")'
        tables = query_api.query(flux_query)

        measurements = []
        for table in tables:
            for record in table.records:
                measurements.append(record.values.get("_value"))

        client.close()
        measurements = [m for m in measurements if m]  # Filter None
        cache.set(cache_key, measurements)
        return measurements
    except Exception as e:
        log.warning(f"Error fetching measurements for {bucket_name}: {e}")
        return []


def get_measurement_metadata(bucket_name: str, measurement: str) -> Dict[str, Any]:
    """Fetch field and tag keys for a measurement."""
    cache_key = f"metadata:{bucket_name}:{measurement}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = _get_client()
        query_api = client.query_api()

        # Get field keys
        field_query = f'from(bucket: "{bucket_name}") |> range(start: -30d) |> filter(fn: (r) => r._measurement == "{measurement}") |> keys()'
        field_tables = query_api.query(field_query)
        fields = []
        for table in field_tables:
            for record in table.records:
                val = record.values.get("_value")
                if val and val not in ["_time", "_measurement", "_field", "_value"]:
                    fields.append(val)

        # Get tag keys - try to get from schema
        tag_query = f'import "influxdata/influxdb/schema" schema.tagKeys(bucket: "{bucket_name}", measurement: "{measurement}")'
        try:
            tag_tables = query_api.query(tag_query)
            tags = []
            for table in tag_tables:
                for record in table.records:
                    val = record.values.get("_value")
                    if val:
                        tags.append(val)
        except:
            tags = []

        result = {
            "measurement": measurement,
            "fields": list(set(fields)),
            "tags": list(set(tags)),
        }

        client.close()
        cache.set(cache_key, result)
        return result
    except Exception as e:
        log.warning(f"Error fetching metadata for {measurement}: {e}")
        return {"measurement": measurement, "fields": [], "tags": []}


def get_recent_data(bucket_name: str, measurement: str, field: str = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch recent data points from a measurement."""
    cache_key = f"data:{bucket_name}:{measurement}:{field}:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = _get_client()
        query_api = client.query_api()

        if field:
            flux_query = f'''from(bucket: "{bucket_name}")
                |> range(start: -24h)
                |> filter(fn: (r) => r._measurement == "{measurement}" and r._field == "{field}")
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: {limit})'''
        else:
            flux_query = f'''from(bucket: "{bucket_name}")
                |> range(start: -24h)
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: {limit})'''

        tables = query_api.query(flux_query)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat() if record.get_time() else None,
                    "measurement": record.values.get("_measurement"),
                    "field": record.values.get("_field"),
                    "value": record.get_value(),
                    "tags": {k: v for k, v in record.values.items() if k.startswith("tag_") or (not k.startswith("_") and k not in ["_time", "_measurement", "_field", "_value"])},
                })

        client.close()
        cache.set(cache_key, results)
        return results
    except Exception as e:
        log.warning(f"Error fetching recent data: {e}")
        return []


def query_data(bucket_name: str, flux_query: str, range_start: str = "-24h") -> List[Dict[str, Any]]:
    """Execute a custom Flux query."""
    try:
        client = _get_client()
        query_api = client.query_api()

        tables = query_api.query(flux_query)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat() if record.get_time() else None,
                    "value": record.get_value(),
                    "field": record.values.get("_field"),
                    "measurement": record.values.get("_measurement"),
                })

        client.close()
        return results
    except Exception as e:
        log.error(f"Error executing query: {e}")
        raise InfluxError(f"Query failed: {str(e)}")


def invalidate_cache(username: str = None):
    """Invalidate caches for a user."""
    pattern = f"buckets:{username or 'default'}" if username else ""
    cache.invalidate(pattern)
