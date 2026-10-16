# Testing Patterns

**Analysis Date:** 2026-10-17

(Inspected only. The suite was not run for this analysis.)

## Test Framework

**Runner:**
- Python stdlib `unittest`. No `pytest`, no `conftest.py`, no `tests/__init__.py` (tests import each other as a namespace package: `from tests import test_research_core as rc`, `tests/test_calendar_appointments.py:14`).
- No config file for tests. `requirements.txt` has no test dependencies.

**Assertion library:** `unittest.TestCase` assertions (`assertEqual`, `assertIn`, ...). `openpyxl.load_workbook` used to assert on exported spreadsheets (`tests/test_bpm_workflows.py:7`). `unittest.mock` (`MagicMock`, `patch`) is used in about 111 lines across the suite.

**Run commands:**
```bash
.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v                       # the gate (all)
.venv/Scripts/python.exe -m unittest tests.test_bpm_workflows.BpmWorkflowSimulationTests.test_name -v  # one test (AGENTS.md Rule 2)
```
No watch mode, no coverage command, no frontend command.

## Size of the suite

19 test files, 591 `def test_` methods, about 17,800 lines of tests (counted with `grep -cE '^\s+def test_'` and `wc -l`).

| File | Lines | Tests | Area |
|---|---|---|---|
| `tests/test_bpm_workflows.py` | 5,541 | 80 | BPMN workflows end to end, access-control KPI, analytics, exports |
| `tests/test_calendar_appointments.py` | 1,444 | 93 | availability engine, adviser appointments, invitations, feed (builds on `test_research_core`) |
| `tests/test_research_core.py` | 1,239 | 57 | research gates, evidence, panels (`ResearchCoreBase` fixture used by 3 other files) |
| `tests/test_loa_readmission.py` | 1,160 | 50 | leave/readmission engine (`leave_workflow.py`) |
| `tests/test_business_rules.py` | 889 | 31 | rule catalog |
| `tests/test_crosscut.py` | 875 | 39 | cross-cutting behavior |
| `tests/test_academic_fixes.py` | 829 | 37 | academic fixes |
| `tests/test_policy_documents.py` | 755 | 42 | policy library |
| `tests/test_polish.py` | 558 | 28 | polish items |
| `tests/test_monitoring_crud.py` | 555 | 13 | portal CRUD on the monitoring sheet |
| `tests/test_health.py` | 548 | 30 | health/login smoke |
| `tests/test_panel_matching.py` | 523 | 16 | panel matching |
| `tests/test_standalone_consistency.py` | 490 | 23 | `standalone_process.py` vs `leave_workflow.py` |
| `tests/test_assistant_quality.py` | 357 | 18 | policy assistant (reads `tests/assistant_eval*.json`) |
| `tests/test_rulesux.py` | 207 | 11 | rules UX |
| `tests/test_subject_needs_report.py` | 167 | 5 | subject-needs report |
| `tests/test_operations_manual_content.py` | 155 | 15 | ops manual text |
| `tests/test_portals.py` | 70 | 2 | portals |
| `tests/test_ethics_order.py` | 26 | 1 | ethics-after-proposal ordering |

Docs drift: `AGENTS.md:141-143` says "one file, ~79 tests". The real figures are above.

## Test File Organization

- All in `tests/`, flat, named `test_<area>.py`. Fixture data: `tests/assistant_eval.json`, `tests/assistant_eval_holdout.json`.
- Reusable bases live inside test modules, not a shared module: `ResearchCoreBase` (`tests/test_research_core.py`), `CalendarBase`/`AdviserBase` (`tests/test_calendar_appointments.py:32,377`).

## Test Structure

Each module builds its own throwaway SQLite DB BEFORE importing `app`:

```python
_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
from app import (...)  # noqa: E402
```
(`tests/test_bpm_workflows.py:11-18`). 16 of 19 files repeat this preamble (`NamedTemporaryFile` count per file).

Per-test setup wipes and rebuilds the schema, then seeds a minimal program/course/student/4 accounts:

```python
def setUp(self):
    app.config.update(TESTING=True)
    with app.app_context():
        db.drop_all(); db.create_all()
        self.program = Program(code="BPM", ...)
        ...
```
(`tests/test_bpm_workflows.py:136-172`). Requests go through the Flask test client with the session set directly (`self.client(account_id, role)` pattern in `tests/test_research_core.py`, `login()` in `tests/test_health.py:149`).

## Patterns

- Test-first rule is policy (AGENTS.md Rule 1): the test is written from the checklist item, watched failing, then implemented.
- Black-box via HTTP client is the norm; many tests also import internals from `app` directly (`access_control_kpi`, `analytics_payload`, `generate_study_plan_draft` at `tests/test_bpm_workflows.py:37-61`), coupling tests to function names in the monolith.
- Names are long sentences describing the rule (`test_proposal_panel_matching_does_not_wait_for_ethics_clearance`, `tests/test_ethics_order.py:15`).
- No `skipTest` or `@unittest.skip` usage was found; the word "skip" in tests refers to batch results (`"skipped"`) and startup-skip switches (`tests/test_health.py:517`).

## Mocking

`unittest.mock.patch` for external services: `patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"})` plus `patch.object(...)` for the AI call (about 9 uses), `patch("app.google_busy_by_faculty", ...)`, `patch("app.write_demo_pdf")` (4 uses), `patch("app._inspect_policy_document", ...)`. Do not mock the database; tests run a real SQLite file. Uploads go to `tempfile.mkdtemp` directories set through env vars before import.

## Fixtures and Factories

No factory library. Each base class has `_account(role, email)`, `_faculty(name, hours=...)`, `fill_uploads(...)`, `pass_gate(...)` helper methods (`tests/test_research_core.py`, `tests/test_bpm_workflows.py`). Demo data used by seeds (`panel_demo_data.py`) is also imported by a test (`tests/test_bpm_workflows.py:3874`).

## Coverage

None measured or enforced. No `coverage` config.

## Test Types

- Unit: pure-function checks on `leave_workflow.py`, `standalone_process.py`, `policy_rag.py`, `business_rules_catalog.py` (`tests/test_loa_readmission.py`, `tests/test_standalone_consistency.py`, `tests/test_assistant_quality.py`, `tests/test_business_rules.py`).
- Integration: the bulk. Flask test client against a real SQLite DB with `db.drop_all(); db.create_all()` per test.
- Meta-tests: `access_control_kpi` compares live routes against `ACCESS_CONTROL_SPEC` (`app.py:22975`, `app.py:23063`), `policy_grounding_kpi` and `tests/assistant_eval*.json` score the assistant.
- E2E: none. No browser tests. The walkthrough tooling in `scripts/capture_walkthrough_screenshots.py` is documentation tooling, not a test.

## What is NOT tested

1. **The entire frontend (31,700 lines).** `frontend/package.json` has no test script and no vitest/jest/testing-library/eslint/prettier. The only check is `vite build` (`npm run build:web`), which proves it compiles. Highest-risk untested UI: `frontend/src/pages/WorkflowPage.jsx` (4,956 lines, 71 `useState`), `pages/Enrollment.jsx` (1,248), `components/ProcessBoardPage.jsx` (563), `pages/MonitoringGrid.jsx` (601).
2. **Frontend/backend contract.** Nothing checks that `frontend/src/api.js` (about 177 methods) hits routes that exist. A scan found `api.js` methods with no caller (`availabilityRequests`, `leaveCases`, `leaveCasesBatch`, `loaPolicyReview`, `panelInvitations`, `readmissionPolicyReview`, `withdrawStudentLoaRequest`) and backend routes with no caller in the SPA or tests (`/api/terms/active` `app.py:12111`, `/api/student-portal/title-defense/parse` `app.py:12721`, `/api/curriculum-planning/subjects` `app.py:15393`, `/api/course-audit/subjects` `app.py:17018`).
3. **Scripts.** `scripts/*.py`, `scripts/*.mjs` (AIMS template, workbook import/export, class list) are required by AGENTS.md Rule 1 to have targeted tests; only `scripts/rebuild_demo_walkthrough.py` is referenced from a test (`tests/test_business_rules.py`).
4. **Performance.** No test counts queries or times an endpoint. N+1 patterns in CONCERNS.md section 4 are unguarded.
5. **Startup/migrations.** The `ensure_*_schema` upgrade path on an OLD database file is only exercised against a fresh `create_all()` DB; no test opens a pre-existing legacy schema and verifies the `ALTER TABLE` additions (`app.py:33811` and 19 sibling functions).

## Risks in the test setup itself

- **Shared process state.** Under `unittest discover`, all 19 modules import the same `app` in one process. `DATABASE_URL` is read when `app` is first imported, so only the FIRST module's temp DB is used; later modules' `os.environ["DATABASE_URL"] = ...` lines are no-ops, and their `tearDownClass` (`tests/test_bpm_workflows.py:127-134`) unlinks a file that may belong to a different module's run. Confidence: likely; confirm by printing `app.config["SQLALCHEMY_DATABASE_URI"]` from two modules in one run.
- **Speed.** `db.drop_all(); db.create_all()` before every one of 591 tests, plus `ensure_*` seeding on import, makes the gate slow; no test is parallel-safe.
- **Heavy imports from `app`.** Tests import dozens of private names from the 37,516-line module (`tests/test_bpm_workflows.py:21-121`), so any rename needs a matching sweep of the tests.

## Common patterns to copy

Async: not applicable (Flask sync). Error testing: post invalid input through the client and assert the status code and the `{"error": ...}` body (global shape, `app.py:404-452`):

```python
resp = client.post("/api/...", json={...})
self.assertEqual(resp.status_code, 400)
self.assertIn("error", resp.get_json())
```

---

*Testing analysis: 2026-10-17*
