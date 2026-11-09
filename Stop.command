#!/bin/bash
# Stops the USLS Graduate School app started by Start.command. Safe when nothing runs.
cd "$(dirname "$0")" || exit 1
PORT="${FLASK_PORT:-5000}"
DID=0
if [ -f instance/app.pid ]; then
  PID="$(cat instance/app.pid)"
  if kill -0 "$PID" 2>/dev/null; then
    pkill -TERM -P "$PID" 2>/dev/null; kill -TERM "$PID" 2>/dev/null
    for _ in 1 2 3 4 5; do kill -0 "$PID" 2>/dev/null || break; sleep 1; done
    if kill -0 "$PID" 2>/dev/null; then pkill -KILL -P "$PID" 2>/dev/null; kill -KILL "$PID" 2>/dev/null; fi
    DID=1
  fi
fi
OWNER="$(lsof -ti "tcp:$PORT" 2>/dev/null)"
if [ -n "$OWNER" ]; then kill -9 $OWNER 2>/dev/null; DID=1; fi
rm -f instance/app.pid
if [ "$DID" = 1 ]; then echo "Stopped."; else echo "Nothing was running. Stopped."; fi
