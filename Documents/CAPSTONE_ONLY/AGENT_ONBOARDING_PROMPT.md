# Agent Onboarding Prompt — USLS Graduate School Lifecycle Portal

## STOP — read this first, it governs every task below

This is an in-progress capstone with real work already on the branch and a teammate also committing.
Do **not** assume any item in this document still needs doing. Before you start ANY task, run this
four-step gate and do not skip it:

1. **Check if it is already done.** Search the codebase (backend `app.py`, `frontend/src/pages`,
   `frontend/src/api.js`, `CHECKLIST_PHASE_PLAN.md`) for the endpoint, page, component, or column the
   task would add. A teammate may have already built it under a different name. If it exists, say so
   and stop before writing anything.
2. **Check whether it was done correctly.** If it exists, read it end to end and compare it against
   the confirmed stakeholder decisions in Section 2 (hybrid data rule, subject-level withdrawal, no
   grade encoding, read-only imports, etc.). Note specifically where it diverges — do not just
   rubber-stamp it.
3. **State how you know it is correct.** For anything you build or judge as "done," give concrete
   verifiable evidence: the exact endpoint + a request/response you ran, the file:line, the row that
   was tagged/updated, the migration that applied, or the screen you loaded. "It should work" is not
   acceptable — verify end to end and show the proof.
4. **Give me choices before deciding — do not overwrite current progress.** When something already
   exists, is ambiguous, or your change would touch a teammate's file, present me with options
   (e.g. "A: extend the existing X, B: replace it, C: leave it and do Y") and let me pick BEFORE you
   edit. Never silently overwrite existing work. Preserve teammate changes unless I say otherwise.

Treat the ordered TO-DO list in Section 6 as *candidate* work, not a mandate — each item still passes
through this gate first.

---

Read this whole document before doing anything. It gives you the project context, the confirmed
stakeholder decisions, the architecture, what is already built, and exactly what to build next and
in what order. It exists so you do not have to re-derive the requirements from the raw transcripts.

You are also given three source documents. Treat them as primary evidence; this file is the
digested version:
- `July20Transcription.docx` — consultation with the advisor (Sir Oli).
- `July21USLSTranscription.docx` — consultation with the client (Sir Eddie of the USLS Graduate School).
- `Checklist for Corrections` / `CHECKLIST_PHASE_PLAN.md` — the 92-item correction checklist and its phase plan.

Additional in-repo references:
- `CHECKLIST_PHASE_PLAN.md` (root) — the authoritative 92-item plan with per-item status.
- `Documents/Stakeholder_Meeting_Prep/` — data-source confirmation templates + a Sir Oli revision checklist.

---

## 1. What the application is

A web app for the University of St. La Salle (USLS) **Graduate School (GS)** that gives GS staff a
single, consolidated **monitoring and coordination system** for the graduate student lifecycle:
admission handoff, enrollment, course offering/adjustment, coursework status, research (title →
proposal → final defense), practicum, graduation, and standing changes (leave of absence,
readmission, AWOL, residency, withdrawal).

Tech stack:
- Backend: **Python 3 + Flask**, single file `app.py` (very large, ~18k+ lines), SQLAlchemy models,
  SQLite (`usls_gs_demo.sqlite3`).
- Frontend: **React (Vite) + Tailwind**, in `frontend/src/`. Pages in `frontend/src/pages/`,
  shared components in `frontend/src/components/`, API client in `frontend/src/api.js`.
- Data comes from **imported spreadsheets**, not from a live database of fake data.

Run/build:
- Runs on **port 5050** (macOS ControlCenter occupies 5000). Launch config `.claude/launch.json`
  sets `FLASK_PORT=5050`. Start with the preview/dev server, not by editing ports.
- `npm run seed` reseeds the DB (imports the monitoring sheets + faculty sheet + demo students).
- `npm run build:web` builds the frontend; after frontend edits, rebuild then restart the server.
- Apple system Python 3.9 lacks `hashlib.scrypt`; `generate_password_hash` is wrapped to
  `pbkdf2:sha256`. Do not change that.
- Logins are `@usls.edu.ph`, shared password `DemoPass123!`:
  `staff@`, `academic@`, `research@`, `dean@`, `admin@`. Students log in through the demo dropdown
  on the login page (Student tab).

---

## 2. The single most important thing: the stakeholder reality

The two consultations partly CONFLICT. The **client (Sir Eddie, July 21)** describes the actual GS
workflow; the **advisor (Sir Oli, July 20)** pushed a stricter "AIMS is source of truth, data is
read-only" framing. The team resolved the conflicts as follows (these are the working decisions —
do not silently revert them):

Confirmed reality from Sir Eddie (client):
- **AIMS cannot produce the consolidated monitoring sheet.** AIMS only shows one student profile at
  a time. The whole reason this app exists is to give the GS the cohort-level monitoring view AIMS
  cannot generate. The app is meant to **replace the manual Excel monitoring sheet the GS keeps today.**
- **There is no live AIMS API.** Data exchange is **file-based / batch** at best (an Excel/CSV the
  GS could request from ITS or the Registrar). Do NOT assume or build a live AIMS integration.
- **The Academic Coordinator (AC) maintains enrollment and subject status inside the app.** The AC
  tags students to offered subjects (status becomes Enrolled), and changes status (Incomplete,
  Dropped, Failed, Withdrawn, Taken) as faculty report them. There is no AIMS export to pull this
  from, so the AC does it in the app.
- **The AC never encodes grades.** The AC only tags STATUS. Faculty grade encoding is an optional
  "Lego" module (for schools with no enrollment system) and is NOT used at USLS. Do not build/keep
  AC or faculty grade encoding as a required USLS path.
- **Course Offering Setup is a required missing step.** Before enrollment, the AC must be able to
  declare which subjects are offered for a given academic year + semester, with schedule + faculty.
- **Enrollment = tag students to offered subjects**, by (a) searching a student and tagging, or (b)
  uploading a class list (Excel/CSV: at least First Name, Last Name, ID Number, and a subject).
- **Withdrawal is subject-level** — an official withdrawal from a specific subject (does not count
  against the student), distinct from a mid-semester drop. (Note: Sir Oli earlier framed withdrawal
  as program-level; the team chose subject-level per the client. This conflict is still open with
  the advisor and must be reconciled before defense.)
- **Every standing change is a two-way exchange with the Registrar.** LOA, readmission, AWOL,
  residency, and withdrawal: the GS approves, produces a report/document for the Registrar, and the
  Registrar later confirms implementation back to the GS. The GS is NOT where these are officially
  executed.
- The system is built specifically for **USLS/La Salle Bacolod's workflow with the Registrar**, not
  as a generic standalone product (Sir Oli was explicit that the proposal is USLS-specific).

Hybrid data rule the team adopted (reconciling both advisors):
- **Imported official values are read-only** as raw imports, **but** the AC changes subject status
  through **dedicated, audited status modules** (each change logs who/when/old→new). It is NOT free
  spreadsheet cell editing, and it is NOT fully locked.

The checklist (92 items) also confirms, among many things: no manual student creation (students come
from the imported sheet), no app-generated student numbers, no generic "course readiness" or
prerequisite gating (only comprehensive-exam and thesis/dissertation milestone eligibility),
dropping has NO deny option, newly admitted students are "Not Yet Assessed" for risk (not default
Medium), and "RAG" must be split into "Red-Amber-Green" (risk) vs the AI "Policy Assistant"
(Retrieval-Augmented Generation).

---

## 3. Data model — how the app is populated

- The **monitoring sheet** is the source spreadsheet. Format is documented in
  `Documents/Monitoring_Sheets/README.md`. Key columns: `IDNO` (7-digit student number),
  `AY ENTRY`, `YR`, `SN`/`FN`, program header, curriculum subject columns (a unit value like `3`
  means completed), `COMPRE`, and milestone columns `TITLE`/`PROPOSAL`/`ETHICS`/`FINAL`.
- On seed, `app.py` imports every sheet in `Documents/Monitoring_Sheets/` (students + coursework),
  the faculty roster from `Documents/Faculty_Sheet/`, and creates the demo students.
- The important gap the client flagged: **the monitoring sheet only shows completed units.** It does
  NOT distinguish Enrolled / In Progress / Passed / Failed / Deferred(Incomplete) / Dropped /
  Withdrawn / Cancelled. Those outcomes must come from enrollment + status data the AC maintains (or
  from a future class-list / grades import). See `Documents/Stakeholder_Meeting_Prep/` for the
  proposed Enrollment Class List and Grades Completion templates prepared for stakeholder
  confirmation (they are proposals, not confirmed university formats).

Key models in `app.py` (search by class name):
- `Student`, `Course`, `CourseRecord` (per-student subject status), `Program`, `AcademicTerm`.
- `CurriculumOffering` — the published/official offering list; now also has `assigned_faculty_id`,
  `schedule`, `section`.
- `CourseOfferingPlan` + `CourseOffering` — the Course Adjustments demand/plan layer.
- `SubjectEnrollment` — the durable enrollment ledger; kept in sync via
  `sync_subject_enrollment_from_course_record`.
- Standing/process models: `WithdrawalApplication`, `AwolCase`, `ResidencyEnrollment`,
  `PracticumRecord`, `GraduationEndorsement`, `ResearchCase`, `PanelAssignment`,
  `StudentRequestAttachment`, `WorkflowMessage`, `TransactionLog`, `Task`.

---

## 4. Demo-account architecture (do not build a competing one)

There is an existing centralized demo-student system. Extend it; never create a parallel demo API.
- Config: `WORKFLOW_DEMO_STUDENTS` in `app.py`; helpers `ensure_workflow_demo_students`,
  `workflow_demo_students_payload`, and per-student reset.
- Endpoints: `GET /api/auth/demo-students` (returns `{items:[...]}`), and a reset endpoint per
  demo key.
- Frontend: `frontend/src/pages/Login.jsx` renders accordions **only on the Student login tab**,
  grouped into "Student workflow demos" (Practicum, Graduation) and "Standalone processes"
  (Withdrawal). Each student row has a quick-login area + a red Reset button.
- Existing demo accounts (all MAED, password `DemoPass123!`): Practicum (Andrea, Paolo),
  Graduation (Bianca, Carlo), Withdrawal (Elena, Joshua), plus the research demo Miguel Yu.
- If the dropdown appears empty, the demo students simply are not seeded in that DB — reseed/restart
  runs `ensure_workflow_demo_students()`. It is not a code regression.
- The full "two demo accounts per process" spec (idempotent seeding, real source records satisfying
  eligibility, centralized reset that clears the case from every account, ordinary-login-repairs-vs-
  reset-restarts, BPM-accurate transitions, red reset button placement, tests) is the pattern to
  follow when adding demo accounts for a new process. Ask the user for that spec text if needed.

---

## 5. What is already built (verified)

Monitoring / data integrity:
- Monitoring sheet is view/filter/export by default with a "Read-only · Source: AIMS export" banner
  and a per-row **Flag issue** exception-reporting path (`/api/students/<id>/flag-issue`). A
  teammate has since added an audited subject-status editor (`saveMonitoringSubjectStatus`,
  `/api/monitoring/subject-status`) with statuses including Enrolled/Incomplete/Dropped/Withdrawn —
  verify how complete this is before extending it.
- Duplicate/integrity banner on the monitoring sheet; `duplicateStudents` / `mergeStudents` exist.

Removals per checklist:
- Manual student creation removed from Student Handoff (students come only from the imported sheet).
- Drop **Deny** removed; a drop is now "Record drop" → status "Recorded (awaiting AIMS update)".
- Optional drop PDF removed.
- Newly admitted students are "Not Yet Assessed" for risk.
- Curriculum Planning was merged into Course Adjustments (its route redirects there).

Enrollment / offerings (the recently built part):
- **Class-list upload for Enrollment**: `POST /api/enrollment/class-list-import` + "Upload class
  list" button on the Enrollment page. Parses CSV/XLSX (Student ID + Subject Code), tags matched
  students Enrolled ONLY into officially offered subjects, logs every change. `api.importClassList`.
- **Course Offering Setup**: page `/course-offerings` (`frontend/src/pages/CourseOfferings.jsx`,
  nav item 3). Model fields `assigned_faculty_id`/`schedule`/`section` added to `CurriculumOffering`
  (migration is at the TOP of the startup `with app.app_context():` block so it runs before other
  schema checks — keep new column migrations there to avoid ordering crashes). Endpoints
  `GET/POST/PATCH/DELETE /api/course-offerings`; AC/admin manage, staff read-only.

Nav order (lifecycle group in `Layout.jsx`): 1 Student Handoff, 2 Course Adjustments,
3 Course Offering Setup, 4 Enrollment, 5 Research Gate, 6 Panel Matching, 7 Defense Scheduling,
8 Practicum, 9 Graduation. `ROLE_PATHS` gates which roles see which page; admin sees everything.

---

## 6. What to build next — IN THIS ORDER

Do them in order. Do not jump around. Each item: enforce the rule on the backend (do not rely on a
disabled button), keep official values audited, and keep the frontend build passing.

1. **Search-and-tag a single student to an offered subject** (the non-upload enrollment path). On
   the Enrollment screen: search a student, pick an offered subject for the semester, tag Enrolled.
   Reuse the class-list-import tagging logic and the offered-subject validation.

2. **Subject-needs report** ("generate missing subjects" with a per-subject count of students who
   still need it). This is the demand basis Sir Eddie wants for deciding what to offer. Keep the
   demand cutoff at **one student** (a subject is "needed" if at least one student still needs it),
   and keep Subject Need vs Proposed Offering vs Approved Offering vs Scheduled Class separate.

3. **Hybrid status modules on the monitoring sheet.** Verify/finish AC status changes (Enrolled,
   Incomplete, Dropped, Failed, Withdrawn, Taken/Completed) as audited actions (who/when/old→new,
   source, reason). Check the existing `saveMonitoringSubjectStatus` first and extend rather than
   rebuild.

4. **Subject-level Withdrawal.** Make withdrawal apply to a specific enrolled subject (distinct from
   a mid-semester drop), with Dean approval, a generated Registrar report, and a confirm-implemented
   step. (Flag the subject-vs-program conflict to the user; do not silently change the model to
   program-level.)

5. **Structured LOA (remove RAG/PDF).** Replace the uploaded-letter + AI extraction with a
   structured form validated by ordinary rules: allowed reasons, prior-leave count, allowed
   duration, effective period must be the next semester (cannot start a semester already begun).
   Flow: student form → rule validation → GS review → Dean approve/return-for-revision → system
   generates an official document/report → sent to Registrar → Registrar implementation later
   confirmed in the system. Also allow the student to withdraw a pending LOA application. Apply the
   same structured-form + Registrar-feedback pattern to **Readmission, AWOL, Residency**.

6. **Two demo accounts per assigned process** (Enrollment, Course Offering Setup, LOA,
   AWOL/Residency), using the existing demo-account architecture (section 4). Do this LAST, after
   the workflows exist, so the accounts reflect the corrected flow.

Cross-cutting (apply as you touch each area): split "RAG" naming into Red-Amber-Green (risk) vs
Policy Assistant (AI); make every recommendation explainable (data used, reasoning, human
decision-maker); never present locally maintained values as if they came live from AIMS.

---

## 7. Working conventions

- Preserve unrelated teammate changes in the repo; several files are actively edited by others
  (`MonitoringGrid.jsx`, `Enrollment.jsx`, `CourseOfferings.jsx`, `api.js`, `Login.jsx`,
  `CHECKLIST_PHASE_PLAN.md`). Read the current file before editing; do not revert others' work.
- Keep changes scoped to the assigned area. Add new DB columns via a migration placed at the TOP of
  the startup app-context block, and mirror the existing `ensure_*_schema` pattern.
- After backend edits: restart the server. After frontend edits: `npm run build:web` then restart.
  Verify with a real end-to-end action (login + API), not just that the file compiles.
- Do not invent university processes, deadlines, policies, or data sources. Where a policy value is
  unknown (e.g., the deferment period), make it configurable and show a neutral "to be confirmed"
  state instead of a fabricated value.
- Backend enforcement is authoritative. Do not gate behavior only with a disabled frontend button.

---

## 8. Suggested first message back to the user

Confirm you have read this file and the three source documents, restate the two open conflicts
(read-only vs AC-maintained data — resolved as the hybrid rule; subject-level vs program-level
withdrawal — resolved as subject-level, pending advisor reconciliation), then start with item 1
(search-and-tag single student) unless the user redirects you.
