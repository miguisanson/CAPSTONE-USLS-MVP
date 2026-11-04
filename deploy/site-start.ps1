# Desktop button "USLS site - Start": starts Docker Desktop if needed, then the site and the
# Cloudflare tunnel (https://miguisanson.dev), and keeps the PC awake until "USLS site - Stop".
param([switch]$NoPause)
Set-Location (Split-Path $PSScriptRoot)

function Done($msg) { Write-Host $msg; if (-not $NoPause) { Read-Host 'Press Enter to close' } }

try {
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Starting Docker Desktop...'
        # docker.exe lives in <Docker>\resources\bin; Docker Desktop.exe in <Docker>
        $dockerDir = Split-Path (Split-Path (Split-Path (Get-Command docker).Source))
        Start-Process (Join-Path $dockerDir 'Docker Desktop.exe')
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep 5
            docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
        }
        if ($LASTEXITCODE -ne 0) { Done 'Docker Desktop did not start in 5 minutes. Open it by hand, then try again.'; exit 1 }
    }

    Write-Host 'Starting the site and the tunnel...'
    docker compose --profile tunnel up -d
    if ($LASTEXITCODE -ne 0) { Done 'docker compose failed (see above).'; exit 1 }

    Write-Host 'Waiting for the site to answer...'
    $ok = $false
    for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
        try { $ok = (Invoke-WebRequest http://127.0.0.1:8080/api/health -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop).StatusCode -eq 200 } catch { Start-Sleep 5 }
    }
    if (-not $ok) { Done 'The site did not answer in 5 minutes. Check: docker compose logs app'; exit 1 }

    # I-352: after a rebuild the Cloudflare tunnel can stay disconnected (public site shows error 1033); restart it once.
    Write-Host 'Checking https://miguisanson.dev ...'
    $public = $false
    for ($i = 0; $i -lt 6 -and -not $public; $i++) {
        try { $public = (Invoke-WebRequest https://miguisanson.dev/api/health -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop).StatusCode -eq 200 } catch { Start-Sleep 10 }
    }
    if (-not $public) {
        Write-Host 'The public address does not answer yet: restarting the tunnel...'
        docker compose --profile tunnel restart tunnel | Out-Null
        for ($i = 0; $i -lt 12 -and -not $public; $i++) {
            try { $public = (Invoke-WebRequest https://miguisanson.dev/api/health -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop).StatusCode -eq 200 } catch { Start-Sleep 10 }
        }
        if (-not $public) { Write-Host 'Still no answer from https://miguisanson.dev - check: docker compose logs tunnel' }
    }

    $awake = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object CommandLine -like '*keep-awake.ps1*'
    if (-not $awake) {
        Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'keep-awake.ps1')
    }
    Done 'Site is ON: https://miguisanson.dev  (PC stays awake until you press "USLS site - Stop")'
} catch {
    Done "Failed: $_"; exit 1
}
