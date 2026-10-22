# USLS GS Platform — board

## v5.3 run (2026-10-22, branch `v5.3-migui_test`) — what changed today

A one-time senior review (Fable) of every page and the code found 41 new problems (`research/FULL-REVIEW-2026-10-22.md`,
filed as I-055..I-095). Web research added 15 UX checks (`research/UX-RESEARCH-2026-10-22.md`). Merged so far:

- **Demo-day safety:** nobody can reset a demo student without signing in; five wrong passwords no longer lock the
  shared staff account for everyone (only that computer waits a few seconds); each install has its own secret key.
- **Section J bugs fixed:** graduation batch shows "Exported - Ready to Send" after export; residency cannot be recorded
  while the checker says "Needs Human Review" (handbook p. 51 has no override); the Research Coordinator's student search
  works; demo reset no longer blocks enrollment. Admin can now do staff workflow steps; the Academic Coordinator no longer
  sees a Defense Scheduling page that refused to open.
- **Same look everywhere:** the 4,900-line workflow page is split into 12 files and every workflow page (Handoff, Research
  Gate, Panel Matching, Defense Scheduling, Practicum, Graduation) now has the same header as the other boards; Graduation
  and Practicum are on the same board as Leave of Absence (Board/Table toggle, same cards); boards show "N more stages to
  the right" with scroll buttons instead of cutting columns off; one empty-state style.
- **One name per page:** sidebar, page title and breadcrumb ("Dean Portal › Approvals Queue") always match.
- **Faculty:** one advisee table instead of two; verdicts waiting on you come first; no big Google Calendar card.
- **Dean:** the home and Reports & Analytics count the same decisions (they disagreed); empty approval queues collapse to
  one line instead of eight empty boxes.
- **Monitoring Sheet:** sort works (it did nothing), filters can no longer show stale results, CSV export is safe in Excel.

**In progress:** demo data that makes sense (advisers within their limit, never on their own student's panel, a case
waiting in every Dean queue, dates spread over past weeks); sidebar cut off at laptop height; board polish; student pages.

Screenshots of each change: `E:/Temp/claude/shots-<packet>/after/` (fac, mon, wf2, wf4, board, grad, dean, fac2).

---


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

- **New home pages (IM19):** student home (merge edfea70) and staff home (merge 2f416f7) now share one layout - "Needs your action" first, then "Waiting on the Graduate School / on others", 3-4 key numbers, recent activity. The student home went from ~2,400 px of repeated cards to ~1,050 px; staff charts moved to **Reports > Analytics** (4 readable charts, click a bar to see the students). Dean and faculty homes now use the same layout too (merge d0064be).
- **Gemini works with your key** (default model switched to `gemini-flash-latest`; Google closed `gemini-2.5-flash` to new keys). The grounded assistant (answers only from the policy documents with sources, says when they don't cover a question, answers "what is my next step" from your own record) is built on branch `pkt/assistant` and waits for its final checks and merge in the next session.

- **Same data on every machine** (merge a9d0367) - `npm run seed` now builds the whole demo (148 students) the same way everywhere and prints a *Demo data fingerprint*; two teammates who see the same fingerprint have the same data. Starting the app never changes the data any more. To move a teammate over: pull `v5.2-migui_again`, remove the `DATABASE_URL=mysql...` line from `.env`, run `npm run seed`, compare fingerprints.

- **Design system, foundations** (merges 2e8cefc, ab32a7d, edc050c) - shared sizes/spacing, one status-colour map, shared buttons/fields/cards, one dialog that fits every screen, and `npm run check:ui`, which blocks new one-off sizes, tables and dialogs. Visible: status chips use one colour per meaning ("Submitted" blue, "Returned" amber, "Completed" green), info notes are blue, buttons and inputs are bigger on phones, the white strip above open dialogs is gone. Agent decisions AD1-AD4 in `DECISIONS.md`.
- **First pages on the new design system:** Students, Dashboard and Work Queue (merge e5931af) - same data and actions; one header style, one table style with paging, dialogs that fit. Before/after screenshots: `E:\Temp\claude\p61-before` and `p61-after`.
- **Section J bugs fixed:** J1 (dropped-subject dialog fits a laptop screen), J4 (no error banner after signing Form 1), J8 ("Mark reviewed" window title).

- **Unused files moved to `archive/`** (merge 55c142b) — nothing visible changes; see `archive/README.md`.
- **SQLite only** (merge 4a996ba) — MySQL removed; an outdated database now stops the app with "Run `npm run seed`". See the `.env` step under "Waiting on you".
- **Automatic walkthroughs** (merge ada73ad) — `npm run e2e` logs in as all 7 roles, opens all 116 pages, and saves 348 screenshots (laptop, desktop, phone) to `frontend/e2e-artifacts/screens/`. Its first run found 9 problems (I-031…I-039 in `ISSUES.md`), mostly pages that run off the screen on a phone; fixes are in progress.

## Waiting on you (whenever convenient)

- **One small step on your PC (2 minutes):** in the project folder run `npm run setup:env` - it removes the old MySQL line from `.env` and adds an empty `GOOGLE_API_KEY=` line. Get a free key at https://aistudio.google.com/apikey and paste it after the `=`. Then run `npm run seed`. Teammates do the same (the key is optional for them).

- **Pick ideas** from `IDEAS.md` (X-06…X-11). My pick: X-06 "Needs my action" page and X-07 reminders.
- **Tell your teammates** once Phase 1 lands: pull `v5.2-migui_again`, delete their old
  database, run the one seed command. Until then they stay on `v5.1-migui_clean`.
- Still blocked on the Graduate School (unchanged): `DEFENSE_REVISIONS.md` section G.

## Done

- 2026-10-17 morning: unused files moved to `archive/` (old templates, static, .codex, outputs, walkthrough screenshots — still in git), ~6,500 lines of dead code/files out of the app; 591 tests green.

- 2026-10-17: grill-me (15 decisions), codebase map (`codebase/`), reference-portal and
  database research (`research/`), improvement mode ported from DD-Project and shelf-and-sword.
