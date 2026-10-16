# Technology Stack

**Analysis Date:** 2026-10-17

## Languages

**Primary:**
- Python (venv built on 3.14.7, `.venv/pyvenv.cfg`) - entire backend: `app.py` (37,516 lines), `leave_workflow.py` (338), `policy_rag.py` (1,036), `business_rules_catalog.py` (625), `standalone_process.py` (367), `panel_demo_data.py` (367). No `.python-version` pin exists.
- JavaScript/JSX (ES modules, `"type": "module"` in `frontend/package.json`) - React SPA in `frontend/src/` (no TypeScript).

**Secondary:**
- Node scripts (`.cjs`/`.mjs`) - `scripts/run-python.cjs`, `scripts/setup-python.cjs`, `scripts/build_class_list_demo.mjs`, `scripts/update_faculty_roster.mjs`.
- SQL (raw `ALTER TABLE` strings inside `app.py`).

## Runtime

- Python 3 with `.venv` (Windows layout `.venv/Scripts/python.exe`). `.venv/pyvenv.cfg` pins an absolute interpreter path (`C:\Users\Windows10\...\Python314`); it goes stale on another machine -> recreate with `npm run install:python`.
- Node + npm (no `.nvmrc`; version unpinned) for the frontend build only.
- Package managers: pip (`requirements.txt`, no lockfile, three deps use `>=`), npm (`frontend/package-lock.json` present; root `package.json` has no deps).

## Frameworks

**Core (`requirements.txt`):**
- Flask 3.0.3 - app factory `create_app()` at `app.py:369`; all routes nested in `register_routes(app)` (`app.py:11912`).
- Flask-SQLAlchemy 3.1.1 - `db = SQLAlchemy()` at `app.py:54`.
- PyMySQL 1.1.1 + cryptography 42.0.8 - MySQL driver (imported lazily, `app.py:298`).
- python-dotenv 1.0.1 - `load_dotenv()` at `app.py:52`.
- openpyxl 3.1.5 - Excel import/export (monitoring sheets, class lists, AIMS template).
- pypdf 5.6.0, PyMuPDF>=1.24.0, Pillow>=10.4.0, pytesseract>=0.3.13 - PDF text/OCR (`app.py:9171-9216`, `app.py:29887-29908`, `policy_rag.py:150`).
- werkzeug (via Flask) - password hashing; `generate_password_hash` wrapper forces `pbkdf2:sha256` (`app.py:46`).

**Frontend (`frontend/package.json`):**
- React 18.3.1, react-dom, react-router-dom 6.27, recharts 2.13, lucide-react 0.453.
- Vite 5.4.10 + @vitejs/plugin-react 4.3.3, Tailwind 3.4.14, PostCSS, autoprefixer.

**Testing:** stdlib `unittest` only (no pytest in requirements). 19 files in `tests/`, ~590 `def test_` methods. No frontend test runner.

## How it runs

| Command (root `package.json`) | Does |
|---|---|
| `npm run setup` | install:python, install:web, build:web, seed |
| `npm run install:python` | `scripts/setup-python.cjs`: create `.venv`, `pip install -r requirements.txt` |
| `npm run build:web` | `vite build` -> `frontend/dist/` (gitignored) |
| `npm run seed` | `node scripts/run-python.cjs app.py --seed` |
| `npm run dev` / `start` | `python app.py` -> Flask on `0.0.0.0:$FLASK_PORT` (default 5000), `debug=False` (`app.py:37513`) |
| `npm run dev:web` | Vite on 5173, proxies `/api` to `localhost:$FLASK_PORT` (`frontend/vite.config.js`) |

Production-style: Flask serves `frontend/dist` itself (catch-all route `app.py:20149`, `_serve_spa` `app.py:20153`). `static_folder=None` (`app.py:373`). `scripts/run-python.cjs` prefers `.venv` python, else system `python`.

Gate: `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v`. Tests set `DATABASE_URL` to a temp SQLite file before importing `app` (`tests/test_bpm_workflows.py:12-17`), and also temp `POLICY_DOCUMENT_UPLOAD_DIR` and `RAG_INDEX_DIR`.

## Database

- **Default: SQLite** file `usls_gs_demo.sqlite3` in the repo root (`resolve_database_url`, `app.py:327`). Gitignored (`*.sqlite3*`).
- **MySQL** when `DATABASE_URL` is set (`mysql://` is rewritten to `mysql+pymysql://`, `app.py:288`); `ensure_mysql_database` runs `CREATE DATABASE IF NOT EXISTS ... utf8mb4` (`app.py:298`).
- Raw `ALTER TABLE ... ADD COLUMN` SQL uses SQLite-flavoured types (`DATETIME`, `INTEGER`); 32 `ALTER TABLE` occurrences in `app.py`.

### Schema creation and migration (every startup)
1. `create_app()` (`app.py:369`) builds the app; `app = create_app()` at `app.py:37341` runs at import time.
2. `with app.app_context(): run_schema_upgrades()` (`app.py:37344` def, called at `app.py:37416`): first two inline guarded column-adders (`subject_enrollment`, `curriculum_offering`) using `inspect(db.engine)`, then ~20 `ensure_*_schema()` functions (defined `app.py:33738-34480`, `37217-37231`) each doing `db.create_all()` + `get_columns` check + `ALTER TABLE ADD COLUMN`, then data normalisers (`normalize_owner_role_vocabulary`, `ensure_authoritative_curricula`, `ensure_business_rules`, ...).
3. `if should_run_startup_tasks():` (`app.py:37482`; def `37420`) -> `run_startup_tasks()` (def `app.py:37444`): `db.create_all()`; seeds the full dataset only if `Student.query.count() == 0`; creates demo accounts; syncs curricula/leave cases. Skipped under unittest/pytest, with `--seed`, or `USLS_SKIP_STARTUP_TASKS=1`.
4. There is no Alembic/Flask-Migrate; no version table. The database schema is whatever the code at the last start produced.

### Seeding
- `python app.py --seed` (`app.py:37489-37500`) -> `seed_database(350)` (`app.py:35957`): `reset_database()` (drop_all + create_all, `app.py:33726`), `random.seed(20260603)`, 12 hard-coded programs, terms 2023-2030 via `generate_semester_calendar`, then **students/curriculum/faculty are imported from spreadsheets**: `import_faculty_sheets()` (`app.py:34561`, from `Documents/Faculty_Sheet/`) and `import_program_monitoring_sheets()` (`app.py:34536`, from `MONITORING_SHEET_DIR = Documents/Monitoring_Sheets`, `app.py:34533`). Then `seed_maed_personas()`, `ensure_panel_matching_demo_data()`, `recompute_risk` for every student, `ensure_demo_accounts()`.
- `panel_demo_data.py` holds static `FACULTY_EXPERTISE_DEMO`, `PANEL_MATCHING_DEMO_STUDENTS`, `UPCOMING_DEFENSE_DEMO` imported lazily (`app.py:34842`, `34864`, `34958`).
- Demo accounts: fixed emails `staff@/academic@/research@/admin@usls.edu.ph`, shared password `DemoPass123!` (`app.py:37282-37300`); student/faculty accounts created per record.
- Demo mode defaults ON (`DEMO_MODE`, `demo_mode_enabled()` `app.py:339`), which also exposes demo endpoints and a SECRET_KEY default (`resolve_secret_key`, `app.py:356`).

### Why two developers' databases differ
1. **Seed is mostly deterministic** (`random.seed(20260603)`, sheet-driven), so a fresh `--seed` from the same commit gives the same cohort. Divergence comes from the rest.
2. **Date-relative data**: ~54 uses of `date.today()`/`now_utc()`/`uuid4`/`random` in the seed region (`app.py:34480-37340`); `ensure_upcoming_defense_demo` (`app.py:34945`), leave-case date sync (`sync_leave_cases`, `app.py:7292`), and AWOL status sync (`sync_automatic_awol_statuses`) depend on the day the app runs. Password hashes use random salts.
3. **Startup is not a pure function of the seed**: every `python app.py` start mutates the DB (`run_startup_tasks`, `run_schema_upgrades`, `refresh` of risk, panel-matching demo availability), so DB state depends on which commits/versions were run against that file and when.
4. **Incremental vs fresh schema**: an old SQLite file is upgraded by guarded ALTERs; a fresh one by `create_all`. Column order/types and any not-yet-guarded change can differ (tests cover old-DB startup in `tests/test_crosscut.py`).
5. **SQLite vs MySQL**: the repo default is SQLite, `.env` may set `DATABASE_URL` to MySQL (`windows-dev-setup` memory; `.env` exists, contents not read). Types, collation and FK behaviour differ; `reset_database` has a MySQL-only branch (`app.py:33726`).
6. **Uploaded files**: `uploads/` is only partly gitignored (`.gitignore` ignores `uploads/research_evidence/*` and `uploads/student_requests/*` only). 19 files (17 in `uploads/monitoring_sheets/`, 2 in `uploads/policy_documents/`) are tracked (`git ls-files uploads`), so runtime uploads of those kinds show up as untracked changes, and DB rows pointing at files that exist only on one machine break on the other. `.rag_index/` (gitignored) is a per-machine cache.
7. **Environment toggles** that change data: `DEMO_MODE`, `DEMO_SEED_COUNT` (default 350, `app.py:37444` onward), `PANEL_MATCHING_DEMO_SEED`, `DEMO_SAMPLE_CALENDAR`, `USLS_UPLOAD_DIR`.
8. Input spreadsheets live in git (`Documents/Monitoring_Sheets`, `Documents/Faculty_Sheet`); editing them, or `scripts/update_monitoring_workbooks.py` / `reimport_monitoring_workbooks.py`, changes what a fresh seed produces.

## Configuration

- `.env` (present, gitignored, never read). Env vars read by code: `DATABASE_URL`, `SECRET_KEY`, `DEMO_MODE`, `SESSION_COOKIE_SECURE`, `FLASK_PORT`, `DEMO_SEED_COUNT`, `USLS_UPLOAD_DIR`, `POLICY_DOCUMENT_UPLOAD_DIR`, `POLICY_DOCUMENT_MAX_MB`, `RAG_*`, `GOOGLE_API_KEY`/`GOOGLE_AI_STUDIO_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `GOOGLE_CALENDAR_*`, `TESSERACT_CMD`, `PDF_OCR_*`, `LOGIN_*` lockout settings, `USLS_SKIP_STARTUP_TASKS`, `USLS_RISK_REFRESH_SECONDS`, `STUDENT_EMAIL_DOMAIN`. No `.env.example` is tracked.
- Build config: `frontend/vite.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`. No lint/format config (no eslint, prettier, ruff, black).

## Platform Requirements

- Development: Python 3, Node/npm, optional MySQL, optional Tesseract binary for OCR of scanned PDFs, optional Google API key.
- Production: a single Flask process (`app.run`, Werkzeug dev server, `debug=False`, `app.py:37513`); no WSGI server config in repo (the startup code mentions gunicorn compat at `app.py:37419`).

---

*Stack analysis: 2026-10-17*
