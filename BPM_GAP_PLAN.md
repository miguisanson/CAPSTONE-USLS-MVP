# BPMN + Demo Flow — Gap Analysis & Implementation Plan

> **Living document.** This is the single reference for closing the gap between the
> target BPMN (`BPM ACCURATE.docx`), the demo script (`PROJECT DEMO FLOW.docx`), and
> the current app. Update the **Status** boxes and **Progress log** as work lands.
> Last updated: 2026-07-14.

---

## 0. How to use this doc
- Each phase has checkboxes. `[ ]` = not started, `[~]` = in progress, `[x]` = done & verified.
- "Verified" means observable evidence (a test passing, a real login+click, a file changed as intended) — not "should work."
- Restore point before this work: git tag `pre-bpm-gap-plan` (rollback: `git reset --hard pre-bpm-gap-plan`).
- Session model for architect/QA work: **Opus 4.8 / High reasoning** (strongest seat). Executors (if orchestrating) = sonnet for screens, haiku for mechanical.

---

## 1. Scope decisions (boundaries of the system)

These define what we deliberately do **not** build. Confirmed with product owner 2026-07-14.

| Boundary | Decision |
|---|---|
| **Admission / AIMS (BPMN flow 1 student + registrar steps)** | **OUT of scope.** Not our jurisdiction. Entry into the system = the Registrar (external, not an in-system actor) sends an Excel roster; **GS Staff imports it** via `1 · Student Handoff`. The import IS the admission boundary. No student admission page, no registrar verification/clarification loop. |
| **Graduation exit → Registrar (BPMN flow 12 tail)** | Graduation ends at a **Dean-approved export** handed off to the Registrar externally. Once exported, the student is **off the system / off our hands.** No in-system "Registrar receipt" screen required — the export is the terminal step. |
| **Registrar as an actor** | **REMOVED ENTIRELY (decision 2026-07-14).** The Registrar is an external person and must not appear in the app at all — no login, no nav, no screens, no seed. Inbound = the Excel roster (simulated by GS Staff import). Outbound = graduation export (terminal). See Phase 4 for the removal + ripple list. |
| **Research-side actors (Panel Chair, Panel Members, Advisor, Associate Dean)** | **IN scope — build real accounts + screens** (decision 2026-07-14). Internal Graduate School actors. Associate Dean = real login that co-signs the advisor appointment (Form 3.1). |
| **Editor** | **COLLAPSED (decision 2026-07-14).** No editor login. External, like the Registrar. Stays as today: the student uploads **Form 9 (Editor Certification)** as completion evidence. |

---

## 2. Actor model

**Existing roles:** `staff`, `academic_coordinator`, `research_coordinator`, ~~`registrar`~~ (to be removed), `dean`, `student`, `faculty`.

**To add — Phase 1:** `panel_chair`, `panel_member` (×2 accounts), `advisor`, `associate_dean`. **No `editor`** (collapsed to student Form 9 upload — see §1).

Demo accounts to seed (password `DemoPass123!`):
`panelchair@gs.local`, `panelmember1@gs.local`, `panelmember2@gs.local`, `advisor@gs.local`, `associatedean@gs.local`.

> Note: The primary student demo login `andrea.mae.villanueva@student.usls.edu.ph` is **generated automatically** by importing the Student A sheet (`default_student_email("ANDREA MAE","VILLANUEVA")` → that exact address). It works **after** the handoff import, by design. `student@gs.local` is a separate pre-seeded convenience login bound to Miguel Yu.

---

## 3. Verified gap analysis

Legend: ✅ works today · ⚠️ exists but wrong owner/role · ❌ missing · 🚫 out of scope (§1)

### BPMN flows (13) / Demo sequences (14)
| # | Flow | State | Notes |
|---|---|---|---|
| 1 | Admission | 🚫 | Student/Registrar steps out of scope. Entry = GS Staff Excel import (✅ implemented). |
| 2 | Enrollment | ✅ | Data comes from monitoring-sheet import + Curriculum Planning. |
| 3 | Course Adjustments | ⚠️ | Screen exists but only **staff** can open it; BPMN owner = Academic Coordinator. |
| 4 | Coursework / Course Audit | ✅ | Tested. |
| 5 | Title Defense / Research Gate | ⚠️/❌ | Form 1 endorse ✅ (AC). Panel Chair/Member actions ❌ (no accounts). |
| 6 | Panel Matching | ⚠️ | Research Coordinator can't open it (staff/AC only). |
| 7 | Defense Scheduling | ⚠️/❌ | Student-initiated scheduling ✅. Research-Coord ownership ⚠️. Advisor/Panel availability logins ❌. |
| 8 | Advisor Designation | ❌ | No page anywhere. Needs student Form 3 → RC forward → Dean/Assoc Dean/RC sign → Advisor. |
| 9 | Proposal Defense & Revisions | ❌ | Advisor/Panel Chair/Member actions absent (represented today as uploaded PDFs). |
| 10 | Final Defense / Completion | ❌ | Same actor gap + Editor (Form 9) ❌. |
| 11 | Practicum | ✅ | Tested. |
| 12 | Graduation Endorsement | ✅ (→ 🚫 tail) | Compile→AC→RC→Dean→export ✅. Registrar receipt = out of scope, export is terminal. |
| 13 | Withdrawal Exit | ✅ | Tested. |
| — | Leave of Absence / Readmission / AWOL | ✅ | Dean decision routing exists + tested. |

### What the demo doc flagged as missing but ACTUALLY EXISTS (no work needed)
- Dean LOA / Readmission / AWOL approval (DeanApprovals "LOA / Readmission / AWOL" tab).
- Dean course-offering-plan approval, practicum review, graduation, withdrawal.
- Student-side defense scheduling + research submission (Student Portal `schedule` / `research` views).

---

## 4. Screen-by-screen test matrix

| # | Screen | State | Key test case |
|---|---|---|---|
| 1 | Student Handoff (import) | ✅ | Import MAEDS xlsx → Andrea (2099001) created + `andrea.mae.villanueva@...` provisioned |
| 2 | Curriculum Planning | ✅ | Tag curriculum version, record rationale |
| 3 | Course Adjustments | ⚠️ | AC must be able to open + run planning decisions |
| 4 | Course Audit | ✅ | Bulk grades, incomplete→retake (tested) |
| 5 | Research Gate (Form 1) | ✅/❌ | AC endorses Form 1; panel actions need new accounts |
| 6 | Panel Matching | ⚠️ | Research Coord can open + nominate |
| 7 | Defense Scheduling | ⚠️/❌ | Research Coord owns; advisor/panel submit availability |
| 8 | Practicum | ✅ | Hours loop 120→200, additional-cert request (tested) |
| 9 | Graduation | ✅ | Compile→AC→RC→Dean return→approve→**export** (tested; export is terminal) |
| — | LOA/Readmission/AWOL/Withdrawal | ✅ | Dean decision routing (tested) |
| — | Advisor Designation | ❌ | New flow (Phase 3) |
| — | Panel Chair/Member/Editor/Assoc Dean actions | ❌ | New accounts+screens (Phase 1–2) |

Existing pytest suite (`tests/test_bpm_workflows.py`) covers: practicum, withdrawal, graduation, course-audit, LOA/readmission, AWOL, accounts, clarifications. **Missing:** title-defense end-to-end, panel-matching, defense-scheduling, advisor designation, editor cert.

---

## 5. Phased plan

> **Execution order (decided 2026-07-14 — "quick wins first"):**
> **(1) Registrar removal** → **(2) Phase 7 consistency edits** → **(3) Phase 1** accounts → **(4) Phase 2** actor screens *(parallel `sonnet` subagents)* → **(5) Phase 3** advisor designation → **(6) Phase 4** remaining ownership routing → **(7) Phase 5** tests → **(8) Phase 6** faculty grades. §8 auditability is cross-cutting throughout.

### Phase 0 — Demo consistency `[x]` DONE
- [x] Verify Andrea login is generated correctly by import (`andrea.mae.villanueva@student.usls.edu.ph`) — **confirmed via pure-function test, no code change needed**
- [x] Consolidate `Demo_Files`: canonical = `Student_A/`; removed byte-identical flat dups + `Student_A_Concept_Papers/` + `~$` Word lock; repointed in-repo `DEMO-SCRIPT.md` paths **and fixed its stale login (`2099001@` → `andrea.mae.villanueva@`) and stale folder path (`USLS_Documents/Simulation/` → `Demo_Files/Student_A/`)**
- [x] Re-ran suite: **18/18 green baseline** (`python -m unittest tests.test_bpm_workflows`)

### Phase 1 — New actor accounts + role plumbing `[ ]`
- [ ] Backend: seed 6 accounts; extend role enum, login handler, `WORKFLOW_ROLE_PERMISSIONS`
- [ ] Frontend: add to `Login.jsx` DEMO/HOME/mode buttons, route guards in `App.jsx`, landing pages
- [ ] Extend `test_demo_backoffice_accounts_sign_in_as_distinct_roles` for new roles

### Phase 2 — Actor screens `[ ]` (parallel `sonnet` subagent cards; I write backend + API contract first, then QA each new portal file)
> **All portals below must use the `RoleSidebar` left-nav shell (§9) — not stacked single pages.**
- [ ] Advisor: receive appointment; endorse proposal/revised/final manuscript; submit availability (flows 8,9,10,11)
- [ ] Panel Chair: receive docs, meeting link, schedule proposal/final, email defense report (7,10,11)
- [ ] Panel Member: deliberate, decide title, sign approval sheet, record Pass/With-Revisions (7,9,10,11)
- [ ] Associate Dean: co-sign advisor appointment (8)
- [ ] ~~Editor~~ — collapsed to student Form 9 upload (§1), no screen

### Phase 3 — Advisor Designation flow `[ ]`
- [ ] Student Form 3 submit → RC forward → Dean sign → Assoc Dean sign → RC sign → Advisor receives (Form 3.1)
- [ ] (Admission/AIMS + Registrar-verify screens intentionally NOT built — see §1)

### Phase 4 — Registrar removal + ownership/routing fixes `[~]` (Registrar removal DONE; ownership routing pending)
- [~] **Remove Registrar entirely (decision 2026-07-14).** Footprint: ~79 `app.py` refs, 11 frontend files, 19 test refs.
  - [x] **Backend done + verified (18/18 green):** dropped from `BACKOFFICE_ROLES`, `ROLE_TRANSACTION_ACCESS`, `ROLE_LABELS`, `WORKFLOW_RECIPIENTS`, `ensure_demo_accounts`. Withdrawal reroutes to Student→GS Staff→Dean→GS Staff (removed `record_fee_clearance`/`record_registrar_update`; `verify_requirements`→"Requirements Verified"; `confirm_withdrawal` finalizes). Graduation terminates at export (removed receipt task + "Registrar Received" action). Backflow maps cleaned. 3 tests updated.
  - [x] **Auth surfaces done + build passing:** removed from `Login.jsx`, `App.jsx`, `Layout.jsx` — no longer a login option or nav entry.
  - [x] **Display cleanup done + verified.** Cleaned `WorkflowPage.jsx` (dead action buttons, withdrawal stage list/board, recipient options, graduation registrar_status field, guide/help text), `WorkflowTimeline.jsx` (withdrawal 8-step + graduation 9-step timelines), `StudentPortal.jsx` (withdrawal StageCard 4/5, graduation StageCard 5 → "Endorsement Export"), `format.js`, `WorkQueue.jsx`/`Dashboard.jsx` (OWNERS), `StudentDetail.jsx`, `DeanApprovals.jsx` (export modal → "Confirm endorsement export"). **Audit: zero frontend refs to any removed status/action.** Frontend builds clean; backend suite 18/18 green. (Note: kept "Sent to Registrar" as the terminal export status label = external handoff destination.)
  - Original ripple detail (reference):
  - Backend: drop `registrar` from `ensure_demo_accounts`, role enum/validation, `WORKFLOW_ROLE_PERMISSIONS` (`{"graduation","withdrawal"}`)
  - Frontend: remove from `Login.jsx` (`DEMO`, `HOME`, `STAFF_ACCOUNTS`), `App.jsx` (`homeFor`, `BACKOFFICE_ROLES`), `Layout.jsx` (`ROLE_LABELS`, `ROLE_PATHS`), plus `WorkflowPage.jsx`/`DeanApprovals.jsx`/`StudentPortal.jsx`/`WorkflowTimeline.jsx`/`WorkQueue.jsx`/`Dashboard.jsx`/`StudentDetail.jsx`/`format.js` registrar refs
  - **Graduation**: terminate at Dean-approved **export** — drop `registrar_status`, "Sent to Registrar"/"Registrar Received" states, "Record receipt" task
  - **Withdrawal**: **drop the Registrar fee-clearance step entirely** (decision 2026-07-14) → flow = Student → GS Staff → Dean → GS Staff follow-through (BPMN 13). Remove `registrar_status`/"Registrar Review"/"Fee Confirmed" states + related tasks
  - Tests to update: `test_demo_backoffice_accounts_sign_in_as_distinct_roles` (drop registrar), `test_graduation_return_resubmit_approve_send_and_registrar_receipt` (retarget to export-terminal), `test_withdrawal_approval_sequence_and_denial_branch` (drop fee step), + any other registrar assertions
- [ ] Course Adjustments → add `academic_coordinator` to `ROLE_PATHS`
- [ ] Panel Matching + Defense Scheduling → add `research_coordinator`

### Phase 5 — Test coverage for the gaps `[ ]`
- [ ] title-defense E2E (5/7), panel-matching (6), defense-scheduling (7), advisor designation (8, incl. Assoc Dean co-sign), Form 9 student-upload path (11) → full 14-flow coverage

### Phase 6 — Faculty grade entry + deadline/escalation engine `[ ]` (NEW, product owner 2026-07-14)
Faculty need a screen to **enter grades** for the subjects/students they handle, with a deadline + late-submission escalation loop. Maps to BPMN 4 (Coursework).
- [ ] **Faculty grade-entry screen**: list the faculty's handled subjects + enrolled students; enter grade per student; add **remarks/notes** (feeds auditability §8)
- [ ] **Deadline model** per subject/term (e.g., deadline 2026-07-07)
- [ ] **Late detection**: after the deadline, unsubmitted grades are flagged "Late"; the system **notifies the teacher**
- [ ] **Escalation**: if N days pass (e.g., 5) with missing grades, the system **notifies the Academic Coordinator**
- [ ] Example acceptance: Subject A, 3 students, teacher "Emma", deadline 2026-07-07 → on 2026-07-08 unsubmitted shows Late + teacher notified → 5 days later AC notified
- [ ] *Design note:* needs a notification mechanism + a time/deadline check (scheduled job or on-load evaluation)

### Phase 7 — Screen consistency edits `[~]` (recon done 2026-07-14)
- [ ] **Defense Scheduling — unlock faculty choice** (design decided 2026-07-14: **reassign the official panel**). `DefenseSchedulingForm` uses `context.assigned_panel` = `active_panel_assignments(student, gate)`, and availability/slots come *only* from those faculty (`defense_participants`). Implementation:
  1. Backend: add `faculty_directory` (all active faculty + availability) to the defense-scheduling context; make `handle_defense_scheduling` accept a selected faculty set and **reassign the gate's panel assignments** to it (reuse panel-matching finalize logic), then compute availability/conflicts from the new panel.
  2. Frontend: faculty picker in `DefenseSchedulingForm`, pre-selected with the matched panel (recommendation = default), add/remove from full list before computing slots.
  *(Panel Matching screen 6 already allows full-list search; this makes screen 7 consistent.)*
- [ ] **Curriculum Planning — assign faculty**: **NET-NEW** — `CurriculumPlanning.jsx` currently has no faculty assignment at all (courses only). Add faculty assignment per course/offering with an **availability-based recommendation** (recommend, don't lock). Backend + frontend.
- [ ] **Remove manual "Eligibility review" cards → automatic (rule-based now, RAG later — decided 2026-07-14)**: replace manual eligibility-review cards with the app's **existing automatic eligibility computation** (same rules graduation/practicum already use), so the manual cards disappear with **no Gemini dependency**. Swap in true RAG reasoning later when Gemini is production-wired. RAG path stays: `_load_rag_chat_engine` needs `GOOGLE_API_KEY`.

**Phase 7 build order (decided 2026-07-14):** (1) Defense Scheduling unlock → (2) Curriculum Planning faculty assignment → (3) rule-based auto-eligibility.

## 8. Cross-cutting: Auditability `[ ]` (NEW, product owner 2026-07-14)
Every decision/action across workflows should **record the reason and notes** of the actor, so the trail is explainable. Applies to approvals, endorsements, eligibility calls, grade remarks, schedule overrides, etc. Verify each new screen writes reason/notes into the activity/transaction log and surfaces them for review.

## 9. Cross-cutting: Consistent left-nav shell `[ ]` (NEW, product owner 2026-07-14)
**Every account/role must have the same left-sidebar navigation shell**, with role-appropriate screens behind it — no role should be a single long stacked page.
- Pattern already exists: backoffice roles use `Layout.jsx`; **Student and Dean already use the reusable `RoleSidebar` component** (`STUDENT_NAV` / `DEAN_NAV`).
- [x] **Faculty navbar DONE + verified (2026-07-14).** `FacultyPortal.jsx` now uses `RoleSidebar` (`FACULTY_NAV`: Overview, Class Grades, Advisees & Research, Panel Assignments, My Availability) with an Overview dashboard (hero + clickable stat cards). Verified live via Vite dev server: desktop left sidebar + mobile nav both present, view switching works, no console errors, build clean. *(Deeper grade-entry polish still lands in Phase 6.)*
- [ ] **All new Phase 1–2 actor portals** (Advisor, Panel Chair, Panel Member, Associate Dean) **must use `RoleSidebar` from day one** — do not build stacked single-page portals.
- Acceptance: log in as each role → a consistent left sidebar is present with that role's screens; no role renders as one long scroll.

---

## 6. Later track (separate — depends on Phases 1–3)
- Complete Student + Faculty database from `Documents/USLS_Documents/` (`AC-STUDENT-MONITORING-_Template_.xlsx`, `Student-Research-Monitoring.xlsx`, GS Handbook, Research Protocol). Full cohorts, not samples — live-deployment-ready (complete, not necessarily real).
- Thesis/manuscript PDFs (public-source) attached per student as realistic research evidence.

---

## 7. Progress log
- **2026-07-14** — Plan created. Verified gap analysis against code. Scope decision locked: admission-in = Excel import, graduation-out = export, Registrar external. Confirmed Andrea login auto-generates from import. Restore point `pre-bpm-gap-plan` tagged.
- **2026-07-14** — **Phase 0 complete.** Consolidated Demo_Files to canonical `Student_A/`; deleted byte-identical flat dups + `Student_A_Concept_Papers/` + `~$` lock; fixed in-repo `DEMO-SCRIPT.md` (paths, stale login, stale folder path). Baseline suite 18/18 green.
- **2026-07-14** — **Plan revision.** Registrar → **full removal**. Added Phase 6 (faculty grade entry + deadline/escalation engine), Phase 7 (screen-consistency edits), §8 Auditability.
- **2026-07-14** — **Decisions locked.** Editor **collapsed** (student Form 9 upload, no login); Associate Dean **kept real** (co-sign login). Execution order = **quick wins first**: Registrar removal → Phase 7 → Phase 1 → Phase 2 *(parallel subagents)* → 3 → 4 → 5 → 6.
- **2026-07-14** — Added **§9 Consistent left-nav shell** requirement: every role gets the `RoleSidebar` shell. New Phase 2 actor portals must adopt it too.
- **2026-07-14** — **Faculty navbar DONE + verified** (§9). FacultyPortal → RoleSidebar with 5 views + Overview dashboard. Verified live (desktop sidebar + mobile nav present, view switching works, no console errors).
- **2026-07-14** — **Phase 7 started: recon + decisions locked.** Item 3 = rule-based auto-eligibility now, RAG later (no Gemini dependency). Build order: Defense Scheduling unlock → Curriculum Planning faculty assignment → auto-eligibility. Defense Scheduling design = **reassign the official panel**. **Next: implement Defense Scheduling faculty unlock** (backend faculty_directory + panel reassignment in `handle_defense_scheduling`; frontend picker in `DefenseSchedulingForm`).
- **2026-07-14** — **Registrar removal COMPLETE + verified.** Backend (roles/permissions/seed, withdrawal drop-fee reroute, graduation export-terminal) + auth (Login/App/Layout) + full display cleanup (8 frontend files: timelines, stage cards, boards, action buttons, labels). Backend suite **18/18 green**; frontend **builds clean**; audit shows **zero refs to removed statuses/actions**. Withdrawal is now Student→GS Staff→Dean→GS Staff; graduation ends at export. **Next: Phase 7 (screen consistency edits).**
