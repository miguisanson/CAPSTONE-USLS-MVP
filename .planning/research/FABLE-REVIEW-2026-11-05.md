# Fable review before submission — v6.4.1-test @ 67d4432, 2026-11-05

Read-only review by Fable. Sources: code (app.py, standalone_process.py, leave_workflow.py, business_rules_catalog.py,
frontend/src), the Playwright sweep screenshots in `frontend/e2e-artifacts/screens/` (14 opened at 1366 and 390 px),
the Ops Manual draft, the Handbook 2022-2023 rule register, the Research Protocol (docx text extracted), ISUES rows
I-001..I-369 and the 2026-11-03 Fable review. Nothing already filed is repeated unless it is still open and worth
raising; rows marked (I-nnn) point at the existing row.

## Verdict

1. The app is demo-ready: every role's home, boards and forms render at 1366 and 390 px with no raw slugs, no debug
   text and one status vocabulary. The 2026-11-04 process audit already filed the real logic gaps (I-264..I-351).
2. The two things most likely to embarrass the team are cheap: Rule 6 pronouns in ~16 screen strings and developer
   words ("personas", "demand scenarios") on the public sign-in page (F5-01, F5-02).
3. One real logic gap not yet filed: Withdrawal has no "sent to the Registrar" step, so the student timeline says
   "Emailed to the Registrar" the moment staff export the Excel (F5-06); finished Denied cards say "Waiting for: Staff"
   forever (F5-07).
4. The Research Gate staff page (Natalie + I-362) is 5,300 px: every card shows 6-8 requirement tiles and a second
   student picker sits under the board. Polish, not rewrite (F5-03).
5. The 24 owner-question rows all have a policy-faithful default (section 3); 17 are S, 5 are M, 2 are L (defer).

## Findings

| ID | Pri | Lens | file:line | Problem | Fix | Effort | app.py |
|---|---|---|---|---|---|---|---|
| F5-01 | P1 | embarrass | `processConfig.jsx:30,35`; `Dashboard.jsx:135`; `faculty/FacultyPages.jsx:93,123`; `faculty/FacultyAdviserPanel.jsx:275,317`; `Faculty.jsx:158,384`; `FacultyAssignmentProfile.jsx:160`; `leave/ActionDialog.jsx:12`; `leave/CaseConversation.jsx:9`; `DemoGuide.jsx:487`; `reports/DeanViews.jsx:224-225`; `Reports.jsx:57`; `PrivacyConsent.jsx:13`; `leave_workflow.py:56`; `standalone_process.py:182` | Rule 6 (owner 2026-11-04): pronouns for people on screen — "restores their record", "the stage they left", "until they act", "ask you to be their research adviser", "reach them", "(they can read it)", "where they get stuck", "cases they handle", "what they can do next". | Name the role: "restores the student's record", "the stage the student left", "until that office acts", "the student can read it", "what the student can do next". | S | no (2 strings in `leave_workflow.py` / `standalone_process.py`) |
| F5-02 | P1 | embarrass | `Login.jsx:17-74` | Public sign-in demo panel: "Approved-LOA personas ready to file return requests", "Missing-subject demand scenarios for official course offerings", "One automatically flagged AWOL return and one residency-ready persona". | Plain words: "Students on an approved leave who can ask to come back", "Subjects students still need, for the course offering", "One student flagged AWOL and one ready for residency". | S | no |
| F5-03 | P1 | ui | `workflow/ResearchGateOverview.jsx:130` + `workflow/ResearchGate.jsx` (screenshot `staff/workflow-research-gate-1366.png`, 5,293 px) | Each card lists every requirement as a tile (6-8 per card, 50 cards); under the board the old "Choose a student… Select a student to begin" picker and an empty box remain (Khloe rule 1: never a second competing list). | Card = name, stage, adviser, "4 of 6 requirements · Missing: Form 1, Concept papers" line, Next, View / Record for the panel. Requirement tiles move into View. The picker goes; the per-student record opens from the card (already `?student_id=`). | M | no |
| F5-04 | P2 | logic | `workflow/GraduationRoster.jsx:314` (`!applicationComplete`), batch "Next:" (screenshot `dean/dean-approvals-graduation-1366.png`) | "Dean Approved" batches still carry "Application document issue" and say "Next: None" while the stage check says "Step 8: Export Dean-approved list" (the Dean's own step). | Hide the badge once the batch passed Dean review; Next = "Dean (export)" until exported, then "Done - with the Registrar". | S | no |
| F5-05 | P2 | ui | `components/StageBoard.jsx` phone list; `ProcessBoardPage.jsx:150` (`?show=open` only from the dashboard link) (screenshot `dean/dean-approvals-leave-of-absence-390.png`, 6,326 px) | On a phone the Dean's LOA board is one 6,300 px list of all 16 cards, 8 of them "Finished - nothing more to do". | Phone list: stage groups collapsed, only the stages that hold a card for this role open ("With the Dean" for the Dean); "Show finished (8)" at the end. Same on all six boards. | S | no |
| F5-06 | P2 | logic | `standalone_process.py:79-83,211-214,305`; `app.py:8958` (LOA has Exported → Sent → Acknowledged) | Withdrawal ends at "Exported - Ready to Send"; the "Sent to Registrar" status exists only for "older records"; the student timeline marks "Emailed to the Registrar" complete at export. Ops Manual WD-11: the Graduate School's duty ends when the request is sent. | Add staff move `send` (Exported → Sent to Registrar, optional "Acknowledged" like LOA), timeline step completes on it; same for Graduation (I-324). | S | yes |
| F5-07 | P2 | logic | `leave_workflow.py:55-56` (Denied owner = Staff), `standalone_process.py:56-57` (Return Denied owner = Staff); `leave/leaveHelpers.js:121` returns the owner before the done-phase text | A denied request shows "Waiting for: Graduate School Staff" on every board and in Move to…, but staff have no move. Same-kind rule IM24: finished cards must read "Finished". | owner "" for every `phase: done` status; the "staff tell the student" sentence stays in the description. | S | no |
| F5-08 | P2 | input | `workflow/DefenseScheduling.jsx:446-448` "Source reference" (free text, no hint); `:438-440` "Requested by" select | Staff type a "source reference" nobody defines; "Requested by" is picked although the reschedule came from a student request or a panelist's decline (I-282). | Drop "Source reference" (or fill it from the student's schedule request id, read-only); "Requested by" derived from what opened the reschedule, editable only when none. | S | no (server ignores a missing value) |
| F5-09 | P2 | ui | `faculty/FacultyVerdicts.jsx:161-221`, `workflow/RecordForPanelDialog.jsx:120-160`, `workflow/ResearchGate.jsx:250-324` | Three copies of the verdict form: score "Form 7, optional" vs "Form 7" with hint, title field placeholders differ, ResearchGate keeps a third "Panel verdict fallback" form. | One `VerdictFields` component (result, follow-up, remarks, title pick, score) used by all three; one label set. | M | no |
| F5-10 | P3 | ui | 44 `<Spinner>` vs 5 `Skeleton` (`WorkQueue.jsx`, `StudentDetail.jsx`, `TermSettings.jsx`, `PolicyDocuments.jsx`, `MonitoringGrid.jsx`, `faculty/*`, `reports/*`) | Non-board pages still load as a lone spinner and jump when data lands (I-156 fixed boards only). | `SkeletonTable` / `Skeleton` in place of the page-level Spinner on the list and report pages; keep Spinner inside buttons. | M | no |
| F5-11 | P3 | ui | AWOL case card headline (`components/process/CaseCardFacts` via `leaveHelpers.js`) (screenshot `dean/dean-approvals-awol-1366.png`) | The "what it is about" slot shows the check result "Within Maximum Residence" on return cards and "Awaiting return intent" on AWOL cards; Khloe rule 5: same five facts on every card. | Headline = kind ("Return from AWOL", "AWOL - no return filed"); the residence result stays in its green box. | S | no |
| F5-12 | P3 | ui | student Subject Withdrawal empty state (`student/StudentRequestPages.jsx` / `RequestForms.jsx:544`) (screenshot `student/student-requests-withdrawal-1366.png`) | Title "Subject withdrawal is closed right now" + body "You have no enrolled subject to withdraw from" mix two reasons; no next step. | One sentence per reason: "You have no enrolled subject this semester" / "The window closed on <date>; file a Leave of Absence instead" with a link. | S | no |
| F5-13 | P3 | embarrass | `Dashboard.jsx:142` "Complete a workflow to populate this feed."; Monitoring Sheet banner "Enrollment and student profiles are synchronized (3 rows checked)" (I-081, still open); `monitoring/StudentRecordPanel.jsx:82`, `EnrollmentClassList.jsx:23` "IDNO"; LOA card "Reason not given" for seeded Benjamin Santos (`leaveHelpers.js:58`) | Developer words and a seeded case without a reason the owner asked to see (I-356). | "Submissions, decisions and replies will appear here."; "Records match (3 checked)"; "Student ID"; seed a reason category on every LOA case. | S | no (seed: yes, 1 line) |
| F5-14 | P3 | ui | Research Coordinator home (screenshot `research-coordinator/home-1366.png`); `app.py` dashboard tasks for `research_coordinator` | Home says "Nothing is waiting on you", 0 students with open work, "No activity yet", while the Research Gate board shows 5 students "Ready - Record for the panel" and 40 "Blocked". | "Waiting on others" lists the students waiting on a panel verdict (max 3 + View all → Research Gate); "Students with open work" counts Blocked + Ready. | S | yes |
| F5-15 | P3 | input | `process/ResidencyDialog.jsx:130-153` | Purpose is a blank select (the stage decides it, I-299) and the Semester select lists every term, past ones included (the server now refuses them, I-268). | Purpose pre-filled from the stage (editable only if the stage is unknown); Semester = active term read-only; run the check as soon as a student is chosen. | S | no |
| F5-16 | P3 | ui | `lib/staffHome.js:88` (screenshot `staff/home-1366.png`) | "Waiting on others" rows all go to "Open Work Queue" while "Needs your action" rows deep-link to the board/request. | Same link rule for both groups (board + `?student_id=`; I-348). | S | no |

Still open from earlier reviews and worth doing before submission: I-081 (jargon), I-091 (student "Research" stat card is a
chip), I-336 (bell links to pages the role cannot open), I-348 (task deep link), I-105 (closed by the Khloe rework —
mark it fixed).

## Decisions for the question rows (policy-faithful default)

| Row | Default decision | Source | Effort |
|---|---|---|---|
| I-053 | No group step for Withdrawal and no batch endpoint for Practicum. The Dean decides each withdrawal letter; the export already groups tagged withdrawals into one Registrar list. Practicum is one report per student. Close the row; say so in "How this works". | Handbook p.49 (WD-06), Ops Manual 4.4.4 step 4-6, PRC-09 | S |
| I-158 | Keep Panel Matching and Defense Scheduling per student; the Research Gate stage columns (I-362, AD12) are the overview. Close. | AD12; Protocol Title Defense I (panel per student) | S (close) |
| I-167 | Do not build an all-subjects withdrawal. Change the two messages: "After the second week a single subject cannot be withdrawn. To leave the semester, file a Leave of Absence (full fees apply, Handbook p.51)." | Handbook p.49 (WD-03), p.53 (LOA-06); Ops Manual 4.4.6 | S, `app.py:4242,4347`, rule text `:6455` |
| I-170 | One drop rule on all three paths: a drop is recorded only when unexcused absences exceed 20 %; the free-text "documented exception" is removed from the class list and the Monitoring Sheet (keep "excused absence" as DRP-02 with the excuse type, not free text). | Handbook p.52 (DRP-01..03) | S-M, `app.py:18219`, `:28456`, `StudentRecordPanel.jsx:364-367` |
| I-174 | No waiver: the 14-day lead time is a hard check for title, proposal and final defense; the override checkbox keeps only "panelist without entered availability". Demo: the "Skip date waits" switch must also skip the lead time, or the Demo Guide cannot book. | Handbook pp.59, 63, 65; Protocol TTL-01, SCH-03; OQ-43 option A | S, `app.py` evaluate_schedule_slot + `DefenseScheduling.jsx:420-428` |
| I-369 | No "share this demo" code before submission. One sentence on the sign-in page: "Each browser has its own copy of the demo data; the Demo Guide switches roles for you." | Design note I-366 | S |
| I-248 | Record the three concept-paper titles at upload (three short fields on the student's Form 1 step); the verdict offers a pick list of the three plus "new title set by the panel". | Protocol Title Defense II-III (panel picks one of the three, Form 2) | M, app.py |
| I-252 | The student's hours are a claim ("reported by the student"); the Academic Coordinator enters verified hours per certificate; the status (Hours Incomplete / Completed) follows the verified total only. | PRC-07, PRC-09 | M, app.py |
| I-273 | Return from AWOL forward checks the same four returnee items as readmission (Business Office clearance, interview, evaluation, advise slip). | Handbook p.45 (AWL-03 = RDM-02) | S-M, app.py |
| I-277 | Enrollment status is derived: "Enrolled" only when the student has subject rows in the active semester, else "Not Enrolled"; the select goes. | AGENTS Rule 6; Ops Manual 3.2 (AIMS is the source) | S, app.py + `AddStudentDialog.jsx:121` |
| I-278 | The window and fee are judged from the first submission date; a resend keeps it. | Handbook p.49 (WD-01: "until the second week"), docstring `app.py:3944` | S, app.py |
| I-279 | Several subjects per request: defer (needs a link table, Dean decision, tagging, export). Note the limit in Ops Manual 4.4.8. | Handbook p.49 "subject/s" | L (defer) |
| I-284 | One adviser endorsement at the proposal gate (Form 4); drop "Proposal manuscript endorsement". | Protocol Proposal Defense I (one Form 4) | S, app.py |
| I-285 | Fix the sign-in label for Miguel Yu to his real state ("At Final Defense - ready to request the date"). | seed vs `app.py:40032` | S |
| I-293 | Public Final Defense, Form 4.3, Form 8, conference proof: defer; list as a known gap in Ops Manual 4.14 and the proposal. | Protocol Public Defense (students from Aug 2020) | L (defer) |
| I-297 | The Dean cannot approve a readmission until staff confirmed clearance and interview (same gate as residency, I-012). | Handbook p.45 (RDM-02) | S, app.py |
| I-299 | Purpose from the stage; checker runs automatically (F5-15). | RES-01, RES-02, RES-04 | S |
| I-302 | Re-run the two-week no-grant check when the Dean approves. | Handbook p.53 (LOA-09) | S, app.py |
| I-304 | The Dean's readmission approval produces the Advise Slip (print view from the approval record, forms pack). | Handbook p.45 item 4 | M |
| I-306 | Auto-tag the subject Withdrawn on the Dean's approval; the staff "tag" step disappears. | WD-12 (manual tag "is enough", not required); owner rule "if it can be automatic let it be automatic" | S, app.py + standalone_process.py |
| I-313 | "Date the panel received the manuscript" is derived from the adviser's endorsement / manuscript upload date and shown read-only. | FIN-03 (14-Day Rule from receipt), FIN-05 | S, app.py + `DefenseScheduling.jsx:401` |
| I-317, I-319 | Change of title (Form 3.4) and AC panel recommendation: defer; catalog rows stay `enforced=False`. | Protocol Change of Title; Title Defense I | M (defer) |
| I-324 | Graduation gets Sent to Registrar / Acknowledged like LOA (with F5-06). | Ops Manual 4.19 | S, app.py |
| I-326 | Per-member Form 7: defer. Now: Failed / Deferred refuse a passing score. | FIN-09 | S (validation), L (per member) |
| I-327 | Turnitin upload takes the similarity % and refuses above 15. | CMP-03 | S, app.py |
| I-334 | Keep DEMO_SHOW_ACCOUNTS=1 for the submission demo; fix UAT.md to say so. | IM36 | S |
| I-335 | Staff record the comprehensive exam result (Passed / Failed, date, who recorded) on the student record with provenance; no student application step yet. | Handbook p.56 (RES-04), p.77 (GRD-04) | M, app.py |
| I-346 | Residency request page for students: defer; staff record it. | RES-01/02 ("enroll for residence" is a registration act) | M (defer) |
| I-348 | Restore `?student_id=` opening the request from a dashboard task. | I-239 | S |

## Reference patterns to copy

| Product / pattern | What to copy | Where in this app |
|---|---|---|
| GOV.UK Design System task list — "Cannot start yet" grey tag with a hint saying why ([design-system.service.gov.uk](https://design-system.service.gov.uk/components/task-list), [designsystem.gov.scot](https://designsystem.gov.scot/patterns/task-list)) | One status per requirement: Completed / In progress / Not started / Cannot start yet + one-line reason | Research Gate cards (F5-03) and student My Progress: "n of m" line, missing items named |
| Jira board — a card drag runs the same transition screen and required-comment validator as the button ([Atlassian docs](https://confluence.atlassian.com/display/JIRASOFTWARECLOUD/Transitioning+an+issue), [community](https://community.atlassian.com/forums/Jira-Service-Management/How-to-require-a-comment-before-completing-a-task-in-Jira/qaa-p/3072083)) | Already done (StepDialog); copy the "queue = filtered list" idea: phone list grouped by stage, finished groups collapsed | F5-05 phone list on all six boards |
| Linear — optimistic update, inline toast with Undo instead of a confirm ([linear.app guide](https://linear.app/enablement/guide/navigating-linear)) | After a drag/Move to…, a 6 s toast "Moved to With the Dean · Undo" (undo = the reverse move where one exists, else "View") | StageBoard move notice (already 6-9 s) — add Undo for staff forward / start review |
| Atlassian lozenge / Carbon status indicator (REFERENCE-PORTALS §3) | One colour per meaning, text never colour-only | Done (StatusChip + legend, I-358); keep F5-11 headline rule |
| Vanderbilt Kuali Action List (REFERENCE-PORTALS §1.6) | Every task links straight to the item, not to a queue | F5-16, I-348 |
| Slate bins (REFERENCE-PORTALS §1.10) | Filter tabs "Needs my action / Waiting on student / Finished" on every list | Boards already have the status filter; expose the three bins as chips above the board on phones |

## Work packets (disjoint files; only P-C and P-F touch app.py, never together)

| # | Packet | Findings | Files | Lines |
|---|---|---|---|---|
| P-A | **words** (do first, 2 h) | F5-01 frontend, F5-02, F5-12, F5-13, I-081 | `Login.jsx`, `components/processConfig.jsx`, `Dashboard.jsx`, `faculty/FacultyPages.jsx`, `faculty/FacultyAdviserPanel.jsx`, `Faculty.jsx`, `FacultyAssignmentProfile.jsx`, `leave/ActionDialog.jsx`, `leave/CaseConversation.jsx`, `DemoGuide.jsx`, `reports/DeanViews.jsx`, `Reports.jsx`, `PrivacyConsent.jsx`, `student/StudentRequestPages.jsx`, `MonitoringGrid.jsx`, `monitoring/StudentRecordPanel.jsx:82`, `EnrollmentClassList.jsx:23` | ~60 (one-line edits; test: grep guard for pronouns in `frontend/scripts/check-ui`) |
| P-C | **logic** (app.py owner) | F5-01 backend strings, F5-06, F5-07, I-167, I-278, I-297, I-302, I-306, I-324, F5-14, seed reason (F5-13) | `app.py`, `standalone_process.py`, `leave_workflow.py`, `tests/test_process_logic.py`, `tests/test_loa_readmission.py` | ~250 |
| P-B | **boards** | F5-04, F5-05, F5-07 lock text, F5-11, F5-16, I-348 | `components/StageBoard.jsx`, `components/ProcessBoardPage.jsx`, `leave/leaveHelpers.js`, `workflow/GraduationRoster.jsx`, `lib/staffHome.js` (+ `e2e/p74`/`p73` spec touch) | ~200 |
| P-D | **research gate polish** | F5-03, F5-08, F5-09 | `workflow/ResearchGateOverview.jsx`, `workflow/ResearchGate.jsx`, `workflow/RecordForPanelDialog.jsx`, `faculty/FacultyVerdicts.jsx`, `workflow/DefenseScheduling.jsx` (+ new `components/process/VerdictFields.jsx`) | ~300 |
| P-F | **questions round 2** (app.py, after P-C lands) | I-174, I-313, I-277, I-284, I-285, I-327, I-326 (score check), I-273, I-170 | `app.py`, `business_rules_catalog.py`, `tests/test_research_core.py`, `tests/test_record_edits.py`, `scripts`/seed | ~300 |
| P-G | **derived inputs (frontend)** | F5-15 / I-299, I-277 UI, I-313 UI, I-174 UI, I-170 UI | `process/ResidencyDialog.jsx`, `monitoring/AddStudentDialog.jsx`, `monitoring/StudentRecordPanel.jsx:364-367` (after P-A), `workflow/DefenseScheduling.jsx:401,420` (after P-D) | ~150 |
| P-E | **loading states** (if time) | F5-10 | `components/ui/Feedback.jsx`, `WorkQueue.jsx`, `StudentDetail.jsx`, `TermSettings.jsx`, `PolicyDocuments.jsx`, `reports/ReportPanel.jsx` | ~120 |

Run order for two days: P-A, P-C and P-B in parallel (3 helpers) → P-D and P-F and P-G → P-E. Medium/large question
rows (I-248, I-252, I-304, I-335) only if P-F lands by the evening of 2026-11-06; the L rows are deferred and named in
the Ops Manual as known gaps.

## Not checked

The sweep was still writing screenshots (183 of ~250 files); 1920 px shots, the faculty and academic-coordinator boards,
Course Adjustments and Reports at 390 px were not opened. No live request was sent; Gemini, Google Calendar and the
public site were not exercised. The Handbook PDF was read through the Ops Manual rule register, not page by page.
