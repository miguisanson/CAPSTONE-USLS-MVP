# Demo sandbox per visitor + Demo Guide "from the top" (owner 2026-11-05)

Owner: "multiple people accessing this web app ... they dont interrupt other people ... i logged in the same account on
2 machines and they were messing with the demo guide". Choice: **private sandbox per visitor**. Demo Guide: "it breaks
when i press back it doesnt do the actions again, when i stop it and go back to another demo guide it just doesnt do it
... it should just reset from the top to be consistent", and "have the toggle also hide the full list if its disabled".

## Server (app.py) - test `tests/test_demo_sandbox.py`
- On when `demo_mode_enabled()` and `DEMO_SANDBOX` is not `0/false/no/off` (default ON) and the main database is SQLite.
  Folder `DEMO_SANDBOX_DIR` (default `<instance or repo>/demo_sandboxes`, gitignored; Docker: inside the data volume).
- Template: `refresh_demo_sandbox_template()` copies the main SQLite DB with the sqlite3 backup API to `<dir>/_template.sqlite3`
  (called after `--seed`, at startup when missing, and by the tests). A sandbox = a copy of the template, `<dir>/<id>.sqlite3`.
- Cookie `usls_sandbox` = 32 lowercase hex (`secrets.token_hex(16)`), HttpOnly, SameSite=Lax, Secure like the session cookie,
  max-age 2 days. Any other value is ignored and replaced. It is NOT part of the Flask session, so sign-in/sign-out
  (`session.clear()`) and the Demo Guide's account switching keep the same sandbox.
- `before_request`: when on, pick or create the visitor's sandbox and put its engine on `g`; `after_request` sets the cookie
  when new. `db.session` uses it through a Session subclass passed as `SQLAlchemy(session_options={"class_": ...})` whose
  `get_bind` returns `g`'s sandbox engine when there is one (Flask-SQLAlchemy 3.1). No request (CLI, seed, background
  sweeps) = the main DB. Engines cached per id (`NullPool` or a tiny pool); touch the file's mtime when used.
- `POST /api/demo/sandbox/reset` (demo mode only, anyone): when on, dispose this visitor's engine, give it a fresh copy
  (a new id is fine) -> `{"ok": true, "sandbox": true}`; when off -> `{"ok": true, "sandbox": false}`.
  `GET /api/auth/config` also reports `"sandbox": true|false`.
- `DEMO_RUNTIME["skip_date_waits"]` becomes per sandbox (dict keyed by sandbox id; no sandbox = the global value).
- `remove_idle_demo_sandboxes(max_idle_hours=env DEMO_SANDBOX_IDLE_HOURS default 24)` deletes sandbox files not used for
  that long (never the template); run it when a new sandbox is made. `dispose_demo_sandboxes()` disposes all cached engines.
- Uploaded files stay in the shared `uploads/` folder (names are random); note this as a shortcut.
- Rule 4 / IM4 unchanged: no ALTER patches, the schema still comes from the models + seed.

## Demo Guide (frontend) - spec `frontend/e2e/p114-demo-guide.spec.js` / `p115-autopilot.spec.js` style
- Starting a guide (sign-in "Start a guided demo", a pick in the panel, "Change demo" then another guide, or after Stop)
  ALWAYS: `POST /api/demo/sandbox/reset`, clear that guide's done list, sign out, then play from step 1. Same every time.
- The slideshow's Back button is replaced by **"Start over"** (same reset, step 1). Stop ends the run; nothing is resumed.
- When the server says `sandbox: false` (local dev without the switch) the reset only clears the done list (old behaviour).
- The sign-in page switch "Show the Demo guide" OFF hides the whole guide list/"Start a guided demo" box, not only the panel.
