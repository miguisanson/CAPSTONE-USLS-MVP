#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/deploy.sh [branch]"
  exit 1
fi

BRANCH="${1:-main}"
APP_USER="${APP_USER:-uslsapp}"
APP_GROUP="${APP_GROUP:-uslsapp}"
APP_ROOT="${APP_ROOT:-/opt/usls-gs-mvp}"
SERVER_DIR="${APP_ROOT}/server"
CLIENT_DIR="${APP_ROOT}/client"
ENV_FILE="${ENV_FILE:-/etc/usls-gs-mvp/server.env}"
API_SERVICE="${API_SERVICE:-usls-gs-mvp-api}"
DEMO_SEED="${DEMO_SEED:-false}"
SOURCE_MODE="${SOURCE_MODE:-local}" # local or git

if [[ ! -d "${SERVER_DIR}" || ! -d "${CLIENT_DIR}" ]]; then
  echo "Missing app folders in APP_ROOT=${APP_ROOT}. Expected: ${SERVER_DIR} and ${CLIENT_DIR}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

echo "[1/8] Preparing application files..."
chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"

if [[ "${SOURCE_MODE}" == "git" ]]; then
  if [[ ! -d "${APP_ROOT}/.git" ]]; then
    echo "SOURCE_MODE=git but no .git directory found in ${APP_ROOT}"
    exit 1
  fi
  git -C "${APP_ROOT}" fetch --all --prune
  git -C "${APP_ROOT}" checkout "${BRANCH}"
  git -C "${APP_ROOT}" pull --ff-only origin "${BRANCH}"
else
  echo "SOURCE_MODE=local: skipping git fetch/checkout/pull"
fi

echo "[2/8] Installing backend dependencies..."
runuser -u "${APP_USER}" -- bash -lc "cd '${SERVER_DIR}' && npm ci"

echo "[3/8] Generating Prisma client and applying migrations..."
runuser -u "${APP_USER}" -- bash -lc "set -a && source '${ENV_FILE}' && set +a && cd '${SERVER_DIR}' && npx prisma generate && npx prisma migrate deploy"

if [[ "${DEMO_SEED,,}" == "true" ]]; then
  echo "[4/8] Running seed in demo mode..."
  runuser -u "${APP_USER}" -- bash -lc "set -a && source '${ENV_FILE}' && set +a && cd '${SERVER_DIR}' && npm run seed"
else
  echo "[4/8] Skipping seed (DEMO_SEED=false)..."
fi

echo "[5/8] Building backend..."
runuser -u "${APP_USER}" -- bash -lc "cd '${SERVER_DIR}' && npm run build"

echo "[6/8] Installing frontend dependencies and building static site..."
runuser -u "${APP_USER}" -- bash -lc "cd '${CLIENT_DIR}' && npm ci && VITE_API_BASE_URL='/' npm run build"

echo "[7/8] Ensuring upload directory permissions..."
UPLOAD_DIR="$(grep -E '^UPLOAD_DIR=' "${ENV_FILE}" | head -n1 | cut -d'=' -f2- | tr -d '"' || true)"
if [[ -n "${UPLOAD_DIR}" ]]; then
  mkdir -p "${UPLOAD_DIR}"
  chown -R "${APP_USER}:${APP_GROUP}" "${UPLOAD_DIR}"
  chmod 750 "${UPLOAD_DIR}"
fi

echo "[8/8] Restarting services..."
systemctl daemon-reload
systemctl restart "${API_SERVICE}"
nginx -t
systemctl reload nginx

echo "Deployment complete."
echo "Check:"
echo "  systemctl status ${API_SERVICE}"
echo "  journalctl -u ${API_SERVICE} -n 100 --no-pager"
echo "  curl -I http://127.0.0.1:4000/health"
