# Forms × Operations Manual — contract (2026-11-04)

Owner request (2026-11-04): categorise the USLS forms around the **Operations Manual** (the panel will look
for it), add the documents the web app has no basis for, draft the set-aside forms, and wire three things
into the app. Owner left every remaining decision to Claude. Branch `pkt/forms-ops`
(worktree `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/forms`); helpers branch from it.

## Decisions

| # | Decision |
|---|---|
| FO1 | Forms are grouped **one folder per Operations Manual chapter**. Codes GS-F-01..44 stay unchanged. |
| FO2 | Link both ways: each form names its manual section in its subtitle line ("Operations Manual 4.6"); the manual lists the GS-F codes in each chapter's records, and Appendix A becomes the full crosswalk. |
| FO3 | New folder `Platform Basis` (5 gaps) and `Supplementary Forms` (set-aside forms), both inside `Documents/USLS_Forms/`. |
| FO4 | Platform Basis items also get new manual chapters 4.20–4.24, all rules status **Proposed**. Supplementary forms are added to their host chapters (rules, records, Appendix A). |
| FO5 | Where no source states a number, fill a sensible value and tag it "proposed – to be confirmed"; add it to the open questions. Never present an assumption as Handbook or Protocol text. |
| FO6 | No fee or honorarium forms. Practice reported by the group (2026-11-04): panel honoraria are handed to the panel members in an envelope at the defense. Record this as a Practice note on OQ-27 only. |
| FO7 | App wiring: (a) privacy notice + consent once per account at first sign-in, (b) each workflow page shows its GS-F code(s) and manual section, (c) approve/decide controls show a one-line e-approval note citing GS-P-03. |
| FO8 | Same layout engine for every new document (`scripts/docs/forms/build_forms.py`), same fonts, control box, instruction box, sign block, GS box. |

## Folder layout (`Documents/USLS_Forms/`)

Each folder holds the `.docx` and its `.pdf` side by side. The flat `pdf/` folder goes away (files move, nothing
deleted from history). `USLS-GS-Forms-Pack.pdf` and `00-INVENTORY.md` stay at the root.

| Folder | Contents |
|---|---|
| `0 Forms Control` | GS-P-01, GS-P-02 |
| `4.01 Admission Handoff and Onboarding` | GS-F-01 |
| `4.02 Enrollment and Academic Load` | GS-F-02 |
| `4.03 Course Offering and Course Adjustments` | GS-F-03, 04 |
| `4.04 Withdrawal of Subject` | GS-F-05 |
| `4.05 Dropping` | GS-F-06 |
| `4.06 Leave of Absence` | GS-F-07 |
| `4.07 Return from Leave and Readmission` | GS-F-08 |
| `4.08 Absence Without Leave` | GS-F-09 |
| `4.09 Residency Enrollment` | GS-F-10 |
| `4.10 Comprehensive Examination` | GS-F-14, 15 |
| `4.11 Title Defense` | GS-F-16, 17, 18 |
| `4.12 Adviser Designation and Change of Title` | GS-F-19 to 24 |
| `4.13 Proposal Defense and Ethics Review` | GS-F-25, 26, 27, 29, 30, 31 |
| `4.14 Final Defense` | GS-F-32, 33, 34, 35 |
| `4.15 Revisions, Completion and Publication` | GS-F-36 to 41 |
| `4.16 Defense Scheduling` | GS-F-28 |
| `4.17 Practicum` | GS-F-11, 12, 13 |
| `4.18 Graduation` | GS-F-42, 43 |
| `4.19 Records Handoff to the Registrar` | GS-F-44 |
| `Platform Basis` | GS-P-03..06, GS-F-45..48 |
| `Supplementary Forms` | GS-F-49..54 |

GS-F-27 (Form 4) is used in 4.13 and 4.14; its home folder is 4.13 and the crosswalk lists both.
GS-F-34 (Form 8) sits in 4.14, as the manual's Appendix A already says.

## New documents

| Code | Title | Manual | Folder | Basis |
|---|---|---|---|---|
| GS-P-03 | Electronic Approval and Signature Policy | 4.22 | Platform Basis | RA 8792 (Electronic Commerce Act 2000) s. 8 electronic signatures; Protocol already uses e-signatures by email (manual ADV-09). Proposed: an approval recorded in the platform by the signed-in officer = that officer's signature on the matching GS-F form. |
| GS-P-04 | Data Privacy Notice and Records Retention Schedule | 4.23 | Platform Basis | RA 10173 (Data Privacy Act 2012) and its IRR; NPC as regulator; USLS Data Protection Officer (contact to be confirmed). Retention: proposed 5 years after graduation or last enrollment for case files, permanent for the graduation list and the Registrar transmittals. |
| GS-P-05 | Platform Access and Roles Matrix | 4.21 | Platform Basis | The roles that exist in the app (`ROLE_LABELS` in `app.py`) and what each may do; least privilege; who approves an account. |
| GS-P-06 | AIMS and Registrar Data Exchange Specification | 4.24 | Platform Basis | The AIMS export columns the import reads (`scripts/` AIMS template and the import code in `app.py`), file type, who sends, how often (proposed: start of term + after grade posting), and the export files sent to the Registrar (graduation list, leave/withdrawal exports). Data stays read-only (AGENTS.md Rule 4). |
| GS-F-45 | Data Privacy Consent and Acknowledgement | 4.23 | Platform Basis | Paper twin of the first-sign-in notice; for anyone without an account or as a signed copy. |
| GS-F-46 | Platform Account and Role Request | 4.21 | Platform Basis | Request, endorsement (head of office), approval (Dean), set-up (GS staff / admin), removal when the person leaves. |
| GS-F-47 | Faculty Course Preference and Availability | 4.20 | Platform Basis | Matches `FacultyCoursePreference`, `FacultyAvailability`, `FacultyWorkingHour`, `AvailabilityRequest`. |
| GS-F-48 | Teaching Load Assignment | 4.20 | Platform Basis | Academic Coordinator proposes from GS-F-04 and GS-F-47; Dean approves; faculty acknowledges. |
| GS-F-49 | Request for Approved Absence | 4.05 | Supplementary Forms | Handbook p. 52 (Dean grants approved absence). |
| GS-F-50 | Incomplete Grade Removal Form | 4.05 | Supplementary Forms | Handbook p. 54 (gsm@usls.edu.ph, set deadline). Grades are out of scope for the platform: paper only, say so. |
| GS-F-51 | Application for Cross-enrollment | 4.02 | Supplementary Forms | Handbook p. 50 (Dean's written permission; Registrar issues the permit). |
| GS-F-52 | Request for a Special Class | 4.03 | Supplementary Forms | Handbook p. 48 (Academic Coordinator through the Dean to the VCAA). |
| GS-F-53 | Request for Transfer between Master's Options | 4.02 | Supplementary Forms | Handbook p. 48. |
| GS-F-54 | Nomination for Best Thesis / Dissertation | 4.18 | Supplementary Forms | Handbook pp. 76-77 (rubric 15/40/15/30). |

Read the cited Handbook pages before writing any rule sentence (`Documents/CAPSTONE_ONLY/USLS_Documents/GRADUATE-SCHOOL-HANDBOOK-22-23.pdf`,
printed page = PDF page minus four). Cite exactly as the existing forms do.

## New manual chapters (all rules Proposed unless a source is quoted)

| Chapter | Key | Title | Documents |
|---|---|---|---|
| 4.20 | FAC | Faculty course preference and teaching load | GS-F-47, GS-F-48 |
| 4.21 | ACC | Platform accounts and roles | GS-P-05, GS-F-46 |
| 4.22 | EAP | Electronic approval and signatures | GS-P-03 |
| 4.23 | PRV | Data privacy and records retention | GS-P-04, GS-F-45 |
| 4.24 | DEX | AIMS and Registrar data exchange | GS-P-06 |

The manual must not mention AI, Gemini or RAG (`test_no_mention_of_ai_in_manual_text`). The privacy chapter
may say "an external search service used by the policy question box" if needed; GS-P-04 itself may be specific.

## App wiring

- `PRIVACY_NOTICE_VERSION = "GS-P-04 rev 00"` in `app.py`. `UserAccount.privacy_consent_at` (DateTime, null) and
  `UserAccount.privacy_notice_version` (String 40, null) — model columns only (AGENTS.md Rule 4: no new ALTER patches;
  the seed rebuilds the DB).
- `account_dict` adds `privacy_consent_required` (true when no consent or an older version) and `privacy_notice_version`
  (the current version).
- `POST /api/auth/privacy-consent` `{"accept": true}`: 401 signed out, 400 unless `accept is True`, else stores time +
  version, writes a `TransactionLog` row (`transaction_slug="privacy-consent"`, `source_reference` containing "GS-P-04"),
  returns `{"ok": true, "user": account_dict}`. Not blocked by `must_change_password`.
- Frontend: `App.jsx` shows a `PrivacyConsent` page after the change-password gate while `privacy_consent_required`;
  e2e login helper accepts it. One shared map `frontend/src/lib/formRefs.js` (workflow slug → codes + manual section)
  feeds `PageHeader`; `DecisionPanel` (and every other approve/decide control, IM24) shows the GS-P-03 note.
- Spec test: `tests/test_privacy_consent.py` (written first, fails before the change).
