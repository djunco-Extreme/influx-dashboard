@echo off
setlocal enabledelayedexpansion

echo 🚀 InfluxDB Dashboard Setup
echo ================================

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Python not found. Please install Python 3.9+ first.
  pause
  exit /b 1
)

REM Check Node
node --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js not found. Please install Node.js 18+ first.
  pause
  exit /b 1
)

echo ✓ Python and Node.js found

REM Setup backend
echo.
echo 🔧 Setting up backend...
cd backend

if not exist ".venv" (
  python -m venv .venv
  echo   Created virtual environment
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo   ✓ Dependencies installed

if not exist ".env" (
  copy .env.example .env
  echo   ✓ Created .env (edit with your credentials)
)

cd ..

REM Setup frontend
echo.
echo 📦 Setting up frontend...
cd frontend

if not exist "node_modules" (
  call npm install -q
  echo   ✓ Dependencies installed
)

cd ..

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo   1. Edit backend\.env with your InfluxDB credentials
echo   2. In terminal 1: cd backend ^&^& .venv\Scripts\activate.bat ^&^& python app.py
echo   3. In terminal 2: cd frontend ^&^& npm run dev
echo   4. Open http://localhost:5173
echo.
pause
