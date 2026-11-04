# Session report — meeting prep run, 3 Nov 2026 20:50 → 4 Nov 2026 08:30 (branch `v6.1-migui`)

Session `local_0845825f-fe9e-4422-b52b-d6b8bc762cfd`. Start commit `96d70ac`, end commit `8765903` (81 commits, all
pushed). Owner decisions this run: IM36 (public sign-in shows demo accounts; forms without draft mark; commit + push as
work lands), IM37 (owner away, agent decides). Owner later: leave the domain/Cloudflare to him; stop everything by 09:00.

The site is **OFF** (stopped 08:30 at the owner's request). Start it again with `deploy\START-SITE.cmd`.

## 1. What the owner asked for, and where it is

| # | Asked for | Where | How to check it |
|---|---|---|---|
| 1 | Demo recording of Migui's parts (slow, no audio) + script | `Documents/Capstone/Meeting_2026-11-04/videos/*.mp4` (local only, gitignored): 2d Monitoring Sheet 4:30, 2h-1 Leave of Absence 6:37, 2h-2 Readmission 4:28, 2h-3 AWOL 5:08, 2l Reports 4:24. Script `NARRATION-SCRIPT.docx/.pdf`, one `.srt` per video | Play each video with its `.srt`; read the script against the screens. Recorded 05:00-05:27 on the final night code, every step passed. 2m Best Features = spoken closing at the end of the script (no video) |
| 1b | Meeting cheat sheet | `Documents/Capstone/Meeting_2026-11-04/MEETING-CHEAT-SHEET.docx/.pdf` | Read; check the rule numbers you will quote (they come from `Documents/Graduate_School/Operations_Manual/operations_manual_rules.json`, Handbook page cites) |
| 2 | UAT instrument reviewed + improved, with a basis | `Documents/Capstone/UAT/[CAP-IT2] UAT Instrument - Revised.docx/.pdf`, `UAT-REVIEW-NOTES.md` | Compare with your draft; every change and its source is in the notes. Open questions the helper raised: meaning of "PROJECT CREATED" (replaced by "Version tested"), the data-privacy sentence (confirm with adviser), length (~40-55 questions per evaluator) |
| 3 | USLS forms/process documents for the Graduate School to sign | `Documents/Graduate_School/Forms/` — 44 forms GS-F-01..44, GS-P-01 Forms Approval Sheet, GS-P-02 Routing Guide, `USLS-GS-Forms-Pack.pdf` (82 pages, approval sheet first), `00-INVENTORY.md` | Inventory lists sources per form and 28 questions for the Graduate School. A second pass checked ~310 statements / ~160 cites against the Handbook and Research Protocol and removed ~20 unsourced claims. Layout checked in LibreOffice renders, not in Word |
| 4 | Natalie's `.env` / e-mail question | answered in chat + `README-FOR-MIGUI.md` | Send her a personal Gmail; she adds it as a Google **test user**. Owner decided not to test Google Calendar now |
| 5 | Docker server for miguisanson.dev | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `deploy/DOCKER.md`, `deploy/docker/entrypoint.sh`, `deploy/tunnel.env.example`; no-Docker path `deploy/START-SITE.cmd`, `deploy/RESET-DEMO-DATA.cmd`; official cloudflared at `E:\DevCache\cloudflared\` | **Docker was never built or run**: Docker Desktop cannot start because CPU virtualization (SVM Mode) is off in the BIOS (Ryzen 5800X / B550). The no-Docker path was run and checked (health, sign-in per role). Cloudflare dashboard steps: `README-FOR-MIGUI.md` / `deploy/DOCKER.md` part C — owner's job |
| 6-7 | Multi-agent improvement loop until morning | 13 fix packets, below | Test results below |

Entry point for the owner: `Documents/Capstone/Meeting_2026-11-04/README-FOR-MIGUI.md`.

## 2. Code changes merged on v6.1-migui (each after full gates)

| Packet | Issues | What changed (user-visible) |
|---|---|---|
| night1 | I-003 (pin), I-007, I-009, I-011 | demo reset also clears the student's panel-invitation answers; Dean pages reload approvals on page change; Student Handoff report panel reloads after an import |
| night2 | I-207 | all displayed dates/times through `frontend/src/lib/format.js` ("Aug 19, 2026, 10:46 AM", "9:00 – 10:30 AM"); "Return from AWOL" wording |
| night3 + night6 + night13 | I-215 F-12..F-14, I-241 | Policy Assistant: weak matches answer "not covered" (e.g. "password of the admin account"); "drop a class" finds withdrawal; Gemini prompt with passage delimiters + system instruction; only cited passages listed; leave-of-absence limit questions find Handbook p. 52; draft-manual rule codes "(RES-07 …)" removed from answers |
| night4 | I-219 | faculty Assigned Classes lists only subjects whose roster the faculty may open (was a 403 on page load) |
| night5 | I-222..I-225 | student home lists "Request your <defense> date"; Research Progress button/wording/subtitle fixed; Verified research files cannot be deleted by the student (server 409); Academic Coordinator sees Academic Semesters read-only; Enrollment explains why not-taken subjects are not offered |
| night7 | I-216 leftovers | a faculty member can no longer read another faculty member's .ics feed; staff-set/reset faculty passwords force a change (demo accounts excepted) |
| night8 | review F-25 | seed: research students without adviser 34 → 10; "Completed" waits for the Dean's graduation approval (Hector Ong, Isabel Flores now Final Defense) |
| night9 | I-220, I-207 | Dean phone footer buttons stay on one row; workflow pages no longer silently carry the last student over; every board's rules panel shows the same "N need review" line (wraps on phones) |
| night10 | I-237, I-238, I-239 | Graduation candidates report excludes Coursework students, "(to verify)" names what is missing; student record lists every outstanding subject; dashboard overdue tile says "past their due date" |
| night11 | Fable review P2s | no new defense request once that defense was held; Research Coordinator/staff can remove a student's research file (new DELETE route, API only); Dean graduation approval moves the student to Completed at once; minor wording/regex |
| night12 | — | dropped (refusal fallback conflicted with deliberate tests; not merged) |
| deploy | I-221 | `START-SITE.cmd` runs with `GOOGLE_API_KEY=off`: Gemini answered HTTP 503 all night; offline answers 0.1-0.6 s instead of 8-13 s |

Also merged: teammate **Myrine**'s timetable work (pushed 00:25-02:00, commits e7d7176..26c8892); ISSUES conflict resolved
(my rows renumbered).

## 3. Test results (latest)

- Full Python gate on the final code (`8765903` minus the last test-only fix): **983 tests, 2 failures** — the night8
  determinism test (fixed afterwards, test-only; passes now) and **Myrine's** `test_teaching_schedule.test_free_text_update_cannot_bypass_published_timetable` (I-236).
- Full browser (Playwright) suite on the final code: **786 passed, 3 failed** — Myrine's p110 and p84 specs (I-236: they pin the
  pre-26c8892 timetable UI) and the flaky p79 "pictures" timeout (I-235).
- Human-like persona runs on tonight's code: thesis student, Academic Coordinator, rushed GS staff, Dean (laptop). Their
  findings became I-222..I-225, I-237..I-241 and were fixed except the wording items in I-240/I-241.
- Two read-only Fable code reviews of tonight's changes: no code P1; their P2s were fixed (night6, night11).

## 4. What is NOT done / needs a person

1. **Cloudflare** (domain onto Cloudflare, tunnel token, route `http://localhost:5000`) — owner.
2. **Docker** needs SVM Mode in the BIOS; never built.
3. **I-236 (Myrine):** her 26c8892 removed the "approved/published timetable" guard on `PATCH /api/course-offerings/<id>` and the Schedule tab; her test and two specs still expect them. Restore the guard or update the tests.
4. **Gemini (I-221):** still failing at 06:30; site runs offline. Delete `set GOOGLE_API_KEY=off` in `deploy\START-SITE.cmd` to try Gemini again.
5. **The site stopped by itself twice** (≈06:10 and ≈08:15) with no error captured; restarted both times. Possibly another process stops Python. Check it before the meeting.
6. **Uncommitted files from another session** (about 17: Demo_Migui docs, `scripts/demo/narration.json`, `build_narration.py`, `build_cheat_sheet.py`, `scripts/docs/uat/build_uat_instrument.py`) — not touched by this session; whoever made them should commit or discard. NOTE: if those edits are kept, the narration script/cheat sheet/UAT builds differ from what this report describes.
7. Open issues for later: I-240 (term-wide enrollment overview, practicum numbers in Reports), I-241 wording, I-215 F-15, I-218 smarter assistant (owner reminder: the session after the next branch), the new staff DELETE route for research files has no button yet.

## 5. Housekeeping done

- Watchdog loop stopped; auto-resume registration handed back to BayoCoop (`E:\DevCache\dev-kit-workers\build-session.id`).
- Night worktrees removed; `pkt/night*` branches kept. A partly removed folder may remain at `E:\Github_Projects\CAPSTONE-USLS-MVP-wt\gatemy` (permission denied) — safe to delete.
- Demo database `usls_gs_demo.sqlite3` seeded 06:05 on 4 Nov (re-seed before UAT: `deploy\RESET-DEMO-DATA.cmd`).
- Logs: `E:\Temp\claude\gate-night\` (gates), `E:\Temp\claude\persona-uat\` (persona reports), `E:\Temp\claude\demo-rec\` (recordings).
