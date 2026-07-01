# InfluxDB Dashboard — Quick Start

## Prerequisites

- **Python 3.9+** — [Install Python](https://www.python.org/downloads/)
- **Node.js 18+** — [Install Node.js](https://nodejs.org/)
- **InfluxDB** accessible at `http://134.141.1.115:8086` (or configure your own)

## Setup (30 seconds)

### Automatic Setup (Recommended)

**macOS / Linux:**
```bash
bash scripts/setup.sh
```

**Windows:**
```cmd
scripts\setup.bat
```

This will:
1. Create a Python virtual environment
2. Install Python dependencies
3. Install Node.js dependencies
4. Create `.env` with default credentials

### Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

**Frontend:**
```bash
cd frontend
npm install
```

## Run

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python app.py
```

You should see:
```
Starting InfluxDB Dashboard API on :3001 (env=development)
Running on http://127.0.0.1:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
  ➜ Local:   http://localhost:5173/
  ➜ press h to show help
```

## Access

Open **http://localhost:5173** in your browser.

### Login

Use these credentials (default in `.env`):
- **Username:** `extreme`
- **Password:** `Extr3m3!`

Or leave both blank to use the server-configured credentials.

## Features

✅ **Bucket Discovery** — See all InfluxDB buckets  
✅ **Measurement Browser** — Explore measurements and fields  
✅ **Real-Time Charts** — Interactive line charts  
✅ **Dark Theme** — Grafana-style monitoring UI  
✅ **Responsive Design** — Works on desktop, tablet, mobile  

## Configuration

Edit `backend/.env` to customize:

| Setting | Default | Purpose |
| --- | --- | --- |
| `INFLUXDB_URL` | http://134.141.1.115:8086 | InfluxDB endpoint |
| `INFLUXDB_USERNAME` | extreme | InfluxDB username |
| `INFLUXDB_PASSWORD` | Extr3m3! | InfluxDB password |
| `API_PORT` | 3001 | Backend port |
| `CORS_ORIGINS` | http://localhost:5173 | Allowed frontend origins |

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python3 --version

# Reinstall dependencies
pip install -r backend/requirements.txt

# Check port 3001 isn't in use
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows
```

### Frontend shows blank page

```bash
# Check Node version
node --version

# Clear cache and reinstall
rm -rf frontend/node_modules frontend/dist
npm install --prefix frontend

# Check Vite is running
# You should see "Local: http://localhost:5173" in terminal
```

### "Failed to fetch buckets" error

1. Ensure InfluxDB is running at the configured URL
2. Check credentials in `backend/.env`
3. Verify backend is running (port 3001)
4. Check backend logs for errors

### "Authentication failed" on login

1. Verify `INFLUXDB_URL`, `INFLUXDB_USERNAME`, `INFLUXDB_PASSWORD` in `.env`
2. Test InfluxDB connectivity:
   ```bash
   curl http://134.141.1.115:8086/api/v2/health
   ```
3. Restart backend after changing credentials

## Next Steps

- **Production Deploy:** See [README.md](README.md) for Docker and production setup
- **Customize:** Edit React components in `frontend/src/` to add more panels
- **Query Editor:** Add custom Flux queries via `/api/query` endpoint

## Documentation

- **Full README:** [README.md](README.md)
- **API Routes:** See "API Routes" in README.md
- **Architecture:** See "Architecture" in README.md

## Support

For issues:
1. Check logs in terminals
2. Review [README.md](README.md) troubleshooting section
3. Check browser console (F12) for errors
4. Review `.env` configuration
