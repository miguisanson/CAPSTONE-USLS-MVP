# Next Session Plan — BPMN Compliance Gaps (Miguel's scope)

**Written:** 2026-07-28 · **Branch:** `v4.1-khloe`

This plan continues the BPMN/conceptual-framework compliance work. Read this instead of
re-deriving the gaps — they were verified against the running system, not assumed.

---

## 0. Context you need before starting

### Decisions already locked with the project owner

| Decision | Ruling |
|---|---|
| Conceptual framework | The **old 7 modules** in the proposal are correct. The 8-module `Conceptual Framework.png` in `References_Context` is **wrong — disregard it**. Ch5's Table 21 mapping stands as written. |
| Architecture diagram | Node/Express/Prisma/JWT/React-TS in the diagram vs Flask/SQLAlchemy/session/JSX as built: **keep both and document the divergence** in Ch5. Do NOT rewrite the backend. |
| BPMN conflicts (Canvas step, RC-vs-AC offering role) | **Leave as-is and note them as open conflicts** in the document. Do not implement, do not redraw. |
| Withdrawal | Subject-level (client) not program-level (adviser). Already built correctly. |

### Source of truth files
- BPMNs: `Documents/CAPSTONE_ONLY/References_Context/FINAL BPMS/*.png`
- Proposal (live copy, contains Ch4–6): `Documents/CAPSTONE_ONLY/Final Proposal Document - CAP-IT1.docx`
- Walkthrough: `Documents/CAPSTONE_ONLY/USLS GS Portal Demo Walkthrough.docx`

### Environment
See the `windows-dev-setup` memory. Short version: `.venv/Scripts/python.exe`, MySQL
`usls_gs_demo`, launch config `usls-gs-win`, port 5050, ~40 s startup. Faculty accounts are
`@gs.local` **not** `@usls.edu.ph`. AC/RC log in with `role: "staff"`.

### Baseline at time of writing
- **66 automated tests, 65 pass.** The single failure is pre-existing **DEF-001**
  (`test_workflow_demo_students_quick_login_and_central_reset`) — the demo-reset baseline
  leaves 3 enrolled subjects instead of 1. Demo fixture only, not withdrawal logic.
- `app.py` ≈ 23,400 lines, 120 routes, 35 tables.
- **Done last session:** Module 5 + 7 analytics (7 reports + KPI card) on
  `/api/reports/analytics`, `canonical_owner_role()`, `_days_since()` timezone fix.

---

## 1. G1 — Student Handoff / Admission onboarding  ⭐ biggest gap

**Source:** `BPMN1_Admission.png`
**Today:** `/workflow/student-handoff` is *only* a monitoring-workbook import (upload,
history, validation issues). None of the onboarding case flow exists.

### What BPMN1 actually specifies

```
Registrar (ext) → send admission status
GS Staff   → record admission handoff → create onboarding case → request account creation
           → notify student account setup → request program confirmation
AC         → review program assignment → [program correct?]
                 No  → request program correction ──┐ (loops back to GS Staff)
                 Yes → confirm program assignment → notify GS Staff confirmation
GS Staff   → record program confirmation → create student profile
           → create onboarding checklist → record onboarding status
           → notify onboarding completion
Dean       → review onboarding report → approve onboarding completion → notify GS Staff
GS Staff   → receive dean approval → record admission completion → notify student
Student    → receive account creation notice → create Graduate School account → END
```

### Build order

1. **Model `OnboardingCase`** — new table. Put the migration at the **TOP** of the startup
   `with app.app_context():` block (existing convention, avoids ordering crashes).
   Suggested columns:
   `id, student_id FK, status, admission_reference, account_requested_at,
   program_confirmation_status, program_confirmed_by_user_id, program_confirmed_at,
   program_correction_note, checklist_status, onboarding_reported_at,
   dean_decision, dean_decision_at, dean_remarks, admission_completed_at,
   student_notified_at, created_at, updated_at`
2. **Checklist items** — either a child table `OnboardingChecklistItem(case_id, label,
   required, completed_at, completed_by_user_id)` or a JSON column. Prefer the child table;
   it matches how `DocumentCheck` already works.
3. **Endpoints** under `/api/transactions/student-handoff/…` to stay consistent with the
   existing workflow route family:
   - `POST …/onboarding-cases` — create case from an imported student
   - `POST …/onboarding-cases/<id>/request-account`
   - `POST …/onboarding-cases/<id>/request-program-confirmation` (→ AC)
   - `POST …/onboarding-cases/<id>/program-decision` (AC: confirm | request correction)
   - `POST …/onboarding-cases/<id>/checklist/<item_id>` (tick item)
   - `POST …/onboarding-cases/<id>/submit-to-dean`
   - `POST …/onboarding-cases/<id>/dean-decision` (approve | return)
   - `POST …/onboarding-cases/<id>/complete` (records admission completion + student notice)
4. **Authorization** — enforce on the server, per role: GS Staff owns creation/record steps,
   AC owns the program decision, Dean owns the onboarding approval. A disabled button is
   never the only protection.
5. **Every transition writes a `TransactionLog`** entry with `actor_role`, `next_owner`,
   `previous_status`, `new_status`. This is what makes the case appear in queue aging and
   workload analytics automatically — do not skip it.
6. **Frontend** — extend `frontend/src/pages/WorkflowPage.jsx` for the `student-handoff`
   slug, or add a dedicated onboarding panel. Board-by-stage (like Withdrawal) reads well.
7. **Student portal** — add the account-creation notice + "create your account" step to
   `StudentPortal.jsx`.

### Acceptance criteria
- [ ] A case cannot reach Dean approval with an incomplete checklist.
- [ ] AC "request correction" returns the case to GS Staff and is reflected in the log.
- [ ] Dean approval is required before admission completion is recorded.
- [ ] Student sees the notice only after Dean approval.
- [ ] Non-owning roles are refused by the API, not just by hidden buttons.
- [ ] New case appears in `/api/reports/analytics` queue aging under "Student Handoff".

### Tests to add
`test_onboarding_case_requires_program_confirmation_before_dean`
`test_academic_coordinator_can_return_program_assignment_for_correction`
`test_onboarding_completion_requires_dean_approval`
`test_student_account_notice_appears_only_after_dean_approval`
`test_onboarding_roles_are_enforced_on_the_server`

---

## 2. G2–G4 — Enrollment

**Source:** `BPMN2_Enrollment.png`

### G2 · Study plan draft
BPMN: GS Staff *"generate study plan draft"* → *"send study plan to Academic Coordinator"*.
Nothing exists (`study_plan` appears only in policy text and task titles).

- Generate from the student's curriculum vs completed `CourseRecord`s — the remaining-subject
  logic already exists in `compute_course_audit()`; reuse it, do not rewrite.
- Model `StudyPlanDraft(student_id, term_label, generated_by_user_id, generated_at,
  status, sent_to_ac_at, ac_reviewed_at, ac_remarks)` + line items for proposed subjects.
- Endpoint `POST /api/enrollment/study-plan/generate` and `.../send-to-coordinator`.
- Surface on the Enrollment screen next to the existing tagging actions.

### G3 · Curriculum version tagging + rationale
BPMN decision gates: *"curriculum tag exists?"* → select version → tag student curriculum;
*"multiple curriculum versions?"* → select version → **record curriculum rationale**.
`curriculum_version` appears **nowhere** in the codebase.

- Add `curriculum_version` to `Student` (or a `StudentCurriculumTag` table if a student can
  carry history — prefer the table, it preserves the audit trail).
- `ensure_authoritative_curricula()` already exists — check how it resolves curricula before
  adding a competing concept.
- The rationale is required only when more than one version is available. Enforce that rule
  server-side and log it.

### G4 · Student "view recommended subjects"
BPMN2 gives the student a lane containing exactly this, and it is their whole lane.

- Read-only list in `StudentPortal.jsx`, derived from the same remaining-subject logic as the
  study plan draft plus the published `CurriculumOffering` list for the active term.
- Must be explicitly labelled advisory — it is not enrollment.

### Acceptance criteria
- [ ] Study plan draft is derived, never hand-entered.
- [ ] Rationale is mandatory when multiple curriculum versions exist, optional otherwise.
- [ ] Student sees recommendations without any ability to self-enroll.

### Tests
`test_study_plan_draft_is_derived_from_curriculum_and_completions`
`test_curriculum_version_tagging_requires_rationale_when_multiple_versions_exist`
`test_student_recommended_subjects_are_read_only_and_advisory`

---

## 3. G5 — Coursework → Dean status report

**Source:** `BPMN4_Coursework.png`

AC lane ends: check course completion → `[completion issues found?]` → update monitoring sheet
→ **send status to Dean**; Dean lane: receive coursework status → review coursework report.
The Dean-facing report does not exist.

- Generate a per-term coursework status summary (completion issues, missing subjects,
  affected students) and route it to the Dean's approvals queue.
- Reuse the existing `/api/approvals` surface rather than inventing a new Dean screen.
- Log the send and the Dean's review.

> **Do NOT implement the "Review Canvas courses" step.** Per the owner's ruling this stays an
> open conflict — there is no Canvas integration anywhere in the system or the architecture.

### Tests
`test_coursework_status_report_reaches_the_dean_queue`
`test_coursework_report_lists_completion_issues_and_missing_subjects`

---

## 4. Document updates

Target: `Documents/CAPSTONE_ONLY/Final Proposal Document - CAP-IT1.docx`
(the live copy — it already contains Ch4–6). Build scripts are in the session scratchpad
pattern: unpack → edit `word/document.xml` → rezip → validate → render via Word COM.

1. **Architecture divergence note → Ch5 §5.12/§5.13.** State plainly that the design
   architecture (Figure 4 / Appendix D) specifies Node.js + Express + Prisma + JWT +
   React/TypeScript + Chart.js + Gmail API, while CAP-IT1 is implemented as a Flask +
   SQLAlchemy + session-auth + React/JSX + Recharts prototype on MySQL 8, and that migration
   to the diagrammed stack is deferred. Matching elements: MySQL 8, Tailwind, Google Calendar
   API, GitHub.
2. **BPMN open-conflicts note → Ch4 §4.2.5 or a new §4.5.** Two items, both unresolved by
   decision:
   - BPMN4 has the AC *"Review Canvas courses"*; no Canvas integration exists or is planned.
   - BPMN2 assigns the **Research Coordinator** the cohort subject list and course-offering
     proposal; the implementation gives offerings to the **Academic Coordinator**, per the
     July 21 client consultation. The app's RC only sees Research Gate + Graduation.
3. **Fold the new analytics into Ch5 §5.11 (Report Specifications).** Add the 7 analytics
   reports to Table 24 and describe the Module KPI card. Report count goes 10 → 17.
4. **Update Ch6.** Test count 61 → 66, passed 60 → 65. Re-run the suite and use the real
   numbers. **Remove limitation §6.6 item 5** ("KPI formulas are not yet computed") — that is
   now false; the Module 4/5/7 KPIs are computed live. Keep DEF-001 unless it gets fixed.
5. **Regenerate Appendix V** (test case matrix) from the new run, and add screenshots of the
   analytics tabs to Appendix U.
6. Also refresh `Documents/CAPSTONE_ONLY/USLS GS Portal Demo Walkthrough.docx` with an
   analytics scenario.

---

## 5. Optional cleanups spotted along the way

- **DEF-001** — demo-reset baseline leaves 3 subjects in `Current` instead of 1. Fix the
  seeding routine, not the withdrawal workflow.
- **Login default faculty email** — `frontend/src/pages/Login.jsx` prefills
  `liwayway.bautista@usls.edu.ph`, but seeded faculty are `@gs.local`, so faculty
  quick-login fails. Same for `registrar@usls.edu.ph` in the walkthrough doc.
- **SQLAlchemy `Query.get()` deprecation warnings** — many call sites; noisy but harmless.

---

## 6. Suggested order

1. G1 Student Handoff (largest, most visible in a walkthrough)
2. G5 Coursework → Dean (small, reuses the approvals queue)
3. G2–G4 Enrollment (largest surface area after G1)
4. Document updates last, so the written record reflects the finished build

Re-run the full suite after each item. Rebuild the frontend (`npm run build:web`) and
restart the server after frontend edits — and note that `preview_stop` does not always kill
the child python process; check port 5050 with `netstat -ano | grep :5050`.
