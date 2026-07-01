# InfluxDB Dashboard

A production-ready, Grafana-inspired monitoring dashboard for InfluxDB. Built with Flask (backend) and React (frontend).

## Features

- **InfluxDB Integration** — Direct connection to InfluxDB with authentication
- **Bucket Discovery** — Automatically discovers and lists all accessible buckets
- **Measurement Metadata** — Extracts and displays fields, tags, and measurement info
- **Time-Series Charts** — Interactive line charts with real-time data visualization
- **Dark Theme** — Grafana-style dark monitoring UI (Tailwind CSS)
- **Responsive Grid** — Adapts to desktop, tablet, and mobile screens
- **Session Management** — Secure JWT-based authentication with httpOnly cookies
- **Server-Side Caching** — 5-minute TTL cache for efficient data fetching
- **Error Handling** — Graceful error states and user feedback

## Architecture

```
Browser (React)  ──►  Vite dev proxy  ──►  Flask API (/api/*)  ──►  InfluxDB
   no secrets         (same origin)      credentials in env        TCP/HTTP
```

Credentials are read server-side only and never sent to the browser.

## Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **InfluxDB** running at `http://134.141.1.115:8086` (or configured endpoint)

## Quick Start

### 1. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # Edit .env with your InfluxDB credentials
python app.py               # Runs on http://localhost:3001
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev                 # Runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies `/api` to the backend, so you see a single origin.

## Configuration

### Backend Environment Variables (`backend/.env`)

| Variable             | Default                   | Description                              |
| -------------------- | ------------------------- | ---------------------------------------- |
| `INFLUXDB_URL`       | http://134.141.1.115:8086 | InfluxDB server URL                      |
| `INFLUXDB_USERNAME`  | extreme                   | InfluxDB username (server-side only)     |
| `INFLUXDB_PASSWORD`  | Extr3m3!                  | InfluxDB password (server-side only)     |
| `INFLUXDB_ORG`       | (empty)                   | InfluxDB organization (optional)         |
| `INFLUXDB_TOKEN`     | (empty)                   | InfluxDB API token (alternative auth)    |
| `JWT_SECRET`         | change-me-in-production   | Secret for signing session JWTs          |
| `SESSION_TTL_HOURS`  | 8                         | Session lifetime in hours                |
| `CACHE_TTL_SECONDS`  | 300                       | Server cache TTL (5 min)                 |
| `API_PORT`           | 3001                      | Backend listen port                      |
| `FLASK_ENV`          | development               | `development` or `production`            |
| `CORS_ORIGINS`       | localhost:5173            | Allowed frontend origins (comma-separated) |
| `BASIC_AUTH_USER`    | (empty)                   | HTTP Basic auth username (optional gate) |
| `BASIC_AUTH_PASSWORD`| (empty)                   | HTTP Basic auth password (optional gate) |

**Security notes:**

- **Never commit the real `.env` file** — it's in `.gitignore`
- Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` on any public deployment (except `/api/health`)
- In production, set `FLASK_ENV=production` to enforce HTTPS cookies

## API Routes

### Public

| Method | Route         | Auth | Description          |
| ------ | ------------- | ---- | -------------------- |
| GET    | `/api/health` | no   | Health check         |

### Authentication

| Method | Route              | Auth | Description                      |
| ------ | ------------------ | ---- | -------------------------------- |
| POST   | `/api/login`       | no   | Login with username/password     |
| POST   | `/api/logout`      | no   | Logout (clears session cookie)   |
| GET    | `/api/auth/session`| no   | Current session state            |

### Protected (require valid session JWT)

| Method | Route                                              | Description                  |
| ------ | -------------------------------------------------- | ---------------------------- |
| GET    | `/api/buckets`                                     | List all buckets             |
| GET    | `/api/buckets/{bucket}/measurements`               | List measurements in bucket  |
| GET    | `/api/buckets/{bucket}/measurements/{m}/metadata` | Field/tag keys for measurement |
| GET    | `/api/buckets/{bucket}/measurements/{m}/data`     | Recent data points           |
| POST   | `/api/query`                                       | Execute custom Flux query    |

## Usage

### Login

1. Click **Sign in** at the login screen
2. Enter InfluxDB credentials or leave blank to use server-configured credentials
3. On success, redirected to the dashboard

### Browse Buckets

The dashboard shows all accessible buckets as cards. Click a bucket to explore its measurements.

### View Measurements

Each bucket displays its measurements with:
- **Line chart** showing recent data points
- **Field selector** to isolate specific fields
- **Stats** (Latest, Avg, Max, Min values)

## Project Layout

```
influx-dashboard/
├── backend/
│   ├── app.py                   Flask API routes
│   ├── influx_client.py         InfluxDB client utilities
│   ├── auth.py                  JWT session management
│   ├── cache.py                 In-memory cache with TTL
│   ├── config.py                Environment-driven config
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx             React entry point
│   │   ├── App.jsx              Route & auth wrapper
│   │   ├── index.css            Global styles (Tailwind)
│   │   ├── pages/
│   │   │   ├── Login.jsx        Login form
│   │   │   └── Dashboard.jsx    Main dashboard
│   │   └── components/
│   │       ├── Navbar.jsx       Top bar (refresh, logout)
│   │       ├── Sidebar.jsx      Left nav
│   │       ├── BucketList.jsx   Bucket cards
│   │       ├── BucketDetail.jsx Bucket view
│   │       ├── MeasurementPanel.jsx Data & chart
│   │       ├── Spinner.jsx      Loading indicator
│   │       └── ErrorNotice.jsx  Error banner
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── README.md
└── .gitignore
```

## Development

### Running Locally

**Terminal 1** — Backend:
```bash
cd backend
source .venv/bin/activate
python app.py
```

**Terminal 2** — Frontend:
```bash
cd frontend
npm run dev
```

**Terminal 3** (optional) — View backend logs:
```bash
tail -f backend/app.log
```

### Making Changes

- **Backend**: Edit Python files and refresh the browser (Flask auto-reloads)
- **Frontend**: Edit React/JSX files and Vite auto-refreshes the browser
- **Styles**: Tailwind CSS is processed automatically

## Production Build

### Frontend

```bash
cd frontend
npm run build          # Outputs to frontend/dist/
```

### Single-Service Deploy

Combine frontend and backend into one service:

```bash
# Build frontend
cd frontend && npm run build

# Set env vars and run Flask with built frontend
export FRONTEND_DIST=$(pwd)/frontend/dist
export FLASK_ENV=production
export JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
cd backend && python app.py
```

Serve the Flask app on port 3001. All routes (static + API) are served from the same origin.

### Docker

Example Dockerfile for production:

```dockerfile
FROM python:3.11-slim as backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend .

FROM node:18-slim as frontend
WORKDIR /app
COPY frontend/package*.json .
RUN npm install
COPY frontend .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY --from=backend /app .
COPY --from=frontend /app/dist /app/frontend-dist
ENV FRONTEND_DIST=/app/frontend-dist
ENV FLASK_ENV=production
EXPOSE 3001
CMD ["gunicorn", "-b", "0.0.0.0:3001", "app:app"]
```

## Security

### Authentication

- Credentials are validated server-side and never exposed to the browser
- Session JWT stored in **httpOnly** cookie (not `localStorage`)
- CORS restricted to configured origins
- Input validation on all endpoints

### Secrets Management

- `.env` is in `.gitignore` — never committed
- Use strong `JWT_SECRET` in production
- Set `BASIC_AUTH_USER` + `BASIC_AUTH_PASSWORD` as perimeter gate on public deployments
- Use HTTPS (`secure` cookie flag) in production

### InfluxDB Token Auth

If using token-based auth instead of username/password:

1. Generate a token in InfluxDB UI
2. Set `INFLUXDB_TOKEN` in `.env`
3. Leave `INFLUXDB_USERNAME` and `INFLUXDB_PASSWORD` empty

## Troubleshooting

### "InfluxDB health check failed"

- Ensure InfluxDB is running at the configured URL
- Check credentials and network connectivity
- Verify `INFLUXDB_ORG` if your instance requires it

### "Failed to fetch buckets"

- Confirm the session is valid (check `/api/auth/session`)
- Check backend logs for Flux query errors
- Ensure the authenticated user has bucket read permissions

### CORS errors in browser console

- Add your frontend origin to `CORS_ORIGINS` in `.env`
- Restart the backend

### Vite dev server won't start

- Ensure port 5173 is available
- Check `npm install` completed successfully
- Try removing `node_modules` and reinstalling

## Testing

### Backend Health Check

```bash
curl http://localhost:3001/api/health
```

### Login

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "extreme", "password": "Extr3m3!"}'
```

### List Buckets

```bash
curl -b cookies.txt http://localhost:3001/api/buckets
```

## License

[Your License Here]

## Support

For issues, questions, or contributions, please open an issue or contact the development team.
