# Critical Web App Checklist Phase Plan

## Implementation log (kept current)

Decisions locked with the project owner (2026-07-20):
- **Plan:** keep and refine this document (not rebuilt).
- **AIMS access:** authorized **export/import workbook**; official values are **read-only** in this app; corrections via exception reporting.
- **Official data read-only:** enforced (removed the editable monitoring sheet).
- **Pace:** phase by phase, P0 first.

Phase 1 progress:
- Items **7, 29, 71** (official data read-only): **Done** — the monitoring sheet no longer has edit-mode/click-to-cycle/remove; it is view/filter/export only.
- Item **8** (source provenance): **Done (initial)** — a "Read-only · Source: AIMS export · <semester>" banner labels the official values. (Per-value provenance panel still to expand.)
- Item **72** (exception reporting): **Done (initial)** — per-row "Flag issue" records a discrepancy to the activity log (`aims-discrepancy`) without changing the official value.
- Items **13, 14** (duplicate detection / integrity): **Partial** — an enrollment↔profile sync/integrity banner exists on the monitoring sheet.

- Items **2, 5, 66** (manual student creation): **Done** — removed the manual "add a student" form from Student Handoff; students come only from the AIMS export import. (Full nav/title rename to "AIMS Export Import" still pending.)
- Items **11, 74** (risk): **Done** — newly admitted students (Admission stage, no coursework) are **"Not Yet Assessed"** instead of a default Low/Medium.
- Items **17, 78** (optional drop PDF): **Done** — removed the "Optional drop form/supporting PDF" upload from the student drop request.
- Items **19, 79, 227** (drop has no Deny): **Done** — removed the Reject/Deny option; a drop is now **"Record drop" → status "Recorded" (awaiting AIMS update)**, not "Approved/Rejected".

Still open in Phase 1: 3/67 (student-number generation/edit lockdown — numbers already come from the import; verify no edit path), 4 (admission external reference), 9 (fuller value-change audit trail beyond existing prev/new status). Phase 2 remaining: 16/75 (verify no generic course-readiness/prerequisites), 20/82 (fully separate enrollment vs grading), 21/80/81 (AIMS-only grade source, no manual grade entry), 25 (no invented grade deadlines).

## Scope and authority

This is the implementation and acceptance roadmap for the **Complete Critical Web App Issues Checklist, items 1–92**, received on **2026-07-20**.

The updated stakeholder-confirmed answers are authoritative. They override conflicting assumptions in the current application, earlier checklists, the proposal, consultation notes, seed data, and previous implementation decisions.

The most important confirmed architectural rule is:

> **AIMS is the official source for student identity, enrollment, enrolled subjects, grades, and course-completion status.**

The Graduate School lifecycle application is a monitoring, coordination, exception-reporting, and decision-support layer. It must not present locally generated or manually edited data as an official AIMS value.

The integration boundary confirmed on **2026-07-20** is an **external file export/import process**:

- AIMS remains an entirely separate USLS system.
- This project will not build an AIMS clone, AIMS demo portal, AIMS login, screen scraper, or unapproved live API integration.
- Authorized personnel export an approved workbook from AIMS and import it into this application.
- Imported official values are read-only in this application.
- Corrections are reported as discrepancies, performed in AIMS by the proper office, and reflected here through a later replacement export/import.
- Until USLS supplies an official export layout, this project provides a clearly labeled **proposed export template for review**. It must not be described as the current official AIMS format.

## AIMS references and known limits

- Official portal: <https://aims.usls.edu.ph/lasalle/>
- Official USLS AIMS Instruction Guide: <https://www.usls.edu.ph/uploads/posts/AIMS-2022/AIMS.pdf>

The official portal confirms that AIMS is a separate system with Student/Alumni/Parents, Faculty, Registrar, Finance, Cashier, and other modules. The guide documents student access and profile maintenance. Neither source publishes an API contract, export schema, or GS lifecycle integration format. Therefore, the application will not infer one from screenshots or third-party image results. The proposed workbook remains subject to confirmation by the AIMS/Registrar technical owner.

## How this plan will be executed

1. Checklist items will be closed in numerical order.
2. Work will proceed one phase at a time.
3. A later phase will not start until the current phase passes its exit gate, unless the project owner explicitly authorizes an exception.
4. Stakeholder-confirmed requirements will be implemented as stated.
5. Unanswered policy questions will be recorded as decisions needed; the application will show a neutral or unavailable state instead of inventing an answer.
6. Official values and internal workflow values will be stored and displayed separately.
7. Every material change must include proportional backend, frontend, migration, audit, and test coverage.
8. Existing user changes in the worktree must be preserved.
9. A checklist item is not complete merely because a screen exists. Its process basis, source, authority, state transition, audit history, and acceptance test must also be correct.
10. Items 66–92 are an addendum and final conformance pass. Where they repeat earlier requirements, the earlier implementation will be reused and verified rather than rebuilt.

## Status and priority legend

| Marker | Meaning |
|---|---|
| Gap | Required behavior is absent. |
| Partial | Some behavior exists, but the checklist is not fully satisfied. |
| Contradicted | Current behavior conflicts with the updated confirmed requirement. |
| Decision | An authoritative answer or approved technical access method is still required. |
| Existing | The core behavior exists and needs regression verification. |
| P0 | Source-of-truth, integrity, authority, or dependency blocker. |
| P1 | Required workflow correctness or decision support. |
| P2 | Readiness, reporting, terminology, or presentation completion. |

## Phase overview and priority

| Phase | Items | Theme | Priority | State |
|---|---:|---|---|---|
| 1 | 1–14 | AIMS export/import identity foundation, source labeling, audit, risk, duplicates | P0 — highest | **Next** |
| 2 | 15–29 | Drop workflow, enrollment/grade separation, AIMS academic results | P0 | Blocked by Phase 1 |
| 3 | 30–41 | Subject needs, what-if analysis, class scheduling, faculty recommendations, AI performance | P1 | Blocked by Phase 2 |
| 4 | 42–52 | Research documents, adviser/panel authority, defense scheduling, practicum history | P1 | Blocked by Phase 3 |
| 5 | 53–65 | Graduation, exports, demo data, end-to-end readiness, team alignment | P1/P2 | Blocked by Phase 4 |
| 6 | 66–92 | Addendum conformance, removal verification, RAG terminology | P0/P2 final gate | Blocked by Phase 5 |

### What to prioritize

The execution priority is the same as the checklist order:

1. **Phase 1 first:** stop creating or editing data that should come from AIMS and establish the approved export/import boundary.
2. **Phase 2 second:** remove unofficial grade paths and correct dropping without compromising AIMS status.
3. **Phase 3 third:** rebuild planning and faculty assignment on trustworthy academic data.
4. **Phase 4 fourth:** finish role correctness and research/practicum traceability.
5. **Phase 5 fifth:** finalize graduation outputs and reliable demonstration coverage.
6. **Phase 6 last:** verify every repeated addendum requirement and remove ambiguous “RAG” terminology.

UI polishing is intentionally not a separate early priority. Each phase may improve the UI needed to make the corrected process usable, but visual-only work comes after its underlying rules and data sources are correct.

## Decision register

These questions must be answered through authorized stakeholder or university technical guidance. Until answered, the application must use an honest unavailable, pending, or neutral state.

| ID | Needed in | Decision required | Safe interim behavior |
|---|---|---|---|
| D1 | Phase 1 | **Resolved 2026-07-20:** AIMS is external; this project uses an authorized file export/import process and does not implement an AIMS clone or live integration. | Create the proposed workbook contract and label it pending AIMS/Registrar format approval. |
| D2 | Phase 1 | Exact columns, formats, code lists, export frequency, and authorized exporting office for the real AIMS workbook | Accept only the versioned proposed schema in demo/development; fail closed on unknown layouts and label unavailable fields. |
| D3 | Phase 1/6 | Final Low/Medium/High risk indicators, thresholds, weights, and recalculation policy | Use **Not Yet Assessed** or **Insufficient Data**. |
| D4 | Phase 2 | How a student-initiated drop reaches AIMS and when local status may become Confirmed Dropped | Record the request separately as **Awaiting AIMS Update** until a later authorized AIMS export confirms the official status. |
| D5 | Phase 2 | When grades become available in the authorized AIMS export and how corrections propagate | Show export-generated and import times plus a data-unavailable state; do not invent deadlines. |
| D6 | Phase 3 | Approved local AI model/deployment target and acceptable latency/RAM/concurrency thresholds | Keep recommendation rules deterministic and disclose AI unavailability. |
| D7 | Phase 4 | Exact defense participant count, whether adviser is additional, and validated chair/verdict roles | Do not silently infer a participant count; label the configured rule as pending validation. |
| D8 | Phase 4 | Confirmed practicum authority for GS Staff, Academic Coordinator, and Dean | Preserve current records but do not add new unconfirmed approval actions. |
| D9 | Phase 5 | Official printable graduation endorsement format and required fields | Export only a clearly labeled draft until the format is approved. |
| D10 | Phase 6 | Meaning of “reference for the user manual” | Do not implement an assumed function. |

---

# Phase 1 — Items 1–14

## Goal

Establish a trustworthy AIMS export/import foundation before any dependent workflow is changed. Phase 1 removes unsupported official-record creation and editing, adds provenance and immutable import history, introduces neutral risk states, and prevents questionable duplicate records from affecting official calculations.

## Ordered checklist

| # | Baseline | Priority | Required closure |
|---:|---|---|---|
| 1 | Gap | P0 | Create a feature logic register covering trigger, actor, source, produced status, next step, official owner, BPMN reference, and known limitation. Resolve contradictions before marking the feature verified. |
| 2 | Contradicted | P0 | Remove the blank manual student-creation path. Replace it with authorized AIMS export import, reconciliation, and missing-record reporting. No official student may be recreated locally. |
| 3 | Contradicted | P0 | Remove student-number generation and ordinary editing. Require an AIMS-issued number for every official student record and use it for identity matching. |
| 4 | Contradicted | P0 | Treat admission/onboarding as external. Remove the local admission checklist as an application process; retain only externally sourced admission status or a reference to the official process. |
| 5 | Gap | P0 | Replace Student Handoff’s unsupported purpose with **AIMS Export Import & Reconciliation**: upload, validate, preview, commit, reconcile, and report exceptions. |
| 6 | Gap | P0 | Populate all permitted official fields only from a validated, versioned AIMS export. Prohibit manual re-entry of values supplied by that export. |
| 7 | Contradicted | P0 | Make Enrolled a read-only imported AIMS value with academic term, source batch, export-generated time, and import time. |
| 8 | Partial | P0 | Add visible provenance for every official value and keep AIMS data separate from student requests, internal comments, recommendations, alerts, and verified external documents. |
| 9 | Partial | P0 | Add immutable value-change history with old value, new value, detected time, source, actor/system, and reason. Audit requests, comments, recommendations, decisions, and exceptions as well. |
| 10 | Partial | P1 | Document the complete post-enrollment lifecycle and configurable enrollment/adjustment periods. Link each transition to its source and owner without assuming drop or grade is the only next event. |
| 11 | Contradicted | P0 | Add Newly Admitted, Not Yet Assessed, and Insufficient Data states. Remove default Low/Medium assignment for new or incomplete records. |
| 12 | Decision/Partial | P0 | Make risk configuration-driven and explainable. Display indicators, source, calculation time, missing inputs, and follow-up. Do not invent thresholds before D3 is resolved. |
| 13 | Partial | P0 | Use student number as the primary duplicate key. Add Compare, Confirm Separate Identities, Flag Issue, and verified Merge actions. Never declare duplicates from names alone. |
| 14 | Gap | P0 | Add an unresolved-identity state and exclude those records from official counts, risk, subject needs, graduation, and dashboard totals. Show authorized users why the record is excluded. |

## Phase 1 work packages

### 1A. Process and data-source contract — items 1–4

- Add a feature logic register under project documentation.
- Add an AIMS export/import data contract documenting sheets, columns, code lists, read-only rules, timestamps, availability, validation, and batch handling.
- Add a proposed, empty AIMS export workbook for AIMS/Registrar review; label it as proposed and not an official current AIMS format.
- Add a decision log for D1–D3.
- Remove unsupported claims from README, UI copy, workflow descriptions, and demo narration.
- Establish separate concepts for:
  - Official AIMS value.
  - Immutable imported AIMS export snapshot.
  - Internal workflow status.
  - Student-submitted request.
  - Internal comment or recommendation.
  - Exception report.

### 1B. Replace Student Handoff — items 5–8

- Replace manual creation with an **AIMS Export Import & Reconciliation** workspace.
- Accept only approved `.xlsx` exports through a versioned parser; do not connect to or imitate the AIMS portal.
- Validate file type, required sheets/headers, schema version, terms, timestamps, duplicate keys, cross-sheet references, row types, and allowed values before any write.
- Show a non-mutating preview with new, changed, unchanged, missing, conflicting, and rejected rows.
- Commit an accepted batch atomically so a failed row cannot leave a partial official snapshot.
- Record batch ID, original filename, SHA-256 digest, export-generated time, import time, importing user, row counts, and validation result.
- Remove generated student numbers and institutional emails.
- Remove the local onboarding checklist workflow.
- Show source batch and freshness next to student identity, program, enrollment, and enrolled subjects.
- Add a missing/incorrect-record report instead of a local correction control.
- Require corrections to be made in AIMS and received through a replacement export; never patch an official imported value locally.
- Migrate current demo records to explicit `AIMS Export Demo Fixture` provenance without claiming that the fixture was exported by the live system.

### 1C. Audit and lifecycle map — items 9–10

- Store immutable source snapshots or field revisions rather than silently overwriting official values.
- Audit import detection, batch acceptance/rejection, exception creation, exception resolution, and internal workflow actions.
- Document enrollment, adjustment, coursework, comprehensive examination, research, practicum, and graduation transitions.
- Make academic period configuration explicit and reusable by later phases.

### 1D. Risk and duplicate integrity — items 11–14

- Extend the risk model with neutral/unassessed states.
- Prevent risk calculation when required source fields are unavailable.
- Store the calculation basis and last calculation time.
- Add duplicate-review cases with Pending, Separate Identities Confirmed, Merge Confirmed, and Resolved states.
- Add one shared analytics eligibility rule so all official metrics exclude unresolved duplicate cases consistently.
- Preserve a visible audit trail for every exclusion and resolution.

## Phase 1 acceptance checks

- [ ] No manual official-student creation form remains.
- [ ] No backend endpoint generates a student number.
- [ ] No UI or endpoint allows ordinary users to edit an official student number or institutional email.
- [ ] The local admission checklist is no longer presented as a GS lifecycle submission.
- [ ] No AIMS clone, fake portal, login, scraper, or unapproved live API path exists.
- [ ] A clearly labeled proposed AIMS export workbook and data dictionary exist for AIMS/Registrar approval.
- [ ] Only a validated, versioned AIMS export may create or revise the local official snapshot.
- [ ] Import preview and atomic commit prevent partial or unreviewed official updates.
- [ ] Every accepted/rejected batch has source metadata, digest, actor, counts, and validation evidence.
- [ ] Student identity, program, enrollment, and enrolled subjects show their AIMS export batch and freshness.
- [ ] Demo data is labeled `AIMS Export Demo Fixture`, not live AIMS or an official export.
- [ ] AIMS-derived Enrolled status is read-only.
- [ ] Internal comments and exception reports cannot overwrite official values.
- [ ] A replacement AIMS export retains both previous and new values in immutable revision history.
- [ ] Newly admitted or incomplete-source students are Not Yet Assessed/Insufficient Data.
- [ ] Risk explanations show source, inputs, missing data, timestamp, and follow-up.
- [ ] Same-name students are not automatically treated as duplicates.
- [ ] Staff can confirm that similar records are separate identities.
- [ ] Unresolved identity cases are excluded consistently from all official calculations.
- [ ] Backend tests, UI tests where available, migration checks, frontend build, and regression tests pass.
- [ ] Items 1–14 are reviewed in order and recorded as closed before Phase 2 starts.

## Phase 1 expected project artifacts

- `docs/process/FEATURE_LOGIC_REGISTER.md`
- `docs/process/AIMS_EXPORT_IMPORT_CONTRACT.md`
- `docs/process/DECISION_REGISTER.md`
- `Documents/AIMS_Export/PROPOSED_USLS_AIMS_Export_Template.xlsx`
- Versioned AIMS workbook parser, validator, preview, and atomic import boundary
- Official-value provenance and immutable revision storage
- Exception-reporting workflow
- Neutral risk states and configurable risk policy
- Duplicate-review workflow and shared analytics exclusion rule
- Updated tests and demo fixtures

---

# Phase 2 — Items 15–29

## Goal

Correct the subject-drop workflow, separate enrollment from grades, and make AIMS the only official academic-result source.

| # | Baseline | Priority | Required closure |
|---:|---|---|---|
| 15 | Partial | P1 | Put the Drop action directly beside an eligible enrolled subject and show request date and separate request/official statuses. |
| 16 | Contradicted | P0 | Remove generic Course Readiness and fabricated course prerequisites. Retain only validated comprehensive-exam and thesis/dissertation milestone eligibility. |
| 17 | Contradicted | P0 | Remove the optional drop PDF, its validation, storage references, and placeholder copy. |
| 18 | Decision | P0 | Resolve D4 and keep request status separate from official AIMS subject status until a later authorized AIMS export verifies the update. |
| 19 | Contradicted | P0 | Remove Deny. Use non-discretionary request progression and avoid implying coordinator approval authority. |
| 20 | Partial | P0 | Fully separate enrollment display/monitoring from grade display. Remove every combined enrollment-and-grade form. |
| 21 | Contradicted | P0 | Make AIMS/Registrar the only official grade source. Coordinators must not create or alter grades. |
| 22 | Contradicted | P0 | Remove all claims and code paths based on an unrelated or manually maintained Registrar grade workbook. The only permitted file source is the approved, versioned AIMS export contract. |
| 23 | Gap | P0 | Replace manual grade encoding with read-only grade ingestion from the approved AIMS export, missing-grade detection, batch provenance, and freshness display. |
| 24 | Decision | P0 | Resolve D5 and document faculty submission, Registrar posting, GS visibility, and correction propagation timing. |
| 25 | Partial/Contradicted | P0 | Remove invented grade and correction deadlines. Use verified or configurable dates and label unknown timing honestly. |
| 26 | Gap | P0 | Create the AIMS academic-result dependency map, including missing-data behavior for every dependent module. |
| 27 | Contradicted | P0 | Remove student, faculty, and coordinator official-grade entry. When the required AIMS export data is absent, stale, or invalid, show unavailable/import-new-export/flag-issue. |
| 28 | Existing | P1 | Preserve dependent modules while replacing their data boundary with validated AIMS export inputs and documented unavailable states. |
| 29 | Contradicted | P0 | Derive Enrolled/Completed/Passed/Failed/Incomplete only from validated AIMS export values; never infer from screenshots, statements, or absence next term. |

## Phase 2 exit gate

- [ ] Drop is initiated from the enrolled-subject row.
- [ ] No drop upload or Deny control exists.
- [ ] Local request status and official AIMS status are visibly separate.
- [ ] Generic Course Readiness and ordinary prerequisite rules are gone.
- [ ] Comprehensive-exam and thesis/dissertation eligibility remain intact.
- [ ] No coordinator, faculty, or student can create an official grade.
- [ ] No unrelated/manual Registrar grade-file path remains; grade rows may enter only through the approved AIMS export contract.
- [ ] AIMS grade/completion values are read-only and show source batch, export-generated time, and import time.
- [ ] Every dependent feature has defined unavailable-data behavior.
- [ ] Items 15–29 are closed in order.

---

# Phase 3 — Items 30–41

## Goal

Build subject-needs analysis and approved-offering scheduling, then add explainable faculty recommendations without autonomous or random assignment.

| # | Baseline | Priority | Required closure |
|---:|---|---|---|
| 30 | Partial/Contradicted | P1 | Remove study-plan-draft claims. Calculate subject needs from curriculum and the latest valid imported AIMS academic snapshot; leave “curriculum tag” unimplemented until defined. |
| 31 | Contradicted | P0 | Change the subject-need cutoff to one student while keeping need, proposal, approval, and scheduled class separate. |
| 32 | Gap | P1 | Add offer/not-offer what-if analysis with alternatives, unavoidable delay, and reviewable recommendations. |
| 33 | Gap | P1 | Provide the exact affected-student list and identify comprehensive, thesis, practicum, or graduation consequences. |
| 34 | Partial | P0 | Enforce configurable June–July enrollment, first-week adjustment, current/planning/next-term separation, and future-term projection. |
| 35 | Partial | P1 | Carry approved offerings into scheduling with program, subject code/title, faculty, and schedule while preserving decision history. |
| 36 | Partial | P1 | Ensure no random faculty assignment exists and replace it with verified, explainable criteria. |
| 37 | Partial | P1 | Let faculty maintain available/unavailable times and preferred subjects; expose them during assignment. |
| 38 | Partial | P1 | Add credentials, teaching history, and relevant experience to explain qualification. |
| 39 | Gap | P1 | Validate maximum/current teaching load and schedule overlaps before confirmation. |
| 40 | Gap | P1 | Rank faculty recommendations and require an authorized human to accept, modify, replace, or reject; audit both recommendation and decision. |
| 41 | Gap | P1 | Benchmark model size, RAM, latency, accuracy, and concurrency; add loading, timeout, and failure handling based on D6. |

## Phase 3 exit gate

- [ ] One student creates a subject need, not an automatic class.
- [ ] No automatic semester study plan is generated.
- [ ] Every suggested subject links to students and explains why it is needed.
- [ ] What-if analysis distinguishes alternatives and likely delay.
- [ ] Projected offerings cannot be saved under the wrong/current term.
- [ ] Approved offerings flow into class scheduling without recreation.
- [ ] Faculty preferences, availability, qualifications, history, load, and conflicts are represented.
- [ ] Recommendations are ranked, explainable, editable, and human-approved.
- [ ] AI performance evidence and honest limitations are documented.
- [ ] Items 30–41 are closed in order.

---

# Phase 4 — Items 42–52

## Goal

Finish research and practicum authority, access, scheduling, and history without treating file receipt as academic validation.

| # | Baseline | Priority | Required closure |
|---:|---|---|---|
| 42 | Existing | P1 | Preserve Submitted versus Verified states and add an explicit content-validity limitation wherever needed in UI and defense documentation. |
| 43 | Gap | P0 | Add adviser designation as a prerequisite for adviser signatures, endorsements, review, and scheduling participation. |
| 44 | Existing | P1 | Preserve full faculty search/replacement and audit the final staff-selected panel. |
| 45 | Decision | P0 | Resolve D7 and make every panel/availability/verdict screen use the same validated participant rule. |
| 46 | Partial | P1 | Complete common-slot ranking and honest Google/profile availability labeling; never present fixtures as live calendar data. |
| 47 | Existing | P1 | Regression-test immediate refresh and downstream state propagation after every research, panel, scheduling, and graduation action. |
| 48 | Partial | P0 | Keep chair-only final verdict and add the validated supporting evaluation record. |
| 49 | Partial | P1 | Preserve scoped document access and audit opens, comments, signatures, and decisions. |
| 50 | Partial | P1 | Display original/additional files, updated hours, requests, and responses with New/Revised/Replaced/Superseded labels. |
| 51 | Decision | P0 | Resolve D8 and align every practicum action/button with confirmed authority. |
| 52 | Existing | P1 | Regression-test preservation of all practicum comments, responses, requests, and attachments across forwarding/resubmission. |

## Phase 4 exit gate

- [ ] File submission is never described as academic/content validity.
- [ ] No adviser-dependent action works without a valid designation.
- [ ] Participant counts and roles are consistent across every screen.
- [ ] Panel members have scoped access and document-open auditing.
- [ ] Only the authorized chair can submit the final verdict.
- [ ] Scheduling recommends the earliest valid common slot and labels data sources honestly.
- [ ] Practicum authority matches the confirmed workflow.
- [ ] Full practicum history survives resubmission and forwarding.
- [ ] Items 42–52 are closed in order.

---

# Phase 5 — Items 53–65

## Goal

Finalize graduation outputs, demo/test coverage, safeguarded decision support, and team readiness.

| # | Baseline | Priority | Required closure |
|---:|---|---|---|
| 53 | Existing | P1 | Regression-test immediate eligibility propagation and exact missing-requirement explanations. |
| 54 | Existing | P1 | Preserve summary-first coursework/research/practicum status with details on demand. |
| 55 | Existing | P1 | Preserve named multi-batch selection, membership, and stage tracking. |
| 56 | Partial | P1 | Generate an approved printable endorsement containing batch, generated date, responsible user, and review status after D9. |
| 57 | Partial | P0 | Record export/handoff accurately; do not claim an email was sent or received unless an actual integration or confirmed action exists. |
| 58 | Existing direction | P0 | Formally remove/forbid faculty-grade export because AIMS is official; generate only explicitly requested GS reports. |
| 59 | Partial | P1 | Add logically valid drop/adjustment and other missing personas; use multiple students for list/batch screens. |
| 60 | Gap | P1 | Add one true admission-status-to-graduation integration test with status propagation assertions. |
| 61 | Partial | P0 | Align every demo record with explicit `AIMS Export Demo Fixture` provenance, terms, academic history, research, practicum, and eligibility without claiming live or official export origin. |
| 62 | Partial | P1 | Present what-if, faculty, panel, scheduling, and risk recommendations with inputs, explanation, consequences, and human owner. |
| 63 | Gap | P1 | Add a defense-script readiness checklist covering accounts, buttons, fixtures, refresh, and honest limitation statements. |
| 64 | Process gap | P0 | Create and rehearse a single source-of-truth explanation for AIMS, enrollment, grades, prerequisites, subject needs, and dropping. |
| 65 | Ongoing | P0 | Complete a process-correctness audit before any final visual-polish pass. |

## Phase 5 exit gate

- [ ] Graduation eligibility updates immediately from trusted inputs.
- [ ] Graduation batching and printable output use the approved format.
- [ ] Registrar handoff wording matches what the application actually did.
- [ ] Faculty-grade export is absent.
- [ ] Scenario data covers all defense paths with multiple list examples.
- [ ] One full lifecycle integration test passes.
- [ ] Every scripted demo path passes a role/account/button rehearsal.
- [ ] Team process answers are written, consistent, and traceable to the decision register.
- [ ] Items 53–65 are closed in order.

---

# Phase 6 — Items 66–92

## Goal

Perform the addendum conformance audit, verify removals and AIMS boundaries implemented in earlier phases, close the remaining user-manual question, and distinguish Red-Amber-Green Status from Retrieval-Augmented Generation.

Later addendum items deliberately cross-check earlier work. They remain numbered and closed in order, but their acceptance should reuse the implementation and tests from the referenced earlier items.

| # | Cross-check | Priority | Required closure |
|---:|---|---|---|
| 66 | 2, 5 | P0 | Verify manual student creation is absent and validated AIMS export import/reconciliation/missing-record reporting replaced it. |
| 67 | 3, 4 | P0 | Verify manual student-number/email fields, generation, and editing are absent while read-only official values remain visible. |
| 68 | 6–8 | P0 | Verify the approved AIMS workbook schema, authorized exporting office, export cadence, import roles, validation rules, and batch metadata are documented. |
| 69 | 5, 6, 22, 23 | P0 | Verify unsupported onboarding, generic monitoring-sheet, and manually maintained grade-file assumptions are removed; retain the approved AIMS export and confirmed offering-list fields only. |
| 70 | 7 | P0 | Verify Enrolled is a read-only AIMS tag with source batch, export-generated time, and import time. |
| 71 | 7–9 | P0 | Verify AIMS student number, enrollment, subjects, and grades cannot be directly edited. |
| 72 | 5, 8, 9 | P0 | Verify exception reporting supports issue, owner, resolution, and immutable history without changing the official local display value. |
| 73 | D10 | P1 | Obtain and document the meaning of “reference for the user manual”; implement only the confirmed meaning. |
| 74 | 11, 12, D3 | P0 | Finalize or explicitly defer risk rules; retain neutral states until confirmed. |
| 75 | 16 | P0 | Verify generic prerequisites/readiness are gone and only comprehensive/research milestone eligibility remains. |
| 76 | 6, 7, 20 | P0 | Verify the app records/displays enrollment rather than performing official enrollment; rename misleading controls. |
| 77 | 15, 18, 34 | P1 | Verify row-level drop and the configured first-week adjustment window with separate request/AIMS statuses. |
| 78 | 17 | P0 | Verify all drop upload UI, backend validation, attachment categories, and documentation are removed. |
| 79 | 18, 19 | P0 | Verify Deny is absent and automatic progression is accurately labeled relative to AIMS. |
| 80 | 21–24, 29 | P0 | Verify AIMS is the only official grade source and grade displays include subject, term, source, and freshness. |
| 81 | 20, 21, 23, 27 | P0 | Verify manual course-grade audit/encoding is gone and discrepancy reporting replaces editing. |
| 82 | 20 | P0 | Verify enrollment and grading remain separate timelines, screens, sources, and states. |
| 83 | 27 | P0 | Verify students cannot type/upload official grades; retain only discrepancy reporting. |
| 84 | 21, 27, 58 | P0 | Verify faculty grade encoding is gone and the faculty screen focuses on teaching/research responsibilities. |
| 85 | 31 | P0 | Verify the subject-need cutoff is one and remains separate from offering approval/scheduling. |
| 86 | 30, 32, 33 | P1 | Verify subject analytics show alternatives and likely delayed students without generating a study plan. |
| 87 | 32, 40, 62 | P1 | Verify recommendations show source data, explanation, data-quality warnings, what-if result, human confirmation, and audit record. |
| 88 | 37 | P1 | Verify faculty can select/rank/update preferred subjects and coordinators can view them. |
| 89 | 37, 39 | P1 | Verify availability, maximum load, current assignments, and conflict warnings. |
| 90 | 36–40 | P1 | Verify faculty recommendations are automated, editable, explainable, and explicitly approved by an authorized user. |
| 91 | 11, 12, 74 | P1 | Add Red-Amber-Green Status presentation only after D3; use one underlying risk status with reason, data, calculation time, and follow-up. |
| 92 | All documentation/UI | P2 | Rename ambiguous “RAG”: use **Red-Amber-Green Status** for risk and **Policy Assistant** or **Retrieval-Augmented Generation** for AI everywhere. |

## Phase 6 final acceptance gate

- [ ] Each item from 66 through 92 has a recorded pass result and evidence link.
- [ ] No removed feature remains reachable through UI, API, documentation, seed data, or tests.
- [ ] AIMS-derived official values are read-only everywhere.
- [ ] Exception reporting is the only local correction path.
- [ ] Drop, grade, prerequisite, and subject-needs behavior matches confirmed answers.
- [ ] Faculty preference/load/recommendation acceptance works end to end.
- [ ] Risk remains neutral until validated rules are approved.
- [ ] “RAG” is never used without distinguishing Red-Amber-Green from Retrieval-Augmented Generation.
- [ ] All 92 checklist items are closed in numerical order with test or decision evidence.

---

# Standard implementation cycle for every phase

Each phase will follow this sequence:

1. **Baseline:** Recheck current code, UI, database, tests, documentation, and demo data for only that phase.
2. **Decisions:** Resolve or explicitly defer the phase’s decision-register entries.
3. **Design:** Document data ownership, state transitions, roles, unavailable states, migration, and acceptance criteria.
4. **Backend:** Implement models, services, permissions, versioned import parsers, validation, atomic batch handling, audit, and API behavior.
5. **Frontend:** Implement corrected screens, source labels, confirmations, errors, and honest limitation copy.
6. **Migration:** Preserve existing user data and label legacy/demo provenance honestly.
7. **Verification:** Run focused backend tests, frontend build, integration tests, role checks, and regression tests.
8. **Documentation:** Update process register, decision register, README, BPMN alignment notes, and demo script.
9. **Acceptance:** Review every item in numerical order and record evidence before advancing.

# Definition of done for an individual checklist item

An item may be checked only when all applicable conditions are met:

- The authoritative process answer is documented.
- The UI wording matches the process.
- The backend enforces the same rule.
- Permissions match the responsible role.
- Official and internal values remain separate.
- Source and freshness are visible where required.
- State transitions and unavailable states are defined.
- Audit history is preserved.
- Existing data is migrated safely.
- Automated tests cover success, rejection/unavailable behavior, permissions, and propagation.
- Demo data is logically valid.
- Documentation and presentation language do not contradict the system.

# Progress log

| Date | Phase | Update |
|---|---|---|
| 2026-07-20 | Planning | Replaced the earlier 65-item baseline with the stakeholder-updated 92-item checklist and created the six-phase roadmap. |
| 2026-07-20 | Planning | Corrected the AIMS boundary: external system, approved export/import only; no AIMS clone, fake portal, live lookup, scraper, or assumed API. Added a proposed workbook artifact pending AIMS/Registrar format approval. |
