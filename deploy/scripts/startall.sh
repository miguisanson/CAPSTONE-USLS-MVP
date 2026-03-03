#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/startall.sh"
  exit 1
fi

CONFIG_DIR="${CONFIG_DIR:-/etc/usls-gs-mvp}"
SERVER_ENV="${CONFIG_DIR}/server.env"
API_SERVICE="${API_SERVICE:-usls-gs-mvp-api}"
APP_ROOT="${APP_ROOT:-/opt/usls-gs-mvp}"
APP_USER="${APP_USER:-uslsapp}"
APP_GROUP="${APP_GROUP:-uslsapp}"
SERVER_ENTRY="${APP_ROOT}/server/dist/src/index.js"
CLIENT_ENTRY="${APP_ROOT}/client/dist/index.html"
DEMO_SEED="${DEMO_SEED:-false}"

if [[ -f "${SERVER_ENV}" ]]; then
  set -a
  source "${SERVER_ENV}"
  set +a
fi

PORTAL_URL="${PORTAL_BASE_URL:-https://localhost}"

if ! systemctl list-unit-files | grep -q "^${API_SERVICE}.service"; then
  echo "Missing ${API_SERVICE}.service."
  echo "Run setup first: sudo bash ${APP_ROOT}/deploy/scripts/setup.sh"
  exit 1
fi

if [[ ! -f "${SERVER_ENTRY}" || ! -f "${CLIENT_ENTRY}" ]]; then
  echo "Build artifacts missing. Running local deploy first..."
  APP_ROOT="${APP_ROOT}" APP_USER="${APP_USER}" APP_GROUP="${APP_GROUP}" DEMO_SEED="${DEMO_SEED}" SOURCE_MODE=local \
    bash "${APP_ROOT}/deploy/scripts/deploy.sh" main
fi

echo "[1/4] Starting database (if installed)..."
if systemctl list-unit-files | grep -q "^mysql.service"; then
  systemctl start mysql
fi

echo "[2/4] Starting API service..."
systemctl start "${API_SERVICE}"

echo "[3/4] Starting Nginx (frontend + reverse proxy)..."
systemctl start nginx

echo "[4/4] Health checks..."
if curl -fsS http://127.0.0.1:4000/health >/dev/null; then
  echo "API is healthy: http://127.0.0.1:4000/health"
else
  echo "API health check failed."
  journalctl -u "${API_SERVICE}" -n 80 --no-pager || true
  exit 1
fi

if curl -kfsS "${PORTAL_URL}" >/dev/null; then
  echo "Website is reachable: ${PORTAL_URL}"
else
  echo "Website check failed at ${PORTAL_URL} (this can happen if SSL/domain is not finalized yet)."
fi

if [[ "${OPEN_BROWSER:-false}" == "true" ]] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${PORTAL_URL}" >/dev/null 2>&1 || true
fi

echo "All services started."
