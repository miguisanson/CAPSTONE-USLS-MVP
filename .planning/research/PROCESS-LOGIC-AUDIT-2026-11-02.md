# Process logic audit vs policy (I-143, 2026-11-02)

Read-only Sonnet audit; findings marked (ran) were reproduced on a seeded scratch DB (`E:/Temp/claude/audit-logic/h.py`).

## Panel N1 "can a student drop on Day 1?"
Withdrawal (student's own): allowed from term setup through day 14 inclusive (term start + 13), 10% fee days 1-7, 20%
days 8-14; after day 14 the server refuses with 409 citing Handbook p.49 (app.py ~3784-3880, ~13910-13940). Server-side
(ran). Dropping for absences: only the Academic Coordinator, only when unexcused absences > 20% (Handbook p.52), server
refuses <= 20% and points to Withdrawal (~16599-16622). So: Day-1 withdrawal yes, Day-1 drop no.

## Findings -> ISSUES rows I-159..I-174 (P1 first); P3 list kept here
P3: 14-day rule applied as a student task not the panel's review period (policy Q); no re-defense cap (policy Q);
Public Final Defense/Form 8 not modeled (policy Q); DRP 5.0 ignores Handbook p.54 "5.0 drops from program" (policy Q);
`end_residency` forces "Enrolled" and can overwrite On Leave (~30575); residency checker skips prior thesis semester
(p.48); AWOL return classified by today's years; graduation export silently drops ineligible candidates (~14950);
`student_enrollment_block_reason` ignores Dropped; loa.min_completed_semesters advisory only; Course Adjustments plan
with only "Suggested" rows would delete offerings (API-only); Dean withdrawal approval sets dean_decision before an early
400/409; reschedule drops manuscript_received_on; venue conflict for online "Zoom"; re-endorsing Form 1 moves lead-time
reference; change-of-adviser decision does not re-check "before proposal defense".
Questions for the Graduate School: comprehensive exam before adviser appointment? rejected change-of-adviser counts as
the one change? panel-load cap? weekends/holidays? external panelist approval? PhD Psych practicum before comps?
"withdraw all subjects" path (I-167)? drop "documented exception" (I-170)? title lead-time waivable (I-174)?
