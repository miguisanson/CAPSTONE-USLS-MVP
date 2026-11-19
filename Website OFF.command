#!/bin/bash
# Double-click: turns https://miguisanson.dev OFF (Docker site + Cloudflare tunnel). See deploy/MAC-SITE.md.
"$(dirname "$0")/deploy/site-stop.sh"
echo; read -n 1 -s -r -p "Press any key to close this window."
