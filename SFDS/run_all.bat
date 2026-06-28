@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_DEPS_MARKER=%BACKEND_DIR%\.sfds_requirements.sha256"
set "FRONTEND_DEPS_MARKER=%FRONTEND_DIR%\.sfds_frontend_deps.sha256"
set "CONDA_ENV_NAME=admin"
if not "%SFDS_CONDA_ENV%"=="" set "CONDA_ENV_NAME=%SFDS_CONDA_ENV%"
set "CONDA_BAT="
if not "%SFDS_CONDA_BAT%"=="" if exist "%SFDS_CONDA_BAT%" set "CONDA_BAT=%SFDS_CONDA_BAT%"
set "NPM_CMD=npm.cmd"
set "HAVE_BUN="

title SFDS Setup and Launcher

echo.
echo ============================================================
echo  SFDS - Setup and run all services
echo ============================================================
echo.

if not defined CONDA_BAT for /f "delims=" %%C in ('where conda.bat 2^>nul') do (
  if not defined CONDA_BAT set "CONDA_BAT=%%C"
)

if not defined CONDA_BAT for /f "delims=" %%E in ('where conda.exe 2^>nul') do (
  if not defined CONDA_BAT if exist "%%~dpE..\condabin\conda.bat" (
    for %%D in ("%%~dpE..\condabin\conda.bat") do set "CONDA_BAT=%%~fD"
  )
)

if not defined CONDA_BAT if not "%CONDA_EXE%"=="" (
  for %%E in ("%CONDA_EXE%") do if exist "%%~dpE..\condabin\conda.bat" (
    for %%D in ("%%~dpE..\condabin\conda.bat") do set "CONDA_BAT=%%~fD"
  )
)
if not defined CONDA_BAT if exist "%USERPROFILE%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%USERPROFILE%\anaconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%USERPROFILE%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%USERPROFILE%\miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%USERPROFILE%\anaconda3\Library\bin\conda.bat" set "CONDA_BAT=%USERPROFILE%\anaconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%USERPROFILE%\miniconda3\Library\bin\conda.bat" set "CONDA_BAT=%USERPROFILE%\miniconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%LOCALAPPDATA%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%LOCALAPPDATA%\anaconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%LOCALAPPDATA%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%LOCALAPPDATA%\miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%LOCALAPPDATA%\anaconda3\Library\bin\conda.bat" set "CONDA_BAT=%LOCALAPPDATA%\anaconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%LOCALAPPDATA%\miniconda3\Library\bin\conda.bat" set "CONDA_BAT=%LOCALAPPDATA%\miniconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramData%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%ProgramData%\anaconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramData%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%ProgramData%\miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramData%\anaconda3\Library\bin\conda.bat" set "CONDA_BAT=%ProgramData%\anaconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramData%\miniconda3\Library\bin\conda.bat" set "CONDA_BAT=%ProgramData%\miniconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "C:\anaconda3\condabin\conda.bat" set "CONDA_BAT=C:\anaconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "C:\miniconda3\condabin\conda.bat" set "CONDA_BAT=C:\miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "C:\anaconda3\Library\bin\conda.bat" set "CONDA_BAT=C:\anaconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "C:\miniconda3\Library\bin\conda.bat" set "CONDA_BAT=C:\miniconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramFiles%\Anaconda3\condabin\conda.bat" set "CONDA_BAT=%ProgramFiles%\Anaconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramFiles%\Miniconda3\condabin\conda.bat" set "CONDA_BAT=%ProgramFiles%\Miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramFiles%\Anaconda3\Library\bin\conda.bat" set "CONDA_BAT=%ProgramFiles%\Anaconda3\Library\bin\conda.bat"
if not defined CONDA_BAT if exist "%ProgramFiles%\Miniconda3\Library\bin\conda.bat" set "CONDA_BAT=%ProgramFiles%\Miniconda3\Library\bin\conda.bat"

if not defined CONDA_BAT (
  echo [ERROR] Conda was not found.
  echo Please install Anaconda or Miniconda, then run this file again.
  echo If Conda is installed in a custom location, run:
  echo set "SFDS_CONDA_BAT=C:\Path\To\anaconda3\condabin\conda.bat"
  echo run_all.bat
  echo.
  pause
  exit /b 1
)

echo Conda launcher: %CONDA_BAT%

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell was not found.
  echo This launcher uses PowerShell only to hash dependency files.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 18 or newer, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0] >= 18 ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18 or newer is required.
  echo Please install Node.js 18+, then run this file again.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please reinstall Node.js with npm enabled, then run this file again.
  echo.
  pause
  exit /b 1
)

call %NPM_CMD% --version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was found but is not working correctly.
  echo Please reinstall Node.js with npm enabled, then run this file again.
  echo.
  pause
  exit /b 1
)

where bun >nul 2>nul
if not errorlevel 1 set "HAVE_BUN=1"

echo [1/4] Preparing Conda backend environment: %CONDA_ENV_NAME%
call "%CONDA_BAT%" run -n "%CONDA_ENV_NAME%" python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
  echo Conda environment "%CONDA_ENV_NAME%" was not found or has Python older than 3.10.
  echo Creating "%CONDA_ENV_NAME%" with Python 3.11...
  call "%CONDA_BAT%" create -y -n "%CONDA_ENV_NAME%" python=3.11
  if errorlevel 1 (
    echo [ERROR] Could not create Conda environment "%CONDA_ENV_NAME%".
    pause
    exit /b 1
  )
)

set "REQ_HASH="
for /f "usebackq delims=" %%H in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -LiteralPath '%BACKEND_DIR%\requirements.txt' -Algorithm SHA256).Hash"`) do set "REQ_HASH=%%H"

set "BACKEND_DEPS_READY="
if defined REQ_HASH if exist "%BACKEND_DEPS_MARKER%" (
  set /p OLD_REQ_HASH=<"%BACKEND_DEPS_MARKER%"
  if /I "!OLD_REQ_HASH!"=="!REQ_HASH!" set "BACKEND_DEPS_READY=1"
)

if defined BACKEND_DEPS_READY (
  echo [2/4] Backend dependencies are already up to date.
) else (
  echo [2/4] Installing backend dependencies...
  pushd "%BACKEND_DIR%"
  call "%CONDA_BAT%" run -n "%CONDA_ENV_NAME%" python -m pip install --upgrade pip
  if errorlevel 1 (
    echo [ERROR] pip upgrade failed.
    popd
    pause
    exit /b 1
  )

  call "%CONDA_BAT%" run -n "%CONDA_ENV_NAME%" python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] Backend dependency installation failed.
    popd
    pause
    exit /b 1
  )
  popd

  if defined REQ_HASH >"%BACKEND_DEPS_MARKER%" echo !REQ_HASH!
)

set "MODEL_FOUND="
for %%M in (
  durian_yolo26m_seg.pt
  durian_yolov8.pt
  durian_yolo26m_seg.onnx
  durian_yolov8.onnx
  durian_yolo26m_seg.engine
) do (
  if exist "%BACKEND_DIR%\model\%%M" set "MODEL_FOUND=1"
)

if not defined MODEL_FOUND (
  echo [WARN] No YOLO model was found in backend\model.
  echo Detection will not work until a model file is added or DURIAN_MODEL_PATH is set.
  echo.
)

set "FRONTEND_LOCK_FILE=%FRONTEND_DIR%\package.json"
if exist "%FRONTEND_DIR%\package-lock.json" set "FRONTEND_LOCK_FILE=%FRONTEND_DIR%\package-lock.json"

set "FRONTEND_HASH="
for /f "usebackq delims=" %%H in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -LiteralPath '%FRONTEND_LOCK_FILE%' -Algorithm SHA256).Hash"`) do set "FRONTEND_HASH=%%H"

set "FRONTEND_DEPS_READY="
if exist "%FRONTEND_DIR%\node_modules" if defined FRONTEND_HASH if exist "%FRONTEND_DEPS_MARKER%" (
  set /p OLD_FRONTEND_HASH=<"%FRONTEND_DEPS_MARKER%"
  if /I "!OLD_FRONTEND_HASH!"=="!FRONTEND_HASH!" set "FRONTEND_DEPS_READY=1"
)

if defined FRONTEND_DEPS_READY (
  echo [3/4] Frontend dependencies are already up to date.
) else (
  echo [3/4] Installing frontend dependencies...
  pushd "%FRONTEND_DIR%"
  if exist package-lock.json (
    if not exist node_modules (
      call %NPM_CMD% ci
    ) else (
      call %NPM_CMD% install
    )
  ) else (
    call %NPM_CMD% install
  )
  if errorlevel 1 (
    echo [ERROR] Frontend dependency installation failed.
    popd
    pause
    exit /b 1
  )
  popd

  if defined FRONTEND_HASH >"%FRONTEND_DEPS_MARKER%" echo !FRONTEND_HASH!
)

if defined HAVE_BUN (
  set "FRONTEND_SCRIPT=dev:full"
) else (
  set "FRONTEND_SCRIPT=dev"
  echo [WARN] Bun was not found. The app will run without the extra WebSocket proxy on port 8080.
  echo Install Bun if webcam/dataset realtime detection needs ws://localhost:8080.
  echo.
)

echo [4/4] Starting services...
echo.
echo Backend:  http://127.0.0.1:9000/health/
echo Frontend: http://localhost:3000
if defined HAVE_BUN echo WebSocket: ws://localhost:8080
echo.

start "SFDS Backend API" "%COMSPEC%" /k call "%ROOT%start_backend.bat" "%CONDA_BAT%" "%CONDA_ENV_NAME%" "%BACKEND_DIR%"
timeout /t 3 /nobreak >nul
start "SFDS Frontend" "%COMSPEC%" /k call "%ROOT%start_frontend.bat" "%FRONTEND_DIR%" "%NPM_CMD%" "%FRONTEND_SCRIPT%"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo SFDS is starting in separate windows.
echo Backend is using Conda environment "%CONDA_ENV_NAME%".
if defined HAVE_BUN echo Frontend is running "%FRONTEND_SCRIPT%" with Bun WebSocket support.
if not defined HAVE_BUN echo Frontend is running "%FRONTEND_SCRIPT%" without Bun WebSocket support.
echo Keep those windows open while using the app.
echo.
pause
