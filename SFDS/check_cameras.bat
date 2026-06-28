@echo off
setlocal EnableExtensions

cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell was not found. Cannot check camera health.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_cameras.ps1"
echo.
echo Camera check finished. You can close this window.
pause
