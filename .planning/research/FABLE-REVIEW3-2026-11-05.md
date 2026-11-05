# Fable review #3 — v6.4.1-test, 256eca36..eac3c50d, 2026-11-05

Read-only review of `git diff 256eca36..HEAD` (app.py, policy_rag.py, standalone_process.py, business_rules_catalog.py,
frontend/src, tests; Documents, PDFs, e2e excluded). The packet reports and ISSUES rows were treated as claims and re-read
against the code. Ran: `tests.test_reads_do_not_write`, `test_policy_assistant`, `test_rc5`, `test_round4_persona`,
`test_loa_readmission`, `test_research_core`, `test_business_rules` (result at the end); four probe scripts on temp seeds
(`E:/Temp/claude/fable3/{sync,rag,cancel,grad,stale}_probe.py`). Not run: the full suite, e2e, the autopilots.

## Verdict

1. No P1. Every new rule holds on its single and group paths (returnee forward needs both ticks in `_leave_h_forward`,
   `handle_awol` and both batch routes; closed-at-Sent is one function used by the queue, the aging tile and the home).
2. Two P2s, both data the screens now show wrong. I-373 stopped the page view from writing but nothing else writes for
   seeded students: 35 of 50 research cases keep a stored status ("Missing Requirements") that contradicts the live one the
   same page shows. I-374 moved the seeded past approvals to "Registrar Received", but they sit on four first-semester
   coursework students: the Dean's board and those students' homes now say the Registrar received their graduation.
3. The assistant ranking change is safe (18 questions probed, only the target one changed); one definition of active holds
   on every count except two old helper loops.

## Findings

| ID | Pri | file:line | Problem | Failure scenario | Fix | Effort | How |
|---|---|---|---|---|---|---|---|
| F7-01 | P2 | `app.py:37689-37698` (`sync_research_progress` returns before writing in a GET); `app.py:21763` + `cancel_defense_schedule` (no sync); shown by `frontend/src/pages/student/StudentOverview.jsx:167`, `student/Panels.jsx:50`, `StudentDetail.jsx:302`, `student_directory_brief` (plain list) | The seed never syncs the research rows (the first page view used to). After I-373 the stored `ResearchCase.status`/`current_gate` stay as seeded, and a POST that changes research state without a sync (defense cancel) leaves them wrong too. | Fresh seed (ran): 35 of 50 active research cases store "Missing Requirements" while the live progress says "Pending Staff Action" / "Awaiting Review". Elena Mendoza's own home shows the chip "Missing Requirements" next to a Research card that says "Awaiting Review"; the staff Student record does the same. Cancelling Nico Barrientos's Title Defense as the Research Coordinator: stored "Missing Requirements", picker "Ready", live "Pending Staff Action". | Two lines: at the end of `build_demo_database` call `sync_research_progress(student)` for every active research student (no request context, so it writes); add the same call to `cancel_defense_schedule` (and `defense_schedule_reconfirm`). Or stop showing the stored status on the three chips and show `research_progress.status`, which the same payload carries. | S | ran |
| F7-02 | P2 | `app.py:41885-41890` (`seed_report_history` pool = Active + Enrolled students with no records) → `:42003-42008` (graduation history now "Registrar Received" / "Acknowledged"); `graduation_candidate_payload` keeps any row with a `batch_name`; `StudentOverview.jsx:78` | The past-term graduation history lands on students who have not taken the Compre. Before I-374 they read "Dean Approved" (the export refused them); now they read finished and acknowledged. | Fresh seed (ran): Bianca Fernandez, Adrian Lacson, Lorenzo Gonzales, Gian Pang — stage Coursework, Compre "Not Taken", Enrolled — each carry a "Registrar Received" endorsement. The Dean's Graduation board shows 9 rows, 4 of them "Finished - the Registrar acknowledged the list" for ineligible students, and the open view keeps them. Bianca's home: "Graduation: Registrar Received". | Seed the graduation history on students whose `current_stage == "Completed"` (skip the process when the pool has none); do not touch the board. Alternative: `graduation_candidate_payload` drops a past-window endorsement whose student is not eligible, and the student home ignores it. | S | ran |
| F7-03 | P3 | `frontend/src/lib/studentHome.js:243-252` (`studentWaiting`: `dueAt: undefined` but `status: task.overdue ? "Overdue" : task.status`); `StudentOverview.jsx:40` renders the chip | I-385 hid the office's due date from the student but kept the "Overdue" chip that comes from that date. | The AWOL student's home: "The Graduate School is reviewing the alert — With the Graduate School Staff" with a red "Overdue" chip and no date; the student cannot tell what is overdue or for whom. | Drop `status` for waiting items (or map it to "In progress"). | XS | read |
| F7-04 | P3 | `app.py:13224-13238` (`_student_plain_policy`: regex only matches "Source: Graduate School Handbook … (p. N)") | The I-392 question itself now cites the Operations Manual, which the rewrite does not cover. | Student asks "what happens if I stop coming to class" (ran): the answer ends "Source: USLS Graduate School Operations Manual (Proposed › 4.6.6 Exceptions and unusual cases)" — the "Source:" line and the office word "Proposed" the fix meant to remove; the Handbook answer on the next question reads "Answer from the Graduate School Handbook, p. 54". | Generalise the regex to any title: `Source: (.+?) \((.+?)\)` → "Answer from the \1, \2", and strip a leading "Proposed › " / "Official › " from the section for students. | XS | ran |
| F7-05 | P3 | `frontend/src/pages/workflow/GraduationRoster.jsx:816-822`, `Practicum.jsx:271-277` (`ListExportButtons`) vs `components/ProcessBoardPage.jsx` (LOA, Readmission, AWOL, Withdrawal) and `ResearchGateOverview.jsx` (none) | IM24: I-240 added Export CSV + Print to two boards only. | Staff print the Practicum list for the Dean, then look for the same button on Withdrawal or Leave of Absence and find none. | Mount `ListExportButtons` in `ProcessBoardPage`'s filter row (student, program, kind, status, next owner, updated) and on the Research Gate board. | S | read |
| F7-06 | P3 | `app.py:6421` (stall warnings loop), `app.py:13093` (student loop) still `standing == "Active" and current_stage != "Completed"`; `active_student_clause()` at `:27333` also excludes stage Withdrawn | I-394 left two counts on the old definition. | A withdrawn student whose standing is still "Active" (stage Withdrawn) gets a stall warning and appears in that list while the dashboard, Reports and Students filter do not count the student. | Use `active_student_clause()` in both queries. | XS | read |
| F7-07 | P3 | `frontend/src/pages/Dashboard.jsx:109-123` (`actions.total = taskActions.total + researchReady.total`; "View all N" → `/work-queue`) | I-388 mixes Ready students into the task list but the "view all" target lists tasks only. | Research Coordinator with 2 Ready students and 6 tasks: the list shows 2 + 3 items and "View all 8" opens the Work Queue, which has 6. The "Your open tasks" tile says 6. | Count only tasks in the queue link; keep the "ready students" link when ready > 3. | XS | read |
| F7-08 | P3 | `frontend/src/pages/faculty/FacultyInvitationsPage.jsx:810` ("You can accept again later only if the invitation is sent again") vs `app.py:22549-22551` (accept has no status guard) | The promise is not enforced. | A panelist withdraws (status Declined, task "Replace declined panelist" raised, coordinators notified), then clicks Accept a minute later: status flips back to Accepted while the replacement task and notification stand. | Refuse accept when the row is Declined (409 "Ask the Research Coordinator to send the invitation again") or soften the sentence. | XS | read |
| F7-09 | P3 | `frontend/src/pages/leave/leaveHelpers.js:10` (`ENDED_STATUSES` lacks "Sent to Registrar", "Withdrawn Confirmed"); `GraduationRoster.jsx:473` (open view hides only "Not Eligible") | IM45 closes a case at Sent, but the boards' open view (`?show=open`, the home's link) still shows those cards, and `openCaseOfStudent` (`leaveHelpers.js:190`) can pick a sent withdrawal as the student's "open" case. | Staff click "3 open withdrawals" on the home: the board shows the "With the Registrar" column full of finished cards under the open filter. | Add the two statuses to `ENDED_STATUSES`; hide Sent/Received in the Graduation open view. | XS | read |

## Verified as fine

- **Returnee forward (I-379, IM45):** single path refuses without both ticks (`_leave_h_forward` `app.py:8115-8119`, `handle_awol`
  `:33765-33769`); group forward refused at `/api/leave-cases/batch` (`:21032-21034`) and the standalone batch route (`:21237-21238`);
  `batch` is false on the move itself (`:8061`, `:9801`) so the bar never offers it. The Dean's approve/return/deny dialogs are not
  blocked (`ActionDialog.jsx:60` builds `unverified` only for forward). The readmission and AWOL demo guides tick both boxes.
- **Closed at Sent:** `workflow_case_is_closed` (`:25656-25661`) is the one test for the queue (`:25688`), the Dean's decided list
  (`:26881`) and the aging tile (`:27792`); no acknowledgement task is created anywhere; board lock texts say "Finished".
- **"With the Registrar" columns:** withdrawal (`standalone_process.py:122-125`) and graduation (`GraduationRoster.jsx:168-176`)
  use the same words and the same two statuses.
- **I-383:** "Documents Under Review" is a real status (transitions `:24841-24860`, board column `Practicum.jsx:99`); the board lists
  every record; the seed guard skips a student who already has one.
- **I-387 / d5cf6cf7:** `readiness=live` only changes the label and the cost; the contextvar memo is set and reset per request;
  no row on the Research Gate board lacks a `ResearchCase` (probe: 0 of 50).
- **I-389:** `faculty_panel_load` is the one count for the directory, the profile modal and matching (exclude-self kept).
- **I-392 ranking:** 18 questions as a student with and without the "Purpose" demotion (ran): only "what happens if I stop coming
  to class" changes, and it now cites the rule section. `_ASKS_PURPOSE` keeps "What is the ethics review for?" and "What is the
  purpose of the comprehensive examination?" unchanged.
- **I-394:** dashboard (`:23323`), Reports, the Students "Active" filter (`:23235`) and the Research Gate board (`:37371`, `:37381`)
  share `active_student_clause()`.
- **Student pages (I-385/386/393):** the hidden rows are office facts only; the Dean's decision stays visible as the status chip
  and the return comment; the removed `forms=` line held form codes only (the download lives in the request form).
- **Timetable guard (F6-03):** teacher and section edits are now refused on a governed timetable in both routes (`:19099`, `:19122-19128`).

## Test run

`tests.test_reads_do_not_write test_policy_assistant test_rc5 test_round4_persona test_loa_readmission test_research_core
test_business_rules`: 255 tests, OK, 1046 s. Probes (temp seeds, read-only on the repo): `sync_probe.py` (AST: POST routes that
write research tables without a sync — 4 hits, 2 of them matter: defense cancel, concept-paper compliance), `rag_probe.py`
(18 questions with/without the Purpose demotion), `cancel_probe.py`, `grad_probe.py`, `stale_probe.py` (the F7-01/F7-02 numbers).
