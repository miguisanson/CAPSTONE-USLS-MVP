#!/bin/sh
# Build the demo data once (first start); every later start keeps what is in /data.
set -e
mkdir -p /data/uploads
if [ ! -f /data/usls_gs_demo.sqlite3 ]; then
    echo "No database yet: building the demo data..."
    python app.py --seed
fi
exec "$@"
