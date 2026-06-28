$ErrorActionPreference = "Stop"

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
Write-Host ""
Write-Host "The browser must be allowed to access the camera before webcam checks can run."
