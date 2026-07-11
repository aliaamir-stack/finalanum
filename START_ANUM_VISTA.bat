@echo off
title Anum Vista - Property Management System
color 0A

echo.
echo  ============================================
echo   ANUM VISTA - Property Management System
echo  ============================================
echo.
echo  Starting servers... Please wait.
echo.

REM ── Find the local IP for LAN access ──
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

REM ── Start the Backend (FastAPI) ──
echo  [1/2] Starting Backend (FastAPI)...
start "Anum Vista Backend" /min cmd /k "cd /d %~dp0Anum-Vista-backend && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

REM ── Wait for backend to be ready ──
echo  Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

REM ── Start the Frontend (Next.js) ──
echo  [2/2] Starting Frontend (Next.js)...
start "Anum Vista Frontend" /min cmd /k "cd /d %~dp0Anum-Vista-frontend && npm run dev -- --hostname 0.0.0.0 --port 3000"

REM ── Wait for frontend to be ready ──
echo  Waiting for frontend to initialize...
timeout /t 8 /nobreak >nul

echo.
echo  ============================================
echo   SUCCESS! Anum Vista is running.
echo  ============================================
echo.
echo   This PC (Server):   http://localhost:3000
echo   Other Devices:      http://%LOCAL_IP%:3000
echo.
echo   Share the above address with all treasurers
echo   so they can open it in their browser.
echo.
echo   Backend API Docs:   http://localhost:8000/docs
echo.
echo  ============================================
echo   DO NOT CLOSE THIS WINDOW while using the app
echo  ============================================
echo.

REM ── Open browser on this PC ──
start http://localhost:3000

pause
