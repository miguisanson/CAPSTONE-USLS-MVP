# State

## 2026-11-04 evening - Demo Guide autopilot (packet `pkt/autopilot`, worktree `CAPSTONE-USLS-MVP-wt/kauto`, branch from v6.2-migui; not merged, not pushed)

- A started demo (sign-in "Start a guided demo" or a demo picked in the panel) locks into a slideshow bar: Back / **Next** / Take over /
  Stop, "Step n of N", progress bar, `aria-live` caption. Next signs in as the step's person when needed, opens the page, plays the
  step's `actions` (fake cursor, ring, typed text, click-shield), asks `/api/demo/guide-state` and only then moves on. Take over / Esc
  hands the page back; Next carries on from the step the record shows. Code: `frontend/src/lib/demoGuide/{autopilot,useAutopilot}.js`,
  `components/DemoAutopilotBar.jsx`, `components/DemoGuide.jsx`; one file per guide in `lib/demoGuide/guides/`.
- All 8 guides have `actions` (main path from the `case_*.py` capture scripts; return/deny side steps get a plain resend or a pause).
  Spec `frontend/e2e/p115-autopilot.spec.js` plays each guide from the sign-in page to the last step and reads the final record.
  p115 has its own Playwright project (`autopilot`, after `sweep`, `section-j`, `pages`) because it shares demo students with p32,
  p114 and section-j (see `e2e/DATA-OWNERSHIP.md`).
- Monitoring Sheet autopilot adds a NEW student each run (`{stamp}` = time of day in the Student ID and last name), so reruns work.
- Not tested: the return/deny branch actions (resend, denied) and the Hours Incomplete detour of Practicum (autopilot takes the
  200-hours path).

**Current branch: `v6.2-migui`** (made 2026-11-04 13:3x from `v6.1-migui` 9bf95ac, identical code). Natalie works here: `git fetch` then `git switch v6.2-migui`, `npm run seed` once, `/continue_CAPSTONE-USLS-MVP`.

## 2026-11-04 evening - edit anything, with history (packet `pkt/edit-history`, worktree `CAPSTONE-USLS-MVP-wt/kedit`; not pushed)

**Reseed after pull** (`npm run seed`; IM4): new table `RecordEdit`, new columns `AwolCase.dean_remarks`, `WithdrawalApplication.dean_remarks`
(the Dean's note is no longer glued into `staff_notes` / `staff_remarks` as "Dean: ...").
- Backend: `PATCH/GET /api/edits/<entity>/<id>`, one whitelist `editable_map()` in `app.py` (who / until / validate per field);
  payloads carry `edits` / `edit` references (`record_edit_info`, `record_edit_ref`, `attach_row_edits`). The edited column is updated in
  place (every reader sees it); `RecordEdit` keeps old/new/who/when/why; copies of a sentence in the activity log or another message keep
  what was said then. Test: `tests/test_record_edits.py` (17).
- Frontend: `components/ui/EditableText.jsx` (Edit button, Edited chip, history window), used in `WorkflowDiscussion` (every chat), the leave
  case window and Dean view, student cards, `ProcessGates`, verdicts, adviser notes, practicum. Spec `frontend/e2e/p116-edit-history.spec.js`.
- Left: item 5 (change a decision itself: approve/deny/return) not built; research-gate and graduation screens only get the chat edit; AWOL
  return fields editable in the API and in the case window but not on a student card; `LeaveCaseEvent` comments editable on the Dean view only.

## 2026-11-04 13:25 — demo videos re-recorded (session "redo videos"; not committed)

- `scripts/demo/narration.json`: every line rewritten as plain spoken English with linking phrases ("Here we have…",
  "Next, we have…", an opener per video); no "cohort". The Demo Guide reads the same file.
- All six videos re-recorded on the current code (0 failed steps) into `Documents/Capstone/Meeting_2026-11-04/videos/`;
  `.srt`, `.timeline.json`, `NARRATION-SCRIPT.docx/.pdf` rebuilt. The `-FINAL.mp4` files are the owner's OLD voice-overs
  and are stale; the owner records new audio from the new `.srt`.
- Recording needs `PYTHONIOENCODING=utf-8` when output goes to a file (capture cases print arrows; cp1252 crashes).
- 14:00: owner narrates ONE take. `videos/` now holds `Full-Demo.mp4` (six parts joined, 0.4 s fade at each join,
  durations unchanged) + `Full-Demo.srt` + `NARRATION-SCRIPT` with full-video times; the parts live in `videos/Parts/`,
  the morning voice-overs in `videos/Archive/`. Rebuild: `build_narration.py --videos <videos>/Parts --full ../Full-Demo`
  (times use each part's real mp4 length). mp4s stay gitignored (`videos/**/*.mp4`).

## 2026-11-04 ~16:00 — build loop queue (session "known-data"; owner: "DO NOT STOP BUILDING, keep improving and polishing")

Landed on v6.2-migui: autopilot slideshow (59d0c61), manual fields round 2 (da83ef6), edit anything with history
(b6b81c3, RecordEdit table -> `npm run seed` after pull). Changelog: `.planning/CHANGELOG-2026-11-04.md`.
Running: `pkt/server-checks` (wt/kserver, owns app.py: one 7-digit student ID everywhere I-353 + server checks for the
new dropdowns), `pkt/ui-polish` (wt/kpolish: colours + legend I-358, LOA card I-356, enrollment banner I-355, Reports
by year started I-357), `pkt/khloe-ui` (wt/kkhloe: Khloe's graduation + practicum batch UI I-359, design rules in
`.planning/khloe-ui/COMPARE.md`). Main checkout (uncommitted until its tests pass): Demo Guide `>`/Right arrow run the step,
panel collapsed in the slideshow, no half mode (DemoGuide.jsx, prefs.js, p114, p115).
Queue after those: I-361 staff act for the panel + I-362 research gate stage columns (needs app.py, after server-checks);
I-360 Khloe design on LOA/readmission/AWOL/withdrawal/residency (after khloe-ui); Demo Guide guides for the missing
processes; full gate, push, Docker rebuild (restart tunnel on 1033), final report in the changelog.

## 2026-11-04 afternoon — known-data rule, process audit, Demo Guide (session "known-data"; pushed to v6.1-migui)

**For Natalie (next session): start with `/continue_CAPSTONE-USLS-MVP`, then read this block.**
**After `git pull` run `npm run seed` once** (two new columns today: `ResidencyEnrollment.prior_enrollment_tag`,
`DefenseVerdict.title_before_verdict`; IM4, no ALTER patches). The live site was rebuilt and reseeded at ~12:50.

- Owner rules today: "never make a user type, pick or tick something the system already knows or can check" and
  "if it can be automatic let it be automatic".
- Known-data sweep I-242..I-263: all fixed except I-254 (LOA extension start, RequestForms) and the questions I-248, I-252.
  Readmission now follows Handbook p. 45 (system: "Written intention to enroll", "Evaluation of subject/grade
  requirements"; staff: "Clearance from Business Office", "Interview (reason for delay, residency requirements)").
- **Process audit** (workflow `process-audit`: 6 auditor groups + adversarial verifiers): 93 findings, 88 confirmed,
  logged as **I-264..I-351** in ISSUES.md (class/severity/evidence per row; owner questions marked `question`).
  24 fixed today (server P1/P2: graduation route trusted client registrar_status/dean_remarks, Dean single decision
  without status check, seed calendar, failed subject passing readmission evaluation, residency term/tag, AWOL task
  and re-forward, reschedule keeping venue, title verdict correction; docs/capture-script drift; I-330 token guard).
  **Open queue, highest first:** I-336 (bell links to pages the role cannot open), I-341 (guide-state readable by
  faculty for any student), records-03 row (monitoring edit can set Withdrawn/Dropped/Completed outside the workflow),
  leave-02 (gap semesters after a leave pass), leave-07 (date-driven moves only on a refresh button -> automate),
  research2-01 (practicum hours/status from back-office payload), research1-02 (generic upload bypasses gate rules),
  research1-04 (student schedule request retyped by staff), research2-06 (no notice when a verdict is recorded),
  coverage-03/04 (Docker reset/update by hand; stale demo data warning), cross-07/08 (home numbers vs lists, assistant counts),
  I-352 (after a Docker rebuild the tunnel may need `docker compose --profile tunnel restart tunnel`; check https://miguisanson.dev/api/health).
- **Demo Guide** (in-app tutorial, demo mode only, off by default per browser; sign-in switch "Show the Demo guide"):
  design `.planning/demo-guide/DESIGN.md`, server `GET /api/demo/guide-state` (`tests/test_demo_guide.py`),
  UI `frontend/src/components/DemoGuide.jsx` + `frontend/src/lib/demoGuide/` (8 guides: LOA, Readmission, AWOL,
  Monitoring Sheet, Reports, Withdrawal, Practicum, Graduation), spec p114 (owns demo student Therese).
  Follows the live record, so off-script panel requests resync with "Continue from here".
- Automated today: Playwright finds `E:/DevCache/ms-playwright` by itself (playwright.config.js); Docker web build
  copies `scripts/demo/narration.json` (the guide imports it); test guards the tunnel token placeholder.
- Gates: full Python gate on 0e7d623 = 1025 tests, only I-236 `test_teaching_schedule` failing (+ one test fixed);
  after the audit merge a broad targeted set was run (see the commit message of the last commit); build + check:ui 0;
  e2e p114/p21/p81/p88/p113/p42 139 passed. Full e2e suite NOT run today.
- Process note: the audit workflow ran 2 agents while 2 helpers ran (4 at once for ~20 min, over the 3-helper limit).
- Not done: demo videos not re-recorded; walkthrough screenshots not recaptured; forms pack GS-F-08 still lists
  the old platform checks (Forms Q23); capture scripts for cases 06/16/17 follow the old booking flow.

## Demo-day date waits skipped — 2026-11-04 (NOT committed)

- New switch `demo_skip_date_waits()` (`app.py`, `DEMO_SKIP_DATE_WAITS`, default ON, needs DEMO_MODE). While on:
  the Panel Chair/Lead can record a verdict before the booked defense date (faculty context + verdict API), and
  staff can confirm AWOL before the leave end + grace period. Leave start / return due already had manual buttons.
- Tests: `test_research_core` 2 new (demo skips; DEMO_MODE=0 or DEMO_SKIP_DATE_WAITS=0 still waits),
  `test_loa_readmission` 1 new + the I-165 test now pins DEMO_SKIP_DATE_WAITS=0. Targeted 58/58 OK; live API on
  5050 shows Nov 10/23 defenses submittable. Docs: README, .env.example, walkthrough case 16_verdicts.json
  (manual not regenerated).
- Then: global **"Skip date waits"** switch on the sign-in page (demo mode only, default ON, every account):
  `POST /api/auth/demo-settings {skip_date_waits}`, `/api/auth/config` reports it; kept in memory (`DEMO_RUNTIME`),
  restart = env default. Test `test_health` ...switches_the_demo_date_waits_for_everyone. Checked live on 5050.
  Lead time before a defense is only a soft warning (override with reason), so it was left alone.
- Fixed in passing: `frontend/src/components/ui/PageHeader.jsx` was saved as cp1252 (byte 0xb7 in a comment,
  commit 64ab255) and broke `test_login_page_source_carries_no_password...`; now UTF-8.
- RAG checked on this PC: `/api/assistant` answers with a handbook citation in 1.3 s. Natalie's "RAG not working"
  is not reproduced here; her `.env` key / `.rag_index` are local to her PC (both gitignored).
- Committed + pushed as 736803b on v6.1-migui (on top of a337357). Full Python suite was still running when the
  owner restarted the PC (10:1x): re-run it. Assistant also answers with GOOGLE_API_KEY=off (document-rag-local).
  Next: the site goes on miguisanson.dev via Docker (other session); Natalie must pull v6.1-migui.

## FINAL 2026-11-04 09:10 — all sessions merged and pushed (v6.1-migui @ 21f92b5)

- Merged: night1-13 fixes, Myrine's teaching schedule, pkt/forms-ops (60 forms in chapter folders, Ops Manual 113 pp,
  privacy consent), Documents reorganised (Documents/README.md), two Fable reviews with fixes.
- Gates on a0ca1de: e2e 822 passed / 3 failed (p110, p84:373 = I-236 base code; p79 flaky, passes alone 8/8);
  targeted Python (forms_pack, ops manual, privacy, policy docs, health, panel matching) OK; build + check:ui strict 0.
  Full Python gate was still running at 09:10 when the owner closed the session: re-run it first next session.
- Demo DB reseeded 08:5x (148 students); .rag_index rebuilt. Site is OFF: start with deploy/START-SITE.cmd.
- Leftover: wt/fdocs locked (remove after reboot, rmdir its node_modules junction first). Open: I-236, I-240, I-241,
  I-218 (smarter assistant reminder), forms GS-F-10/42 declaration on p.2, GS-P-02 lacks GS-P-03..06 rows, LOA Dean
  narration ~10 s behind, AWOL card shows "Demo", UAT length untimed.

## Documents reorganised + Fable review fixes — 2026-11-04 08:20 (session cb21b273, NOT committed)

- Fable review of meeting deliverables: report kept in the session scratchpad (REVIEW.md). Fixed here: UAT (P1+P2,
  98 items, K1-K8), narration (no pronouns, re-intros, off-screen claims; builder supports `<part>:signin:<role>:2`),
  2l video trimmed to 4:19, both cheat sheets, README-FOR-MIGUI. Forms findings fixed on `pkt/forms-ops` (forms session, unmerged).
- Documents/ moved (git mv, nothing deleted): Demo_Migui -> Meeting_2026-11-04, CAPSTONE_ONLY/UAT -> UAT, proposal
  papers -> Capstone_Papers, walkthrough + screenshots -> Walkthrough, CAPRIT2 OLD + Stakeholder_Meeting_Prep -> Archive.
  CAPSTONE_ONLY keeps only what app.py/tests read (USLS_Documents, Ops Manual, operations_manual_rules.json).
  Map: Documents/README.md. References updated (scripts, AGENTS/CLAUDE.md, .gitignore, .dockerignore).
  tests.test_policy_documents + test_operations_manual_content 56 OK. Owner commits.
## Forms x Operations Manual — 2026-11-04 (built, NOT on v6.1-migui; owner checks first)

All work is on branch `pkt/forms-ops` (worktree `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/forms`), merged from
`pkt/fdocs`, `pkt/fman`, `pkt/fapp` (helper worktrees wt/fdocs, wt/fman, wt/fapp — already merged, can be removed;
**first delete the `frontend/node_modules` junction with `cmd /c rmdir frontend
ode_modules`** in wt/fapp and
wt/forms so a worktree removal can never touch the main checkout's node_modules). Contract: `.planning/forms-ops/CONTRACT.md`.

**Where everything is (after merge, same paths on v6.1-migui):**
- Forms pack: `Documents/USLS_Forms/` — `0 Forms Control` (GS-P-01/02), `4.01 …` to `4.19 …` (one folder per
  Operations Manual chapter, .docx + .pdf side by side), `Platform Basis` (GS-P-03..06, GS-F-45..48),
  `Supplementary Forms` (GS-F-49..54). Print pack `Documents/USLS_Forms/USLS-GS-Forms-Pack.pdf` (108 pages).
  Inventory + open questions (1-47): `Documents/USLS_Forms/00-INVENTORY.md`. Build: `scripts/docs/forms/build_forms.py`,
  `scripts/docs/forms/build_pack.py` (docs venv `E:/Temp/claude/docs-venv`, LibreOffice `E:/LibreOffice`).
- Operations Manual (same files in `Documents/CAPSTONE_ONLY/`): chapters 4.20-4.24 (FAC, ACC, EAP, PRV, DEX; all
  Proposed), each chapter lists its GS codes, Appendix A = crosswalk of all 60 codes, OQ-45..50 new, OQ-27 honoraria
  envelope note (FO6), change log 0.2.1. 113 pages (was 91).
- App: privacy notice at first sign-in (`pages/PrivacyConsent.jsx`, `POST /api/auth/privacy-consent`, two new
  `UserAccount` columns; seeded accounts pre-accepted), form line on process pages (`lib/formRefs.js` via
  `PageHeader forms=`), e-approval note (`components/ui/EApprovalNote.jsx`, in `DecisionPanel`/`StepDialog`).
- Codes: GS-F-01..44 and GS-P-01/02 unchanged (numbers and titles). New: GS-P-03..06, GS-F-45..54.

**Checks done:** tests.test_forms_pack 10/10; tests.test_operations_manual_content 24 OK (+ policy_documents, health,
crosscut, polish OK); test_privacy_consent(+_seed), seed_determinism, demo_password OK; build:web ok; check:ui:strict 0;
e2e p112 43 passed; helper's full e2e 822 passed / 3 failed (p110, p84 line 373, p79 — p110 fails the same on the
base code: Course Adjustments has no "Schedule" tab; p79 passes alone). Full Python gate: NOT finished when the forms
session closed at 08:30 (1 E seen mid-run, unidentified; log E:/Temp/claude/rev-shots/gate.txt) — the leader runs it on the merged commit.
**Leader = "Session progress report" session** (owner, 2026-11-04); the forms session handed over and closed. Checklist:
`.planning/forms-ops/MERGE-CHECKLIST.md`.
Fable P1 forms findings all fixed; P2/P3 mostly fixed; left: declaration line on page 2 of GS-F-10 and GS-F-42, some P3 polish.

**To land (owner OK given; after the 2026-11-04 meeting):** `git fetch` + merge origin first (Myrine pushes to v6.1),
merge `pkt/forms-ops` into v6.1-migui, run the gate, then reseed + restart the live site (new UserAccount columns need
the reseed; IM4 — no ALTER patches). Tell the "Session progress report" session the final code list (it rebuilds
`Documents/CAPSTONE_ONLY/Demo_Migui/ZOOM-CHEAT-SHEET`). Also update `scripts/demo/build_cheat_sheet.py` /
README-FOR-MIGUI if they cite "44 forms".

## Merge recovery — 2026-11-04 (current)

- Merging origin v6.1-migui a22916c into local 3131fcf. Five conflicts resolved
  by retaining both ignore rules and all planning entries; faculty roster uses the
  incoming equivalent shared helper rather than duplicate local filtering.
- Incoming decision IDs IM34–37 retained; local teaching decisions now IM38–41.
  Incoming issues I219–225 retained; local I219–226 now I226–233.
  Incoming R021 retained; local R021–25 now R022–26.
- Latest owner corrections have been restored from GitHub Desktop stash@{0};
  the stash remains intact as a safety copy. Backup refs and original conflicts/patch at ignored
  frontend/e2e-artifacts/merge-recovery/. Do not drop stash or push.
- Merge commit: 8103c5c. Local follow-up also retains Save all, schedule availability
  filtering, no Sunday choices, clean labels, and no extra confirmation warning.
  Stash-only issue I227 is now I234; stash-only regression R026 is now R027.
- Combined Python syntax checks and frontend production build PASS; no additional
  tests per owner. All conflict markers removed. Final local follow-up commit
  includes restored owner corrections and this record. No push. Incoming
  improvements, forms, Docker/deployment and assistant fixes retained.
- Next: owner may Push origin in GitHub Desktop. Do not reapply stash@{0}: it has
  already been recovered and is retained only as a backup.

## Faculty availability confirmation correction — 2026-11-04

- Removed the misleading semester-confirmation warning for saved recurring Faculty
  profile hours. Those hours are valid input for offering dropdowns; coordinator
  does not need to submit or confirm them again. No data copied or re-stamped.
- Missing-hours and actual conflict warnings remain. Separate submitted semester
  teaching windows retain precedence when present; this change adds no workflow.
- Backend-only change in teaching_backend.py. Syntax compilation passed; no tests
  per owner. Restart app to load the fix; frontend bundle unchanged.

## Offering save-all / conflicts — 2026-11-04

- Implemented: owner requested one Save button and duplicate/overlap error handling.
- Replaced row saves with Save all changes; sends dirty rows to one transaction at
  PATCH /api/course-offerings/bulk. Retains edits on failure. Add/remove preserves
  edits in other rows; switching filters asks before discarding edits.
- UI checks pending same-faculty overlap and a 15-minute transition gap, names both
  subjects inline and above the table, blocks Save until resolved.
- Backend validates the complete final pending state against saved offerings across
  programs, for same faculty or confirmed shared students. Bulk rejects atomically;
  old single-row PATCH also uses this validator. Different faculty with no shared
  enrolled students may teach at the same time.
- Backend syntax compilation and frontend build passed; diff whitespace check passed.
  No automated tests per owner. Next: restart app and review Offering setup.
  Files: app.py, teaching_backend.py, frontend/src/api.js,
  frontend/src/pages/CourseOfferings.jsx and TeachingSchedule.jsx. Work remains local
  on v6.1-migui together with the preceding scope corrections; no push or merge.

## Strict schedule choices — 2026-11-04

- Owner clarified: option labels only meeting days/times, no recommendation wording
  or break prose. Top three keep visual emphasis via option classes.
- With recorded faculty hours, return only slots whose complete meetings fit those
  days/times; single-day blocks must also cover the internal break. No Sunday slots.
  Saturday appears only when explicitly available (or unknown availability).
- Unknown availability retains Mon–Sat selection/caution per earlier owner request.
- Old saved out-of-range choices no longer reinserted into dropdown; caution below
  asks to replace them. Legacy labels remain recognized for conflict checking.
- No automated tests per owner. Backend syntax compilation passed; frontend rebuilt.
  Next: owner review after restarting the app and hard-refreshing.

## Availability / dropdown correction — 2026-11-04

- Profile showed FacultyWorkingHour rows while the dropdown only checked Submitted
  TeachingAvailability for the selected term. This explains the conflicting labels;
  Liwayway's live database was not inspected or changed.
- Options prefer submitted semester teaching hours, otherwise read the same recurring
  hours as the profile as a reference (never mark them semester-confirmed). Missing
  availability does not disable selecting a slot. Known class/defense conflicts remain
  disabled; only valid candidates receive up to three recommendation labels.
- Removed availability/reason text from option labels. A warning below the dropdown
  appears only after selecting a slot, explaining missing/profile/outside-hours cases.
- No tests per owner. Next: frontend build, restart app for backend changes, owner review.

## Owner scope correction — 2026-11-04

- Owner wants only faculty teaching availability and offering-row schedule suggestions.
- Removed Semester class schedule, Faculty submissions, draft/revision/approval/publication
  controls and Keep workflow from Offering setup. Dropdown now loads read-only candidates
  directly, saves through the existing row Save, and does not require a timetable plan.
- Both paired 90-minute and same-day two 90-minute sessions / 15-minute break appear.
  Up to three valid choices marked Recommended; every generated slot remains visible,
  unavailable ones disabled with reasons. Submitted faculty hours and known conflicts
  determine validity. No Google Calendar teaching integration added.
- Existing backend timetable models/routes remain for compatibility, unused by this UI.
  Legacy custom free-text schedules cannot be reliably checked as structured conflicts.
- No further tests per owner. Frontend build passed.
- Dropdown follow-up: an older running backend returns the prior timetable payload
  without options, which the UI silently treated as an empty list. Added explicit
  restart guidance for that response. App restart is required for the new options
  handler; do not claim the live backend was restarted or verified.
- Next: restart app and owner review of Offering setup dropdown.

## Forms x Ops app wiring (branch pkt/fapp, worktree CAPSTONE-USLS-MVP-wt/fapp, 2026-11-04)

Done, not merged: privacy consent (GS-P-04) backend + PrivacyConsent page, seeded accounts pre-accepted, lib/formRefs.js + PageHeader `forms`, EApprovalNote in DecisionPanel and faculty decisions, e2e p112. Full e2e: 822 passed, 3 failed (p110, p84 offering setup, p79 pictures flaked in the shared run; p110 and p84 still fail alone and look unrelated: they expect a Course Adjustments Schedule tab / Save button that the page does not have).

## Packet khloe-ui (2026-11-04, branch `pkt/khloe-ui`, worktree `CAPSTONE-USLS-MVP-wt/kkhloe`)

- Khloe's Graduation Endorsement and Practicum layout restored on today's API. Shared pieces: `frontend/src/components/process/`
  (StageCheck, StageCheckStrip, RequirementBoxes, StageColumnHeader, GroupCard, MemberList, GroupOverview, CaseCard parts,
  ProcessScopeNote). Notes and design rules: `.planning/khloe-ui/COMPARE.md`. Test: `frontend/e2e/p119-khloe-graduation-practicum.spec.js`.
- Next packet: apply the same pieces to LOA, readmission, AWOL, withdrawal, residency (Practicum columns stay 248 px until the
  Withdrawal board moves too: p78 I-089 pins equal widths).

## Current Position — 2026-11-04: owner-requested teaching scheduling

- **Branch:** `v6.1-migui`. Local commits `e7d7176` (Dean review context) and
  `3131fcf` (semester teaching availability/timetables). No push or merge.
- **Implemented:** faculty Schedule calendar by semester, separate from defense
  availability; copy/confirmation; paired and explicit single-day options;
  whole-semester recommendations, durable manual pins, coordinator-only approval
  and publication, immutable revisions, personal published views and notifications.
  Rooms remain unchanged. Usage and limitations: `TEACHING_SCHEDULE.md`.
- **Verified:** current focused backend/engine/roster suite 34 PASS; two final
  publication/error-message cases PASS; real faculty → coordinator → student
  walkthrough PASS including Keep/release; seven role sweeps PASS (faculty rerun
  after the discovered roster-list fix), sidebar/new UI checks PASS; build PASS;
  strict UI all zero; negative control failed as intended with six injected issues.
  All three screen widths opened and reviewed for the new pages.
- **Demo:** standard seed rebuilt the local disposable DB and startup schema smoke
  passed. Teaching submissions start unknown. Restart the existing app process to
  load the new routes; it does not auto-reload. Seed fingerprint recorded below.
- **Stopped on owner instruction:** full Python suite, exec session `99914`, output
  `frontend/e2e-artifacts/teaching-full-python.log`. Started before small scoped
  roster/no-joint-explanation/post-publication-warning review fixes; those have
  separate current-source targeted proof. Do not mislabel it an exact final-source
  gate. No reported failures at the last check (panel-matching tests).
- **Owner update:** no further testing requested. Do not resume the full test run.
- **2026-11-04 UI adjustment:** removed the separate Course Adjustments Schedule
  tab; structured dropdowns now live in Offering setup’s Schedule column, with
  timetable controls below the table. Offering saves refresh schedule constraints.
  No tests run per owner; production frontend rebuilt. API rows include offering_id for exact
  row matching across programs/sections. Google Calendar remains defense busy-time
  integration; teaching availability remains a separate semester submission.
- **Next action:** owner review of Offering setup; no further automated tests run. All helper agents are done;
  the three temporary worktrees and helper branches have been removed.

The older handoff below predates this owner-authorized work; detailed progress for
this run is appended near the end of the file.

## MEETING PREP RUN (2026-11-03 night -> 2026-11-04 10:00 Manila) — read this first

Session `local_0845825f-fe9e-4422-b52b-d6b8bc762cfd` (registered in `E:/DevCache/dev-kit-workers/build-session.id`;
the BayoCoop registration it replaced is in `build-session.id.bayocoop-backup` / `.resume.bayocoop-backup` — restore it
when this run ends). Branch `v6.1-migui`; commit + push as each piece lands (owner 2026-11-03).
Stakeholder meeting 2026-11-04. Owner asked for, in this order:
1. **Demo recording + narration script** of Migui's parts (2d Monitoring Sheet, 2h LOA/AWOL, 2l Reports, 2m Best
   Features), slow, no audio. Output `Documents/CAPSTONE_ONLY/Demo_Migui/` (video + `NARRATION-SCRIPT.docx`).
   Recorder `scripts/demo/record_migui_demo.mjs` (Playwright video, own DB copy via DATABASE_URL, own port).
2. **Meeting cheat sheet** `Documents/CAPSTONE_ONLY/Demo_Migui/MEETING-CHEAT-SHEET.docx`.
3. **UAT instrument review + revised docx** (owner's draft `C:/Users/Windows10/Downloads/[CAP-IT2] UAT Instrument Draft.docx`)
   -> `Documents/CAPSTONE_ONLY/UAT/` (helper A).
4. **USLS forms pack** — inventory what the Graduate School needs, draft every form/process document cleanly (no draft
   mark, owner choice) for the Dean to sign in the meeting -> `Documents/USLS_Forms/` (helper B).
5. Google Calendar `.env` question — answered in chat (send Natalie a personal Gmail so she adds it as a Google test user).
6. **Docker + Cloudflare Tunnel** for https://miguisanson.dev: `Dockerfile`, `docker-compose.yml` (app + cloudflared,
   tunnel token from a file the owner fills), `deploy/DOCKER.md` (helper C). Owner: domain NOT yet on Cloudflare;
   public sign-in page SHOWS the demo accounts (DEMO_SHOW_ACCOUNTS=1, owner choice, risk told).
7. Then polish / improvement / optimization loop (IMPROVE.md) until 10:00 Manila.
**RUN ENDED 08:30 Nov 4; full report `.planning/SESSION-REPORT-2026-11-04.md`. Site turned OFF at the owner's request (start: `deploy\START-SITE.cmd`).** ALL 5 DELIVERABLES DONE + pushed; owner entry point
`Documents/CAPSTONE_ONLY/Demo_Migui/README-FOR-MIGUI.md`. Videos (local only, gitignored) re-recorded on the final night code.
v6.1-migui @ 61c40e6 (pushed): night1..13 merged after gates. Last full Python gate 983 tests: only failures = Myrine's
test_teaching_schedule (I-236, hers: her 26c8892 removed the published-timetable guard and the Schedule tab; her p110/p84 specs
pin the old UI) + the night8 determinism test (fixed after, now compares two clean seed processes; passes). Last full e2e 786
passed, fails = I-236 (2) + flaky I-235 pictures.
Live site: `deploy/START-SITE.cmd` (npm run uat, 127.0.0.1:5000), seeded 06:05, process restarted 07:35 on 61c40e6, Policy
Assistant offline (GOOGLE_API_KEY=off, I-221). No tunnel yet (owner does Cloudflare). Watchdog loop stopped; auto-resume
registration handed back to BayoCoop (`build-session.id` = local_02521ec6...). Another session was editing Demo_Migui docs,
narration.json, build_narration.py, build_cheat_sheet.py, build_uat_instrument.py (uncommitted, theirs) at 07:30 — not touched.
Open for later: I-236 (Myrine), I-240, I-241 wording, I-215 F-15, I-218 smarter assistant (owner reminder: the session AFTER the
next branch).
Shared doc tools: `E:/Temp/claude/docs-venv` (python-docx, pymupdf, openpyxl, imageio-ffmpeg); LibreOffice `E:/LibreOffice`.

## HANDED OFF (2026-11-03 morning) — read `.planning/HANDOFF-v6.1.md` first

- Owner: "finish up … I plan to let someone else develop". The v6.1 run is closed; auto-resume is OFF.
- Everything is merged on `v6.1-migui` and pushed; no helper worktrees or `pkt/*` branches left from this run.
- Last gates: Mac Python 875/0 (before the final pkt/fable1 merge; fable1's own run 425 targeted tests OK); Mac e2e
  see `E:/Temp/claude/gate61/mac_e2e_final.txt`; build + `check:ui --strict` zeros after the last merge.
- **Owner reminder (2026-11-03): build the smarter Policy Assistant (I-218: route questions, role-scoped data answers from the report endpoints, clarifying questions with buttons, "not covered" instead of weak passages; Gemini/local model optional) in the session AFTER the next branch. Remind the owner then.**
- Open work: HANDOFF-v6.1.md "Open work" (I-207, I-208, I-213 F-10, I-214/I-215 AI leftovers, I-216 .ics + forced
  password change, walkthrough case 20 re-capture, Graduate School questions I-167/I-170/I-174).
- Before UAT the owner must: Cloudflare login + Access, Google client ID/secret, testers as Google test users,
  `DEMO_PASSWORD` in `.env`, then `npm run build:web`, `npm run seed`, `npm run uat`.

## CURRENT RUN (2026-11-02, v6.1) — read this first

- **Branch `v6.1-migui`** from `v6.0-natalie` @ 80dd1aa (IM28). UAT on `https://miguisanson.dev` from Wed 2026-11-04,
  served from this PC via Cloudflare Tunnel (IM29), demo seed (IM30), no e-mail (IM31). Decisions IM28-IM33.
- **Merged on v6.1:** paused v5.3 packets `pkt/iso`, `pkt/conE`, `pkt/rep` (conflicts only in p51/p62 specs, resolved
  keeping both sides). Full Python gate on b629b82 running in `wt/gate` -> `E:/Temp/claude/gate61/merge3.txt`.
  Still to run on the merged code: `npm run e2e` (p93 reports + p95 + p51/p62/p96), `check:ui:strict`.
- **MERGED `pkt/cal`** (I-134..I-137, I-140): self-conflict, deferral cleanup, PATCH 404 recreate, invalid_grant ->
  "Reconnect", token saved, hooks never fail a booking, fixed event ids + private, scope check, primary-calendar note.
  29 targeted tests OK, build OK, check:ui strict 0.
- **e2e after merges:** 603 passed, 8 failed. Fixed here: p72 (calendar link moved by v6.0), p51/p78 (hard-coded dates).
  The other 5 fail alone too -> `pkt/e2efix` (wt/e2efix, no app.py).
- **MERGED `pkt/e2efix`** (p33 batch month, p86 follow-up count + Hazel Flores at Dean Review); Therese's seed leave -> item 8 of pkt/harden.
- **MERGED `pkt/harden`** (I-138 audit): DEMO_SHOW_ACCOUNTS, reset staff/admin only, ASSISTANT_MAX_PER_HOUR, MAX_UPLOAD_MB,
  env_int/env_float, security headers, SQLite WAL + busy_timeout, Therese's leave stays "On Leave". After it: Mac Python
  gate + PC e2e running -> `E:/Temp/claude/gate61/mac_harden.txt`, `e2e3.txt`.
- **Gate after harden (invalid / found):** PC e2e 397 failed = INVALID (persona-uat `server.mjs` cleared `frontend/e2e-artifacts` incl. .auth storage in the same checkout mid-run, and a merge rebuilt dist mid-run). RULE: run full e2e only in `wt/gate` (detached), never in the main checkout while anything else runs there. Mac Python gate 742/756: 12 real = assistant limiter 429s across tests (fix = item 7 of pkt/logic1) + .env.example not synced to the Mac (conf fixed).
- **Audits done:** I-143 logic -> `research/PROCESS-LOGIC-AUDIT-2026-11-02.md`, I-159..I-174; I-144 consistency ->
  `research/CONSISTENCY-PROCESSES-2026-11-02.md`, I-146..I-158 (packets A,B,E,C,D,F,G).
- **MERGED since:** `pkt/motion` (A+B), `pkt/student` (F: I-149..I-153, I-176, I-178), `pkt/stepdlg` (E+C: one
  StepDialog, BoardNotice on every board, SkeletonBoard), `pkt/logic1` (I-159..I-164 + limiter 0=unlimited in tests,
  AD11; seed dates the running semester from seed day - 3, so re-seed the morning UAT starts, UAT.md says so).
- **GATE:** full e2e in wt/gate on 8f4ac38 (after stepdlg, before logic1): **656 passed, 0 failed, 2 skipped**.
  Mac Python gate after logic1 running -> `E:/Temp/claude/gate61/mac_logic1.txt`.
- **MERGED since:** `pkt/deangrad` (D+G), `pkt/pm` (I-145/I-175/I-179: 44 distinct panel score vectors), `pkt/rep2`
  (Reports backend B1 StudentStageEvent clock, B2 /api/reports/summary, B3 attention/stages/records-to-fix, B5
  decisions/cycle-times). Subset e2e 59/59 (server-death at 20:07 was an external kill; helpers told: kill own PID only).
- **MERGED since (evening 2026-11-02):** `pkt/repui` (Reports UI F1/F2/F4), walkthrough rebuilt in the team order (I-139,
  `Documents/CAPSTONE_ONLY/CAP-2521-IT-WALKTHROUGH.docx`; case 20 Reports to re-capture), `pkt/e2efix2`, `pkt/polish`
  (I-180..I-186), `pkt/logic2` (I-165..I-173, I-177, I-181 history, I-187, I-188 search), `pkt/deanux` (I-189..I-196).
  Gates: Mac Python 822/0 after rep2; full e2e 680/2 after repui (both fixed). Persona runs: student-new, dean-phone,
  staff-rushed (findings I-175..I-178, I-188..I-196).
- **In flight:** `pkt/be6` (only app.py editor: I-183 seed inconsistencies, I-195 PH dates, I-193 one active count +
  Dean roles on stages/attention, I-197 deliberate history); `pkt/staffux` (I-198 ?show=open on every board, I-199
  every staff board as a card list on phones); Mac gate + full e2e on the logic2 merge -> gate61/mac_logic2.txt, e2e7.txt.
- **`pkt/sweep2`** (wt/sweep2, ready to merge after gate): persona sweep 2 I-201..I-207 + I-158 (AD12). app.py: faculty directory for the Research
  Coordinator, student_standing_summary, assistant next step, /api/research-gate/overview, research_lock_status, invitation reminders.
  Tests: tests/test_sweep2.py, e2e/p105-sweep2.spec.js, scripts/stages.test.mjs. Skipped: sidebar numbering gap (p21/p95 pin it).
- **Next:** merge be6 + staffux, gates; persona sweep 2 (student-leave, faculty-rare, coordinator-research) from wt/gate
  (not while e2e runs there); walkthrough case 20 re-capture; **Fable full review** when worth it (milestones, hard bugs; allowed any time, owner 2026-11-03;
  no usage-% trigger), then fix its P1s.
- **Auto-resume:** OFF for CAPSTONE right now (the keep-going task points at another session; re-register via E:\DevCache\dev-kit-workers\build-session.id to turn it on). Extra usage is OFF on the account (no charges).
- **Mac e2e:** `bash E:/Github_Projects/dev-kit/workers/pc/run-job.sh --worker mac CAPSTONE-USLS-MVP-e2e E:/Github_Projects/CAPSTONE-USLS-MVP` runs the full Playwright suite on the Mac in ~10 min (first run 708/730, I-208). Use it instead of the PC from Wednesday (the PC hosts UAT).
- **Machines:** Mac online with Python 3.13 (brew); full Python gate on the Mac = 16 min: `bash E:/Github_Projects/dev-kit/workers/pc/run-job.sh --worker mac CAPSTONE-USLS-MVP <dir>` (conf `dev-kit/workers/projects/CAPSTONE-USLS-MVP.conf`, parser unittest). First Mac run on b629b82: 717 passed, 1 failed; PC gate same code: 718 ran, the same 1 error (test_reports_im20 shared-DB teardown, fixed in a later commit). Lenovo: no Python, not used. Dev-kit edits (Ponytail/Caveman, workers) are uncommitted in dev-kit (owner commits).
- **MERGED `pkt/uat`** (I-138): `npm run uat` = waitress + ProxyFix (`scripts/serve_uat.py`, test `tests/test_uat_serving.py` 7/7), `.env.example`, setup-env `--uat`, `UAT.md`, `deploy/cloudflared/config.yml.example`. Its public-exposure audit -> next app.py packet `pkt/harden` (after pkt/cal): empty env values = unset, `DEMO_SHOW_ACCOUNTS` switch (demo-accounts endpoints publish the shared password + admin e-mail), demo reset staff/admin only, assistant per-account rate limit, `MAX_CONTENT_LENGTH`, security headers, SQLite WAL + busy_timeout.
- **pkt/a11y2** (I-120) still has only a stash in `wt/a11y2`; redo it later from the brief.
- **Next after the three land:** review + merge pkt/cal then pkt/uat; app.py packet for the public-exposure audit
  findings; e2e on merged code; then IMPROVE.md loop (ISSUES P1/P2, consistency sweep, UI/database improvements);
  Fable full review at the end.

## ACTIVE RUN UPDATE (2026-10-27) - faculty calendar UI refinement complete

- **Branch and scope:** `v6.0-natalie` only; version 5.3 was not touched. This packet changed frontend presentation and Playwright expectations only. No backend, database, OAuth, calendar-sync, availability, or defense-scheduling behavior changed.
- **Owner request completed:** the GS staff faculty-profile calendar no longer draws redundant dark-green "Available for defense" blocks or the matching legend; pale entered weekly-hours shading and blue Google busy blocks remain. Faculty My Calendar now uses a compact Google Calendar connection card in the responsive side column and no longer shows the faculty subscription card. Google connection controls remain absent from the faculty dashboard and My Availability.
- **Implementation:** `frontend/src/pages/Faculty.jsx`, `frontend/src/components/calendar/CalendarPage.jsx`, and `frontend/src/pages/faculty/FacultyCalendar.jsx`. The implementation packet was committed as `900aec6` and integrated on `v6.0-natalie` as `1d842bd`.
- **Test-first evidence:** `p63-faculty-pages.spec.js` and `p96-google-calendar.spec.js` first failed on the old redundant availability blocks/full-width connection panel/subscription card. The updated same-kind faculty walkthroughs in `p51-faculty.spec.js` and `p87-calendar.spec.js` now pin the single My Calendar management surface and remove superseded private-link/availability-page expectations.
- **Verification:** production frontend build PASS; strict UI check PASS with every metric zero; targeted `p63`, `p87`, `p96`, and all request-relevant `p51` checks PASS. The 1366, 1920, and 390 px screenshots were opened and reviewed without overflow, clipping, or hierarchy defects. Targeted Playwright runs reached completed case output but required Ctrl+C after the known Windows teardown hang.
- **Broader-run note:** a full `npm run e2e` attempt was stopped after 150/611 cases because legacy assertions and external-resource blocking produced unrelated failures (`ERR_NETWORK_ACCESS_DENIED` and mutable seeded-date expectations). All request-relevant cases were rerun against a fresh disposable database and passed; the one remaining failure in that focused p51 invocation was the pre-existing hard-coded defense-date check, outside this UI packet.
- **Next action:** none for this request. Keep the Google Calendar integration controls on faculty My Calendar if the surrounding calendar UI changes later.

## ACTIVE RUN UPDATE (2026-10-27) — two-way Google Calendar complete

- **Branch:** `v6.0-natalie` at merge commit `aa66f8a`; verified packet commit `3c20cc3` (`pkt/google-calendar-two-way`).
- **Owner request:** keep Google personal events private but use their busy periods during defense scheduling; create/update/delete system-owned defense events on each connected faculty member's primary Google Calendar; put all Google Calendar connection controls only on faculty **My Calendar**, not **My Availability**.
- **Contract:** retain `calendar.freebusy` for conflict checks and add only `calendar.events.owned` for events the system creates on the user's owned primary calendar. Never list or import personal event details. Tag and store every system-created event ID so reschedules/cancellations cannot alter unrelated events.
- **Red evidence:** five targeted backend tests failed for the intended missing scope/helpers and the faculty Playwright walkthrough failed because the connection card was still on My Availability.
- **Implementation complete:** `ScheduleRequest` now stores only the event IDs created by this system; booking/rescheduling/re-confirming/cancelling invokes best-effort create/update/delete lifecycle hooks; the OAuth scope adds `calendar.events.owned`; manual sync retries future defense events; disconnect removes stored system-owned events before credentials are revoked; and the connection card now renders only on faculty My Calendar.
- **Verification so far:** targeted backend **13/13 PASS**; p96 faculty Playwright checks **8/8 PASS** (the harness later needed Ctrl+C after its completed output because Windows teardown did not exit); production frontend build PASS; strict UI check PASS with every metric zero; 1366/1920/390 screenshots opened and reviewed with no overflow or layout defect. A fresh deterministic demo seed also completed with fingerprint `a1bb81bd4344de5416e397c9536f4cdb945c554b075678d30705165bdbf269aa`.
- **Demo database:** rebuilt after merge; fingerprint `125b702303d83543107d6b9424f4ed22bdce8f517afad274e77d537baac866f9`.
- **Full-gate correction:** the first repository-wide run stayed green through the new Google tests, then exposed one obsolete assertion in `ExistingDataTests` that still required the superseded read-only consent copy. The owner explicitly requested two-way event writes, so that test was renamed/replaced with the new narrow two-way permission contract and passed targeted. The interrupted run is not counted as a gate result.
- **Verification:** packet full repository gate PASS (**684 tests, 1 skipped**); post-merge targeted contract **14/14 PASS**; post-merge production frontend build PASS; post-merge strict UI check PASS with every metric zero; post-merge full repository gate PASS (**684 tests, 1 skipped**). The p96 faculty Playwright walkthrough and its seven role sign-ins passed **8/8** before merge, and the 1366/1920/390 screenshots were reviewed without overflow or layout defects.
- **Exact next action:** each previously linked demonstration Google account must reconnect once from faculty **My Calendar** after the owner adds the `calendar.events.owned` scope in Google Auth Platform; then perform one real OAuth booking/reschedule/cancel demonstration. No credentials or `.env` values were read during implementation.

## ACTIVE RUN UPDATE (2026-10-26) — Google Calendar implementation merged

- **Branch:** `v5.3-migui_test` at merge commit `cf2ce7d`; reviewed packet `pkt/google-calendar-v53` is merged. The owner completed the Google Cloud console setup and gave the implementation go-ahead.
- **Scope complete in packet:** each faculty member owns their link/reconnect/sync/unlink lifecycle; OAuth requests only OpenID identity, e-mail, and `calendar.freebusy`; callback tokens are Fernet-encrypted; Google identity cannot be reused by another faculty profile; account changes cannot inherit the previous account's refresh token; connect/sync/disconnect are audited; the legacy shared token path is removed; and Google busy periods only subtract from faculty-entered hours and date exceptions.
- **Integrator review corrections:** the default redirect URI now exactly matches the owner's registered URI (`http://localhost:5000/api/integrations/google-calendar/callback`, with the old route retained as a compatibility alias); the scope matches the Google Auth Platform configuration (`calendar.freebusy`); the callback rejects an identity whose e-mail Google did not verify; and the calendar count helper can no longer be called without a faculty availability record.
- **Test-first evidence:** the backend contract was checked on the test-only commit and failed for the intended five reasons, then the reviewed implementation passed all eight targeted Google Calendar tests. A new mobile-order Playwright assertion failed with the Calendar card at y=2627 below Weekly hours at y=328; the responsive layout was corrected and the same walkthrough then passed.
- **Merged verification:** targeted backend **8/8 PASS**; `p96-google-calendar.spec.js` plus all seven role sign-ins **8/8 PASS**; production frontend build PASS; `check:ui:strict` PASS with every metric zero. Screenshots at 1366, 1920, and 390 px were opened and reviewed with no overflow or layout defect. No real Google credentials were read or written.
- **In progress:** the full repository Python gate is running on `cf2ce7d` with external AI keys disabled. After it finishes, record the result, commit this handoff update, and remove the packet worktree.

## ACTIVE RUN (2026-10-24) — Google Calendar integration adjustment

- **Branch:** `v5.3-migui_test` at `02ff818`; owner resumed work and asked for the Google Calendar integration to be completed against v5.3.
- **Scope:** faculty-owned link/reconnect/unlink from the Faculty Portal; minimum free/busy OAuth permission; encrypted stored tokens; connection/sync status and internal audit entries; Defense Scheduling must intersect entered working hours and manual exceptions with Google busy periods (Google never invents working hours or exposes event details).
- **Finding:** v5.3 already has a partial OAuth/free-busy path, but it requests `calendar.readonly`, stores callback tokens as plaintext, has no unlink endpoint/UI, records no calendar audit event or last successful sync, retains a legacy shared-token path, and can assume 08:00–18:00 when a connected faculty member entered no working hours. Filed as I-132; regression contract R-015.
- **Execution:** main session writes and proves the failing tests first. Implementation then goes to one Sonnet packet in its own worktree because `app.py` is touched. No other `app.py` packet may run concurrently.
- **Red contract landed in packet worktree:** five targeted backend checks fail for the intended reasons (invented 08:00-18:00 availability, hidden entered hours, broad `calendar.readonly`, selected real Google identity not stored/encrypted/audited, and missing sync/disconnect routes). `frontend/e2e/p96-google-calendar.spec.js` also reaches the faculty screen and fails because v5.3 has no last-checked status or sync/disconnect controls. Playwright Chromium was installed; its first attempted run was infrastructure-red before installation, then the feature-red run reached the assertion.
- **Exact next action:** commit the red tests and hand the fixed contract to the Sonnet implementer in this worktree; then main reviews, reruns the targeted tests, checks screenshots at 1366/1920/390, and runs the required gates.

## (old, 2026-10-22) PAUSED BY THE OWNER (2026-10-22 night) — read this first

Owner: "put a pause on things and wrap up". All helpers were stopped. `v5.3-migui_test` is pushed; last full Python
gate 680 OK (after pkt/be4), every later merge checked with targeted e2e + strict design check (all zeros).

Finished but NOT merged (each on its own branch + worktree in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<name>`;
review per AGENTS.md, merge one at a time, gate after each):
1. `pkt/rep` (5 commits) - Reports rebuild IM20: five real reports (at-risk, cohorts, overdue, defenses, graduation)
   with xlsx/pdf export + a short Analytics tab (I-068, I-014-class). Its full Python gate was still running when
   stopped - re-run the gate and `p93-reports.spec.js` + p62 + p33 before merging. Only app.py editor.
2. `pkt/conE` (4 commits) - AD9 (staff locked on Dean Review withdrawals, test first), consistency findings 11/15,
   I-129 coordinator home (own-process waiting items, concept papers open Research Gate). Its combined e2e re-run
   was cut off - re-run p95 + the combined run before merging.
3. `pkt/iso` (2 commits) - e2e data-ownership map + guard + collisions fixed (I-100/I-113/I-121 class); run A of
   three passed, reversed/1-worker runs not done.
4. `pkt/a11y2` (0 commits; WIP stashed in wt/a11y2: `git -C ../CAPSTONE-USLS-MVP-wt/a11y2 stash list`) - I-120
   a11y follow-ups barely started; redo from the brief in this file's history if the stash is unclear.
Then remaining: consistency packet B (list toolbars / Activity Log I-124/I-125, after pkt/rep), I-120 rest
(faculty signatures nested buttons), I-119 server strings, I-105, I-107, I-114/I-115, Phase 4 app.py split, Phase 6.
Junction rule: `cmd //c rmdir <wt>rontend
ode_modules` BEFORE `git worktree remove`. Locked leftover folders in
the -wt directory (already deregistered) can be deleted after a reboot.

## CURRENT RUN (2026-10-22, v5.3) — read this first

- **Branch:** `v5.3-migui_test` (from `v5.2-migui_again` @ c426b6f, pushed). Owner decisions IM25-IM27 (4 helpers, agent decides everything, bolder improvements allowed).
- **In flight (worktrees in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`; each `frontend/node_modules` is a JUNCTION to the main checkout — before `git worktree remove`, run `cmd //c rmdir <wt>rontend
ode_modules` so the main node_modules is not deleted):**
  - MERGED `pkt/be` (I-010, I-012, I-005, I-002; R-011).
  - MERGED `pkt/be2` (I-055..I-058, I-036, I-073; R-012).
  - MERGED `pkt/seed2` (I-060, I-061, I-062, I-070, I-095; R-013; AD8 for I-094). Gate on e7be427: python **661 OK**; e2e 388/389 + 1 skipped (p84 row-height bound fixed after).
  - `be4` / `pkt/be4` — the only app.py editor: I-059 notifications on decisions, I-071/I-072 GETs and login stop writing, I-066 coordinator home API, I-093 N+1 /api/students, I-047 daily changes student_id (port 5322).
  - MERGED `pkt/shell` (I-103, I-101, I-112); RoleSidebar.jsx deleted (unused).
  - MERGED `pkt/enr` (P6.7/P6.8, I-082, I-081 part). Folder wt/enr locked by a helper process; delete later.
  - MERGED `pkt/lists` (I-075, I-083, I-098, I-104, I-109). I-116 filed.
  - MERGED `pkt/p66` (P6.6, I-116). I-119 for the server strings.
  - `p8` / `pkt/p8` — Phase 5 P8 close-out: last check:ui hits, shims removed, `--strict` in npm run e2e, ModalShell out (I-118) (port 5326).
  - Gate on 176b0cf: python **652 OK**; e2e 315/318 (3 p78 order failures, fixed by pkt/bpol). LESSON: run the full pages project after every merge that changes a nav or label (p21 was red after pkt/be2 until pkt/shell).
  - MERGED `pkt/bpol` (I-110, I-108, I-106, I-111, I-113).
  - MERGED `pkt/p65` (P6.5, I-069, I-081 part). I-115 filed.
  - MERGED `pkt/p24` (P2.4). New: I-117, I-118.
  - MERGED `pkt/ca` (I-117). I-121 filed (p32 order dependence).
  - `iso` / `pkt/iso` — class fix for e2e order dependence (I-100/I-113/I-121): DATA-OWNERSHIP.md, collisions fixed, ownership guard, three run orders (port 5327).
  - Read-only consistency sweep (IM24) on 726c3c8 -> `E:/Temp/claude/review53/CONSISTENCY-2026-10-22.md` (port 5331).
  - MERGED `pkt/a11y` (p89 axe check, contrast tokens, table scroll regions). Follow-up I-120.
  - NEXT: P8 close-out after p66 merges (StudentPicker, graduationShared, MonitoringGrid allow-list I-097, ui.jsx/forms.jsx shims, print.js AD3, --strict); Reports rebuild IM20 (app.py after be4); coordinator home frontend (after be4's API); ModalShell adapter out of ProcessBoardPage (I-118). NEXT after a slot frees: P6.6 StudentDetail/Assistant/ChangePassword/Login; then P8 close-out; Reports rebuild IM20 (needs app.py after seed2).
  - MERGED `pkt/stu` (P4.3/P4.4, I-087, I-086, error summaries).
  - MERGED `pkt/leave` (P5.3-P5.5).
  - MERGED `pkt/vocab` (I-076..I-078, I-080). Folder `wt/vocab` is deregistered but a locked file kept it on disk - delete it after a reboot. Follow-up I-112.
  - MERGED `pkt/fac` (P5.1+P5.2 faculty pages). e2e after it -> `E:/Temp/claude/gate53/e2e_after_fac.txt`.
  - MERGED `pkt/board` (I-067, I-088). Follow-up: Practicum `w-[300px]` and Graduation `w-[380px]` column overrides (workflow packet).
  - `vocab` / `pkt/vocab` — one name table `lib/labels.js`, breadcrumb rule Portal > Page (I-077, I-078), rules collapsed (I-076), Activity Log open (I-080) (spec `e2e/p76-vocabulary.spec.js`, port 5306).
  - Full Python gate on 00eda43 (after wf, be, fac, mon merges + source-test path fix): **643 tests OK** (38 min). Worktree `wt/gate` is kept for the next gate run (`git -C ../CAPSTONE-USLS-MVP-wt/gate checkout --detach <sha>`).
  - Fixed on the branch: I-096 e2e harness now keyless (the main checkout's .env key broke p80).
  - MERGED `pkt/mon` (P6.4 Monitoring Sheet / class list / adviser record).
  - MERGED `pkt/fac2` (I-079, I-090, I-085, I-099, I-100). Its worktree `wt/fac2` may still have a helper process; remove it later (rmdir junction first).
  - MERGED `pkt/wf` (P7.1-P7.4 move-only split of WorkflowPage.jsx into `pages/workflow/`); e2e after it -> `E:/Temp/claude/gate53/e2e_after_wf.txt`.
  - MERGED `pkt/wf2` (P7.5 restyle of six workflow files, dead code out).
  - MERGED `pkt/grad` (I-065, I-051). New: I-105 (batch 'Next: Dean' wrong), I-106, I-107.
  - MERGED `pkt/wf4` (I-063, I-089, I-102).
  - MERGED `pkt/dean` (I-074, I-084, I-106 part). Follow-up I-111.
  - After `pkt/vocab` merges (it owns Layout.jsx): sidebar nav clipped by the footer (I-103, P2) + course-audit nav entry (I-101).
  - Fable review DONE -> `.planning/research/FULL-REVIEW-2026-10-22.md`; findings F-01..F-41 filed as I-055..I-095 (I-0xx = F-xx + 54). Worktree `review` can be removed (rmdir junction first).
- **Wave plan from the review (backend lane is serial, one app.py packet at a time):**
  - be3 seed data: I-060 (F-06 advisers <=5, adviser never on panel), I-061 (F-07 stage vs units, titles, departments), I-062 (F-08 one case in every Dean queue), I-070 (F-16 dates spread over past weeks, R-001 stays green), I-094 (F-40), I-095 (F-41).
  - be4: I-059 (F-05 notify student on decisions), I-071/I-072 (F-17/F-18 GETs and login write), I-066 (F-12 coordinator home API), I-093 (F-39 N+1).
  - be5 + frontend: I-064 (F-10 rosters on Research Gate/Panel Matching/Defense Scheduling), I-068 (F-14 IM20 five real reports), I-074 (F-20).
  - frontend lanes: wf3 Graduation onto StageBoard + table (I-065/I-051) and Practicum/DefenseScheduling/Availability restyle (I-063, I-089); StageBoard columns at 1366 (I-067) + empty states (I-088); vocabulary/breadcrumbs (I-077, I-078, I-076); faculty advisees/verdicts (I-079, I-090, after pkt/fac); jargon (I-081, I-082, I-069); small UI (I-075, I-080, I-083..I-087, I-091); a11y sweep (I-092) + axe-core check from UX research.
- UX research saved: `.planning/research/UX-RESEARCH-2026-10-22.md` (top 15 checks at the end).
- **Baseline gate** on v5.3 start: running -> `E:/Temp/claude/gate53/baseline.txt`.
- **Next:** review + merge each packet one at a time (gate after each), file the Fable findings into ISSUES.md and plan the next waves from them.


## HANDOVER FOR THE NEXT SESSION / ACCOUNT (kept current; read this first)

Session closed by the owner on 2026-10-17 evening (their usage limit resets Thursday, not today). The next session starts with
`/continue_CAPSTONE-USLS-MVP` and continues from here. Never ask the owner for decisions during unattended runs
(IM18): take the recommended option and log it as an `AD#` row in `DECISIONS.md`.

1. `git switch v5.2-migui_again && git pull`. `git worktree list`: any `pkt/*` branch with commits ahead of
   `v5.2-migui_again` is finished helper work - review it (AGENTS.md reviewer rules), merge one at a time, re-run
   the gate. A worktree with uncommitted changes is half-done work - read its diff and finish or discard it.
   Helper worktrees live in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<name>`.
2. Gates: Python `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"` (~28 min, run in the
   background); frontend `npm run e2e` (~6 min; the only known failure is I-036, academic-coordinator 403) and
   `npm run e2e:negative` (must FAIL). When helpers run e2e at the same time, give each its own
   `E2E_PORT=<51xx>` and `USLS_E2E_TMP=E:\Temp\claude\e2e-<name>`. `cd frontend && npm run check:ui` must
   never rise (`--update` after a packet lowers it; resolve baseline merge conflicts by taking either side and
   running `--update`).
3. Order of the remaining work (ROADMAP.md): (a) finish Phase 5 page migrations - the remaining rows of
   `.planning/phases/05-design-system/05-UI-SPEC.md` section 8 (each packet pins behaviour first with
   `frontend/e2e/p<NN>-<name>.spec.js`, which the `pages` Playwright project picks up without a config edit),
   then P8 close-out (`check:ui --strict` = all zeros; allow-list `lib/print.js`, AD3); (b) Phase 3 backend
   section J bugs I-002, I-003, I-005, I-006, I-007, I-009..I-013 plus I-036 and I-043 - **only one packet at a
   time may edit app.py**; (c) Phase 4 split of app.py (order in `codebase/ARCHITECTURE.md`); (d) Phase 6.
4. Max 3 Sonnet implementer subagents at once (IM10). Copy the brief style of earlier packets (git log of
   merged `pkt/*` branches shows what each did).
5. After every merge: update this file's Current Position, `BOARD.md`, `ISSUES.md`, `REGRESSION.md`; commit and
   push `v5.2-migui_again`. Never merge into `v5.1-migui_clean` (owner only).
6. The hourly watchdog task "Keep CAPSTONE improvement mode running" is DISABLED (owner starts sessions by
   hand with `/continue_CAPSTONE-USLS-MVP`). Do not re-enable it unless the owner asks.
7. **Consistency sweep every session (IM24, owner's top concern):** `.planning/IMPROVE.md` bug hunt method 0.
   Compare same-kind pages (boards, role homes, forms, lists, detail pages, dialogs, reports) feature by
   feature; file unexplained differences as `consistency:` rows. Worked example: I-049 (AWOL cards).

## Current Position (2026-10-17 — improvement mode set up)

- **Branch:** `v5.2-migui_again` (new, from `v5.1-migui_clean` at e6460e0; not pushed).
- **Milestone:** v5.2 Improvement mode. Owner decisions IM1–IM15 in `DECISIONS.md`
  (grill-me 2026-10-17). Plan: `ROADMAP.md` (6 phases). Owner's tracker: `BOARD.md`.
- **Done this session:** GSD onboarded (PROJECT, ROADMAP, `codebase/` map by two Sonnet
  mapper agents), reference-portal + team-database research (`research/`), improvement mode
  ported from DD-Project-GameMaker / shelf-and-sword (IMPROVE, ISSUES, REGRESSION, IDEAS,
  BOARD, `/continue_CAPSTONE-USLS-MVP`), AGENTS.md / CLAUDE.md / `/continue_` updated.
- **Counters:** open P1 issues 5 (I-001, I-002, I-005, I-010, I-012 — unconfirmed repros,
  copied from section J) + I-015 confirmed. Regressions since last stable: 0.
- **In flight (Phase 1, 2026-10-17 ~06:10):** red tests written, uncommitted in the main checkout: `tests/test_seed_determinism.py` (R-001), `tests/test_sqlite_only.py`, tool `scripts/db_fingerprint.py`. Sonnet packets: `pkt/archive` in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/archive` (move unused files to archive/, delete certain-dead frontend code; no app.py) and `pkt/sqlite-only` in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/sqlite-only` (remove MySQL + startup ALTER patching, refuse outdated DB with a reseed hint). After both merge: packet C `pkt/seed` = make R-001 green (identical seed, start changes nothing).
- **FIRST THING NEXT SESSION (session closed cleanly 2026-10-17 ~20:00):** nothing is in flight - no worktrees, no helper branches, all work merged on `v5.2-migui_again` and pushed. Merged this evening: `pkt/assistant` (grounded Gemini assistant), `pkt/assistant-tune` (complete answers, 429 retry, strength bar 0.45, test isolation; full gate 639 tests on its branch, the one teardown error fixed and re-checked), `pkt/board-consistency` (IM24/I-049: every board shows why a card cannot move; Practicum on StageBoard; `.planning/phases/05-design-system/board-parity.md`), `pkt/ui-p42` (student forms). Start with: (1) full Python gate with `GOOGLE_API_KEY= GOOGLE_AI_STUDIO_API_KEY=` (last full run on main had 2 isolation failures, fixed by assistant-tune - confirm 0); (2) `npm run e2e` (expect only I-036); (3) live `.venv/Scripts/python.exe scripts/assistant_eval.py` (uses the owner's key in .env) and compare with `E:/Temp/claude/assistant_eval_run1.txt` - answers must be complete sentences, Q2/Q3/Q5 answered, gym/restaurant not covered; (4) the consistency sweep (IM24) - open I-051..I-053 from the board audit; then the NEXT list below.
- **Packets (16:40 local, end of this account's plan):** MERGED today: archive, sqlite-only, e2e, mobile, j-frontend, seed (Phases 1+2 DONE), get-writes, ui-p1a..p1f, ui-p61, ui-p31..p33, ui-p21..p23, ui-p41, ui-p62, ui-p63, fix-p41, and all four role homes (student, staff, dean, faculty). e2e on d0064be: 229 passed, only I-036 fails. Python gate last green at 598 OK (after get-writes; later merges were frontend-only except the Gemini default fix + its test). **(evening update)** `pkt/assistant` MERGED (bf550e4); gate after it running -> /e/Temp/claude/gate/after_assistant.txt (run with GOOGLE_API_KEY empty so tests never call Gemini). Live eval found I-050 -> `pkt/assistant-tune` in flight (wt/assistant-tune). Also in flight: `pkt/board-consistency` (IM24/I-049; port 5271) and `pkt/ui-p42` resumed (port 5261). Earlier note: (1) `pkt/assistant` @ b86b7fa (grounded Gemini assistant IM21: retrieval threshold, not-covered answer, personal answers, offline fallback, new AssistantChat UI, tests/test_policy_assistant.py 24 OK, p80 spec 12/12) - NOT yet verified: full Python gate on the final commit (an earlier run had 2 housekeeping failures in test_policy_documents because a run wrote the Operations Manual draft into the worktree's uploads/policy_documents - check on a clean checkout), full e2e, final screenshots, live answers. After merging run `.venv/Scripts/python.exe scripts/assistant_eval.py` in the MAIN checkout (its .env has the owner's key) and tune `RAG_MIN_SIMILARITY` (0.60 is a guess). (2) `pkt/ui-p42` @ f849aa8 holds only the P4.2 pinning spec (`frontend/e2e/p42-student-forms.spec.js`); the migration of RequestForms/ResearchForms/CompletionForms is not started - redo P4.2 from that commit. Worktrees `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/assistant` and `.../ui-p42` still exist; remove them after merging. NEXT after those: Reports rebuild into the 5 real reports (IM20, includes I-047); coordinators' landing '/' (they reach the new staff home only by typing /); backend section J bugs one app.py packet at a time (I-002, I-003, I-005, I-006, I-007, I-009..I-012) + I-036 + I-043; remaining UI-SPEC s8 packets (P2.4, P4.3-4.4, P5.1-5.5, P6.4-6.8, P7.x WorkflowPage split, P8 close-out); Phase 4 app.py split; Phase 6.
- **Gate baseline (2026-10-17 06:20, v5.2-migui_again @05145bb):** 591 tests OK, 20 min. R-001 red as expected: two seeds already match; start-on-empty differs from `--seed` (adviser_assignment 28 vs 31, panel_assignment 45 vs 71, panel_invitation 0 vs 13, course_record, document_check, form1_endorsement, defense_verdict, policy_document…) and a normal start adds/changes rows (adviser_appointment 0→28 …).
- **Resume:** scheduled task `capstone-resume-after-limit` runs `/continue_CAPSTONE-USLS-MVP` at 2026-10-17 06:35 +08:00 (after the 5-hour usage reset) unless another session is working here.
- **Next action:** Phase 1 (dates relative to seed day IM16; big generated folders to `archive/`, still tracked in git, IM17) — `/gsd-discuss-phase 1` then plan: write R-001 (seed fingerprint
  test, two temp dirs, plus "normal start changes nothing"), watch it fail, then remove MySQL,
  replace `run_schema_upgrades` with model-built schema, make start side-effect-free, unify
  the seed command; move proven-unused files to `archive/`.
- **Not obvious:** `npm run seed` and a plain start build different data (research); the seed
  makes 145 students, not 350; importing `app` runs schema upgrade + seed/maintenance.

## Earlier position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Handover (2026-10-01, paused by the owner)

Branch `v5.1-migui_clean` is the whole state — committed and pushed, in sync with GitHub.
All `pkt/*` helper branches were merged and deleted; temporary worktrees removed
(`E:/Github_Projects/CAPSTONE-USLS-MVP-wt/monitor` is a leftover locked folder, safe to delete
after a reboot). To run it: see README (`npm run setup`, then `npm run dev`; demo password
`DemoPass123!`). The work queue for whoever continues: `DEFENSE_REVISIONS.md` section J, then
the "Next session" list below.

### Progress (2026-10-01 11:00)

Everything is merged into `v5.1-migui_clean` and pushed, including the walkthrough.
Full gate on the final code: 591 tests; the only failure was a randomly-seeded test
(fixed in 6ade188, verified with three hash seeds). Frontend build passes.

Next session: section J of `DEFENSE_REVISIONS.md` (13 bugs found while re-walking the
demo + re-capture walkthrough cases 9 and 18), then re-run `scripts/docs/rebuild_proposal.py`
so the proposal reflects the last merges, and refresh the proposal's Appendix U screenshots
from `Documents/CAPSTONE_ONLY/walkthrough_screenshots/`.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.

## Current Position — 2026-11-03 Course Adjustments report

- Branch: v6.1-migui. Owner reported faculty selection followed by Decision rationale replacing the page with "Complete the required rationale for MAED-STAT".
- Finding: frontend/dist/index.html was dated 2026-09-15; current frontend source has no Decision rationale input and neither current frontend nor backend contains that validation message. Stale served frontend is the first cause to eliminate.
- Completed: npm run build:web PASS; regenerated ignored frontend/dist. No application code or test changes; no database changes.
- Next action: owner hard-refreshes the local page and retries faculty selection. If it persists, establish the actual served URL/process and reproduce against the rebuilt assets before changing behavior. No regression test yet because the reported controls are absent from current source.

## Current Position — Dean decision context (2026-11-03)
- Branch v6.1-migui; owner authorized Faculty and Student impact columns. Tests added to tests/test_academic_fixes.py and frontend/e2e/p90-dean-consistency.spec.js; implementation not started. Existing faculty serializer provides names; plan serializer needs existing course_demand_rows delayed_count by course and target term.
- Repairing test prerequisites: .venv launcher inaccessible, Python312 available under AppData/Local/Programs/Python; isolated environment frontend/e2e-artifacts/verify-python. Frontend test dependencies installed; browser and Python dependencies in progress. No delegated packet (inline fallback).
- Next: run both new tests red, implement, rerun and gate; record results and review screenshots.

- Backend red/green: new test first failed KeyError delayed_count (both 2 and 0), then passed after plan serializer enriches offerings using course_demand_rows once per plan. Verified with installed Python312 plus existing .venv site-packages. Browser red run now starting with installed Chrome via ignored e2e-artifacts/local.config.js; default browser download is slow.

- Backend academic suite PASS (39 tests). Browser first run could not access localhost (socket permissions); stopped and requested elevated rerun. Before final gate: Python suite output will go to frontend/e2e-artifacts/dean-context-python-gate.log; no frontend implementation yet pending browser red evidence.

- Browser RED confirmed: missing Dr. Review Faculty (7 role sign-ins pass). Implemented the two PLAN_COLUMNS in DeanPages.jsx. Next rebuild and rerun p90, screenshots all widths. Full Python gate is session 88172, output in dean-context-python-gate.log.

- Implemented I-219 on v6.1-migui: DeanPages.jsx adds Faculty (name / Unassigned) and Student impact (potential delay count / next-term demand sentence). app.py plan serializer reuses target-term course_demand_rows. New tests in tests/test_academic_fixes.py and p90-dean-consistency.spec.js. No changed/removed existing assertions.
- Verification: backend test RED KeyError then GREEN; academic suite 39 PASS; browser RED missing faculty then p90 suite 20 PASS (includes 7 role logins and approval/return behavior); build PASS; strict UI metrics all zero. Opened/reviewed decision-context screenshots at 1366/1920/390 in frontend/e2e-artifacts/p90; desktop fits, phone table scrolls inside card without page overflow.
- Full Python gate remains running as exec session 88172; output frontend/e2e-artifacts/dean-context-python-gate.log. Next action: collect its final result and resolve any relevant failures before committing. Files touched: app.py, DeanPages.jsx, both tests, ISSUES.md, REGRESSION.md, STATE.md. No commit/merge yet; full all-role sweep and negative control still required before merge. New isolated Python environment is frontend/e2e-artifacts/verify-python; ignored local.config.js selects installed Chrome. No external worktrees or active installers remain.

## Current Position — delay-only impact wording (2026-11-03)
- Owner replaces duplicate demand sentence with em dash for zero delay. Updated p90 test first; next run red using last disposable browser database (resume-server.mjs, no reseed), then change DeanPages.jsx and rerun focused test/build/UI check. No workflow/backend changes.

- RED confirmed: CS-702 lacks em-dash cell. Replaced fallback in DeanPages.jsx with em dash; retained positive warning and demand column. Next build, UI check, focused browser green and screenshot review.

- Delay-only wording complete: focused browser test RED on absent dash then GREEN (1 test, 3 widths); production build PASS; strict UI check PASS (zero metrics). Opened all three refreshed screenshots; desktop shows delay warning/dash, phone retains contained table scroll. Only existing no-delay sentence assertion was replaced to match explicit owner revision; added assertion that sentence is absent. No new backend changes. Earlier full Python gate remains session 88172, output unchanged location; no commit/merge until gate result is collected.

## Current Position — Dean delay parity (2026-11-03)
- Owner requests header Delayed if withheld and reports Details has 8 delayed but Dean blank. Source inspection: Details and plan serializer already call course_demand_rows for selected/target term; frontend treated absent delayed_count as zero. Flask debug=False requires restart for earlier backend addition. Need verify actual endpoint parity and distinguish absent count from real zero. Header test added first; running red before rename.

- Header renamed Delayed if withheld; missing/null delayed_count displays Unavailable rather than zero dash. Browser first failed missing header; updated focused browser PASS at 1366/1920/390; screenshots opened/reviewed (contained mobile table scroll). Build and strict UI PASS. Added real endpoint parity test test_dean_delay_counts_match_coordinator_details_for_submitted_term: draft/submit, GET coordinator and Dean, nonzero counts and all matching subjects; PASS. No new backend calculation. Existing rule flags unique students for current or next subject groups, not prerequisite/forecast analysis. Backend stale process is plausible cause of owner blank, not verified on owner's live URL; restart Flask required to load prior serializer addition. Existing full gate session 88172 still separate; new parity test not in that earlier discovery. No commit/merge.

## Current Position — smart class scheduling planning decisions (2026-11-03)

- Planning only: owner requested inspection/implementation plan, explicitly no code changes for scheduling yet. Existing uncommitted Dean review packet is separate.
- Confirmed by owner: Academic Coordinator approves class schedules; approved paired days are Monday/Thursday, Tuesday/Friday, Wednesday/Saturday; teaching availability is distinct from defense availability; current collection method unknown, but portal collection is useful; rooms remain existing free-text input, do not add/change room management.
- Plan consequence: coordinator creates/reviews draft, explicitly approves/finalizes (no Dean timetable approval, retain Dean offering approval). Separate semester teaching availability; never reuse defense hours as confirmed teaching hours. No room inventory, capacity, booking engine, room-conflict guarantees, or room schema work.
- Still unconfirmed: exact teaching hours/grid, 90-minute duration/15-minute gap and single-day fallback permission (owner explicitly confirmed paired days, not each timing detail); hard versus soft forecast conflict policy. Recommend proposed times as configurable pending confirmation; confirmed enrollment hard, forecasts warning/soft penalty. No student availability collection.
- Next action: turn revised plan into small test-first packets only when implementation is authorized; first packet term-specific teaching availability and explicit coordinator finalization contract. Determine current collection practice during stakeholder validation without blocking technical design.

### Faculty scheduling interface clarification (owner, 2026-11-03)
- Add a faculty Schedule tab/page with semester selection and a calendar view for entering teaching availability each semester. Teaching availability remains separate from defense availability/calendar.
- Proposed interaction: weekly calendar, click/tap day to add/edit available windows; optional preferred and unavailable windows with text legend; copy previous semester and explicit No changes confirmation; separate submitted availability from read-only finalized assigned classes. Keep keyboard-accessible form alternative and 390px day/list view.
- This refines the requested implementation plan; original scheduling request remains planning-first/no-code until implementation go-ahead. No schedule code changed.

## Active implementation — smart teaching scheduling (2026-11-03)
- Owner authorized full plan implementation. Config defaults 07:30–21:00, 90-minute teaching, 15-minute gaps; approved pairs; single-day fallback explicit opt-in; forecasts warnings. Academic Coordinator approves; rooms untouched. Skills: intelligence-layer and ui-ux-pro-max.
- Engine tests written first and failed ModuleNotFoundError teaching_engine. Delegated packet branch codex/teaching-engine at .worktrees/teaching-engine; only new teaching_engine.py, immutable test copy. Main integrates and verifies; no app.py edits delegated to engine.
- Next: write API and UI contracts red; implement semester teaching availability and schedule lifecycle using separate modules, avoid defense changes. Existing Dean changes remain separate/uncommitted.

- Engine isolated tests 8/8 PASS. Copied teaching_engine.py into main for integrator review/test. API test RED 404 vs200 before implementation. API worktree .worktrees/teaching-api, branch codex/teaching-api; named new teaching_backend.py plus minimal app.py registration; immutable tests/test_teaching_schedule.py copied. Main will transplant only reviewed diff, preserving prior Dean changes.

- Frontend p110 walkthrough written first and confirmed RED: missing faculty sidebar Schedule link and coordinator Schedule tab. UI packet worktree .worktrees/teaching-ui, branch codex/teaching-ui; no backend edits. Immutable p110 copied. Engine 8/8 tests review in progress; backend API implements explicit versions and approval/publication.

- Integrator engine run PASS 8/8. Added immutable API lifecycle scenarios: no publication before approval; personal student/faculty views; frozen publication with separate revision; availability change invalidates approval; tampered candidates; faculty self ownership. Tests copied to API worktree for builder verification.

- Review findings before integration: API/UI approval request payload mismatch (UI sending draft-only fallback flag on approval), recommendations could move earlier manually saved choices, defense booking only checked one direction. Builders correcting with explicit save/approve payloads, persisted per-section pins/unlock, reverse defense-to-class conflict hook. Main wrote corresponding immutable pin/defense tests before fixes; paths remain three isolated worktrees. Root engine tests8/8 pass.

- Stopped superseded Python gate session88172 before integrating new scheduling models; it was started before scheduling scope and is not a final gate. Log remains frontend/e2e-artifacts/dean-context-python-gate.log. Fresh final gate must run after integration. New model startup requires seed rebuild of demo schema; no manual schema patch permitted.

- Added real browser workflow harness: scripts/serve_teaching_test.py + frontend/playwright.teaching.config.js + frontend/e2e/teaching-workflow/workflow.spec.js. Uses existing disposable unittest fixture (2 offered subjects, same faculty/student), port5056; no demo DB changes. Command npm run e2e:teaching. Shell test expected links intentionally expanded for new faculty/student Schedule. UI worktree still implementing approval payload + pin/refresh corrections before transplant.

- API builder frozen after immutable19test PASS; integrated teaching_backend.py + minimal app.py hooks preserving Dean edits. Models new availability, timetable plan and sections (structured meeting JSON, pins), no startup ALTER. Inverse class/defense conflicts, source-history guards and publication notifications included. Next integrator rerun19tests + engine then real UI walkthrough; demo schema rebuild still pending.

- Integrator combined engine/API run PASS27tests. Additional role test caught admin superuser bypass: admin could approve despite coordinator-only owner decision (RED200vs403). Added explicit mutation role guards in new teaching module; targeted rerun in progress. Added4new routes to access-control registry checks. .venv launcher repaired by pointing local ignored pyvenv.cfg home to installed Python312; .venv/Scripts/python.exe now reports3.12.2.

- UI builder frozen; integrated8frontend files including faculty Schedule, coordinator third tab, student class schedule. Approval requests omit draft-only fields; choice saves revalidate; persisted Keep this schedule pins; semester URL respected. Root admin bypass test now GREEN. Next build+strict UI then isolated real teaching workflow port5056; stage full gate after no further functional changes.

- Final Python gate started session99914 -> frontend/e2e-artifacts/teaching-full-python.log with both AI keys blank, standard repaired .venv launcher. UI strictPASS0. Build in progress session24431; realworkflow will use separate testDB port5056. No production/demo data rebuild yet; models require npm run seed when delivered.

- Real teaching workflow PASS(21s) against actual API: faculty copy/confirm -> coordinator draft/approve/publish -> student sees both classes. Opened/reviewed7screenshots; found raw confirmation timestamp and fullpage sticky-header capture offset, fixed display via shared formatter and screenshot scroll-top. Need refreshed9screenshots incl3student widths. No functional backend changes since fullgate started.

- Final realworkflow PASS25.4s after date formatting/screenshot fixes; all9screens captured. Browser role/shell/p110 gate starting via g2:180 with temp seededDB5055. FullPython session99914 remains active -> teaching-full-python.log. Documentation TEACHING_SCHEDULE.md, BOARD and issues I-220..222/regressionR022..024 updated. New route role test20thAPI targetedpass, first27suite covered19API+8engine.

- Broad role sweep caught pre-existing faculty Assigned Classes403 from all-subject dropdown (I-223). New test in tests/test_i216.py failed extra unauthorized courseIDs; scoped context subject choices to taught/advisee courses without changing roster permissions. Targeted RosterScope suite running. Root all-role sweep still on loaded older app; rerun faculty against new process after run ends. FullPython likewise began before this small context fix; must report full-run baseline plus focused current-source regression rather than claim exact final full source if not rerun.

- Role/sidebar/p110 gate finished32PASS/1FAIL, sole failure pre-existing Assigned Classes403 (I-223). New roster scope test first RED, targeted5tests GREEN after narrowing subjectlist. Rerunning only faculty role against current source/resumed disposableDB; other6role sweeps and sidebar/newUI checks alreadyPASS. Final live9screens opened/reviewed atall3widths, no clipping/pageoverflow; date readable and screenshotheader fixed.

- Faculty sweep recheck PASS(13pages x3widths); other6roles, newp110 andshell checksPASS. Negative control failed as intended with6injectedproblems detected. Broad browser verification complete. FullPython still running session99914 (calendar classes, no reported failures). About to run standard npm run seed on local disposable demo DB to add new models via rebuild (not patch); output frontend/e2e-artifacts/teaching-demo-seed.log. Both AI keys blank for this process.

- Final no-feasible review caught I-224: same faculty/shared student, only one TueFri slot each, no joint solution, UI generic missing selection only. New test first RED then plan_data now returns joint constraint explanation and retains search-limit distinction on refresh, no new schema fields. Targeted rerun started. Final gate still baseline before this small error-reporting fix; affected API cases require current-source rerun.

- I-224 targeted test GREEN; running current-source scheduling+engine+roster suite to frontend/e2e-artifacts/teaching-final-targeted.log. This includes all21API scenarios plus8engine+5roster tests. Local demo seed still running90190, fullPython99914. No active UI checks or background installers.

- Current-source targeted34tests PASS(21API+8engine+5roster). Final hands-on Keep checkbox test exposed UI request missing option_id when pinning a preselected recommendation (RED409, checkbox remainedfalse). Added selected ID for pintrue; unpinfalse remains supported. Build/refreshed realworkflow pending; backend code unchanged. Local seed PASS148students/12faculty, fingerprint1ebaba1566faf9c87d8b70e3747bab70bb114108d09a41aa2cda3d682ca57976, startup schema smokePASS.

- Keep regression next exposed async controlled-checkbox flicker even withAPI200; state was only updated after server response. Added optimistic pin display with rollback to server state on failure, disable while saving. Same browser test remains unchanged, new build/live rerun pending. This is I-225 follow-up, no backend/schema changes.

## Current Position — 2026-11-04 final verification
- Functional implementation complete. Latest real teaching workflow PASS24.4s including Keep/release; latest buildPASS and strictUI all0. Current API+engine+roster tests34PASS. All7role sweeps pass across initialrun plus corrected faculty rerun; p110 andshellpass; negativecontrolfailsasintended6injectedproblems.
- Demo rebuilt successfully using npm run seed; new schema verified and no teaching submissions fabricated. Existing running app needs restart to load new Python routes. Fingerprint1ebaba1566faf9c87d8b70e3747bab70bb114108d09a41aa2cda3d682ca57976.
- FullPython session99914 still running -> frontend/e2e-artifacts/teaching-full-python.log; no reportedfailures yet. It began before scoped rosterlist and no-joint-explanation reviewfixes, which passed targeted current-source tests. Do not claim an exact final-source full gate without noting this distinction.
- New production files: teaching_engine.py, teaching_backend.py, frontend/src/pages/TeachingSchedule.jsx, frontend/src/pages/faculty/FacultySchedule.jsx, frontend/src/pages/student/StudentClassSchedule.jsx. Integration: app.py, frontend/src/api.js, components/portalNav.jsx, CoursePlanning.jsx, faculty/FacultyRoutes.jsx, student/StudentRoutes.jsx. Tests: tests/test_teaching_engine.py, tests/test_teaching_schedule.py, tests/test_i216.py, e2e/p110, e2e/teaching-workflow/workflow.spec.js, playwright.teaching.config.js, scripts/serve_teaching_test.py. Earlier Dean packet files remain included in worktree; no user edits overwritten.
- Three helper worktrees .worktrees/teaching-engine, .worktrees/teaching-api, .worktrees/teaching-ui have frozen copies; all helper agents done. Main reviewed, transplanted, tested and applied small review fixes inline. Codex helper/worktree workflow used; no Ollama/Claude-specific executors available. No commit/merge/push yet. Next: collect fullgate result, final diff/secretscheck, save local commits with tests, remove temporary helperworktrees, update final STATE/BOARD/issues.

- Post-publication warning refinement (I-226): existing lifecycle test strengthened to assert no false legacy free-text warning for own structured publication; RED showed2falsewarnings. sections_context now recognizes per-offering active published ClassSection records, retaining true legacy warnings. Two relevant lifecycle/no-joint cases rerunning -> teaching-publication-recheck.log. No schema/permission/conflict changes. No further feature scope planned; collect gate and save work.

- Saved local commits e7d7176 (Dean review) and3131fcf (teaching scheduling + tests/docs). No push/merge. Temporary helperworktrees and codex/teaching-* branches removed after verifying root production files tracked. Only remaining background job is fullPython99914; output teaching-full-python.log. Postpublication warning recheck2PASS; final live workflowPASS24.4s. Additional doc clarification: StudyPlanDraft exists but is generated/reviewed projection, not confirmed attendance. Next collect fullgate, record result/scope and make final documentation commit.

## 2026-11-04 — audit round 3 (branch pkt/audit-round3, worktree kaudit3, not pushed)

Fixed and marked in ISSUES.md: I-342, I-351, I-349, I-294, I-295, I-301, I-300, I-312, I-320, I-322, I-325, I-305, I-307, I-308, I-347
(regression row R-032). No schema change (no reseed needed). Tests: `tests/test_audit3.py`, `tests/test_audit3_research.py`, plus new methods in
`test_loa_readmission`, `test_monitoring_crud`, `test_academic_fixes`. The API refuses an unconsented account except when `TESTING` (set
`app.config["ENFORCE_PRIVACY_CONSENT"]` in a test to turn it on). Known old failure: e2e p113 line 141 expects no "Defense type" text, the form has had that label since 05a8e5a.

