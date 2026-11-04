# Changelog — 2026-11-04 improvement and polish loop (session "known-data")

Branch: `v6.1-migui` until 13:3x, then `v6.2-migui`. Every item has its ISSUES row and a test.

## Landed
| When | What | Issues | Commit(s) |
|---|---|---|---|
| AM | Readmission: student ticks nothing; Handbook p. 45 checks (system: written intention, subject evaluation; staff: Business Office clearance, interview) | I-242, I-244 | 4991f9e |
| AM | Return from AWOL: last enrolled semester from records; next open semester preselected | I-243 | 4991f9e |
| AM | Student forms send no known data (student_id, term, defense type, school year, required hours); research title locked after title defense | I-245, I-246, I-250, I-251, I-253 | a9c18b5, 05a8e5a |
| AM | Monitoring adviser = faculty select; term taken = semester select (server checks) | I-247, I-249 | a9c18b5, 05a8e5a, 2d146b6 |
| AM | Staff screens: single choices shown as text (curriculum version, drop status, defense type, inbox recipient), semester/department pickers, batch number default | I-255..I-261 | cc8861a |
| midday | Process audit (12 agents): 88 confirmed findings I-264..I-351; 24 fixed (graduation route trust, Dean decision check, seed calendar, failed subject on readmission, residency term/tag, AWOL task/re-forward, reschedule venue, title verdict correction, doc/capture drift) | I-264..I-351 | 75b07ea..38dec58, pkt/audit-docs |
| midday | Live tunnel token kept out of git + guard test; uploads/ no longer tracked | I-330 | 5b3dfb4, c460f16 |
| midday | Demo Guide: in-app tutorial following the live record; 8 guides; sign-in "Start a guided demo"; one-click role switch | — | 729e330, ae4e635, 9e78f8c |
| PM | Demo Guide autopilot slideshow: Next performs each step with a gliding cursor; Take over; all 8 guides play end to end (p115) | — | 59d0c61 |
| PM | Leave extension start shown as text | I-254 | 44faece |
| PM | Manual fields round 2: School year dropdown (AY 2026-2027 → "26-27"), 7-digit ID warning, email/name checks, time-slot and venue pickers, date/hours limits, section and batch-year dropdowns, generated faculty password | I-353 (part), inventory B-rows | da83ef6 |

## In progress
- Edit anything with history (`pkt/edit-history`): RecordEdit table, Edit/Edited chip on every request, approval and message, every role. I-354.
- Stakeholder polish (`pkt/ui-polish`): one status colour vocabulary + legend, LOA card reason, enrollment OPEN/CLOSED banner, Reports "By year started" with three states. I-355..I-358.
- Demo Guide: side panel collapses during the slideshow so it never covers the form.

## Next
- Server checks for the new dropdowns (AY entry, email, names, mode/slots, dates, hours, section) + one student-ID format everywhere (seed, import, handoff, specs). I-353.
- Guides (with autopilot) for the missing processes.
- Full gate, push, Docker rebuild, final report.
