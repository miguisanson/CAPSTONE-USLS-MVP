# USLS Graduate School platform — final polish loop (paste this to resume)

Repo: `E:\Github_Projects\CAPSTONE-USLS-MVP` · Branch: **`v6.4.1-test`** (made from `v6.4-migui` on 2026-11-05)
Start the session with `/continue_CAPSTONE-USLS-MVP`, then paste everything below.

---

## My instructions for this loop (owner, 2026-11-05)

- Work on **`v6.4.1-test`** only. Khloe works on another branch; I merge her work later myself.
- Goal: a **polish and improvement loop** until the submission on **2026-11-07** (my subscription ends then). Use all my
  remaining usage.
- **Do not ask me anything.** Keep going: build, polish, improve, test, fix.
- Follow the multi-agent rules and the skills: **Ponytail** (smallest change, reuse first), **Caveman** (short answers),
  Superpowers (test first, verification), **ui-ux-pro-max** for every screen, max **3 helpers** at once, only one helper on
  `app.py` at a time, Sonnet for implementation, Fable for reviews at milestones.
- Fix **human-error-prone input**: anything a user types, picks or ticks that the system already knows must be filled in
  automatically and shown read-only.
- Use **good references online** (other web apps, portals, case boards) for UI patterns and subtle animations — nothing too much.
- Check that the **logic rules and processes make sense** against the Operations Manual, Handbook and Research Protocol.
- **All open questions = the stakeholders said yes at the last meeting and will sign.** Take the policy-faithful default from
  the Operations Manual / Handbook / Protocol and build it. Don't hold back on changes.
- **Don't completely change what Khloe and Natalie built** — polish their work, don't redo it.
- Fable reviewer first, then the polish loop; more Fable reviews at milestones are fine.

## Where things stand (2026-11-05 night, paused)

- Done today: 3 Fable reviews, 9 persona tests (human-like testers per role), ~30 packets merged. Details:
  `.planning/CHANGELOG-2026-11-05.md`, decisions `IM42`-`IM45` in `.planning/DECISIONS.md`, issues `I-354`..`I-395` in
  `.planning/ISSUES.md`.
- Paused in the middle of **`pkt/f7`** (Fable review 3 fixes: live research status on 3 chips, graduation history only on
  completed students, 7 small items). Work-in-progress commit is pushed; nothing tested yet.
- Next steps: finish `pkt/f7` → full Python gate + full e2e + autopilot → push → keep looping (more persona rounds, open rows).
- After pulling on any PC: **`npm run seed`** (the database changed today).

## Rules learned today (keep them)

- Never `git stash` inside a worktree (the stash list is shared; two helpers swapped stashes once).
- Build the e2e site with `node scripts/e2e.mjs test --build` (a plain `npm run build:web` leaves out the `/__ui` gallery).
- Run the full Python gate in its own worktree (`CAPSTONE-USLS-MVP-wt/gate`) so merges don't change files mid-run.
- Don't seed-time sync research progress for everyone: it moves demo student Nicolas Valdez off "Writing" and breaks the
  Residency guide.
