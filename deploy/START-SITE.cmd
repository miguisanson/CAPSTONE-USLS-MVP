@echo off
rem Start the site without Docker: the app on http://127.0.0.1:5000 (npm run uat) and, when
rem deploy\tunnel.env holds TUNNEL_TOKEN=..., the Cloudflare tunnel to https://miguisanson.dev.
rem The Cloudflare route must point to http://localhost:5000 (deploy\DOCKER.md step C8).
cd /d "%~dp0.."
set DEMO_MODE=1
set DEMO_SHOW_ACCOUNTS=1
set SESSION_COOKIE_SECURE=1
set GOOGLE_CALENDAR_REDIRECT_URI=https://miguisanson.dev/api/integrations/google-calendar/callback

curl -s -m 3 http://127.0.0.1:5000/api/health >nul 2>&1
if errorlevel 1 (
  echo Starting the site on http://127.0.0.1:5000 ...
  start "USLS site - keep open" cmd /k npm run uat
) else (
  echo The site is already running on http://127.0.0.1:5000.
)

set TUNNEL_TOKEN=
if exist "deploy\tunnel.env" for /f "usebackq tokens=1,* delims==" %%a in ("deploy\tunnel.env") do if /i "%%a"=="TUNNEL_TOKEN" set "TUNNEL_TOKEN=%%b"
if not defined TUNNEL_TOKEN (
  echo No token in deploy\tunnel.env yet: the site is only on this PC. See deploy\DOCKER.md part C.
  goto :end
)
rem Official Cloudflare connector downloaded to E: (no install needed); else one on the PATH.
set "CF=E:\DevCache\cloudflared\cloudflared-windows-amd64.exe"
if not exist "%CF%" set "CF=cloudflared"
tasklist | "%SystemRoot%\System32\find.exe" /i "cloudflared" >nul
if errorlevel 1 (
  echo Starting the Cloudflare tunnel ...
  start "Cloudflare tunnel - keep open" "%CF%" tunnel --no-autoupdate run
) else (
  echo The Cloudflare tunnel is already running.
)
echo Check https://miguisanson.dev/api/health in a minute.
:end
pause
