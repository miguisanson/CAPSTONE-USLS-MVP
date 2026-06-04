$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "[1/4] Installing Python dependencies..."
python -m pip install -r requirements.txt

Write-Host ""
Write-Host "[2/4] Building the React frontend (npm install + build)..."
Push-Location "$PSScriptRoot\frontend"
npm install
npm run build
Pop-Location

Write-Host ""
Write-Host "[3/4] Preparing demo database (SQLite by default; set DATABASE_URL for MySQL)..."
python app.py --seed

Write-Host ""
Write-Host "Freeing local port 5000 if in use..."
$connections = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
foreach ($connection in $connections) {
  if ($connection.OwningProcess -and $connection.OwningProcess -ne 0) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "[4/4] Starting the platform at http://localhost:5000"
python app.py
