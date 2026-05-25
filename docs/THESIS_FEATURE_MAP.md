# Thesis Feature Map

This document maps the thesis proposal to the current implementation and the remaining full-scale app work. It should be treated as the product backlog source before adding new modules or changing the database.

## Target Modules

| Thesis module | Current implementation | Status | Next full-scale work |
|---|---|---:|---|
| User and Access Management | JWT login, roles, protected API routes, scoped student access checks, user admin | Partial | Add permission matrix tests per endpoint, password reset flow, account lockout/rate limits, and role/permission management UI. |
| Student Progress Management | Students, programs, lifecycle stages, milestone definitions, milestone status, student profile | Partial | Add formal stage gate validation, per-program lifecycle configuration, curriculum-aware readiness views, LOA/readmission screens, withdrawal and graduation workflows. |
| Case Status and Action Tracking | Tasks, decisions, routing rules, decision logs, timeline events | Partial | Centralize workflow transition logic in a domain service, enforce task closure only with decisions, show next-action owner consistently across screens. |
| Defense Scheduling Management | Schedule requests, availability, schedule events, status tracking | Partial | Add panel availability comparison, reschedule count/age metrics, schedule conflict checks, and calendar/export support. |
| Case Monitoring and Follow-Up | Alert thresholds, monitoring job, alerts, interventions, notifications | Partial | Add threshold test fixtures, LOA/residency alerts, escalation ownership rules, and false-positive review workflow. |
| Analytics and Decision Support | Descriptive analytics, CSV/report view, rule-based prescriptive recommendations, optional AI narrative | Partial | Add course offering decision support, residency/completion/attrition metrics, validated reporting definitions, and reporting query tests. |
| Policy and Case Guidance | Basic assistant endpoint behind feature flag | Early | Decide final RAG approach, keep policy documents source-controlled or indexed safely, return source-grounded answers only, log assistant usage. |
| Reporting and Dashboards | Dashboard, analytics page, printable report, CSV export | Partial | Add thesis-required report templates: subject needs, graduating students, LOA monitoring, residency tracking, completion summaries. |
| Audit Trail and Accountability | Append-only audit log model and audit viewer | Partial | Ensure every lifecycle transition, upload, decision, routing change, threshold change, and access denial has audit coverage. |

## Functional Requirement Coverage

| Requirement area | Covered now | Gap |
|---|---|---|
| Curriculum and study plan management | Program, curriculum, course, study plan, student curriculum tags exist in schema and seed data | Needs full UI and course audit logic. |
| Enrollment and coursework monitoring | Academic term, term enrollment, course enrollment exist | Needs coordinator views and eligibility logic. |
| Class offerings decision support | Not implemented as a dedicated feature | Add aggregation by required course, eligible students, remaining requirements, and planned offerings summary. |
| LOA and readmission monitoring | Lifecycle stage has `LOA`; student has LOA dates | Needs formal LOA request/readmission model or workflow, expiry alerts, and residency pause logic. |
| Thesis/dissertation monitoring | Research case, milestone events, adviser/panel assignments, documents, tasks exist | Needs stronger gate criteria and milestone event workflow UI. |
| Practicum/OJT tracking | Not implemented | Add only if program configuration marks practicum as required. |
| Withdrawal and graduation monitoring | `COMPLETED` stage exists | Needs withdrawal and graduation endorsement workflow, evidence checklist, and graduating list report. |
| Task processing and queues | My/team task queues exist | Needs workflow engine around routing rules and next-action ownership. |
| Decision recording | Decision logs exist | Needs stricter close-task-with-decision enforcement. |
| Document tracking | Checklist records, versions, comments, downloads exist | Needs checklist templates by stage/program and stronger current-version enforcement. |
| Scheduling tracking | Request, availability, event records exist | Needs defense-specific metadata and cycle-time metrics. |
| Dashboards and reports | Dashboard, analytics, CSV, print view exist | Needs thesis report templates and metric validation. |
| Alerts and interventions | Monitoring job and alert/intervention flows exist | Needs LOA/residency alerts and threshold validation tests. |
| Audit trail | Audit model and viewer exist | Needs complete coverage audit by module. |

## Database Direction

The current Prisma schema already matches most of the thesis ERD groups:

- Student and program context
- Identity, roles, and assignments
- Lifecycle and milestones
- Workflow tasks and decisions
- Documents and revisions
- Scheduling and coordination
- Monitoring, alerts, and interventions
- Auditability

For the full-scale app, the database should evolve through Prisma migrations only. Avoid manual MySQL edits unless they are turned into a migration immediately after.

## Implementation Priorities

1. Stabilize foundation: root scripts, documented module ownership, database migration workflow, API tests.
2. Build the workflow engine: centralize stage transitions, milestone gate checks, routing rules, task decisions, and audit logging.
3. Complete academic monitoring: curriculum tags, study plans, course audit, eligible subject counts, and enrollment signals.
4. Complete research pipeline: adviser designation, title/proposal/final defense workflows, revision cycles, manuscript finalization, certifications.
5. Complete scheduling: panel availability, confirmed/rescheduled/cancelled events, scheduling cycle-time metrics.
6. Complete monitoring: LOA, residency, prolonged stage, inactivity, delayed scheduling, unresolved handoff alerts.
7. Complete reporting: operational dashboards and exportable reports required by the thesis.
8. Add policy guidance/RAG only after the system has reliable structured records and approved source documents.
