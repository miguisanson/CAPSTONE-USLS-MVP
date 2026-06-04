@echo off
cd /d "%~dp0"
echo ============================================
echo   USLS Graduate School Platform - SETUP
echo ============================================
echo.
echo [1/4] Installing Python dependencies...
python -m pip install -r requirements.txt || exit /b 1
echo.
echo [2/4] Installing frontend dependencies...
call npm --prefix frontend install || exit /b 1
echo.
echo [3/4] Building the frontend...
call npm --prefix frontend run build || exit /b 1
echo.
echo [4/4] Seeding the demo database (~350 students)...
python app.py --seed || exit /b 1
echo.
echo ============================================
echo   Setup complete!  Now run:  run.bat
echo ============================================
