#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/setup-ubuntu.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

APP_USER="${APP_USER:-uslsapp}"
APP_GROUP="${APP_GROUP:-uslsapp}"
APP_ROOT="${APP_ROOT:-/opt/usls-gs-mvp}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/usls-gs-mvp/uploads}"
CONFIG_DIR="${CONFIG_DIR:-/etc/usls-gs-mvp}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/usls-gs-mvp}"
NODE_MAJOR="${NODE_MAJOR:-20}"
INSTALL_MYSQL="${INSTALL_MYSQL:-true}"

echo "[1/8] Installing base packages..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git nginx build-essential default-mysql-client openssl

if [[ "${INSTALL_MYSQL}" == "true" ]]; then
  apt-get install -y mysql-server
fi

echo "[2/8] Installing Node.js ${NODE_MAJOR}.x (if needed)..."
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
else
  CURRENT_NODE_MAJOR=""
fi

if [[ "${CURRENT_NODE_MAJOR}" != "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "[3/8] Creating service user and directories..."
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
fi

mkdir -p "${APP_ROOT}" "${UPLOAD_DIR}" "${CONFIG_DIR}" "${BACKUP_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"
chown -R "${APP_USER}:${APP_GROUP}" "$(dirname "${UPLOAD_DIR}")"
chmod 750 "$(dirname "${UPLOAD_DIR}")" "${UPLOAD_DIR}"
chmod 750 "${BACKUP_DIR}"

echo "[4/8] Installing systemd and nginx configs..."
install -m 644 "${REPO_ROOT}/deploy/systemd/usls-gs-mvp-api.service" /etc/systemd/system/usls-gs-mvp-api.service
install -m 644 "${REPO_ROOT}/deploy/nginx/usls-gs-mvp.conf" /etc/nginx/sites-available/usls-gs-mvp.conf

# Allow custom APP_ROOT paths without editing templates manually.
ESCAPED_APP_ROOT="$(printf '%s\n' "${APP_ROOT}" | sed 's/[\/&]/\\&/g')"
sed -i "s|/opt/usls-gs-mvp|${ESCAPED_APP_ROOT}|g" /etc/systemd/system/usls-gs-mvp-api.service
sed -i "s|/opt/usls-gs-mvp|${ESCAPED_APP_ROOT}|g" /etc/nginx/sites-available/usls-gs-mvp.conf

ln -sfn /etc/nginx/sites-available/usls-gs-mvp.conf /etc/nginx/sites-enabled/usls-gs-mvp.conf
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "[5/8] Creating env templates if missing..."
if [[ ! -f "${CONFIG_DIR}/server.env" ]]; then
  cat > "${CONFIG_DIR}/server.env" <<'EOF'
NODE_ENV=production
PORT=4000
DATABASE_URL="mysql://usls_app:CHANGE_ME@127.0.0.1:3306/usls_gs_mvp"
JWT_SECRET="CHANGE_ME_WITH_AT_LEAST_32_CHARACTERS"
JWT_EXPIRES_IN=8h
CLIENT_URL=https://your-domain.example
CORS_ORIGINS=https://your-domain.example,https://www.your-domain.example
PORTAL_BASE_URL=https://your-domain.example
UPLOAD_DIR=/var/lib/usls-gs-mvp/uploads
PRISMA_CLIENT_ENGINE_TYPE=binary
ENABLE_OPENAI_ASSIST=false
OPENAI_MODEL=gpt-4.1-mini
EOF
fi

if [[ ! -f "${CONFIG_DIR}/backup.env" ]]; then
  cat > "${CONFIG_DIR}/backup.env" <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=usls_gs_mvp
DB_USER=usls_app
DB_PASSWORD=CHANGE_ME
BACKUP_DIR=/var/backups/usls-gs-mvp
UPLOAD_DIR=/var/lib/usls-gs-mvp/uploads
BACKUP_UPLOADS=true
RETENTION_DAYS=14
EOF
fi

chown root:"${APP_GROUP}" "${CONFIG_DIR}/server.env" "${CONFIG_DIR}/backup.env"
chmod 640 "${CONFIG_DIR}/server.env" "${CONFIG_DIR}/backup.env"

if [[ ! -f /etc/ssl/certs/usls-origin.crt || ! -f /etc/ssl/private/usls-origin.key ]]; then
  echo "Creating temporary self-signed certificate for nginx bootstrap..."
  mkdir -p /etc/ssl/private
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -subj "/CN=localhost" \
    -keyout /etc/ssl/private/usls-origin.key \
    -out /etc/ssl/certs/usls-origin.crt >/dev/null 2>&1
  chmod 600 /etc/ssl/private/usls-origin.key
  chmod 644 /etc/ssl/certs/usls-origin.crt
fi

echo "[6/8] Validating nginx config..."
nginx -t

echo "[7/8] Enabling services..."
systemctl daemon-reload
systemctl enable nginx
systemctl enable usls-gs-mvp-api
if [[ "${INSTALL_MYSQL}" == "true" ]]; then
  systemctl enable mysql
  systemctl start mysql
fi
systemctl restart nginx

echo "[8/8] Setup complete."
echo "Next steps:"
echo "  1) Clone repo to ${APP_ROOT} and set ownership to ${APP_USER}:${APP_GROUP}"
echo "  2) Edit ${CONFIG_DIR}/server.env and ${CONFIG_DIR}/backup.env"
echo "  3) Run deploy/scripts/deploy.sh as root"
echo "  4) Configure Cloudflare DNS + SSL and install origin cert files"
