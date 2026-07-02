@echo off
setlocal EnableExtensions

cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sfds.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERROR] SFDS command failed.
  echo.
  if "%SFDS_NO_PAUSE%"=="" pause
  exit /b 1
)
