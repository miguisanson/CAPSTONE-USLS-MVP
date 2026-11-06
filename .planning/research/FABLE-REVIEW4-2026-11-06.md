# Fable review #4 — v6.4.1-test, 6155f2b8..056e5cf0, 2026-11-06

Read-only review of `git diff 6155f2b8..056e5cf0` (app.py, frontend/src, frontend/e2e, frontend/scripts, tests; .planning,
Documents and PDFs excluded): pkt/f7 (F7-01..09), pkt/r5ui, pkt/audit5, pkt/srv6, pkt/lists5 and the small commits between.
Packet reports and ISSUES rows were treated as claims and re-read against the code. Ran: `tests.test_f7` + `tests.test_srv6`
(result at the end) and two probe scripts on temp seeds (`E:/Temp/claude/fable4/probe.py`, `probe2.py`). Not run: the full
suite (running elsewhere), e2e, the autopilots.

## Verdict

1. No P1. All nine F7 fixes landed and hold: no screen shows the stored `ResearchCase.status` next to a live one any more
   (every `research_case_dict` call a screen reads passes the live progress; the stale stored rows, 41 of 52, are read by nothing
   a user sees); the seed puts no graduation history on coursework students; a declined invitation gets 409 before the accept branch.
2. Two P2s. (a) The Course Audit's "Students with missing subjects" is not an audit: it inverts next-term *demand* for the first
   program only, so it lists 6 DBA students out of 79 with missing subjects, every count wrong (ran). (b) `p85-staff-lists.spec.js:68`
   still asserts the old Compre hint text, so the all-roles e2e gate goes red on the Students list (p133 asserts the opposite).
3. One side effect of F7-02 (the seeded graduation history is now empty: the Dean's board fell from 9 rows to 4 and the older terms
   have no graduation decisions) and six P3s, mostly IM24 gaps between sibling pages.

## Findings

| ID | Pri | file:line | Problem | Failure scenario | Fix | Effort | How |
|---|---|---|---|---|---|---|---|
| F8-01 | P2 | `frontend/e2e/p85-staff-lists.spec.js:68` (`^\s*N subjects? to finish\s*$`) vs `frontend/src/pages/Students.jsx:23` ("Compre: eligible after N more subjects") and `p133-lists5.spec.js:26` (`/to finish$/` must be 0) | lists5 changed the Students-list Compre hint but did not update the older spec that reads the same cell. | `npm run e2e`: p85 "Students list: Compre exam column" fails on the first student with missing subjects; p133 passes. The two specs cannot both be green. | Change the p85 regex to `^\s*Compre: eligible after ${c.missing_subjects} more subjects?\s*$`. | XS | read |
| F8-02 | P2 | `frontend/src/pages/workflow/CourseAudit.jsx:36-40` (`api.courseAdjustments()` with no program → `app.py:19197` first program by code), `:11-23` (`missingByStudent(adj.demand)`), `:90` ("Subjects each student still has to take"), `app.py:38700-38705` (demand = `current_subjects` + `next_subjects` of `students_expected_for_planning`) | The "missing subjects" table is the Course Adjustments demand list turned inside out: one program (DBA), one target term, "Currently enrolled" subjects counted as missing, "Missing" = number of demand rows, not the audit's `missing_count`. The words say it is an audit (Ops Manual 4.3.8 excludes currently enrolled subjects from a need; 4.18.4 step 3 is a coursework check per student). | Fresh seed (ran): 79 students have missing subjects across 11 programs; the page lists 6, all DBA. All 6 rows are wrong: Rafael Dizon "Missing 3, take next DBA-MAJ1, DBA-MOR" while the audit says 18 missing starting DBA-COG1; Bianca Mendoza "Missing 5" includes the three subjects the student is enrolled in now. The Academic Coordinator of MAEd sees "No student has missing subjects" for 19 students. | Serve the audit: a read-only `GET /api/course-audit/missing?program_id=` that returns, per student, `compute_course_audit(s)["missing"] + ["incomplete"]` (codes in curriculum order, count = `missing_count`), with a Program select on the page; drop the demand inversion. Until then rename the section "Subjects needed next term (DBA)" so it does not claim to be an audit. | S | ran |
| F8-03 | P3 | `frontend/src/pages/workflow/CourseAudit.jsx:50-54` (counts line) + `:46` (`api.courseAuditRoster(courseId)` with no term); `app.py:19908-19918` (every `CourseRecord`, status "Missing" rows included) | "N enrolled · done completed · rest not yet completed" counts CourseRecord rows of any status and any term, under a subtitle that says "at the end of the term". | DBA-COG1 (ran): 10 records = 7 Completed in the active term + 3 rows whose status is "Missing" (never enrolled); the line reads "10 enrolled · 7 completed · 3 not yet completed". A past-term completion would also count as "enrolled" this term. | Pass the active term (`roster?term=`) and count "enrolled" as the class statuses only (`Enrolled`, `Current`, `Completed`, `Failed`); say "records" if all rows stay. | XS | ran |
| F8-04 | P3 | `app.py:41918-41921` (`graduation_pool` = Completed students not in `busy`) while `busy` (`:41907-41910`) includes every student with a `ResearchCase` — and every Completed student has one | F7-02 narrowed the pool to Completed students but kept the "no other story" rule, so the pool is empty and the graduation lines of `HISTORY_PLAN` ("AA", "AAR") seed nothing. | Fresh seed (ran): 0 `GraduationEndorsement` rows on Completed students, 0 "Registrar Received"/"Acknowledged" anywhere; the Dean's Graduation board has 4 rows (9 before); the older and recent terms have no graduation decision for the cycle-time and decided-by-the-Dean reports. The F7-02 test passes vacuously (nothing to check). | For graduation only, exclude from `busy` the student's own `ResearchCase`/`DefenseVerdict` rows (they are the story that makes the student Completed), or add `GraduationEndorsement is None` as the only guard; assert in `test_f7` that at least one Registrar-Received row exists. | XS | ran |
| F8-05 | P3 | `app.py:27000-27007` (`graduation_missing_text`: `research_*` → "X not passed yet", `practicum` → "Practicum not completed yet", whatever `passed` is) | The "no record yet" case (`passed is None`, no research case / no practicum record) now reads like a real failure; the old text kept "(no research record on file)". | Graduation candidates report (read): a student with no research case shows "Title Defense not passed yet; Proposal Defense not passed yet; Final Defense not passed yet"; the office looks for failed defenses instead of asking for the research record. Ops Manual 4.18.4 steps 3-4 return the list "with the missing items", a different action from a failed defense. | Keep the suffix for `passed is None`: "Title Defense not passed yet (no research record on file)", "Practicum not completed yet (no practicum record on file)". | XS | read |
| F8-06 | P3 | `frontend/src/lib/stages.js:80` (`stageWords`) used only by `faculty/FacultyAdviserPanel.jsx`; `pages/Students.jsx:55`, `pages/StudentDetail.jsx:172`, `student/StudentOverview.jsx:179` ("You are at: LOA"), `student/StudentSupportPages.jsx:110` still print the raw stage | IM24 / Rule 6: I-397 spelled out LOA and AWOL for the faculty page only. | The faculty advisee list says "Leave of Absence"; staff open the same student in the Students list and read "LOA"; the student's own home says "You are at: AWOL". | Call `stageWords()` in the four places (StatusChip `label` on StudentDetail). | XS | read |
| F8-07 | P3 | `frontend/src/components/ListExportButtons.jsx:20-26` ("Downloaded <file>" status line, I-401) vs `components/ui/DataTable.jsx:207-215` (its own "Export CSV" says nothing) | IM24: the two Export CSV buttons now behave differently. | Staff export the Graduation board and see "Downloaded graduation-candidates-2026-11-06.csv"; on the Students list or a report table the same button gives no sign the file went anywhere (the I-401 complaint). | Add the same `role="status"` line (5 s) to `DataTable.exportCsv`, or move both to one small hook. | XS | read |
| F8-08 | P3 | `app.py:37482` (`next_step` from `first_type` whenever `state == "ready"`) with `:37464-37467` (`elif submitted:` → reviewer Research Coordinator → `state = "ready"`) | `first_type` is the first non-upload pending item, set before the branch is chosen; in the "submitted and waiting for review" branch it can be `system_panel` or `*_schedule`, so the student is listed as waiting for a panel or a date while the Research Coordinator still has to review the document. | A student uploads Form 4 (Submitted) while the panel is still pending: the Research Gate card says "Form 4 is submitted and waiting for review", the Panel Matching waiting list says "Students whose documents are in". Seed today: 25 rows with `next_step`, none in this state (ran). | Set `next_step` inside the two branches that mean it (`system_panel` → "panel", `_schedule` → "schedule") and leave it `None` elsewhere. | XS | ran/read |
| F8-09 | P3 | `frontend/src/pages/workflow/WaitingList.jsx:12-13` (`useApi` result's `error` ignored; `rows = []`) | A failed `/api/research-gate/overview` renders the empty state "No student is waiting for a panel right now." | Server error or session expiry while opening Panel Matching: the coordinator reads that nobody is waiting; the e2e checker flags the failed call but the screen does not. | Render `error` through the DataTable `empty`/`InlineNotice` like `CourseAudit.jsx:56` does. | XS | read |

## Verified as fine

- **F7-01 (live research status):** the three payloads a screen reads pass the live progress — staff student record (`app.py:14625`),
  student portal context (`:14779`), Research Gate context (`:28038`); `research_case_dict` maps "Completion Evidence"+"Complete"
  to "Verified Complete". The remaining stored-status readers are not screens: `report_student_list` `research_completion` (`:26633`,
  no frontend reader of that key), `student_directory_brief` with `live_readiness=False` (`readiness_status` is read only by the
  StudentPicker, which asks `readiness=live`). Stored rows still stale after a seed: 41 of 52 (ran). `student_portal_stage` maps the
  stored gate; probe of all 42 student logins: home stage = live stage except the naming "Completed" vs "Completion" on 6 finished
  students (same gate). Defense cancel and re-confirm now flush then sync (`:31938`, `:21808`); test covers cancel.
- **F7-02:** no "Registrar Received" on a non-Completed student (test + probe); see F8-04 for the side effect.
- **F7-03:** `studentWaiting` maps an overdue task to "In progress", test updated. **F7-04:** draft-warning replace first, then the
  Handbook regex, then the general one; the test covers the Ops Manual citation with "Proposed › " stripped.
- **F7-05 (IM24):** `ListExportButtons` sits right after `BoardFilterRow` on ProcessBoardPage and the Research Gate board, the same
  place as Graduation (`GraduationRoster.jsx:816`) and Practicum (`Practicum.jsx:271`); CSV fields exist on the case payloads
  (`kind_label` `:8568/:8646`, `owner` `:8651`, `last_activity_at` `:8625`).
- **F7-06:** both loops use `active_student_clause()`; `TERMINAL_STAGES` = Completed, Withdrawn. **F7-07:** the queue link counts
  `taskActions.total` only; the ready-students link stays. **F7-08:** the 409 runs before the accept branch and only for `Declined`;
  the test checks the status stays Declined. **F7-09:** `ENDED_STATUSES` has both statuses; the Graduation open view hides Sent and
  Received; `openCaseOfStudent` therefore no longer picks a sent withdrawal.
- **At-risk (I-403):** staff, Academic Coordinator and Research Coordinator: `kpis.at_risk` = Students list total
  (`risk=At Risk of Delay/Delayed&standing=Active`) = Reports "Behind schedule" count = 24 (ran); the filter splits on `,` and `/`
  (`:23265`), `standing=Active` maps to `active_student_clause()` (`:23249`); the Dean has no kpis tile (analytics only). Tile sub-text
  and links updated in both `officeStats` branches; p61, p111-night10, test_night10 updated.
- **Report tile words:** only `behind` and `waiting` carry a target comparison; `targetGoal` gives "Target: at most 10% · missed" and
  "Target: 0 waiting · met"; the "All offices:" label is asserted by p103 and p130-r5ui.
- **`initials()`:** callers Layout, StudentPicker (x2), Faculty (x2), Students; first + last name, titles and "(Role)" stripped;
  the seed has no "Jr."/"III" names, so the first-and-last rule changes nothing there. Tests in `format.test.mjs`.
- **DataTable scroll edge:** inline background on the scroll container, only when `scrolls`; the opaque `thead` hides the edge at
  header height only; `stackOnPhone` paths untouched.
- **Course Audit read-only:** the two new routes are GETs, `handle_course_audit` still raises on any write, no save/mark button
  (p131 asserts it); roster links go to the student record. Admin passes every role gate (`require_api_login` `:5670`), so the admin
  walkthrough of Course Audit, Panel Matching and Defense Scheduling loads.
- **Waiting lists (I-064):** `/api/research-gate/overview` allows staff, Academic Coordinator and Research Coordinator — the roles
  whose sidebar has Panel Matching / Defense Scheduling; "Choose" sets `studentId`, the URL gets `student_id`, the label refills
  from `selected_student.search_label`. The seed's 25 `next_step` rows are all "schedule" with no submitted document pending (ran).
- **e2e texts:** every other changed string has its spec updated (p51, p61, p62, p64, p75, p85 I-104 part, p87, p103, p111, p126,
  p130-persona6, p132); p105 "Needs signature" is the Signatures page (`FacultyResearchWorkspace.jsx:108`), unchanged.
- **Business Rules:** the rule code shows for admin only; "Not checked by the system" in badge, tile, filter, guide and specs.
- **Seed rename:** "Enrollment record (demo data)" replaces "Seeded current DBA enrollment"; p64 and test_srv6 updated.
- **e2e server cleanup:** only `usls-e2e-*` folders older than 6 h are removed; `statSync` failures are skipped.

## Test run

`tests.test_f7 tests.test_srv6`: 11 tests, OK, 114 s. Probes (temp seeds, read-only on the repo, 2 runs each):
`E:/Temp/claude/fable4/probe.py` (next_step rows and pending items; Course Audit list vs `compute_course_audit`; roster term mix;
graduation endorsements; at-risk by role; stale stored research rows), `probe2.py` (student home stage vs live stage for all 42
student logins; Dean graduation board rows). Both end with a `PermissionError` on the temp-file unlink (Windows, SQLite handle), after
all output.
