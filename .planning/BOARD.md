# USLS GS Platform — board

Updated after every step that lands. Branch: `v5.2-migui_again` (IM9). Plan: `ROADMAP.md`.
Your decisions: `DECISIONS.md`. How unattended work runs: `IMPROVE.md`.

## Now

- Improvement mode set up (2026-10-17): decisions IM1–IM15, roadmap of 6 phases, issue list,
  regression list, ideas list, `/continue_CAPSTONE-USLS-MVP`.
- Next: **Phase 1 — identical data on every machine** (SQLite only, one seed command, no data
  changes on start) and moving unused files into `archive/`.

## Next

1. Phase 2 — automated walkthroughs for every role + screenshots at laptop/desktop/phone sizes.
2. Phase 3 — the 13 demo bugs from `DEFENSE_REVISIONS.md` section J.
3. Phase 4 — split the 37,500-line `app.py` into modules.
4. Phase 5 — one design system across every page.
5. Phase 6 — speed and final cleanup.

## Ready for your review

(nothing yet — each commit on `v5.2-migui_again` will be listed here with its screenshots)

## Waiting on you (whenever convenient)

- **One small step on your PC (not a decision):** your `.env` file has a `DATABASE_URL=mysql…` line. Once the SQLite-only change lands, the app will refuse to start with it. Delete that line (or put `#` in front of it), then run `npm run seed`. I never open `.env`, so you have to do this one yourself. Teammates do the same.

- **Pick ideas** from `IDEAS.md` (X-06…X-11). My pick: X-06 "Needs my action" page and X-07 reminders.
- **Tell your teammates** once Phase 1 lands: pull `v5.2-migui_again`, delete their old
  database, run the one seed command. Until then they stay on `v5.1-migui_clean`.
- Still blocked on the Graduate School (unchanged): `DEFENSE_REVISIONS.md` section G.

## Done

- 2026-10-17 morning: unused files moved to `archive/` (old templates, static, .codex, outputs, walkthrough screenshots — still in git), ~6,500 lines of dead code/files out of the app; 591 tests green.

- 2026-10-17: grill-me (15 decisions), codebase map (`codebase/`), reference-portal and
  database research (`research/`), improvement mode ported from DD-Project and shelf-and-sword.
