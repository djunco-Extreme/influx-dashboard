#!/bin/bash
set -e

echo "🚀 InfluxDB Dashboard Setup"
echo "================================"

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
  echo "❌ Python 3.9+ not found. Please install it first."
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo "❌ Node.js 18+ not found. Please install it first."
  exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

echo "✓ Python $PYTHON_VERSION"
echo "✓ Node.js v$NODE_VERSION"

# Setup backend
echo ""
echo "🔧 Setting up backend..."
cd backend
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "  Created virtual environment"
fi

source .venv/bin/activate
pip install -q -r requirements.txt
echo "  ✓ Dependencies installed"

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ✓ Created .env (edit with your credentials)"
fi

cd ..

# Setup frontend
echo ""
echo "📦 Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install -q
  echo "  ✓ Dependencies installed"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Edit backend/.env with your InfluxDB credentials"
echo "  2. In terminal 1: cd backend && source .venv/bin/activate && python app.py"
echo "  3. In terminal 2: cd frontend && npm run dev"
echo "  4. Open http://localhost:5173"
echo ""
