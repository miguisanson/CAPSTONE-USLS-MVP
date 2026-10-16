# Coding Conventions

**Analysis Date:** 2026-10-17

Scope: Flask backend (`app.py` 37,516 lines, `leave_workflow.py`, `standalone_process.py`, `policy_rag.py`, `business_rules_catalog.py`, `panel_demo_data.py`) and React SPA (`frontend/src`, 31,700 lines of JS/JSX). Each rule below says what the code does today. Places where the code does NOT follow its own convention are flagged "NOT FOLLOWED".

No linter or formatter config exists anywhere (no `.eslintrc*`, `.prettierrc*`, `ruff.toml`, `pyproject.toml`, `setup.cfg`, `.editorconfig`). Style is held only by habit; `frontend/src/hooks.js:21` carries an `eslint-disable-next-line` comment for a tool that is not installed.

---

## Backend (Python)

### Naming

- Functions and variables: `snake_case`. No violations found (`grep -nE "^def [a-z]*[A-Z]" app.py` returns nothing).
- Models: `PascalCase` classes inheriting `db.Model`, 62 top-level classes (`Program` at `app.py:461` onward).
- Constants: `UPPER_SNAKE` module-level (`BACKOFFICE_ROLES` `app.py:4739`, `ROLE_LABELS` `app.py:4761`, `ACTIVE_DEFENSE_STATUSES` `app.py:30999`).
- Private helpers: leading underscore (`_portfolio_row` `app.py:5287`, `_process_dean_decide` `app.py:8886`).
- Serializers: `<thing>_dict(obj)` is the dominant pattern: 52 functions, about 1,430 lines (for example `faculty_dict` `app.py:2124`, `leave_case_dict` `app.py:7399`, `account_dict` `app.py:4716`). Variants that break the pattern: `student_brief` (`app.py:2194`), `student_directory_brief` (`app.py:23826`), `serialize_transaction_context` (`app.py:23556`), `*_payload` functions. There is no `to_dict` method on models (0 definitions); serialization is always a free function.
- Route handler names are `<area>_<verb>` (`students_list`, `faculty_availability_delete_exception`). The name is also the key into `API_ROLE_REGISTRY` (`app.py:4945`), so renaming a handler silently changes the access-control KPI.
- Type hints: present on 749 of 839 module-level `def` lines (`-> ...`). `from __future__ import annotations` is at `app.py:1`. Nested route handlers inside `register_routes` are mostly un-annotated.

### Structure of `app.py` (where code goes)

1. Imports and config (`app.py:1` to about 400)
2. `create_app` + `register_json_error_handling` (`app.py:370-452`)
3. Models (`app.py:461` onward)
4. Serializers and workflow helpers, mixed together (about 1,700 to 11,900)
5. `register_routes(app)` at `app.py:11914` to `app.py:20170`: ONE function holding all 210 routes as nested closures (8,256 lines)
6. More helpers, `ensure_*_schema` migrations, seed and demo functions (`app.py:20175` to `37,300`)
7. Startup block `with app.app_context():` near `app.py:37400-37516`

NOT FOLLOWED: helpers used by routes are defined both before AND after `register_routes` (for example `request_payload` is at `app.py:20175`, after the routes that call it; `refresh_risk_levels` at `app.py:5268`). Python resolves these at call time so it works, but there is no "helpers first, routes last" order to rely on.

### Response shapes

- Errors: always `jsonify({"error": "<human sentence>"}), <status>`. 381 occurrences of `return jsonify({"error"`. The SPA shows `error` as-is (`frontend/src/api.js:13-14`).
- Status codes in use: 400 (280x), 404 (43x), 409 (66x), 403 (30x), 401 (3x), 422 (1x), 500 (0x, never raised by hand). Use 400 for validation, 409 for "wrong state for this action", 404 for missing, 403 for role.
- Global net: `register_json_error_handling` (`app.py:404-452`) turns any `HTTPException` under `/api/` into `{"error": ...}`, and turns `int("abc")`-style `ValueError`/`TypeError` into a 400. A route may therefore `raise ValueError("message")` or call `abort()` and still produce the standard shape.
- Success: `jsonify({"ok": True, "message": "...", ...})` for actions (105 uses of `"ok": True`); `jsonify({"items": [...], ...})` for lists (29 uses of `"items":`). NOT FOLLOWED: many reads return ad-hoc top-level keys (`{"case": ..., "vocabulary": ...}` `app.py:18104`, `{"user": ...}` `app.py:11988`), and the list shape for paginated data (`items,total,page,page_size,pages` `app.py:12361-12366`) exists only on `/api/students`.
- Pagination: only `/api/students` paginates (`app.py:12354-12356`). Everything else returns whole lists (see CONCERNS.md section 4).

### How routes check roles

Every protected route is decorated with `@require_api_login(*roles)` defined at `app.py:4948-4973`:

```python
@app.route("/api/students/duplicates")
@require_api_login("staff", "academic_coordinator")
def students_duplicates(): ...
```

- No roles = any signed-in account (`@require_api_login()`, for example `app.py:12080`).
- `admin` silently passes every gate (`app.py:4961`).
- It also blocks accounts with `must_change_password` (403 with `must_change_password: True`, `app.py:4963-4967`).
- The decorator records each handler's roles in `API_ROLE_REGISTRY` (`app.py:4945`), and a SECOND, hand-maintained copy of the same permissions lives in `ACCESS_CONTROL_SPEC` (`app.py:22975`) to feed `access_control_kpi()` (`app.py:23063`).
- Object-level checks (a student may only touch their own case) are done inline in the handler: `if not case or case.student_id != account.student_id: return 404` (`app.py:13164`).
- Workflow-step ownership uses `require_workflow_actor(*roles)` (`app.py:4976`) which raises `ValueError`, not a 403.

NOT FOLLOWED:
- Role names are bare string literals everywhere: `"staff"` 182x, `"student"` 178x, `"academic_coordinator"` 112x, `"faculty"` 121x, `"dean"` 50x, `"research_coordinator"` 45x in `app.py`. There is no `Role` enum or constants module. A typo in a role string is not caught by anything except the KPI test.
- 41 inline role comparisons (`account.role ==` / `.role in`) bypass the decorator (for example `app.py:13876`, `if account.role == "student" and account.student_id != evidence.student_id`).
- `process_case_transition` calls another route handler directly: `return leave_case_transition(safe_int(ref))` (`app.py:18300`) and `return leave_cases_batch()` (`app.py:18328`). The inner handler's decorator re-runs and the outer decorator has a different role set (`staff, dean, academic_coordinator` vs `staff, dean`), so an `academic_coordinator` is let in by the outer gate and then rejected by the inner one.

### Error handling in handlers

Dominant pattern (14 literal copies plus 10 `LeaveError` variants, `app.py:13111-13114`):

```python
try:
    case = leave_file_loa(student, data, account)
    db.session.commit()
except LeaveError as exc:
    db.session.rollback()
    return jsonify({"error": str(exc)}), exc.status
```

- Domain exceptions carry their own status: `LeaveError` (`.status`), `ProcessError` (`_process_error_response`, `app.py:18305`).
- `except Exception as exc:  # noqa: BLE001` appears 66 times; it is used deliberately as "a refused step must never be a server error" (`app.py:18308`) but also hides real bugs by turning them into 400s.
- Silent swallow: 8 `except ...: pass` blocks (`app.py:9089`, `9428`, `9450`, `9774`, `10220`, `10490`, `20246`, `30675`). Most are around cache/index file writes (acceptable); `9089` swallows a failed `db.session.rollback()`.
- No bare `except:` anywhere (0 found by AST scan).
- Logging: `app.logger.error` is used only in the 5xx handler (`app.py:431`); the 11 `print(...)` calls are startup/seed notices (`app.py:9712`, `10503`, `10515`, `10520`, `37413`, `37462`, `37470`, `37486`, `37500`, `37515`). Business events are logged to the DB via `add_log(...)` (`TransactionLog`), which is the audit convention.

### Database access

- `Model.query...` (Flask-SQLAlchemy legacy API) is the norm. NOT FOLLOWED: `Query.get()` (legacy, deprecated in SQLAlchemy 2.0) is used 53x and `db.session.get()` 48x; `get_or_404` 116x. Pick `db.session.get()` for new code.
- Commits happen in the handler (`db.session.commit()` 184x), not in a unit-of-work layer.
- Time: `now_utc()` (`app.py:284`) used 265x; but `date.today()` is used 100x and `datetime.now()` once, and `datetime.utcnow()` 3x for iCal stamps (`app.py:28240`, `28264`, `29807`). Local-date and UTC-date logic are mixed.
- Request bodies: `request_payload()` (`app.py:20175`, returns a `MultiDict`, used 36x) versus `request.get_json(silent=True) or {}` (42x). Both are in use inside the same files; new code should use `request_payload()` when the form can contain lists.
- Schema changes: additive `ALTER TABLE ... ADD COLUMN` guarded by `inspect(db.engine).get_columns(...)`, one `ensure_*_schema()` function per area (20 functions, 686 lines, for example `ensure_policy_document_schema` `app.py:33811`). See AGENTS.md Rule 4.

### Comments and docstrings

- Docstrings explain WHY and the policy basis (see `register_json_error_handling` `app.py:404-408`). Route handlers often have one-line docstrings stating the user-visible behavior.
- `# noqa: BLE001` / `# noqa: E402` are used 51x; there is no linter that reads them.
- Commented-out code: effectively none (3 candidate lines by regex).

---

## Frontend (React + Tailwind)

### Naming and files

- Components: `PascalCase.jsx`; one default or named export per page. Helpers/data: `camelCase.js` (`deanHelpers.js`, `leaveHelpers.js`, `lib/format.js`).
- Folders by role portal: `pages/student/`, `pages/dean/`, `pages/faculty/`, `pages/leave/`, `pages/process/`; shared pieces in `components/`.
- Imports: relative paths only (no `@/` alias; `frontend/vite.config.js` defines none). Shared UI imported as `import { Card, EmptyState } from "../components/ui"` (without extension, though `ui.jsx` is the real file name; some files add `.jsx`, for example `pages/dean/DeanLeaveParts.jsx:2`).
- Role strings: bare literals (`"staff"`, `"dean"`; 105 occurrences) with no constants file. `BACKOFFICE_ROLES` is redeclared in `frontend/src/App.jsx:35` and mirrors `app.py:4739`. Per-role route allow-lists are hand-copied into `components/Layout.jsx:102+` (`ROLE_PATHS`) and `components/portalNav.jsx`.

### Fetching data and showing loading/errors

- All HTTP goes through `request()` in `frontend/src/api.js:4-21` (JSON in, `{error}` out, throws `Error(message)`), exposed as a flat object `api.<verb><Noun>()` of about 177 methods. Query strings are built by `queryString()` (`api.js:23`) but the "build qs then append" lines are copy-pasted 21x.
- Reads use the `useApi(fn, deps)` hook (`frontend/src/hooks.js:4-25`) returning `{data, loading, error, refetch}`: 30 files, about 91 call sites.
- Display convention: `if (loading) return <Spinner label="..." />; if (error) return <ErrorNote message={error} />;` from `components/ui.jsx:41,64`. `Spinner` is used in 34 files, `ErrorNote` in 36 files (73 uses), `EmptyState` in 42 files (89 uses).
- Mutations are hand-rolled per component: local `useState` for `busy`/`error`/`message`, `try { await api.x(); await refetch(); } catch (err) { setError(err.message) }`. About 69 `setError(err.message)`-style lines and 66 local `[error, setError]` states. There is no shared `useMutation`/`useAction` hook.
- NOT FOLLOWED: 10 components still keep their own `const [loading, setLoading] = useState` instead of `useApi`; `api.meta()` is fetched independently by 8 pages (`pages/Dashboard.jsx:137`, `Students.jsx:12`, `MonitoringGrid.jsx:38`, `EnrollmentClassList.jsx:8`, `WorkflowPage.jsx:171`, `Assistant.jsx:19`, `AdviserRecordCard.jsx:13`, `process/ResidencyDialog.jsx:18`) with no shared cache or context.
- Confirmation: `useConfirm()` from `components/confirm.jsx` (in-app dialog; the file header says it replaces `window.confirm`). No `window.confirm` or `alert(` anywhere. Good.
- Role gating: `RoleOnly` / `BackofficeOnly` wrappers in `App.jsx:136-165`; sidebar visibility from `Layout.jsx` `ROLE_PATHS`. Server remains the real gate.

### Shared UI vocabulary (what exists)

`components/ui.jsx`: `StatusBadge`, `Card`, `SectionTitle`, `Spinner`, `EmptyState`, `ErrorNote`, `ProgressBar`, `Pill`, `PageHeader`, `StatCard`, `InlineNotice`. `components/forms.jsx`: `Field`, `Input`, `Textarea`, `Select`, `CheckList`, `RadioRow`. `lib/format.js`: `statusClass`, `formatDate`, `formatDateTime`, `relativeDays`. CSS component classes in `index.css:26-47`: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.field-label`, `.field-input` only.

Not provided anywhere: a `Table`, a `Modal`/`Dialog` shell, a `Tabs`/`FilterBar`/`Pagination`, a danger button class, a `PageContainer`. These are re-built inline (see CONCERNS.md sections 2 and 3).

### Class conventions actually in force

- Tailwind utility classes inline in JSX, long single-line strings. Brand colour token `brand-*`, canvas `bg-canvas`, text `text-ink`, shadows `shadow-card`/`shadow-lift` (`frontend/tailwind.config.js`).
- Page title: `<h1 className="font-display text-2xl font-semibold text-ink">` (15 of 21 `<h1>`). Section title: `<h2 className="font-display text-lg font-semibold text-ink">` (13 of 45 `<h2>`).
- Buttons: `.btn-primary` (119 uses) and `.btn-ghost` (218 uses). Danger/icon buttons have no class and are re-spelled inline (26 of 392 `<button>` have `className` with no `btn`).
- NOT FOLLOWED: `PageHeader` exists but 21 files hand-write their own `<h1>`; only 14 files (all portal pages) use `PageHeader`. Staff pages (`Dashboard.jsx`, `Students.jsx`, `Reports.jsx`, `WorkflowPage.jsx`, etc.) never use it.

### Comments

- Top-of-file or top-of-function comments explain business rule and the BPMN/handbook basis (for example `components/confirm.jsx:4-7`, `api.js` section comments "BPMN 2 Enrollment"). Inline JSX comments use `{/* ... */}`.
- No TODO/FIXME/HACK strings in `frontend/src` (0). No `console.log` (0).

---

## Where conventions break, in one list

1. Role names are string literals in 3 places (backend 700+ occurrences, frontend 105) and the permission matrix exists three times (`@require_api_login`, `ACCESS_CONTROL_SPEC` `app.py:22975`, `Layout.jsx` `ROLE_PATHS`).
2. `Query.get` vs `db.session.get`; `date.today()` vs `now_utc()`; `request_payload()` vs `request.get_json(silent=True) or {}`.
3. Response shape for lists is only standardized on `/api/students`.
4. `PageHeader` defined but unused by staff pages; `Field`, `Select` and `Pill` redefined locally (see CONCERNS.md 2).
5. Docs drift: `AGENTS.md:141-143` and `CLAUDE.md` say `app.py` is about 23,000 lines and the suite has about 79 tests; actual values are 37,516 lines and 591 `def test_` methods in 19 files.

---

*Convention analysis: 2026-10-17*
