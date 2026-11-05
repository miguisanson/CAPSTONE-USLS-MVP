# Shared helpers for site-start.ps1, site-update.ps1 and site-reset.ps1 (dot-source this file).
# Callers may define $NoPause and $DryRun before dot-sourcing; both default to off.
$AppContainer = 'capstone-usls-mvp-app-1'

function Done($msg) { Write-Host $msg; if (-not $NoPause) { Read-Host 'Press Enter to close' } }

# Run a command, or only print it when -DryRun is on. Returns $true when it worked.
function Run([string]$text, [scriptblock]$sb) {
    if ($DryRun) { Write-Host "  [dry run] $text"; return $true }
    & $sb
    return ($LASTEXITCODE -eq 0)
}

function Test-ContainerExists([string]$name) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return $false }
    return [bool](docker ps -a --filter "name=^$name$" --format '{{.Names}}' 2>$null)
}

# Waits for the local health page. Stops early (returns $false) when the app container has exited.
function Wait-Health([int]$tries = 60) {
    if ($DryRun) { Write-Host '  [dry run] wait for http://127.0.0.1:8080/api/health'; return $true }
    for ($i = 0; $i -lt $tries; $i++) {
        try { if ((Invoke-WebRequest http://127.0.0.1:8080/api/health -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop).StatusCode -eq 200) { return $true } } catch { Start-Sleep 5 }
        if ((docker inspect -f '{{.State.Status}}' $AppContainer 2>$null) -eq 'exited') { return $false }
    }
    return $false
}

function Test-Public { try { return (Invoke-WebRequest https://miguisanson.dev/api/health -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop).StatusCode -eq 200 } catch { return $false } }

# I-352: after a rebuild the Cloudflare tunnel can stay disconnected (public site shows error 1033); restart it once.
function Ensure-Public {
    Write-Host 'Checking https://miguisanson.dev ...'
    if ($DryRun) { Write-Host '  [dry run] check the public address, restart the tunnel once if it does not answer'; return $true }
    $public = $false
    for ($i = 0; $i -lt 6 -and -not $public; $i++) { $public = Test-Public; if (-not $public) { Start-Sleep 10 } }
    if (-not $public) {
        Write-Host 'The public address does not answer yet: restarting the tunnel...'
        docker compose --profile tunnel restart tunnel | Out-Null
        for ($i = 0; $i -lt 12 -and -not $public; $i++) { $public = Test-Public; if (-not $public) { Start-Sleep 10 } }
        if (-not $public) { Write-Host 'Still no answer from https://miguisanson.dev - check: docker compose logs tunnel' }
    }
    return $public
}

# Wipes the Docker volume database and rebuilds the demo data. The app is stopped meanwhile.
function Reset-DockerData {
    Write-Host 'Stopping the site...'
    if (-not (Run 'docker compose stop app' { docker compose stop app })) { return $false }
    Write-Host 'Rebuilding the demo data...'
    $ok = Run 'docker compose run --rm --no-deps app python app.py --seed' { docker compose run --rm --no-deps app python app.py --seed }
    Write-Host 'Starting the site again...'
    Run 'docker compose start app' { docker compose start app } | Out-Null
    return $ok
}
