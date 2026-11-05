---
name: persona-uat
description: Run human-like tester agents ("personas") through the running USLS app in a real browser and turn what confuses them into ISSUES.md rows. Use for "persona test", "user testing agents", "UAT dry run", "human-like testers", "test it as a Dean / student / staff", or before the Fable review, a release, or after a big UI change.
---
# Persona UAT

Browser agents play one role each (a worried student, a rushed staff member, a Dean on a phone), pursue goals
with only what is on screen, think aloud, and give up when a real person would. Design and evidence:
`.planning/research/PERSONA-UAT-RESEARCH-2026-11-02.md`. This is a **pre-pass for the real UAT, never a
replacement**. Agent success is an **upper bound** on real-user success: LLM testers push through friction a
person would quit at, read more patiently, and miss that a task is already done. A persona that fails is a
strong signal; a persona that succeeds proves little.

## When to use
- Before the Fable review, before a release or a UAT round, and after any big UI change (new page, new flow,
  new vocabulary, layout shell).
- 1-2 personas per change: pick the roles the change touches. A full 8-persona sweep (about 30-45 min in
  batches of 3) is for a release.
- Not for regressions in data or rules (that is the Playwright suite) and not for visual polish alone.

## Personas (`personas/`)
| Card | Role / demo account | Main stress |
|---|---|---|
| `student-new.md` | Student | Rules and vocabulary, Policy Assistant, enrollment, withdrawal |
| `student-leave.md` | Student on leave | Leave of Absence, AWOL & Residency, Readmission wording |
| `student-thesis.md` | Student, research | Research Progress, defense schedule |
| `staff-rushed.md` | GS Staff | Term-end speed, import, reports |
| `dean-phone.md` | Dean, 390 px | Approvals on a phone, export |
| `faculty-rare.md` | Faculty | Rare login, pending items, My Calendar |
| `coordinator-academic.md` | Academic Coordinator | Non-technical, course/enrollment setup |
| `coordinator-research.md` | Research Coordinator | Non-technical, defense scheduling, panel |
| `admin.md` | Administrator | Settings, policy documents, logs |

Logins come from the card and `UAT.md` section 4 /
`frontend/e2e/support/accounts.js`. The shared demo password lives in `accounts.js` (`PASSWORD`);
`run-persona.mjs` reads it from there, so never paste it into prompts, cards or reports.

## How to run
1. **Main session starts ONE seeded server** (30-90 s; needs `frontend/dist`, run `npm run build` first if
   `frontend/src` changed). It uses a throw-away SQLite database and no API keys, so it never touches real data:
   ```bash
   mkdir -p 'E:/Temp/claude/e2e-persona'
   cd frontend && E2E_PORT=5440 USLS_E2E_TMP='E:\Temp\claude\e2e-persona' node e2e/support/server.mjs
   ```
   Run it in the background; ready when `http://127.0.0.1:5440/api/auth/config` answers. Do not run it while
   `npm run e2e` runs in the same checkout (both clear `frontend/e2e-artifacts`). Stop it when done.
   Personas share the database, so give each persona its own demo account (the cards say which) and do not run
   two personas on the same account.
2. **One Sonnet subagent per persona, max 3 at once** (`Agent`, `model: "sonnet"`). Fill the prompt template
   below with the card text, base URL, email, viewport and an output folder
   (`E:\Temp\claude\persona-uat\<persona>\`). Do not give the subagent source paths, ISSUES.md, or hints.
3. Each subagent drives the app **only** through `run-persona.mjs` (below) and writes its report to
   `<out>/report.md`.
4. **Main session collects**, scores, de-duplicates against `.planning/ISSUES.md`, files rows, stops the server.

### The helper
`node .claude/skills/persona-uat/run-persona.mjs --base http://127.0.0.1:5440 --email <e> --viewport 390x844 --out <dir>`
reads newline-delimited JSON actions on stdin, runs them, prints one JSON result line per action (ok, error, url,
page title, output), then exits. The first call signs in through the real login form; later calls with the same
`--out` reuse the saved session and reopen the last page, so a persona works in many short calls. Each call reloads the page, so on-page state (a half-typed form, a chat) is lost between calls: keep one in-page task, e.g. ask the Policy Assistant and read the answer, inside ONE batch (use `wait`):
```bash
node .claude/skills/persona-uat/run-persona.mjs --base http://127.0.0.1:5440 --email student@usls.edu.ph --out "$OUT" <<'EOF'
{"text":true}
{"click":{"role":"link","name":"Policy Assistant"}}
{"fill":{"role":"textbox","name":"Your question","value":"Can I drop a subject?"}}
{"press":"Enter"}
{"shot":"step03"}
EOF
```
Actions: `goto` (app origin only), `click` (`role`+`name`, or `text`; optional `nth`, `exact`), `fill` (`role`+`name` as the outline shows, or `label`, or
`placeholder`, `value`), `press`, `wait` (seconds, max 15; for slow answers), `shot` (viewport PNG into `<out>`), `text` (visible main text), `a11y`
(role/name outline). Console errors, page errors, failed requests and HTTP >= 400 go to `<out>/errors.json`.

## Subagent prompt template
```
You are {persona name}, a real person using a web app called the USLS Graduate School system for the first time
in this session. You are not a tester and you do not know how it is built.

WHO YOU ARE
{paste the card: background, tech skill, patience, device, accessibility, reading style, mood}

YOUR GOALS (do them in this order; if a goal is done, say so and move on)
{paste the card's goals}

RULES
- Act only on what you can see on the page (text, the outline, screenshots). Never read source code, files in
  the repo, .planning/, or call the API / curl / fetch directly. Never open anything except {base}.
- Use ONLY run-persona.mjs for the browser (command below). One batch of 1-5 actions per call, then read the
  result before deciding the next step. Take a screenshot (`shot`) after every step.
- Stay in character: read the way the card says, get confused where that person would, and do not use
  knowledge a real user could not have (no guessing URLs, no insider terms you have not seen on screen).
- Patience budget: {N} steps in total, and give up on a goal after 3 failed attempts or when your mood says
  you would quit. Giving up honestly is a correct result; do not push through a dead end.
- Do not change the account password or sign out. Destructive confirms: say what you would do and stop.
- Think aloud. After EVERY step append one row to {out}/log.md:
  step | looking at | expected | did | result | feeling
  (feeling is one of ok / unsure / lost / annoyed; "looking at" is what you saw, "expected" what you thought
  would happen)

COMMAND
node .claude/skills/persona-uat/run-persona.mjs --base {base} --email {email} --viewport {WxH} --out {out}   (actions on stdin)

WHEN DONE write {out}/report.md: for each goal -> done / done with help / failed, steps you took, where you
were confused (quote the wording), anything that looked broken, keyboard or small-screen problems you hit, and
one paragraph in the first person on how it felt. Do not suggest code fixes.
```

## Scoring rubric (per task, main session)
| Axis | How |
|---|---|
| Task success | **done** (reached the goal alone) / **with help** (needed a hint, a detour through the Policy Assistant, or a wrong turn it recovered from) / **failed** (gave up or finished wrong) |
| Efficiency | steps taken vs the shortest path you know; more than 2x is a detour |
| Confusion count | rows with feeling `unsure`, `lost`, `annoyed` |
| Wording | label, heading, button or message the persona misread or could not understand (quote it) |
| Accessibility | keyboard-only: reach and operate everything with Tab/Enter/Escape and a visible focus; at 390 px: no sideways scroll, targets reachable, nothing cut off (`a11y` outline and screenshots) |
| Consistency | same-kind pages should behave alike (owner's top concern, IM24 in `.planning/DECISIONS.md`): compare how the persona's page differs from its siblings (lists, process pages, dialogs, empty states) |
| Errors | `errors.json`: console errors, failed requests, 4xx/5xx the persona could not have caused |

Each finding gets a confidence 0-1: how sure you are this is a real problem for a real person, not a quirk of
the agent. Single-sentence evidence: screenshot name and log step.

## Findings into ISSUES.md
1. De-duplicate against `.planning/ISSUES.md` first (same page, same symptom, extend that row instead).
2. Confidence < 0.6 stays in the report; no row.
3. Row prefix `audit: persona-uat <persona>`; class BUG / UI / FEATURE as fits. Severity: **failed task = P1**,
   **detour = P2**, **wording or polish = P3**. Evidence column: report path and screenshot.
4. A BUG row needs a reproduction first (by hand, or a Playwright test with a `REGRESSION.md` row) before it
   counts; a persona's say-so is not a reproduction.
5. Keep the reports in `E:\Temp\claude\persona-uat\`; never commit screenshots that show real data.

## Calibration after real UAT
After the real testers have been through: list where each stuck, compare with the persona runs (stuck in both,
only humans, only agents). Persona misses = the card was too patient or too clever: lower the patience budget,
tighten the reading style, add the real question the humans asked. Record the hit rate in the research file
so the next sweep knows how far to trust the agents.
