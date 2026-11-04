# Desktop button "USLS site - Update": gets the latest code, rebuilds the Docker site, resets the demo
# data if the new version needs it, and makes sure https://miguisanson.dev answers.
# -DryRun prints the steps without doing them.
param([switch]$NoPause, [switch]$DryRun)
Set-Location (Split-Path $PSScriptRoot)
. (Join-Path $PSScriptRoot 'site-common.ps1')

try {
    if (-not $DryRun) {
        docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { Done 'Docker Desktop is not running. Start the site first (USLS site - Start), then update.'; exit 1 }
        if (git status --porcelain --untracked-files=no) {
            Done 'Stopped: this folder has changes that are not saved in git. Ask Migui before updating.'; exit 1
        }
    }

    Write-Host 'Getting the latest code...'
    if (-not (Run 'git pull --ff-only' { git pull --ff-only })) { Done 'Stopped: git pull failed (see above). Nothing was changed on the site.'; exit 1 }

    Write-Host 'Rebuilding the site (a few minutes)...'
    if (-not (Run 'docker compose --profile tunnel up -d --build' { docker compose --profile tunnel up -d --build })) { Done 'Stopped: the rebuild failed (see above).'; exit 1 }

    Write-Host 'Waiting for the site to answer...'
    if (-not (Wait-Health)) {
        $log = (docker logs $AppContainer 2>&1) -join "`n"
        if ($log -like '*Your database was built by an older version of the app*') {
            Write-Host 'The new version needs fresh demo data: resetting it (testers'' changes are lost)...'
            if (-not (Reset-DockerData)) { Done 'Stopped: the reset failed (see above).'; exit 1 }
            Write-Host 'Waiting for the site to answer...'
            if (-not (Wait-Health)) { Done 'The site did not answer after the reset. Check: docker compose logs app'; exit 1 }
            Write-Host 'The demo data was reset.'
        } else { Done 'The site did not answer. Check: docker compose logs app'; exit 1 }
    }

    if (Ensure-Public) { Done 'Done: https://miguisanson.dev is up' } else { Done 'The site runs on this PC but the public address does not answer.'; exit 1 }
} catch {
    Done "Failed: $_"; exit 1
}
