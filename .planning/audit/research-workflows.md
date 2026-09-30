# Research-side audit: title / adviser / panel / scheduling / verdict / completion

Branch `v5.1-migui_clean`. Audit date 2026-10-01. Read-only: nothing in the repo was changed
except this file. Scope: research gate, Form 1 endorsement, adviser appointment, panel
matching, defense scheduling and rescheduling, calendar, verdicts and re-defense loops,
ethics, post-defense completion, practicum, graduation endorsement.

**How this was checked.** I read the code (`app.py` by section, the React pages listed in the
brief), the research protocol (`Complete-GS-Research-Protocol-...docx`), and the walkthrough
(`CAP-2521-IT-WALKTHROUGH.docx`). Where cheap I ran throwaway scripts with the Flask test client
on temporary SQLite databases in `E:/Temp/claude/` (`probe_research.py`, `probe2.py`,
`probe3.py`). The real database was never opened, no server was started, no browser was used.

- **VERIFIED** = confirmed by a probe script run, or by reading code that has no other path.
- **SUSPECTED** = follows from the code but depends on deployment (MySQL, server time zone,
  real USLS forms) or on an owner decision.
- **Important caveat on SQLite vs MySQL.** The app is configured for MySQL
  (`windows-dev-setup` memory) but the test suite uses SQLite, which does not enforce foreign
  keys. Finding R03 only appears when foreign keys are enforced (`PRAGMA foreign_keys=ON`),
  which is how MySQL/InnoDB behaves. That is why 80 tests pass and the bug is still real.

---

## 1. The big picture (plain terms)

1. **There is no adviser appointment at all.** The adviser is a text field on the student
   (`Student.adviser_name`). Nothing in the app lets anyone nominate, approve, record or change
   an adviser. Students loaded from the real Excel monitoring sheet have no adviser, so the
   adviser cannot sign the proposal papers, and the student is stuck at the proposal stage.
2. **Nobody can enter availability.** Faculty "My Availability" is read-only, and no screen
   or API exists for staff to maintain it either. The "availability" the scheduler shows is
   Monday-Friday 8:00-17:00 for everyone, minus **invented** busy blocks ("Graduate class",
   "Department meeting") generated from the faculty id.
3. **There is no calendar.** The only calendar-like things are one faculty's weekly grid
   (staff view only, shows the invented blocks, no defenses), a per-student availability
   matrix, and an unauthenticated `.ics` file that lists availability rows but no defenses.
4. **The verdict loop has holes.** "Passed with revisions" and "Deferred" leave the stage
   permanently unfinished; "Failed" on a proposal/final defense crashes once an adviser has
   signed (when the database enforces foreign keys); a defense scheduled under the wrong type
   can never receive a verdict.
5. **Several rules differ from the protocol** (project-paper panel size, external panelist at
   title defense, 14-day lead for title defense, ethics clearance before instead of after
   proposal defense, same panel for closed-door final, Form 5.1 missing, public defense missing).
6. **No reminders or notifications of any kind** exist, and research tasks are never closed,
   so the Work Queue fills with stale "overdue" items.

---

## 2. Findings

Severity: critical = blocks a real user or loses data; high = wrong outcome or rule
breach on a main path; medium = wrong or confusing but workable; low = cosmetic or edge.

### 2.1 Adviser appointment (thesis / dissertation)

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R01 | critical | Adviser designation | No flow exists. `adviser_name` is written only by demo seeders and by `merge_student_records`; the monitoring-sheet import never sets it; no route sets it. `AdviserAssignment` rows are created only by a startup loop that copies `adviser_name`. A real student therefore has no adviser: `faculty_is_adviser_for_student` is false, so the adviser-signature route returns 403, the Proposal/Final "adviser signature" requirement can never be met, and the student stays at "Pending adviser signature". Protocol needs Form 3 (student) -> AC notes -> RC -> Dean / Associate Dean -> RC issues Form 3.1 -> Form 3.2 + 3.3 within 5 days. `CHECKLIST_PHASE_PLAN.md` item 43 already lists this as an open P0 gap. | `app.py:339, 750, 1060-1069, 2103-2111, 9302-9338, 25065-25070`; `grep "adviser_name ="` finds only seeds/merge (`app.py:16539, 21071, 23417...`); protocol lines 65-90 | Add an `AdviserAppointment` record and a Research-side queue (see section 4). Until then allow staff/RC to record an appointment with date, and make every adviser-dependent action check it. | VERIFIED |
| R02 | high | Adviser appointment | Change of adviser is impossible, and if data is fixed by hand the old adviser keeps rights: the startup sync only **adds** an Active `AdviserAssignment` and never ends the old one, and `faculty_is_adviser_for_student` also falls back to the name string. Protocol allows one change, before proposal defense, with both advisers signing Form 3.1.1. | `app.py:25065-25070, 2103-2111` | Appointment history with `ended_at`, `end_reason`; one-change rule; both signatures; authorise only the current appointment. | VERIFIED (code) |
| R03 | high | Adviser appointment | Rules from the protocol are not checked anywhere: maximum 5 active advisees, PhD for doctoral advisees / PhD units for master's, program alignment, "University-affiliated". `Faculty.eligible_roles` ("Faculty Adviser / Panel Member / Panel Chair") is stored and shown but never used by matching, scheduling or signing. | `app.py:2002-2016`, `21966` (all active faculty are candidates), `17943-17953`; protocol lines 70-72 | Add degree and affiliation fields; show "advisees n/5" and block or warn at 5; filter candidates by `eligible_roles`. | VERIFIED |
| R04 | medium | Adviser role | The adviser can only sign. There is no "return with comments", no record that the manuscript was found compliant, and no check of the "at least 2 weeks before the defense" rule. The walkthrough (Case 12) describes only the sign path. | `app.py:9300-9338`; protocol lines 138-141 | Add adviser actions: Sign / Return with comments; store date; compare to the scheduled defense. | VERIFIED |
| R05 | medium | Title / adviser change | Form 3.4 (change of title, once, before proposal defense) and Form 3.1.1 (change of adviser) do not exist. The Policy Assistant text says adviser designation is "routed for Dean approval" and "recorded with the date" - neither is true. | `app.py:3929-3931` (assistant snippet); protocol lines 93-121 | Build as two small request workflows reusing the existing message/return pattern. | VERIFIED (absent) |

### 2.2 Research gate, Form 1, endorsement, ethics

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R06 | high | Panel matching order | Panel matching can be finalized with **no Form 1 file, no three-concept-paper submission and no Academic Coordinator endorsement**. Probe: a student with only three readable concept-paper rows and no `Form1Endorsement` was matched successfully (HTTP 200). Matching then locks the student's Title uploads. Staff can also bypass the endorsement at scheduling with the "requirements override". Protocol: AC endorses and recommends panel, **then** RC nominates. | `app.py:17931-17996` (no endorsement/submission check), `7241-7242, 8376` (lock), `18057-18076` (override); `probe3.py` output | In `handle_panel_matching` require `Form1Endorsement.status == "Endorsed"` (Title) and the student's submission; block the override for the AC endorsement. | VERIFIED |
| R07 | high | Ethics sequence | System order is reversed. It demands the signed ethics clearance **before** panel matching and scheduling of the **proposal** defense. Protocol: proposal defense -> Form 5.1 Technical Review Certificate -> Form 5.2 ethics review within one month **after** the defense; Ethics Clearance is an input to the **closed-door final** defense and to the completion package. Form 5.1 does not exist in the system. The Final gate does not ask for ethics clearance at all. | `app.py:20548-20552, 19897-19923, 18063-18070, 21095-21113`; `WorkflowPage.jsx:1567`; protocol lines 180-186, 221, 303-309 | Confirm with the owner which order USLS really uses (the code may reflect the July stakeholder meetings). If the protocol is right: move ethics to the post-proposal step, add Form 5.1, require ethics at the Final gate. | VERIFIED (code vs protocol); which is "right" = owner decision |
| R08 | medium | Form 1 / title | The system models **one** title per Form 1 (`Research Title:` line). The protocol has three concept papers / three titles and the panel **selects** one, recorded on Form 2. The approved title is never recorded. The upload is also **rejected and the file deleted** if the PDF has no text layer or no `Research Title:` label (parser "tuned to the prepared sample"). | `app.py:19489-19510, 7268-7276, 21046-21071`; protocol lines 43-49 | Store the three titles on Form 1; add "approved title" (or "all disapproved") to the title verdict; soften the parser (manual entry fallback). | VERIFIED (code); impact on the real Form 1 SUSPECTED |
| R09 | low | Form 1 endorsement | AC can only endorse; no "return/decline", no link to the AC's recommended panel set, not scoped to the AC's program; queue still lists students who are already past Title stage. | `app.py:8473-8538` | Add Return; add "recommended panel" field feeding R06 step. | VERIFIED |
| R10 | medium | Research actions vs standing | Only the comprehensive-exam prerequisite is checked. A student who is **AWOL**, on leave or withdrawn can be panel-matched and scheduled. Probe: schedule created for an AWOL student (HTTP 200). | `app.py:1881-1887, 17999-18004`; `probe3.py` | Require `standing == "Active"` (or residency) for research transitions; say so in the error. | VERIFIED |

### 2.3 Panel composition and matching

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R11 | high | Panel size | Project Paper panel is built as **4** (Chair, Content, Method, External); protocol says Chair + 2 (Content, Method) = **3**. Thesis (4) and dissertation (5) match. `CHECKLIST_PHASE_PLAN.md` D7 already says "do not silently infer a participant count" - the owner has not answered. | `app.py:21269-21277`; protocol lines 17-24 | Owner decision D7, then fix the project-paper list. | VERIFIED |
| R12 | high | Panel at Title defense | The same roles (including External Panel) are used at **Title** defense. The protocol note says the external panel participates "from Proposal Defense onwards". | `app.py:21269-21277`; protocol lines 23-24 | Title panel = Chair + Content (+ second Content for dissertation) + Method; add External from Proposal. | VERIFIED |
| R13 | high | Panel continuity | A new panel is matched per gate and the old one cleared. Protocol says the closed-door final uses "the same set of members of the panel". | `app.py:19971-19973, 17963, 13671-13677`; protocol line 227 | Carry the Proposal panel into Final by default; allow explicit replacement with a reason. | VERIFIED |
| R14 | medium | Role assignment | Roles are assigned by position in the selected list (first = Chair, last = External). Nothing records who is external or university-affiliated; `eligible_roles` is ignored; the **student's own adviser is not excluded** and can be chosen as Chair (also known as D4). | `app.py:17963-17979, 21966` | Add `is_external` and affiliation to faculty; exclude adviser; enforce role eligibility. | VERIFIED |
| R15 | high | Panel members | No invitation/acceptance, decline or recusal exists. The task "Confirm assigned panel acceptance" has no screen behind it. A panelist who becomes unavailable can only be swapped by staff (see R20). Workload counts every assignment ever made, with no cap. | `app.py:17994, 21971-21974`; faculty routes list (`app.py:9090-9402`) | Add `PanelInvitation` (Invited / Accepted / Declined) and a decline-with-reason action that raises a reschedule request. | VERIFIED |
| R16 | high | Role matrix | **Research Coordinator cannot run Panel Matching or Defense Scheduling** (HTTP 403, menu hidden) although the protocol gives panel nomination to the RC, tasks are created for "Research Coordinator", and the RC's Research Gate page shows an "Open matching" link. **Academic Coordinator** can open Panel Matching but not Defense Scheduling (403), although the walkthrough (Case 11) lists the AC as a participant. Probe confirmed all three 403s. `handle_panel_matching` accepts staff or AC only; admin is refused by `require_workflow_actor`. | `app.py:3436-3439, 17935, 18017, 8357, 17994`; `Layout.jsx:97-99`; `WorkflowPage.jsx:1590`; `probe_research.py` T6 | Owner decision: who nominates the panel and who books the schedule (protocol: RC nominates, GS office books). Then align `ROLE_TRANSACTION_ACCESS`, nav and tasks. | VERIFIED |

### 2.4 Defense scheduling, rescheduling, calendar

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R17 | critical | Availability entry | **No way to create or edit availability or working hours.** `FacultyAvailability` / `FacultyWorkingHour` rows are created only at faculty creation (Mon-Fri 8-17 default) and by demo seeders (which re-run at every startup). The faculty "My Availability" page is read-only and tells users to "ask the Graduate School office to maintain profile availability" - and the office has no screen either. | `app.py:9047, 22839, 23109`; route list (no availability route); `FacultyPortal.jsx:169-216` | Faculty availability editor + staff override; see section 4. | VERIFIED |
| R18 | high | Availability logic | Even if dated windows existed they would be **ignored on weekdays**: only weekend rows count ("Weekday rows do not narrow the recurring profile hours"). Probe: a faculty member with a dated window 09:00-10:00 on a Wednesday is still offered 08:00-17:00. There is no way to say "not available on this date". | `app.py:20375-20380, 20421-20423`; `probe_research.py` T9b | Model windows as `available` or `unavailable` exceptions layered over weekly hours. | VERIFIED |
| R19 | high | Fabricated data | `faculty_calendar_blocks` invents recurring busy events ("Graduate class", "Department meeting", "Student consultations", "Existing panel duty") from the faculty id for every faculty not connected to Google. They remove real slots in the scheduler and are **shown to staff and to the faculty member as their calendar**. `CHECKLIST_PHASE_PLAN.md` item 46 says "never present fixtures as live calendar data". | `app.py:18969-19002, 20357-20361, 22001, 19116`; `Faculty.jsx:289-372`; `probe_research.py` T9 | Remove the generator from production paths (keep behind a demo flag); use real data only (hours, teaching schedule, defenses). | VERIFIED |
| R20 | high | Panel change vs schedule | Changing the panel on the scheduling screen ("Change panel") rewrites `PanelAssignment` but leaves the existing active schedule untouched: its `panel_snapshot` still lists the old members, nothing re-checks the new member's availability or conflicts, nobody is told. Probe: chair replaced, schedule still "Scheduled" with the old chair in the snapshot. The old snapshot keeps blocking the removed person in `defense_schedule_conflicts`. | `app.py:18016-18047, 18166-18176, 20032-20050`; `probe3.py` | After a panel change, cancel or flag the schedule "Needs re-confirmation" and re-run availability; or make panel change and reschedule one action. | VERIFIED |
| R21 | medium | Reschedule | There is no Reschedule or Cancel action. A change is a second "Set defense schedule": the old row becomes `Cancelled` and the new one is `Scheduled` - **never "Rescheduled"** except after a Failed verdict. No reason is captured, nobody is notified, the old record is not linked to the new one. The walkthrough (Case 11 Part B) promises an "Edit Schedule or Reschedule action" and status "Rescheduled". | `app.py:18150-18164`; `WorkflowPage.jsx:1889-1891, 2119`; `app.py:2204-2211`; `probe_research.py` T2 | Explicit Reschedule (reason, who asked) and Cancel; `rescheduled_from_id`; notify participants. | VERIFIED |
| R22 | high | Defense type not validated | `defense_type` is taken from the request and is not compared with the student's current stage. Probe: a Title-gate student was scheduled for a **Final Defense**. A verdict then cannot be submitted (the route derives the gate from `defense_type` and finds no panel assignment -> 403), and the chair's portal hides the schedule. "Public Final Defense" is offered in both the staff and student forms but has **no gate, no panel, no verdict path** (`RESEARCH_DEFENSE_TYPES_TO_GATES.get()` returns None), so any such schedule can never be concluded. | `app.py:18051, 18155, 9344-9353, 20565-20571`; `WorkflowPage.jsx:2096`; `StudentPortal.jsx:1803`; `probe_research.py` T3, `probe3.py` | Reject a type that is not the current gate's type; either model Public Final Defense as a real stage (R30) or remove it from the dropdowns. | VERIFIED |
| R23 | high | Lead time | Title Defense lead time is **0 days**. Protocol: Form 1 is endorsed "at least 2 weeks before the scheduled defense". Closed-door final and proposal use 14 days and public final 5, which match. The lead is measured from **today**, not from the date the panel received the manuscript (the protocol's "14-Day Rule"), and the staff "lead-time override" lets the rule be bypassed. There is also no check that the chosen start time is still in the future (only the date is compared). A test pins Title lead to 0. | `app.py:21280-21286, 18087-18089, 18119-18120, 18141-18144`; `tests/test_bpm_workflows.py:4010`; protocol lines 11, 223-227 | Title lead 14 days from endorsement; store `manuscript_received_on`; compute lead from it; compare full datetime with now; remove or restrict the override. | VERIFIED (lead 0 by probe T1; past-time by code) |
| R24 | medium | Slot rules | Every defense is treated as 120 minutes, whatever the type. Working hours default 08:00-17:00 but suggestions run to 18:00 and Google-connected faculty are assumed free 08:00-18:00 on weekdays. No holiday, term-break or class-suspension calendar. The real teaching schedule (`CurriculumOffering.schedule`, free text) is not used. Venue conflicts compare the venue **text** (a generic "Zoom" blocks every other defense that says "Zoom"). | `app.py:20341, 20393-20402, 20445, 20085-20086`; `app.py:455-470` | Per-type duration; holiday table; structured rooms; link field separate from room. | VERIFIED (code) |
| R25 | high | Time zones | Google logic hard-codes UTC+8; lead-time and "today" use the server's local `date.today()`; the `.ics` feed writes floating local times with no time zone. On a UTC server, Manila mornings (00:00-07:59) are treated as the previous day. | `app.py:20213-20217, 20264, 19134-19154, 21291` | Store and compare in `Asia/Manila` (`zoneinfo`), emit `TZID` in `.ics`. | SUSPECTED (depends on host time zone) |
| R26 | medium | `.ics` feed | `/api/faculty/<id>/calendar.ics` has **no login**: anyone can read any faculty member's availability by counting ids. The feed lists availability rows only - **not the scheduled defenses** - so it is of little use. | `app.py:9396-9403, 19124-19163`; `probe_research.py` T5 (HTTP 200 anonymous) | Per-user secret token in the URL; include defenses, verdict due dates and deadlines. | VERIFIED |
| R27 | medium | Google Calendar | The consent text promises the system will "create, update, or remove official defense events"; the OAuth scope is `calendar.readonly` and no code writes events. When OAuth env vars are missing the connect button only opens a "demo-safe preview". | `app.py:9227-9235, 20145-20149`; `FacultyPortal.jsx:384-420` | Either request `calendar.events` and write events on schedule/reschedule/cancel, or change the text. | VERIFIED |
| R28 | medium | Student scheduling request | The student's "Defense Schedule" request creates only a log line and a task; there is **no record** the staff screen displays (no preferred date, no constraints). Staff must read the activity log. The form defaults to "Proposal Defense" regardless of stage, and the student's "Schedule Requests" card shows staff-created schedules (date, raw status such as "Cancelled"), with no time, type, panel or link. | `app.py:8336-8368`; `StudentPortal.jsx:1784-1821, 2022-2044`; scheduling context `app.py:16359-16420` | Persist the request (`ScheduleRequest` with status `Requested`), show it on the staff screen, show the student a proper card. | VERIFIED |
| R29 | medium | Panel chair duties | Protocol: the **chair** prepares the meeting ID/link and books the room through GS. The system has staff type the venue; the chair has no screen to add or change it. No reminder to the chair before the defense or after it (verdict is due the first working day). | `app.py:18053, 9340-9388`; protocol lines 29, 47, 153-155 | Let the chair add/confirm the link on the schedule; add "verdict overdue" state. | VERIFIED |

### 2.5 Verdicts, revisions, re-defense

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R30 | critical | Verdict "Passed with revisions" / "Deferred" | Only "Passed" completes a stage. After "Passed with revisions" (the usual outcome for minor revisions) the stage stays "Pending", graduation research is never "Complete", and the chair cannot replace the verdict (409 "already submitted", probe T4b). A task "Resolve ... verdict conditions" is created for the **student** but nothing can close it (no adviser/panel confirmation step, no Form 8). The only way out is for staff to create a second, artificial schedule so the chair can submit a new verdict. | `app.py:9360-9388, 20883-20896, 13727, 2212`; `probe_research.py` T4/T4b/T4c; protocol lines 247-255 | Model protocol outcomes: Pass / Pass with minor revisions (adviser confirms revisions -> complete) / Provisional pass with major revisions, re-defense recommended (-> re-defense loop) or not recommended (panel approves revision, 14-day rule, Form 8). | VERIFIED |
| R31 | critical | "Failed" verdict crash | A "Failed" / "For resubmission" verdict deletes the stage's evidence files, but the adviser-signature rows point at those files. With foreign keys enforced the delete fails with `IntegrityError`, the request returns an error and **the verdict is not saved**. Proposal and Final stages always have signed files, so this hits exactly the stages where the adviser signs. The same crash happens when a student deletes an adviser-signed file. The demo reset code already deletes approvals first (`app.py:18735`), which shows the dependency is known. Title-stage failure works (no signatures), which is what the walkthrough demonstrates. | `app.py:21233-21237, 7318, 801-812`; `probe2.py` ("verdict raised: IntegrityError", "verdict rows: 0") | Delete the `AdviserDocumentApproval` rows (or `ondelete="CASCADE"` / relationship cascade) before deleting evidence; wrap in a proper error response; add a test with FK enforcement on. | VERIFIED with FK on; MySQL behaviour inferred |
| R32 | high | Verdict content | The verdict is a single chair-entered result. The protocol records per-panelist comments sheets (Form 5 / 6), evaluation scores (Form 7: re-defense if below 85 thesis / 90 dissertation), the selected title (Form 2), and a consolidated result within the first working day. None of this is captured; there is no score field, no consolidated-comments upload, no date check (a verdict can be submitted **before** the defense date - probe T7). `CHECKLIST_PHASE_PLAN.md` item 48 asks for "validated supporting evaluation record". | `app.py:9340-9388`, model `1037-1053`; protocol lines 43-49, 176, 247-255 | Add verdict fields: per-panelist comments upload, score, selected title, recommendation (re-defense yes/no); reject verdicts before the defense start. | VERIFIED |
| R33 | low | Re-defense labels | Only "Failed" counts as a failed-stage retry for the "Rescheduled" label and the scheduler button text; "For resubmission" does the same reset but is treated differently. Walkthrough says the student status becomes "Resubmission Required"; the code shows "Defense Failed - Resubmit Requirements". | `app.py:18157-18158, 20972-20973`; `WorkflowPage.jsx:1889-1891` | One vocabulary (see R40). | VERIFIED |
| R34 | medium | Disapproved titles loop | Works, but by destruction: all Form 1 and concept-paper files are deleted (physical PDFs are **not** removed - the returned path list is ignored by the verdict route), endorsement revoked, panel cleared. The earlier submission is gone from the record. | `app.py:21226-21256, 9382-9384` | Mark files "Superseded" instead of deleting; keep history; delete nothing without an explicit retention rule. | VERIFIED |

### 2.6 After the defense: completion, public defense, practicum, graduation

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R35 | medium | Public final defense | Not modelled as a stage: no Form 4.3, no 5-day posting rule in a workflow, no announcement/pre-registration, no separate verdict, no enrollment-date rule (before / from Aug 2020), no research-conference proof. (Only a lead-time constant exists.) | `app.py:21284-21285`; protocol lines 315, 349-375, 439 | Add an optional stage driven by the student's enrollment date. | VERIFIED (absent) |
| R36 | low | Completion evidence | Checklist differs from the protocol list (no Ethics Clearance; Form 9/10 present). The 15% similarity limit is only a label: no SIR value is captured or checked. Co-authorship Form 4.2, payment receipts and Form 8 are absent. | `app.py:21114-21120, 20731-20736`; protocol lines 297-313 | Add a numeric SIR field with the 15% rule; add missing forms to the list. | VERIFIED |
| R37 | medium | Graduation | Research eligibility needs every gate's verdict to be exactly "Passed" (see R30), so a student with "Passed with revisions" can never be endorsed. The Dean "approve" batch action does not re-check eligibility. Practicum: the AC can record "Completed" from "Practicum In Progress" (skipping submitted documents) and `apply_practicum_payload` accepts hours and document status from the payload of any back-office role. | `app.py:13727, 12794-12803, 18304-18307, 13387-13402` | Fix R30 first; re-validate at approval; limit who may set hours/status. | VERIFIED (code) / practicum items SUSPECTED |

### 2.7 Notifications, tasks, status vocabulary, other

| ID | Sev | Process | What is wrong | Evidence | Suggested fix | Verified? |
|---|---|---|---|---|---|---|
| R38 | high | Notifications | There is **no** email, in-app notification or reminder feature. Scheduling sets "next owner = Panel Chair" only as text in a log; no task or message reaches the chair, panelists or the student. Faculty have no task list; the Work Queue is back-office only. | `app.py:18199-18210`; `grep smtplib/notify/reminder` finds nothing; `app.py:8568-8579` | Notification table + email (optional) + faculty and student inboxes; scheduled reminders. | VERIFIED |
| R39 | medium | Tasks never closed | `add_task` never de-duplicates and research/defense tasks are never marked "Done" (only LOA and standing-change tasks are). Each upload adds "Review submitted ..." tasks; completed work becomes "overdue" and feeds the Recommendations queue as escalations. | `app.py:16697-16707, 7594, 17633`; `grep "Done"` | Close tasks when the owning step completes; use `ensure_task`. | VERIFIED |
| R40 | medium | Status vocabulary | Schedule statuses actually produced: Scheduled, Rescheduled, Cancelled, Failed (plus legacy Confirmed). "Needs Availability" / "Pending scheduling" are **never set**, so the dashboard "awaiting availability" count is always 0. A finished defense stays "Scheduled" forever (only the display says "Finished"), so the "Confirmed defenses" KPI counts past defenses. The dashboard drill-down shows the student's **current gate** as the defense type and omits the time. Verdict words (Passed/Passed with revisions/Deferred/Failed/For resubmission) are not the protocol words. | `app.py:20028-20029, 12993-12994, 13153-13185, 2195-2244` | One status set: Requested, Proposed, Confirmed, Rescheduled, Cancelled, Held, Verdict submitted; derive KPI from it. | VERIFIED |
| R41 | high | Security (outside this area but on the faculty path) | Every app start resets **every faculty password to `DemoPass123!`** and re-seeds demo availability windows and expertise. A password a faculty member or staff member chose is lost at the next restart. | `app.py:25056, 25176-25201, 23065-23125` | Reset only for seeded demo accounts, only in demo mode (also D5 in `DEFENSE_REVISIONS.md`). | VERIFIED (code) |
| R42 | low | UI | Mojibake `â€“` in the faculty calendar event time; RC sees an "Open matching" link to a page RC cannot use; the Research Gate description text says results are "Recorded by GS Staff" while only the chair may submit. | `FacultyPortal.jsx:193`; `WorkflowPage.jsx:1590`; `app.py:20635-20640` | Text fixes. | VERIFIED |
| R43 | low | Score saturation | Known already (D1): top panel candidates all hit the 50-point specialization cap and are ordered by availability slot count. | `app.py:22043-22052` | See `DEFENSE_REVISIONS.md` D1. | VERIFIED (code) |

---

## 3. Walkthrough says, code does not

| Walkthrough | Reality |
|---|---|
| Case 11 Part B: "Select the available **Edit Schedule or Reschedule** action"; status changes to **Rescheduled** | No such button; the same "Set defense schedule" is used; status is "Scheduled" (old row "Cancelled"). R21 |
| Case 11 accounts: Academic Coordinator takes part in scheduling | AC gets 403 on Defense Scheduling. R16 |
| Case 11 Part D: student status becomes "**Resubmission Required**" | Shows "Defense Failed - Resubmit Requirements". R33 |
| Case 12 (proposal): the same Part D failure path applies | A Failed proposal verdict crashes once the adviser has signed, on a foreign-key-enforcing database. R31 |
| Case 12 Step 5: student uploads Form 5.2 ethics clearance **before** proposal defense | Matches the code, contradicts the protocol order. R07 |
| Case 10 order: verify -> AC endorses -> panel matching | Order is not enforced; matching works without endorsement. R06 |
| Case 11 Step 18: "Review the panelists' updated availability" | Availability is the default 8-17 schedule minus invented blocks; nobody can update it. R17, R19 |
| Case 10/12: "Adviser's assigned account" | Only seeded students have one; there is no way to assign. R01 |
| Case 13: passing verdict -> five completion documents | "Passed with revisions" blocks this. R30 |
| Faculty calendar consent screen: system creates/updates/removes defense events | Read-only scope, no write code. R27 |

---

## 4. Requirements: calendar and appointment experience

### 4.1 Principles
- One source of truth for time: a defense is a `ScheduleRequest`; availability is faculty
  weekly hours plus dated exceptions; deadlines are computed from defense dates and form dates.
  Every calendar view is a projection of those, so nothing is typed twice.
- No invented data. If a faculty member has not entered availability, say "not entered" and
  do not treat it as free.
- Every change to a schedule has a reason, an actor, a timestamp, and sends a notification.
- All times stored with `Asia/Manila` and shown with the zone.

### 4.2 Graduate School staff (and Research Coordinator)
1. **Calendar page** (month / week / agenda toggle) of all defenses, colour-coded by stage
   (Title, Proposal, Final, Public) and status (Requested, Proposed, Confirmed, Rescheduled,
   Cancelled, Held, Verdict overdue). Filters: program, stage, panelist/adviser, venue, status.
2. **Deadline overlay** on the same calendar: Form 1 due 14 days before; manuscript to
   panel 14 days before; Form 4.3 five days before a public defense; verdict and Form 5/6/7
   due first working day after; ethics application within one month after proposal defense;
   Form 3.2/3.3 within 5 days of Form 3.1; fee receipt first working day after.
3. **Conflict warnings** at the moment of choosing a slot: panelist already booked, adviser
   booked, room/link booked, slot in the past, before lead time, on a holiday/term break,
   outside a panelist's hours, a panelist who has not entered availability. Hard conflicts
   block; soft ones need a reason.
4. **Request availability**: from a student's scheduling screen, send an availability request
   to the panel (they answer with dates) instead of guessing; show who has answered.
5. **Reschedule / cancel dialog**: choose new slot, reason (panelist unavailable, student
   request, room, other), who requested it; old record stays linked ("rescheduled from #12");
   notifies student, adviser, panel; updates the `.ics`/Google events.
6. **Panel change after scheduling** forces a re-confirmation (see R20) rather than silently
   keeping the old snapshot.
7. **Room/venue view**: bookings per room per day, link field separate from room.
8. **Overdue list**: defenses past their date without a verdict; schedules without a
   confirmed venue/link three days before.
9. **Printable/exportable** weekly schedule and the public-defense announcement.
10. Research Coordinator additionally owns: panel nomination queue, panel invitations and
    responses, adviser appointment queue (below).

### 4.3 Adviser and panelist (Faculty Portal)
1. **Availability editor**: weekly hours; add specific dates as *available* or *not
   available* (vacation, travel); bulk "unavailable from-to"; visible "last updated".
2. **My calendar** (week/month): defenses as chair / member / external / adviser, deadlines
   for their advisees, the availability layer, and Google busy blocks when connected.
3. **Invitations**: Accept / Decline (reason) for panel seats; declining raises a
   reschedule/replacement request to the coordinator automatically.
4. **"Cannot attend" button** on a confirmed defense -> reschedule request with reason.
5. **Adviser appointment**: list of advisee requests awaiting acceptance (Form 3.1), an
   "advisees n of 5" meter, advising-contract (Form 3.2/3.3) status per advisee; Sign /
   Return-with-comments on manuscripts; propose defense dates with the student (this is the
   protocol's "student and adviser agree the schedule").
6. **Chair tools**: add/confirm meeting link and room; "verdict due" countdown; submit verdict
   with per-panelist comments, score and recommendation; consolidated comments upload.
7. **Subscribe**: per-user private `.ics` URL (secret token) containing defenses, deadlines
   and verdict-due items; optional Google write-back with `calendar.events` scope.

### 4.4 Academic Coordinator
1. Form 1 endorsement queue with Sign / Return and a **recommended panel set** field.
2. "Noting" step for adviser applications (Form 3) with a short note to the RC.
3. Calendar filtered to the AC's programs.

### 4.5 Student
1. **My research calendar**: upcoming defense (date, start-end, venue/link, panel with roles,
   mode), countdown, and next deadlines ("send manuscript to panel by ..., 14-day rule").
2. **Request a schedule** with structured preferred dates and constraints; status visible
   (Requested -> Proposed -> Confirmed). Staff see the same record.
3. **Adviser tracker**: Form 3 submitted -> AC noted -> under Dean deliberation -> appointed
   (name, date) -> Form 3.2/3.3 due in 5 days. Buttons: request change of adviser (once),
   request change of title (once).
4. **Add to calendar** (single-event `.ics` download) for every confirmed defense.
5. **Reschedule notices** with the reason and old vs new time; in-app badge plus email.

### 4.6 Reminders (in-app + optional email)
T-14 days (manuscript sent to panel?), T-7, T-2, T-1 to student, adviser, panel; day-of summary
to staff; first-working-day verdict and fee-receipt reminders; panelist with no availability
entered within X days of being invited; adviser signature waiting more than N days; ethics
application due. All from one `Notification` table with `kind`, `due_on`, `sent_at`, `read_at`.

### 4.7 Additive data model (works on SQLite and MySQL)
- `AdviserAppointment`: student, faculty, status (Applied, Noted by AC, Under deliberation,
  Appointed, Accepted, Declined, Ended), form3/form31 dates, approver names and dates,
  `ended_at`, `end_reason`, `change_count`.
- `FacultyAvailabilityException`: faculty, date or range, start/end, kind (`available` or
  `unavailable`), note. Keep `FacultyWorkingHour` (make it editable).
- `PanelInvitation`: assignment, status (Invited, Accepted, Declined, Recused), `responded_at`, reason.
- `ScheduleRequest` new columns: `status` vocabulary extended, `reason`, `rescheduled_from_id`,
  `cancelled_by`, `meeting_link`, `manuscript_received_on`, `requested_by` (student/staff),
  `student_preferred_dates` (JSON), `timezone`.
- `Notification`: user, kind, related object, `due_on`, `sent_at`, `read_at`.
- `CalendarToken`: user, secret, created/revoked (for the private feed).

### 4.8 What already exists and can be reused
| Piece | Where | Reuse |
|---|---|---|
| Weekly 7-day grid with hour blocks and "Today / prev / next" | `Faculty.jsx:289-372` (`WeeklyCalendar`) | Base for the faculty and staff week view; add defense events and remove the invented blocks. |
| Availability overlap matrix and "Best shared options" | `WorkflowPage.jsx:2127-2368` (`AvailabilityWorkspace`) | Keep inside the reschedule dialog. |
| Common-slot engine, conflict checker, lead-time helper | `app.py:20336-20539` (`defense_availability_context`), `20053-20094`, `21280-21291` | Keep; change inputs (real availability) and add time-of-day and holiday checks. |
| Google Calendar free/busy read, per-faculty OAuth, token refresh | `app.py:20097-20333, 9210-9298`; `FacultyPortal.jsx` connect card | Keep; add write scope only if the owner wants events created. |
| `.ics` generator | `app.py:19124-19163` | Extend with defenses, `TZID`, token URL. |
| Schedule history list | `WorkflowPage.jsx:2370-2390` | Reuse as the audit trail in the new dialog. |
| Faculty portal shell, panel cards, verdict form | `FacultyPortal.jsx`, `FacultyResearchWorkspace.jsx` | Add Calendar, Availability, Invitations tabs. |
| Task + transaction log + workflow messages | `Task`, `TransactionLog`, `WorkflowMessage` | Use for requests and returns (adviser change, title change); notifications table sits beside. |
| Dashboard schedule drill-down | `app.py:13153-13185` | Feed the agenda view once statuses are fixed (R40). |

### 4.9 Suggested build order
1. Stop the damage: R31 (verdict crash), R30 (minor-revision outcome), R22 (validate type).
2. R17/R18/R19: availability editor, exceptions, remove invented blocks.
3. R01/R02/R03: adviser appointment (with the AC/RC/Dean steps the protocol lists).
4. Reschedule/cancel with reason, links, stale-snapshot fix (R20, R21), student request record (R28).
5. Calendar pages for staff, faculty and student, then reminders and private `.ics` (R26, R38).
6. Panel invitations and declines (R15); protocol fixes to panel size, ethics order, lead time.
7. Optional: Google write-back, public-defense stage.

### 4.10 Decisions the owner must make first (do not guess)
- D7: panel size for project paper; is the adviser in addition to the panel (protocol says yes).
- Who nominates the panel (RC per protocol) and who books the schedule (GS office per protocol).
- Ethics clearance before or after the proposal defense (protocol: after).
- Whether the public final defense is in scope for the demo.
- Whether email sending is available (SMTP), otherwise in-app notifications only.

---

## 5. Not checked
- No browser run of the React screens; UI findings are from reading the JSX.
- MySQL itself was not run (R31 was reproduced with SQLite foreign keys on).
- Google OAuth and Gemini calls were not exercised.
- Program-specific rules (which programs write a project paper vs thesis) were not checked against the handbook.
- Probe scripts: `E:/Temp/claude/probe_research.py`, `probe2.py`, `probe3.py` (temporary SQLite only).
