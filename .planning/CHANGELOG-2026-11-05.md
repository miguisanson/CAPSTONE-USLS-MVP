# Changelog - 2026-11-04 night / 2026-11-05 (session "v6.4 merge")

Branch: **`v6.4-migui`** (new) = `v6.2-migui` + Natalie's `v6.3-natalie`. Reseed after pulling (`npm run seed`).

## Landed
| What | Issues | Commit(s) |
|---|---|---|
| Merge of Natalie's Research Gate work by the owner's decisions M1-M7 (`.planning/MERGE-v6.4.md`): five verdicts, Deferred/Failed reopen the stage, staff and the Research Coordinator record/correct/confirm for the panel from the card or the record (reason + stamp), our cards in her compact scrolling columns, "Final Defense" column, wider board membership | - | 1da6e65 |
| Research Gate board only reads (SQLite lock), columns share the width, coursework students whose research is locked are left out | I-365 | c3e602f, 0421871 |
| Built-in policy library (Handbook, Research Protocol) tracked in git again | I-368 | 97e4ff4 |
| Fable review of the merge, 8 findings fixed: provisional follow-up in the board dialog, Verdicts demo guide "Passed", Deferred puts the student next, confirm revisions from the record, re-defense booking label, phone board spacing, five-verdict wording in docs and capture case 17 | - | 17b9a8e |
| Private demo sandbox per browser (cookie `usls_sandbox`; reset route; per-visitor date-wait switch; idle clean-up, cap, no copy for health checks, a seed drops old copies) | I-366 | afbc341, 666998c, 2731f08 |
| Demo Guide: every start (sign-in box, panel pick, Change demo, after Stop) resets the sandbox and plays from step 1; "Start over" replaces Back; the switch hides the guided-demo area on the sign-in page | I-367 | 97cebc8 + merge |
| e2e server runs without the sandbox (specs share one database across roles) | - | e5c2a51 |

## Gates
- Full Python gate on 97e4ff4: 1,171 tests, only the known I-236 `test_teaching_schedule`. After that: targeted suites on every later change (research core 23+, sandbox 10, health, demo guide, reads-do-not-write: all OK).
- `npm run build:web` OK, `check:ui:strict` all 0.
- Full `npm run e2e` on e5c2a51: 973 passed, 5 failed = known p110 + p84:376 (I-236), p79 (flaky), p88 (I-364), p73 graduation (cross-spec data, passes alone 16/16); the 34 autopilot tests run separately (see STATE).

## Open
- I-369 (question): two browsers are now two separate demos; option of a "share this demo" code.
