# Playwright harness (owner decisions IM7 and IM15)

Proves every role's pages load cleanly on the seeded demo data, and takes the
screenshots used in the design review.

## The one command

From the repo root:

```bash
npm run e2e
```

It builds the SPA (`vite build`), then runs Playwright. Chromium only. A full
run takes about 4 minutes (the server start-up is 30-90 s of that).

First time on a machine (or after Playwright is updated):

```bash
npm --prefix frontend ci
npm --prefix frontend run e2e:install     # chromium into E:/DevCache/ms-playwright
```

Browsers never go on drive C: - `scripts/e2e.mjs` sets
`PLAYWRIGHT_BROWSERS_PATH=E:/DevCache/ms-playwright` for every Playwright call.
Set that variable yourself to use another folder.

## What happens

1. `e2e/support/server.mjs` (Playwright `webServer`) creates a temp folder,
   seeds a **fresh** SQLite database there with `app.py --seed`, then starts
   `app.py` on port **5055**. `DATABASE_URL`, `USLS_UPLOAD_DIR`,
   `POLICY_DOCUMENT_UPLOAD_DIR` and `RAG_INDEX_DIR` are set explicitly, so a
   developer's `.env` and real database are never touched. Python is found via
   `USLS_PYTHON`, then `<repo>/.venv`, then the `.venv` of the main checkout (so
   a git worktree works), then `python` on PATH.
2. `e2e/auth.setup.js` signs in **through the real Login page**, once per role,
   and saves the session (storageState) under `e2e-artifacts/.auth/`.
3. `e2e/sweep.spec.js` - one test per role. It reads the role's sidebar at
   runtime (`aside nav a`), visits every link at **1366x768, 1920x1080 and
   390x844**, waits for network idle, and records a problem for:
   - any console error and any uncaught page error;
   - any `/api/*` response with status >= 400 (allow-list in
     `e2e/support/checker.js`, empty, each entry needs a written reason);
   - a failed `/api/*` request;
   - a visible red error banner (`InlineNotice tone="danger"`), a
     `role="alert"` region, the text "Something went wrong", or the "This page
     is not available yet" screen;
   - horizontal overflow (`scrollWidth > innerWidth + 1`) at any of the three widths;
   - the network never going idle within 20 s.

   The same checks run on the first requests during sign-in. All problems of a
   role are collected and reported together at the end of its test. The sweep
   clicks nothing but navigation links; non-GET API calls triggered by a page
   view are printed as a note.

Roles: student, faculty (the seeded adviser with the most advisees),
dean, staff (GS staff), academic-coordinator, research-coordinator, admin.
The registrar cannot sign in.

## Output

- Screenshots: `frontend/e2e-artifacts/screens/<role>/<page-slug>-<width>.png`
  (full page; the path is printed at the end of the run).
- Findings per role: `frontend/e2e-artifacts/findings/<role>.txt`
  (`role | page | problem | widths | screenshot`).
- HTML report: `frontend/e2e-artifacts/report/`.

`frontend/e2e-artifacts/` is gitignored and cleared at the start of each run.
A failing run is the harness doing its job: the failures are findings about the
app, not about the harness.

## One role only

```bash
cd frontend
npm run e2e -- --grep "student"        # builds, then runs the matching tests
# or, without rebuilding:
node scripts/e2e.mjs test --grep "dean"
```

The role sign-in tests it needs run automatically (the `setup` project).
`--grep` matches the role key (`student`, `faculty`, `dean`, `staff`,
`academic-coordinator`, `research-coordinator`, `admin`).

## Specs share one database (read before writing a spec)

Every spec in one run talks to the same seeded server, and specs run in parallel workers in any order. A spec that
passes alone can fail in the full run because another spec answered an invitation, moved a card or wrote activity first
(I-100 p51, I-113 p78). Rules for every `p<NN>-*.spec.js`:

1. Never assert seeded state that another spec can change (counts, "No activity yet", a card's column, "Waiting for
   documents"). Read the API at test time and assert the page agrees, or mock that response with `page.route`.
2. A spec that changes data uses its own demo student (see `section-j.spec.js`) and never one another spec reads.
3. Before a packet merges, its new spec must pass in the combined run
   `node scripts/e2e.mjs test --project=sweep --project=section-j --project=pages`, not only alone.

## Section J bug tests (data-changing)

`e2e/section-j.spec.js` (Playwright project `section-j`) has one test per defense-walkthrough bug
(I-001 dropped-subject dialog fits 1366x768, I-004 Form 1 endorsement ends without a `getContext`
error, I-008 the Dean's "Mark reviewed" window is named after the button). Unlike the sweep these tests
**change data** (they save a drop, endorse a Form 1, mark a practicum report reviewed); the harness database
is a throwaway. They only touch demo students the sweep does not read (Joshua Lim, Miguel Yu after a reset,
Paolo Ramirez). Setup that is not the bug itself (a student's uploads, staff and coordinator hand-offs) goes
through the JSON API with each role's own login; the screen under test is driven through the browser.
Screenshots: `frontend/e2e-artifacts/section-j/`. Run on their own:

```bash
cd frontend
node scripts/e2e.mjs test --project=section-j
```

## Negative control

```bash
npm run e2e:negative
```

Runs the same checker against a deliberately broken target: a missing SPA route,
plus an injected console error, uncaught exception, failing API call and
5000 px-wide element on the dashboard. It **must fail** (exit code 1) and list
those problems. If it ever passes, the checker has gone blind and a green sweep
means nothing.

## UI check and component gallery (Phase 5)

`npm run e2e` first runs `npm run check:ui:strict` (`scripts/check-ui.mjs --strict`): every count must be 0, over
`src/` that counts arbitrary text sizes, off-scale sizes, raw `<table>`, `<h1>`, modal
overlays and local status colour maps. Files in `check-ui.allow.json` are exempt, each with a reason. A count may fall, never rise
(`check-ui.baseline.json`); `npm run check:ui:strict` is the end state (all zero).
Its own test: `npm run test:check-ui`.

The build step of `npm run e2e` sets `VITE_UI_GALLERY=1`, which adds the `/__ui`
component gallery (not in any sidebar; also on in `npm run dev`).
`e2e/ui-gallery.spec.js` (Playwright project `ui-gallery`) opens it at 1366, 1920
and 390 and checks the type scale, button classes, 16px phone inputs, the page
width cap and the z-index scale. Screenshots: `e2e-artifacts/screens/ui-gallery/`.
