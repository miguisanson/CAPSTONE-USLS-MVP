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
9. **Panel Matching** - ranks faculty out of 100: expertise similarity between the student's paper and the faculty's expertise records (60, TF-IDF, or Gemini embeddings when a key is set), availability (25), and workload (15). The student's adviser is never recommended and the panel is checked against the Research Protocol composition rules.
10. **Defense Scheduling** - checks panel availability and protocol lead-time before confirming.
11. **Practicum** - tracks eligibility, placement, hours, evidence, re-placement, and Dean review.
12. **Withdrawal & Graduation Endorsement** - closes approved withdrawals and validates graduation candidates before Dean approval and Registrar handoff.

On top of the transactions: a **Dashboard** (transaction-derived KPIs + charts), a **Students**
directory with a full lifecycle record view, a role-filtered **Work Queue**, an **Activity Log**,
and a staff-only **Policy Document Library**. GS Staff can add readable PDF or DOCX files, edit their library
details, replace outdated versions, or remove them; changes automatically refresh the Policy
Assistant's retrieval corpus.

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

Everything below runs inside the project's own virtual environment. On Windows that is
`.venv\Scripts\python.exe` (on macOS/Linux, `.venv/bin/python`); `npm run dev`, `npm run seed` and
`npm run setup` already use it, so you only type the path yourself when you run Python by hand, for
example `.venv\Scripts\python.exe -m unittest ...`. If the machine's Python was upgraded and
`.venv\Scripts\python.exe` reports `No Python at ...`, run `npm run install:python` to rebuild the
virtual environment.

### 4. Start the app

```cmd
npm run dev
```

The seed and maintenance steps (empty database seeding, demo accounts, curriculum sync) run
automatically when the app starts, however it is started (`npm run dev`, `python app.py`,
`flask --app app run`, or a WSGI server), and are safe to repeat. They are skipped under the test
runner, for `python app.py --seed`, and when `USLS_SKIP_STARTUP_TASKS=1` is set.

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

## Sign-in and demo mode

Sign-in is a real email + password check. The role a user gets (staff, academic coordinator,
research coordinator, admin, dean, faculty, student) is the role stored on the account; the sign-in
form has no role picker and the server ignores any role a client sends. Failed sign-ins all get the
same message, an email is locked for five minutes after five failed attempts, the session cookie is
`HttpOnly` and `SameSite=Lax`, and signing out invalidates the session on the server.

**`DEMO_MODE`** is the one switch for every presenter convenience. It is **on by default** so the
local demo flow keeps working; set `DEMO_MODE=0` (in `.env` or the environment) for anything shared.

| | `DEMO_MODE` on (default) | `DEMO_MODE=0` |
|---|---|---|
| Sign-in page | empty email + password form, plus a collapsed, clearly labelled **Demo accounts** panel that the presenter expands | plain email + password form |
| Demo endpoints (`/api/auth/demo-accounts`, `/api/auth/demo-students`, demo reset) | available | `404` |
| Passwords sent to the browser | only inside the expanded panel | never |
| Demo persona repair at sign-in | yes | no |
| Fabricated panel-matching availability seeded at start-up | yes | no |
| `SECRET_KEY` not set | uses a public default | uses a random per-process key (set `SECRET_KEY` so sessions survive a restart) |

Nothing is ever pre-filled: the presenter either types the password or presses **Fill form** /
**Sign in** on a demo account.

Notes for a real deployment: the seeded staff, dean and faculty accounts and every new student
account start with the shared demo password, and there is no password-reset screen yet, so change
those passwords before real use. Lockout is kept in memory (per server process, reset on restart).
Set `SESSION_COOKIE_SECURE=1` when serving over HTTPS.

## Configuration

Set these in the environment or in `.env` (the app never needs `.env` to start).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local SQLite file | e.g. `mysql+pymysql://root:1234@localhost:3306/usls_gs_demo` |
| `FLASK_PORT` | `5000` | port the app listens on |
| `DEMO_MODE` | `1` | presenter conveniences on/off (see above) |
| `SECRET_KEY` | public demo value in demo mode | signs the session cookie |
| `SESSION_COOKIE_SECURE` | `0` | `1` when served over HTTPS |
| `LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_SECONDS` | `5`, `300` | sign-in lockout |
| `DEMO_SEED_COUNT` | `350` | synthetic students when seeding |
| `GOOGLE_API_KEY` (or `GOOGLE_AI_STUDIO_API_KEY`) | none, optional | Gemini key for the Policy Assistant |
| `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL` | `gemini-2.5-flash`, `gemini-embedding-2` | Gemini models |
| `RAG_PREWARM` | `1` | pre-build the document index at start-up (only when a Gemini key is set) |
| `TESSERACT_CMD` | on `PATH` | OCR for scanned PDFs |

**Without a Gemini key** the app runs fully. The Policy Assistant still answers: database questions
(students needing attention, blockers, enrollment) use the built-in rules, and policy questions are
answered by local keyword retrieval over the handbook and uploaded policy documents, without a
generated summary. Panel-matching keyword suggestions fall back to local keyword scoring.
With a key, policy questions are answered by Gemini retrieval-augmented generation with citations,
and unfamiliar questions are classified by the model. Set the key before the demo and ask a few
unscripted questions to confirm it.

## Running the tests

The suite is plain `unittest` (no pytest needed). Each test file builds its own temporary SQLite
database, so it never touches `usls_gs_demo.sqlite3`. From the project root on Windows:

```cmd
.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

The whole run takes a few minutes. To run one file or one test:

```cmd
.venv\Scripts\python.exe -m unittest tests.test_health -v
.venv\Scripts\python.exe -m unittest tests.test_bpm_workflows.BpmWorkflowSimulationTests.test_name -v
```

`npm run build` only proves the React app compiles; there is no frontend test runner yet.

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
URIs and enable the Google Calendar API. The current availability integration
requests read-only calendar access and uses FreeBusy periods, so GS Staff can
see that a time is blocked without seeing private event titles or descriptions.
The planned defense-event sync will request the additional permission needed to
create, update, or remove only defense events scheduled through this system;
unrelated classes, appointments, and personal events will remain unchanged.

When OAuth credentials are not configured, the Faculty Portal presents a
clearly labeled integration preview. Faculty can review how the calendar will
be used and open Google Calendar in a separate tab, but the preview stores
no token, does not mark the account connected, and leaves Panel Matching and
Defense Scheduling on the existing profile schedule.

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
GET/POST /api/faculty/<id>/expertise      faculty expertise records used by Panel Matching
PUT/DELETE /api/faculty-expertise/<id>   edit or remove one expertise record
```
