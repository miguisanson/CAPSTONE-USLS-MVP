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
- Keep `PRISMA_CLIENT_ENGINE_TYPE=binary`

If your machine has a global env var forcing Prisma JS engine, remove it or set to binary:

```powershell
[Environment]::SetEnvironmentVariable("PRISMA_CLIENT_ENGINE_TYPE","binary","User")
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
