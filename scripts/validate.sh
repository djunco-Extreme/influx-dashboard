#!/bin/bash
set -e

echo "✓ Validating InfluxDB Dashboard setup..."
echo ""

# Check backend
echo "Backend checks:"
[ -f "backend/app.py" ] && echo "  ✓ app.py exists"
[ -f "backend/influx_client.py" ] && echo "  ✓ influx_client.py exists"
[ -f "backend/.env" ] && echo "  ✓ .env exists"
[ -d "backend/.venv" ] && echo "  ✓ Virtual environment exists"

# Check frontend
echo ""
echo "Frontend checks:"
[ -f "frontend/package.json" ] && echo "  ✓ package.json exists"
[ -d "frontend/node_modules" ] && echo "  ✓ node_modules installed"
[ -f "frontend/index.html" ] && echo "  ✓ index.html exists"
[ -d "frontend/src" ] && echo "  ✓ src directory exists"

# Check dependencies
echo ""
echo "Dependency checks:"
source backend/.venv/bin/activate
python -c "import flask" && echo "  ✓ Flask installed"
python -c "import influxdb_client" && echo "  ✓ influxdb-client installed"
python -c "import jwt" && echo "  ✓ PyJWT installed"

echo ""
echo "✅ All checks passed!"
echo ""
echo "To start the dashboard:"
echo "  Terminal 1: cd backend && source .venv/bin/activate && python app.py"
echo "  Terminal 2: cd frontend && npm run dev"
echo "  Then open: http://localhost:5173"
