# USLS Graduate Student Lifecycle Monitoring & Analytics Platform

A web platform for the University of St. La Salle Graduate School that consolidates lifecycle
records, milestone events, scheduling, document checks, and follow-ups into one staff-friendly
monitoring environment.

See [CHANGELOG.md](CHANGELOG.md) for the dated development history from the initial repository through the current build.

- **Backend:** Python (Flask) JSON API - owns all models, business rules, and the source of truth.
- **Frontend:** React + Vite + Tailwind CSS single-page app (clean, light, institutional-green UI).
- **Database:** zero-config **SQLite** by default; **MySQL** supported via `DATABASE_URL`.
- **Charts:** Recharts. **Icons:** Lucide (SVG). **Fonts:** Poppins + Open Sans.

## What It Does

Twelve working workflows (transactions) drive the platform. Each one performs a real action and
writes SQL-backed records (students, enrollment, course evidence, document checks, panel
assignments, schedule requests, tasks, and an activity trail):

1. **Student Handoff** - creates the monitoring record and compares received onboarding evidence.
2. **Curriculum Planning & Course Adjustments** - publishes the semester offering list from demand, faculty feasibility, or manual coordinator decisions.
3. **Enrollment** - assigns official offerings to an individual student, resolves conflicts, preserves semester history, and synchronizes monitoring/profile/portal records.
4. **Leave of Absence** - staff review the application and eligibility, then forward it for the Dean's decision; an approval pauses the student's status and records the notice.
5. **Readmission** - staff review return eligibility and forward the request; the Dean's approval reactivates the student and records the notice.
6. **AWOL & Residency** - records AWOL, accepts written return intent, applies program-specific maximum-residence rules, routes Dean decisions, and records valid no-subject residency.
7. **Course Audit** - maps completed/current/missing subjects against curriculum requirements, alerts students about INC grades, and applies the one-year lapse/retake rule.
8. **Research Gate Readiness** - compares Form 1 / Form 4 / final / completion evidence with the protocol.
9. **Panel Matching** - scores faculty by specialization, availability, college, and workload.
10. **Defense Scheduling** - checks panel availability and protocol lead-time before confirming.
11. **Practicum** - tracks eligibility, placement, hours, evidence, re-placement, and Dean review.
12. **Withdrawal & Graduation Endorsement** - closes approved withdrawals and validates graduation candidates before Dean approval and Registrar handoff.

On top of the transactions: a **Dashboard** (transaction-derived KPIs + charts), a **Students**
directory with a full lifecycle record view, a role-filtered **Work Queue**, and an **Activity Log**.

## Tech Stack

**Frontend**
- React 18 (UI library, written in JSX)
- Vite 5 (build tool + dev server)
- Tailwind CSS 3 (styling) + PostCSS + Autoprefixer
- React Router 6 (page navigation)
- Recharts (dashboard charts)
- Lucide React (SVG icons)

**Backend**
- Python 3 + Flask 3 (JSON API and static hosting)
- Flask-SQLAlchemy (ORM / data models)
- python-dotenv (config), PyMySQL (only when using MySQL)

**Database**
- SQLite by default (local file, zero setup) - MySQL 8 optional via `DATABASE_URL`

**Tooling**
- npm + Node.js (frontend), pip (Python), Git

> Note: the original proposal specified Node.js/Express + Chart.js. This build uses **Python/Flask**
> (per the team's decision) and **Recharts** (the React equivalent of Chart.js) instead.

## Requirements

- Python 3.11+
- Node.js 18+ and npm
- Git
- MySQL 8 is **optional** and only needed if you set `DATABASE_URL`.
- Tesseract OCR is **optional** and only needed if you want scanned/image-only concept-paper PDFs to be readable.

## Install and Run

### 1. Get the project

Clone the repository, then open the project folder:

```cmd
git clone <repository-url>
cd CAPSTONE-USLS-MVP
```

If you already downloaded or extracted the project, just open a terminal in the project root.

### 2. Set up the database

The app uses **SQLite by default**, so there is no separate database server to install for the
standard setup. Python includes SQLite support, and `npm run setup` will create the local
`usls_gs_demo.sqlite3` database file automatically.

If you want to use **MySQL** instead of SQLite:

1. Install MySQL 8 and start the MySQL server.
2. Create a database for the app:

```sql
CREATE DATABASE usls_gs_demo;
```

3. Create or update the `.env` file in the project root with your MySQL connection string:

```env
DATABASE_URL=mysql+pymysql://root:1234@localhost:3306/usls_gs_demo
```

Replace `root`, `1234`, `localhost`, and `usls_gs_demo` with your actual MySQL username,
password, host, and database name.

### 3. Install dependencies, build the frontend, and seed the database

Run this once from the project root:

```cmd
npm run setup
```

This command creates a local `.venv`, installs the Python dependencies from `requirements.txt`,
installs the React frontend dependencies, builds the frontend, and creates the demo SQLite
database with seed data.

For scanned concept-paper PDFs, install the Tesseract OCR desktop/runtime package too. If it is not
on your system `PATH`, set the executable location in `.env`:

```env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

The app first tries normal PDF text extraction, then falls back to OCR when too little text is found.

### 4. Start the app

```cmd
npm run dev
```

Then open <http://localhost:5000>. Press `Ctrl+C` in the terminal to stop the server.

On macOS, port 5000 may already be used by Control Center / AirPlay Receiver. If that happens,
start the app on port 5001 instead:

```cmd
FLASK_PORT=5001 npm run dev
```

Then open <http://localhost:5001>.

### Development with frontend hot reload

For normal demo/use, `npm run dev` is enough. If you are editing React files and want Vite hot
reload, run both commands in two terminals:

```cmd
npm run dev
npm run dev:web
```

Open the Vite app at <http://localhost:5173>. The Flask API still runs on <http://localhost:5000>.

If you are using port 5001 because port 5000 is taken, pass the same port to both terminals:

```cmd
FLASK_PORT=5001 npm run dev
FLASK_PORT=5001 npm run dev:web
```

### All available npm scripts

| Command | What it does |
|---|---|
| `npm run setup` | One-time setup: pip install -> npm install -> build UI -> seed database |
| `npm run dev` | Start the app (Flask serves the API + built UI on port 5000) |
| `npm start` | Same as `npm run dev` |
| `npm run build` | Rebuild the frontend after changing UI code |
| `npm run seed` | Reset/reseed the demo database (~350 students) |
| `npm run dev:web` | Vite dev server on :5173 with hot reload (run `npm run dev` in a second terminal for the API) |

> If you change anything under `frontend/src`, run `npm run build` (or use `npm run dev:web`) to see it.

## Database

By default the app uses a local SQLite file (`usls_gs_demo.sqlite3`) so it runs with no database
server setup. To use MySQL instead, install MySQL 8, create a database, and set this in `.env`:

```env
DATABASE_URL=mysql+pymysql://root:1234@localhost:3306/usls_gs_demo
```

Reseed anytime. This resets data and creates about 350 synthetic students plus related records:

```cmd
npm run seed
```

Change `DEMO_SEED_COUNT` in `.env` to seed 200-500 records.

## Google Calendar availability

Faculty members connect their own Google Calendar from the Faculty Portal. After
connection, Defense Scheduling uses Google Calendar FreeBusy data as that
faculty member's schedule source and stops using the local demo/profile
schedule. Configure a Google OAuth 2.0 Web application in `.env`:

```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/api/faculty-portal/google-calendar/callback
GOOGLE_CALENDAR_TIMEZONE=Asia/Manila
```

Add the same redirect URI to the Google Cloud OAuth client's authorized redirect
URIs and enable the Google Calendar API. The integration requests read-only
calendar access and uses FreeBusy periods, so GS Staff can see that a time is
blocked without seeing private event titles or descriptions.

The legacy `GOOGLE_CALENDAR_ACCESS_TOKEN` and `GOOGLE_CALENDAR_IDS_JSON`
configuration remains supported for existing deployments. Faculty-owned OAuth
credentials take precedence.

## Project Structure

```text
CAPSTONE-USLS-MVP/
  app.py                 Flask JSON API, SQL models, workflow rules, seed data
  frontend/              React + Vite + Tailwind single-page app
    src/
      pages/             Dashboard, Students, StudentDetail, WorkQueue, ActivityLog, WorkflowPage
      components/        Layout (sidebar/topbar), UI primitives, forms, StudentPicker
      api.js, hooks.js, lib/format.js
    dist/                Production build (served by Flask) - git-ignored
  Documents/             Proposal, meeting notes, transaction list, school forms
  package.json           npm scripts (setup / dev / build / seed)
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
