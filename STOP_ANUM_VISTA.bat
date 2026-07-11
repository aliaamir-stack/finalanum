@echo off
title Anum Vista - Stopping Servers
color 0C

echo.
echo  ============================================
echo   Stopping Anum Vista servers...
echo  ============================================
echo.

REM Kill processes on port 8000 (Backend)
echo  Stopping Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill processes on port 3000 (Frontend)
echo  Stopping Frontend (port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Also kill any leftover node/python windows by title
taskkill /FI "WINDOWTITLE eq Anum Vista Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Anum Vista Frontend" /F >nul 2>&1

echo.
echo  Servers stopped. Data is safely saved.
echo.
pause
