@echo off
REM ============================================================
REM NeuroPulse AI — Backend Startup Script (Windows)
REM ============================================================
REM This script activates the virtual environment and starts
REM the FastAPI backend with network sharing enabled.
REM ============================================================

echo [NeuroPulse] Starting backend...
echo.

REM Check if venv exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then: venv\Scripts\activate
    echo Then: pip install -r requirements.txt
    pause
    exit /b 1
)

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    call venv\Scripts\activate.ps1
)

REM Check if required packages are installed
python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo [WARN] Dependencies not installed. Running pip install...
    pip install -r requirements.txt
)

echo.
echo [NeuroPulse] Backend starting on http://0.0.0.0:8765
echo [NeuroPulse] API docs: http://0.0.0.0:8765/docs
echo [NeuroPulse] Press Ctrl+C to stop
echo.

REM Start uvicorn with network binding
uvicorn main:app --reload --port 8765 --host 0.0.0.0
