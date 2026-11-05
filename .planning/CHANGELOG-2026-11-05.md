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

---

# 2026-11-05 afternoon — final polish loop on `v6.4.1-test` (from `v6.4-migui` @ 67d4432)

Owner: no questions; every open question takes the policy-faithful default the stakeholders agreed to (IM42-IM44).
Plan: Fable review `.planning/research/FABLE-REVIEW-2026-11-05.md`. **Reseed after pulling** (`npm run seed`): new columns
`ResearchEvidenceFile.similarity_percent`, `AwolCase.staff_checks_json`, new table `ComprehensiveExamResult`.

| What | Issues | Merge |
|---|---|---|
| Screen words in plain English, no pronouns for people; `check:ui` now fails on he/she/they in screen text | F5-01/02/12/13, I-081, I-369 | 2969867 |
| Research Gate cards: "3 of 5 done · Still to do: A, B +3 more", requirement tiles in View, old picker gone (page 5,300 -> 1,250 px); one verdict form everywhere; no free-text source reference | F5-03/08/09 | 3d09151, d2587b0d |
| Boards: phone list collapses finished stages, filter chips Needs my action / Waiting on others / Finished; Finished wins over "Waiting for"; AWOL headline; Dean graduation Next; task links open the student | F5-04/05/07/11/16, I-348 | 5486732, d2587b0d |
| Loading skeletons on list/report/record pages and the Research Gate; residency purpose from the stage, semester read-only, check runs by itself | F5-10/15, I-299 | 2973d56, 895331e4 |
| Withdrawal + Graduation: Sent to Registrar and Acknowledged/Registrar Received; the Dean's approval tags the subject Withdrawn; a resent withdrawal keeps its first date; readmission and Return from AWOL need Business Office clearance + interview before the Dean; LOA two-week check again at approval; finished denials have no owner; Research Coordinator home counts research students | F5-06/07/14, I-167, I-273, I-278, I-297, I-302, I-306, I-324 | 685f32f1, f9e105d8, ac9471c3 |
| Hard 14-day lead time (demo "skip date waits" also skips it); manuscript date from the adviser's Form 4, read-only; enrollment status derived from subjects; one Form 4 at the proposal gate; Failed/Deferred refuse a passing score; Turnitin similarity % (over 15 refused); one 20 % drop rule | I-170, I-174, I-277, I-284, I-285, I-313, I-326, I-327 | f9e105d8, 2a5a3c4d |
| Staff record the comprehensive exam result with provenance; Advise Slip print view after the Dean approves a readmission | I-335, I-304 | 895331e4 |
| Research Gate board 4.0 s -> 1.2 s (exam eligibility computed once per student; the board looked empty under load) | - | 91613959 |
| Field label holds only the label (hint/error outside), so screen readers do not read the hint twice | I-370 | d2587b0d |
| Operations Manual follows the new rules, "Known gaps" table (deferred I-279, I-293, I-317, I-319, I-326 per member, I-346); .docx + .pdf rebuilt; UAT.md keeps the demo accounts panel | IM44, I-334 | f7a43d8e, d8a007c9 |

Notes: the e2e dist must be built with `node scripts/e2e.mjs test --build` (a plain `npm run build:web` has no `/__ui` gallery).
Never `git stash` inside a worktree (the stash list is shared).
