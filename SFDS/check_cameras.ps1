$ErrorActionPreference = "Stop"

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
    Write-Host "[ERROR] Backend did not become ready at $baseUrl/health/"
    exit 1
}

Write-Host ("Backend:  OK | model_loaded={0} | device={1} | format={2}" -f $health.model_loaded, $health.device, $health.model_format)
if ($health.device -eq "cuda") {
    Write-Host "Device:   GPU is being used."
} elseif ($health.device -eq "cpu") {
    Write-Host "Device:   CPU fallback is being used."
} else {
    Write-Host ("Device:   {0}" -f $health.device)
}

Write-Host ""
Write-Host "Checking 4 camera slots..."

try {
    $cameraHealth = Invoke-RestMethod -Uri "$baseUrl/api/scada/cameras/health/?timeout_ms=2500" -TimeoutSec 20
} catch {
    Write-Host ("[ERROR] Could not check cameras: {0}" -f $_.Exception.Message)
    exit 1
}

Write-Host ("Summary:  {0}/{1} configured cameras online" -f $cameraHealth.online_count, $cameraHealth.configured_count)
Write-Host ""

for ($slot = 0; $slot -lt 4; $slot++) {
    $cam = $cameraHealth.cameras."$slot"
    if ($null -eq $cam -or -not $cam.configured) {
        Write-Host ("Slot {0}: NOT CONFIGURED" -f $slot)
        continue
    }

    if ($cam.online) {
        Write-Host ("Slot {0}: ONLINE  {1}x{2}  {3}ms" -f $slot, $cam.width, $cam.height, $cam.latency_ms)
    } else {
        Write-Host ("Slot {0}: OFFLINE  {1}" -f $slot, $cam.message)
    }
}

Write-Host ""
Write-Host "Camera config is read from backend/scada_cameras.json and the SCADA camera settings UI."
