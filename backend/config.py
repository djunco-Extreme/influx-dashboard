"""InfluxDB Dashboard — configuration from environment."""
import os
from pathlib import Path

# Load .env if it exists
from dotenv import load_dotenv
load_dotenv()

# InfluxDB connection
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://134.141.1.115:8086").strip()
INFLUXDB_USERNAME = os.getenv("INFLUXDB_USERNAME", "extreme").strip()
INFLUXDB_PASSWORD = os.getenv("INFLUXDB_PASSWORD", "Extr3m3!").strip()
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "").strip()
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "").strip()

# JWT / Session
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production").strip()
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "8"))
SESSION_COOKIE = "sid"

# Caching
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))

# Server
API_PORT = int(os.getenv("API_PORT", "3001"))
FLASK_ENV = os.getenv("FLASK_ENV", "development").strip()
IS_PROD = FLASK_ENV == "production"

# CORS
CORS_ORIGINS = [
    origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()
] or ["http://localhost:5173", "http://127.0.0.1:5173"]

# HTTP Basic auth (perimeter gate)
BASIC_AUTH_USER = os.getenv("BASIC_AUTH_USER", "").strip()
BASIC_AUTH_PASSWORD = os.getenv("BASIC_AUTH_PASSWORD", "").strip()

# Export as config object for compatibility
class Config:
    pass

config = Config()
for key in dir():
    if not key.startswith("_") and key.isupper():
        setattr(config, key, globals()[key])
