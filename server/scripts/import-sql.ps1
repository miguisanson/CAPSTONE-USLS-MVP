param(
  [Parameter(Mandatory = $false)]
  [string]$DbName = "usls_gs_mvp",

  [Parameter(Mandatory = $false)]
  [string]$User = "root",

  [Parameter(Mandatory = $false)]
  [string]$Host = "localhost",

  [Parameter(Mandatory = $false)]
  [int]$Port = 3306,

  [Parameter(Mandatory = $true)]
  [string]$SqlPath,

  [Parameter(Mandatory = $false)]
  [string]$Password
)

$ErrorActionPreference = "Stop"

function Resolve-MySqlPath {
  $cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $commonPaths = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
  )

  foreach ($path in $commonPaths) {
    if (Test-Path $path) { return $path }
  }

  return $null
}

$resolvedSqlPath = Resolve-Path -Path $SqlPath -ErrorAction Stop
if (-not (Test-Path $resolvedSqlPath)) {
  Write-Error "SQL file not found: $SqlPath"
  exit 1
}

$mysqlExe = Resolve-MySqlPath
if (-not $mysqlExe) {
  Write-Error "mysql.exe not found. Add MySQL bin to PATH or install MySQL client tools."
  exit 1
}

if (-not $Password) {
  $Password = Read-Host -Prompt "MySQL password for user '$User'"
}

$escapedDbName = $DbName.Replace("`", "``")
$createDbSql = "CREATE DATABASE IF NOT EXISTS ``$escapedDbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "Creating database (if missing): $DbName"
& $mysqlExe --host="$Host" --port="$Port" --user="$User" --password="$Password" --execute="$createDbSql"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to create/verify database '$DbName'."
  exit $LASTEXITCODE
}

Write-Host "Importing SQL dump into '$DbName' from:"
Write-Host "  $resolvedSqlPath"

$importCmd = "`"$mysqlExe`" --host=`"$Host`" --port=`"$Port`" --user=`"$User`" --password=`"$Password`" `"$DbName`" < `"$resolvedSqlPath`""
cmd /c $importCmd
if ($LASTEXITCODE -ne 0) {
  Write-Error "Import failed with exit code $LASTEXITCODE."
  exit $LASTEXITCODE
}

Write-Host "Import completed successfully."
exit 0

