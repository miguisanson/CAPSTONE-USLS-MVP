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
- Milestones: `GET/POST/PATCH /api/milestones`
- Student milestone status: `PATCH /api/students/:id/milestones/:milestoneId`
- Tasks: `GET /api/tasks/my`, `GET /api/tasks/team`, `POST /api/tasks`, `POST /api/tasks/:id/decision`
- Documents: `GET/POST /api/students/:id/documents`, `POST /api/documents/:id/versions`, `POST /api/documents/:id/comments`
- Scheduling: `GET /api/scheduling/requests`, `POST /api/scheduling/requests`, `POST /api/scheduling/availability`, `POST /api/scheduling/events`
- Alerts/Monitoring: `GET /api/alerts`, `POST /api/alerts/run-monitoring`, `POST /api/alerts/:id/interventions`, `PATCH /api/alerts/interventions/:id/close`
- Analytics: `GET /api/analytics/dashboard`, `GET /api/analytics/report.csv`, `GET /api/analytics/report-view`
- Audit logs: `GET /api/audit-logs`
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

## Setup

### 1) Prerequisites

- Node.js 20+ (Node 22 tested)
- npm 10+
- MySQL 8 running locally

### 2) Create database

```sql
CREATE DATABASE usls_gs_mvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3) Backend setup

```bash
cd server
cp .env.example .env
# edit .env with your DB and JWT/SMTP values
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

Backend default URL: `http://localhost:4000`

### 4) Frontend setup

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Demo Credentials

All seeded users use password: `DemoPass123!`

- Admin: `admin@gs.local`
- Graduate School Staff: `staff@gs.local`
- Academic Coordinator: `acad.coord@gs.local`
- Research Coordinator: `research.coord@gs.local`
- Adviser: `adviser.one@gs.local` or `adviser.two@gs.local`
- Panel Member: `panel.one@gs.local` or `panel.two@gs.local`
- Student: `student1@gs.local` ... `student10@gs.local`

## Automated Tests

Backend tests (RBAC + core API behavior):

```bash
cd server
npm test
```

## Notes on Security & Compliance

- RBAC enforced at API and route level.
- Access-denied attempts logged to `AuditLog`.
- Audit log is append-only from application behavior.
- Prescriptive outputs are rule-based (priority score, next action, escalation prompts) from timestamp/event signals.
- SMTP notifications avoid sensitive content and only direct users back to the portal.
- Optional AI drafting endpoint is feature-flagged OFF by default.
