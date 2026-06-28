@echo off
setlocal EnableExtensions

set "FRONTEND_DIR=%~1"

cd /d "%FRONTEND_DIR%"
if errorlevel 1 (
  echo [ERROR] Could not open frontend directory: %FRONTEND_DIR%
  pause
  exit /b 1
)

if "%SFDS_BACKEND_PORT%"=="" set "SFDS_BACKEND_PORT=9000"
if "%SFDS_BUN_PORT%"=="" set "SFDS_BUN_PORT=8080"

set "WS_HOST=0.0.0.0"
set "WS_PORT=%SFDS_BUN_PORT%"
if "%API_URL%"=="" set "API_URL=http://127.0.0.1:%SFDS_BACKEND_PORT%"
if "%VITE_API_URL%"=="" set "VITE_API_URL=%API_URL%"

bun run bun-ws.ts
