# Changelog

USLS Graduate School — Lifecycle Monitoring & Analytics Platform.
Newest first. Dates are when the work landed on the working branch.

## v2.0-merger (current)

Merge of all team branches (v1.8-khloe + v1.9) onto the v1.7 line, plus role and polish work.

### Added
- **Faculty login role + Faculty Portal** — faculty sign in and see their panel assignments
  (student, role, research title, defense schedule) and availability windows.
- **RAG Policy Assistant** (from v1.9) — retrieval over the policy corpus + handbook with cited,
  grounded answers; falls back gracefully when the optional AI libraries aren't installed.
- **BPM workflow engine** (from v1.8) — workflow timeline, auditable status transitions, and
  workflow messaging (return-for-revision, comments).
- **Course drop / grade workflow** — student drop requests, grade and Incomplete handling with
  deadlines, course-record grade fields.
- **Role-based sidebar** keyed to the signed-in role.
- **End-to-end demo simulation** — Student A (entry→graduation), Student B (LOA→Readmission),
  Student C (Withdrawal), 4 topic-matched faculty, real concept papers, Form 1 auto-fill,
  and a one-click "Reset demo data" control.

### Roles
- Working logins: Staff, Academic Coordinator, Research Coordinator, Dean, Student, Faculty.
- **Registrar removed as a system role** — registrar steps are external hand-offs recorded by GS Staff.

### Fixed
- Research-title reset bug — the title auto-filled from Form 1 no longer gets wiped by uploads.
- Comprehensive-exam gate now unlocks the research gate from the monitoring sheet's COMPRE column.
- PDF text extraction sanitized + length-capped so real PDFs store cleanly on MySQL.
- Form 1 sample regenerated as a valid, text-extractable PDF.
- Migration order fixed so data-repair runs after column-adding migrations.

### In progress (approved build queue)
- Incomplete → auto-fail + notify (4a)
- AWOL workflow + 5-year residency rule (7, 8)
- Residency clock (9)
- Retake tracking for comprehensive exam / proposal / final defense (10b, 10c)
- Practicum re-placement (12a)

## v1.9
- RAG assistant ("rag added"), course-audit changes; contains all of v1.8-khloe.

## v1.8-khloe
- BPM workflow rework, course-drop/grade workflow, role-based login/sidebar,
  academic_coordinator role, Form 1 PDF auto-parse, BPM workflow tests, updated AC research-gate role.

## v1.7-merger
- Merge of v1.6 (Natalie) into v1.4; comprehensive-exam gate, monitoring-sheet upload history,
  curriculum planning / course adjustment updates.

## v1.4–v1.6
- LOA / Readmission staff queues (submitted-requests view), defense scheduling, panel matching,
  research gate, faculty, Google Calendar availability (prototype).

## v1.0–v1.3
- Python (Flask JSON API) + React (Vite + Tailwind) rebuild; auth + roles; student portal;
  AC monitoring sheet importer; enrollment tags, units, eligibility; dashboard; decision support.
