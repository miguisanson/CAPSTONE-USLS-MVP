$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $RootDir "server"
$ClientDir = Join-Path $RootDir "client"
$ServerEnv = Join-Path $ServerDir ".env"
$ClientEnv = Join-Path $ClientDir ".env"
$ServerProcess = $null
$ClientProcess = $null
$MySqlDefaultsFile = $null

function Write-Log {
  param([string]$Message)
  $Time = Get-Date -Format "HH:mm:ss"
  Write-Host ""
  Write-Host "[$Time] $Message"
}

function Stop-WithError {
  param([string]$Message)
  Write-Host ""
  Write-Error $Message
  exit 1
}

function Get-RequiredCommand {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $Command) {
    Stop-WithError "$Name is required but was not found. $InstallHint"
  }
  return $Command.Source
}

function Get-NpmCommand {
  $Command = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }
  return (Get-RequiredCommand "npm" "Install Node.js 20+ from https://nodejs.org/")
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      Stop-WithError "Command failed: $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function New-JwtSecret {
  return (& node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
}

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  foreach ($Line in Get-Content $Path) {
    $Trimmed = $Line.Trim()
    if (-not $Trimmed -or $Trimmed.StartsWith("#")) {
      continue
    }

    if ($Trimmed -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$" -and $Matches[1] -eq $Key) {
      $Value = $Matches[2].Trim()
      if ($Value.Length -ge 2) {
        $First = $Value.Substring(0, 1)
        $Last = $Value.Substring($Value.Length - 1, 1)
        if (($First -eq '"' -and $Last -eq '"') -or ($First -eq "'" -and $Last -eq "'")) {
          $Value = $Value.Substring(1, $Value.Length - 2)
        }
      }
      return $Value
    }
  }

  return ""
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $Lines = @()
  if (Test-Path $Path) {
    $Lines = @(Get-Content $Path)
  }

  $Updated = $false
  $NextLines = @(foreach ($Line in $Lines) {
    if ($Line -match "^$([regex]::Escape($Key))=") {
      $Updated = $true
      "$Key=`"$Value`""
    } else {
      $Line
    }
  })

  if (-not $Updated) {
    if ($NextLines.Count -gt 0 -and $NextLines[$NextLines.Count - 1] -ne "") {
      $NextLines += ""
    }
    $NextLines += "$Key=`"$Value`""
  }

  Set-Content -Path $Path -Value $NextLines -Encoding UTF8
}

function Get-DatabaseInfo {
  param([string]$DatabaseUrl)

  try {
    $Uri = [Uri]$DatabaseUrl
  } catch {
    Stop-WithError "DATABASE_URL is invalid. Example: mysql://root:password@localhost:3306/usls_gs_mvp"
  }

  $User = ""
  $Password = ""
  if ($Uri.UserInfo) {
    $Parts = $Uri.UserInfo.Split(":", 2)
    $User = [Uri]::UnescapeDataString($Parts[0])
    if ($Parts.Count -gt 1) {
      $Password = [Uri]::UnescapeDataString($Parts[1])
    }
  }

  $DatabaseName = $Uri.AbsolutePath.TrimStart([char[]]"/").Split("?")[0]
  if (-not $DatabaseName -or $DatabaseName -notmatch "^[A-Za-z0-9_]+$") {
    Stop-WithError "DATABASE_URL must include a simple database name, for example /usls_gs_mvp"
  }

  $Port = if ($Uri.Port -gt 0) { $Uri.Port } else { 3306 }

  [pscustomobject]@{
    User = $User
    Password = $Password
    Host = if ($Uri.Host) { $Uri.Host } else { "localhost" }
    Port = $Port
    DatabaseName = $DatabaseName
  }
}

function Write-MySqlDefaultsFile {
  param(
    [pscustomobject]$Info,
    [string]$Path
  )

  $Content = @(
    "[client]",
    "user=$($Info.User)",
    "password=$($Info.Password)",
    "host=$($Info.Host)",
    "port=$($Info.Port)",
    "protocol=tcp",
    ""
  )

  Set-Content -Path $Path -Value $Content -Encoding ASCII
}

function New-DatabaseIfMissing {
  param(
    [string]$MySqlCommand,
    [string]$DefaultsFile,
    [string]$DatabaseName
  )

  $Sql = "CREATE DATABASE IF NOT EXISTS ``$DatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  & $MySqlCommand "--defaults-extra-file=$DefaultsFile" -e $Sql *> $null
  return $LASTEXITCODE -eq 0
}

function Get-UserCount {
  param(
    [string]$MySqlCommand,
    [string]$DefaultsFile,
    [string]$DatabaseName
  )

  $Output = & $MySqlCommand "--defaults-extra-file=$DefaultsFile" "--database=$DatabaseName" "--batch" "--skip-column-names" -e "SELECT COUNT(*) FROM UserAccount;" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $Output) {
    return 0
  }

  return [int]($Output | Select-Object -First 1)
}

function Stop-DevProcesses {
  if ($ServerProcess -and -not $ServerProcess.HasExited) {
    Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($ClientProcess -and -not $ClientProcess.HasExited) {
    Stop-Process -Id $ClientProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($MySqlDefaultsFile -and (Test-Path $MySqlDefaultsFile)) {
    Remove-Item $MySqlDefaultsFile -Force -ErrorAction SilentlyContinue
  }
}

try {
  $NodeCommand = Get-RequiredCommand "node" "Install Node.js 20+ from https://nodejs.org/"
  $NpmCommand = Get-NpmCommand
  $MySqlCommand = Get-RequiredCommand "mysql" "Install MySQL 8 and add the MySQL bin folder to PATH."

  $NodeMajor = [int](& $NodeCommand -p "Number(process.versions.node.split('.')[0])")
  if ($NodeMajor -lt 20) {
    Stop-WithError "Node.js 20+ is required. Current version: $(& $NodeCommand -v)"
  }

  if (-not (Test-Path $ServerEnv)) {
    Write-Log "Creating server/.env from server/.env.example"
    Copy-Item (Join-Path $ServerDir ".env.example") $ServerEnv
  }

  if (-not (Test-Path $ClientEnv)) {
    Write-Log "Creating client/.env from client/.env.example"
    Copy-Item (Join-Path $ClientDir ".env.example") $ClientEnv
  }

  $InputDatabaseUrl = $env:DATABASE_URL
  if ($InputDatabaseUrl) {
    Write-Log "Using DATABASE_URL from this PowerShell session"
  }

  $ExistingSecret = Read-EnvValue $ServerEnv "JWT_SECRET"
  if ($ExistingSecret -eq "replace_with_at_least_32_characters_secret") {
    Write-Log "Generating a local JWT secret"
    Set-EnvValue $ServerEnv "JWT_SECRET" (New-JwtSecret)
  }

  $DatabaseUrl = if ($InputDatabaseUrl) { $InputDatabaseUrl } else { Read-EnvValue $ServerEnv "DATABASE_URL" }
  if (-not $DatabaseUrl) {
    Stop-WithError "DATABASE_URL is missing in server/.env"
  }

  $MySqlDefaultsFile = [System.IO.Path]::GetTempFileName()
  $DatabaseInfo = Get-DatabaseInfo $DatabaseUrl
  Write-MySqlDefaultsFile $DatabaseInfo $MySqlDefaultsFile

  if (-not (New-DatabaseIfMissing $MySqlCommand $MySqlDefaultsFile $DatabaseInfo.DatabaseName)) {
    Write-Host ""
    Write-Host "Could not connect to MySQL using DATABASE_URL in server/.env:"
    Write-Host $DatabaseUrl
    Write-Host ""
    $NewDatabaseUrl = Read-Host "Enter a working MySQL DATABASE_URL, or press Enter to stop"
    if (-not $NewDatabaseUrl) {
      Stop-WithError "Update server/.env with your MySQL credentials, then rerun: npm run dev"
    }

    $DatabaseUrl = $NewDatabaseUrl
    $DatabaseInfo = Get-DatabaseInfo $DatabaseUrl
    Write-MySqlDefaultsFile $DatabaseInfo $MySqlDefaultsFile
    if (-not (New-DatabaseIfMissing $MySqlCommand $MySqlDefaultsFile $DatabaseInfo.DatabaseName)) {
      Stop-WithError "Still could not connect to MySQL. Check that MySQL is running and the credentials are correct."
    }
    Set-EnvValue $ServerEnv "DATABASE_URL" $DatabaseUrl
  }

  if ($InputDatabaseUrl) {
    Set-EnvValue $ServerEnv "DATABASE_URL" $DatabaseUrl
  }

  Write-Log "Installing backend dependencies"
  Invoke-Checked $NpmCommand @("install") $ServerDir

  Write-Log "Preparing database"
  Invoke-Checked $NpmCommand @("run", "prisma:generate") $ServerDir
  Invoke-Checked $NpmCommand @("run", "prisma:deploy") $ServerDir

  $UserCount = Get-UserCount $MySqlCommand $MySqlDefaultsFile $DatabaseInfo.DatabaseName
  if ($UserCount -eq 0) {
    Write-Log "Seeding demo data"
    Invoke-Checked $NpmCommand @("run", "seed") $ServerDir
  } else {
    Write-Log "Skipping seed because the database already has users"
  }

  Write-Log "Installing frontend dependencies"
  Invoke-Checked $NpmCommand @("install") $ClientDir

  Write-Log "Starting backend at http://localhost:4000"
  $ServerProcess = Start-Process -FilePath $NpmCommand -ArgumentList @("run", "dev") -WorkingDirectory $ServerDir -NoNewWindow -PassThru

  Write-Log "Starting frontend at http://localhost:5173"
  $ClientProcess = Start-Process -FilePath $NpmCommand -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0") -WorkingDirectory $ClientDir -NoNewWindow -PassThru

  Write-Host ""
  Write-Host "Local app is starting:"
  Write-Host "  Frontend: http://localhost:5173"
  Write-Host "  Backend:  http://localhost:4000/health"
  Write-Host ""
  Write-Host "Press Ctrl+C to stop both servers."
  Write-Host ""

  while (-not $ServerProcess.HasExited -and -not $ClientProcess.HasExited) {
    Start-Sleep -Seconds 1
    $ServerProcess.Refresh()
    $ClientProcess.Refresh()
  }
} finally {
  Stop-DevProcesses
}
