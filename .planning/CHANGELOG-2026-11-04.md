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
| PM | Edit anything with history: RecordEdit table, `/api/edits/<entity>/<id>`, Edit / Edited chip + history on chats, requests, remarks and notes of every process, every role; Dean notes on AWOL and withdrawal in their own field | I-354 | b6b81c3 |
| PM | Status colours: seven meanings each with its own icon + "What the colours mean" legend; LOA card shows the reason; details window opens with reason and period; enrollment OPEN/CLOSED banner and controls off while closed; Reports "By year started" with On coursework / On thesis or dissertation / Graduated | I-355..I-358 | 82668c7 |
| PM | Demo Guide: `>` and the Right arrow make the app do the step; panel steps aside while it runs; Stop ends the demo | — | 9d01167 |
| PM | Khloe's graduation + practicum batch UI back on today's API: batch overview with stage checks, requirement boxes, numbered stages, practicum cards; shared `components/process/` | I-359 | 9c242c4 |
| PM | Live site: Docker always uses its own SQLite volume (a `.env` DATABASE_URL took it down); Start button restarts the tunnel when the public address does not answer | I-363, I-352 | 125ab29 |
| PM | One 7-digit student ID everywhere (STUDENT_NUMBER_RE; 28 demo students renumbered 269xxxx; handoff/import/portal refuse other formats) + server checks behind the new dropdowns (school year, email, names, defense mode/slots, dates, hours, sections) | I-353 | d4ef350 |
| PM | Khloe's layout on Leave of Absence, Readmission, AWOL, Withdrawal and Residency boards (numbered stage headers, shared case card with facts, ready mark, requirement boxes, newest message, View + Message); columns sized to their cards | I-360 | ef3de1a |
| PM | Research Gate: staff and the Research Coordinator record, correct and confirm the panel verdict, Form 7 and title for the panel (stamped, with reason and history); board with 1 Title Defense / 2 Proposal Defense / 3 Completion columns | I-361, I-362 | b642a0f |
| PM | Demo Guide: 11 more guides with autopilot (course adjustments, enrollment, dropping, policy assistant, handoff, business rules, policy documents, residency, calendars, portals, best features) | — | 9d3a4ac |
| PM | Server follow-ups: newest message on every board card, AWOL residence years, enrollment window enforced on every enrollment save (409 with the dates) and seeded, By-year-started student lists endpoint | I-355..I-357 | b09de19 |
| eve | Audit round 2 (10 rows): guide-state privacy, bell links per role, daily automatic leave/AWOL sweeps, monitoring edits refused for enrolled current-term subjects, readmission gap semesters flagged, practicum completion from records + certificate, gate documents only through the gate, student schedule request prefills staff booking, verdict/revision notices, coordinator home scope | I-341, I-336, I-270, I-275, I-267, I-286, I-280, I-282, I-289, I-339 | 0a8a94e |
| eve | Demo Guide: 5 research guides (title + Form 1, panel matching, scheduling, verdicts, proposal + final) played with `>` only, Panel Chair never signs in — 24 guides in all | — | 074327f |
| eve | Course Adjustments table fits again at 1366; e2e temp folder made automatically; deploy UPDATE-SITE + RESET-DEMO-DATA one-click scripts | I-331 | ac767cb |
| night | Audit round 3 (12 rows): "Skip date waits" needs a signed-in staff/Dean account; privacy notice enforced by the API; LOA Registrar task stays until export; second AWOL flagged; AWOL last enrolled at detection; residency closes at term end; defense lead time shown and enforced; Form 1 only at its gate; batch approve re-checks eligibility; verdict standing check; bulk term / future drop / export of withdrawn subjects | I-342, I-351, I-349, I-294, I-295, I-301, I-300, I-312, I-320, I-322, I-325, I-305, I-307, I-308, I-347 | 4865c02 |
| night | Audit round 4 (10 rows): practicum refused for AWOL/on-leave students; panel seats check the faculty's Panel Chair / Member role; booking warns about unanswered invitations; the chair sets the defense room or link (with history); one practicum review column; exported batch card; AWOL Registrar handoff tracking; stale demo data notice for staff; the Dean's assistant counts like the Dean home | I-290, I-283, I-314, I-318, I-321, I-328, I-329, I-296, I-332, I-340 | 83a7aeb |
| night | Docs follow the app (Reports and Dean Reports cases, setup, Docker) + Reports capture/video scripts; requirement boxes in the shared tones (no false error banners); one-click UPDATE-SITE proved itself (auto-reseed + tunnel restart) | I-338, I-343, I-344, I-350 | 3a8e213, 419ad84, f0e?? |

## In progress
- AWOL Registrar list on the AWOL board (`pkt/awol-registrar-ui`, I-296 UI).
- Final Python gate on 83a7aeb.

## Gates
- Full Python gate on 0a8a94e: 1,120 tests, 1 failure = known I-236 `test_teaching_schedule` (Myrine's teaching schedule).
- Full e2e (`npm run e2e`) on b9e91cf: 953 passed, 12 failed -> fixed: page sweep x5 (requirement boxes read as error banners), p117, p32; p112/p88 pass alone (cross-spec data, see I-364); known: p110, p84:376 (I-236), p79 flaky. Then 194/194 on 83a7aeb incl. the sweep for every role.
- Browser: every touched spec green on the merged code (p113-p122, p114/p115/p122 autopilot, p42, p77, p78, p84 except known I-236 line ~376, p86, p91, p93, p101, p116-p121).

## Next
- The open audit rows (I-264..I-352), highest first.
- Full e2e, push, Docker rebuild + reseed, final report.
