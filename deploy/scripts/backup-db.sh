#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CONFIG_FILE:-/etc/usls-gs-mvp/backup.env}"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Missing backup config: ${CONFIG_FILE}"
  exit 1
fi

set -a
source "${CONFIG_FILE}"
set +a

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

BACKUP_UPLOADS="${BACKUP_UPLOADS:-false}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}" || true

DB_BACKUP_FILE="${BACKUP_DIR}/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "Creating database backup: ${DB_BACKUP_FILE}"
MYSQL_PWD="${DB_PASSWORD}" mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --single-transaction \
  --quick \
  --routines \
  --events \
  "${DB_NAME}" | gzip -9 > "${DB_BACKUP_FILE}"

if [[ "${BACKUP_UPLOADS,,}" == "true" && -n "${UPLOAD_DIR:-}" && -d "${UPLOAD_DIR}" ]]; then
  UPLOAD_BACKUP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
  echo "Creating uploads backup: ${UPLOAD_BACKUP_FILE}"
  tar -C "$(dirname "${UPLOAD_DIR}")" -czf "${UPLOAD_BACKUP_FILE}" "$(basename "${UPLOAD_DIR}")"
fi

echo "Cleaning up backups older than ${RETENTION_DAYS} day(s)..."
find "${BACKUP_DIR}" -type f -name "*.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup completed."
