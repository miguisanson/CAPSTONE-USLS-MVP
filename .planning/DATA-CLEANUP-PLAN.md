# Demo data cleanup plan (owner 2026-11-22, decisions IM54)

Goal: a small, readable demo database - one login per role (plus the Demo Guide tour students and three tour
faculty), 63 students (IM55-IM56: the 20 below plus one card per board step, the panel queue and upcoming defenses),
all MAED except the practicum students (MSGC) - with every page, tour and Dean screen still showing a case.
Stage 1 inventory: `.planning/DATA-CLEANUP-INVENTORY.md`.

## Today (fresh seed, 2026-11-22)

- 167 students in 11 programs (MAED 39); 157 student logins, 12 faculty logins, one each for staff, Dean, Academic
  Coordinator, Research Coordinator, admin.
- Students and faculty come from imported sheets: `Documents/Sample_Data/Monitoring_Sheets/*` and
  `Documents/Sample_Data/Faculty_Sheet/Faculty_Roster.xlsx`; `seed_database()` in `app.py` imports them, then adds
  personas (`seed_maed_personas`), panel matching data, Dean review cases (`DEAN_DEMO_STUDENTS`) and the demo accounts.
- Tests that depend on the data: 20 of 122 e2e specs and 19 of 94 Python test files name a student; others count
  records (for example p113 known-data).

## Decisions (IM54)

| Question | Decision |
| --- | --- |
| Practicum (MAED has none) | Keep one MSGC practicum student (Paolo Ramirez, the Practicum tour) |
| Logins | student@ + the tour students; 1 faculty; 1 each for staff, Dean, both coordinators, admin |
| Faculty records | 6 (adviser, chair, members with some choice in matching); 1 with a login |
| Other programs | Definitions, curricula and rules stay; no students |

## The 20 students

| # | Student | Status shown | Used by |
| --- | --- | --- | --- |
| 1 | Miguel Yu (2260004) | Proposal development | Research title, panel matching, defense scheduling, verdicts, proposal/final tours |
| 2 | Maya Torres (2691001) | AWOL | AWOL tour |
| 3 | Joshua Lim (2690402) | Coursework | Dropping tour |
| 4 | Carlo Mendoza (2690302) | Completed, applying to graduate | Graduation tour |
| 5 | Daniel Fernandez (2690802) | Coursework | Leave of absence tour |
| 6 | Sofia Reyes (2690601) | New admit, not enrolled | Portals tour |
| 7 | Therese Lacson (2690901) | On leave | Readmission tour |
| 8 | Nicolas Valdez (2691101) | Residency | Residency tour |
| 9 | Elena Navarro (2690401) | Coursework | Withdrawal tour |
| 10 | Hector Ong (2360008) | Final defense, graduation list with the Dean | Dean graduation case |
| 11 | Paolo Ramirez (2690202), MSGC | Practicum | Practicum tour, Dean practicum case |
| 12-17 | Six existing MAED students | LOA with the Dean; readmission with the Dean; AWOL return with the Dean; withdrawal with the Dean; LOA approved; withdrawal denied | Dean review cases (re-pointed from MSN, MIT, MAN, MSCS students) |
| 18 | One MAED student | At risk in coursework | Monitoring tour (re-pointed from an MSN student) |
| 19 | One MAED student | Comprehensive exam due | Monitoring Sheet, Research Gate |
| 20 | One MAED student | Graduated | Graduation history, reports |

Rows 12-20 are picked in stage 1 from the 39 MAED students, preferring ones whose sheet rows already fit.

## Stages (each ends at a checkpoint for the owner)

1. **Inventory.** List every seed step, tour, Dean case, report and test that names a student or counts records;
   save the current data fingerprint (`scripts/db_fingerprint.py`); pick rows 12-20.
2. **New seed.** A trimmed MAED monitoring sheet (the 19 MAED students) and the MSGC sheet cut to Paolo Ramirez; the
   seed imports only those, still through the sheet import (AGENTS.md Rule 4, IM4: edit the seed, rebuild with
   `npm run seed`, no ALTER TABLE). Logins cut to the IM54 list; faculty roster to 6. Test first: a seed test asserting
   20 students, 19 MAED + 1 MSGC, one login per staff role, 6 faculty, every tour student present.
3. **Re-point.** `DEAN_DEMO_STUDENTS`, `DEAN_DEMO_PLANS`, the Monitoring tour, panel matching data and any persona
   seeding that names a removed student.
4. **Tests.** Update the e2e specs and Python tests that name removed students or count records, in batches by area
   (boards, Dean, student portal, reports, monitoring), each batch run before the next.
5. **Check.** Full gate (unittest, build, check:ui, e2e, e2e:negative), then the feature check again: the inventory
   script (`frontend/scripts/feature-inventory.mjs`) on old vs new data so every page still shows its actions, the
   journey tests (p115, p122, p146), and the measurement script for page sizes.

Risks: reports and charts look sparse with 20 students; the data fingerprint changes (teammates must reseed);
tests that pinned counts need new numbers; panel matching needs enough faculty with matching expertise.
