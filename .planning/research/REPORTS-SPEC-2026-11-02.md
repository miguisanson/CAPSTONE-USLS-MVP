# Reports & Analytics redesign spec (I-141, 2026-11-02)

Research by a Sonnet helper against app.py, the React pages and the demo DB (148 students). Owner asked: "it needs to
be MORE make sense and more useful ... look online for references".

## 1. What is wrong now
1. Two pages share one name: staff/coordinators get `Reports.jsx` (five tables, Registrar list, four charts); the Dean
   gets `DeanAnalyticsPage`, whose numbers are added up in the browser. Research Coordinator and Faculty have none.
2. The four charts (stage, risk, college, research gate) count but do not guide: no target, no past-term comparison,
   no next action. "Students by college" leads nowhere; the risk chart repeats the at-risk tab.
3. `/api/reports` and `/api/reports/analytics` (queue aging, stage bottlenecks, owner workload, completion/attrition,
   scheduling cycle) are called by no screen; their nine "KPIs" measure the system, not the school.
4. "Time in stage" is wrong: `student_indicators()` uses `Student.updated_at`, so any edit resets it; "days late"
   inherits it. `TransactionLog` has only 43 rows.
5. Cohorts by stage is a 13-column grid that cannot answer "what share of the 2023 cohort finished, left, is going".
6. Overdue mixes tasks with requests; Defenses has no throughput, pass rate or "verdict missing".
7. Dean: "Approval share" uses recent decisions only; "Average wait" covers pending only; "Pending load by program"
   leads to no action.
8. The Registrar's daily list sits inside Analytics.
9. Record gaps hide in the numbers: 48 research-stage students, 17 with a `ResearchCase`, 34 without `AdviserAssignment`.

## 2. Principles (sources in section 6)
One question per chart, every number with context (target or past period), clearly defined measures (Few). Every count
opens the students behind it (EAB, PeopleSoft "My Advisees"). Time = median and p90, never mean alone (CRA,
queue analytics). Stage clocks with green/yellow/red zones against expected time (Pitt). Cohort completion cumulative by
years since entry, with "still enrolled" (CGS). Drop useless dashboards (Open University graded its own).

## 3. Summary strip (6 numbers on staff and Dean pages)
| # | Number | Definition | Compared with |
|---|---|---|---|
| 1 | Active students | `standing='Active'`, stage not Completed/Withdrawn | previous `AcademicTerm` enrollment |
| 2 | Behind schedule | `risk_level` in `AT_RISK_LEVELS`, % of active | target in Business Rules (10%) |
| 3 | Requests waiting > 7 days | open cases from `queue_aging_report` | target 0 |
| 4 | Median days to decide | closed this term, start to close | last term |
| 5 | Defenses | held this term / next 30 days / awaiting verdict | last term |
| 6 | Graduation-ready | `graduation_eligibility()` ready + endorsed this term | last term |
Each tile opens its list; with no earlier term it says "no earlier term yet".

## 4. Reports by audience (all drill to a student list; filters program, entry cohort, term; Excel + PDF)
**Dean.** D1 Waiting for my decision (CHANGE): open Dean-stage cases per process, age since forwarded
(`LeaveCase.forwarded_at`, `WithdrawalApplication.updated_at`, `GraduationEndorsement.submitted_at`,
`AdviserAppointment.forwarded_at`, `CourseworkReport.sent_at`, `OnboardingReview.submitted_at`, `AwolCase`), stacked
age bands 0-3/4-7/8-14/15+ days, server-side. D2 How fast decisions are made (NEW): median/p90 forwarded→decided per
process, this vs last term, target line. D3 Outcomes this term (CHANGE): approved/returned/denied per process. D4
Graduation pipeline (NEW): candidates → ready → endorsed → decided → received by Registrar. DROP pending load by program.

**GS Staff / Records.** S1 Students who need attention (CHANGE): causes from `student_delay_assessment()["causes"]` +
table with stage, reason, days, next owner. S2 Where students get stuck (CHANGE): per stage median days, count past
`STALL_WARN_DAYS`/`STALL_HIGH_DAYS` (needs B1). S3 Cohort outcomes (CHANGE): per entry year Completed/Active/On
leave/AWOL+Withdrawn, 100% stacked; old grid = drill-down. S4 Office cycle times (NEW): per `QUEUE_PROCESS_AREAS`
median/p90 + open by age band (reuse `queue_aging_report`). S5 Overdue and waiting by office (CHANGE): tasks split from
requests, by `next_owner`. S6 Enrollment and graduates per term (NEW, CHED-style; confirm columns with Registrar). S7
Graduation candidates (KEEP + "what is missing" bar). S8 Records to fix (NEW): research-stage students with no
`ResearchCase` or no active adviser. S9 Registrar daily changes (KEEP, own page). DROP students by college, research
gate chart (→ R1), system KPIs.

**Academic Coordinator.** A1 Coursework progress (NEW, `CourseRecord.status`, `Course.recommended_term`). A2
Comprehensive exam by cohort (NEW). A3 Subject needs, A4 Overdue tasks (KEEP).

**Research Coordinator (new Reports access).** R1 Research pipeline by gate with days in gate. R2 Defense throughput
(held, `DefenseVerdict.result`, median request→defense, verdicts missing, revisions not confirmed). R3 Next 30 days with
panel-complete check. R4 Adviser and panel load vs cap (confirm the cap rule exists).

**Faculty (if time).** F1 My advisees: stage, days in stage, next action.

## 5. Build order (~300 lines each; backend packets one at a time in app.py)
| # | Packet | Side | Proof |
|---|---|---|---|
| B1 | Real stage clock: additive `StudentStageEvent` via one `before_update` hook on `Student.current_stage`; backfill from `TransactionLog`; seed dates | backend | stage change resets clock, other edits do not |
| B2 | Summary strip endpoint with targets | backend | exact numbers on a fixture |
| F1 | Shared page frame: strip, filters in URL, tabs per role, Research Coordinator route | frontend | each role sees its tabs; filters survive reload |
| B3/F2 | S1, S2, S8 + views with click-to-list | both | counts per cause; bar click opens list of same length |
| B4/F3 | S3, S6 + views, xlsx/pdf | both | shares add to 100%; xlsx rows = screen |
| B5/F4 | D1-D3, S4; Dean page rewrite (D1-D4) | both | median/p90 on known timestamps; Dean tile = Dean home (I-074) |
| B6/F5 | R1-R4 + Research Coordinator tabs | both | advisee counts match `AdviserAssignment` |
| B7/F6 | A1, A2, S5 split + Academic Coordinator tabs | both | unittest + Playwright |
| B8 | Optional weekly `ReportSnapshot` for real trends; faculty view | both | one snapshot per day |
Remove the unused `/api/reports` and `/api/reports/analytics` only after the matching packet replaces them. No path that
edits AIMS data (Rule 4). Schema changes stay additive and go into the seed (IM3/IM4: no startup patching).

## 6. Sources
- CGS Ph.D. Completion Project: https://cgsnet.org/wp-content/uploads/2022/01/phd_completion_and_attrition_analysis_of_baseline_demographic_data-2.pdf , https://cgsnet.org/?p=2002
- Open University PGR Manager dashboards: https://university.open.ac.uk/students/research/system/files/documents/PGR%20Manager%20Dashboards-.pdf
- Pitt Physics PhD milestones: https://www.physicsandastronomy.pitt.edu/node/434
- CRA time to degree: https://cra.org/crn/2014/04/time_to_degree_in_computing
- EAB Navigate review: https://eab.com/wp-content/uploads/2021/08/EAB-Navigate-Product-Review.pdf ; U. Houston: https://www.uh.edu/provost/_documents/provost-presentations/2017.01.20-advising-presentation.pdf
- PeopleSoft milestones (Princeton): https://amt-info.princeton.edu/person-record/milestone ; UNI My Advisees: https://advising-portal.uni.edu/sites/default/files/inline-uploads/advisor-reports-my-advisees-workspace.pdf
- Few's dashboard mistakes: https://www.thedataschool.co.uk/anh-vu/are-you-making-these-13-dashboard-design-mistakes/ ; https://uxmatters.com/mt/archives/2007/04/book-review-information-dashboard-design.php
- Oracle approval cycle time: https://docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcaa/dashboard_wf_approval_cycle_time.html
- Queue analytics: https://us.fitgap.com/stack-guides/improve-sla-predictability-with-queue-analytics-and-bottleneck-aware-staffing
- Slate scope (Texas State): https://services.txst.edu/TDClient/55/global/Requests/ServiceDet?ID=735
- CHED CMO 15 s.2019: https://legaldex.com/laws/policies-standards-and-guidelines-for-graduate-programs ; CHED data: https://www.foi.gov.ph/agencies/ched/?page=10
- Early-alert caution (AAC&U): https://dgmg81phhvh63.cloudfront.net/content/user-photos/Initiatives/Presidents-Trust/Essentials/34-AACU_PT_Essentials_07-25-24.pdf

Limits: Few's book and CHED templates not read; EAB/Slate material is vendor-side. S1 shows reasons and owner; no
automatic nudges.
