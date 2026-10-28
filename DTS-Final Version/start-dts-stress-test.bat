@echo off
setlocal
title DTS Stress Test - Port 3500
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13 or newer is required.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo Node.js 22.13 or newer is required.
  pause
  exit /b 1
)
echo DTS stress test - isolated database, enrolled staff, port 3500
echo Keep this window open while using the stress-test DTS.
echo.
node scripts\run-stress-test.js %*
set "DTS_STRESS_EXIT=%errorlevel%"
if not "%DTS_STRESS_EXIT%"=="0" pause
exit /b %DTS_STRESS_EXIT%
