@echo off
setlocal EnableExtensions

cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell was not found. Cannot open browser webcam check.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_webcams.ps1"
echo.
echo Browser webcam check opened. Allow camera permission in the browser to test webcams.
pause
