# Demo data cleanup - stage 1 inventory (2026-11-22)

Fresh seed of commit e8b54b5 (`npm run seed`): fingerprint
`6deed057d30067078b09618ab7c28db872ea6c6d4cd2588e9940b8f821fe25e1`.

## What the seed holds today

| Kind | Count | Where it comes from |
| --- | --- | --- |
| Students | 167 (34 MAED) | 126 from the monitoring sheets, 41 demo personas (`panel_demo_data.DEMO_STUDENT_NUMBERS`, numbers 269xxxx) |
| Student logins | 151 | sheet students and personas |
| Faculty | 12 records, 12 logins | `Faculty_Roster.xlsx` |
| Other logins | staff, Dean, Academic Coordinator, Research Coordinator, admin (1 each) | `ensure_demo_accounts` |
| Cases | 23 leave, 7 AWOL, 18 withdrawal, 13 graduation, 23 practicum, 71 research, 80 panel seats, 20 tasks | seed steps below |

## Seed steps that name students

| Seed step (`app.py`) | Students | Purpose |
| --- | --- | --- |
| `WORKFLOW_DEMO_STUDENTS` + `seed_maed_personas` | tour personas (two per process), Miguel Yu, Isabel Flores, Elena Mendoza, Adrian Lim, Hector Ong, Paulo Garcia, Benjamin Santos, Clarisse Tan, Maria Dela Cruz, Daniel Cruz, Grace Reyes | Demo Guide tours and the staff-side cases on the boards |
| `seed_dean_review_cases` (`DEAN_DEMO_STUDENTS`, `DEAN_DEMO_PLANS`) | Lorenzo Reyes MSN, Hazel Castillo MIT, Noel Navarro MAN, Hazel Flores MAN, Isabel Mendoza MAPSY, Hector Ong MAED, Olivia Cabrera MSCS, Gian Lacson MSN; plans for MIT and MSN | Cases waiting for or decided by the Dean |
| `seed_stage_ready_cases` (`STAGE_READY_*`) | Graduation 4 (GRAD-05..08), Practicum 7 MSGC (PRAC-03..09), Withdrawal 2 roster students | One card on each board step (owner 11-19) |
| `EXPORTABLE_GRADUATION_STUDENTS` | GRAD-03, GRAD-04 | A Dean-approved batch ready to export |
| Panel matching (`ensure_panel_matching_demo_data`) | PM-01..07 across MSN, MAPSY, MSCS, MBA, DBA | Students waiting for a panel |
| Upcoming defenses (`UPCOMING_DEFENSES` clones) | UD-01..03 (MBA, DBA) | Calendars, faculty home, reminders |
| `PAST_GRADUATES` | 6 students 2260901-906 across programs (one MAED: Angelica Pascual) | Graduation history in earlier terms |
| `PRACTICUM_HOURS_CHECK_STUDENT` | Nicole Alvarez MAPSY | Practicum hours check |
| `seed_bianca_mendoza_enrollment` | Bianca Mendoza DBA | Enrollment demo |

## Tours and their logins

| Tour | Student | Login |
| --- | --- | --- |
| Research title, panel matching, defense scheduling, verdicts, proposal/final | Miguel Yu | student@ |
| AWOL | Maya Torres | awol.maya@ |
| Dropping | Joshua Lim | (staff only) |
| Graduation | Carlo Mendoza | graduation.carlo@ |
| Leave of absence | Daniel Fernandez | loa.daniel@ |
| Portals | Sofia Reyes | handoff.sofia@ |
| Readmission | Therese Lacson | readmission.therese@ |
| Residency | Nicolas Valdez | (staff only) |
| Withdrawal | Elena Navarro | withdrawal.elena@ |
| Practicum | Paolo Ramirez (MSGC) | practicum.paolo@ |
| Monitoring | Katrina Cabrera (MSN) | (staff only) |
| Faculty logins used by tours | Liwayway Bautista (portals, policy assistant), Angela Cruz (calendars), Celeste Tan (proposal/final) | three faculty logins |

## Tests that name students

56 students are named in tests or tours. Most named: Miguel Yu (19 files), Isabel Flores (18), Hector Ong (13), Therese
Lacson (11), Elena Navarro (10), Andrea Villanueva MAPSY (9), Maya Torres (9), Paolo Ramirez (8), Benjamin Santos (7).
Full map of student to test files: `.planning/data-cleanup-test-refs.json`.

## Proposed 20 (fits IM54 exactly)

| # | Student | Shows | Replaces |
| --- | --- | --- | --- |
| 1-9 | Miguel Yu, Maya Torres, Joshua Lim, Carlo Mendoza, Daniel Fernandez, Sofia Reyes, Therese Lacson, Nicolas Valdez, Elena Navarro | the tours | - |
| 10 | Hector Ong | graduation list with the Dean | - |
| 11 | Paolo Ramirez (MSGC) | practicum tour | - |
| 12 | Benjamin Santos | leave with the Dean | Lorenzo Reyes MSN |
| 13 | Maria Dela Cruz | readmission with the Dean | Hazel Castillo MIT |
| 14 | Clarisse Tan | AWOL return with the Dean | Noel Navarro MAN |
| 15 | Adrian Lim | withdrawal with the Dean; at risk (Monitoring tour) | Hazel Flores MAN; Katrina Cabrera MSN |
| 16 | Isabel Flores | final defense done, research verified | - |
| 17 | Elena Mendoza | residency, research with missing requirements (Research Gate) | - |
| 18 | Gabriel Domingo | leave the Dean approved (on leave) | Olivia Cabrera MSCS |
| 19 | Grace Reyes | withdrawal the Dean denied | Gian Lacson MSN |
| 20 | Angelica Pascual | graduated (graduation history) | 5 past graduates in other programs |

## What 20 students cannot keep (needs an owner decision)

- **A card on every board step** (owner 11-19): Graduation 4 + the exportable batch 2, Practicum 7 (all MSGC),
  Withdrawal 2. With 20 students the boards show the tour students and the Dean cases; the other steps fill as a
  tour is played.
- **Practicum beyond Paolo**: the Dean's practicum case (Isabel Mendoza MAPSY) and the hours check (Nicole Alvarez
  MAPSY) are other programs; the Dean's Practicum page is empty until the Practicum tour runs.
- **Panel matching queue**: 7 students waiting for a panel become 1 (Miguel Yu).
- **Upcoming defenses**: the 3 clones go; calendars and the faculty home show no defense until the scheduling tour.
- **Faculty logins**: the tours sign in as three faculty, not one.

## Owner decision (IM55, 2026-11-22)

Keep every step: about 45 students - the proposed 20, plus Graduation GRAD-03..08 (6), Practicum PRAC-03..09 (7, MSGC),
the 2 Withdrawal step students, the 7 panel-matching students and the 3 upcoming-defense clones (both moved to MAED).
Three faculty logins stay for the tours. Stage 2 lists the exact set, each with its purpose, before the seed changes.

## Exact list for stage 2 (61 students)

| Group | Students | Program | Source |
| --- | --- | --- | --- |
| Tours (quick-login pairs) | Miguel Yu 2260004 (student@) - research, panels, defenses, verdicts | MAED | sheet |
| Tours (quick-login pairs) | Andrea Villanueva 2690201, Paolo Ramirez 2690202 - practicum | MAPSY, MSGC | persona |
| Tours (quick-login pairs) | Bianca Santos 2690301, Carlo Mendoza 2690302 - graduation | MAED | persona |
| Tours (quick-login pairs) | Elena Navarro 2690401, Joshua Lim 2690402 - withdrawal, dropping | MAED | persona |
| Tours (quick-login pairs) | Clarissa Dela Cruz 2690501, Martin Gonzales 2690502 - enrollment | MAED | persona |
| Tours (quick-login pairs) | Sofia Reyes 2690601, Anton Bautista 2690602 - student handoff | MAED | persona |
| Tours (quick-login pairs) | Lianne Mercado 2690701, Roberto Aquino 2690702 - course adjustments | MAED | persona |
| Tours (quick-login pairs) | Maureen Castillo 2690801, Daniel Fernandez 2690802 - leave of absence | MAED | persona |
| Tours (quick-login pairs) | Therese Lacson 2690901, Gabriel Domingo 2690902 - readmission | MAED | persona |
| Tours (quick-login pairs) | Maya Torres 2691001 - AWOL; Nicolas Valdez 2691101 - residency | MAED | persona |
| Board step cards | Graduation: Ramon Villareal, Teresa Javellana (export batch), Marco Lacuesta, Nina Ledesma, Paula Gatuslao, Javier Montelibano (2690303-308) | MAED | persona |
| Board step cards | Practicum: Lara Uy, Miguel Torres, Irene Jacinto, Enrico Salazar, Jerome Lopez, Nicole Villanueva, Martin Gonzaga (2690203-209) | MSGC | persona |
| Board step cards | Withdrawal steps (tag, Excel export): Daniel Cruz 2560001, Grace Reyes 2560002 | MAED | sheet |
| Board step cards | Staff-side cases: Benjamin Santos (LOA), Maria Dela Cruz (readmission), Clarisse Tan (AWOL return), Paulo Garcia (AWOL declared), Adrian Lim (withdrawal; at risk - Monitoring tour), Isabel Flores (graduation For Review), Elena Mendoza (residency; Research Gate) | MAED | sheet |
| Dean cases | Hector Ong 2360008 - graduation list with the Dean | MAED | sheet |
| Dean cases | Isabel Mendoza 2360101 - practicum report with the Dean; Nicole Alvarez 2360092 - practicum hours check | MAPSY | sheet |
| Dean cases | 6 new MAED demo students (2691301-306): LOA with the Dean, readmission with the Dean, AWOL return with the Dean, withdrawal with the Dean, LOA approved, withdrawal denied - replace Lorenzo Reyes, Hazel Castillo, Noel Navarro, Hazel Flores, Olivia Cabrera, Gian Lacson | MAED | new persona |
| Panel queue | Camille Dizon, Rafael Ocampo, Jasper Lorenzo, Bea Fontanilla, Miko Almario, Liza Marquez, Nico Baltazar (2690101-107) | moved to MAED | persona |
| Upcoming defenses | Nico Barrientos, Bea Salonga, Gab Tolentino (2691201-203) | moved to MAED | persona |
| Graduated | Angelica Pascual 2260904 (graduation history); the other 5 past graduates go | MAED | seed |

By group: Tours (quick-login pairs) 19, Board step cards 22, Dean cases 9, Panel queue 7, Upcoming defenses 3, Graduated 1. Total 61.

Goes: the other 112 imported students (all of MBA, MSN, MIT, MSCS, DBA, EDD, MAN, MASS, MSGC sheet rows and the rest of MAPSY), Katrina Cabrera (Monitoring tour moves to Adrian Lim), Bianca Mendoza's DBA enrollment demo, 5 past graduates. Their programs, curricula and rules stay (IM54).
