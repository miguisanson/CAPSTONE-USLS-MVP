# Audit: academic-side workflows (2026-10-01)

Scope: student handoff / monitoring import, enrollment and class lists, course adjustments and offerings, drop, subject withdrawal, Leave of Absence (LOA), Readmission, AWOL, residency, and the student status model that ties them together. Branch `v5.1-migui_clean`, read-only audit.

How it was checked
- **VERIFIED** = reproduced with the Flask test client on a temp SQLite DB (probe scripts in `E:/Temp/claude/audit/`: `loa_probe.py`, `probe2.py`, `probe3.py`, `probe4.py`) or unambiguous in the cited code.
- **SUSPECTED** = read from code, not reproduced.
- File:line references are to `E:/Github_Projects/CAPSTONE-USLS-MVP/app.py` unless a frontend path is given (`frontend/src/...`).
- Handbook rule *values* (windows, limits, fees) are out of scope (another helper). Handbook *flow* differences are listed in section 7.

## 1. How the processes are actually built (the root cause of most LOA/Readmission trouble)

| Process | Case record | Status lives in | Who moves it |
|---|---|---|---|
| Graduation | `GraduationEndorsement` table, one row per case | `endorsement_status` (explicit state machine, each action checks the current status and the role) | staff / AC / research / dean, single and batch |
| Subject withdrawal | `WithdrawalApplication` table | `status` + `dean_decision` | student -> staff -> dean -> staff (tag, export) |
| AWOL / return | `AwolCase` table | `status` + `dean_decision` | system detects -> student -> staff -> dean |
| **LOA** | **none** | the newest `TransactionLog` row for (student, "leave-of-absence") | student -> staff -> dean |
| **Readmission** | **none** | same, newest `TransactionLog` row | same |

LOA and Readmission are a chain of log rows. Period, reason, target semester, checklist and eligibility are free text inside `TransactionLog.notes`, re-read later with a regex (`request_notes_value`, 16031). The "request" is the latest student-authored log row (`workflow_case_record`, 14082). No table holds the LOA start/end, so nothing can expire, schedule, warn or be reported on. Nearly every finding under LR below follows from this.

Student status is three loosely coupled fields: `standing` (Active / On Leave / AWOL / Withdrawn), `current_stage` (lifecycle list that also contains LOA, AWOL, Withdrawn) and `enrollment_tag` (Enrolled / Not Enrolled / LOA / AWOL / Residency / Completed / Withdrawn). Each process writes a different subset of them (table in section 5).

## 2. Findings table

Severity: C critical (blocks a core flow or corrupts state), H high, M medium, L low.

### 2a. Leave of Absence and Readmission (LR)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| LR-01 | C | LOA, Readmission | After a LOA is approved the student can never file another LOA, extension or renewal. The "already in progress" test treats `new_status == "Approved"` as open forever (`{"Submitted","Dean Review","Approved"}`). It stays blocked even after a successful readmission. Readmission has the same lock: one approved readmission blocks all later ones. Handbook says a LOA is renewable once and a student can leave twice. | 7550, 7639. Probe: On Leave student -> extension request 409; after readmission approved -> new LOA 409 "already in progress", second readmission 409. | Stop inferring "open" from the log. Case table with explicit `Closed/Ended`; "open" = Submitted / Staff Review / Dean Review / Returned only. Add an extension request type linked to the approved LOA. | VERIFIED |
| LR-02 | C | LOA, Readmission | A single staff or student message (note) on a pending request leaves it unmovable. Staff cannot forward (`pending_student_request_log` needs the newest log to be the student's submission), the student cannot withdraw (newest log result is no longer "submitted"), yet the staff board still shows "Pending Review" with a Forward button that errors. Cause: message logs copy `workflow_record_status()` (= the old result text "LOA application submitted") into `new_status`, and the board re-derives status from text. | 17614-17623, 7586-7588, 14109-14114, 14453-14516, 16075-16096. Probe S6: note -> forward 400 "The student must submit a new request before staff can forward it", withdraw 409, board shows ("Pending Review","Student"). | Case status lives on the case row; messages never change it. Forward checks case status, not "latest log is a student log". | VERIFIED |
| LR-03 | C | LOA, Readmission | Staff "Message / Return" to the student sets status "Returned for Clarification", but the student LOA form only reopens for `Not Submitted / Denied / Returned / Returned for Revision / Withdrawn`. The student cannot resubmit from the UI. The API accepts a resubmission, but it never closes the open return message or the student's "Respond to ... clarification" task (`resolve_student_returns` is called for practicum, withdrawal and graduation only). The Readmission form has no status logic at all. | StudentPortal.jsx:1254; 14385-14388; 7824, 7929, 8296 (only callers of `resolve_student_returns`); probe S7: 1 return message still Open and 3 open tasks after resubmission. | One returned state name; student form editable in it; resubmission closes the return message and task (same as withdrawal/graduation). | VERIFIED |
| LR-04 | H | LOA, Readmission | Staff board has no column for "Dean Review" or "Withdrawn". Columns are For Review / Approved / Returned for Revision / Denied, but `submitted_request_students` returns `Dean Review` and `Withdrawn`. After "Forward to Dean" the card disappears from the board (visible only in Table view). Walkthrough Case 8 step 13 says it "leaves the staff-review column" but nothing says where it goes. | WorkflowPage.jsx:117-122, 486, 3793; 16076-16096. | Generate columns from one shared status list. | VERIFIED |
| LR-05 | H | LOA | Dean approval applies On Leave / stage LOA / tag LOA immediately, even when the leave starts in a future semester (probe: requested 2027-2028 1st sem, applied 2026-10-01, student On Leave today). Currently enrolled subjects are not touched (still "Enrolled"), no TermEnrollment "LOA" row is written, nothing is recorded per leave term. Handbook: courses become W when leave starts mid-semester. | 11062-11068; probe S2. | Approved -> "Leave Scheduled"; On Leave begins at the start term; on start close active subject enrollments as Withdrawn (W), write per-term LOA rows. | VERIFIED |
| LR-06 | H | LOA | The LOA end date is never stored or enforced. Nothing expires a leave, warns staff, or flags a student who does not come back. `automatic_awol_evidence` returns None for On Leave students, so an overstayed LOA is invisible. Demand/planning also cannot see returning students. | 4315-4316; no structured period anywhere; 21657. | Store start/end term ids on the case; "Return due" queue; overdue -> staff-confirmed AWOL proposal. | VERIFIED |
| LR-07 | H | Readmission, AWOL | Readmission has no precondition. The only check is a UI lock (StudentPortal.jsx:150). The API accepts a request from an Active student with no LOA (probe S11) and from an AWOL student (S10). Approving it sets Active / Coursework / Not Enrolled, bypasses the AWOL return process (residence limits, refresher, re-enrollment) and leaves the `AwolCase` at "AWOL Declared" with the alert flag open. Student-side LOA route also has no standing check (AWOL or Completed students can file). | 7609-7663 (no standing test), 11079-11084; probe S10, S11. | Readmission only from On Leave (or expired LOA), linked to the LOA case; AWOL students use the AWOL return path only. | VERIFIED |
| LR-08 | M | Readmission | Approval sets `current_stage = "Coursework"` unconditionally and no prior stage is saved. Probe: Final Defense student comes back as Coursework. Students past the comprehensive exam heal on the next research sync (21079) which is itself a GET side effect; students before it lose their stage. | 11081; 21073-21080; probe S4. | Save `prior_stage`/`prior_enrollment_tag` at leave start; restore them on readmission. | VERIFIED |
| LR-09 | M | Readmission | Student types "previous LOA start/end" freely; it is not checked against the approved LOA. Target return only has to be a future semester and LOA end >= LOA start; it may be before or inside the leave. Duplicate submissions allowed (probe S4b 200 twice). | 7615-7640. | Prefill from the linked LOA case; require target return term > leave end. | VERIFIED |
| LR-10 | M | LOA, Readmission | Double submission is not blocked before staff forward: the student submit log has no `new_status`, so the duplicate test (new_status in Submitted/Dean Review/Approved) never matches. Probe: two 200s, two logs, two staff tasks. | 7550, 7563-7571, 7652-7661; probe S1. | Case row with unique open case per student per kind. | VERIFIED |
| LR-11 | M | LOA | The forwarded log (what the Dean reads) is built from the staff form's `effective_start/end` and `reason`, not from the student's stored submission. Only non-empty is checked, not that they are real terms, 1-2 semesters, or unchanged. The Registrar report reads the student's submission notes instead, so Dean and Registrar documents can disagree. `eligibility_status` (even "Not Eligible") is only stored as note text. | 17657-17699; 8146-8149. | Forward from the stored case; staff cannot edit period fields. | VERIFIED |
| LR-12 | M | LOA, Readmission, Dean | Structured values are stored as note text and regex-parsed: `Reason/remarks` is cut at the first newline and trailing periods are stripped; text in a reason can impersonate another field. Affects staff view, Dean card, Registrar CSV. | 16031-16033, 7553-7560, 16114-16135. | Columns, not notes. | VERIFIED (code) |
| LR-13 | M | Readmission | Staff checklist defaults to all items ticked (`useState(requirements)`), and the student's actual ticks are not stored (only a count: "Checklist submitted: N item(s)"). The verification step fails open. | WorkflowPage.jsx:5714, 5732; 7644. | Store the student's ticks per item; staff starts from those. | VERIFIED (code) |
| LR-14 | M | LOA, Readmission | No student notice when staff forward to the Dean (`add_student_transition_notice` only covers practicum, withdrawal, graduation). Dean decision does notify. LOA "Denied" sets next owner "Graduate School Staff" but creates no task; student is not told how to appeal/resubmit. | 14285-14292; 11069-11070, 11085-11086. | Notice on every transition; task for staff on deny. | VERIFIED (code) |
| LR-15 | M | LOA, Readmission | Student LOA screen reads its state from `data.logs`, which is the newest 18 visible logs across all workflows. After 18 newer entries the LOA log scrolls out and the form shows "Not Submitted" again. Readmission tab shows no status, timeline, withdraw or decision at all. LOA timeline has no Denied/Returned state and "Approved" shows step 4 as "current", never complete. Dean card has no timeline for standing changes (`standingChange ? null`). | 7045-7056; StudentPortal.jsx:1231, 1252; 1340-1401; WorkflowTimeline.jsx:31-42; DeanApprovals.jsx:1080-1093. | Per-case fetch; shared case card/timeline component. | VERIFIED (code) |
| LR-16 | M | LOA, Readmission | Registrar report picks the newest "approved" log for the student even if a later request was denied/returned, is per student CSV only, and there is no "Exported / Sent to Registrar / Acknowledged" state. Graduation and Withdrawal both have list export and sent/acknowledged states. | 8096-8104, 8123-8136. | Case-based export, batch list, handoff states. | VERIFIED (code) |
| LR-17 | M | LOA | "Future effective date" check (policy review) compares the start term with `date.today()` at review time, so a correct request reviewed late flips to "Fail / Not Eligible". Same test on submit compares with today, not with the submission date. | 4062-4067, 7542. | Evaluate against `submitted_at`. | VERIFIED (code) |
| LR-18 | L | Reports | "LOA / readmission activity" report lists only students currently On Leave, with their latest readmission log. Pending, denied, returned, withdrawn LOA requests and readmissions by Active students never appear. | 15968-15984. | Report from the case table. | VERIFIED (code) |
| LR-19 | L | LOA | Work Queue tasks for these flows are not linked to the LOA/Readmission page (`task_dict` only links AWOL and INC). Student submit adds a fresh task each time (no `ensure_task`), so duplicates accumulate. | 2572-2593; 7562, 7652; probe S1 (2 tasks), S7 (2 staff tasks). | `ensure_task` + action_url. | VERIFIED |

### 2b. AWOL and residency (AW)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| AW-01 | H | AWOL return | Dead end and duplicate case. When the Dean approves a return that requires full re-enrollment, status becomes "Re-enrollment Required" but the student stays AWOL and no action anywhere moves them out (`handle_awol` has only forward / record_residency / end_residency). The next automatic sync (any student-portal or AWOL GET) sees tag AWOL and creates a second `AwolCase` "AWOL Declared". Probe: case 1 "Re-enrollment Required", case 2 "AWOL Declared" appear after one sync, flag still open. | 11117-11121; 4354-4366; probe3. | Add a "complete re-enrollment" action that clears AWOL and closes the case; do not open a new case while a case is in an approved-but-unfinished status. | VERIFIED |
| AW-02 | M | AWOL return | Staff can forward a case to the Dean straight from "Returned for Revision" without the student revising it (accepted states include Returned for Revision). Student can also resubmit while status is "Return Submitted" (staff mid-review), adding another task and log. | 18447; 7688. | Forward only from "Return Submitted"; lock the form while staff review. | VERIFIED (code) |
| AW-03 | M | AWOL / all | `sync_automatic_awol_statuses(commit=True)` runs inside GET handlers (student portal context, monitoring grid, AWOL transaction context) and sweeps every student on each call. Reads change data, create tasks and messages, and a student GET can create cases for other students. | 7015, 11654, 16271. | Scheduled/explicit job; GET stays read-only. | VERIFIED (code) |
| AW-04 | M | Status model | Residency years are computed four different ways: `residence_limits` uses calendar `today.year - entry_year` (used by AWOL review, watchlist, completion report); `loa_policy_review` uses `(today.year - entry_year) * 3` "terms"; the student's course year uses academic-year start (`student_current_course_year`); import writes `year_level` from academic year. Probe: entry 2020, today 2026-10-01 -> 6 years vs course year 7. The count flips on 1 January instead of at the academic-year boundary. (Whether LOA counts toward residence is the other helper's rule.) | 4446, 4027, 16819-16823, 17207. | One helper `years_in_program(student, as_of)` on academic years. | VERIFIED |
| AW-05 | M | Status model | A student readmitted while their newest TermEnrollment row is "Withdrawn" is flagged AWOL again on the next sync. Probe: standing/tag/stage become AWOL. Only producible today from seed/imported rows because the remove route is disabled, so latent. | 4323-4338; probe2 PF. | Ignore term rows older than the approval; or write a "Returned" term row on readmission. | VERIFIED (latent) |
| AW-06 | L | Residency | Residency never expires or renews; `end_residency` sets tag "Enrolled" even when the student has no subjects. Record-residency has no term sanity check (any term). | 18519-18533, 18483. | Close at term end; set "Not Enrolled". | VERIFIED (code) |
| AW-07 | L | AWOL, residency | Every GET of the AWOL / residency Registrar report writes a new log row (not idempotent). | 8169-8180, 8213-8219. | Log once. | VERIFIED (code) |

### 2c. Enrollment, class list, drop, subject withdrawal (EN)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| EN-01 | H | Enrollment | Student self-enrollment has none of the staff-side guards. (a) An AWOL student enrolls successfully (200, subject added) while the same request from the Academic Coordinator is blocked 409. LOA / Withdrawn students are equally unblocked; the route only skips updating the tag. (b) A subject the AC recorded "Dropped" (or approved "Withdrawn") in the same term is silently set back to "Enrolled". (c) The same subject can be Enrolled in two semesters at once. (d) Any term id is accepted (past terms). | 7422-7517 (only curriculum, offering and "Completed" checks); 3058-3074 (staff block); probes S9, PA, PB. | Reuse `enrollment_preview_payload` conflicts inside the student route; one `enrollment_block_reason(student)` for all paths. | VERIFIED |
| EN-02 | H | Class list import | The import reads only Student ID, Subject Code, Faculty. The shipped template has "Enrollment Status" (Enrolled/Dropped) and "Status Effective Date"; a "Dropped" row is imported as **Enrolled** (probe4). The file's Academic Year / Term columns are ignored, so a 2019-2020 list imports silently into the selected semester. On Leave / AWOL students show "Ready" in the preview and are enrolled. It does not set `enrollment_tag` (a "Not Enrolled" readmitted student stays "Not Enrolled" while enrolled), does not recompute risk, overwrites an existing Dropped/Withdrawn row back to Enrolled, and rewrites `CurriculumOffering.assigned_faculty_id`, bypassing the Dean-approved plan and the 24-unit load cap. The shipped template's Faculty value "To be confirmed" is rejected by the faculty lookup, so its rows cannot import as they are. | 10246-10248, 10304-10312, 10413-10442, 10422-10424; 10294-10295; template `Documents/Stakeholder_Meeting_Prep/Enrollment_Class_List_Template.csv`; probe4, probe2 PC. | Honour status and effective-date columns, verify file term = selected term, standing block, set tag/stage, stop mutating offering faculty from an import (propose, don't apply). | VERIFIED |
| EN-03 | M | Drop | The drop route (AC only) accepts any effective date (probe: 1999-01-01 returned 200), has no relation to the semester, and creates no task or notice for staff. Dropping the last subject sets the TermEnrollment to "Confirmed" and tag "Not Enrolled"; "Not Enrolled" students are excluded from demand (EN-07). A pending withdrawal for the same subject is not closed: the Dean's approve then fails with 409 "already Dropped" and only Deny is possible. | 10112-10117, 10163-10173, 11004-11005; probe PA. | Validate date within the term; close/redirect a pending withdrawal when a drop is recorded. | VERIFIED |
| EN-04 | M | Subject withdrawal | `apply_penalty_free_subject_withdrawal` sets `standing = "Active"` unconditionally. For a student On Leave with an open subject this leaves standing Active, stage LOA, tag LOA (probe PD). It should only touch subject rows and the term row. | 13555; probe2 PD. | Remove the standing write (walkthrough says standing is unchanged). | VERIFIED |
| EN-05 | M | Enrollment | Staff enrollment allows "Enroll with documented exception" for a subject not on the published offering list, while the walkthrough states the system "will only enroll a student into a published offering". Student and class-list paths do enforce the offering list. | 3101-3110, 9850-9853; walkthrough line 152. | Decide: keep the exception and fix the walkthrough, or remove it. | VERIFIED |
| EN-06 | M | Course planning | Demand and subject-needs reports count only `standing == Active AND enrollment_tag == Enrolled`. Readmitted students (tag "Not Enrolled"), students in residency, students who dropped everything, and LOA students whose leave ends before the target term are not counted, although they are exactly the ones who need next-term subjects. | 21657-21661, 21735-21741. | Count students expected to be active in the target term (needs LR-06 data). | VERIFIED (code) |
| EN-07 | L | Enrollment | No term sanity on enrollment save, class list import, drop or residency (past terms accepted); no academic-load check (handbook: 6-9 units part-time, 12 full-time; unit cap only 0-12 per subject at 9542). | 9797-9816, 10230, 9542. | Term window and load validation. | VERIFIED (code) |

### 2d. Course adjustments and offerings (CO)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| CO-01 | H | Offerings | Publishing an approved plan deletes every official offering that is not in the plan without checking enrolled students. Probe: PRB-502 removed from the list while the student stays Enrolled in it. The manual delete route does have that guard (10597-10608). | 10814-10821; probe2 PE. | Block or require confirmation when active enrollments exist. | VERIFIED |
| CO-02 | M | Course adjustments | The `draft` action has no status guard: it resets an Approved, Submitted or Published plan to Draft and wipes its offering rows (`approved_at` is kept). `reopen` works from any status, including Submitted while the Dean is deciding (plan disappears from the Dean queue silently). | 10672-10681, 10855-10861; probe2 PE2. | State machine: draft only from Draft/Returned; reopen from Approved/Published with a recorded reason. | VERIFIED |
| CO-03 | M | Course adjustments | After Dean approval the log says next owner "Graduate School Staff", but only an Academic Coordinator can publish (`@require_api_login("academic_coordinator")`). No task is created for the AC. Probe: zero AC tasks after approval. | 10923, 10637. | Next owner = Academic Coordinator plus a task. | VERIFIED |
| CO-04 | M | Offerings | Legacy routes `POST/DELETE /api/curriculum-planning/offerings`, `/generate`, `/subjects` (staff and AC) change the official offering list with no Dean plan and, for DELETE, no enrolled-student guard; `generate` auto-adds offerings labelled "RAG demand recommendation". The frontend no longer calls them (api.js 231-242), so they are callable but hidden. | 9471-9525, 9581-9652. | Remove or route through the plan. | VERIFIED (code) |
| CO-05 | L | Course adjustments | `reference_term` is the latest other term by start date, which can be a future term, not the previous term. Dean "return" does not require a note (workflow approvals do). | 10657-10660, 10924-10935. | Previous term by date; require note. | VERIFIED (code) |

### 2e. Student handoff and monitoring (HO)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| HO-01 | M | Import | The monitoring import cannot bring in any standing. The NOTE column is parsed but never used, there is no LOA/AWOL/withdrawn mapping, so the "imported AWOL standing" branch in automatic detection (4303) can only be true for seeded data. The handoff guidance says the import creates "their enrolled subjects"; it only writes Completed/Missing per subject and a "Confirmed" term row for new students, never `SubjectEnrollment`. | 16892, 16947, 17234-17246; WorkflowPage.jsx:5857. | Map NOTE/status columns (with provenance) and enrolled marks, or correct the text. | VERIFIED (code) |
| HO-02 | M | Import | Every imported or manually created student gets the same hard-coded password `DemoPass123!`, printed in the API response, with no forced change and no change-password route. The manual handoff route (`POST /api/transactions/student-handoff`) is still live although the UI is import-only. | 17349, 17402, 12506, 24055, 17518-17611. | Random one-time passwords / reset links; retire the manual route. | VERIFIED (code) |
| HO-03 | M | Monitoring | Conflict with the owner decision of 2026-10-01 (monitoring must be editable in the portal, with provenance). Today `/api/monitoring/subject-status`, `/api/monitoring/compre-exam`, `/api/course-audit/roster` (POST) and `/api/students/<id>/remove` all return 409 "read-only", dead legacy code sits below the `return`, and the test `test_monitoring_sheet_rejects_manual_status_updates` and walkthrough Case 4 encode read-only. | 11295-11320, 11606-11648, 11803-11850; AGENTS.md Rule 4; tests:1245. | Planned change; update tests and walkthrough with it. | VERIFIED |

### 2f. Status vocabulary and side effects (ST) and frontend/back-end mismatches (FE)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified |
|---|---|---|---|---|---|---|
| ST-01 | M | Status model | Three fields written inconsistently. See table in section 5. Examples: withdrawal writes standing only; drop writes tag only; residency writes standing + tag; LOA writes all three; AWOL deny writes all three. One function should compute a student's effective status. | see section 5 | Single `set_student_status(student, status, ...)` | VERIFIED (code) |
| ST-02 | M | Vocabulary | The same role has two labels: tasks for LOA / readmission / AWOL use "GS Staff", withdrawal and course adjustments use "Graduate School Staff". The Work Queue shows two separate chips and filters by exact match, so a staff member filtering by one label misses the other process. | 7562, 7652, 18465 vs 7930, 10936; WorkQueue.jsx:10. | One canonical owner label. | VERIFIED (code) |
| ST-03 | L | Vocabulary | Dead values: `standing` "Graduated"/"Completed" are tested in several places but never set outside seed; TermEnrollment statuses in use: Confirmed, Enrolled, Active, Withdrawn, Residency, Completed, and "LOA" only in seed. LOA approval never writes a term row. | 3058, 4315, 4347, 9682; 23768 (seed). | Define the enumerations once. | VERIFIED (code) |
| FE-01 | M | LOA, Readmission | Readmission lock lives only in the frontend (StudentPortal.jsx:150). The LOA form has no lock at all (an AWOL or Completed student can file). | see LR-07. | Server-side preconditions. | VERIFIED |
| FE-02 | L | AWOL | Student AWOL form is locked only for Dean Review / approved states (StudentPortal.jsx:1415), while the API also accepts "Return Submitted"; UI and API disagree on when a declaration may be edited. | 7688. | Align. | VERIFIED (code) |
| FE-03 | L | Graduation comparison | The "drag and drop" on the Graduation board is cosmetic: cards set `draggable` and `onDragStart`, but no element anywhere in the frontend has an `onDrop` for them (the only `onDrop` is the file drop zone in Student Handoff). Stage moves happen through buttons and the batch modal. | WorkflowPage.jsx:4150-4156, 3796, 762-767; DeanApprovals.jsx:615, 1212. | If real drag moves are wanted, add drop targets that call the same guarded transition endpoint. | VERIFIED |

## 3. Walkthrough (CAP-2521-IT-WALKTHROUGH.docx) versus code

| Ref | What the script says | What the code does |
|---|---|---|
| Line 152 | "the system will only enroll a student into a published offering" | Staff enrollment allows an exception override (EN-05). |
| Case 3 step 14 vs Case 6 step 5 | Step 14 says choose "Dropped or Withdrawn"; Case 6 says Dropped is the only option. | Code allows Dropped only (10089-10096). Fix step 14. |
| Case 3 step 8 | "Record or retain the source reference" for the class list. | Import has no reference field; only the file name is stored in `evidence_reference` (10434). |
| Case 3 step 5 | Class list rows with completed subjects etc. are "Needs review". | Dropped rows in the registrar template become Enrolled (EN-02). The shipped template's Faculty value "To be confirmed" is an error for every row. |
| Case 4 step 11 | "approved standing changes ... update this screen" and Monitoring is read-only. | Read-only is true today but contradicts the 2026-10-01 owner decision (HO-03). |
| Case 8 step 3 | Four stages "Student application, GS Staff review, Dean decision, result". | UI labels are "Request Submitted / GS Staff Intake and Eligibility Check / Dean Review / Student Standing Updated" (WorkflowTimeline.jsx:24-29). |
| Case 8 step 7 | Request "locked as submitted ... withdrawal available only before the Dean decides". | True until any message is sent on the case (LR-02). |
| Case 8 step 13 | Request "leaves the staff-review column and next owner becomes Dean". | It leaves and appears in no board column (LR-04). |
| Case 5 step 24 | Program standing "remains Active". | True for Active students; for an On Leave student standing is forced to Active (EN-04). |
| Case 9 / 20 | Approved return "Active / Not Enrolled"; course enrollment "a separate action". | True, but the AC enrollment block and demand report then ignore or mis-handle these students (EN-06) and the AWOL "Re-enrollment Required" outcome has no completion step (AW-01). |

Checked and consistent with the script: withdrawal window text, "Tagged withdrawn students" panel (WorkflowPage.jsx:4681), Dean approve/deny/return buttons for LOA and readmission, structured forms with no PDF, LOA report export for staff.

## 4. Student-status side effects (contradictions found)

| Situation | Contradiction | Finding |
|---|---|---|
| On Leave | still enrolled in current subjects; can self-enroll; class list import tags them; a subject withdrawal flips standing to Active | LR-05, EN-01, EN-02, EN-04 |
| AWOL | self-enroll succeeds; readmission can be approved for them; "Re-enrollment Required" leaves them AWOL forever with a second case | EN-01, LR-07, AW-01 |
| Readmitted | standing Active, tag "Not Enrolled" (excluded from demand); stage reset; AC task "Review readmitted student study plan" is the only way back in, but the class-list import leaves tag "Not Enrolled" | LR-08, EN-02, EN-06 |
| Dropped all subjects | TermEnrollment "Confirmed", tag "Not Enrolled"; student re-enrolls silently via the portal | EN-01, EN-03 |
| Residency | tag "Residency" never ends | AW-06 |
| AWOL detection vs approved LOA | Protected only while tag = LOA; after readmission with an old "Withdrawn" term row the student is AWOL again | AW-05 |

## 5. Which process writes which status field

| Process | standing | current_stage | enrollment_tag | TermEnrollment | SubjectEnrollment |
|---|---|---|---|---|---|
| LOA approved (11062) | On Leave | LOA | LOA | none | untouched |
| Readmission approved (11079) | Active | Coursework | Not Enrolled | none | none |
| AWOL return approved (11126/11134) | Active | Coursework | Not Enrolled | none | none |
| AWOL return, full re-enrollment (11117) | unchanged (AWOL) | unchanged | unchanged | none | none |
| AWOL return denied (11142) | AWOL | AWOL | AWOL | none | none |
| Automatic AWOL (4375) | AWOL | AWOL | AWOL | none | none |
| Residency recorded (18510) | Active | unchanged | Residency | Residency | none |
| Subject withdrawal tagged (13555) | **Active (always)** | unchanged | Not Enrolled (last subject) | Confirmed | Withdrawn |
| Drop (10172) | unchanged | unchanged | Not Enrolled (last subject) | Confirmed | Dropped |
| Student self-enroll (7499) | unchanged | Admission -> Coursework | Enrolled unless LOA/AWOL/Withdrawn/Completed | Enrolled | Enrolled |
| Class-list import (10436) | unchanged | unchanged | **unchanged** | Enrolled | Enrolled |

## 6. What Graduation has that LOA and Readmission lack, as a rebuild requirements list

Reference: `GraduationRoster` (WorkflowPage.jsx:4732), `graduation_batch_actions` (12636), `GraduationEndorsement`, `WorkflowTimeline.jsx`, Dean `DeanApprovals.jsx`.

### A. Case record and state machine
1. A real case table (for example `StandingChangeCase`), one row per request, with kind (LOA, LOA extension, Readmission), student, status, start term id, end term id, reason category, reason text, target return term id, linked LOA case id (for readmission), prior stage, prior enrollment tag, submitted/decided timestamps, staff eligibility result, Dean remarks. Replaces log-derived status and regex parsing of notes (Graduation: `GraduationEndorsement`).
2. Explicit statuses with a guarded transition table: Submitted -> Staff Review -> Dean Review -> Approved (Leave Scheduled) -> On Leave -> Return Due -> Closed; side branches Returned (clarification), Denied, Withdrawn by student, Revoked, Expired. Each action checks current status and role (Graduation checks `current_status` in every branch of `graduation_batch_actions`).
3. One shared status list (backend constant sent to the UI) used for board columns, filters, timeline and badges. Today board columns omit Dean Review and Withdrawn.
4. At most one open case per student per kind, enforced in the route and ideally in the DB. Messages and notes never change case status.
5. Every log, message, task and attachment carries the case id from the first row (today the first log gets `workflow_request_id = NULL` and a resubmission gets the previous request's id).

### B. Student-status side effects (the part Graduation does not need but LOA does)
6. Approval schedules the leave; "On Leave" starts at the start term. On start: close active subject enrollments as Withdrawn (W), write a per-term "LOA" TermEnrollment row for each covered term, block all enrollment paths through one shared check (student portal, class list, AC enrollment).
7. Save prior stage and tag when the leave starts; readmission restores them and sets "Not Enrolled" only for the target term.
8. Track the leave end: "Return due" list for staff, reminders to the student, an overdue state that proposes (staff-confirmed) AWOL, an extension request type limited by the handbook's renewal rule.
9. Readmission only from On Leave or expired LOA, linked to the LOA case, target term after the leave end; AWOL students use only the AWOL return process.
10. Demand/planning and monitoring read the same case table so returning students are counted for the target semester.

### C. Staff screen (match Graduation)
11. Kanban board built from the shared status list: Submitted, Staff Review, Returned to Student, Dean Review, Approved - Leave Scheduled, On Leave, Return Due, Readmission Requested, Closed/Denied, with counts, table/board toggle, filters (program, term, reason, status), and a "stage check" modal per case.
12. Batch handling like Graduation: select several cases, name the batch (for example "LOA Batch AY 2026-2027 1st Sem"), forward together, Dean batch approve/return, per-row skip reasons in the response.
13. Case modal with the structured summary, policy checker (keep it advisory), all earlier cases of the same student, message thread, file history, and required-comment dialogs for return and deny.
14. Unusual-case loops, each with a named status and an owner: student withdraws, staff returns for clarification, Dean returns, Dean denies then student may reapply with a stated wait or appeal, leave revoked before it starts, early return (readmission before leave end), extension, leave expires without return -> overdue -> AWOL proposal, duplicate attempt blocked with a helpful message.
15. Tasks: one per transition, created with `ensure_task` (no duplicates), closed on the next transition, canonical owner label ("Graduate School Staff"), and a link to the LOA/Readmission page.
16. Drag and drop: Graduation has none that works (cards are draggable but nothing accepts a drop). If the owner wants it, build real drop targets on board columns that call the same guarded transition endpoint and respect role and required comments; otherwise do not promise it.

### D. Exports and Registrar handoff (Graduation and Withdrawal already have this)
17. Case-based Registrar list (CSV/XLSX) for approved leaves and approved readmissions with handoff states Pending Handoff -> Exported -> Sent -> Acknowledged, an "email the file manually" follow-up dialog, and an idempotent export log. Include period, reason, Dean approval date and, for returns, target term and endorsement text (handbook: Dean endorses the written intention to the Registrar).
18. Reports and dashboards read from the case table, so pending, denied, returned and withdrawn requests also appear (today only currently-On-Leave students).

### E. Student experience
19. One student case card for LOA and for Readmission: status badge, who acts next, dates, timeline with current / complete / returned / denied states (student application -> staff review -> Dean decision -> on leave -> return -> active), decision comments from staff and Dean.
20. Editable and resubmittable whenever the case is Returned (any kind of return), with the resubmission closing the return notice and the student's task (as Graduation and Withdrawal do).
21. Withdraw while pending at any stage before the Dean decides, and cancel an approved but not yet started leave.
22. Readmission tab: shows the linked LOA (no free-text "previous LOA period"), the leave end and "you may file from ...", checklist ticks stored item by item, status and timeline, decision message.
23. Notices through the inbox for every transition (submitted, forwarded, returned, approved, denied, reminder) and a row for each request type in the "Workflow Status" panel (LOA and Readmission are missing there today).
24. My Courses shows a read-only "On Leave / AWOL" banner instead of live checkboxes.
25. Stage history fetched per case (not from the newest 18 mixed logs) and shown in the same "View stage history" component used elsewhere.

### F. Dean
26. Dean card with timeline, the student's earlier leaves and years in program, policy-check result, bulk approve/return, required comment on deny and return, and a visible follow-up owner after a denial.

## 7. Handbook flow differences relevant to these processes (values excluded)

- LOA is "renewable for at most another year": there is no extension/renewal path (LR-01).
- Handbook allows a LOA after withdrawing from a semester already in progress (courses become W, fee applies). The system only accepts a LOA starting in a future semester and never converts current subjects to W (7542, LR-05). The rule "no LOA within two weeks of the last day of classes" cannot even be evaluated.
- "A student returning from LOA or AWOL declares intention in writing to the Registrar through the Dean, who endorses it": the Dean endorsement output to the Registrar is a per-student provisional CSV without handoff tracking (LR-16).
- Residency is not for a student who still has units and does not intend to enroll (they must take LOA): enforced only as a "Needs Review" check that staff can override with notes (18481).
- Maximum residence "including LOA": residency is counted from entry year, so LOA time is counted, but the LOA snippet text in the policy corpus says the clock is paused (DEFENSE_REVISIONS C-table); fix together with AW-04.

## 8. Priority order for fixing

1. Decide and build the LOA/Readmission case table (LR-01 to LR-03, LR-10 follow from it), plus the shared enrollment block (EN-01, EN-02, EN-04).
2. AW-01 (AWOL dead end and duplicate case) and LR-07 (readmission preconditions).
3. CO-01 to CO-03 (offering list integrity, plan state machine, next owner).
4. LR-04 and LR-15 UI fixes (board columns, student status, timelines) if the full rebuild is not done first.
5. Everything else in M/L as time allows; HO-03 is an owner-scheduled change, not a defect.
