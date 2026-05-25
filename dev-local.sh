#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_ENV="$SERVER_DIR/.env"
CLIENT_ENV="$CLIENT_DIR/.env"

log() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$*"
}

die() {
  printf "\nError: %s\n" "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found."
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

write_mysql_defaults_file() {
  local database_url="$1"
  local output_file="$2"

  node - "$database_url" "$output_file" <<'NODE'
const fs = require("fs");

const databaseUrl = process.argv[2];
const outputFile = process.argv[3];
const url = new URL(databaseUrl);
const database = decodeURIComponent(url.pathname.replace(/^\//, "").split("?")[0]);

if (!database || !/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error("DATABASE_URL must include a simple database name, for example /usls_gs_mvp");
}

const config = [
  "[client]",
  `user=${decodeURIComponent(url.username)}`,
  `password=${decodeURIComponent(url.password)}`,
  `host=${url.hostname || "localhost"}`,
  `port=${url.port || "3306"}`,
  "protocol=tcp",
  "",
].join("\n");

fs.writeFileSync(outputFile, config, { mode: 0o600 });
console.log(database);
NODE
}

create_database() {
  local mysql_defaults_file="$1"
  local database_name="$2"
  local escaped_database_name

  escaped_database_name="$(printf "%s" "$database_name" | sed 's/`/``/g')"
  mysql --defaults-extra-file="$mysql_defaults_file" \
    -e "CREATE DATABASE IF NOT EXISTS \`$escaped_database_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

query_user_count() {
  local mysql_defaults_file="$1"
  local database_name="$2"

  mysql --defaults-extra-file="$mysql_defaults_file" \
    --database="$database_name" \
    --batch \
    --skip-column-names \
    -e "SELECT COUNT(*) FROM UserAccount;" 2>/dev/null || printf "0"
}

update_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"

  node - "$file" "$key" "$value" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const key = process.argv[3];
const value = process.argv[4];
const original = fs.readFileSync(file, "utf8");
const lines = original.split(/\r?\n/);
let updated = false;

const nextLines = lines.map((line) => {
  if (line.match(new RegExp(`^${key}=`))) {
    updated = true;
    return `${key}="${value}"`;
  }
  return line;
});

if (!updated) {
  if (nextLines[nextLines.length - 1] !== "") {
    nextLines.push("");
  }
  nextLines.push(`${key}="${value}"`);
}

fs.writeFileSync(file, nextLines.join("\n"));
NODE
}

read_env_value() {
  local file="$1"
  local key="$2"

  node - "$file" "$key" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const key = process.argv[3];
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match || match[1] !== key) continue;

  let value = match[2].trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }
  console.log(value);
  process.exit(0);
}
NODE
}

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${CLIENT_PID:-}" ]; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${MYSQL_DEFAULTS_FILE:-}" ]; then
    rm -f "$MYSQL_DEFAULTS_FILE"
  fi
}

trap cleanup INT TERM EXIT

require_command node
require_command npm
if ! command -v mysql >/dev/null 2>&1; then
  die "mysql CLI is required. On macOS, run: brew install mysql && brew services start mysql"
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js 20+ is required. Current version: $(node -v)"
fi

if [ ! -f "$SERVER_ENV" ]; then
  log "Creating server/.env from server/.env.example"
  cp "$SERVER_DIR/.env.example" "$SERVER_ENV"
fi

if [ ! -f "$CLIENT_ENV" ]; then
  log "Creating client/.env from client/.env.example"
  cp "$CLIENT_DIR/.env.example" "$CLIENT_ENV"
fi

INPUT_DATABASE_URL="${DATABASE_URL:-}"
if [ -n "$INPUT_DATABASE_URL" ]; then
  log "Using DATABASE_URL from this shell command"
fi

if grep -q 'JWT_SECRET="replace_with_at_least_32_characters_secret"' "$SERVER_ENV"; then
  log "Generating a local JWT secret"
  update_env_value "$SERVER_ENV" "JWT_SECRET" "$(generate_secret)"
fi

DATABASE_URL="${INPUT_DATABASE_URL:-$(read_env_value "$SERVER_ENV" "DATABASE_URL")}"

if [ -z "${DATABASE_URL:-}" ]; then
  die "DATABASE_URL is missing in server/.env"
fi

MYSQL_DEFAULTS_FILE="$(mktemp)"
DATABASE_NAME="$(write_mysql_defaults_file "$DATABASE_URL" "$MYSQL_DEFAULTS_FILE")"

if ! create_database "$MYSQL_DEFAULTS_FILE" "$DATABASE_NAME" >/dev/null 2>&1; then
  printf "\nCould not connect to MySQL using DATABASE_URL in server/.env:\n%s\n" "$DATABASE_URL"
  if [ -t 0 ]; then
    printf "\nEnter a working MySQL DATABASE_URL, or press Enter to stop:\n"
    read -r NEW_DATABASE_URL
    if [ -z "$NEW_DATABASE_URL" ]; then
      die "Update server/.env with your MySQL credentials, then rerun: bash dev-local.sh"
    fi

    DATABASE_URL="$NEW_DATABASE_URL"
    DATABASE_NAME="$(write_mysql_defaults_file "$DATABASE_URL" "$MYSQL_DEFAULTS_FILE")"
    create_database "$MYSQL_DEFAULTS_FILE" "$DATABASE_NAME" >/dev/null 2>&1 || \
      die "Still could not connect to MySQL. Check that MySQL is running and the credentials are correct."
    update_env_value "$SERVER_ENV" "DATABASE_URL" "$DATABASE_URL"
  else
    die "Set DATABASE_URL inline, for example: DATABASE_URL='mysql://root:password@localhost:3306/usls_gs_mvp' bash dev-local.sh"
  fi
fi

if [ -n "$INPUT_DATABASE_URL" ]; then
  update_env_value "$SERVER_ENV" "DATABASE_URL" "$DATABASE_URL"
fi

log "Installing backend dependencies"
(cd "$SERVER_DIR" && npm install)

log "Preparing database"
(cd "$SERVER_DIR" && npx prisma generate && npx prisma migrate deploy)

USER_COUNT="$(query_user_count "$MYSQL_DEFAULTS_FILE" "$DATABASE_NAME" | tr -d '[:space:]')"
if [ "${USER_COUNT:-0}" = "0" ]; then
  log "Seeding demo data"
  (cd "$SERVER_DIR" && npm run seed)
else
  log "Skipping seed because the database already has users"
fi

log "Installing frontend dependencies"
(cd "$CLIENT_DIR" && npm install)

log "Starting backend at http://localhost:4000"
(cd "$SERVER_DIR" && npm run dev) &
SERVER_PID="$!"

log "Starting frontend at http://localhost:5173"
(cd "$CLIENT_DIR" && npm run dev -- --host 0.0.0.0) &
CLIENT_PID="$!"

printf "\nLocal app is starting:\n"
printf "  Frontend: http://localhost:5173\n"
printf "  Backend:  http://localhost:4000/health\n"
printf "\nPress Ctrl+C to stop both servers.\n\n"

while kill -0 "$SERVER_PID" >/dev/null 2>&1 && kill -0 "$CLIENT_PID" >/dev/null 2>&1; do
  sleep 1
done
