#!/bin/bash
# Shared helpers for site-start.sh and site-stop.sh (macOS; source this file).
# Docker runs inside Colima (a small Linux VM, no Docker Desktop window). The site is two containers:
# app (the website, http://127.0.0.1:8080 on this Mac only) and tunnel (Cloudflare -> https://miguisanson.dev).

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"   # Finder and launchd start with a bare PATH
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1       # the project folder
mkdir -p instance
PUBLIC_URL="https://miguisanson.dev"
LOCAL_HEALTH="http://127.0.0.1:8080/api/health"
AWAKE_PID=instance/site-caffeinate.pid

say() { echo "$(date '+%Y-%m-%d %H:%M') $*"; }
dc() { docker-compose --profile tunnel "$@"; }

docker_up() { docker info >/dev/null 2>&1; }

# Starts the Colima VM if Docker is not answering (first start: 4 CPUs, 4 GB memory, 40 GB disk).
ensure_docker() {
    docker_up && return 0
    say "Starting Docker (Colima, about 30 seconds; details in instance/colima.log)..."
    if colima list 2>/dev/null | grep -q '^default'; then colima start; else colima start --cpu 4 --memory 4 --disk 40; fi >> instance/colima.log 2>&1
    for _ in $(seq 1 30); do docker_up && return 0; sleep 2; done
    return 1
}

has_token() {
    grep -qE '^TUNNEL_TOKEN=[A-Za-z0-9_=-]{40,}' deploy/tunnel.env 2>/dev/null \
        || grep -qE '^TUNNEL_TOKEN=[A-Za-z0-9_=-]{40,}' .env 2>/dev/null
}

wait_local() {   # up to 5 minutes; stops early when the app container has exited
    for _ in $(seq 1 60); do
        curl -fsS -m 5 "$LOCAL_HEALTH" >/dev/null 2>&1 && return 0
        [ "$(docker inspect -f '{{.State.Status}}' capstone-usls-mvp-app-1 2>/dev/null)" = exited ] && return 1
        sleep 5
    done
    return 1
}

public_ok() { curl -fsS -m 10 "$PUBLIC_URL/api/health" >/dev/null 2>&1; }

# I-352: after a rebuild the tunnel can stay disconnected (Cloudflare error 1033); restart it once.
ensure_public() {
    for _ in 1 2 3 4 5 6; do public_ok && return 0; sleep 10; done
    say "The public address does not answer yet: restarting the tunnel..."
    dc restart tunnel >/dev/null
    for _ in $(seq 1 12); do public_ok && return 0; sleep 10; done
    return 1
}

# Keeps the Mac from idle-sleeping while the site is on (plugged in). Closing the lid still sleeps it.
keep_awake_on() {
    { [ -f "$AWAKE_PID" ] && kill -0 "$(cat "$AWAKE_PID")" 2>/dev/null; } && return 0
    nohup caffeinate -is >/dev/null 2>&1 &
    echo $! > "$AWAKE_PID"
}
keep_awake_off() {
    [ -f "$AWAKE_PID" ] && kill "$(cat "$AWAKE_PID")" 2>/dev/null
    rm -f "$AWAKE_PID"
}
