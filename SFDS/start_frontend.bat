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

set "NEXT_PUBLIC_API_URL=http://localhost:9000"
set "NEXT_PUBLIC_WS_URL=ws://localhost:8080"
set "API_URL=http://127.0.0.1:9000"

call %NPM_CMD% run %FRONTEND_SCRIPT%
