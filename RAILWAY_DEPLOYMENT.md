# Railway Deployment Guide

This document explains how to deploy the InfluxDB Dashboard to Railway with the correct InfluxDB configuration.

## Environment Configuration

### Local Development (Your Laptop)
- **InfluxDB IP:** `http://10.139.28.144:8086` (local network IP)
- **Config file:** `backend/.env`
- **Port:** 3001 (backend), 5173 (frontend)

### Production (Railway)
- **InfluxDB IP:** `http://134.141.1.115:8086` (external/routable IP)
- **Config template:** `backend/.env.railway`
- **Port:** 3001 (backend)

## Why Two Different IPs?

- **Local (10.139.28.144):** Your laptop's local network address - reachable only from devices on the same network
- **External (134.141.1.115):** External/routable IP - reachable from Railway's cloud infrastructure

## Deploying to Railway

### 1. Set Up Railway Project

```bash
# Install Railway CLI (if not already installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Create a new project
railway init
```

### 2. Configure Environment Variables in Railway

In the Railway dashboard or via CLI, set these environment variables:

```bash
INFLUXDB_URL=http://134.141.1.115:8086
INFLUXDB_USERNAME=extreme
INFLUXDB_PASSWORD=Extr3m3!
JWT_SECRET=<generate-a-strong-random-secret>
FLASK_ENV=production
API_PORT=3001
CORS_ORIGINS=https://<your-railway-domain>.railway.app
BASIC_AUTH_USER=extreme
BASIC_AUTH_PASSWORD=Extr3m3!
```

#### Generate a Strong JWT_SECRET
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3. Deploy

```bash
# Deploy from root directory
railway up
```

Or push to GitHub and configure Railway to auto-deploy on push.

### 4. Verify Deployment

Check Railway dashboard for:
- ✅ Backend service running
- ✅ Health check: `https://<your-domain>/api/health`
- ✅ Can authenticate: Test `/api/login` endpoint

## Troubleshooting

### InfluxDB Connection Fails
- Verify `INFLUXDB_URL` is set to the **external IP** (134.141.1.115), not the local IP
- Check that Railway can reach the external InfluxDB server (firewall rules)
- Verify credentials in `INFLUXDB_USERNAME` and `INFLUXDB_PASSWORD`

### CORS Errors
- Update `CORS_ORIGINS` to include your Railway domain
- Format: `https://your-app.railway.app` (no trailing slash)

### Health Check Fails
- Backend may not be able to reach InfluxDB from Railway
- Check Railway logs: `railway logs`
- Verify InfluxDB is running and accessible from external network

## Docker Build

Railway will automatically build from the `Dockerfile` in the root directory. Ensure:
- `Dockerfile` is in the root (it is)
- Backend dependencies are in `backend/requirements.txt` ✓
- Frontend is built before serving (handled by Dockerfile)

## Next Steps

1. Test locally first: `npm run dev` & backend running
2. Create Railway project with correct config
3. Deploy and verify health checks
4. Test login and bucket browsing
5. Monitor logs for any issues

---

**Note:** Keep `backend/.env` (local development) and `backend/.env.railway` configurations in sync, only changing the `INFLUXDB_URL` and environment-specific settings.
