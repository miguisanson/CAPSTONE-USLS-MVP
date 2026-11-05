# Demo Guide — design and contract (owner request 2026-11-04)

Owner: "what if we made a tutorial for our capstone like how in-game video games have tutorials, it will
just guide us through for the demos ... take into account during the demos what if our panelists ask us
to do something different. allow the tutorial to let us do something different or input something
different. consider all the options what would happen and unusual cases."

## What it is

A **Demo Guide** panel inside the web app (demo mode only). The presenter picks a demo (Readmission,
Leave of Absence, AWOL, Monitoring Sheet, Reports). The panel shows one step at a time: who must be
signed in, which page, what to click, what to say (the narration line), and what the panel might ask.
It points at the control on screen (a soft highlight ring) and moves on by itself when the step is done.

## The one design rule: the guide follows the record, not the clicks

Every step says **when it is done** in terms of the live record (the case status on the server, the
page open, the role signed in), never "the user clicked X". So whatever the presenter types or picks,
in whatever order, the guide asks the server where the case really is and jumps to the matching step.
A panelist's "do something different" cannot break the guide; at worst the guide says "you left the
script" and offers a way back.

## Contract

### Server: `GET /api/demo/guide-state?process=<slug>&student_id=<id>` (demo mode only, any signed-in role)

Returns `{demo_mode, role, skip_date_waits, process, student, case, candidates}`:
- `role`: the signed-in role key (staff, dean, student, academic_coordinator, research_coordinator, faculty, admin).
- `student`: `{id, name, student_number}` of the followed student (`student_id`, else the process's demo
  student from `WORKFLOW_DEMO_STUDENTS` / the walkthrough demo student, else the signed-in student).
- `case`: the newest case of that process for that student in the board case shape the boards already
  use (`id, status, status_label, owner/waiting_for, kind`), or `null` when none exists yet.
  Processes: `leave-of-absence`, `readmission`, `awol`, `withdrawal`, `graduation`, `practicum`,
  `monitoring` (no case: returns `{status: "record", subject_count, last_change}`), `reports` (no subject).
- `candidates`: up to 20 students who have a case in this process (`student_id, name, status_label`),
  so the presenter can follow another student when a panelist asks.
- Demo mode off: 404 (same as the other demo endpoints). Not signed in: 401. A student may only ask
  about their own record (any other `student_id` is ignored for a student).

### Frontend
- `frontend/src/lib/demoGuide/guides.js`: the guide content (data only). A step:
  `{id, title, role, route, say (narration key in scripts/demo/narration.json), do (one sentence),
  target (CSS selector, optional), doneWhen: {status: [...]} | {route} | {roleIs} | {apiWrite: "path"} | "manual",
  branches: [{status, goto, note}], ifAsked: [{q, a}]}`.
- `frontend/src/lib/demoGuide/engine.js`: pure functions: `resolveStep(guide, state, route)` returns the
  first step not yet done given the live state; `offScript(guide, step, state, route)` returns why the
  presenter is off the script (wrong role, wrong page, unexpected status) and the fix.
- `frontend/src/components/DemoGuide.jsx`: launcher button in the header (demo mode only) + panel
  (desktop: right-side card; phone: bottom sheet; keyboard reachable; Esc closes; reduced motion
  respected). Progress per browser in localStorage (try/catch; works without it).
- `api.js` emits a `demo-guide:api` window event after each write (method, path, status, error message),
  so the guide re-reads the state right after something changes and can show a refused write's reason.

## Off-script and unusual cases (each one has a Playwright check)

| Panelist asks / presenter does | What the guide does |
|---|---|
| Different value (another semester, another reason, other text) | Nothing breaks: steps check the status, not the value. |
| Different decision (Dean returns or denies instead of approving) | Branch: the guide shows that branch's steps (student corrects and resends / denial notice) and how to get back. |
| Skip ahead / do steps out of order / reload / come back later | "Continue from here": re-reads the state and jumps to the matching step. |
| Wrong role signed in | "Sign in as the Dean": shows the demo account and a button to the sign-in page with that account preselected. |
| Wrong page | "Go to <page>" button. |
| Invalid input the app refuses | Shows the app's refusal message and the rule behind it; the step stays. |
| "Do it with another student" | "Follow another student": pick from `candidates`; the guide follows that case. |
| "Can you show it again?" | "Reset this demo student" (existing whitelisted reset, staff only), then restart the guide. |
| A date rule blocks a step (defense date, AWOL grace) | Shows the "Skip date waits" switch state and where to turn it on. |
| Phone / small screen | Bottom sheet, collapsible, never covers the primary button. |
| Guide not wanted | Close; the app works exactly as without it. Demo mode off: the guide does not exist. |
| Server error / offline | "Could not read the record; try again" — no wrong jump. |

## Not doing (now)
Voice, recording. (Auto-clicking is now built: see Autopilot below, which supersedes "the guide never clicks".)

## Autopilot (owner 2026-11-04, supersedes "never clicks for the presenter")

Owner: "the demo guide should be the one controlling the web app ... if thats active and the person clicks one
process ... it should lock onto this kind of slideshow ... when click next arrow it will automatically do it on page
(use smooth ui)". And: "make sure all processes have [a guide]".

- **Slideshow mode.** Starting a demo locks the app into the guide: a bottom bar with Back / **Next** / step n of N /
  Take over / Stop. Next performs the current step on the page by itself, then shows the next step's narration.
- **Visible, smooth actions.** A fake cursor glides to each target (ease-out, ~400 ms), a soft ring pulses on it,
  text is typed character by character (~25 ms/char, skippable), selects open and pick, buttons click; the page
  scrolls the target into view first. `prefers-reduced-motion`: no glide/pulse, instant typing.
- **Step actions (data, per step):** `actions: [{click}, {type, text}, {select, label}, {check}, {upload, fixture},
  {wait}, {signInAs: role}, {go: route}]` with selectors taken from the tested click paths in
  `scripts/docs/walkthrough/capture/case_*.py`. React inputs are set through the native value setter + `input`
  event. Uploads use small fixture files bundled with the guide. Drag and drop is never used (use the step buttons).
- **Role switch is part of Next:** when the next step belongs to another person, Next signs out and in as that
  demo account (one-click demo sign-in) and opens the step's page.
- **Take over:** stops autopilot; the presenter clicks and types freely (a panelist's different value, decision or
  student). The guide keeps following the live record (`/api/demo/guide-state`) and **Next** resumes from the
  step that matches the record. If an action cannot find its target or the server refuses, autopilot pauses on that
  step with the reason and "Do it by hand" / "Try again".
- **One file per guide** under `frontend/src/lib/demoGuide/guides/` so guides can be written in parallel.
- **Every process has a guide**, one per walkthrough case in `scripts/docs/walkthrough/cases/`.
- **Test:** each guide has an e2e spec that plays it end to end in autopilot on the seeded e2e database and checks
  the final record status; this doubles as an end-to-end check of every process.

### Autopilot: how it was built (2026-11-04)
- `lib/demoGuide/autopilot.js` is the player: targets are `"data-demo name"`, `"#id"` or `{role + name | label | text | css, in, nth}`;
  `{stamp}` in typed text, a target's `text` or `name` is the time of day, the same for the whole run. `window.__uslsDemoPlayer` exposes it
  in demo mode for the e2e specs.
- `lib/demoGuide/useAutopilot.js` is the controller; `DemoGuide.jsx` passes it the step the record says is next. Running state lives
  in memory; the step to resume after a sign-in as another person is in sessionStorage.
- Slideshow on/off is `slideshow` in the panel's saved state (`SAVED_KEY`). Choosing a demo (sign-in box or panel) turns it on; the
  bar's Stop or "Change demo" turns it off, "Play as a slideshow" in the panel turns it back on.

### Guides for the processes without a case row (2026-11-04, packet `pkt/guides-more`)
Course Adjustments, Enrollment, Dropping a Subject, Policy Assistant, Student Handoff, Business Rules, Policy Documents, Residency,
Calendars, Portals tour and Best features tour each have a guide in `guides/` and a test in `e2e/p122-autopilot-more.spec.js`.
- They keep no case row, so they use `process: NO_CASE` (`"reports"`, the one slug `GET /api/demo/guide-state` answers with `case: null`
  for any signed-in role). A step is done by `route`, by `apiWrite`, or by `"manual"` after an action that waits for the page's own
  confirmation text. **An `apiWrite` step can be used once per path and per guide**: the writes are remembered for the whole run, so a
  second step with the same path would count as done before it runs; later steps on the same path are `"manual"` with a `wait`.
- Server change that would help (not made, `app.py` belongs to another packet): add these slugs to `DEMO_GUIDE_PROCESSES` and answer them
  with `case: null` (or a `{status: "record"}` like `monitoring`), then change `NO_CASE` in `guides/_shared.js` to the guide's own slug.

### Research guides (2026-11-04, packet `pkt/guides-research`)
Research Title and Form 1, Panel Matching, Defense Scheduling, Verdicts, and Proposal and Final Defense (`guides/research-title.js`,
`panel-matching.js`, `defense-scheduling.js`, `verdicts.js`, `proposal-final.js`) all follow Miguel Yu (`research-miguel`, 2260004), one after
the other: each one starts where the previous one ended, so reset Miguel and play them in that order (tested as one serial chain in `p122`).
- Verdicts are recorded by Graduate School staff from the Research Gate card ("Record for the panel"); the Panel Chair never signs in. The
  chair path is only named in the answers to "if asked". With "Skip date waits" on, a verdict can be recorded right after booking.
- The adviser (Dr. Celeste Tan, role `faculty`) signs the proposal and final documents; the Academic Coordinator signs Form 1 on
  `/form1-endorsements`. New player action `{ draw: target }` strokes a signature canvas with pointer events.
- Not played by the autopilot: faculty accepting or declining a panel invitation (a pending invitation does not block booking; a decline
  does), and the Panel Chair's own verdict page. Both are explained in the guide text only.
- Server change that would help (not made): add the five research slugs to `DEMO_GUIDE_PROCESSES` so the guide can follow the record's
  stage (`NO_CASE` is used today, as for the other case-less guides). Completed research leaves `/api/research-gate/overview`, so the end of
  Proposal and Final Defense is read from the student record (`current_stage: Completed`).
