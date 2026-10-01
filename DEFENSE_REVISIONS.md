# Defense revisions — what the panel required and what is still open

**Source:** `Documents/CAPSTONE_ONLY/CAP-2521-IT-CAP1DEF.docx` — Stage 1 defense,
2026-08-07, verdict **Conditional Pass**, revisions were due 2026-08-14, to be
checked by the Adviser (Sir Oliver Malabanan). Panel: Arcilla (lead), Magpantay.

**Written:** 2026-09-30, from reading the defense form, the four documents in
`Documents/CAPSTONE_ONLY/`, the handbook and research protocol in
`USLS_Documents/`, and the code on branch `v5-myrine-revisions` (HEAD `9f0a182`).
"Verified" below means checked in the file or code; "inferred" means reasoned.

This file is the top of the work queue (see `AGENTS.md`). Work it top to
bottom. Tick a box only when its acceptance line is true **and** the gate passes.
Items tagged **WAITING** cannot be built until the owner or the stakeholder
answers — skip them and remind the owner.

## Owner decisions, 2026-10-01 (these settle the WAITING items below)

- **The 2022-2023 handbook is still in force.** Where the system and the
  handbook disagree, the handbook wins (settles C1, G2, G3).
- **Ignore Khloe's revised copy** — nobody knows where it is. The document
  revisions are done in our own file (settles E0).
- **The Graduate School has no Operations Manual.** The panel suggested we write
  it and have the stakeholder correct/validate it. We draft it (settles G1:
  `Documents/CAPSTONE_ONLY/USLS GS Operations Manual - DRAFT for Validation.docx`).
- **Monitoring Sheet needs CRUD in the portal** — adding records directly, not
  only uploading a sheet. "The biggest mistake."
- **LOA and Readmission** are weak compared with Graduation (staged board, drag
  and drop) — rebuild to that standard.
- **Calendar / thesis-dissertation adviser appointment / defense scheduling**
  is lacking — improve.
- **Dean and Student views** must use the same layout as staff: sidebar
  navigation and separate pages, not one long scrolling page.
- Whole-project consistency check; work lands on branch `v5.1-migui_clean`.
- **Every document must match the web app** — mainly the proposal and the
  walkthrough: screens, steps, accounts, rules, counts and screenshots are
  updated after the code settles (section I).
- LibreOffice is installed at `E:\LibreOffice` (2026-10-01) — use it to render
  and check `.docx` files (`soffice.exe --headless --convert-to pdf`).

---

## A. What the panel wrote

| # | Panel item | Compliance page claimed on the form | Real status |
|---|---|---|---|
| S1 | Add a feature to upload additional documents/policies into the system | p. 365 | **Built** (commit `3e0225f`), gaps in §B |
| S2 | Ensure that policies are properly integrated into the student lifecycle | *(blank on the form)* | **Not done** — §C |
| S3 | RAG for matching — populate the database with records (concept paper, faculty expertise, etc.) that yield different results (all 4 were 72/100 in the demo) | p. 213 | **Partly** (commit `83ea4f0`), gaps in §D |
| D1 | Fix pagination (TOC has no page number; main sections use chapter-page, e.g. 1-1) | TOC pp. 2–15; Ch. 1–6 pp. 19–249 | **Not in the file we have** — §E |
| D2 | Fix table of contents (follow the pagination format; remove tables and figures) | TOC pp. 2–15 (Khloe: "done") | **Not in the file we have** — §E |
| D3 | Document Existing and Proposed Business Rules/Policies | p. 378 (Khloe: "done") | **Not in the file we have** — §E |

Lead panel's notes (not numbered on the form, but they explain the items):

- N1 "Did you consider BR for the processes (can a student drop anytime, e.g. Day 1?)" → §C
- N2 "Policy and Guidance chat — did not demo? Just explained the screen?" → §F
- N3 "Sign in page — no logging in" → §F
- N4 Same as S3.
- N5 "Policies in the operations manual should be included" → §G (**WAITING**)

---

## B. S1 — policy upload (built; finish it)

Verified in code: `PolicyDocument` table, 7 routes under `/api/policy-documents`,
page `frontend/src/pages/PolicyDocuments.jsx`, staff and admin only, PDF and
DOCX up to 20 MB, edit / replace / delete, uploaded text is chunked and used
by the Policy Assistant.

- [x] **B1. Fix the built-in document folder path.** `RAG_DOCUMENT_PATHS`
      (`app.py:54-58`) points at `Documents/USLS_Documents` and `data`; neither
      exists. The real folder is `Documents/CAPSTONE_ONLY/USLS_Documents`. Today
      the only corpus is the two files committed in `uploads/policy_documents/`.
      *Accept:* a test proves the handbook is found from the real folder and is
      not indexed twice.
- [x] **B2. End-to-end test: upload → the assistant answers from it.** No test
      proves an uploaded document is actually retrieved. *Accept:* a test uploads
      a DOCX with a made-up rule, asks about it, and gets that rule back with the
      document named as the source.
- [x] **B3. A newly uploaded policy must win over the built-in snippets.**
      Curated `POLICY_SNIPPETS` (`app.py:3913`) answer some staff questions first,
      so a new contradicting upload is ignored unless the question contains words
      like "how many / maximum / deadline" (`app.py:6181`).
- [x] **B4. Keep policy history.** Replace overwrites the file: no version, no
      effective date, no category. The panel asked for policies to be managed,
      so keep the old version and record who changed it and when.
- [x] **B5. Scanned PDFs.** Rejected as "no readable text" although OCR exists
      elsewhere in the app. Either run OCR or say so clearly on the page.
- [x] **B6. Housekeeping.** Remove the accidental `"capstone-usls-platform":
      "file:.."` self-dependency in `frontend/package.json`; add the two file-view
      routes to `ACCESS_CONTROL_SPEC`; decide whether `uploads/policy_documents/`
      is committed (it is the only upload folder not in `.gitignore`).
- [ ] **B7. Walkthrough has no case for it.** The demo script never shows
      uploading a policy. Add a case (upload → ask → cited answer).

## C. S2 + N1 — policies integrated into the lifecycle (the big one)

Verified: the three post-defense commits add **no** workflow logic. Every rule
below already existed, is hard-coded in `app.py`, and is not linked to any
policy document. Uploading or replacing a policy changes nothing in a workflow.

| Rule in the system | Where in `app.py` | What the handbook says (verified text) | Match? |
|---|---|---|---|
| Subject withdrawal only before classes or in the first **7 calendar days**, "no penalty" | 2641-2692, 7891 | Withdrawal allowed until the **second week**; charge of 10% (week 1) / 20% (week 2); after that, full fees | **CONFLICT** |
| LOA 1–2 consecutive semesters, fewer than 4 prior LOAs; snippet text says "up to 4 semesters" | 4055, 4071, 3916 | LOA approved for **1 year**, renewable for **at most another year**; none within 2 weeks before the last day of classes | **CONFLICT** (and the code disagrees with itself) |
| Residency clock "paused" during LOA | 3916 snippet | Maximum residence is 7 / 9 years **including LOA** | **CONFLICT** |
| Master's 5 years normal / 7 absolute; doctorate 7 / 9; 6-unit refresher in the extension | 4441-4452, 4526-4570 | Same | OK |
| Residency enrolment only for thesis, practicum, comprehensive exam, publication | 4195, 4462-4505 | Same (also "to complete an INC") | Mostly OK |
| Change / add subject | *not found* | First week of classes only, with conditions | **Missing** |
| Dropped for absences over 20% (grade DRP 5.0) | *not found* | Handbook rule | **Missing** — this is the panel's "can a student drop on Day 1?" |
| Retention: weighted average 2.0 (master's) / 1.75 (doctorate); a 5.0 means dropped from the program | *not found* | Handbook rule | **Missing** (grades are out of scope per stakeholder — say so in the document) |
| Academic load 6–9 units part-time, 12 full-time | unit range 0–12 only (9542) | Handbook rule | **Missing** |
| INC must be completed; all-INC means dropped from the rolls | *not found* | Handbook rule | **Missing** |
| Defense lead times, panel size 4 / 5, Turnitin ≤ 15%, comprehensive exam before title | 21280, ~21275, 3949, 1811 | Research Protocol (check each against the protocol text) | To verify |

- [x] **C1. WAITING — owner/stakeholder decision on the three CONFLICT rows.**
      Which is right: the handbook or what Sir Eddie said in the July meetings?
      Do not guess. Run `grill-me` with the owner, then record the answer here.
- [x] **C2. One rules register.** Move every hard-coded rule into a single
      table (rule id, plain-language text, value, process, source document, page,
      effective date). Workflows read the value from it. *Accept:* changing a
      value in the register changes the workflow's behaviour in a test.
- [x] **C3. Each rule cites its policy.** Every rule row points to a
      `PolicyDocument` and a page; the workflow screen shows "Rule: … — source:
      Handbook p. 49". Replacing that document flags its rules "needs review".
- [x] **C4. Answer the panel's drop question in the system.** Dropping a
      subject and Course Adjustments must state and enforce *when* a drop is
      allowed (Day 1? first week? after?), and the rejection message must cite
      the rule.
- [x] **C5. Add the missing handbook rules** that are in scope (change/add
      subject window, academic load), and list in the document the ones
      deliberately out of scope (grades, retention) with the stakeholder reason.
- [x] **C6. Fix the time-bomb test.** `test_workflow_clarification_can_be_
      returned_and_answered` now fails because the withdrawal deadline in its
      fixture (2026-08-07) has passed. The test must set its own dates.

## D. S3 — panel matching gives different, defensible results

Verified: `recommend_panel` (`app.py:21954`) scores out of 100 — specialization
up to 50 (word overlap), availability up to 30, suitability up to 20. No
embeddings and no AI in the score; Gemini only adds keywords and a rationale
when an API key is set. Commit `83ea4f0` added 12 faculty profiles, 42
availability windows and three different concept papers for one demo student.

- [x] **D1. The top candidates still tie on expertise.** *(done, v5.1: expertise is 60 points from TF-IDF / Gemini-embedding similarity between the paper and the faculty expertise records, scaled across the candidate pool; availability 25, workload 15; every candidate has a score breakdown.)* Inferred from a
      re-implementation of the scoring (not from the running app): the top three
      all hit the 50-point cap, so their order comes only from how many free
      time slots were hard-coded (5, 4, 3). The panel asked for differences
      driven by concept paper and expertise. Remove the cap saturation (scale the
      score) so expertise separates them.
- [x] **D2. The demo data is hand-tuned to one student.** *(done, v5.1: 7 demo students in 6 programs, real-pipeline test in `tests/test_panel_matching.py`.)* Add several students
      with concept papers in different fields (education, psychology, business,
      nursing …) so each gets a visibly different panel. *Accept:* a test runs
      the **real** pipeline (no mocked profile) for three papers and asserts three
      different rankings with no equal scores in the top four.
- [ ] **D3. WAITING — real faculty expertise from USLS.** The specialization
      text is invented. Ask the stakeholder for faculty expertise / research
      interests, past advisees, and sample concept papers (see §G).
- [x] **D4. Do not recommend the student's own adviser as a panelist** *(done, v5.1: adviser and co-adviser are excluded and shown as not eligible; panel composition checked against the Research Protocol.)*
      (inferred: not excluded today).
- [x] **D5. Startup overwrites faculty expertise.** *(done, v5.1: seeds only what is missing; runs with the other startup seeders.)* `ensure_panel_matching_
      demo_data` (`app.py:23089`) resets `Faculty.specialization` on every start,
      wiping the roster import and any edit made in the UI. Only seed when empty.
- [x] **D6. Call it what it is.** *(done, v5.1: labelled "Similarity match (keyword TF-IDF)" or "Semantic match (Gemini embeddings)".)* The document and walkthrough say "RAG/AI-
      generated recommendations". If the score stays rule-based, either add real
      semantic similarity (Gemini embeddings already exist for the assistant) or
      describe it honestly. The panel will ask.

## E. D1–D3 — the document

Verified: `Final Proposal Document - CAP-IT1.docx` in the folder has the same
text as the version committed on 2026-08-06 (before the defense); only the
review comments were removed. It has one section with plain page numbers, the
TOC still has page numbers and still lists every table and figure, and there is
**no Business Rules section**. Its page 365 is a faculty-portal screenshot and
page 378 is the API list — so the page numbers on the defense form refer to a
**different, newer file that is not in this repo**.

- [x] **E0. Settled (owner, 2026-10-01: ignore the other copy) — — owner: get the revised document.** Khloe marked D2 and
      D3 "done" on 2026-08-14. Ask her (or check the shared Google Doc) for that
      version and put it in `Documents/CAPSTONE_ONLY/`. If it does not exist,
      E1–E3 must be done from scratch.
- [x] **E1. Pagination:** no page number on the TOC; chapters numbered
      chapter-page (1-1, 1-2 … 2-1 …). Needs a section break per chapter.
- [x] **E2. TOC:** follows that format; tables and figures removed from it
      (they already have their own lists).
- [x] **E3. Business rules chapter/section:** existing rules (from the handbook
      and research protocol) and proposed rules (what the system enforces), per
      process. §C's table is the starting content.
- [x] **E4. Old wording that contradicts the system** (verified in the file):
      - Withdrawal described as leaving the program: "controlled exit process"
        (Fig. text, ch. 1), "monitoring stops" (milestone tables, twice),
        glossary "Withdrawal – the formal process of leaving the graduate
        program". The system does **subject-level** withdrawal.
      - Chapters 1–3 still name Node.js/Express, NotebookLM, LangChain.js,
        OpenAI and ChromaDB (36 mentions). The system is Python/Flask with
        Google Gemini; "Gemini" appears **zero** times. (A locked decision says
        keep the old diagram and document the divergence — make sure that note
        is actually in the text.)
      - "119 routes … 35 tables" is out of date (7 policy routes and one table
        were added).
- [ ] **E5. Walkthrough (`CAP-2521-IT-WALKTHROUGH.docx`) numbering.** Case
      numbers jump 15 → 18; Section 6's running order still lists the old 18
      cases including the removed "Research Gate, Panel Matching, and Defense
      Scheduling"; Graduation steps run 22 → 12; it still lists a Registrar
      login although the Registrar was removed from the app.

## F. N2 + N3 — demo readiness

- [ ] **F1. Demo the Policy Assistant live**, with a Gemini key confirmed on
      the demo machine (without a key it answers by keyword search only). The
      assistant is tuned to a few handbook questions; test ten unscripted ones.
- [x] **F2. "Sign in page — no logging in".** Login is a real password check,
      but the page pre-fills credentials and has one-click student buttons, and
      `/api/auth/demo-students` hands out passwords without login. Type the
      password in the demo; put the quick-login behind a demo-mode switch.
- [x] **F3. Let the Dean and coordinators use the policy chat** (today: staff,
      admin and students only).

## G. WAITING — documents still needed from the stakeholder (USLS)

What we have: Graduate School Handbook 2022-2023, GS Research Protocol AY
2024-2025, the student monitoring template, the research monitoring sheet.

- [x] **G1. Graduate School Operations Manual** — the panel said its policies
      "should be included". It is not in the repo and the handbook never mentions
      it. This blocks S2 and D3 (business rules).
- [ ] **G2. A current handbook** (ours is 2022-2023) or confirmation that it is
      still in force, plus any memo that changed withdrawal / LOA / residency.
- [ ] **G3. Written confirmation of the rules in §C that conflict** (withdrawal
      window and fees, LOA length, whether LOA counts toward residency).
- [ ] **G4. Dropping / change-of-subject procedure and forms** (the Withdrawal
      Form is named in the handbook but we do not have it).
- [ ] **G5. For panel matching:** real faculty expertise / specialization list,
      adviser and panel history, qualification rules for panelists, and real or
      anonymised concept papers across programs.
- [ ] **G6. Practicum and graduation checklists** (official required documents,
      graduation review-window dates, export format the Registrar accepts).
- [ ] **G7. The publication protocol** — our research protocol file is the
      version "without publication protocol".

## I. Documents in sync with the system (do last, after the code settles)

- [ ] **I1. Walkthrough** rewritten against the real app: accounts, nav labels,
      every case's steps re-walked in the running system, new cases (policy
      upload, business rules, monitoring sheet add/edit, LOA/readmission board,
      adviser appointment, calendar), case numbering fixed, fresh screenshots.
- [x] **I2. Proposal** chapters 5–6 and appendices: module descriptions, screen
      specifications, data tables, API and table inventories (counts generated
      from the code, not typed), test matrix and execution record, screenshots.
- [x] **I3. Business Rules section** in the proposal (existing vs proposed),
      generated from the rules register and the Operations Manual draft.
- [x] **I4. README / CHANGELOG / plan files** true to the current build.
- [ ] **I5. Each document rendered with LibreOffice and looked at** before it
      is called done.

## Status on 2026-10-01 (branch `v5.1-migui_clean`)

Done and tested (573 automated tests green before the last merge). Still open:
B7/E5/I1 walkthrough (rewritten against the live app, being merged), I5 render check of the
final documents, F1 a Gemini key on the demo machine for AI-worded answers (keyword answers
work without it), D3/G2–G7 real data and confirmations from the Graduate School, and the
stakeholder's validation of the Operations Manual draft (44 open questions).

## H. State of the build on 2026-09-30

- Gate: 80 tests, **78 pass, 2 fail**. One is the long-known demo-reset fixture
  (`test_workflow_demo_students_quick_login_and_central_reset`, "DEF-001"); the
  other is the date time-bomb in C6. Neither is caused by the v5 commits.
- `.venv` was rebuilt on Python 3.14 (the old one pointed at a removed 3.12).
- No frontend test runner exists.
