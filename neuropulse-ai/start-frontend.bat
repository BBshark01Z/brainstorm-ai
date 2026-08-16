@echo off
REM ============================================================
REM NeuroPulse AI — Frontend Startup Script (Windows)
REM ============================================================
REM This script starts the Next.js dev server with network
REM sharing enabled (0.0.0.0 binding).
REM ============================================================

echo [Brainstorm] Starting frontend...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARN] Dependencies not installed. Running npm install...
    echo.
    call npm install
    echo.
)

echo [Brainstorm] Frontend starting on http://0.0.0.0:3000
echo [Brainstorm] Press Ctrl+C to stop
echo.

REM Start Next.js with network binding
set HOST=0.0.0.0
set PORT=3000
call npm run dev
