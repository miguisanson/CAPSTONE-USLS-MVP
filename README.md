# Graduate Student Lifecycle Monitoring & Analytics Platform (MVP)

Full-stack MVP for a Graduate School monitoring and decision-support layer (not a full SIS replacement).

This implementation was built from scratch in `/server` and `/client`.  
The sample folder `USLS_GS_MVP_WebPrototype` is left untouched and is not used by this app.

## Tech Stack

- Frontend: React + TypeScript + Tailwind CSS + Chart.js
- Backend: Node.js + Express.js (REST API)
- Auth: JWT (RFC 7519)
- Database: MySQL 8 (InnoDB)
- ORM/Migrations: Prisma
- Notifications: SMTP (safe, non-sensitive emails with portal link only)
- Audit: append-only `AuditLog` table
- Optional AI helper: OpenAI Responses API behind feature flag (`ENABLE_OPENAI_ASSIST=false` by default)

## Folder Structure

```text
CAPSTONE-USLS-MVP/
  client/                      # React app
    src/
      app/                     # Router, layout, auth context
      api/                     # Axios client + endpoint wrappers
      components/              # Reusable UI blocks
      pages/                   # MVP screens (dashboard, students, tasks, docs, etc.)
      types/                   # Frontend domain types
      utils/                   # format/role helpers
  server/                      # Express API
    src/
      config/                  # env + role config
      lib/                     # prisma client, audit helper, mailer, jwt helper
      middleware/              # authenticate, authorize, error handlers
      modules/                 # auth, users, students, milestones, tasks, etc.
      jobs/                    # monitoring cron registration
      utils/                   # async handler, decision support, scoping helpers
    prisma/
      schema.prisma            # data model
      migrations/              # SQL migration
      seed.ts                  # realistic demo seed
    tests/                     # jest + supertest API tests
```

## Key API Routes

- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout-me`
- Users (admin): `GET/POST /api/users`, `PATCH /api/users/:id`
- Students: `GET /api/students`, `GET /api/students/:id`, `PATCH /api/students/:id/stage`
- Students (self): `GET /api/students/me`
- Milestones: `GET/POST/PATCH /api/milestones`
- Student milestone status: `PATCH /api/students/:id/milestones/:milestoneId`
- Tasks: `GET /api/tasks/my`, `GET /api/tasks/team`, `POST /api/tasks`, `POST /api/tasks/:id/decision`
- Documents: `GET/POST /api/students/:id/documents`, `GET /api/documents/my`, `POST /api/documents/:id/versions`, `GET /api/documents/versions/:id/download`, `POST /api/documents/:id/comments`
- Scheduling: `GET /api/scheduling/requests`, `POST /api/scheduling/requests`, `POST /api/scheduling/availability`, `POST /api/scheduling/events`
- Alerts/Monitoring: `GET /api/alerts`, `POST /api/alerts/run-monitoring`, `POST /api/alerts/:id/interventions`, `PATCH /api/alerts/interventions/:id/close`
- Analytics descriptive: `GET /api/analytics/descriptive` (legacy alias: `GET /api/analytics/dashboard`)
- Analytics prescriptive: `POST /api/analytics/prescriptive`
- Analytics exports: `GET /api/analytics/report.csv`, `GET /api/analytics/report-view`
- Audit logs: `GET /api/audit` (legacy alias: `GET /api/audit-logs`)
- Admin config: `GET/POST/PATCH /api/admin/thresholds`, `GET/POST/PATCH /api/admin/routing-rules`

## MVP Screens Implemented

- Login
- Role-based dashboard home
- Students list with filters
- Student profile (stage, milestones, timeline, tasks, alerts)
- Task queue (my/team, decisions)
- Documents page (checklist, versions, revision notes)
- Scheduling page (request, availability, outcomes)
- Monitoring/alerts page (risk signals, interventions, closure)
- Analytics page (charts, tables, CSV export, printable report view)
- Audit log page
- Admin config (milestones, thresholds, routing rules, user management)

## Setup (Windows / PowerShell)

### 1) Prerequisites

- Node.js 20+ (Node 22 tested)
- npm 10+
- MySQL 8 server running locally
- MySQL CLI client (`mysql.exe`) available in PATH (needed for SQL import method)

### 2) Create database

```sql
CREATE DATABASE usls_gs_mvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3) Backend `.env` setup

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\server
Copy-Item .env.example .env
```

Edit `server\.env` and set at minimum:

- `DATABASE_URL="mysql://<user>:<password>@localhost:3306/usls_gs_mvp"`
- `JWT_SECRET="<at least 32 chars>"`
- Keep `PRISMA_CLIENT_ENGINE_TYPE=library` (recommended for cross-platform local development)

If your machine has a global env var overriding Prisma engine mode, set it to library:

```powershell
[Environment]::SetEnvironmentVariable("PRISMA_CLIENT_ENGINE_TYPE","library","User")
```

### 4) Backend install + DB prepare + run

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\server
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

Backend URL: `http://localhost:4000`  
Health check: `http://localhost:4000/health`

### 5) Frontend setup + run

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\client
Copy-Item .env.example .env
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

<<<<<<< Updated upstream
=======
## Ubuntu VM Deployment (Proxmox)

This project can be deployed on Ubuntu Server 22.04/24.04 without Docker.

### Deployment architecture (explicit decisions)

1. Frontend serving:
   - Build React app (`client/dist`) with `npm run build`.
   - Serve static files via Nginx.
2. Backend serving:
   - Run Node API as systemd service on `127.0.0.1:4000`.
   - Nginx reverse-proxies `/api/*` and `/health` to backend.
3. HTTPS with Cloudflare:
   - Recommended: Cloudflare SSL mode `Full (strict)`.
   - Install Cloudflare Origin Certificate on Nginx.
   - Alternate: Let's Encrypt (if Cloudflare proxy is off, or DNS challenge is used).

### Files provided for deployment

- Nginx vhost: `deploy/nginx/usls-gs-mvp.conf`
- Systemd unit: `deploy/systemd/usls-gs-mvp-api.service`
- Ubuntu setup script: `deploy/scripts/setup-ubuntu.sh`
- One-word full setup wrapper: `deploy/scripts/setup.sh`
- Start-all services script: `deploy/scripts/startall.sh`
- Deploy/update script: `deploy/scripts/deploy.sh`
- Backup script: `deploy/scripts/backup-db.sh`
- Cron sample: `deploy/scripts/cron-backup.example`

### 1) Prepare VM and clone repository

Run on Ubuntu VM:

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone <YOUR_REPO_URL> usls-gs-mvp
sudo chown -R $USER:$USER /opt/usls-gs-mvp
cd /opt/usls-gs-mvp
```

Quick fully automatic path (no manual step-by-step):

```bash
cd /opt/usls-gs-mvp
sudo DOMAIN=your-domain.example BRANCH=main DEMO_SEED=true bash deploy/scripts/setup.sh
```

This single command installs dependencies, creates DB/user, writes env files, applies migrations, builds server/client, seeds demo users, and starts all services.
It works with local files already on disk (no `git pull` required).

### 2) One-time server bootstrap (idempotent)

```bash
cd /opt/usls-gs-mvp
sudo bash deploy/scripts/setup-ubuntu.sh
```

This installs:
- Node.js 20 LTS (if needed)
- Nginx
- MySQL 8 (default; set `INSTALL_MYSQL=false` before running to skip)
- systemd + nginx config files
- config templates:
  - `/etc/usls-gs-mvp/server.env`
  - `/etc/usls-gs-mvp/backup.env`

### 3) MySQL secure setup and app database/user

```bash
sudo mysql_secure_installation
```

Create DB + least-privilege user:

```bash
sudo mysql -u root -p <<'SQL'
CREATE DATABASE IF NOT EXISTS usls_gs_mvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'usls_app'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON usls_gs_mvp.* TO 'usls_app'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

For external MySQL, set `DATABASE_URL` host/user in `/etc/usls-gs-mvp/server.env`.

### 4) Configure backend environment

Edit:

```bash
sudo nano /etc/usls-gs-mvp/server.env
```

Minimum required:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL="mysql://usls_app:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:3306/usls_gs_mvp"
JWT_SECRET="CHANGE_ME_WITH_AT_LEAST_32_CHARACTERS"
JWT_EXPIRES_IN=8h
CLIENT_URL=https://your-domain.example
CORS_ORIGINS=https://your-domain.example,https://www.your-domain.example
PORTAL_BASE_URL=https://your-domain.example
UPLOAD_DIR=/var/lib/usls-gs-mvp/uploads
PRISMA_CLIENT_ENGINE_TYPE=library
ENABLE_OPENAI_ASSIST=false
OPENAI_MODEL=gpt-4.1-mini
```

Notes:
- Do not use wildcard CORS in production.
- OpenAI stays disabled by default.
- If enabling OpenAI, set `OPENAI_API_KEY` and keep prescriptive payload de-identified/aggregated only.

### 5) Build + migrate + start services

```bash
cd /opt/usls-gs-mvp
sudo APP_ROOT=/opt/usls-gs-mvp APP_USER=uslsapp bash deploy/scripts/deploy.sh main
```

`deploy.sh` defaults to `SOURCE_MODE=local`, so it does not require a git repository.
If you want git-based updates, run with `SOURCE_MODE=git`.

Demo mode seed (optional, not for real production):

```bash
cd /opt/usls-gs-mvp
sudo DEMO_SEED=true APP_ROOT=/opt/usls-gs-mvp APP_USER=uslsapp bash deploy/scripts/deploy.sh main
```

Start everything again after a VM reboot:

```bash
cd /opt/usls-gs-mvp
sudo bash deploy/scripts/startall.sh
```

`startall.sh` starts MySQL (if installed), API service, and Nginx (which serves the built client).

### 6) Cloudflare + HTTPS (recommended path)

1. In Cloudflare DNS:
   - Create `A` record for `your-domain.example` -> VM public IP.
   - Keep proxy enabled (orange cloud).
2. In Cloudflare SSL/TLS:
   - Set mode to `Full (strict)`.
3. Create Cloudflare Origin Certificate:
   - Save cert to `/etc/ssl/certs/usls-origin.crt`
   - Save key to `/etc/ssl/private/usls-origin.key`
   - Secure key:

```bash
sudo chown root:root /etc/ssl/certs/usls-origin.crt /etc/ssl/private/usls-origin.key
sudo chmod 644 /etc/ssl/certs/usls-origin.crt
sudo chmod 600 /etc/ssl/private/usls-origin.key
```

4. Update `server_name` in `/etc/nginx/sites-available/usls-gs-mvp.conf`.
5. Validate/reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Alternate HTTPS:
- Let's Encrypt is possible if Cloudflare proxy is disabled (DNS-only) or DNS challenge is configured.

### 7) API service and logs

Service:
- Name: `usls-gs-mvp-api`
- Unit file: `/etc/systemd/system/usls-gs-mvp-api.service`
- Env file: `/etc/usls-gs-mvp/server.env`
- Logs: `journalctl -u usls-gs-mvp-api`

Useful commands:

```bash
sudo systemctl status usls-gs-mvp-api
sudo journalctl -u usls-gs-mvp-api -f
sudo systemctl restart usls-gs-mvp-api
```

### 8) Backup strategy (DB + uploads)

Edit backup config:

```bash
sudo nano /etc/usls-gs-mvp/backup.env
```

Run backup manually:

```bash
sudo bash /opt/usls-gs-mvp/deploy/scripts/backup-db.sh
```

Enable cron:

```bash
sudo crontab -e
```

Use line from `deploy/scripts/cron-backup.example`, for example:

```cron
30 2 * * * /bin/bash /opt/usls-gs-mvp/deploy/scripts/backup-db.sh >> /var/log/usls-gs-mvp-backup.log 2>&1
```

### 9) Update and rollback procedure

Update after code changes:

```bash
cd /opt/usls-gs-mvp
sudo APP_ROOT=/opt/usls-gs-mvp APP_USER=uslsapp bash deploy/scripts/deploy.sh main
```

What this does:
- `git pull`
- backend/client dependency install
- `prisma generate`
- `prisma migrate deploy`
- backend + frontend build
- restart API service
- reload Nginx

Rollback (recommended):
1. Restore DB backup from `backup-db.sh`.
2. Restore uploads backup tarball (if used).
3. Checkout prior known-good git tag/commit.
4. Re-run deploy script for that commit.

### 10) Verification checklist

API health:

```bash
curl -sS http://127.0.0.1:4000/health
curl -sS https://your-domain.example/health
```

Nginx + service:

```bash
sudo nginx -t
sudo systemctl status nginx usls-gs-mvp-api
```

Database:

```bash
mysql -u usls_app -p -h 127.0.0.1 -D usls_gs_mvp -e "SHOW TABLES;"
```

Login:
- Open `https://your-domain.example`
- Sign in with demo accounts below (if seeded)

### 11) Troubleshooting

- Port checks:
  - `sudo ss -tulpn | grep -E ':80|:443|:4000|:3306'`
- API logs:
  - `sudo journalctl -u usls-gs-mvp-api -n 200 --no-pager`
- Nginx logs:
  - `sudo tail -f /var/log/nginx/error.log /var/log/nginx/access.log`
- CORS issues:
  - verify `CORS_ORIGINS` exactly matches browser origin(s)
- Prisma errors:
  - verify `DATABASE_URL` and run `npx prisma migrate deploy`
- Upload failures:
  - verify `UPLOAD_DIR=/var/lib/usls-gs-mvp/uploads`
  - verify ownership/permission for `uslsapp`

>>>>>>> Stashed changes
## Demo Login Accounts

Password for all demo users: `DemoPass123!`

- `ADMIN`: `admin@gs.local`
- `GRADUATE_SCHOOL_STAFF`: `staff@gs.local`
- `ACADEMIC_COORDINATOR`: `acad.coord@gs.local`
- `RESEARCH_COORDINATOR`: `research.coord@gs.local`
- `ADVISER`: `adviser.one@gs.local`
- `PANEL_MEMBER`: `panel.one@gs.local`
- `STUDENT`: `student1@gs.local`

Seed also creates additional users/students for richer demo data.

## Role Permissions (Backend-Enforced)

| Capability | Admin | Staff / Coordinators | Adviser | Panel | Student |
|---|---|---|---|---|---|
| View student list | ✅ all | ✅ broad scope | ✅ assigned only | ✅ assigned only | ❌ |
| View student profile | ✅ all | ✅ broad scope | ✅ assigned only | ✅ assigned only | ✅ own only (`/api/students/me`) |
| Update lifecycle stage | ✅ | ✅ | ✅ assigned only | ❌ | ❌ |
| Team task queue | ✅ | ✅ | ❌ | ❌ | ❌ |
| Decide tasks | ✅ | ✅ | ✅ assigned tasks/cases | ✅ assigned tasks/cases | ❌ |
| Create document checklist records | ✅ | ✅ | ✅ assigned only | ❌ | ❌ |
| Upload document version | ✅ | ✅ | ✅ assigned only | ❌ | ✅ own + allowed checklist only |
| Download document version | ✅ | ✅ | ✅ assigned only | ✅ assigned only | ✅ own only |
| Analytics descriptive/prescriptive | ✅ | ✅ | ❌ (default) | ❌ (default) | ❌ |
| Audit log viewer | ✅ | ✅ | ❌ | ❌ | ❌ |

Notes:
- RBAC is enforced in backend route handlers and policy checks, not just in frontend navigation.
- Access denied events are written to `AuditLog`.
- IDOR checks are enforced by validating `studentId/taskId/docVersionId` ownership/assignment relationships server-side.

## Database Import / Schema Options

Use only one primary source-of-truth approach for a given environment.

### Method 1 (Recommended for MVP/dev): Prisma migrations

Use when starting fresh from app schema:

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\server
npx prisma generate
npx prisma migrate deploy
npm run seed
```

- `schema.prisma` is the source of truth.
- Best for repeatable local setup and team onboarding.

### Method 2: Import an existing MySQL SQL dump

Use when you already have a MySQL dump file (example names):

- `USLS_GS_MySQLWorkbench_Schema.sql`
- exported SQL from Workbench

Note: `.mwb` is a MySQL Workbench model file, not directly importable by the app.  
Export SQL from `.mwb` first, then import the `.sql`.

#### Option A: direct mysql command

```powershell
mysql -u <user> -p -h localhost -P 3306 -e "CREATE DATABASE IF NOT EXISTS usls_gs_mvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <user> -p -h localhost -P 3306 usls_gs_mvp < "C:\path\to\USLS_GS_MySQLWorkbench_Schema.sql"
```

#### Option B: helper script (included)

Script: [import-sql.ps1](e:/Github_Projects/CAPSTONE-USLS-MVP/server/scripts/import-sql.ps1)

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\server
.\scripts\import-sql.ps1 -DbName usls_gs_mvp -User root -Host localhost -Port 3306 -SqlPath "C:\path\to\USLS_GS_MySQLWorkbench_Schema.sql"
```

Or via npm script:

```powershell
npm run import:sql -- -DbName usls_gs_mvp -User root -Host localhost -Port 3306 -SqlPath "C:\path\to\USLS_GS_MySQLWorkbench_Schema.sql"
```

After SQL import:

1. Point `DATABASE_URL` to that DB in `server\.env`.
2. Decide schema authority:
- Keep imported DB as authoritative: optional `npx prisma db pull` to introspect.
- Keep Prisma schema authoritative: prefer migrations and avoid mixing both workflows unless necessary.

### If your schema/dump files are missing

If files like `USLS_GS_MySQLWorkbench_Schema.sql` or `.mwb` are not in this repo/workspace, re-upload them (or export SQL from Workbench) before using Method 2.  
Only app migration SQL currently present is:
[migration.sql](e:/Github_Projects/CAPSTONE-USLS-MVP/server/prisma/migrations/20260302111000_init/migration.sql)

## Automated Tests

Backend tests (RBAC + core API behavior):

```powershell
cd e:\Github_Projects\CAPSTONE-USLS-MVP\server
npm test
```

## Notes on Security & Compliance

- RBAC enforced at API and route level.
- Row-level checks enforce Student/Adviser/Panel boundaries and prevent IDOR by relationship checks.
- Access-denied attempts logged to `AuditLog`.
- Audit log is append-only from application behavior.
- Prescriptive outputs are rule-based (priority score, next action, escalation prompts) from timestamp/event signals.
- SMTP notifications avoid sensitive content and only direct users back to the portal.
- Document download is protected by authenticated authorization checks (`/api/documents/versions/:id/download`).
- Dashboard, Analytics, and Audit are distinct routes/components (`/dashboard`, `/analytics`, `/audit`).

## OpenAI Prescriptive Assist (Optional)

Default is off:

```env
ENABLE_OPENAI_ASSIST=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Enable:

```env
ENABLE_OPENAI_ASSIST=true
OPENAI_API_KEY=<your_key>
OPENAI_MODEL=<model_name>
```

Behavior:
- `/api/analytics/prescriptive` always returns rule-based recommendations.
- If AI is enabled, it adds advisory narrative suggestions only.
- AI never auto-updates DB records.
- Per-user rate limit: 10 requests/hour.
- Cache for identical requests: 5 minutes.

Data minimization sent to AI:
- Aggregated metrics (counts, averages, queue indicators)
- De-identified case summaries only:
  - `student_ref` (e.g., `S-001`)
  - stage, time-in-stage days, overdue counts, pending milestones
  - last activity age, scheduling age, risk flags
- Not sent: names, emails, phone numbers, addresses, raw document content, grades, sensitive evaluation text.
