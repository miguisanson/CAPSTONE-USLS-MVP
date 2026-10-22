# Consistency sweep (IM24) - 2026-10-22

Commit 726c3c8 (detached worktree `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/gate`). Fresh sweep: 14 passed, 7 roles x 3 widths.
`S` = `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/gate/frontend/e2e-artifacts/screens`. `src` = `.../gate/frontend/src`.
Known rows I-001..I-120 were not re-filed (I-064 student-picker start, I-066 coordinator homes, I-068 reports wall, I-081 jargon,
I-117 course adjustments length are known and left out). Ranked by how visible the difference is. Seen in screenshots unless marked "source".

Pages not covered by screenshots (the sweep only visits sidebar pages): case windows, decision dialogs, request-form error states.
Those were compared by source only (findings 7 and 14).

---

## 1. Dean "Practicum Reports" is a different board from every other Dean board
- Pages: Dean Practicum Reports vs Dean Leave of Absence / Readmission / AWOL / Withdrawal / Graduation.
- Differs: Practicum shows the old "Grouped workflow board" (small dashed columns, "No requests", "View full request", no Board/Table
  toggle, no lock or "Move to...", no "How this works" / "View recent activity" buttons, no "Rules applied" panel), a filter box with
  date-range and sort fields, and a second "Waiting for your decision" table under the board. The other boards use the shared
  `StageBoard` with the toolbar. At 390 px the Practicum board columns and the table are clipped at the right edge.
- Screens: `S/dean/dean-approvals-practicum-1366.png` vs `S/dean/dean-approvals-leave-of-absence-1366.png`, `S/dean/dean-approvals-withdrawal-1366.png`; 390: `S/dean/dean-approvals-practicum-390.png`.
- Files: `src/pages/dean/DeanPages.jsx` (`DeanProcessBody`, ~331-440), `src/pages/dean/DeanParts.jsx` (filter bar ~200-232, board ~432), `src/pages/workflow/Practicum.jsx` only if reused.
- Fix: render the Dean's Practicum on the shared board (the staff `PracticumRoster` in Dean mode, as Graduation does) and delete the private board and filter bar.

## 2. "How this works" and "Recent activity" sit in three places on workflow pages
- Pages: Leave/Readmission/AWOL/Withdrawal, Practicum, Graduation, Course Audit (header buttons + modal) vs Research Gate, Defense Scheduling, Student Handoff (right side rail cards "How this works" / "Recent in this workflow") vs Panel Matching (same cards but under the page).
- Differs: same content, three layouts; Handoff's recent list is an accordion ("View logs 11"), the others say "No recent actions". Dean Practicum, Graduation and Course Adjustments have neither the buttons nor "Rules applied". "Rules applied" is missing on Student Handoff and Course Audit while its sibling pages have it.
- Screens: `S/staff/workflow-research-gate-1366.png`, `S/staff/workflow-defense-scheduling-1366.png`, `S/staff/workflow-panel-matching-1366.png`, `S/staff/workflow-student-handoff-1366.png` vs `S/staff/workflow-practicum-1366.png`, `S/staff/workflow-course-audit-1366.png`, `S/staff/workflow-leave-of-absence-1366.png`.
- Files: `src/pages/workflow/WorkflowPage.jsx` (`hideSideRail`, `hasGuideButtons`, `railBelow`, side-rail block ~330-370), `src/pages/workflow/shared.jsx` (`WorkflowSupportModal`).
- Fix: every `WorkflowPage` screen uses the header buttons plus modal; remove the side rail and the below-page variant.

## 3. List pages have five different toolbars, count positions and wordings
- Pages: Students, Faculty, Work Queue, Activity Log, Enrollment Class List, Monitoring Sheet, Reports, Dean Activity Log, Dean Approvals Queue.
- Differs:
  - Select placeholders: Students "All student status / All stage / All program / All standing" (singular), Faculty and boards "All departments / All programs".
  - Labels: Reports and Dean Activity put the label above the select; Students, Faculty, Activity do not; Class List and Monitoring show the chosen value with no label.
  - Search: Students, Faculty, Work Queue, Activity have it; Class List and Monitoring do not.
  - Export: Class List and Monitoring put "Export CSV" inside the filter box (Monitoring also has "Export workbook" in the header), Reports puts it in a section header (and the daily list calls it "CSV"), the other lists have no export.
  - Result count: top "Showing 12 of 12 faculty" (Faculty, boards), bottom "Showing 1-25 of 148" (Students, Work Queue, Dean tables), none (Class List).
  - Owner filter on Work Queue is pill buttons, everywhere else selects.
  - Dean Approvals Queue filter box uses uppercase "UPDATED FROM / THROUGH / SORT" date fields that no other page has.
- Screens: `S/staff/students-1366.png`, `S/staff/faculty-1366.png`, `S/staff/work-queue-1366.png`, `S/staff/enrollment-class-list-1366.png`, `S/staff/monitoring-sheet-1366.png`, `S/staff/reports-1366.png`, `S/dean/dean-activity-1366.png`, `S/dean/dean-approvals-1366.png`.
- Files: `src/pages/Students.jsx`, `Faculty.jsx`, `WorkQueue.jsx`, `ActivityLog.jsx`, `EnrollmentClassList.jsx`, `MonitoringGrid.jsx`, `Reports.jsx`, `src/pages/dean/DeanReportPages.jsx`, `src/pages/dean/DeanParts.jsx` (queue filters ~200-232); new shared `ListToolbar` in `src/components/ui/`.
- Fix: one `ListToolbar` (search, filter selects with a plural "All <things>" placeholder, optional Export slot, one count line) used by all of them.

## 4. Activity Log is three different pages
- Pages: staff Activity Log, Dean Activity Log, student Activity Log.
- Differs: staff = free-form cards in one 4,400 px column (39 entries, no paging, search + two selects, no header icon); Dean = `DataTable` with a labelled "Process" select, "6 entries" and "Showing 1-6 of 6"; student = a Card inside the page repeating the title ("Activity Log" twice) and a different icon (History vs Activity in the sidebar and header).
- Screens: `S/staff/activity-1366.png`, `S/dean/dean-activity-1366.png`, `S/student/student-activity-1366.png`.
- Files: `src/pages/ActivityLog.jsx`, `src/pages/dean/DeanReportPages.jsx` (`DeanHistoryPage`), `src/pages/student/StudentSupportPages.jsx`, `src/components/Layout.jsx` / `portalNav.jsx` (icon).
- Fix: one `ActivityList` component (same filter bar, paging, row layout, icon) for all three roles.

## 5. Header icon tile is missing on the main staff list pages
- Pages: Students, Faculty, Work Queue, Activity Log (staff), Reports & Analytics vs every other page (Enrollment Class List, Monitoring Sheet, Practicum, Dean and student pages).
- Differs: the title sits flush left with no green icon tile, so the title column starts 56 px further left than on the page you just left.
- Screens: `S/staff/students-1366.png`, `S/staff/faculty-1366.png`, `S/staff/work-queue-1366.png`, `S/staff/activity-1366.png`, `S/staff/reports-1366.png` vs `S/staff/enrollment-class-list-1366.png`, `S/staff/monitoring-sheet-1366.png`.
- Files: `src/pages/Students.jsx`, `Faculty.jsx`, `WorkQueue.jsx`, `ActivityLog.jsx`, `Reports.jsx` (one `icon=` prop each; same files as finding 3, so do together).
- Fix: pass the sidebar icon to `PageHeader`; add a `check-ui` rule that every page header has an icon.

## 6. Practicum and Graduation boards lack parts every process board has
- Pages: staff Practicum, staff Graduation, Dean Graduation vs staff/Dean Leave of Absence, Readmission, AWOL, Withdrawal.
- Differs:
  - No summary line ("1 submitted, 1 with the dean...") and no drag / "Move to..." explanation above the filters.
  - Practicum columns have no one-line description under the column title; the others do.
  - Row button says "View" on Practicum, "View details" elsewhere.
  - Graduation cards carry an inline primary button ("Forward to Academic Coordinator"); process-board cards never do.
  - Practicum keeps a small grey "Practicum applies to Psychology and MSGC..." line (I-089 half-fixed).
  - Graduation (staff and Dean) adds a second heading "Graduation endorsement candidates" with a repeat description (see 11).
  - Chip colours: process boards use a blue "Awaiting your review", Practicum uses a neutral grey "Waiting for documents" for the same kind of state.
- Screens: `S/staff/workflow-practicum-1366.png`, `S/staff/workflow-graduation-1366.png`, `S/dean/dean-approvals-graduation-1366.png` vs `S/staff/workflow-leave-of-absence-1366.png`, `S/staff/workflow-withdrawal-1366.png`.
- Files: `src/components/ProcessBoardPage.jsx` (`summaryLine` ~243, toolbar ~416-440), `src/pages/workflow/Practicum.jsx`, `src/pages/workflow/GraduationRoster.jsx`, `src/components/StageBoard.jsx` (column description), `src/lib/status.js` (chip tone).
- Fix: move the summary line + explainer into the shared toolbar; give Practicum column descriptions; rename its button to "View details"; keep the Graduation inline button only if policy needs it, and then show it on the other boards too.

## 7. Dean "Course Adjustments" decides with a hand-built box; every other decision uses `DecisionPanel`
- Pages: Dean Course Adjustments vs Dean case page / board dialogs / Form 1 Endorsements / Adviser appointments.
- Differs: a one-line input with only a placeholder ("Optional note to the Graduate School..."), buttons "Approve" and "Return for revision" with no confirmation, and Return needs no reason. The `DecisionPanel` pages show a labelled "Comment for the student", require a comment to return, and ask to confirm. The page also has no activity buttons or "Rules applied" panel (see 2).
- Screens: `S/dean/dean-approvals-course-adjustments-1366.png` vs `S/dean/dean-approvals-leave-of-absence-1366.png` (open "View details").
- Files: `src/pages/dean/DeanPages.jsx` (~225-265, `decidePlan` ~190-220), `src/pages/dean/DeanContext.jsx`.
- Fix: replace the box with `DecisionPanel` (return requires a comment, approve optional), same wording as the other Dean decisions.

## 8. The student's Policy Assistant page is laid out differently from the other roles
- Pages: student Policy Assistant vs staff, Dean and faculty Policy Assistant.
- Differs: staff/Dean/faculty = chat plus a right rail ("How this works" five bullets, staff adds "Focus on a student"); student = full-width chat, a blue "Private and read-only" notice, different intro text and chips, and no "How this works" (so the "Offline answer" label is never explained to students).
- Screens: `S/student/student-assistant-1366.png` vs `S/dean/dean-assistant-1366.png`, `S/staff/assistant-1366.png`, `S/faculty/faculty-portal-assistant-1366.png`.
- Files: `src/pages/student/StudentAssistant.jsx` (or `StudentSupportPages.jsx`), `src/pages/Assistant.jsx`, `src/components/AssistantChat.jsx`.
- Fix: student uses the same page with the same rail; the "private and read-only" sentence moves into the rail.

## 9. Student request pages do not match each other
- Pages: student Leave of Absence, Readmission, Return from AWOL, Subject Withdrawal, Practicum, Graduation Endorsement.
- Differs:
  - Header chip for the same state: "Not submitted" (LOA, Readmission, Graduation) vs "No request" (Return from AWOL, Withdrawal, Defense Schedule). Graduation shows both "Not submitted" and "Not Submitted" (capital S) on one screen.
  - Body: LOA and Readmission are one plain form card; Withdrawal, Practicum and Graduation are numbered "StageCard" lists.
  - Warning text: LOA uses `InlineNotice` "Please read before you send", Withdrawal uses a hand-built amber box.
  - Submit labels: "Submit leave request", "Submit readmission request", "Send withdrawal request"; resubmit: "Send again" (LOA, Readmission), "Resubmit return declaration", "Resubmit subject withdrawal".
  - Busy text: "Submitting...", "Sending...", "Sending...", "Working..." (three dots vs the ellipsis character).
  - Request Center cuts long lock text ("Practicum is available only to Psych...", "Readmission is for students on an a...").
- Screens: `S/student/student-requests-leave-of-absence-1366.png`, `S/student/student-requests-readmission-1366.png`, `S/student/student-requests-awol-return-1366.png`, `S/student/student-requests-withdrawal-1366.png`, `S/student/student-graduation-1366.png`, `S/student/student-requests-1366.png`.
- Files: `src/pages/student/StudentRequestPages.jsx`, `requestMeta.jsx`, `RequestForms.jsx`, `CompletionForms.jsx`, `shared.jsx` (`SubmitState`, `StageCard`).
- Fix: one status vocabulary ("Not submitted"), one label pattern ("Submit <thing>" / "Resubmit <thing>"), one busy text, and `InlineNotice` for the warning; show lock text in full (wrap) in the Request Center.

## 10. Dean copy and board header details written for staff
- Pages: Dean Leave of Absence / Readmission / AWOL & Residency / Withdrawal boards vs the Dean's own pages.
- Differs: the board header descriptions are the staff text ("Record an LOA application and route the Dean decision", "Withdraw a student from one subject...", "Automatically flag policy-backed AWOL cases... record valid residency"). The summary line prints lower-cased stage names ("2 awol, 1 return review, 1 with the dean, 1 residency"). The "N waiting" chip next to the title appears on Dean Practicum, Graduation, Course Adjustments and Approvals Queue but not on the four process boards.
- Screens: `S/dean/dean-approvals-leave-of-absence-1366.png`, `S/dean/dean-approvals-awol-1366.png`, `S/dean/dean-approvals-withdrawal-1366.png` vs `S/dean/dean-approvals-graduation-1366.png`, `S/dean/dean-approvals-course-adjustments-1366.png`.
- Files: `src/components/processConfig.jsx` (description, add a Dean description), `src/components/ProcessBoardPage.jsx` (`summaryLine`, header badge), `src/pages/dean/DeanPages.jsx` (`DeanStandaloneBody` ~298-310).
- Fix: Dean description per process; summary line uses the column labels as written ("AWOL"); show the "N waiting" chip on every Dean board.

## 11. Duplicate headings: a card repeats the page title
- Pages: student Activity Log ("Activity Log" / "Activity Log"), faculty Assigned Classes ("Assigned Classes" / "Assigned class rosters"), faculty My Advisees ("Advisees" card under "My Advisees"), Graduation staff and Dean ("Graduation Endorsement" / "Graduation endorsement candidates"), Reports ("Dashboard summary"), Research Gate ("Choose a student") vs pages whose first block has no repeated heading (Students, Faculty, Class List).
- Differs: some pages open with title then an identical sub-heading and description, others go straight to content; the pages carry two sizes of title in the first 150 px.
- Screens: `S/student/student-activity-1366.png`, `S/faculty/faculty-portal-classes-1366.png`, `S/faculty/faculty-portal-advisees-1366.png`, `S/staff/workflow-graduation-1366.png`.
- Files: `src/pages/student/StudentSupportPages.jsx`, `src/pages/faculty/FacultyPages.jsx`, `src/pages/workflow/GraduationRoster.jsx`, `src/pages/dean/DeanGraduationPage.jsx`.
- Fix: drop the repeated card title (keep the description as the page description, or use a card title that says something new).

## 12. The "Adviser and panel" card has two layouts
- Pages: student Research Progress vs student Defense Schedule.
- Differs: Research Progress = full-width card, 2x2 panel grid, long specialization lines cut with an ellipsis; Defense Schedule = half-width card, names cut ("Dr. Marlon Gero...", "Dr. Patricia..."), the same four people. "Rules applied" sits inside the form card on one and above it on the other; the card title text is larger than other card titles on that page.
- Screens: `S/student/student-research-1366.png`, `S/student/student-defense-schedule-1366.png`.
- Files: `src/pages/student/StudentRequestPages.jsx` (~170-200), `src/pages/student/ResearchForms.jsx`, `src/pages/student/StudentAdviserPage.jsx` if it holds the panel list.
- Fix: one `AdviserPanelCard` component; wrap names instead of cutting; on Defense Schedule drop the specialization line.

## 13. Dean-held card: staff see a lock on Leave of Absence but "Move to..." on Withdrawal (needs a decision)
- Pages: staff Leave of Absence "With the Dean" card vs staff Subject Withdrawal "With the Dean" card.
- Differs: LOA shows "Waiting for: Dean" with a lock; Withdrawal shows "Move to..." on the Dean's card. IM24 says every locked card shows why; if staff really have a step there it should say what, and if not, the menu is wrong.
- Screens: `S/staff/workflow-leave-of-absence-1366.png`, `S/staff/workflow-withdrawal-1366.png`.
- Files: `src/components/ProcessBoardPage.jsx` (`lockReason` ~275-330), server step list for withdrawal (`app.py` withdrawal actions) to check; no UI change before that is confirmed.
- Fix: check what step the server offers staff at that stage; if it is a real step, label it; if not, drop the action server-side.

## 14. Loading-failed states differ (source only)
- Pages: Students, Faculty, Dashboard, boards (red notice with "Try again") vs Work Queue (red notice, no retry) vs Activity Log, Reports, Monitoring Sheet, Class List, Course Adjustments, Dean pages (icon `EmptyState` "Could not load ...", no retry).
- Differs: three looks for the same failure; only some can be retried without reloading the page.
- Screens: none (sweep never shows an error); see the source lines `Students.jsx:223`, `Faculty.jsx:147`, `WorkQueue.jsx:90,235`, `ActivityLog.jsx:98`, `Reports.jsx:121`, `MonitoringGrid.jsx:310`, `EnrollmentClassList.jsx:167`, `CourseAdjustments.jsx:340`.
- Files: those pages plus `src/components/ui/Feedback.jsx` (new `LoadError`).
- Fix: one `LoadError` (notice + "Try again") used by every page; add a Playwright check that forces a failed GET on three pages.

## 15. Small wording and control differences
- Faculty top-bar identity chip reads "Dr. Liwayway Bautista (Faculty) · Faculty" (role twice); Dean and student chips do not. (`S/faculty/faculty-portal-1366.png` vs `S/dean/dean-1366.png`; file `src/components/Layout.jsx` or the faculty name source.)
- Work Queue "Action" column shows "-" for Dean-owned tasks (withdrawal, graduation, practicum) while all other rows link to a page; I-073 fixed only the staff-owned one. (`S/staff/work-queue-1366.png`; `app.py` `task_dict` ~3190, `src/pages/WorkQueue.jsx`.)
- Sortable column headers exist only in the faculty tables (advisees, panels, defenses); Students, Faculty, Class List, Work Queue and Dean tables cannot be sorted. (`S/faculty/faculty-portal-advisees-1366.png` vs `S/staff/students-1366.png`; `src/components/ui/DataTable.jsx`, `FacultyAdviserPanel.jsx`.)
- Open-the-record buttons: "View details" (boards), "View" (Practicum), "Open case", "View full request", "Review" (Dean queue and home), "Review ->" (home). (`PracticumRoster`, `DeanParts.jsx`, `RoleHome.jsx`.)
- Staff sidebar numbers six workflows ("4 · Research Gate") but "Course Audit" has no number and the standalone processes have none. (`src/components/portalNav.jsx` / `Layout.jsx`; `S/staff/workflow-course-audit-1366.png`.)
- Fix: take each as a one-line edit; none needs its own packet.

---

## Suggested packets (no overlapping files)
- A: findings 1, 7, 10 (`dean/DeanPages.jsx`, `dean/DeanParts.jsx`, `processConfig.jsx`).
- B: findings 3, 4, 5, 14 and the sortable / Work Queue items of 15 (staff list pages and Dean Activity).
- C: findings 2, 6 (`WorkflowPage.jsx`, `shared.jsx`, `Practicum.jsx`, `GraduationRoster.jsx`, `ProcessBoardPage.jsx`, `StageBoard.jsx`); do 13 after the server check.
- D: findings 8, 9, 12 (student pages and the assistant).
- E: finding 11 and the remaining items of 15 (faculty pages, `Layout.jsx`, `portalNav.jsx`).
