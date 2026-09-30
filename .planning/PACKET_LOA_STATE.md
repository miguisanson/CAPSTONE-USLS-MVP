# Packet: LOA + Readmission rebuild (branch pkt/loa, worktree CAPSTONE-USLS-MVP-wt/loa)

Read this first if the session died. Rung used: Claude (Sonnet) inline for the backend and tests;
four Sonnet subagents for the frontend screens (staff board, student pages, Dean cards, Graduation wiring).

## Landed (backend; `tests/test_loa_readmission.py`, 50 tests)
- New tables `leave_case`, `leave_case_event`, `leave_export_log` (plain `db.create_all()`, no ALTER).
- `leave_workflow.py`: the one status list, board columns, the guarded transition table, timeline, old-log reader.
- `app.py`, block "Leave of Absence, leave extension and Readmission cases": `leave_case_apply` is the ONLY place a
  case changes status; `sync_leave_cases` (start / return due / AWOL *proposal*); `adopt_legacy_leave_logs`
  (old log-only history -> cases; idempotent, never touches student standing); Registrar list export + handoff.
- Routes: `/api/leave-cases` (+ `/<id>`, `/<id>/transition`, `/batch`, `/sync`, `/registrar-export`, `/handoff`,
  `/export-log`); `/api/student-portal/leave-cases/<id>/<withdraw|cancel>`; student context key `leave_overview`.
- AW-01: AWOL action `complete_reenrollment`; the automatic AWOL sync keeps a "Re-enrollment Required" case.
- Demo: readmission demo students get a real approved leave case (`ensure_demo_leave_case`); baseline no longer
  undoes a leave the demo student already has; reset removes the process's cases.

## Landed (frontend)
- `components/StageBoard.jsx` (real drag and drop + "Move to..." menu), `components/leaveStatus.jsx`.
- Staff: `pages/LeaveCasesBoard.jsx` + `pages/leave/*`. Student: `pages/student/LeaveCaseCards.jsx` + forms.
  Dean: `pages/dean/DeanLeaveParts.jsx`, `DeanLeaveBatch.jsx`. Graduation board now uses StageBoard.
- Old LOA/Readmission forms and request queue removed from `WorkflowPage.jsx`.

## Checked how
- Backend: unittest (new file + full gate). Frontend: `vite build` plus a server-render smoke run of every new
  component against real API output in every case status (scratchpad `loa_smoke`); no browser (brief forbids it).

## Not obvious
- Dean decision ids for leave/readmission are now case ids (they were log ids).
- Changed existing tests: 3 in `tests/test_bpm_workflows.py` (case ids; plain wording instead of "no RAG").
- `loa.second_half_marks_w` is now enforced in the catalog; an already-seeded database keeps its old "not enforced" flag.
- Not done: DB-level "one open case per student" index (route-level only); tasks carry no case id (matched by title).
