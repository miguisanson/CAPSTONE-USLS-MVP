@echo off
cd /d "%~dp0"
if not exist "frontend\dist\index.html" echo NOTE: frontend not built yet - run setup.bat first if the page looks empty.
echo.
echo Starting USLS Graduate School Platform at http://localhost:5000
echo Press Ctrl+C to stop.
echo.
python app.py
