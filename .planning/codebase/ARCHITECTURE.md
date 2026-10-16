<!-- refreshed: 2026-10-17 -->
# Architecture

**Analysis Date:** 2026-10-17

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│ React 18 SPA  `frontend/src/` (Vite, Tailwind, react-router) │
│ App.jsx -> role portals: staff/coordinators, student, dean,  │
│ faculty; all HTTP through `frontend/src/api.js` (/api/...)    │
└────────────────────────────┬─────────────────────────────────┘
                             │ JSON, session cookie (same origin)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Flask app  `app.py` - create_app() -> register_routes(app)   │
│ ~210 routes nested in ONE function (app.py:11912-20171)      │
│ gated by require_api_login(*roles) (app.py:4948)             │
└──────┬───────────────┬──────────────────┬────────────────────┘
       ▼               ▼                  ▼
 serializers +    workflow engines    RAG / assistant
 business rules   (leave, standalone, (policy_rag.py + Gemini
 (app.py)          research, calendar)  optional)
       └───────────────┴──────────┬───────┘
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Flask-SQLAlchemy models (55, app.py:461-1672)                │
│ SQLite `usls_gs_demo.sqlite3` or MySQL; uploads/ on disk     │
└──────────────────────────────────────────────────────────────┘
```

## Pattern Overview

**Overall:** Monolithic Flask JSON API + SPA, one 37,516-line module with section banners. Workflow "cases" with a guarded transition engine; rule values live in the DB (`BusinessRule`), not in code.

**Key Characteristics:**
- Backend is the source of truth: risk indicators, recommendations, allowed actions per role are computed server-side and shipped to the SPA (`app.py:4990` banner, `leave_available_actions` `app.py:6875`, `process_actions_for` `app.py:8398`, research vocabulary `app.py:30929`).
- Pure-logic modules are extracted and import-free of `app`: `leave_workflow.py`, `standalone_process.py`, `business_rules_catalog.py`, `policy_rag.py`, `panel_demo_data.py` (none import `app`; they only use stdlib). `app.py` imports them mid-file (`app.py:3331`, `5784`, `5800`, `8352`, `8997`).
- Official data (identity, enrollment, grades) is import-only; portal edits are provenance-stamped (`MonitoringEdit` `app.py:1053`, AGENTS.md Rule 4).
- Everything runs at import time: `app = create_app()` (`app.py:37341`), schema upgrades (`app.py:37416`), seed/maintenance (`app.py:37482`).

## app.py map (approximate line ranges)

| Lines | Domain | Notes |
|---|---|---|
| 1-113 | imports, `db`, upload/RAG path constants, globals | module-level mutable RAG state (`app.py:92-100`) |
| 114-280 | `TRANSACTIONS` catalogue | drives `/api/meta` and SPA workflow nav |
| 281-456 | config helpers, `create_app`, JSON error handling | `app.py:369`, `app.py:404` |
| 461-1672 | **55 models** | `Program` 461 ... `TransactionLog` 1652 |
| 1675-3322 | serializers + policy/curriculum helpers | `ensure_*` curricula, faculty accounts, research prerequisite |
| 3324-4988 | business rules register, roles, auth decorators | `ROLE_LABELS` 4761, `current_account` 4913, `require_api_login` 4948, `require_workflow_actor` 4976 |
| 4990-5394 | Module 5 decision support (risk, recommendations) | `recompute_risk` 5209 |
| 5396-5777 | Module 6 RAG policy guidance (Source A indicators) | |
| 5779-8343 | Leave of Absence / extension / Readmission case engine | guarded transition engine 6864, `sync_leave_cases` 7292, Registrar handoff 7680 |
| 8345-8996 | Standalone process board (AWOL, Residency, Withdrawal) | uses `standalone_process.py` |
| 8997-11910 | Policy document library + RAG + Gemini + assistant | OCR 9171, chunking 9659, retrieval 10323, `_gemini_generate` 10055, `generate_answer` 11717 |
| **11912-20171** | **`register_routes(app)`** - every `@app.route` | ~230 nested defs |
| 20172-20190 | `request_payload()` | JSON/form to `MultiDict` |
| 20192-22113 | Analytics, filters, KPIs | |
| 22115-22360 | BPMN helpers: onboarding gate, curriculum tags, coursework report | |
| 22361-23456 | Analytics reports, KPI measurements (proposal tables 3.1-3.5) | |
| 23458-24243 | Transaction context for workflow screens | |
| 24244-25472 | Monitoring sheet (AC Student Monitoring .xlsx) importer | |
| 25474-26336 | Monitoring portal entry (owner decision 2026-10-01) | |
| 26338-27275 | Transaction handlers (`TRANSACTION_HANDLERS`) | |
| 27277-29359 | Calendar, availability, adviser appointments, invitations, reminders, .ics | |
| 29361-30299 | Domain rules/helpers, research document checks, OCR for evidence | |
| 30301-30927 | Panel matching (60 expertise + 25 availability + 15 workload) | defense revision D1/D6 |
| 30929-33722 | Research vocabulary, gates, Google Calendar OAuth (31173+), panel roles | |
| 33724-34480 | `reset_database`, `ensure_*_schema` migrations | additive ALTERs |
| 34480-37340 | Curriculum offerings, faculty/sheet import, demo data, seed, demo accounts | `seed_database` 35957, `ensure_demo_accounts` 37282 |
| 37341-37516 | `app = create_app()`, `run_schema_upgrades` 37344, `run_startup_tasks` 37444, `__main__` 37489 | |

**Route counts** (`@app.route` total 210, all inside `register_routes`): prefixes by count - `student-portal` 28, `faculty-portal` 18, `monitoring` 16, `enrollment` 10, `faculty` 9, `policy-documents` 9, `auth` 8, `leave-cases` 8, `students` 7, `admin` 6, `curriculum-planning` 6, `adviser-appointments` 6, `transactions` 5, `defense-schedules` 5, `process-cases` 4, `reports` 4, `course-offerings` 4, rest 1-3 each (calendar, notifications, calendar-feed, approvals, onboarding, research-gate, graduation, etc.). SPA hosting: `/` and `/<path:path>` (`app.py:20145-20149`). Re-derive with `grep -n "@app.route" app.py`.

## Layers

**Routes (nested closures):** `register_routes` `app.py:11912`. Handlers close over module globals; most are decorated `@require_api_login("staff", ...)`. Contains handler logic as well as HTTP glue, so there is no service layer to call from tests except via the test client.

**Domain/workflow functions:** module-level `def`s (839 top-level in total) in the ranges above; take models, return dicts.

**Models:** all in `app.py:461-1672`; one `db.Model` class per table, no relationship-heavy ORM use beyond foreign keys; enum-like vocab as string columns.

**Extracted pure modules:** see Overview; test them without a DB (`tests/test_standalone_consistency.py` imports `standalone_process` directly).

## Data Flow

### Primary request path
1. SPA calls `api.<fn>()` -> `request("/path")` -> `fetch("/api" + path, credentials: "same-origin")` (`frontend/src/api.js:1-20`); non-2xx throws `Error(body.error)`.
2. `before_request` rejects non-object JSON (`app.py:~410`); Flask routes to a closure in `register_routes`.
3. `require_api_login(*roles)` (`app.py:4948`): 401 no session, 403 wrong role (role `admin` passes every gate), 403 with `must_change_password` until changed. Each decorated function name is recorded in `API_ROLE_REGISTRY`.
4. Handler reads `request_payload()`, calls domain functions, mutates `db.session`, writes `TransactionLog`/event rows, returns `jsonify(...)`.
5. Errors under `/api/` become `{"error": "..."}` via `register_json_error_handling` (`app.py:404`).

### Workflow transition flow (leave, AWOL, withdrawal, research gates)
Student files a request (`app.py:6192`) -> policy check (advisory only, `app.py:6090`) -> guarded transition engine (`app.py:6864`, actions from `leave_available_actions`) -> effect on student record (`app.py:6673`) -> time-driven sync at start-up, sign-in and from the staff screen (`sync_leave_cases` `app.py:7292`) -> Registrar handoff file export/ack (`app.py:7680`).

### Startup flow
Import `app` -> `create_app` -> `run_schema_upgrades` -> `run_startup_tasks` (seed if empty) -> `__main__`: optional RAG pre-warm thread, `app.run(0.0.0.0:5000)`. See `STACK.md`.

## Auth and roles

- Roles (`ROLE_LABELS` `app.py:4761`): `staff`, `academic_coordinator`, `research_coordinator`, `dean`, `student`, `faculty`, `admin`. Session keys `account_id`, `role`, `student_id`, `sid` (`app.py:12034`). Owner vocabulary is normalised (`canonical_owner_role` `app.py:22462`, `normalize_owner_role_vocabulary` `app.py:5214`).
- Per-transition authority: `require_workflow_actor(*roles)` (`app.py:4976`) raises `ValueError` -> 400 via error handler.
- Frontend mirror: `frontend/src/auth.jsx` (`useAuth`), `App.jsx` `homeFor(user)` and `RoleOnly` wrapper; back-office roles set `BACKOFFICE_ROLES` (`frontend/src/App.jsx`). Nav per role in `frontend/src/components/portalNav.jsx`.

## Frontend

- `frontend/src/main.jsx` -> `App.jsx` (react-router v6). Portals: `pages/student/*` (`StudentRoutes.jsx`, context provider `StudentPortalContext.jsx`), `pages/dean/*`, `pages/faculty/*`, `pages/leave/*`, `pages/process/*`, plus staff pages in `pages/*.jsx` and shared UI in `components/` (`ui.jsx`, `forms.jsx`, `Layout.jsx`).
- API layer: single object `api` in `frontend/src/api.js` (573 lines, one function per endpoint, hand-written, no codegen). State via React context + hooks (`hooks.js`), no Redux/query library.
- Dev: Vite 5173 proxies `/api` to Flask; prod: Flask serves `frontend/dist`.

## Architectural Constraints

- **Global state:** RAG caches/locks and cooldown (`app.py:92-100`, mutated with `global` at `9160`, `9732`, `10230`); `API_ROLE_REGISTRY`; login-throttle object (`app.py:~4840-4880`, `LOGIN_MAX_FAILURES`).
- **Threading:** Werkzeug server (threaded by default) plus daemon pre-warm thread; RAG index guarded by `_RAG_INDEX_LOCK`/`_RAG_VECTOR_LOCK`.
- **Import-time side effects:** importing `app` creates/upgrades the DB. Tests and scripts must set `DATABASE_URL`/`USLS_SKIP_STARTUP_TASKS` before import (`tests/test_bpm_workflows.py:12-17`; `scripts/reimport_monitoring_workbooks.py` imports `app`).
- **Mid-file imports** (`# noqa: E402`) of the extracted modules at `app.py:3331`, `5784`, `5800`, `8352`, `8997`; there is no circularity because those modules never import `app`.
- **Routes as closures** cannot be imported or unit-called; they share helper names from module scope.
- 31 test imports of the form `from app import (...)` in `tests/` (e.g. `tests/test_bpm_workflows.py:19`): any split must keep these names importable from `app`.

## Anti-Patterns

### Everything in one module
**What happens:** models, rules, 210 routes, importers, seed and migrations share one namespace in `app.py`.
**Why it's wrong:** merge conflicts, slow edits, hidden coupling by shared globals, import-time side effects.
**Do this instead:** follow the split plan below; new pure logic goes in a new top-level module like `leave_workflow.py`.

### Migrations interleaved with seed/demo code
**What happens:** `ensure_*_schema` functions (`app.py:33738-34480`) sit between seed helpers and `run_schema_upgrades` runs at import (`app.py:37416`); order matters and is encoded only by call order (`app.py:37344-37415`).
**Do this instead:** keep new additive ALTERs guarded and add them near the top of `run_schema_upgrades` (AGENTS.md Rule 4).

## Proposed split of `app.py` (safe order)

Goal: no behaviour change; the gate (`unittest discover`) stays green after every step; `from app import X` keeps working via re-exports in `app.py` until the tests are updated.

1. **`extensions.py`** - `db = SQLAlchemy()` only. (`app.py:54`) Everything else imports `db` from here. Zero logic.
2. **`config.py` / `paths.py`** - env/URL/upload/RAG path constants and `resolve_*` helpers (`app.py:44-112`, `282-368`).
3. **`models/`** - move the 55 classes (`app.py:461-1672`) grouped: `students.py`, `curriculum.py` (Course*, Offering*, TermEnrollment, SubjectEnrollment), `cases.py` (Leave*, Awol, Residency, Withdrawal, Graduation, Practicum), `research.py`, `faculty.py` (Faculty*, Panel*, Schedule*, Defense*, Adviser*), `policy.py` (PolicyDocument*, BusinessRule*), `system.py` (UserAccount, Notification, Task, TransactionLog, WorkflowMessage). `models/__init__.py` re-exports all so `create_all` sees every table.
4. **Already-pure modules** stay (`leave_workflow.py`, `standalone_process.py`, `business_rules_catalog.py`, `policy_rag.py`, `panel_demo_data.py`); move into a `domain/` package only after step 3.
5. **`services/`** - move the module-level domain functions by banner range, leaf-first: `business_rules.py` (3324-4988 minus auth), `risk.py` (4990-5394), `leave.py` (5779-8343), `standalone.py` (8345-8996), `rag.py` + `assistant.py` (8997-11910), `analytics.py` (20192-23456), `monitoring_import.py` (24244-26336), `calendar.py` (27277-29359), `research.py` (29361-33722 incl. panel matching), `curriculum.py`. Each depends only on `models`, `extensions`, `config`, and earlier services; no service imports `routes`.
6. **`auth.py`** - `ROLE_LABELS`, `current_account`, `require_api_login`, `require_workflow_actor` (`app.py:4761-4988`). Needed by routes; depends on `models.system` only.
7. **`routes/` blueprints** (last, riskiest): turn `register_routes` into blueprints by URL prefix: `auth`, `students`, `student_portal` (28), `faculty_portal` (18), `monitoring` (16), `enrollment`, `policy_assistant`, `leave_process` (leave-cases/process-cases/approvals), `research_calendar` (defense-schedules, availability, adviser-appointments, calendar, notifications), `reports_admin`, `spa`. Register in `create_app()`. Moving closures requires turning shared closure helpers (`no_store`, `demo_mode_off_response`, `app.py:11918-11926`) into module functions first. Keep endpoint function names unique: `API_ROLE_REGISTRY` keys on `fn.__name__` (`app.py:4945-4953`).
8. **`bootstrap.py` / `seed.py` / `migrations.py`** - `ensure_*_schema` + `run_schema_upgrades` -> `migrations.py`; `seed_database`, demo data, `ensure_demo_accounts` -> `seed.py`; `run_startup_tasks`/`should_run_startup_tasks` -> `bootstrap.py`. Keep `app.py` as a thin shim: `app = create_app()`, upgrade call, startup call, `__main__` (`python app.py --seed`, `npm run dev` and tests rely on it).

Dependency order: extensions -> config -> models -> pure modules -> services (leaves first) -> auth -> routes -> migrations/seed -> shim. Do one step per commit, run the full gate each time, and prefer moving whole banner sections verbatim (no rewrites). Test coverage that protects the split: `tests/test_bpm_workflows.py` (80), `tests/test_calendar_appointments.py` (93), `tests/test_research_core.py` (57), `tests/test_crosscut.py` (old-DB startup).

## Error Handling

JSON `{"error": msg}` for every `/api/` failure (`app.py:404-454`); 5xx rolls back the session and logs. Business validation raises `ValueError` with a human sentence that the handler turns into 400. `HTTP_ERROR_MESSAGES` `app.py:391`.

## Cross-Cutting Concerns

**Logging:** `app.logger` + `print`. **Validation:** per-handler, plus `BusinessRule` DB values. **Authentication:** session + `require_api_login`.

---

*Architecture analysis: 2026-10-17*
