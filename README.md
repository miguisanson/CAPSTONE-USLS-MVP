# Graduate Student Lifecycle Monitoring & Analytics Platform

Full-stack MVP for monitoring graduate student progress, tasks, documents, scheduling, alerts, analytics, and audit activity.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Chart.js
- Backend: Node.js, Express, TypeScript
- Database: MySQL 8 with Prisma migrations
- Auth: JWT with backend-enforced role permissions

## Local Setup

Prerequisites:

- Node.js 20+
- npm 10+
- MySQL 8 running locally
- MySQL CLI available in your terminal as `mysql`

The local runner creates env files, installs dependencies, prepares the database, seeds demo data if needed, and starts both the API and web app.

### macOS

```bash
brew install node mysql
brew services start mysql
npm run dev
```

If your MySQL root user has a password:

```bash
DATABASE_URL='mysql://root:your_password@localhost:3306/usls_gs_mvp' npm run dev
```

If your local MySQL root user has no password:

```bash
DATABASE_URL='mysql://root:@localhost:3306/usls_gs_mvp' npm run dev
```

### Windows

Install first:

- Node.js 20+ from `https://nodejs.org/`
- MySQL 8 from the MySQL Installer
- Make sure `mysql` works in PowerShell. If not, add the MySQL `bin` folder to PATH.

Then run this from the repo root in PowerShell:

```powershell
npm run dev
```

If your MySQL root user has a password:

```powershell
$env:DATABASE_URL="mysql://root:your_password@localhost:3306/usls_gs_mvp"; npm run dev
```

If your local MySQL root user has no password:

```powershell
$env:DATABASE_URL="mysql://root:@localhost:3306/usls_gs_mvp"; npm run dev
```

If PowerShell blocks scripts, use the direct Windows runner:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev-local.ps1
```

### Local URLs

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:4000/health`

Direct platform runners are also available:

```bash
# macOS / Linux
bash dev-local.sh
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\dev-local.ps1
```

## Demo Login

Password for all demo users:

```text
DemoPass123!
```

Demo accounts:

- Admin: `admin@gs.local`
- Graduate School Staff: `staff@gs.local`
- Academic Coordinator: `acad.coord@gs.local`
- Research Coordinator: `research.coord@gs.local`
- Adviser: `adviser.one@gs.local`
- Panel Member: `panel.one@gs.local`
- Student: `student1@gs.local`

## Project Structure

```text
CAPSTONE-USLS-MVP/
  client/          React web app
  server/          Express API, Prisma schema, migrations, tests
  docs/            Architecture and thesis feature mapping
  References/      Design and research references
  dev-local.sh     macOS/Linux local setup and dev runner
  dev-local.ps1    Windows local setup and dev runner
  scripts/         Cross-platform npm helpers
```

## Planning Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Thesis Feature Map](docs/THESIS_FEATURE_MAP.md)
- [Database Workflow](server/prisma/README.md)

## Main Features

- Role-based dashboard
- Student lifecycle tracking
- Student profile, stage, milestone, task, and alert views
- Task queue and decision logging
- Document checklist, upload versions, and review comments
- Scheduling requests, availability, and outcomes
- Monitoring alerts and interventions
- Analytics charts, CSV export, and printable reports
- Audit log viewer
- Admin configuration for users, milestones, thresholds, and routing rules

## Useful Commands

Run backend only:

```bash
npm run dev:server
```

Run frontend only:

```bash
npm run dev:client
```

Run backend tests:

```bash
npm test
```

Build everything:

```bash
npm run build
```

Build only one side:

```bash
npm run build:server
npm run build:client
```

## Database Workflow

The app uses Prisma migrations as the source of truth.

Apply existing migrations:

```bash
npm run prisma:deploy
```

Create a new migration after editing `server/prisma/schema.prisma`:

```bash
cd server
npx prisma migrate dev --name describe_change
```

Regenerate the Prisma client:

```bash
npm run prisma:generate
```

Refresh demo data:

```bash
npm run seed
```

Note: `npm run seed` resets the demo database data.

## Security Notes

- Role permissions are enforced in backend routes and policy checks.
- Student, adviser, and panel access is scoped server-side.
- Access-denied attempts are recorded in the audit log.
- Document downloads require authenticated authorization.
- Optional OpenAI assistance is disabled by default with `ENABLE_OPENAI_ASSIST=false`.
