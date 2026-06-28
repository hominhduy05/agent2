@echo off
setlocal EnableExtensions

set "FRONTEND_DIR=%~1"
set "NPM_CMD=%~2"
set "FRONTEND_SCRIPT=%~3"

cd /d "%FRONTEND_DIR%"
if errorlevel 1 (
  echo [ERROR] Could not open frontend directory: %FRONTEND_DIR%
  pause
  exit /b 1
)

if "%SFDS_SERVER_IP%"=="" set "SFDS_SERVER_IP=127.0.0.1"
if "%SFDS_BACKEND_PORT%"=="" set "SFDS_BACKEND_PORT=9000"
if "%SFDS_FRONTEND_PORT%"=="" set "SFDS_FRONTEND_PORT=3000"
if "%SFDS_BUN_PORT%"=="" set "SFDS_BUN_PORT=8080"

if "%NEXT_PUBLIC_API_URL%"=="" set "NEXT_PUBLIC_API_URL=http://%SFDS_SERVER_IP%:%SFDS_BACKEND_PORT%"
if "%NEXT_PUBLIC_WS_URL%"=="" set "NEXT_PUBLIC_WS_URL=ws://%SFDS_SERVER_IP%:%SFDS_BACKEND_PORT%"
if "%API_URL%"=="" set "API_URL=http://127.0.0.1:%SFDS_BACKEND_PORT%"
set "WS_HOST=0.0.0.0"
set "WS_PORT=%SFDS_BUN_PORT%"

if /I "%FRONTEND_SCRIPT%"=="dev:full" (
  call "%FRONTEND_DIR%\node_modules\.bin\concurrently.cmd" "next dev -H 0.0.0.0 -p %SFDS_FRONTEND_PORT%" "bun run bun-ws.ts"
) else (
  call "%FRONTEND_DIR%\node_modules\.bin\next.cmd" dev -H 0.0.0.0 -p "%SFDS_FRONTEND_PORT%"
)
