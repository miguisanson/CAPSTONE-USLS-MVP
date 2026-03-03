#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/setup.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

APP_ROOT="${APP_ROOT:-${REPO_ROOT}}"
APP_USER="${APP_USER:-uslsapp}"
APP_GROUP="${APP_GROUP:-uslsapp}"
BRANCH="${BRANCH:-main}"
INSTALL_MYSQL="${INSTALL_MYSQL:-true}"
DEMO_SEED="${DEMO_SEED:-true}"
SOURCE_MODE="${SOURCE_MODE:-local}" # local or git

DOMAIN="${DOMAIN:-localhost}"
if [[ "${DOMAIN}" =~ ^https?:// ]]; then
  DOMAIN="${DOMAIN#http://}"
  DOMAIN="${DOMAIN#https://}"
fi
DOMAIN="${DOMAIN%%/*}"

DB_NAME="${DB_NAME:-usls_gs_mvp}"
DB_USER="${DB_USER:-usls_app}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 12)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

CONFIG_DIR="${CONFIG_DIR:-/etc/usls-gs-mvp}"
SERVER_ENV="${CONFIG_DIR}/server.env"
BACKUP_ENV="${CONFIG_DIR}/backup.env"

set_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "${file}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${file}"
  else
    echo "${key}=${value}" >> "${file}"
  fi
}

echo "[1/7] Running base Ubuntu setup..."
APP_ROOT="${APP_ROOT}" APP_USER="${APP_USER}" APP_GROUP="${APP_GROUP}" INSTALL_MYSQL="${INSTALL_MYSQL}" \
  bash "${SCRIPT_DIR}/setup-ubuntu.sh"

if [[ "${INSTALL_MYSQL}" == "true" ]]; then
  echo "[2/7] Creating MySQL database and app user..."
  systemctl start mysql
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
else
  echo "[2/7] Skipping local MySQL setup (INSTALL_MYSQL=${INSTALL_MYSQL})."
fi

echo "[3/7] Updating service environment files..."
BASE_URL="https://${DOMAIN}"
CORS_LIST="${BASE_URL}"

if [[ "${DOMAIN}" != "localhost" && "${DOMAIN}" != "127.0.0.1" && "${DOMAIN}" != "0.0.0.0" && "${DOMAIN}" != "::1" ]]; then
  CORS_LIST="${CORS_LIST},https://www.${DOMAIN}"
fi

set_env_var "${SERVER_ENV}" "NODE_ENV" "production"
set_env_var "${SERVER_ENV}" "PORT" "4000"
set_env_var "${SERVER_ENV}" "DATABASE_URL" "\"mysql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:3306/${DB_NAME}\""
set_env_var "${SERVER_ENV}" "JWT_SECRET" "\"${JWT_SECRET}\""
set_env_var "${SERVER_ENV}" "JWT_EXPIRES_IN" "8h"
set_env_var "${SERVER_ENV}" "CLIENT_URL" "${BASE_URL}"
set_env_var "${SERVER_ENV}" "CORS_ORIGINS" "${CORS_LIST}"
set_env_var "${SERVER_ENV}" "PORTAL_BASE_URL" "${BASE_URL}"
set_env_var "${SERVER_ENV}" "UPLOAD_DIR" "/var/lib/usls-gs-mvp/uploads"
set_env_var "${SERVER_ENV}" "PRISMA_CLIENT_ENGINE_TYPE" "binary"
set_env_var "${SERVER_ENV}" "ENABLE_OPENAI_ASSIST" "false"

set_env_var "${BACKUP_ENV}" "DB_HOST" "127.0.0.1"
set_env_var "${BACKUP_ENV}" "DB_PORT" "3306"
set_env_var "${BACKUP_ENV}" "DB_NAME" "${DB_NAME}"
set_env_var "${BACKUP_ENV}" "DB_USER" "${DB_USER}"
set_env_var "${BACKUP_ENV}" "DB_PASSWORD" "${DB_PASSWORD}"
set_env_var "${BACKUP_ENV}" "BACKUP_DIR" "/var/backups/usls-gs-mvp"
set_env_var "${BACKUP_ENV}" "UPLOAD_DIR" "/var/lib/usls-gs-mvp/uploads"
set_env_var "${BACKUP_ENV}" "BACKUP_UPLOADS" "true"
set_env_var "${BACKUP_ENV}" "RETENTION_DAYS" "14"

chown root:"${APP_GROUP}" "${SERVER_ENV}" "${BACKUP_ENV}"
chmod 640 "${SERVER_ENV}" "${BACKUP_ENV}"

echo "[4/7] Updating nginx domain..."
NGINX_SITE="/etc/nginx/sites-available/usls-gs-mvp.conf"
sed -i -E "s|server_name[[:space:]]+[^;]+;|server_name ${DOMAIN};|g" "${NGINX_SITE}"
nginx -t
systemctl reload nginx

echo "[5/7] Deploying backend/frontend and running migrations..."
APP_ROOT="${APP_ROOT}" APP_USER="${APP_USER}" APP_GROUP="${APP_GROUP}" DEMO_SEED="${DEMO_SEED}" SOURCE_MODE="${SOURCE_MODE}" \
  bash "${SCRIPT_DIR}/deploy.sh" "${BRANCH}"

echo "[6/7] Starting services..."
if systemctl list-unit-files | grep -q "^mysql.service"; then
  systemctl restart mysql
fi
systemctl restart usls-gs-mvp-api
systemctl restart nginx

echo "[7/7] Verifying health..."
curl -fsS http://127.0.0.1:4000/health >/dev/null
echo "Setup completed successfully."
echo "Portal URL: ${BASE_URL}"
echo "API health: http://127.0.0.1:4000/health"
echo ""
echo "Demo login password: DemoPass123!"
echo "  admin@gs.local"
echo "  staff@gs.local"
echo "  acad.coord@gs.local"
echo "  research.coord@gs.local"
echo "  adviser.one@gs.local"
echo "  panel.one@gs.local"
echo "  student1@gs.local"
