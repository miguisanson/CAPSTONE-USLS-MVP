@echo off
rem Rebuild the demo data (every tester's changes are lost). Close the "USLS site" window first.
cd /d "%~dp0.."
curl -s -m 3 http://127.0.0.1:5000/api/health >nul 2>&1
if not errorlevel 1 (
  echo The site is still running. Close the "USLS site - keep open" window, then run this again.
  pause
  exit /b 1
)
call npm run seed
echo Done. Start the site again with deploy\START-SITE.cmd
pause
