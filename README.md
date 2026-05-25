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

On macOS with Homebrew, the prerequisite setup is usually:

```bash
brew install node mysql
brew services start mysql
```

Then run the app with one command from the repo root:

```bash
bash dev-local.sh
```

The script will:

- create missing `server/.env` and `client/.env` files
- generate a local JWT secret
- install backend and frontend dependencies
- create the MySQL database from `DATABASE_URL`
- run Prisma migrations
- seed demo data if the database is empty
- start both the API and the web app

Local URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:4000/health`

If your MySQL username or password is different, pass it inline:

```bash
DATABASE_URL='mysql://root:your_password@localhost:3306/usls_gs_mvp' bash dev-local.sh
```

If your local MySQL root user has no password:

```bash
DATABASE_URL='mysql://root:@localhost:3306/usls_gs_mvp' bash dev-local.sh
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
  References/      Design and research references
  dev-local.sh     One-command local setup and dev runner
```

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
cd server
npm run dev
```

Run frontend only:

```bash
cd client
npm run dev
```

Run backend tests:

```bash
cd server
npm test
```

Build backend:

```bash
cd server
npm run build
```

Build frontend:

```bash
cd client
npm run build
```

## Database Workflow

The app uses Prisma migrations as the source of truth.

Apply existing migrations:

```bash
cd server
npx prisma migrate deploy
```

Create a new migration after editing `server/prisma/schema.prisma`:

```bash
cd server
npx prisma migrate dev --name describe_change
```

Regenerate the Prisma client:

```bash
cd server
npx prisma generate
```

Refresh demo data:

```bash
cd server
npm run seed
```

Note: `npm run seed` resets the demo database data.

## Security Notes

- Role permissions are enforced in backend routes and policy checks.
- Student, adviser, and panel access is scoped server-side.
- Access-denied attempts are recorded in the audit log.
- Document downloads require authenticated authorization.
- Optional OpenAI assistance is disabled by default with `ENABLE_OPENAI_ASSIST=false`.
