param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("ip", "port", "wait-http")]
  [string]$Mode,

  [int]$StartPort = 0,
  [string]$Url = "",
  [int]$TimeoutSeconds = 60
)

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

function Get-SfdsFreePort([int]$Port) {
  if ($Port -lt 1) {
    $Port = 3000
  }

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

  throw "No free TCP port found from $StartPort"
}

if ($Mode -eq "ip") {
  Get-SfdsLanIp
} elseif ($Mode -eq "port") {
  Get-SfdsFreePort -Port $StartPort
} elseif ($Mode -eq "wait-http") {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        "ready"
        exit 0
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  "timeout"
  exit 1
}
