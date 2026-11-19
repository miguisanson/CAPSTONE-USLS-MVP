#!/bin/bash
# Turns https://miguisanson.dev ON: starts Docker (Colima) if needed, then the site and the Cloudflare tunnel,
# and keeps the Mac awake until site-stop.sh. Button: "Website ON.command".
source "$(dirname "$0")/site-common.sh"

has_token || { say "PROBLEM: no tunnel token. Put TUNNEL_TOKEN=... in deploy/tunnel.env (see deploy/MAC-SITE.md)."; exit 1; }
ensure_docker || { say "PROBLEM: Docker (Colima) did not start. Try: colima start"; exit 1; }

say "Starting the site and the tunnel (the first time builds the site: several minutes)..."
dc up -d || { say "PROBLEM: docker-compose failed (see above)."; exit 1; }

say "Waiting for the site to answer..."
wait_local || { say "PROBLEM: the site did not answer in 5 minutes. Check: docker-compose logs app"; exit 1; }
keep_awake_on

say "Checking $PUBLIC_URL ..."
if ensure_public; then
    say "Site is ON: $PUBLIC_URL"
else
    say "The site runs here (http://127.0.0.1:8080) but $PUBLIC_URL does not answer. Check: docker-compose --profile tunnel logs tunnel"
    exit 1
fi
