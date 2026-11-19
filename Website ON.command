#!/bin/bash
# Double-click: turns https://miguisanson.dev ON (Docker site + Cloudflare tunnel). See deploy/MAC-SITE.md.
"$(dirname "$0")/deploy/site-start.sh"
echo; read -n 1 -s -r -p "Press any key to close this window."
