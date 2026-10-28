@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0DTS.exe" (
  echo DTS.exe is missing. Run scripts\build-desktop-launcher.ps1 to rebuild it.
  pause
  exit /b 1
)
start "" "%~dp0DTS.exe"
endlocal
