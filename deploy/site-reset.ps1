# Resets all demo data. Resets the Docker site's database when Docker holds the site, else the local file.
# -DryRun prints the Docker steps without doing them.
param([switch]$NoPause, [switch]$DryRun)
Set-Location (Split-Path $PSScriptRoot)
. (Join-Path $PSScriptRoot 'site-common.ps1')

try {
    $docker = $DryRun -or (Test-ContainerExists $AppContainer)
    if (-not $docker) {
        # No Docker site: the local site (START-SITE.cmd) must be closed first.
        $running = $false
        try { Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null; $running = $true } catch {}
        if ($running) { Done 'The site is still running. Close the "USLS site - keep open" window, then run this again.'; exit 1 }
    }
    Write-Host 'This removes everything testers entered and rebuilds the demo data.'
    if ((Read-Host 'Type YES to reset all demo data') -cne 'YES') { Done 'Cancelled. Nothing was changed.'; exit 0 }

    if ($docker) {
        if (-not (Reset-DockerData)) { Done 'The reset failed (see above).'; exit 1 }
        Write-Host 'Waiting for the site to answer...'
        if (-not (Wait-Health)) { Done 'The site did not answer after the reset. Check: docker compose logs app'; exit 1 }
        Ensure-Public | Out-Null
        Done 'Done: demo data reset.'
    } else {
        npm run seed
        if ($LASTEXITCODE -ne 0) { Done 'The reset failed (see above).'; exit 1 }
        Done 'Done. Start the site again with deploy\START-SITE.cmd'
    }
} catch {
    Done "Failed: $_"; exit 1
}
