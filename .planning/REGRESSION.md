# Regression list

A growing list of things that must stay true. Adapted from DD-Project-GameMaker.

## Rules

- **Every fixed bug adds a row before its fix merges.** The failing test is the row.
- Every new feature adds 1–3 rows for its Done-when.
- Rows are never deleted. An obsolete check is replaced, with the reason in Notes.
- **Per packet:** run the rows tagged with the areas the packet touches, plus their neighbours.
- **Before the owner merges into `v5.1-migui_clean`:** run every automated row.
- "Last run" reads `<commit> PASS | FAIL | NOT RUN | MANUAL`. **A row with no run on the
  current commit counts as unchecked, not green.**
- Status `PENDING` = the test is written before the fix exists; it counts once the fix lands.

**Tags:** `seed`, `auth`, `enrollment`, `withdrawal`, `form1`, `research-gate`, `defense`,
`panel`, `practicum`, `graduation`, `monitoring`, `residency`, `assistant`, `leave`, `ui-layout`.

**How checked:** `UT` = unittest name (`tests/…`), `PW` = Playwright walkthrough step
(`frontend/e2e/…`, from Phase 2), `SHOT` = screenshot review at 1366/1920/390.

## Rows

| ID | What must stay true | Tags | How checked | Status | Added | Last run |
|----|---------------------|------|-------------|--------|-------|----------|
| R-001 | Two fresh seeds on two machines (or two temp dirs) produce the same database fingerprint, a first start on an empty database builds the same data, and a normal app start does not change it. (I-015) | seed | UT `tests/test_seed_determinism.py` | ACTIVE | 2026-10-17 | pkt/seed faa46b4: PASS (4/4); fingerprint identical with PYTHONHASHSEED 0 and 4242 |
| R-002 | Every page of every sign-in role loads with no console error, no failed `/api` call, no error banner, and no horizontal scroll at 1366, 1920 and 390 px. (I-031..I-035, I-037) | ui-layout | PW `frontend/e2e/sweep.spec.js` (`npm run e2e`); negative control `npm run e2e:negative` must fail | ACTIVE (academic-coordinator red until I-036) | 2026-10-17 | ada73ad+mobile: 13 PASS, 1 FAIL (I-036 only) |
| R-003 | Enrollment "Record dropped subject" dialog fits a 1366×768 screen, scrolls inside itself, and its Save button can be reached and clicked. (I-001, J1) | enrollment, ui-layout | PW `frontend/e2e/section-j.spec.js` I-001 | ACTIVE | 2026-10-17 | after j-frontend merge: PASS |
| R-004 | Endorsing and signing a Form 1 shows no getContext error and the queue shows Endorsed without a reload. (I-004, J4) | form1 | PW `frontend/e2e/section-j.spec.js` I-004 | ACTIVE | 2026-10-17 | after j-frontend merge: PASS |
| R-005 | The Dean's confirmation window is titled after the button clicked ("Mark reviewed" for practicum). (I-008, J8) | practicum | PW `frontend/e2e/section-j.spec.js` I-008 | ACTIVE | 2026-10-17 | after j-frontend merge: PASS |
| R-006 | A page view does not write: `GET /api/faculty-portal/context` and `/panel-invitations` change no table, two simultaneous first loads both return 200, and every seat on a current panel already has its invitation after the demo build. (I-038) | faculty, panel-matching | UT `tests/test_reads_do_not_write.py` + PW `frontend/e2e/p90-reads.spec.js` (faculty) | ACTIVE | 2026-10-17 | pkt/get-writes: PASS |
| R-007 | Opening Leave of Absence or Readmission as staff or admin sends no request other than GET; the "Refresh leave dates" button still sends the sync. (I-039) | leave | UT `tests/test_reads_do_not_write.py` + PW `frontend/e2e/p90-reads.spec.js` (leave) | ACTIVE | 2026-10-17 | pkt/get-writes: PASS |
| R-008 | A question the policy documents do not cover gets the plain "the USLS policy documents in the library don't cover this. Ask the Graduate School office." answer with no passages, and Gemini is not called when retrieval is weak. (I-013, J13) | assistant | UT `tests/test_policy_assistant.py` HonestAnswerTests + PW `frontend/e2e/p80-assistant.spec.js` | ACTIVE | 2026-10-17 | pkt/assistant: PENDING integrator run |
| R-009 | Gemini sees only the retrieved excerpts (no student record, no curated snippets) and the answer lists document, page and section; a personal question ("what is my next step") is answered from the signed-in user's own record or queue only, never another person's. (IM21) | assistant | UT `tests/test_policy_assistant.py` GroundedAnswerTests + PersonalAnswerTests | ACTIVE | 2026-10-17 | pkt/assistant: PENDING integrator run |
| R-010 | With no key, or on a Gemini error/timeout, the keyword answer comes back labelled "Offline answer" with its sources; nothing is invented. (IM21) | assistant | UT `tests/test_policy_assistant.py` OfflineFallbackTests + PW `frontend/e2e/p80-assistant.spec.js` | ACTIVE | 2026-10-17 | pkt/assistant: PENDING integrator run |
| R-011 | Section J backend: an exported Dean-approved graduation batch shows "Exported - Ready to Send" (I-010); residency is refused while the checker says "Needs Human Review" (I-012); the Research Coordinator's student search finds seeded students (I-005); after a demo reset single-student enrollment works (I-002). | graduation, awol, research-gate, enrollment | UT `tests/test_section_j_backend.py` | ACTIVE | 2026-10-22 | merge of pkt/be: PASS (4 OK) |
| R-012 | Demo safety and roles: demo reset refuses an anonymous call (I-055); a wrong-password burst from one IP never blocks the right password from another and the delay is short and growing (I-056); demo mode never uses the public secret string (I-057); admin can complete staff workflow steps (I-058); the Academic Coordinator nav has no page whose API refuses it (I-036); the withdrawal task links to its screen (I-073). | auth, roles | UT `tests/test_v53_backend.py` + PW sweep (academic-coordinator) | ACTIVE | 2026-10-22 | merge of pkt/be2: PASS (9 OK) |
| R-013 | Seed quality: no faculty over its advisee limit; no adviser on their advisee's panel; every Dean queue has a waiting case; no research-stage student without completed coursework; no subject titled with its own code; seeded history spans several weeks; terms within the current +-2 years. (I-060, I-061, I-062, I-070, I-095) | seed | UT `tests/test_seed_quality.py` | ACTIVE | 2026-10-22 | merge of pkt/seed2: PASS |
