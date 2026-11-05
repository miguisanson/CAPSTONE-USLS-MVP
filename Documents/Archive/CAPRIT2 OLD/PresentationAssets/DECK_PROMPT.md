# Deck build prompt — paste this after restarting Claude Code

> Screenshots are already captured (74 PNGs) in `PresentationAssets/screenshots/`.
> You do **not** need to guide anyone through capturing them.

---

Use the /powerpoint skill to build a comprehensive, professional presentation deck for my capstone project.

## CONTEXT

- **App name:** USLS Graduate School Lifecycle Portal
- **What it does:** A role-based web application that gives the University of St. La Salle Graduate School one consolidated workspace for monitoring and coordinating the entire graduate student lifecycle — admission handoff, course offering, enrollment, coursework, research and defense, practicum, graduation endorsement, and standing changes (leave of absence, readmission, AWOL, residency, subject withdrawal). It replaces the manual per-program Excel monitoring sheet the Graduate School keeps today, and adds the audit trail, ownership tracking, and analytics that spreadsheets and email cannot provide.
- **Project location:** `E:\Github_Projects\CAPSTONE-USLS-MVP`
- **Platform / stack:** Python 3.12 + Flask 3.0 + SQLAlchemy (120 REST endpoints, 35 tables) · MySQL 8 · React 18 + Vite 5 + Tailwind CSS 3 · session-based auth with server-enforced RBAC across 8 account types · Google Calendar API for faculty availability · retrieval-augmented Policy Assistant
- **Audience:** Capstone defense panel, the academic adviser, and the client stakeholder (USLS Graduate School)
- **Purpose:** CAP-IT1 milestone defense — demonstrate the ~80% functional prototype, evidence it with real test results, and be candid about what remains for CAP-IT2

## SOURCE MATERIAL — read these first

| File | Why |
|---|---|
| `Documents/CAPSTONE_ONLY/Final Proposal Document - CAP-IT1.docx` | The written record. Ch4 The Existing System, Ch5 The Proposed System, Ch6 System Testing are the deck's backbone. |
| `NEXT_SESSION_PLAN.md` (repo root) | Verified remaining gaps + locked decisions. Use for the roadmap slides. |
| `Documents/CAPSTONE_ONLY/References_Context/FINAL BPMS/*.png` | 12 BPMN process models. |
| `Documents/CAPSTONE_ONLY/USLS GS Portal Demo Walkthrough.docx` | 8 demo scenarios — good structure for the feature journey. |
| `README.md`, `CHANGELOG.md`, `CHECKLIST_PHASE_PLAN.md` | Build history and the 92-item correction checklist. |

**Ignore** `References_Context/Conceptual Framework.png` — the project owner has confirmed that 8-module diagram is **wrong**. The correct framework is the **7 modules** described in the proposal (Ch1 §1.6.1): Student Progress Management · Case Status and Action Tracking · Defense Scheduling Management · Case Monitoring and Follow-Up · Analytics and Decision Support · Policy and Case Guidance · Reporting and Dashboards.

## SCREENSHOTS — already captured, do not re-capture

`Documents/CAPSTONE_ONLY/PresentationAssets/screenshots/`

- `window/` — 32 viewport captures (2880×1800). **Use these in the deck** — they are page-shaped and legible.
- `full/` — 36 full-page captures, some very tall. Use only if you need to show a whole long screen.
- `analytics/` — 6 captures of the new analytics reports.

All are real captures of the running system on the seeded dataset (371 students, 12 programs, 59 faculty). Frame each in a rounded device/browser bezel with Pillow before embedding.

Highlights worth featuring: `01-dashboard`, `06-monitoring-sheet`, `20-withdrawal`, `16-graduation`, `11-enrollment`, `09-course-adjustments`, `15-practicum`, `17-leave-of-absence`, `19-awol-residency`, `13-panel-matching`, `14-defense-scheduling`, `24-policy-assistant`, `32-student-portal`, `39-faculty-portal`, `30-dean-approvals`, plus `analytics/queue_aging`.

## STYLE

Dark, cinematic, professional. Title slide, section dividers, square bullet markers, screenshots in device bezels, a hand-drawn-feel architecture diagram and timeline, clean tables. No sample deck exists on disk — set the standard yourself. Commit to one visual motif and carry it through; no accent stripes or underlines beneath titles.

## CONTENT TO COVER

1. **Executive overview** — the problem (status scattered across AIMS, spreadsheets, forms, email; no consolidated cohort view), the solution, by the numbers (120 endpoints · 35 tables · 8 roles · 12 programs · 66 automated tests).
2. **The existing system & problem areas** — Ishikawa categories (Machine / Method / Man); the monitoring workbook records *completion only* and cannot express enrolled / incomplete / failed / dropped / withdrawn.
3. **Data boundary** — AIMS stays authoritative; file-based import; imported values read-only; discrepancies raised as flags, never overwritten. This is the single most important design constraint.
4. **Feature journey by lifecycle order** — handoff → course adjustments → offerings → enrollment → coursework/monitoring → research gate → panel matching → defense scheduling → practicum → graduation → standing changes. Screenshot each.
5. **Deep dives** — the consolidated monitoring sheet; subject-level withdrawal (penalty-free, first 7 days, Excel export → manual Registrar email); graduation endorsement; the analytics/KPI layer.
6. **Architecture** — three-tier diagram; server-enforced RBAC; transaction log as the basis for every derived indicator.
7. **Testing evidence** — 66 automated workflow tests, **65 pass**, 331 s, isolated SQLite. Report DEF-001 (demo-reset fixture defect) honestly. UAT instrument prepared but **not yet administered** — do not imply stakeholder validation.
8. **Roadmap / not production-ready** — from `NEXT_SESSION_PLAN.md`: G1 Student Handoff onboarding flow, G2–G4 enrollment (study plan draft, curriculum version tagging, student recommended subjects), G5 coursework→Dean report; plus the two open conflicts (BPMN4's Canvas step; BPMN2 assigning offerings to the Research Coordinator vs the app's Academic Coordinator) and the architecture-diagram divergence (diagram says Node/Express/Prisma/JWT/React-TS; built in Flask/SQLAlchemy/session/JSX — documented as deferred, not silently ignored).
9. **Key takeaways + closing.**

## HONESTY CONSTRAINTS (important — this is an academic defense)

- Say "approximately 80–85% complete functional prototype." Do **not** say production-ready, institutionally validated, or integrated with university systems.
- The Registrar exchange is a **manual** export + email. The system records that it produced a file; it never claims the file was sent or acknowledged.
- No live AIMS integration exists. Do not imply one.
- Report the failing test, don't hide it.

## DELIVERY

- Save the final `.pptx` to `Documents/CAPSTONE_ONLY/` (alongside the proposal and walkthrough docs).
- Keep `PresentationAssets/screenshots/` as the source images.

Please ask me your clarifying questions before you start building.
