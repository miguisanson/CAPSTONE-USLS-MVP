# Current Project Status

Status reflects the implementation verified on July 6, 2026.

| Area | Status | Current behavior |
| --- | --- | --- |
| Incomplete grade alerts | Full | Recording an INC creates an Academic Coordinator task and a dedicated student-visible Inbox notice with the deadline. Resolving it creates a completion notice. |
| Resolve incomplete | Full | A passing final grade marks the subject Completed, clears the deadline, and closes the pending INC task. |
| Automatic incomplete lapse | Full for the local application runtime | Missing deadlines default to one year. A background sweep runs every five minutes while the app is running. A lapsed INC becomes Retake Required with the handbook no-credit grade: 3.0 for master's or 2.0 for doctorate. The student and Academic Coordinator are notified. |
| Leave of Absence | Full | The student submits the application, staff runs policy review and forwards it, and only the Dean can approve, deny, or return it. Student standing changes only after Dean approval. |
| Readmission after LOA | Full | The student submits the return package, staff reviews and forwards it, and only the Dean can reactivate or return the request. |
| AWOL declaration | Full | Staff or the Academic Coordinator records AWOL after policy review. Registration standing is restricted and the student receives a notice. |
| Return from AWOL | Full | The student uploads written intent to enroll. Staff reviews it and forwards it to the Dean. The Dean approves, denies, or returns it. |
| Maximum-residence rule | Full | Master's: 5-year normal / 7-year absolute. Doctorate: 7-year normal / 9-year absolute. Extension-window returns require a graded 6-unit refresher; beyond the absolute limit remains AWOL and is escalated for full course re-enrollment. |
| Residency without subjects | Full | Staff can record residency only for handbook-supported thesis/dissertation, practicum/internship, INC, comprehensive-exam, or publication work. Invalid or uncertain cases require staff justification or LOA. |
| Policy review | Implemented for LOA, readmission, AWOL, and residency | Each review shows checks, recommendation, suggested action, and handbook citations. The decision remains with the authorized human role. |

## Remaining Deployment Caveats

- The incomplete deadline scheduler is an in-process scheduler. It runs automatically with `npm run dev`; a production multi-server deployment should move the same sweep function to one managed scheduled worker to avoid duplicate schedulers.
- AWOL and residency rules are grounded in the Graduate Programs Student Handbook 2022-2023. The Graduate School should confirm that these limits and procedures remain current before production use.
- Registrar actions are recorded as workflow handoffs; there is no live Registrar/AIMS integration.
- Existing seeded AWOL records without a historical case appear as legacy AWOL cases until a return intent or new staff review creates a full case record.
- The preferred “policy review + checks + citations + apply suggestion” pattern should be extended to other rule-heavy workflows as their authoritative policy sources and decision owners are confirmed.
