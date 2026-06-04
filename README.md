# USLS Graduate Student Lifecycle Monitoring & Analytics Platform

A web platform for the University of St. La Salle Graduate School that consolidates lifecycle
records, milestone events, scheduling, document checks, and follow-ups into one staff-friendly
monitoring environment.

- **Backend:** Python (Flask) JSON API — owns all models, business rules, and the source of truth.
- **Frontend:** React + Vite + Tailwind CSS single-page app (clean, light, institutional-green UI).
- **Database:** zero-config **SQLite** by default; **MySQL** supported via `DATABASE_URL`.
- **Charts:** Recharts. **Icons:** Lucide (SVG). **Fonts:** Poppins + Open Sans.

## What It Does

Six working workflows (transactions) drive the platform. Each one performs a real action and
writes SQL-backed records (students, enrollment, course evidence, document checks, panel
assignments, schedule requests, tasks, and an activity trail):

1. **Student Handoff** (P0) — creates the monitoring record and compares received onboarding evidence.
2. **LOA / Readmission Decision** (P0) — checks residency rules or return evidence, then records the decision.
3. **Course Audit** (P1) — maps completed/current/missing subjects against curriculum requirements.
4. **Research Gate Readiness** (P1) — compares Form 1 / Form 4 / final / completion evidence with the protocol.
5. **Panel Matching** (P0) — scores faculty by specialization, availability, college, and workload.
6. **Defense Scheduling** (P0) — checks panel availability and protocol lead-time before confirming.

On top of the transactions: a **Dashboard** (transaction-derived KPIs + charts), a **Students**
directory with a full lifecycle record view, a role-filtered **Work Queue**, and an **Activity Log**.

## Requirements

- Python 3.11+
- Node.js 18+ and npm (to build the React frontend)
- MySQL 8 is **optional** — only needed if you set `DATABASE_URL`.

## Run It (Windows cmd — two commands)

```cmd
setup.bat      :: first time only — installs deps, builds the UI, seeds the database
run.bat        :: every time after that — starts the platform on http://localhost:5000
```

Then open <http://localhost:5000>. Press `Ctrl+C` in the window to stop.

### Manual steps (equivalent)

```cmd
python -m pip install -r requirements.txt
npm --prefix frontend install
npm --prefix frontend run build
python app.py --seed          :: creates the demo dataset
python app.py                 :: serves the API + built UI on port 5000
```

### Frontend development (hot reload)

```powershell
python app.py                 # API on :5000
npm --prefix frontend run dev # Vite dev server on :5173, proxies /api -> :5000
```

## Database

By default the app uses a local SQLite file (`usls_gs_demo.sqlite3`) so it runs with no setup.
To use MySQL instead, set in `.env`:

```env
DATABASE_URL=mysql+pymysql://root:1234@localhost:3306/usls_gs_demo
```

Reseed anytime (resets data, creates ~350 synthetic students plus related records):

```powershell
python app.py --seed
```

Change `DEMO_SEED_COUNT` in `.env` to seed 200–500 records.

## Project Structure

```text
CAPSTONE-USLS-MVP/
  app.py                 Flask JSON API, SQL models, workflow rules, seed data
  frontend/              React + Vite + Tailwind single-page app
    src/
      pages/             Dashboard, Students, StudentDetail, WorkQueue, ActivityLog, WorkflowPage
      components/        Layout (sidebar/topbar), UI primitives, forms, StudentPicker
      api.js, hooks.js, lib/format.js
    dist/                Production build (served by Flask) — git-ignored
  Documents/             Proposal, meeting notes, transaction list, school forms
  run_demo.ps1           Installs deps, builds the UI, seeds the DB, starts the app
  requirements.txt       Python dependencies
```

## API Overview

```text
GET  /api/meta                         programs, terms, faculty, stages, transaction catalogue
GET  /api/dashboard                    KPIs + chart distributions (computed from transactions)
GET  /api/students?q=&stage=&risk=...  paginated, filterable student list
GET  /api/students/<id>                full lifecycle record (audit, research, docs, panel, schedule, tasks, timeline)
GET  /api/tasks?owner=                 work queue
GET  /api/activity                     activity trail
GET  /api/transactions/<slug>/context  data a workflow screen needs
POST /api/transactions/<slug>          run a workflow (JSON body)
```
