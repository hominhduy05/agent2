@echo off
setlocal EnableExtensions

set "CONDA_BAT=%~1"
set "CONDA_ENV_NAME=%~2"
set "BACKEND_DIR=%~3"

call "%CONDA_BAT%" activate "%CONDA_ENV_NAME%"
if errorlevel 1 (
  echo [ERROR] Could not activate Conda environment "%CONDA_ENV_NAME%".
  pause
  exit /b 1
)

cd /d "%BACKEND_DIR%"
if errorlevel 1 (
  echo [ERROR] Could not open backend directory: %BACKEND_DIR%
  pause
  exit /b 1
)

set "YOLO_CONFIG_DIR=%BACKEND_DIR%\.ultralytics"
set "ULTRALYTICS_SKIP_REQUIREMENTS_CHECKS=1"
if "%DURIAN_DEVICE%"=="" set "DURIAN_DEVICE=auto"
if "%SFDS_BACKEND_HOST%"=="" set "SFDS_BACKEND_HOST=0.0.0.0"
if "%SFDS_BACKEND_PORT%"=="" set "SFDS_BACKEND_PORT=9000"
if "%SFDS_BACKEND_RELOAD%"=="" set "SFDS_BACKEND_RELOAD=0"

if "%SFDS_BACKEND_RELOAD%"=="1" (
  python -m uvicorn main:app --host "%SFDS_BACKEND_HOST%" --port "%SFDS_BACKEND_PORT%" --reload
) else (
  python -m uvicorn main:app --host "%SFDS_BACKEND_HOST%" --port "%SFDS_BACKEND_PORT%"
)
