param(
  [ValidateSet("server", "dev", "db-up", "db-down", "db-restart", "db-status", "db-logs", "backup", "restore", "image-save", "image-load", "native-setup", "camera-check", "webcam-check")]
  [string]$Action = "server",
  [string]$EnvFile = "docker/postgres.env.example",
  [string]$Container = "",
  [string]$Database = "",
  [string]$User = "",
  [string]$Password = "",
  [string]$OutputDir = "D:\sfds_backups",
  [string]$BackupFile = "",
  [string]$Image = "",
  [string]$TarPath = "D:\sfds_offline_images\postgres-16-alpine.tar",
  [string]$AdminUser = "postgres",
  [int]$TimeoutSeconds = 90,
  [switch]$FollowLogs,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "docker-compose.postgres.yml"
$EnvPath = Join-Path $ProjectRoot $EnvFile
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$BackendDepsMarker = Join-Path $BackendDir ".sfds_requirements.sha256"
$FrontendDepsMarker = Join-Path $FrontendDir ".sfds_frontend_deps.sha256"
$LaunchInfoPath = Join-Path $ProjectRoot "sfds_launch_info.txt"
$PostgresStatePath = Join-Path $ProjectRoot ".sfds_postgres.local.env"
$PostgresNeedsRecreate = $false

function Import-SfdsEnvFile {
  param(
    [string]$Path,
    [switch]$Override
  )

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "=") {
      return
    }

    $key, $value = $line.Split("=", 2)
    $key = $key.Trim()
    $value = $value.Trim().Trim('"')
    if ($key -and ($Override -or -not [Environment]::GetEnvironmentVariable($key, "Process"))) {
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

function Get-SfdsLanIp {
  $nics = [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()

  foreach ($nic in $nics) {
    if ($nic.OperationalStatus -ne "Up" -or $nic.NetworkInterfaceType -eq "Loopback") {
      continue
    }

    $props = $nic.GetIPProperties()
    if ($props.GatewayAddresses.Count -lt 1) {
      continue
    }

    foreach ($addr in $props.UnicastAddresses) {
      if ($addr.Address.AddressFamily -eq "InterNetwork") {
        $ip = $addr.Address.ToString()
        if ($ip -notlike "169.254*") {
          return $ip
        }
      }
    }
  }

  foreach ($nic in $nics) {
    if ($nic.OperationalStatus -ne "Up" -or $nic.NetworkInterfaceType -eq "Loopback") {
      continue
    }

    foreach ($addr in $nic.GetIPProperties().UnicastAddresses) {
      if ($addr.Address.AddressFamily -eq "InterNetwork") {
        $ip = $addr.Address.ToString()
        if ($ip -notlike "169.254*" -and $ip -notlike "127.*") {
          return $ip
        }
      }
    }
  }

  return "127.0.0.1"
}

function Get-SfdsFreePort {
  param([int]$Port)

  if ($Port -lt 1) {
    $Port = 3000
  }

  $startPort = $Port
  while ($Port -le 65535) {
    $listener = $null
    try {
      $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
      $listener.Start()
      return $Port
    } catch {
      $Port += 1
    } finally {
      if ($listener) {
        $listener.Stop()
      }
    }
  }

  throw "No free TCP port found from $startPort."
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-FirstExistingPath {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    if ($path -and (Test-Path $path)) {
      return (Resolve-Path $path).Path
    }
  }

  return ""
}

function Find-CondaBat {
  if ($env:SFDS_CONDA_BAT -and (Test-Path $env:SFDS_CONDA_BAT)) {
    return (Resolve-Path $env:SFDS_CONDA_BAT).Path
  }

  $command = Get-Command "conda.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) {
    return $command.Source
  }

  $condaExe = Get-Command "conda.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($condaExe) {
    $candidate = Join-Path (Split-Path -Parent (Split-Path -Parent $condaExe.Source)) "condabin\conda.bat"
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  if ($env:CONDA_EXE) {
    $candidate = Join-Path (Split-Path -Parent (Split-Path -Parent $env:CONDA_EXE)) "condabin\conda.bat"
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  return Get-FirstExistingPath -Paths @(
    "$env:USERPROFILE\anaconda3\condabin\conda.bat",
    "$env:USERPROFILE\miniconda3\condabin\conda.bat",
    "$env:USERPROFILE\anaconda3\Library\bin\conda.bat",
    "$env:USERPROFILE\miniconda3\Library\bin\conda.bat",
    "$env:LOCALAPPDATA\anaconda3\condabin\conda.bat",
    "$env:LOCALAPPDATA\miniconda3\condabin\conda.bat",
    "$env:LOCALAPPDATA\anaconda3\Library\bin\conda.bat",
    "$env:LOCALAPPDATA\miniconda3\Library\bin\conda.bat",
    "$env:ProgramData\anaconda3\condabin\conda.bat",
    "$env:ProgramData\miniconda3\condabin\conda.bat",
    "$env:ProgramData\anaconda3\Library\bin\conda.bat",
    "$env:ProgramData\miniconda3\Library\bin\conda.bat",
    "C:\anaconda3\condabin\conda.bat",
    "C:\miniconda3\condabin\conda.bat",
    "C:\anaconda3\Library\bin\conda.bat",
    "C:\miniconda3\Library\bin\conda.bat",
    "$env:ProgramFiles\Anaconda3\condabin\conda.bat",
    "$env:ProgramFiles\Miniconda3\condabin\conda.bat",
    "$env:ProgramFiles\Anaconda3\Library\bin\conda.bat",
    "$env:ProgramFiles\Miniconda3\Library\bin\conda.bat"
  )
}

function Invoke-Checked {
  param(
    [scriptblock]$Command,
    [string]$ErrorMessage
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $ErrorMessage
  }
}

function Set-ProcessEnv {
  param(
    [string]$Name,
    [string]$Value
  )

  [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Start-CmdWindow {
  param(
    [string]$Title,
    [string]$Command,
    [string]$WorkingDirectory
  )

  $argument = "/k title $Title && cd /d `"$WorkingDirectory`" && $Command"
  Start-Process -FilePath $env:COMSPEC -ArgumentList $argument -WindowStyle Normal
}

function Get-SfdsConfig {
  Import-SfdsEnvFile -Path $EnvPath
  Import-SfdsEnvFile -Path $PostgresStatePath -Override

  $script:DbContainer = if ($Container) { $Container } else { $env:SFDS_POSTGRES_CONTAINER }
  if (-not $script:DbContainer) { $script:DbContainer = "sfds_postgres" }

  $script:DbName = if ($Database) { $Database } else { $env:SFDS_POSTGRES_DB }
  if (-not $script:DbName) { $script:DbName = "sfds_offline" }

  $script:DbUser = if ($User) { $User } else { $env:SFDS_POSTGRES_USER }
  if (-not $script:DbUser) { $script:DbUser = "sfds_app" }

  $script:DbPassword = if ($Password) { $Password } else { $env:SFDS_POSTGRES_PASSWORD }
  if (-not $script:DbPassword) { $script:DbPassword = "change_this_password" }

  $script:DbHost = if ($env:SFDS_POSTGRES_HOST) { $env:SFDS_POSTGRES_HOST } else { "127.0.0.1" }
  $script:DbPort = if ($env:SFDS_POSTGRES_PORT) { $env:SFDS_POSTGRES_PORT } else { "5432" }

  $script:PostgresImage = if ($Image) { $Image } else { $env:SFDS_POSTGRES_IMAGE }
  if (-not $script:PostgresImage) { $script:PostgresImage = "postgres:16-alpine" }
}

function Test-HostPortAvailable {
  param(
    [string]$BindAddress,
    [int]$Port
  )

  $listener = $null
  try {
    $address = if ($BindAddress -eq "0.0.0.0") {
      [Net.IPAddress]::Any
    } else {
      [Net.IPAddress]::Parse($BindAddress)
    }
    $listener = [Net.Sockets.TcpListener]::new($address, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Get-PostgresPublishedPort {
  try {
    $running = docker inspect --format "{{.State.Running}}" $script:DbContainer 2>$null
    if ($LASTEXITCODE -ne 0 -or $running.Trim() -ne "true") {
      return $null
    }

    $portLine = docker port $script:DbContainer 5432/tcp 2>$null | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or -not $portLine) {
      return $null
    }

    if ($portLine -match ":(\d+)$") {
      return [int]$Matches[1]
    }
  } catch {
    return $null
  }

  return $null
}

function Get-PostgresConfiguredPort {
  try {
    $portBindingsJson = docker inspect --format "{{json .HostConfig.PortBindings}}" $script:DbContainer 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $portBindingsJson) {
      return $null
    }

    $portBindings = $portBindingsJson | ConvertFrom-Json
    if (-not $portBindings) {
      return $null
    }

    $binding = $portBindings.'5432/tcp' | Select-Object -First 1
    if (-not $binding -or -not $binding.HostPort) {
      return $null
    }

    return [int]$binding.HostPort
  } catch {
    return $null
  }
}

function Set-ResolvedPostgresPort {
  param(
    [string]$BindAddress,
    [int]$Port,
    [switch]$Persist
  )

  $env:SFDS_POSTGRES_BIND = $BindAddress
  $env:SFDS_POSTGRES_PORT = [string]$Port
  $env:SFDS_DATABASE_URL = "postgresql+psycopg://{0}:{1}@127.0.0.1:{2}/{3}" -f $script:DbUser, $script:DbPassword, $Port, $script:DbName
  $script:DbHost = "127.0.0.1"
  $script:DbPort = [string]$Port

  if ($Persist) {
    Save-PostgresPortState -BindAddress $BindAddress -Port $Port
  }
}

function Save-PostgresPortState {
  param(
    [string]$BindAddress,
    [int]$Port
  )

  $lines = @(
    "# Local SFDS PostgreSQL port state. This keeps the Docker host port stable across terminal restarts.",
    "# Safe to delete if you intentionally want SFDS to pick a new free PostgreSQL port.",
    "SFDS_POSTGRES_BIND=$BindAddress",
    "SFDS_POSTGRES_PORT=$Port"
  )
  Set-Content -LiteralPath $PostgresStatePath -Value $lines
}

function Get-SavedPostgresPort {
  if (-not (Test-Path $PostgresStatePath)) {
    return $null
  }

  foreach ($line in Get-Content $PostgresStatePath) {
    $trimmed = $line.Trim()
    if ($trimmed -match "^SFDS_POSTGRES_PORT=(\d+)$") {
      return [int]$Matches[1]
    }
  }

  return $null
}

function Resolve-PostgresPort {
  $script:PostgresNeedsRecreate = $false
  $bind = if ($env:SFDS_POSTGRES_BIND) { $env:SFDS_POSTGRES_BIND } else { "127.0.0.1" }
  $startPort = [int]$script:DbPort
  $savedPort = Get-SavedPostgresPort

  $publishedPort = Get-PostgresPublishedPort
  if ($null -ne $publishedPort) {
    if ($null -ne $savedPort -and $publishedPort -ne $savedPort) {
      if (-not (Test-HostPortAvailable -BindAddress $bind -Port $savedPort)) {
        throw "PostgreSQL is currently published on port $publishedPort, but the saved SFDS port is $savedPort and that saved port is not available. Free port $savedPort first, or delete $PostgresStatePath if you intentionally want to keep using $publishedPort."
      }

      Write-Host "[SFDS] PostgreSQL container is on port $publishedPort, but saved port is $savedPort. Recreating container on $savedPort while keeping the data volume."
      Set-ResolvedPostgresPort -BindAddress $bind -Port $savedPort -Persist
      $script:PostgresNeedsRecreate = $true
      return
    }

    Write-Host "[SFDS] Reusing running PostgreSQL container on port $publishedPort."
    Set-ResolvedPostgresPort -BindAddress $bind -Port $publishedPort -Persist
    return
  }

  $configuredPort = Get-PostgresConfiguredPort
  if ($null -ne $configuredPort) {
    if ($null -ne $savedPort -and $configuredPort -ne $savedPort) {
      if (-not (Test-HostPortAvailable -BindAddress $bind -Port $savedPort)) {
        throw "PostgreSQL container is configured on port $configuredPort, but the saved SFDS port is $savedPort and that saved port is not available. Free port $savedPort first, or delete $PostgresStatePath if you intentionally want to keep using $configuredPort."
      }

      Write-Host "[SFDS] PostgreSQL container is configured on port $configuredPort, but saved port is $savedPort. Recreating container on $savedPort while keeping the data volume."
      Set-ResolvedPostgresPort -BindAddress $bind -Port $savedPort -Persist
      $script:PostgresNeedsRecreate = $true
      return
    }

    Write-Host "[SFDS] Reusing existing PostgreSQL container configuration on port $configuredPort."
    Set-ResolvedPostgresPort -BindAddress $bind -Port $configuredPort -Persist
    return
  }

  if (Test-HostPortAvailable -BindAddress $bind -Port $startPort) {
    Set-ResolvedPostgresPort -BindAddress $bind -Port $startPort -Persist
    return
  }

  if ($null -ne $savedPort -and $startPort -eq $savedPort -and -not $Force) {
    throw "Saved PostgreSQL port $savedPort is busy, but no existing Docker container port could be confirmed. SFDS will not auto-switch ports because that can look like a new database. Start Docker Desktop and rerun, free port $savedPort, or run with -Force if you intentionally want SFDS to pick a new port."
  }

  for ($port = 5433; $port -le 5499; $port++) {
    if (Test-HostPortAvailable -BindAddress $bind -Port $port) {
      Write-Host "[SFDS] PostgreSQL host port $startPort is not available. Using $port and saving it for later runs."
      Set-ResolvedPostgresPort -BindAddress $bind -Port $port -Persist
      return
    }
  }

  throw "No free PostgreSQL host port found from 5432 to 5499."
}

function Get-ComposeArgs {
  $args = @("compose")
  if (Test-Path $EnvPath) {
    $args += @("--env-file", $EnvPath)
  }
  $args += @("-f", $ComposeFile)
  return $args
}

function Invoke-Compose {
  param([string[]]$ComposeCommandArgs)

  if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
  }

  Push-Location $ProjectRoot
  try {
    docker @ComposeCommandArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Docker command failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

function Wait-PostgresHealthy {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $status = ""
    try {
      $status = docker inspect --format "{{.State.Health.Status}}" $script:DbContainer 2>$null
    } catch {
      $status = ""
    }

    if ($status -eq "healthy") {
      Write-Host "[SFDS] PostgreSQL is healthy."
      return
    }

    if ($status -eq "unhealthy") {
      throw "PostgreSQL healthcheck is unhealthy."
    }

    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for PostgreSQL container health."
}

function Set-BackendPostgresEnv {
  $env:SFDS_DB_BACKEND = "postgresql"
  $env:SFDS_POSTGRES_HOST = $script:DbHost
  $env:SFDS_POSTGRES_PORT = $script:DbPort
  if (-not $env:SFDS_POSTGRES_DB) { $env:SFDS_POSTGRES_DB = $script:DbName }
  if (-not $env:SFDS_POSTGRES_USER) { $env:SFDS_POSTGRES_USER = $script:DbUser }
  if (-not $env:SFDS_POSTGRES_PASSWORD) { $env:SFDS_POSTGRES_PASSWORD = $script:DbPassword }
  $env:SFDS_DATABASE_URL = "postgresql+psycopg://$($env:SFDS_POSTGRES_USER):$($env:SFDS_POSTGRES_PASSWORD)@$($env:SFDS_POSTGRES_HOST):$($env:SFDS_POSTGRES_PORT)/$($env:SFDS_POSTGRES_DB)"
}

function Add-SfdsFirewallRules {
  if (Test-IsAdministrator) {
    netsh advfirewall firewall add rule name="SFDS Backend $env:SFDS_BACKEND_PORT" dir=in action=allow protocol=TCP localport=$env:SFDS_BACKEND_PORT | Out-Null
    netsh advfirewall firewall add rule name="SFDS Frontend $env:SFDS_FRONTEND_PORT" dir=in action=allow protocol=TCP localport=$env:SFDS_FRONTEND_PORT | Out-Null
    if ($script:HaveBun) {
      netsh advfirewall firewall add rule name="SFDS Bun Proxy $env:SFDS_BUN_PORT" dir=in action=allow protocol=TCP localport=$env:SFDS_BUN_PORT | Out-Null
    }
    return
  }

  Write-Host "[WARN] This launcher is not running as Administrator."
  Write-Host "[WARN] Firewall rules cannot be added automatically."
  Write-Host "[WARN] If another machine cannot open the app, allow TCP ports $($env:SFDS_FRONTEND_PORT) and $($env:SFDS_BACKEND_PORT)."
  Write-Host ""
}

function Assert-AppPrerequisites {
  $script:CondaEnvName = if ($env:SFDS_CONDA_ENV) { $env:SFDS_CONDA_ENV } else { "admin" }
  $script:CondaBat = Find-CondaBat
  if (-not $script:CondaBat) {
    throw "Conda was not found. Install Anaconda/Miniconda or set SFDS_CONDA_BAT to conda.bat."
  }

  if (-not (Get-Command powershell.exe -ErrorAction SilentlyContinue)) {
    throw "PowerShell was not found."
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 18 or newer."
  }

  & node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0] >= 18 ? 0 : 1)" 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Node.js 18 or newer is required."
  }

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $npm) {
    throw "npm was not found. Reinstall Node.js with npm enabled."
  }

  $script:NpmCmd = $npm.Source
  & $script:NpmCmd --version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "npm was found but is not working correctly."
  }

  $script:HaveBun = [bool](Get-Command bun -ErrorAction SilentlyContinue)
  Write-Host "Conda launcher: $script:CondaBat"
}

function Initialize-AppNetworkEnv {
  if (-not $env:SFDS_SERVER_IP) {
    Set-ProcessEnv -Name "SFDS_SERVER_IP" -Value (Get-SfdsLanIp)
  }
  if (-not $env:SFDS_SERVER_IP) {
    Set-ProcessEnv -Name "SFDS_SERVER_IP" -Value "127.0.0.1"
  }

  $backendPort = if ($env:SFDS_BACKEND_PORT) { [int]$env:SFDS_BACKEND_PORT } else { 9000 }
  $frontendPort = if ($env:SFDS_FRONTEND_PORT) { [int]$env:SFDS_FRONTEND_PORT } else { 3000 }
  $bunPort = if ($env:SFDS_BUN_PORT) { [int]$env:SFDS_BUN_PORT } else { 8080 }

  $backendSelected = Get-SfdsFreePort -Port $backendPort
  $frontendSelected = Get-SfdsFreePort -Port $frontendPort
  while ($frontendSelected -eq $backendSelected) {
    $frontendSelected = Get-SfdsFreePort -Port ($frontendSelected + 1)
  }

  Set-ProcessEnv -Name "SFDS_BACKEND_PORT" -Value ([string]$backendSelected)
  Set-ProcessEnv -Name "SFDS_FRONTEND_PORT" -Value ([string]$frontendSelected)
  if ($script:HaveBun) {
    $bunSelected = Get-SfdsFreePort -Port $bunPort
    while ($bunSelected -eq $backendSelected -or $bunSelected -eq $frontendSelected) {
      $bunSelected = Get-SfdsFreePort -Port ($bunSelected + 1)
    }
    Set-ProcessEnv -Name "SFDS_BUN_PORT" -Value ([string]$bunSelected)
  } elseif (-not $env:SFDS_BUN_PORT) {
    Set-ProcessEnv -Name "SFDS_BUN_PORT" -Value "8080"
  }

  Set-ProcessEnv -Name "SFDS_BACKEND_HOST" -Value "0.0.0.0"
  Set-ProcessEnv -Name "NEXT_PUBLIC_API_URL" -Value "http://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)"
  Set-ProcessEnv -Name "NEXT_PUBLIC_WS_URL" -Value "ws://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)"
  Set-ProcessEnv -Name "API_URL" -Value "http://127.0.0.1:$($env:SFDS_BACKEND_PORT)"
  Set-ProcessEnv -Name "WS_HOST" -Value "0.0.0.0"
  Set-ProcessEnv -Name "WS_PORT" -Value $env:SFDS_BUN_PORT
  Set-ProcessEnv -Name "YOLO_CONFIG_DIR" -Value (Join-Path $BackendDir ".ultralytics")
  Set-ProcessEnv -Name "ULTRALYTICS_SKIP_REQUIREMENTS_CHECKS" -Value "1"

  if (-not $env:DURIAN_DEVICE) {
    Set-ProcessEnv -Name "DURIAN_DEVICE" -Value "auto"
  }
  if (-not $env:SFDS_BACKEND_RELOAD) {
    Set-ProcessEnv -Name "SFDS_BACKEND_RELOAD" -Value "0"
  }

  Add-SfdsFirewallRules
}

function Initialize-CondaEnvironment {
  Write-Host "[1/4] Preparing Conda backend environment: $script:CondaEnvName"
  & $script:CondaBat run -n $script:CondaEnvName python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Host "Conda environment `"$script:CondaEnvName`" was not found or has Python older than 3.10."
  Write-Host "Creating `"$script:CondaEnvName`" with Python 3.11..."
  & $script:CondaBat create -y -n $script:CondaEnvName python=3.11
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create Conda environment `"$script:CondaEnvName`"."
  }
}

function Install-BackendDependencies {
  $requirementsPath = Join-Path $BackendDir "requirements.txt"
  $reqHash = (Get-FileHash -LiteralPath $requirementsPath -Algorithm SHA256).Hash
  $depsReady = $false

  if ((Test-Path $BackendDepsMarker) -and ((Get-Content -Raw $BackendDepsMarker).Trim() -eq $reqHash)) {
    $depsReady = $true
  }

  if ($depsReady) {
    Write-Host "[2/4] Backend dependencies are already up to date."
  } else {
    Write-Host "[2/4] Installing backend dependencies..."
    Push-Location $BackendDir
    try {
      & $script:CondaBat run -n $script:CondaEnvName python -m pip install --upgrade pip
      if ($LASTEXITCODE -ne 0) {
        throw "pip upgrade failed."
      }

      & $script:CondaBat run -n $script:CondaEnvName python -m pip install -r requirements.txt
      if ($LASTEXITCODE -ne 0) {
        throw "Backend dependency installation failed."
      }
    } finally {
      Pop-Location
    }

    Set-Content -LiteralPath $BackendDepsMarker -Value $reqHash -NoNewline
  }

  $modelNames = @(
    "durian_yolo26m_seg.pt",
    "durian_yolov8.pt",
    "durian_yolo26m_seg.onnx",
    "durian_yolov8.onnx",
    "durian_yolo26m_seg.engine"
  )
  $modelFound = $false
  foreach ($modelName in $modelNames) {
    if (Test-Path (Join-Path $BackendDir "model\$modelName")) {
      $modelFound = $true
      break
    }
  }

  if (-not $modelFound) {
    Write-Host "[WARN] No YOLO model was found in backend\model."
    Write-Host "[WARN] Detection will not work until a model file is added or DURIAN_MODEL_PATH is set."
    Write-Host ""
  }
}

function Install-FrontendDependencies {
  $lockPath = Join-Path $FrontendDir "package-lock.json"
  if (-not (Test-Path $lockPath)) {
    $lockPath = Join-Path $FrontendDir "package.json"
  }

  $frontendHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash
  $nodeModulesPath = Join-Path $FrontendDir "node_modules"
  $depsReady = $false

  if ((Test-Path $nodeModulesPath) -and (Test-Path $FrontendDepsMarker) -and ((Get-Content -Raw $FrontendDepsMarker).Trim() -eq $frontendHash)) {
    $depsReady = $true
  }

  if ($depsReady) {
    Write-Host "[3/4] Frontend dependencies are already up to date."
  } else {
    Write-Host "[3/4] Installing frontend dependencies..."
    Push-Location $FrontendDir
    try {
      if ((Test-Path "package-lock.json") -and -not (Test-Path "node_modules")) {
        & $script:NpmCmd ci
      } else {
        & $script:NpmCmd install
      }

      if ($LASTEXITCODE -ne 0) {
        throw "Frontend dependency installation failed."
      }
    } finally {
      Pop-Location
    }

    Set-Content -LiteralPath $FrontendDepsMarker -Value $frontendHash -NoNewline
  }

  if (-not $script:HaveBun) {
    Write-Host "[WARN] Bun was not found. The app will run without the extra WebSocket proxy."
    Write-Host ""
  }
}

function Write-LaunchInfo {
  Write-Host "[4/4] Starting services..."
  Write-Host ""
  Write-Host "Server IP: $env:SFDS_SERVER_IP"
  Write-Host "Backend:   http://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)/health/"
  Write-Host "Frontend:  http://$($env:SFDS_SERVER_IP):$($env:SFDS_FRONTEND_PORT)"
  Write-Host "SCADA WS:  ws://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)/ws/scada/detect/"
  if ($script:HaveBun) {
    Write-Host "Bun proxy: ws://$($env:SFDS_SERVER_IP):$($env:SFDS_BUN_PORT)"
  }
  Write-Host ""

  $lines = @(
    "SFDS launch info",
    "Frontend: http://$($env:SFDS_SERVER_IP):$($env:SFDS_FRONTEND_PORT)",
    "Local frontend: http://127.0.0.1:$($env:SFDS_FRONTEND_PORT)",
    "Backend: http://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)/health/",
    "SCADA WebSocket: ws://$($env:SFDS_SERVER_IP):$($env:SFDS_BACKEND_PORT)/ws/scada/detect/"
  )
  if ($script:HaveBun) {
    $lines += "Bun proxy: ws://$($env:SFDS_SERVER_IP):$($env:SFDS_BUN_PORT)"
  }
  Set-Content -LiteralPath $LaunchInfoPath -Value $lines
}

function Start-AppServiceWindows {
  $backendCommand = "call `"$script:CondaBat`" activate `"$script:CondaEnvName`" && python -m uvicorn main:app --host `"%SFDS_BACKEND_HOST%`" --port `"%SFDS_BACKEND_PORT%`""
  if ($env:SFDS_BACKEND_RELOAD -eq "1") {
    $backendCommand += " --reload"
  }
  Start-CmdWindow -Title "SFDS Backend API" -WorkingDirectory $BackendDir -Command $backendCommand

  Write-Host "Waiting for backend..."
  if (-not (Wait-HttpReady -Url "http://127.0.0.1:$($env:SFDS_BACKEND_PORT)/health/" -TimeoutSeconds 90)) {
    Write-Host "[WARN] Backend did not become ready in time."
    Write-Host "[WARN] Check the `"SFDS Backend API`" window for errors."
  }

  if ($script:HaveBun) {
    Start-CmdWindow -Title "SFDS Bun WebSocket Proxy" -WorkingDirectory $FrontendDir -Command "bun run bun-ws.ts"
  }

  $nextCmd = Join-Path $FrontendDir "node_modules\.bin\next.cmd"
  if (-not (Test-Path $nextCmd)) {
    throw "Next.js launcher was not found. Run sfds.bat again so frontend dependencies can be installed."
  }

  Start-CmdWindow -Title "SFDS Frontend" -WorkingDirectory $FrontendDir -Command "call `"$nextCmd`" dev -H 0.0.0.0 -p `"%SFDS_FRONTEND_PORT%`""

  Write-Host "Waiting for frontend..."
  if (-not (Wait-HttpReady -Url "http://127.0.0.1:$($env:SFDS_FRONTEND_PORT)" -TimeoutSeconds 90)) {
    throw "Frontend did not become ready on port $($env:SFDS_FRONTEND_PORT). Check the `"SFDS Frontend`" window for the real error."
  }

  Start-Process "http://127.0.0.1:$($env:SFDS_FRONTEND_PORT)"
}

function Start-AppServices {
  Write-Host ""
  Write-Host "============================================================"
  Write-Host " SFDS - Setup and run all services"
  Write-Host "============================================================"
  Write-Host ""

  Assert-AppPrerequisites
  Initialize-AppNetworkEnv
  Initialize-CondaEnvironment
  Install-BackendDependencies
  Install-FrontendDependencies
  Write-LaunchInfo
  Start-AppServiceWindows

  Write-Host "SFDS is starting in separate windows."
  Write-Host "Backend is using Conda environment `"$script:CondaEnvName`"."
  if ($script:HaveBun) {
    Write-Host "Bun WebSocket proxy is running in a separate window."
  } else {
    Write-Host "Bun WebSocket proxy is not running."
  }
  Write-Host "Client URL: http://$($env:SFDS_SERVER_IP):$($env:SFDS_FRONTEND_PORT)"
  Write-Host "Local URL:  http://127.0.0.1:$($env:SFDS_FRONTEND_PORT)"
  Write-Host "Launch info saved to: $LaunchInfoPath"
  Write-Host "Keep those windows open while using the app."
}

function Start-FactoryServer {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found. Install Docker Desktop or load the offline Docker package first."
  }

  Write-Host "[1/3] Starting PostgreSQL Docker..."
  Resolve-PostgresPort
  $upArgs = (Get-ComposeArgs) + @("up", "-d")
  if ($script:PostgresNeedsRecreate) {
    $upArgs += "--force-recreate"
  }
  Invoke-Compose -ComposeCommandArgs $upArgs

  Write-Host "[2/3] Waiting for PostgreSQL..."
  Wait-PostgresHealthy

  Write-Host "[3/3] Starting SFDS backend/frontend for the factory LAN..."
  Set-BackendPostgresEnv
  Start-AppServices
}

function Backup-Postgres {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $outputFile = Join-Path $OutputDir "$($script:DbName)-$stamp.dump"
  $containerDump = "/tmp/sfds_backup.dump"

  Write-Host "[SFDS] Creating backup in $script:DbContainer"
  docker exec -e PGPASSWORD=$script:DbPassword $script:DbContainer pg_dump --host 127.0.0.1 --username $script:DbUser --dbname $script:DbName --format custom --file $containerDump
  docker cp "$($script:DbContainer):$containerDump" $outputFile
  docker exec $script:DbContainer rm -f $containerDump | Out-Null
  Write-Host "[SFDS] Backup complete: $outputFile"
}

function Restore-Postgres {
  if (-not $BackupFile) {
    throw "Missing -BackupFile for restore."
  }
  if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
  }
  if (-not $Force) {
    throw "Restore is destructive. Re-run with -Force after confirming this is the right backup."
  }

  $containerDump = "/tmp/sfds_restore.dump"
  docker cp $BackupFile "$($script:DbContainer):$containerDump"
  docker exec -e PGPASSWORD=$script:DbPassword $script:DbContainer pg_restore --host 127.0.0.1 --username $script:DbUser --dbname $script:DbName --clean --if-exists --no-owner $containerDump
  docker exec $script:DbContainer rm -f $containerDump | Out-Null
  Write-Host "[SFDS] Restore complete."
}

function Save-PostgresImage {
  $targetDir = Split-Path -Parent $TarPath
  if ($targetDir) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  }

  docker pull $script:PostgresImage
  docker save --output $TarPath $script:PostgresImage
  Write-Host "[SFDS] Image package ready: $TarPath"
}

function Load-PostgresImage {
  if (-not (Test-Path $TarPath)) {
    throw "Image tar file not found: $TarPath"
  }
  docker load --input $TarPath
  Write-Host "[SFDS] Image loaded."
}

function Invoke-Psql {
  param(
    [string]$DatabaseName,
    [string]$Sql
  )

  psql --host $script:DbHost --port $script:DbPort --username $AdminUser --dbname $DatabaseName --set ON_ERROR_STOP=1 --command $Sql
}

function Setup-NativePostgres {
  foreach ($identifier in @($script:DbName, $script:DbUser)) {
    if ($identifier -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      throw "Invalid PostgreSQL identifier: $identifier"
    }
  }

  $escapedPassword = $script:DbPassword.Replace("'", "''")
  $roleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$script:DbUser') THEN
    CREATE ROLE $script:DbUser LOGIN PASSWORD '$escapedPassword';
  ELSE
    ALTER ROLE $script:DbUser WITH LOGIN PASSWORD '$escapedPassword';
  END IF;
END
`$`$;
"@

  Write-Host "[SFDS] Creating native PostgreSQL role/database on $($script:DbHost):$($script:DbPort)"
  Invoke-Psql -DatabaseName "postgres" -Sql $roleSql

  $dbExists = psql --host $script:DbHost --port $script:DbPort --username $AdminUser --dbname postgres --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname = '$script:DbName';"

  if ($dbExists.Trim() -ne "1") {
    psql --host $script:DbHost --port $script:DbPort --username $AdminUser --dbname postgres --set ON_ERROR_STOP=1 --command "CREATE DATABASE $script:DbName OWNER $script:DbUser;"
  } else {
    Invoke-Psql -DatabaseName "postgres" -Sql "ALTER DATABASE $script:DbName OWNER TO $script:DbUser;"
  }

  Invoke-Psql -DatabaseName $script:DbName -Sql "GRANT ALL PRIVILEGES ON DATABASE $script:DbName TO $script:DbUser;"
  Invoke-Psql -DatabaseName $script:DbName -Sql "GRANT ALL ON SCHEMA public TO $script:DbUser;"

  Write-Host "[SFDS] Native PostgreSQL setup complete."
}

function Test-CameraHealth {
  $baseUrl = "http://127.0.0.1:9000"
  $ready = $false
  $health = $null

  Write-Host ""
  Write-Host "============================================================"
  Write-Host " SFDS - Backend and Camera Check"
  Write-Host "============================================================"
  Write-Host ""
  Write-Host "Waiting for backend..."

  for ($i = 0; $i -lt 45; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "$baseUrl/health/" -TimeoutSec 2
      $ready = $true
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $ready) {
    throw "Backend did not become ready at $baseUrl/health/"
  }

  Write-Host ("Backend: OK | model_loaded={0} | device={1} | format={2}" -f $health.model_loaded, $health.device, $health.model_format)
  Write-Host ""
  Write-Host "Checking 5 camera slots..."

  $cameraHealth = Invoke-RestMethod -Uri "$baseUrl/api/scada/cameras/health/?timeout_ms=2500" -TimeoutSec 20
  Write-Host ("Summary: {0}/{1} configured cameras online" -f $cameraHealth.online_count, $cameraHealth.configured_count)
  Write-Host ""

  for ($slot = 0; $slot -lt 5; $slot++) {
    $cam = $cameraHealth.cameras."$slot"
    if ($null -eq $cam -or -not $cam.configured) {
      Write-Host ("Slot {0}: NOT CONFIGURED" -f $slot)
      continue
    }

    if ($cam.online) {
      Write-Host ("Slot {0}: ONLINE {1}x{2} {3}ms" -f $slot, $cam.width, $cam.height, $cam.latency_ms)
    } else {
      Write-Host ("Slot {0}: OFFLINE {1}" -f $slot, $cam.message)
    }
  }
}

function Open-WebcamCheck {
  $url = "http://localhost:3000/webcam-check"
  $ready = $false

  Write-Host ""
  Write-Host "============================================================"
  Write-Host " SFDS - Browser Webcam Check"
  Write-Host "============================================================"
  Write-Host ""
  Write-Host "Waiting for frontend..."

  for ($i = 0; $i -lt 60; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $ready) {
    Write-Host "[WARN] Frontend did not respond yet. Opening the page anyway."
  }

  Write-Host "Opening browser webcam diagnostic page..."
  Write-Host $url
  Start-Process $url
}

Get-SfdsConfig
$composeArgs = Get-ComposeArgs

switch ($Action) {
  "server" { Start-FactoryServer }
  "dev" { Start-AppServices }
  "db-up" {
    Resolve-PostgresPort
    $upArgs = $composeArgs + @("up", "-d")
    if ($script:PostgresNeedsRecreate) {
      $upArgs += "--force-recreate"
    }
    Invoke-Compose -ComposeCommandArgs $upArgs
  }
  "db-down" { Invoke-Compose -ComposeCommandArgs ($composeArgs + @("down")) }
  "db-restart" { Invoke-Compose -ComposeCommandArgs ($composeArgs + @("restart", "postgres")) }
  "db-status" { Invoke-Compose -ComposeCommandArgs ($composeArgs + @("ps")) }
  "db-logs" {
    if ($FollowLogs) {
      Invoke-Compose -ComposeCommandArgs ($composeArgs + @("logs", "-f", "postgres"))
    } else {
      Invoke-Compose -ComposeCommandArgs ($composeArgs + @("logs", "--tail", "120", "postgres"))
    }
  }
  "backup" { Backup-Postgres }
  "restore" { Restore-Postgres }
  "image-save" { Save-PostgresImage }
  "image-load" { Load-PostgresImage }
  "native-setup" { Setup-NativePostgres }
  "camera-check" { Test-CameraHealth }
  "webcam-check" { Open-WebcamCheck }
}
