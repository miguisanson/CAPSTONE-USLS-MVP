#!/bin/bash
# Starts the USLS Graduate School app and opens it in the browser (macOS).
cd "$(dirname "$0")" || exit 1
PORT="${FLASK_PORT:-5000}"
URL="http://localhost:$PORT"
fail() { echo; echo "PROBLEM: $1"; read -n 1 -s -r -p "Press any key to close."; exit 1; }
mkdir -p instance
[ -f app.py ] || fail "app.py was not found next to Start.command."
if { [ -f instance/app.pid ] && kill -0 "$(cat instance/app.pid)" 2>/dev/null; } || lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
  echo "The app is already running. Opening the browser."; open "$URL"; exit 0
fi
PY=.venv/bin/python
NEED_BUILD=0
if [ -d frontend/src ] && [ ! -f frontend/dist/.prebuilt ]; then
  if [ ! -f frontend/dist/index.html ] || [ -n "$(find frontend/src -type f -newer frontend/dist/index.html -print -quit)" ]; then NEED_BUILD=1; fi
fi
if [ ! -x "$PY" ]; then
  { command -v python3 >/dev/null && python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))'; } || fail "Python 3.11 or newer is not installed. Install it from python.org, then run this again."
  echo "First run: installing Python packages (a few minutes, internet needed)..."
  python3 -m venv .venv || fail "Creating the Python environment failed."
  "$PY" -m pip install --upgrade pip >/dev/null 2>&1
  "$PY" -m pip install -r requirements.txt || { rm -rf .venv; fail "Installing the Python packages failed. Check the internet connection and try again."; }
fi
# the app runs without a settings file (it keeps its own secret key in instance/secret_key), so none is created
if [ "$NEED_BUILD" = 1 ]; then
  command -v node >/dev/null || fail "The web pages are not built and Node.js is not installed. Use the release zip, or install Node 18 or newer from nodejs.org."
  [ -d frontend/node_modules ] || { echo "Installing web packages (a few minutes)..."; npm --prefix frontend install || fail "Installing the web packages failed."; }
  echo "Building the web pages..."; npm run build:web || fail "Building the web pages failed."
fi
if [ ! -f usls_gs_demo.sqlite3 ]; then echo "Creating the demo data..."; "$PY" app.py --seed || fail "Creating the demo data failed."; fi
echo "Starting the app. The first start is slow, please wait..."
PYTHONUNBUFFERED=1 nohup "$PY" app.py >> instance/app.log 2>&1 &
echo $! > instance/app.pid
for _ in $(seq 1 120); do
  if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then echo "Ready. Opening $URL"; open "$URL"; echo "Run Stop.command when you are finished."; exit 0; fi
  kill -0 "$(cat instance/app.pid)" 2>/dev/null || fail "The app stopped while starting. See instance/app.log for the reason."
  sleep 1
done
fail "The app did not answer after 2 minutes. See instance/app.log. Run Stop.command, then try again."
