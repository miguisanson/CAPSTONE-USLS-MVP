# Changelog 2026-11-06 (branch `v6.4.1-test`, final polish loop day 2)

Plain list of what landed today. Rows are in `.planning/ISSUES.md`.

## Landed

- Cleanup: 16 merged worktrees removed (only `wt/f7` and `wt/gate` were left from yesterday).
- ISSUES triage: I-040, I-091, I-129 were already fixed (rows closed); I-064 partly fixed (Research Gate board done; Panel
  Matching and Defense Scheduling still open on the student picker).
- Persona round 5 (Dean on a phone, rarely-seen faculty, rushed staff, Academic Coordinator): rows I-396..I-411.
- I-402: the avatar shows the first and last name's initials and skips titles ("Dr. Liwayway Bautista" -> "LB", was "DL");
  the advisee limit says "a sixth advisee" (was "adviser").

- MERGED 751a6599 `pkt/f7` (Fable review 3, F7-01..09): research chips show the live research status; cancelling or
  re-confirming a defense updates the stored research case; past graduation history is seeded only on Completed students;
  the student assistant cites any source in plain words; Export CSV / Print on every process board and the Research Gate;
  stall warnings and the graduation forecast use the one "active student" definition; "View all" counts tasks only; a
  declined panel invitation cannot be accepted again (409); the open view hides finished withdrawals and graduations.
- MERGED 633839f0 `pkt/r5ui` (I-396 calendar card compact + empty-period line, I-397 "Documents to sign" + stage words,
  I-400 report tiles name their target + tappable stage names, I-401 phone menu padding + "Downloaded <file>" line).
- MERGED cf15996e `pkt/audit5` (I-408): Course Audit shows the subject roster with a count line and the students with
  missing subjects ("Take next"), read-only; completion comes from the AIMS export.
- e2e server: only temp folders older than 6 hours are removed (two worktrees running e2e broke each other).
- Targeted e2e on cf15996e: 86 passed, 1 failed (p126-follow5: two seeded students named Adrian Lim since F7-02) -> spec
  fixed 26369af2, 12/12.

- MERGED 042fe179 `pkt/srv6`: the homes' "At risk or delayed" counts active students, like Reports (I-403); plain words in
  the graduation report and class list (I-404); Panel Matching and Defense Scheduling list who is waiting (I-064).
- MERGED 056e5cf0 `pkt/lists5`: Students list fits at 125% zoom, wide tables show a scroll edge, compre hint in its column,
  Business Rules says "Not checked by the system" and shows rule codes to the admin only (I-406, I-410, I-411).
- Persona round 6 (thesis student): I-412..I-415.

- MERGED 3a9e2f4e ux6 (I-415 focus, I-398, I-399, I-405), 258b7634 srv7 (I-412 "Ready to Schedule", I-413, I-414),
  f93425ba awol6 (I-416, I-418 tone, I-419), 23eba331 stu6 (I-425, I-426, I-428), 1c454420 gate6 (I-424).
- I-422 fixed inline: the RC home said "undefined tasks past the due date" when Ready students were listed.
- Fable review 4 (`.planning/research/FABLE-REVIEW4-2026-11-06.md`): no P1; F8-01 spec fixed; F8-02..09 -> `pkt/f8`.
- Persona round 6 (thesis student, AWOL student, Research Coordinator, new student, admin): I-412..I-431. I-421 (P1:
  Title Defense "Panel is in place" with no panel) diagnosed, fix queued after f8.
- Full Python gate on 751a6599: 1,276 tests, 3 failed (seeded graduation history empty since F7-02 -> F8-04 in f8) + 1
  error (calendar test date-dependent on Fridays -> fixed 484b2ac8).

- MERGED 1d7f2b0d `pkt/alumni` (**RESEED NEEDED**): six past graduates carry the seeded graduation history; a defense
  without a matched panel waits for Panel Matching (I-421, P1); the Registrar's daily list has today's changes.
- MERGED a1770666 a11y6 (I-429, I-431), b8cc4e38 lists6 (I-430, F8-06), f49d1216 rep6 (I-407: Graduation tab, download line).
- Full e2e on bc28e87f: 1,082 passed, 14 failed (specs following today's changes, being fixed in `pkt/fix8`), 34 did
  not run; autopilot project 34/34 passed.

## In progress

- `pkt/ux6` (I-415, I-398, I-399, I-405), `pkt/srv7` (I-412, I-413, I-414), Fable review 4. Full Python gate on 751a6599.
