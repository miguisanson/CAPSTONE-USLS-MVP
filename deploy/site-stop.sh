#!/bin/bash
# Turns https://miguisanson.dev OFF: stops the site and the tunnel, then Docker (Colima) to free memory.
# The demo data stays in the Docker volume for next time. Button: "Website OFF.command".
source "$(dirname "$0")/site-common.sh"

if docker_up; then
    say "Stopping the site and the tunnel..."
    dc stop
    say "Stopping Docker (Colima)..."
    colima stop >/dev/null 2>&1
fi
keep_awake_off
say "Site is OFF. The Mac can sleep normally again."
