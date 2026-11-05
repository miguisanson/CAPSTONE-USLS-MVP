# Desktop button "USLS site - Stop": stops the site and the tunnel. The keep-awake helper
# (keep-awake.ps1) notices within a minute and lets the PC sleep normally again.
param([switch]$NoPause)
Set-Location (Split-Path $PSScriptRoot)

docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { docker compose --profile tunnel stop }
Write-Host 'Site is OFF. The PC can sleep normally again.'
if (-not $NoPause) { Read-Host 'Press Enter to close' }
