# Merge v6.4: v6.2-migui + Natalie's v6.3-natalie (2026-11-04 night)

**Common base:** `171a647` ("note", on v6.2-migui at ~14:30). Natalie branched there.
- `origin/v6.3-natalie` = base + **3 commits** (17:38-19:10), 14 files, +767/-152.
- `origin/v6.2-migui` = base + **124 commits** (`ef12348`), 291 files, +13,481/-2,098. Full list:
  `.planning/CHANGELOG-2026-11-04.md`.

## What Natalie changed (all Research Gate)
| Commit | What |
|---|---|
| 2af173e | **Staff verdict fallback.** Graduate School staff records or corrects the panel verdict from a form inside the selected student's Research Gate record (same route as the chair: `POST /api/faculty-portal/defense-verdicts/<schedule_id>`, now open to `staff`; no reason asked). Audit fields `recorded_by_account_id/role/name`, `corrected_by_role`. Staff **cannot** confirm later revisions. The chair's verdict now notifies staff. **Five verdicts** at every stage: Passed; Passed with minor revisions; Provisional pass - revisions or re-defense (with a follow-up pick, new column `provisional_follow_up`); Deferred; Failed. Title no longer says Approved/Disapproved. **Deferred and Failed reopen that stage's documents** and give the student a resubmit task (before: Deferred = nothing reset, coordinator reschedules). Overview also lists students with research records but no research case. Docs: CHECKLIST item 48 + exit check, DEFENSE_REVISIONS owner revision, REGRESSION R-030. |
| 33122ab | **Compact board.** Three columns share the full width; each student is one short row; each column scrolls inside a fixed height (board < 700 px tall on desktop); totals stay correct while filtering. `StageBoard` gets `fitColumns` + `columnBodyClassName`. |
| 6769bfe | Third column is labelled **"Final Defense"** (API key stays `Completion`). |

Files: `app.py`, `ResearchGate.jsx`, `ResearchGateOverview.jsx`, `StageBoard.jsx`, `FacultyVerdicts.jsx`, `FacultyResearchWorkspace.jsx`,
`FacultyPages.jsx`, `tests/test_research_core.py`, `e2e/p114-research-gate.spec.js` (new), `e2e/p51-faculty.spec.js`, `.planning/STATE.md`,
`.planning/REGRESSION.md`, `CHECKLIST_PHASE_PLAN.md`, `DEFENSE_REVISIONS.md`. Schema: 5 new `DefenseVerdict` columns (reseed).
No ISSUES rows, no seed / `panel_demo_data.py` change, no Login / Demo Guide / forms / other boards touched.

## What v6.2-migui changed since the base (summary; details in the changelog)
Known-data rule, process audit I-264..I-352 (4 fix rounds), Demo Guide + autopilot (24 guides, `guides/` one file each),
edit anything with history (`RecordEdit`), manual fields to dropdowns, one 7-digit student ID (269xxxx personas), status
colours + legend, enrollment window, Reports by year started, Khloe's layout on graduation/practicum and five boards,
**Research Gate (I-361/I-362, b642a0f): staff and the Research Coordinator record / correct / confirm revisions for the
panel from a board card ("Record for the panel" dialog, reason required, "Recorded by ... for the panel" stamp, own route
`POST /api/research-gate/<schedule_id>/verdict`, fields `recorded_for_panel_*`); board = Khloe cards, 3 numbered columns
(3 = "Completion"), 8 cards per column then "Show all"**, audit rounds 3-4 (verdict standing check, chair sets room), deploy scripts.

## Where both sides touched the same thing
| Area | Git result | Same feature built twice? |
|---|---|---|
| `app.py` verdict model, verdict route, correction route, overview row, staff action | 7 conflict hunks | **Yes** - staff records the verdict for the panel |
| `ResearchGateOverview.jsx` | 6 conflict hunks | **Yes** - the three-column board |
| `StageBoard.jsx` | 4 conflict hunks | Column sizing: ours "as tall as its cards", hers fixed height + scroll + full width |
| `ResearchGate.jsx`, `FacultyVerdicts.jsx`, `FacultyResearchWorkspace.jsx`, `p51-faculty.spec.js`, `tests/test_research_core.py` | auto-merged | Hers adds the in-record staff form + five verdicts; ours adds edit-history / room fields - check tests that assert the verdict list |
| `.planning/REGRESSION.md` | conflict | Both added **R-030** - hers becomes R-034 |
| `.planning/STATE.md` | conflict | Keep both sides' blocks |
| e2e spec number | no git conflict | Both have a **p114** (ours `p114-demo-guide`, hers `p114-research-gate`) - hers becomes `p124-research-gate` |

## Owner decisions (grill-me, 2026-11-04)
| # | Question | Answer |
|---|---|---|
| M1 | Verdict choices | **Natalie's 5** at every stage (Passed; Passed with minor revisions; Provisional pass - revisions or re-defense + follow-up pick; Deferred; Failed). No Approved/Disapproved. |
| M2 | What Deferred does | **Natalie's**: Deferred and Failed reopen that stage's documents; student resubmits before rebooking. |
| M3 | How staff records a verdict for the panel | **Combine**: one rule set (reason required, "Recorded by ... for the panel" stamp, Graduate School staff **and** the Research Coordinator) reachable from both her form in the student's record and our "Record for the panel" card button. Her `recorded_by_*` audit columns stay (they name whoever pressed the button, chair or staff). |
| M4 | Can staff confirm revisions | **Ours: yes** - staff and the Research Coordinator may confirm revisions for the panel (reason + stamp). This replaces the "staff cannot confirm later revisions" line in Natalie's checklist item 48 / DEFENSE_REVISIONS note / R-030. |
| M5 | Board look | **Combine**: our Khloe cards inside her fixed-height scrolling, full-width columns; third column labelled "Final Defense". |
| M6 | Who is on the board | **Natalie's**: also students with research documents, a panel or a booking but no research case yet. |
| M7 | Branch name | **`v6.4-migui`** |

Mechanical (no owner choice): her R-030 becomes **R-034**; her `p114-research-gate.spec.js` becomes **`p124-research-gate.spec.js`**;
STATE.md keeps both sides' blocks; reseed after the merge (her 5 new `DefenseVerdict` columns).
