@echo off
setlocal
title Document Tracking and Routing System
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.13 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)

set PORT=3000
if not defined HOST set HOST=127.0.0.1

rem Start the server in its own window (close that window to stop the server).
start "DTS Server" cmd /k node server.js

rem Wait up to 30 seconds for the server to answer, then open the browser.
set /a tries=0
:wait
set /a tries+=1
curl -s -o nul http://localhost:%PORT%/healthz
if not errorlevel 1 goto ready
if %tries% GEQ 30 goto ready
timeout /t 1 /nobreak >nul
goto wait

:ready
start "" http://localhost:%PORT%
endlocal
