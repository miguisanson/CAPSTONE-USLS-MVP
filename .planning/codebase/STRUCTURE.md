# Codebase Structure

**Analysis Date:** 2026-10-17

## Directory Layout

```
CAPSTONE-USLS-MVP/
├── app.py                    # LIVE. Whole backend (37,516 lines) - see ARCHITECTURE.md
├── leave_workflow.py         # LIVE. Pure leave/readmission rules (338 lines), imported app.py:5784
├── standalone_process.py     # LIVE. Pure AWOL/Residency/Withdrawal rules (367), imported app.py:8352
├── business_rules_catalog.py # LIVE. Seed values for BusinessRule rows (625), imported app.py:3331
├── policy_rag.py             # LIVE. Key-free policy retrieval/answers (1,036), imported app.py:8997
├── panel_demo_data.py        # LIVE (demo only). Faculty expertise + demo defenses (367), lazy-imported app.py:34842
├── requirements.txt, package.json   # Python deps; root npm scripts (setup/dev/seed/build)
├── frontend/                 # LIVE. React 18 + Vite 5 + Tailwind 3 SPA
│   ├── src/{App,main}.jsx, api.js, auth.jsx, hooks.js, index.css
│   ├── src/pages/            # staff pages + student/ dean/ faculty/ leave/ process/ sub-portals
│   ├── src/components/       # shared UI (ui.jsx, forms.jsx, Layout.jsx), calendar/ monitoring/ scheduling/
│   ├── src/lib/              # format.js, print.js
│   └── dist/                 # BUILD OUTPUT, gitignored; Flask serves it
├── tests/                    # 19 unittest files + 2 assistant_eval*.json fixtures (~590 tests)
├── scripts/                  # setup/run helpers, AIMS template, monitoring import/export, walkthrough tooling
│   └── docs/                 # document generators (proposal, operations manual, walkthrough: 589 tracked files)
├── Documents/                # specs, stakeholder sources, seed spreadsheets (280 MB on disk, 644 tracked files)
├── uploads/                  # runtime user files; PARTLY tracked (19 files)
├── .planning/                # GSD working plan (STATE.md, config.json, audit/, codebase/)
├── .claude/                  # Claude Code config: commands, skills, GSD core install (844 tracked files)
├── templates/ static/        # LEGACY server-rendered pages (see below)
├── outputs/ _handout/ .codex/ .rag_index/   # see "Live vs legacy"
└── DEFENSE_REVISIONS.md, CHECKLIST_PHASE_PLAN.md, NEXT_SESSION_PLAN.md, AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md
```

## Live vs legacy (with evidence)

| Path | Status | Evidence |
|---|---|---|
| `app.py`, `leave_workflow.py`, `standalone_process.py`, `business_rules_catalog.py`, `policy_rag.py`, `panel_demo_data.py` | Live | Imported by `app.py` at lines listed above; tests import them (`tests/test_standalone_consistency.py:39`). |
| `frontend/` | Live | Served via `FRONTEND_DIST` catch-all (`app.py:20145-20172`). |
| `templates/` (`base.html`, `index.html`, `transaction.html`) | **Dead code** | `grep -rn "render_template\|template_folder" --include=*.py` finds nothing outside `.venv`/`.claude`; `Flask(__name__, static_folder=None)` (`app.py:373`); `/` serves the SPA (`app.py:20145`). Only reference is the AGENTS.md description line 226. Safe to delete after one review. |
| `static/styles.css` | **Dead code** | `static_folder=None` (`app.py:373`) so Flask never serves it; only the dead templates would link it; no other reference found. |
| `standalone_process.py` | Live (name misleading) | Used 44 times as `_sp.` in `app.py` (e.g. `app.py:8352`, `8398`); has a test file `tests/test_standalone_consistency.py`. It is the rules module for the AWOL/Residency/Withdrawal board, not a standalone app. |
| `.rag_index/` | Live cache, gitignored | Default `RAG_INDEX_DIR = BASE_DIR/.rag_index` (`app.py:89`); contents `chunks.json`, `corpus.json`, `sections/`, ~1.9 MB. Regenerated on demand; safe to delete. Tests redirect it to a temp dir (`tests/test_bpm_workflows.py:17`). |
| `_handout/` | Dead, empty, gitignored | `.gitignore` entry "Temporary document-build scratch folder"; directory is 0 bytes; no code or script references it. |
| `outputs/` | **Not referenced by the app; tracked scratch** | 124 tracked files, 27 MB: screenshots, `.ndjson` workbook dumps, a `~$` Word/Excel lock file (`outputs/class-list-demo-miguel-sanson/~$MAED_Class_List_Demo_Miguel_Sanson.xlsx`), GUID-named folders. Only generators write to it: `scripts/build_class_list_demo.mjs:5` (`outputs/class-list-demo-miguel-sanson`) and `scripts/capture_walkthrough_screenshots.py:36` (`outputs/walkthrough_screenshots`). `app.py`, `tests/`, `package.json` do not reference it. Candidate to untrack and ignore. |
| `.codex/` | **Obsolete** | Holds copies of two skills (`.codex/skills/intelligence-layer`, `.codex/skills/ui-ux-pro-max`, 30 tracked files) plus `.codex/local-server.pid` (tracked, `git check-ignore` says not ignored). No reference in `app.py`, `scripts/`, `tests/`, `package.json`, `AGENTS.md` or `CLAUDE.md`. Codex is no longer used by the owner; the live copies are in `.claude/skills/`. |
| `__pycache__/` (root, `scripts/`, `tests/`) | Generated, gitignored | Root holds both `app.cpython-312.pyc` and `app.cpython-314.pyc` (two Python versions have run here). |
| `Documents/CAPSTONE_ONLY/CAPRIT2 OLD/` | Archive, do not use as spec | AGENTS.md line 23; do not edit. |
| `uploads/monitoring_sheets/*`, `uploads/policy_documents/*` | Live path, partly committed | `MONITORING_UPLOAD_ROOT`, `POLICY_DOCUMENT_UPLOAD_ROOT` (`app.py:68-83`); 17 + 2 tracked files (the committed seed library); `.gitignore` covers only `research_evidence/` and `student_requests/`. |
| `~$*.xlsx` lock files | Junk lock files tracked | e.g. `Documents/Faculty_Sheet/~$Faculty_Roster.xlsx` is present; remove from git. |

## Directory Purposes

**`frontend/src/pages/`:** one file per staff screen (`Dashboard.jsx`, `Students.jsx`, `MonitoringGrid.jsx`, `Enrollment.jsx`, `PolicyDocuments.jsx`, `BusinessRules.jsx`, `TermSettings.jsx`, ...) and one subfolder per role portal: `student/` (19 files, router `StudentRoutes.jsx`), `dean/` (`DeanRoutes.jsx`), `faculty/` (`FacultyRoutes.jsx`), plus `leave/` and `process/` for the case boards.

**`scripts/`:** `setup-python.cjs`, `run-python.cjs` (venv-aware launcher), `generate_aims_export_template.py`, `update_monitoring_workbooks.py`, `reimport_monitoring_workbooks.py` (imports `app`), `prepare_capstone_submissions.py`, `rebuild_demo_walkthrough.py`, `capture_walkthrough_screenshots.py`, `build_class_list_demo.mjs`, `update_faculty_roster.mjs`; `scripts/docs/` builds Word/PDF deliverables (`build_proposal.py`, `build_operations_manual.py`, `walkthrough/`).

**`Documents/`:** `AIMS_Export/` (file contract), `Monitoring_Sheets/` + `Faculty_Sheet/` (**seed inputs read by `--seed`**, `app.py:34533`, `34561`), `Class_Lists/` (demo class lists), `RAG_Source/` and `CAPSTONE_ONLY/USLS_Documents/` (policy corpus for the assistant), `CAPSTONE_ONLY/` (proposal, operations manual draft, defense docs).

**`tests/`:** `test_bpm_workflows.py` (main fixtures), `test_calendar_appointments.py` (93), `test_research_core.py` (57), `test_loa_readmission.py` (50), `test_policy_documents.py` (42), `test_crosscut.py` (39, old-DB startup), etc.

## Key File Locations

- Entry point: `app.py:37341` (`app = create_app()`), `app.py:37489` (`__main__`); SPA entry `frontend/src/main.jsx`.
- Config: `.env` (gitignored), `frontend/vite.config.js`, `frontend/tailwind.config.js`, `.planning/config.json`.
- Core logic: `app.py` sections per `ARCHITECTURE.md`.
- Work queue: `DEFENSE_REVISIONS.md`, `CHECKLIST_PHASE_PLAN.md`, `NEXT_SESSION_PLAN.md`.

## Naming Conventions

- Python: `snake_case` functions, `PascalCase` models, `UPPER_CASE` module constants, `ensure_<thing>_schema()` for additive migrations, `ensure_<thing>()` for idempotent data fixes, `seed_*`/`ensure_demo_*` for demo data.
- Routes: `/api/<area>/...` kebab-case (`/api/leave-cases`, `/api/student-portal/...`).
- Frontend: `PascalCase.jsx` components/pages, `camelCase.js` helpers, role folders `student/ dean/ faculty/`, route containers named `<Role>Routes.jsx`, context `<Role>Context.jsx`.
- Tests: `tests/test_<area>.py`, `unittest.TestCase` classes.

## Where to Add New Code

**New API route:** inside `register_routes` in `app.py` (`app.py:11912-20171`) next to its prefix group; decorate with `@require_api_login(...)`; add the client function to `frontend/src/api.js`. Domain logic goes in a module-level function in the matching `app.py` section, or a new pure module beside `leave_workflow.py` if it needs no DB.

**New table/column:** model class in `app.py:461-1672`; additive guarded `ensure_*_schema()` called from the top of `run_schema_upgrades` (`app.py:37344`). Never destructive.

**New screen:** `frontend/src/pages/<Role>/` or `frontend/src/pages/`, register in `App.jsx` or the role's `*Routes.jsx`, nav entry in `frontend/src/components/portalNav.jsx`. Load the `ui-ux-pro-max` skill first.

**Tests:** `tests/test_<area>.py`; set `DATABASE_URL`, `POLICY_DOCUMENT_UPLOAD_DIR`, `RAG_INDEX_DIR` to temp values before `import app` (copy the header of `tests/test_bpm_workflows.py`).

**Seed/demo data:** static data in `panel_demo_data.py`; spreadsheets in `Documents/Monitoring_Sheets` or `Documents/Faculty_Sheet`; code in the `seed_*`/`ensure_demo_*` block `app.py:34480-37340`.

## Special Directories

- `frontend/dist/` - generated, ignored. `.venv/`, `node_modules/` - ignored. `.rag_index/` - generated, ignored.
- `uploads/` - runtime data; never commit new files here (partly tracked already).
- `.planning/codebase/` - these maps; `.claude/gsd-*` is a gitignored GSD install, while `.claude/commands/continue_CAPSTONE-USLS-MVP.md` and `.claude/skills/` are project content.

---

*Structure analysis: 2026-10-17*
