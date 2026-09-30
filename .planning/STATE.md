# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Progress (updated as work lands)

Merged into `v5.1-migui_clean` and pushed: `pkt/health`, `pkt/monitor`, `pkt/portals`,
`pkt/opsmanual`, `pkt/panel`, `pkt/docs`, `pkt/policy`, `pkt/rules`, `pkt/research-core`,
`pkt/crosscut`, `pkt/academic`. Full gate at `5cd57d2`: **362 tests, 0 failures**
(~14 min); frontend build passes. Old demo DB backup copied to
`E:/Temp/claude/backup/` before crosscut untracked it.

Running (worktrees under `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`):

| Branch | Job | Based on |
|---|---|---|
| `pkt/loa` | **FINISHED, NOT MERGED YET** — LOA + Readmission rebuild; its own gate 279/279 green. Merge next (expect conflicts in app.py around task_dict, run_startup_tasks, reports_payload, loa_policy_review — see its note `.planning/PACKET_LOA_STATE.md` on that branch; academic's note: keep `max(0, ((years_in_program(student) or 1) - 1) * 3)` for LOA minimum residency) | 7a8e6e7 |
| `pkt/calendar` | Availability editor, adviser appointment, calendars, invitations, notifications, private .ics | 5cd57d2 |
| `pkt/docs2` | Business Rules section in the proposal + Operations Manual synced with the code | 5cd57d2 |

Left after those: final polish packet (items in `LIVE_CHECK_NOTES.md`; add the
Operations Manual draft to the policy library as a Draft document; remove the
three monitoring 409 stub routes now that portal CRUD exists); walkthrough rewrite
re-walked in the live app with fresh screenshots; proposal ch. 5–6 + appendix
inventories regenerated from code; re-run `scripts/docs/add_business_rules_section.py`
and `scripts/docs/build_proposal.py`; README/CHANGELOG; final gate, live check, push.

## Session stopped 2026-10-01 at the usage limit

The main session hit its usage limit here. `pkt/calendar` and `pkt/docs2` were still
running in their worktrees and will commit on their branches when done; nothing of
theirs is merged. Resume with `/continue_CAPSTONE-USLS-MVP`: merge `pkt/loa`, then
`pkt/calendar`, then `pkt/docs2` (full gate after each), then the 'Left after those' list.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
