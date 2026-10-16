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
   - a visible red error banner (`ErrorNote` in `components/ui.jsx`), a
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

## Negative control

```bash
npm run e2e:negative
```

Runs the same checker against a deliberately broken target: a missing SPA route,
plus an injected console error, uncaught exception, failing API call and
5000 px-wide element on the dashboard. It **must fail** (exit code 1) and list
those problems. If it ever passes, the checker has gone blind and a green sweep
means nothing.
