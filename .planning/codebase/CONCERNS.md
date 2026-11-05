# Codebase Concerns

**Analysis Date:** 2026-10-17

Evidence for the owner's complaint: "a lot of inconsistencies, different UI sizes, unoptimized, so much code duplicated doing the same things, delete stuff that's not used anymore." All counts come from grep/AST scans run on 2026-10-17 against branch `v5.1-migui_clean`; commands are reproducible with the patterns quoted. Confidence tags: certain (zero references anywhere), likely (zero references except in-file or comments), check (needs a human look).

## Priority ranking

| Rank | Concern | Owner complaint it proves | Biggest evidence |
|---|---|---|---|
| 1 | No shared Table / Modal / filter components; 39 raw tables, 19 hand-built modals | duplicated, inconsistent | section 2 |
| 2 | No design tokens beyond colours; 12 text sizes, 91 one-off arbitrary values, 17 modal backdrops | different UI sizes | section 3 |
| 3 | One 4,956-line `WorkflowPage.jsx` and one 37,516-line `app.py` with all 210 routes in one 8,256-line closure | unoptimized, hard to change | sections 1, 6 |
| 4 | Dead code and dead folders (templates, static, `.codex`, outputs, 4 dead routes, 1 dead component, about 400 dead Python lines) | delete unused | section 5 |
| 5 | Unbounded lists and per-row queries; single 1.7 MB JS bundle with no code splitting | unoptimized | section 4 |
| 6 | Same permission matrix declared 3 times; role/status magic strings | inconsistencies | sections 1, 6 |

See `CLEANUP-CANDIDATES.md` for the delete table and the merge table with line estimates.

---

## 1. Backend duplication (Python)

Honest finding: whole-function copy-paste is LOW (an AST scan for identical bodies found 0; a Jaccard scan for near-identical functions found 25 pairs, mostly small). The duplication is STRUCTURAL: the same 5-10 line idioms repeated hundreds of times, and parallel mini-frameworks for the same job.

### 1.1 Repeated try/rollback/jsonify error block
- 14 literal copies of `except <X> as exc: db.session.rollback(); return jsonify({"error": str(exc)}), 400`, 10 more with `LeaveError` returning `exc.status` (`app.py:13112`, `13135`, `13149`, `13172`), plus 34 `except Exception as exc` and 18 `except ValueError as exc` handlers (grep counts).
- `process_case_transition` (`app.py:18293-18321`) and `process_cases_batch` (`app.py:18322-18366`) each hand-write the same three-way `ProcessError / Exception / success` block.
- Fix: one decorator or helper `run_action(fn, error_types)` that does commit, rollback, and shape. Estimated removal: 200-260 lines.

### 1.2 Parallel transition engines for leave vs other requests
- `leave_workflow.py` (338 lines, `TRANSITIONS` at `leave_workflow.py:138`) and `standalone_process.py` (367 lines, its own `TRANSITIONS` dict keyed by slug and `OPEN_STATUSES` at `standalone_process.py:129`) implement the same "action, kinds, batch, needs_comment" table twice.
- The routes mirror each other: `leave_case_transition` `app.py:18108-18126` vs `process_case_transition` `app.py:18293-18321`; `leave_cases_batch` `app.py:18128-18156` vs `process_cases_batch` `app.py:18322-18366`. The batch handlers compute `batchable` and `needs_comment` with the same two generator expressions (`app.py:18135-18141` vs `18337-18341`).
- `process_case_transition` even delegates to the leave route function for leave slugs (`app.py:18300`, `18328`), so both route families coexist. The leave-only list/batch/policy-review routes are mostly unused by the SPA (see section 5).
- `tests/test_standalone_consistency.py` (23 tests) exists to keep the two copies in step, which is itself a symptom.
- Fix: one transition engine parameterised by slug. Estimated removal: 150-250 lines across the two modules and `app.py`.

### 1.3 Dean / coordinator decision routes
Six routes implement "load item, check state, apply decision, log, notify, commit": `onboarding_review_decision` (`app.py:14132`, 27 lines), `coursework_report_decision` (`app.py:14287`, 22), `approvals_decide` (`app.py:16734`, 36), `workflow_approval_decide` (`app.py:16773`, 241), `adviser_appointment_decision` (`app.py:19294`, 76), `faculty_adviser_respond` (`app.py:19441`, 58), `faculty_panel_invitation_respond` (`app.py:19619`, 34). About 494 lines total; a shared decision helper could reclaim 120-180 lines.

### 1.4 Registrar report and upload routes
- Four near-parallel Registrar report builders: `withdrawal_registrar_report` (`app.py:13460`, 58 lines), `standing_change_registrar_report` (`13593`, 29), `awol_registrar_report` (`13625`, 41), `residency_registrar_report` (`13669`, 24): same `get_or_404`, state guard, workbook build, `send_file`. Estimate 60 lines saved.
- Three upload endpoints: `student_research_evidence_upload` (`app.py:12758`, 85), `student_request_attachment_upload` (`12918`, 45), `student_document_upload` (`13840`, 30) repeat file-type/size validation and storage. Estimate 50 lines saved.

### 1.5 Additive-migration boilerplate
- 20 `ensure_*_schema` / `*_columns` functions, 686 lines, and 32 `ALTER TABLE` statements all written as: `inspect(db.engine).get_columns(table)` then `for name, sql_type in additions.items(): if name not in existing: db.session.execute(text(f"ALTER TABLE ..."))` (`app.py:33761`, `33789`, `33826`; 75 `inspect(`/PRAGMA hits).
- Fix: `add_missing_columns(table, additions)` helper. Estimated removal: 250-300 lines. Keep behavior additive-only (AGENTS.md Rule 4).

### 1.6 Serializers
- 52 `*_dict` functions, 1,429 lines, hand-copy column to key (`faculty_dict` `app.py:2124`, `course_offering_dict` `3287`, `curriculum_offering_dict` `3305`, `course_record_dict` `2548`, ...). `course_audit_dict` (`app.py:2515`) defines an inner `row` helper that duplicates a sibling. A generic `model_to_dict(obj, fields, extra)` would shrink the simple ones. Estimate 200-400 lines; moderate risk because the SPA depends on exact keys.
- `student_brief` is called 63 times (`app.py:2194`) and `student_directory_brief` separately (`app.py:23826`): two near-same student shapes.

### 1.7 Repeated permission checks
- Same role tuples pasted into decorators: `("staff", "academic_coordinator")` appears on 48 routes (`grep -c` of the decorator, first at `app.py:12313`); `("staff", "academic_coordinator", "research_coordinator", "dean")` on 6+; `("staff", "research_coordinator")` on 8+. No named constants (`BACKOFFICE_ROLES` exists at `app.py:4739` but only 5 routes use `*BACKOFFICE_ROLES`).
- The matrix is restated in `ACCESS_CONTROL_SPEC` (`app.py:22975`) and again client-side in `frontend/src/components/Layout.jsx:102` (`ROLE_PATHS`) and `frontend/src/components/portalNav.jsx`.
- Fix: named role groups (`STAFF_SIDE`, `RESEARCH_SIDE`), generate `ACCESS_CONTROL_SPEC` from `API_ROLE_REGISTRY` (`app.py:4945`) for the check.

### 1.8 Lookups in student-portal routes
`Student.query.get_or_404(account.student_id)` appears 18 times and `Faculty.query.get(account.faculty_id)` 7 times at the top of near-identical handlers (for example `app.py:13108`, `13127`, `13145`). A `current_student()` / `current_faculty()` helper removes about 40 lines and gives one place for the 404 text.

**Total realistic backend reduction from merges alone: about 1,100-1,700 lines (3-4 percent of `app.py`)**, before moving seed/demo code (section 6.3).

---

## 2. Frontend duplication

### 2.1 What the shared layer covers and what it misses
Shared and well adopted: `StatusBadge` (194 uses, 50 files), `Card` (187), `Field` (154), `EmptyState` (89), `ErrorNote` (73), `SectionTitle` (65), `Input` (58), `Spinner` (42), `Select` (39), `Textarea` (33), `StatCard` (20), `useApi` (about 91 call sites).

Missing entirely: `Table`, `Modal`/`Dialog`, `FilterBar`/`SearchBox`, `Tabs`, `Pagination`, `PageContainer`, `DownloadButton`.

### 2.2 Tables: 39 raw `<table>` in 27 files
- `<table className=...>` has 12+ variants: `w-full min-w-[640px] text-sm` (6), `min-w-[760px]` (4), `min-w-[720px]` (4), `min-w-[860px]` (2), `min-w-[560px]`, `[680px]`, `[820px]`, `[920px]`, `[980px]`, `table-fixed`, `min-w-full text-left`.
- `<thead>` is unstyled in 28 places and uses 6 different style strings in the other 10 (for example `bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500` x6; `sticky top-0 ... text-[11px] ... text-slate-400`; `border-b ... bg-white`).
- `<th>` padding variants: `px-3 py-2` (52), `px-3 py-3` (26), `px-3 py-2.5` (20, with `scope="col"`), `px-4 py-2.5` (9), `px-5 py-3` (7), `px-4 py-3` (5): same visual role, six paddings. Only some set `scope="col"` (accessibility gap).
- Files with tables include `pages/Students.jsx`, `pages/Reports.jsx`, `pages/Faculty.jsx`, `pages/Enrollment.jsx`, `pages/MonitoringGrid.jsx`, `pages/EnrollmentClassList.jsx`, `pages/CourseAdjustments.jsx`, `pages/WorkflowPage.jsx`, `components/SubjectNeedsReport.jsx`, `pages/dean/*`.
- A `<DataTable columns rows>` component would remove an estimated 400-600 lines.

### 2.3 Modals: 19 files hand-build `fixed inset-0`
`fixed inset-0` shells are in `components/confirm.jsx`, `ExportFollowUpModal.jsx`, `FacultyAssignmentProfile.jsx`, `Layout.jsx`, `monitoring/AddStudentDialog.jsx`, `monitoring/ReasonDialog.jsx`, `monitoring/StudentRecordPanel.jsx`, `pages/BusinessRules.jsx`, `Dashboard.jsx` (`:402`), `dean/DeanParts.jsx` (`DeanDialog` `:95`), `Enrollment.jsx` (`:704`), `faculty/FacultyCalendar.jsx`, `Faculty.jsx` (`:276`), `leave/ModalShell.jsx`, `MonitoringGrid.jsx`, `PolicyDocuments.jsx`, `WorkflowPage.jsx` (`:2419`). Three of them are complete duplicate shells with the same `size === "wide" ? "max-w-[96rem]" : ...` ternary: `pages/dean/DeanParts.jsx:98`, `pages/WorkflowPage.jsx:2419`, and `pages/leave/ModalShell.jsx`. 17 distinct backdrop class strings (see section 3). A single `<Modal>` with focus trap and `aria-labelledby` would remove an estimated 400-600 lines and fix per-modal accessibility drift.

### 2.4 Components defined 2-4 times locally
- `Field`: `components/forms.jsx:3` (shared) plus local copies at `pages/CourseAdjustments.jsx:542`, `pages/dean/DeanLeaveParts.jsx:32`, `pages/Enrollment.jsx:995`.
- `Select`: shared `components/forms.jsx:23`; local copies `pages/Reports.jsx:252`, `pages/Students.jsx:348`.
- `StatCard`: shared `components/ui.jsx:134`; local `pages/WorkQueue.jsx:350`; `MiniStat` x3 (`pages/Dashboard.jsx:431`, `pages/Reports.jsx:686`, plus a third).
- `Pill`: shared `components/ui.jsx:85` (used in only 2 files); local `components/ProcessGates.jsx:22`, `pages/EnrollmentClassList.jsx:272` (`SummaryPill`).
- `Fact` x3: `components/calendar/CalendarPage.jsx:68`, `pages/student/LeaveCaseCards.jsx:101`, `pages/student/ProcessCaseCard.jsx:17`.
- Local status badges instead of `StatusBadge`: `pages/CourseAdjustments.jsx:499 OfferingStatusBadge`, `pages/PolicyDocuments.jsx:51 StatusPill`, `pages/dean/DeanLeaveParts.jsx:26 PolicyCheckBadge`, `pages/dean/DeanShared.jsx:54 AgeBadge`, `components/leaveStatus.jsx:14 LeaveStatusBadge`, `pages/faculty/FacultyAdviserPanel.jsx:119 contractBadge`, `pages/Faculty.jsx:694 AvailabilityBadge`, `pages/MonitoringGrid.jsx:579 CompreExamBadge`.
- `NoteForm`, `HistoryList`, `Summary`, `Detail`, `CaseTable`, `Banner`, `ActionButton`, `StudentCell`, `SubjectRow` each defined in two files (duplicate-name scan of top-level `function` declarations).

### 2.5 Helpers copy-pasted
- `formatDate` defined in 3 places with 3 different outputs: `lib/format.js:155` (locale undefined, "Oct 17, 2026"), `pages/CourseAdjustments.jsx:472` (returns "not recorded", `toLocaleDateString()`), `pages/EnrollmentClassList.jsx:324` (`en-PH`). `formatDateTime` also at `lib/format.js:162` and `pages/WorkflowPage.jsx:4897`, `formatTime` at `WorkflowPage.jsx:4905`. 30 raw `toLocale*` calls bypass the helper. Same date, different formats on different screens.
- `csvCell` x3: `components/SubjectNeedsReport.jsx:302`, `pages/EnrollmentClassList.jsx:320`, `pages/Reports.jsx:712`.
- Blob-download dance (`URL.createObjectURL` + hidden anchor) copy-pasted 9 times: `api.js:146,168,445`, `components/SubjectNeedsReport.jsx:323`, `pages/EnrollmentClassList.jsx:72`, `pages/MonitoringGrid.jsx:168`, `pages/Reports.jsx:386,601,704`.
- `api.js`: `JSON.stringify` x101, `const qs = queryString(...)` pattern x21, 14 raw `fetch(` for downloads. A `post(path, body)` / `get(path, params)` pair would shrink the 573-line file by about 150 lines.
- `api.meta()` fetched separately in 8 pages (no context or cache).

### 2.6 Overlapping page families
- `components/ProcessBoardPage.jsx` (563 lines) and the `pages/leave/*` kanban pieces (12 files: `CaseCard.jsx`, `CaseDetailModal.jsx`, `BatchBar.jsx`, `LeaveFilters.jsx`, ...) are two board UIs for the same concept (leave vs standalone processes); `ProcessBoardPage` imports `pages/leave/*`, so they are coupled but still carry separate filters and cards.
- Dean views repeat the staff views: `pages/dean/DeanPages.jsx`, `DeanParts.jsx`, `DeanLeaveParts.jsx`, `DeanShared.jsx`, `DeanReportPages.jsx` mirror `pages/Reports.jsx`, `WorkflowPage.jsx` graduation parts, and `ProcessBoardPage`.
- Student vs staff: `pages/student/LeaveCaseCards.jsx` (452) and `pages/student/ProcessCaseCard.jsx` repeat case-card markup of `pages/leave/CaseCard.jsx`.
- 12 pages implement their own search input (`placeholder="Search`): `Students.jsx`, `Faculty.jsx`, `WorkQueue.jsx`, `ActivityLog.jsx`, `PolicyDocuments.jsx`, `BusinessRules.jsx`, `StudentPicker.jsx`, `SubjectNeedsReport.jsx`, `leave/LeaveFilters.jsx`, `dean/DeanParts.jsx`, `WorkflowPage.jsx`, plus `FilterChip` in `WorkQueue.jsx:364`.

### 2.7 God files
`frontend/src/pages/WorkflowPage.jsx` is 4,956 lines, 93 top-level functions, 71 `useState` calls, 181 `text-xs` and 39 arbitrary font sizes; it is reached through one route `/workflow/:slug` (`App.jsx:117`) and holds: Handoff import, research gate form, panel matching form, defense scheduling form (400 lines, `:1650`), availability workspace (248, `:2050`), graduation roster (283, `:4336`), graduation batch modal (263, `:3412`), practicum, withdrawal. Next largest: `pages/Enrollment.jsx` (1,248; one component of 618 lines `:33`), `pages/Reports.jsx` (734), `pages/Faculty.jsx` (713), `pages/MonitoringGrid.jsx` (601; component of 542 lines `:29`). 42 of 621 function components exceed 150 lines.

**Estimated frontend reduction by introducing Table, Modal, DownloadButton, FilterBar, Field/Select de-dup and an api helper: 1,500-2,500 lines (5-8 percent of 31,700).**

---

## 3. UI inconsistency (measured)

Design-token layer: PARTIAL. `frontend/tailwind.config.js` defines the `brand` 50-900 palette, `canvas`, `ink`, two font families (`Open Sans` body, `Poppins` display), `shadow-card`/`shadow-lift`, and overrides `rounded-xl`/`2xl`. `frontend/src/index.css:26-47` defines only 6 component classes: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.field-label`, `.field-input`. There is NO type scale, spacing scale, heading style, table, modal, badge, tab, danger-button or page-container class.

### 3.1 Font sizes (token counts across `frontend/src/**/*.jsx`)
| Variant | Count |
|---|---|
| `text-xs` | 897 |
| `text-sm` | 704 |
| `text-lg` | 40 |
| `text-2xl` | 30 |
| `text-xl` | 21 |
| `text-base` | 17 |
| `text-3xl` / `text-4xl` | 3 / 1 |
| `text-[11px]` | 146 |
| `text-[10px]` | 31 |
| `text-[15px]`, `[9px]`, `[12px]` | 3, 2, 1 |

Body text is `text-xs` more often than `text-sm` (897 vs 704), and 184 further arbitrary pixel sizes (`text-[9px]` to `[15px]`) sit at or below `text-xs` (12px), so 11px, 12px and 10px labels sit one pixel apart and read as accidental differences. Biggest users of arbitrary sizes: `pages/WorkflowPage.jsx` (39), `pages/Faculty.jsx` (13), `components/calendar/CalendarView.jsx` (13), `pages/MonitoringGrid.jsx` (11), `pages/Login.jsx` (8), `pages/PolicyDocuments.jsx` (6), `pages/Assistant.jsx` (6). `font-display text-[15px]` for the brand title is hand-typed in 3 files (`Layout.jsx:154`, `RoleSidebar.jsx:40`, `RoleAssistantPage.jsx:15`).

### 3.2 Headings
- `<h1>`: 21 total. 15 use `font-display text-2xl font-semibold text-ink`, 2 add `mt-1`, 2 omit `text-ink`, `ChangePassword` uses `text-xl`, `Login` uses `text-4xl leading-tight`.
- `<h2>`: 45 total, at least 12 distinct class strings: `font-display text-lg ...` (13), `font-display text-xl ...` (4+3+...), `text-base font-semibold` with no display font (3), `text-lg` without `font-display` (2+3), `font-display text-2xl` (2). The display font is applied inconsistently, so identical section titles render in Poppins on one screen and Open Sans on another.
- `PageHeader` (`components/ui.jsx:101`) is used by 14 portal files and by NO staff page. 21 files hand-write `<h1>`: `Dashboard`, `Students`, `StudentDetail`, `Faculty`, `Reports`, `WorkQueue`, `ActivityLog`, `Enrollment`, `EnrollmentClassList`, `CoursePlanning`, `CourseAdjustments`, `MonitoringGrid`, `TermSettings`, `PolicyDocuments`, `BusinessRules`, `Assistant`, `ChangePassword`, `Login`, `WorkflowPage`, `ProcessBoardPage`.

### 3.3 Spacing
- Horizontal padding tokens: `px-3` 506, `px-4` 290, `px-2` 113, `px-5` 71, `px-2.5` 69, `px-3.5` 20, `px-1.5` 15, `px-1` 14, `px-6` 2.
- Vertical: `py-3` 327, `py-2` 312, `py-2.5` 136, `py-1.5` 107, `py-0.5` 74, `py-1` 72, `py-4` 33, `py-5` 9, `py-6` 7, plus `py-8/10/12/14/16`.
- Card padding `p-`: `p-4` 145, `p-6` 108, `p-3` 105, `p-5` 60 (four equally common choices for "inside a card").
- Gap: `gap-2` 437, `gap-3` 256, `gap-1.5` 115, `gap-4` 64, plus 6 more variants.

### 3.4 Cards, radius, shadow
- `Card` component: 187 uses; `.card` class on 21 lines; and 79 additional inline strings combining `rounded-xl|2xl` + `border` + `bg-white` instead of using either.
- Radius: `rounded-xl` 419, `rounded-lg` 186, `rounded-full` 183, `rounded-2xl` 63, plain `rounded` 37, `rounded-md` 20, `rounded-sm` 8. Buttons are `rounded-xl` (`.btn`), icon buttons `rounded-lg`, inputs `rounded-xl`, cards `rounded-2xl`, but pills and table cells mix all of them.
- Shadow: `shadow-sm` 17, `shadow-lift` 11, `shadow-2xl` 10, `shadow-card` 1 (the token meant for cards is almost never used directly because `.card` embeds it), `shadow-xl`/`shadow-lg` 1 each.

### 3.5 Buttons
- `.btn-primary` 119 uses, `.btn-ghost` 218. No `.btn-danger`: a red button is hand-written (`inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm ...`, one copy), and 26 of 392 `<button>` elements carry bespoke `className` with no `btn` at all, in at least 10 different strings (for example `grid h-9 w-9 ... rounded-lg text-slate-500 hover:bg-slate-100` x3, `grid h-8 w-8 ... border border-slate-200` x2, `grid h-10 w-10 ...` x2). Icon-button sizes h-8/h-9/h-10 coexist.

### 3.6 Modals and widths
- 17 distinct `fixed inset-0` backdrop strings: z-index values `z-40, z-50, z-[70], z-[80], z-[90], z-[100], z-[110]` and backdrop colours `slate-950/40, /45, /50, /55` and `ink/40, /45, /50`; some with `backdrop-blur-sm`, some `backdrop-blur-[1px]`, two with no tint at all (`z-[100]/[110] ... p-4`). Stacked modals can therefore end up beneath each other.
- Dialog widths: `max-w-3xl` (10), `max-w-xl` (7), `max-w-md` (5), `max-w-xs` (5), `max-w-lg` (4), `max-w-4xl` (4), `max-w-2xl`, `max-w-5xl` (`Dashboard.jsx:402`), `max-w-6xl` (`Enrollment.jsx:704`), `max-w-7xl` (`Faculty.jsx:276`), `max-w-[96rem]` (`DeanParts.jsx:98`, `WorkflowPage.jsx:2419`). 24 distinct `max-w-*` values in total.
- Page container: `Layout.jsx:267` sets `max-w-[90rem]` for the main area; `RoleAssistantPage.jsx:20` sets `max-w-6xl`; `Login.jsx:193` `max-w-6xl`. Table `min-w-[...]` has 11 different pixel minimums.

### 3.7 Colour
Palette use (token count): slate 2,283; brand 805; amber 430; red 296; emerald 188; blue 65; violet 11; sky 10; green 10; rose 5. `emerald` (188) and `green` (10) are used as "success" alongside `brand` (the actual green identity): `lib/format.js` maps "Scheduled" to emerald but "Confirmed" and "Appointed" to brand, and "Accepted" to emerald, so two different greens signal the same state. 15 raw hex literals in JS (for example `#64748b`, `#f1f5f9`, `#0f7a44`, `#f59e0b`, `#ef4444`) are the Recharts colours in `pages/Dashboard.jsx` and bypass tailwind tokens. 30 inline `style={{...}}` attributes. Plain `gray-*` is never used (0), good.

### 3.8 Who diverges most
`pages/WorkflowPage.jsx` (181 `text-xs`, 39 arbitrary sizes, 18 inline card strings, no `PageHeader`), `pages/Faculty.jsx`, `pages/MonitoringGrid.jsx`, `pages/Login.jsx`, `components/calendar/CalendarView.jsx` (13 arbitrary sizes, only 8 `text-xs/sm`), versus the portal pages (`pages/student/*`, `pages/faculty/*`, `pages/dean/*`) which use `PageHeader` and `Card` more consistently. The staff side and the portals therefore feel like two products.

---

## 4. Performance

### 4.1 Bundle and loading
- `frontend/dist/assets/index-CsQnAlQN.js` is 1,704,725 bytes (1.7 MB) in a single chunk; CSS 67 KB. `grep lazy(|Suspense frontend/src` returns nothing: every page, the 4,956-line `WorkflowPage`, and `recharts` (imported only by `pages/Dashboard.jsx`) ship to every user including students. `frontend/vite.config.js:14-17` has no `manualChunks`. Fix: `React.lazy` per route group in `App.jsx:1-30`, lazy-load `recharts`. Likely 50-70 percent smaller first load.
- `api.meta()` re-fetched by 8 pages on every visit (`Dashboard.jsx:137`, `Students.jsx:12`, `MonitoringGrid.jsx:38`, `EnrollmentClassList.jsx:8`, `WorkflowPage.jsx:171`, `Assistant.jsx:19`, `AdviserRecordCard.jsx:13`, `process/ResidencyDialog.jsx:18`). `useApi` (`hooks.js:4`) has no cache or de-duplication.
- `NotificationBell.jsx:44` polls every 60 s (`POLL_MS`, `:9`), acceptable.
- Only 152 `useMemo/useCallback/memo` for 31,700 lines; pages with 71 `useState` (WorkflowPage) re-render the whole 4,956-line tree on every keystroke. Check with React Profiler.

### 4.2 Backend: unbounded lists
Only `/api/students` paginates (`app.py:12352-12356`). `paginate(` appears 0 times in `app.py`. Whole-table reads (no `limit`) behind routes:
- `process_case_rows` withdrawal branch returns every `WithdrawalApplication` (`app.py:8865-8869`, no `.limit`), each building a dict that issues several queries (see 4.3). The AWOL and residency branches cap at 150 (`app.py:8872`, `8880`) but append every uncovered AWOL student (`app.py:8876`).
- `monitoring_grid` loads every student of a program (`app.py:17522-17550`, `.all()` then a Python sort); batched with `in_()` queries, so the query count is fine but the payload is the whole sheet.
- `curriculum_offering_list` `AcademicTerm.query.all()` and `CurriculumOffering.query.all()` (`app.py:15341`, `15346`); `course_offerings_update` and `_delete` run `AcademicTerm.query.all()` to find a term in Python (`app.py:16371`, `16379`) where a filter would do.
- 25 `Model.query.all()` calls in total (`grep -c "\.query\.all()"`).

### 4.3 N+1 and per-row recompute
- `ensure_delay_status_consistency` (`app.py:5246-5256`): `for student in Student.query.all(): student_priority(student)` loads and scores the entire population in Python. Mitigated by a throttle in `refresh_risk_levels` (`app.py:5268-5284`, `RISK_REFRESH_SECONDS`) but it is called from 5 hot routes (`app.py:12302`, `12308`, `12315`, `14081`, `14089`), so the first request after expiry pays for all students.
- `students_list` (`app.py:12314`): the `compre-eligible` filter does `[s.id for s in query.all() if comprehensive_exam_eligibility(s)["eligible"]]` (`app.py:12349`) and every page row then calls `comprehensive_exam_eligibility(s)` again (`app.py:12362`). Each call runs `compute_course_audit` (`app.py:32712`), which queries per student: 25 extra heavy computations per page, whole population when that filter is on.
- `course_adjustments_plan` publish: `for student in Student.query.filter_by(program_id=program.id).all(): recompute_risk(student)` (`app.py:16672`).
- `process_case_rows` (`app.py:8863-8885`) maps each row through `withdrawal_process_case` / `awol_process_case` / `residency_process_case`, each of which runs its own `TransactionLog` and related queries (`app.py:8485-8495`, `8611`, `8696`, `8702`, `8776`, `8787`): about 3-6 queries per row, unbounded for withdrawals.
- `faculty_portal_context` (`app.py:14752`, 168 lines) loops document checks, verdicts and schedules, each iteration querying adviser approvals / verdicts (`app.py:14841`, `14856`, `14878`).
- `sync_leave_cases` (`app.py:7311`) loops open cases and calls `leave_log`, `leave_notice`, `leave_open_task`, `open_leave_case` per row.
- An AST scan found 199 loops over query results that call further query-issuing helpers (many benign, loops over small reference tables like `Program.query.all()`); the ones above are the ones touching the student population.
- Eager loading is barely used (22 `joinedload/selectinload/lazy=` hits, 14 `index=True`/`db.Index` hits for 62 models), so relationship traversal inside serializers lazy-loads per row.

### 4.4 Startup and import weight
Import-time seeding: `app.py:37400-37516` runs schema `ensure_*` functions, policy library seeding, RAG index prewarm (`app.py:10503-10520`), and demo seeding on every start (guarded by test/seed flags, `tests/test_health.py:517`). The owner already notes slow startup (memory `windows-dev-setup`).

---

## 5. Dead code and unused files

Method: route paths from the AST (210 routes) matched against every string in `frontend/src`, `tests/`, `templates/`, `scripts/`; Python defs matched by whole-word reference count across all `.py/.cjs/.mjs/.json` and templates; React exports matched across all `src` files. Full table with confidence in `CLEANUP-CANDIDATES.md`. Headlines:

### 5.1 Whole folders
- `templates/` (3 files, 658 lines) and `static/styles.css` (693 lines): `app.py` has `Flask(__name__, static_folder=None)` (`app.py:375`) and ZERO `render_template` calls (`grep render_template app.py` = 0). Only `send_from_directory` for uploads and `FRONTEND_DIST` (`app.py:20156`). AGENTS.md calls them "legacy". Confidence: certain.
- `.codex/` (30 tracked files, 729 KB): a Codex-agent mirror of `.claude/skills` (`.codex/skills/ui-ux-pro-max`, `.codex/skills/intelligence-layer`) plus `local-server.pid`; the owner has no Codex (global CLAUDE.md, 2026-10-01). Confidence: certain.
- `outputs/` (124 tracked files, 27 MB): one-off walkthrough screenshots, `walkthrough_source_extract/` (65 files), logs `walkthrough_app_stderr.log`, a recovered `.docx` (8.7 MB). Not read by `app.py`. Confidence: likely (they are the output of `scripts/capture_walkthrough_screenshots.py`).
- `_handout/`: empty, ignored by `.gitignore:53`. Confidence: certain.
- `scripts/docs/` (589 tracked files, 71 MB, of which `walkthrough/` 566): document-build tooling for the capstone paper, not the app. Only `scripts/docs/opsmanual` is referenced by a test (`tests/test_operations_manual_content.py`). Confidence: check with the owner.
- `__pycache__/` at root and `scripts/__pycache__` (ignored). `.rag_index/` (1.9 MB, regenerated, ignored).

### 5.2 Backend routes with no caller
(FE-and-tests zero hits unless noted.)
- `GET /api/terms/active` (`app.py:12111-12117`, 3 lines): 0 in `frontend/src`, 0 in `tests/`. certain.
- `POST /api/student-portal/title-defense/parse` (`app.py:12721-12755`): 0 hits anywhere. certain.
- `POST /api/curriculum-planning/subjects` (`app.py:15393-15446`, about 54 lines): 0 hits; the SPA redirects the whole `/curriculum-planning` page to `/course-adjustments` (`App.jsx:108`). Neighbouring `curriculum-planning/offerings` (GET/POST/DELETE) and `/generate` are referenced only by tests (3 and 2 hits). likely.
- `GET /api/course-audit/subjects` (`app.py:17018-17045`): 0 hits; only `/course-audit/roster` is used (`api.js:314`). certain.
- Routes whose only SPA client (`api.js` method) is itself unused: `GET /api/leave-cases` (`api.leaveCases`), `POST /api/leave-cases/batch` (`api.leaveCasesBatch`; handler still reached through `process_cases_batch` `app.py:18328`), `POST /api/leave-of-absence/policy-review` and `/api/readmission/policy-review` (`api.loaPolicyReview`, `api.readmissionPolicyReview`; 0 hits in tests too), `POST /api/student-portal/requests/leave-of-absence/withdraw` (`api.withdrawStudentLoaRequest`; 3 test hits), `GET /api/availability-requests` and `GET /api/panel-invitations` (10 and 2 test hits). check.
- `/api/decision-support` (`app.py:17695`): 0 hits in `frontend/src` (SPA redirects `/decision-support` to the work queue, `App.jsx:115`), 2 test hits. likely.

### 5.3 Frontend dead code
- `frontend/src/components/RoleAssistantPage.jsx`: imported nowhere (`grep RoleAssistantPage` finds only its own definition). certain.
- Unused `api.js` methods (7): `availabilityRequests`, `leaveCases`, `leaveCasesBatch`, `loaPolicyReview`, `panelInvitations`, `readmissionPolicyReview`, `withdrawStudentLoaRequest`. certain.
- Exports never imported elsewhere and with 1 occurrence in their own file (never used at all): `deanGraduationRequirementTone`, `deanGraduationRequirementClasses`, `deanGraduationRequirementDetailLines`, `deanGraduationFallbackChecklist` (`pages/dean/deanHelpers.js`), `SectionCard` (`pages/dean/DeanShared.jsx`), `isLeaveDecisionDue` (`pages/dean/DeanLeaveParts.jsx`), `SchedulePanel` (`pages/student/Panels.jsx:281`), `loaTimelineSteps` (`components/WorkflowTimeline.jsx`), `PORTAL_ROLE_HOME` (`components/portalNav.jsx`). certain. Another 22 exports are imported nowhere but used inside their own file (needless `export`; candidates: `DeanGraduationRequirementBoxes`, `DocumentViewButton`, `MissingDocumentUpload`, `ResearchEvidenceUpload`, `ConceptPaperCompliance`, `GoogleCalendarPreviewDialog`, `STUDENT_NAV_GROUPS`, `DEAN_NAV_GROUPS`, `FACULTY_NAV_GROUPS`). check.
- Unused shared components: `CheckList` is imported once (`WorkflowPage.jsx:51`) but never rendered (`<CheckList` = 0 uses); `Pill` from `ui.jsx` is rendered 3 times in 2 files.
- Redirect-only routes kept for old bookmarks (`App.jsx:80,107-109,115,120-121`): `/decision-support`, `/course-planning`, `/curriculum-planning`, `/course-offerings`, `/calendar`, `/adviser-appointments`, `/approvals`. `pages/CourseOfferings.jsx` (213-line component) and `pages/CoursePlanning.jsx` are only reachable through `CoursePlanning`; verify `CourseOfferings` is still rendered there.

### 5.4 Python functions with zero references (AST + word count)
Excluding Flask decorator-registered handlers (`reject_non_object_json_bodies`, `http_error`, `unreadable_number`, which are live), 18 functions are defined and never mentioned again anywhere (about 400 lines): `cancel_active_subject_enrollments` (`app.py:4073`, 41 lines), `prior_loa_semesters` (`5909`), `_inspect_policy_pdf` (`9506`), `_chunk_rag_text` (`9676`), `_merge_rag_source_chunks` (`10615`), `_focused_local_rag_excerpt` (`10667`, 38), `_local_answer_location` (`10923`), `call_google_ai_studio` (`11513`), `latest_request_attachment` (`23465`), `_course_record_drops_manual_provenance` (`25517`), `slot_conflicts_google_busy` (`31329`), `infer_submitted_research_items` (`32308`), `automatic_faculty_assignment` (`33016`, 28), `ensure_demo_comprehensive_exam_consistency` (`33967`, 72), `ensure_faculty_demo_names` (`36113`), `ensure_faculty_demo_profiles` (`36123`, 24), `ensure_miguel_yu_research_demo_unlock` (`37083`, 49), `ensure_demo_request_submission_logs` (`37162`, 53). certain (name appears exactly once in all `.py`, tests, scripts, templates). The `ensure_*demo*` ones may be intentionally parked; confirm with the owner.
- `scripts/`: `prepare_capstone_submissions.py` and `capture_walkthrough_screenshots.py` have no referrer anywhere (likely one-off). `generate_aims_export_template.py`, `update_monitoring_workbooks.py`, `reimport_monitoring_workbooks.py`, `build_class_list_demo.mjs`, `update_faculty_roster.mjs` are referenced only from `.planning/codebase/*.md` docs. check.
- `standalone_process.py` and `panel_demo_data.py` are NOT dead: imported at `app.py:8352` and `app.py:34842/34864/34958` and by tests.

---

## 6. Bad habits

### 6.1 Giant functions (longest 20 module/nested functions in `app.py`; `register_routes` itself is 8,256 lines at `app.py:11914`)
| # | Lines | Function | Line |
|---|---|---|---|
| 1 | 708 | `seed_maed_personas` | `app.py:35247` |
| 2 | 390 | `ensure_workflow_demo_student_baseline` | `app.py:36477` |
| 3 | 285 | `enrollment_save` (route) | `app.py:15593` |
| 4 | 283 | `course_adjustments_plan` (route) | `app.py:16424` |
| 5 | 262 | `serialize_transaction_context` | `app.py:23556` |
| 6 | 241 | `workflow_approval_decide` (route) | `app.py:16773` |
| 7 | 209 | `graduation_batch_actions` (route) | `app.py:19905` |
| 8 | 209 | `enrollment_subject_status_update` (route) | `app.py:15881` |
| 9 | 204 | `enrollment_preview_payload` | `app.py:4274` |
| 10 | 195 | `ensure_workflow_activity_schema` | `app.py:34041` |
| 11 | 188 | `book_defense_schedule` | `app.py:27070` |
| 12 | 187 | `graduation_eligibility` | `app.py:21162` |
| 13 | 182 | `panel_matching_result` | `app.py:33535` |
| 14 | 174 | `reset_workflow_demo_case` | `app.py:29169` |
| 15 | 170 | `monitoring_issues_resolve_upload` (route) | `app.py:18581` |
| 16 | 169 | `monitoring_grid` (route) | `app.py:17522` |
| 17 | 168 | `faculty_portal_context` (route) | `app.py:14752` |
| 18 | 163 | `defense_availability_context` | `app.py:31383` |
| 19 | 163 | `dashboard_stats` | `app.py:20265` |
| 20 | 159 | `evaluate_class_list_row` | `app.py:24379` |

Frontend equivalents (largest components): `Enrollment` 618 lines (`pages/Enrollment.jsx:33`), `MonitoringGrid` 542 (`pages/MonitoringGrid.jsx:29`), `ProcessBoardPage` 426 (`components/ProcessBoardPage.jsx:139`), `CourseAdjustments` 423 (`pages/CourseAdjustments.jsx:21`), `StudentDetail` 406 (`pages/StudentDetail.jsx:27`), `DefenseSchedulingForm` 400 (`pages/WorkflowPage.jsx:1650`), `Login` 318 (`pages/Login.jsx:76`).

### 6.2 Magic strings
- Roles: see CONVENTIONS.md; `"staff"` 182, `"student"` 178, `"faculty"` 121, `"academic_coordinator"` 112, `"dean"` 50, `"research_coordinator"` 45 in `app.py`; 105 in the SPA.
- Statuses as bare literals: `"Completed"` 97, `"Active"` 83, `"Pending"` 69, `"Approved"` 38, `"Submitted"` 36, `"Returned"` 35, `"Confirmed"` 20 (`app.py`). Some groups are named tuples (`ACTIVE_DEFENSE_STATUSES` `app.py:30999`), most are not. A source comment admits the alias problem: `"Confirmed" is the legacy word for "Scheduled"` (`app.py:30999`), and `lib/format.js` has to colour both.
- Status colour map `STATUS_STYLES` in `frontend/src/lib/format.js:4+` keys on display strings, so a rename on the backend silently loses the colour.

### 6.3 Seed/demo code lives in the production module
About 2,370 lines of functions named `seed_*` (4 functions, 886 lines) and `ensure_*demo*`/`reset_*demo*` (24 functions, 1,486 lines), 274 lines mentioning "demo", all inside `app.py` and executed at startup. Moving them to `seed_demo.py` would not delete behavior but would remove about 6 percent of `app.py` from the hot path.

### 6.4 Exceptions
66 `except Exception` (blanket), 8 `except...: pass` (`app.py:9089`, `9428`, `9450`, `9774`, `10220`, `10490`, `20246`, `30675`), 0 bare `except:`. The route-level `except Exception` at `app.py:18308` and `18356` turns programmer errors into a 400 with `str(exc)` shown to users (information leak plus mis-categorised bug).

### 6.5 Print debugging and commented-out code
11 `print()` calls, all startup/seed notices (`app.py:9712`, `10503`, `10515`, `10520`, `37413`, `37462`, `37470`, `37486`, `37500`, `37515`); no `console.log` in the SPA; about 3 commented-out code lines in `app.py`. This area is clean.

### 6.6 Time handling
`date.today()` 100 times vs `now_utc()` 265 times (`app.py:284`) vs 3 `datetime.utcnow()` in iCal output (`app.py:28240`, `28264`, `29807`, deprecated in Python 3.12). A docstring at `app.py:22420` already warns that `datetime.utcnow()` skews ages. Mixed local and UTC dates can shift deadlines by a day around midnight in Manila (UTC+8).

---

## Security considerations

- `SECRET_KEY` falls back to "a public default in demo mode" (`app.py:357-376`). Make sure production sets `SECRET_KEY`.
- `admin` bypasses every role gate (`app.py:4961`). Intentional, but means any bug in admin account creation is a full-access bug.
- `.env` exists locally (not read). Both `.env` and `uploads/` content are git-ignored (`.gitignore`), though `git ls-files uploads` lists 19 tracked files (seed policy library; confirm none are private).
- Error responses echo `str(exc)` in 66 broad handlers (see 6.4).
- Demo endpoints (`/api/auth/demo-accounts`, `/api/auth/demo-students*`, `/api/transactions/<slug>/demo-reset` `app.py:20117`) are gated by `demo_mode_enabled()` (`app.py:11934-11950`, and `app.py:20118` for `demo-reset`). Verified.

## Test Coverage Gaps

See `TESTING.md`: no frontend tests at all; no contract test between `api.js` and routes; no query-count tests; scripts untested; migration path on a legacy DB untested; tests share one app process and one DB file across modules.

---

*Concerns audit: 2026-10-17*
