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
| R-001 | Two fresh seeds on two machines (or two temp dirs) produce the same database fingerprint, and a normal app start does not change it. (I-015) | seed | UT `tests/test_seed_determinism.py` (Phase 1) | PENDING | 2026-10-17 | NOT RUN |
| R-002 | Every page of every sign-in role loads with no console error, no failed `/api` call, no error banner, and no horizontal scroll at 1366, 1920 and 390 px. (I-031..I-035, I-037) | ui-layout | PW `frontend/e2e/sweep.spec.js` (`npm run e2e`); negative control `npm run e2e:negative` must fail | ACTIVE (academic-coordinator red until I-036) | 2026-10-17 | ada73ad+mobile: 13 PASS, 1 FAIL (I-036 only) |
