$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Installing Python dependencies..."
python -m pip install -r requirements.txt

Write-Host ""
Write-Host "Preparing demo database..."
python app.py --seed

Write-Host ""
Write-Host "Checking local demo port..."
$connections = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
foreach ($connection in $connections) {
  if ($connection.OwningProcess -and $connection.OwningProcess -ne 0) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Starting Python demo at http://localhost:5000"
python app.py
