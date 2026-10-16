# Ideas

From the reference-portal research (`research/REFERENCE-PORTALS.md`, 2026-10-17) and from
reviews. Per IM13: **cheap** ideas (frontend-only or one small endpoint, no new table, no change
to a workflow rule or role permission, under ~150 changed lines) are built by improvement mode
and folded into the matching roadmap phase. **Everything else waits for the owner's pick.**

## Cheap — agents build these (no owner pick needed)

| ID | Idea | Seen in | Lands in |
|----|------|---------|----------|
| X-01 | One status-chip color map used by every table and card (one file mapping each status to a color + label). | Carbon, GOV.UK | Phase 5 design system |
| X-02 | Stage stepper / milestone tracker on the student dashboard and student detail, built from data the app already has. | Purdue, Northwestern, McGill | Phase 5 |
| X-03 | One shared data table (sort, filter, pagination, CSV export) replacing per-page tables. | shadcn data table, Vanderbilt | Phase 5 |
| X-04 | One decision panel component for every existing approve / return / reject action (same buttons, same comment box). Only where those actions already exist — no new actions. | Vanderbilt, ProQuest | Phase 5 |
| X-05 | Show the existing history / audit trail the same way on every record (`HistoryDisclosure`, `WorkflowTimeline` already exist). | Slate, Cayuse | Phase 5 |

## Needs the owner's pick

My recommendation order is the order below. Reply with the IDs you want.

| ID | Idea | Why it is not "cheap" | Value | Effort |
|----|------|------------------------|-------|--------|
| X-06 | **"Needs my action" landing page per role** — one list of every item waiting on the signed-in user, with deep links. (`WorkQueue.jsx` may already cover part of it — to check.) | May need a new aggregate endpoint across all workflows | High: one screen that tells each role what to do; strong demo story | Low–Med |
| X-07 | **Automatic reminders** before milestone and deadline dates (in-app notifications; email only if SMTP is ever added). | New scheduled behaviour and notification rules | High: answers "deadline reminders" directly | Low–Med |
| X-08 | **Visible prerequisite gating**: every blocked step shows "cannot start yet: needs X" (e.g. no defense scheduling before adviser sign-off and ethics clearance). | Touches workflow rules; must match the Graduate School Handbook | High | Med |
| X-09 | **"Send back" with a chosen target step** on every approval chain. | Changes workflow rules | Med | Low–Med |
| X-10 | **Requirements met vs remaining** view per student with an on/off-track flag, fed by the AIMS import. | New computed view, rules from the curriculum | Med | Med |
| X-11 | **Annual progress review** form with adviser sign-off and a short rubric. | New table and workflow | Med | Med — defer if time is short |

**Skip (from the research):** what-if degree audits, a repository publication/embargo pipeline,
a Slate-style reader, a certified e-signature vendor (typed-name approval + timestamp + audit
entry is enough).
