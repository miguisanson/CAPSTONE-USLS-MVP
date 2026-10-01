# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Progress (2026-10-01 ~09:00, usage limit reached)

Everything is merged into `v5.1-migui_clean` and pushed except the walkthrough
(`pkt/walkthrough`, still running; commit due 10:15, scripts re-runnable).
Last merges: rulesux (locked handbook rules, Recommendations -> Work Queue tab,
calendar/adviser as tabs), layoutfix (no page h-scroll, corrected subject-needs report),
standalone (one template + drag-and-drop for LOA/Readmission/AWOL/Withdrawal), assistant2
(policy_rag.py BM25 retrieval; eval 94% hit@1 / 100% hit@3).
Gate before assistant2: running (`E:/Temp/claude/usls-check/gate.log`). After assistant2:
policy/assistant tests 59/60 — the one failure is
`test_seed_folder_is_tracked_and_real_uploads_are_not_ignored_by_accident`, which the helper
says fails only when run as named modules and passes under `discover`; verify with the full gate.

Next: full gate on HEAD; merge `pkt/walkthrough`, re-run its capture + build on final code;
re-run `scripts/docs/rebuild_proposal.py`; README/CHANGELOG; push.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
