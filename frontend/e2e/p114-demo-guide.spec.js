// e2e-writes: therese
// The Demo Guide (owner request 2026-11-04, .planning/demo-guide/DESIGN.md): a panel that walks the presenters through a demo
// and keeps working when a panelist asks for something different. The one rule: the guide follows the RECORD (the case status
// the server reports), never the clicks.
//
//   engine          pure step resolution and off-script detection (src/lib/demoGuide/engine.js)
//   happy path      the Readmission guide follows the real case through student, staff and Dean (demo student Therese Lacson,
//                   reset before and after; every other test below answers GET /api/demo/guide-state with page.route)
//   off-script      one test per row of the DESIGN table (different value, different decision, skip ahead, wrong role, wrong
//                   page, refused input, another student, reset, date waits, phone, closed / demo off, offline)
//   sign-in page    the "Demo guide" entry names the account to use
//   screenshots     the open panel at 1366, 1920 and 390 px, to frontend/e2e-artifacts/screens/p114/
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, BASE_URL, REPO_ROOT } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { GUIDES, RESET_KEYS } from "../src/lib/demoGuide/guides.js";
import { caseStatus, isDone, offScript, resolveStep, routeMatches, writeMatches } from "../src/lib/demoGuide/engine.js";

const SHOTS = join(ARTIFACTS_DIR, "screens", "p114");
mkdirSync(SHOTS, { recursive: true });

const THERESE_EMAIL = "readmission.therese@usls.edu.ph";
const THERESE = { id: 9001, name: "Therese Lacson", student_number: "GS-2026-READ-01" };
const GABRIEL = { id: 9002, name: "Gabriel Domingo", student_number: "GS-2026-READ-02" };
const readmission = GUIDES.find((guide) => guide.id === "readmission");

// ------------------------------------------------------------------------------------------------ helpers
async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  expect(await (await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}

/** A browser signed in through the API, with its own session. */
async function openAs(browser, email, { width = 1366, height = 768 } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width, height } });
  expect((await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `sign in as ${email}`).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe(email);
  const page = await context.newPage();
  return { context, page };
}

const caseOf = (status, label = status) => ({ id: 501, kind: "READMISSION", status, status_label: label, owner: "" });
const stateBody = (over = {}) => ({
  demo_mode: true, role: "staff", skip_date_waits: true, process: "readmission", student: THERESE, case: null, candidates: [], ...over,
});

/** Answer GET /api/demo/guide-state with `get` (a body, or a function of the request URL). Returns the URLs asked. */
async function mockState(page, get) {
  const asked = [];
  await page.route("**/api/demo/guide-state**", (route) => {
    const url = new URL(route.request().url());
    asked.push(url);
    return route.fulfill({ json: typeof get === "function" ? get(url) : get });
  });
  return asked;
}

const launcher = (page) => page.getByRole("button", { name: "Demo guide", exact: true });
const panelOf = (page) => page.getByRole("region", { name: "Demo guide" });
const step = (panel, title) => panel.getByRole("heading", { level: 3, name: title });

async function openGuide(page, title = "Readmission") {
  await launcher(page).click();
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  const choice = panel.getByRole("button", { name: new RegExp(`^${title}`) });
  if (await choice.count()) await choice.first().click();
  return panel;
}

// ------------------------------------------------------------------------------------------------ the engine and the content
test.describe("engine and content (pure)", () => {
  const fixture = {
    process: "x",
    accounts: { staff: { who: "Graduate School staff", label: "Graduate School staff", email: "s@x" }, dean: { who: "the Dean", label: "the Dean", email: "d@x" } },
    steps: [
      { id: "a", role: "staff", route: "/a", page: "Page A", doneWhen: { status: ["One", "Two", "Three"] } },
      { id: "b", role: "staff", route: ["/b", "/c"], page: "Page B", doneWhen: { status: ["Two", "Three"] } },
      { id: "m", role: "staff", route: "/b", doneWhen: "manual" },
      { id: "c", role: "dean", route: "/dean", page: "Dean page", doneWhen: { status: ["Three"] }, branches: [{ status: ["Back"], goto: "r", note: "Sent back" }] },
      { id: "w", role: "staff", route: "/b", doneWhen: { apiWrite: "POST /things/*/rows" } },
      { id: "r", side: true, role: "staff", route: "/b", doneWhen: "manual" },
    ],
  };
  const at = (status) => ({ role: "staff", case: status ? { status } : null });

  test("the step comes from the record, whatever was clicked", () => {
    expect(resolveStep(fixture, at(null), "/").step.id).toBe("a");
    expect(resolveStep(fixture, at("One"), "/").step.id).toBe("b");
    // skip ahead: the record is at Two, the manual step between is not asked for, the next undone step is
    expect(resolveStep(fixture, at("Two"), "/").step.id).toBe("m");
    expect(resolveStep(fixture, at("Three"), "/", { done: new Set(["m"]) }).step.id).toBe("w");
    expect(resolveStep(fixture, at("Back"), "/").step.id).toBe("r");
    expect(resolveStep(fixture, at("Back"), "/").branch.note).toBe("Sent back");
  });

  test("unknown status, wrong role and wrong page are named", () => {
    const b = fixture.steps[1];
    expect(offScript(fixture, b, { role: "dean", case: { status: "One" } }, "/b")[0]).toMatchObject({ kind: "role", fix: { type: "signIn", email: "s@x" } });
    expect(offScript(fixture, b, at("One"), "/zzz")[0]).toMatchObject({ kind: "page", fix: { type: "go", to: "/b", label: "Go to Page B" } });
    expect(offScript(fixture, b, at("One"), "/c/1")).toEqual([]);
    expect(offScript(fixture, b, at("Strange"), "/b")[0]).toMatchObject({ kind: "status", fix: { type: "pick" } });
    expect(caseStatus(at(null))).toBe("none");
  });

  test("writes and routes match as the pattern says; a refused write does not finish a step", () => {
    expect(writeMatches("POST /things/*/rows", { method: "POST", path: "/things/12/rows", status: 200 })).toBe(true);
    expect(writeMatches("POST /things/*/rows", { method: "POST", path: "/things/12/rows", status: 400 })).toBe(false);
    expect(writeMatches("POST /things/*/rows", { method: "PATCH", path: "/things/12/rows", status: 200 })).toBe(false);
    expect(isDone(fixture.steps[4], at("Three"), "/", { writes: [{ method: "POST", path: "/things/3/rows", status: 200 }] })).toBe(true);
    expect(routeMatches({ route: "/dean/approvals" }, "/dean/approvals/readmission?x=1")).toBe(true);
    expect(routeMatches({ route: "/" }, "/students")).toBe(false);
  });

  test("every guide is complete: narration key exists, 1-3 questions, a branch target exists, no pronouns for people", () => {
    const narration = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "demo", "narration.json"), "utf8"));
    const pronoun = /\b(he|she|they|them|their|his|her|hers|him|himself|herself|themselves)\b/i;
    expect(GUIDES.map((g) => g.id)).toEqual(["leave-of-absence", "readmission", "awol", "monitoring", "reports"]);
    for (const guide of GUIDES) {
      const ids = new Set(guide.steps.map((s) => s.id));
      for (const s of guide.steps) {
        const where = `${guide.id}/${s.id}`;
        expect(s.say in narration, `${where} narration key ${s.say}`).toBe(true);
        expect(s.ifAsked.length, `${where} questions`).toBeGreaterThanOrEqual(1);
        expect(s.ifAsked.length, `${where} questions`).toBeLessThanOrEqual(3);
        expect(s.do.length, `${where} one sentence`).toBeGreaterThan(10);
        for (const b of s.branches || []) expect(ids.has(b.goto), `${where} branch ${b.goto}`).toBe(true);
        const text = [s.title, s.do, s.rule, ...s.ifAsked.flatMap((x) => [x.q, x.a])].filter(Boolean).join(" ");
        expect(pronoun.test(text), `${where} pronoun in: ${text.match(pronoun)}`).toBe(false);
      }
    }
    for (const guide of GUIDES.filter((g) => g.studentNumber && g.process !== "monitoring")) expect(Object.keys(RESET_KEYS)).toContain(guide.studentNumber);
  });
});

// ------------------------------------------------------------------------------------------------ happy path (real data)
test.describe("the Readmission guide on the real case", () => {
  test.describe.configure({ mode: "serial" });
  let staffApi;

  test("refused input: the app's own message and the rule behind it show, and the step stays", async ({ browser, playwright }) => {
    const staffApi = await apiAs(playwright, "staff@usls.edu.ph");
    await okJson(await staffApi.post("/api/auth/demo-students/readmission-therese/reset", { data: {} }), "reset Therese"); // a clean form
    await staffApi.dispose();
    const { context, page } = await openAs(browser, THERESE_EMAIL);
    try {
      await mockState(page, stateBody({ role: "student", skip_date_waits: false }));
      await page.route("**/api/student-portal/requests/readmission", (route) => route.fulfill({ status: 400, json: { error: "Pick a semester that has not started yet." } }));
      await page.goto("/student/requests/readmission");
      const panel = await openGuide(page);
      await expect(step(panel, "Ask to come back")).toBeVisible();
      await page.locator("#readmission-term").selectOption({ index: 1 });
      await page.locator("#readmission-intent").fill("Typed something the server will not accept.");
      await page.getByRole("button", { name: "Submit readmission request" }).click();
      await page.getByRole("button", { name: "Send request" }).click();
      const refused = panel.getByRole("alert");
      await expect(refused).toContainText("The app refused that change");
      await expect(refused).toContainText("Pick a semester that has not started yet.");
      await expect(refused).toContainText("Graduate School Handbook 2022-2023, p. 53"); // the rule behind it
      await expect(refused).toContainText("Skip date waits is off"); // a date rule is a possible cause
      await expect(step(panel, "Ask to come back")).toBeVisible(); // the step stays
    } finally {
      await context.close();
    }
  });

  test("student files, staff forward, the Dean approves: the guide is at the right step every time", async ({ browser, playwright }) => {
    test.setTimeout(300_000);
    staffApi = await apiAs(playwright, "staff@usls.edu.ph");
    const reset = async () => okJson(await staffApi.post("/api/auth/demo-students/readmission-therese/reset", { data: {} }), "reset Therese");
    await reset();
    const contexts = [];
    try {
      // --- the student: the guide opens at step 1 and moves on by itself when the request is sent
      const student = await openAs(browser, THERESE_EMAIL);
      contexts.push(student.context);
      await student.page.goto("/student/requests/readmission");
      const studentPanel = await openGuide(student.page);
      await expect(step(studentPanel, "Ask to come back")).toBeVisible();
      await expect(studentPanel).toContainText("Step 1 of 5");
      await expect(studentPanel).not.toContainText("Sign in as");
      await student.page.locator("#readmission-term").selectOption({ index: 1 });
      await student.page.locator("#readmission-intent").fill("My leave is ending and I am ready to resume thesis work.");
      await student.page.getByRole("button", { name: "Submit readmission request" }).click();
      await student.page.getByRole("button", { name: "Send request" }).click();
      await expect(step(studentPanel, "Start the staff review")).toBeVisible(); // the write moved the guide, nobody clicked it
      await expect(studentPanel).toContainText("Record: Submitted");
      await expect(studentPanel.getByRole("button", { name: "Sign in as Graduate School staff" })).toBeVisible(); // wrong role now
      await student.page.screenshot({ path: join(SHOTS, "happy-student-1366.png") });

      // --- staff: a brand-new browser, nothing remembered: the guide reads the record and lands on the right step
      const staff = await openAs(browser, "staff@usls.edu.ph");
      contexts.push(staff.context);
      await staff.page.goto("/workflow/readmission");
      const staffPanel = await openGuide(staff.page);
      await expect(step(staffPanel, "Start the staff review")).toBeVisible();
      await expect(staffPanel).not.toContainText("Sign in as");
      const read = await okJson(await staff.context.request.get(`/api/demo/guide-state?process=readmission&student_number=${THERESE.student_number}`), "guide state");
      expect(read.case.status).toBe("Submitted");
      expect(read.student.name).toBe("Therese Lacson");
      await okJson(await staffApi.post(`/api/leave-cases/${read.case.id}/transition`, { data: { action: "forward", eligibility_result: "Eligible" } }), "staff forward");
      // skip ahead: staff did the next steps another way; "Continue from here" re-reads the record
      await staffPanel.getByRole("button", { name: "Continue from here" }).click();
      await expect(step(staffPanel, "The Dean decides")).toBeVisible();
      await expect(staffPanel.getByRole("button", { name: "Sign in as the Dean" })).toBeVisible();

      // --- the Dean: approves in the real page; the guide shows the last step with the new status
      const dean = await openAs(browser, "dean@usls.edu.ph");
      contexts.push(dean.context);
      await dean.page.goto(`/dean/case/readmission/${read.case.id}`);
      const deanPanel = await openGuide(dean.page);
      await expect(step(deanPanel, "The Dean decides")).toBeVisible();
      await expect(deanPanel).not.toContainText("Sign in as");
      await dean.page.getByRole("button", { name: "Approve", exact: true }).click();
      await dean.page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
      await expect(step(deanPanel, "The student is back")).toBeVisible();
      await expect(deanPanel).toContainText("Record: Approved");
      await dean.page.screenshot({ path: join(SHOTS, "happy-dean-1366.png") });
    } finally {
      for (const context of contexts) await context.close().catch(() => {});
      await reset().catch(() => {});
      await staffApi.dispose();
    }
  });
});

// ------------------------------------------------------------------------------------------------ off-script rows
test.describe("off script (the record is answered by page.route)", () => {
  test("different value: the step depends on the status, not on what was typed", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      const body = (reason) => stateBody({ case: { ...caseOf("Staff Review", "In staff review"), reason_text: reason, target_label: "AY 2031 Summer" } });
      await mockState(page, body("A reason nobody planned for"));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(step(panel, "Staff forward it to the Dean")).toBeVisible();
      await expect(panel).toContainText("Record: In staff review");
    } finally {
      await context.close();
    }
  });

  test("different decision: the Dean returns, then denies; the guide shows that branch", async ({ browser }) => {
    const { context, page } = await openAs(browser, "dean@usls.edu.ph");
    try {
      let current = stateBody({ role: "dean", case: caseOf("Returned", "Returned to student") });
      await mockState(page, () => current);
      await page.goto("/dean/approvals/readmission");
      const panel = await openGuide(page);
      await expect(step(panel, "Correct it and send it again")).toBeVisible();
      await expect(panel).toContainText("The request was returned with a comment");
      await expect(panel.getByRole("button", { name: "Sign in as Therese Lacson" })).toBeVisible(); // the student must act
      current = stateBody({ role: "dean", case: caseOf("Denied", "Not approved") });
      await panel.getByRole("button", { name: "Continue from here" }).click();
      await expect(step(panel, "Not approved")).toBeVisible();
      await expect(panel).toContainText("The Dean did not approve the return");
      current = stateBody({ role: "dean", case: caseOf("Submitted") }); // the student sent it again: back on the main path
      await panel.getByRole("button", { name: "Continue from here" }).click();
      await expect(step(panel, "Start the staff review")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("skip ahead and reload: Continue from here re-reads the record; a reload comes back to the same place", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      let current = stateBody({ case: caseOf("Submitted") });
      const asked = await mockState(page, () => current);
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(step(panel, "Start the staff review")).toBeVisible();
      // the presenters did steps 2 and 3 out of order, somewhere else
      current = stateBody({ case: caseOf("Dean Review", "With the Dean") });
      const before = asked.length;
      await panel.getByRole("button", { name: "Continue from here" }).click();
      await expect(step(panel, "The Dean decides")).toBeVisible();
      expect(asked.length).toBeGreaterThan(before);
      // browsing back to an earlier step is allowed, and says the record is further on
      await panel.getByRole("button", { name: "Previous step" }).click();
      await expect(panel).toContainText("The record is further on");
      // a reload (or coming back later) keeps the open guide and reads the record again
      current = stateBody({ role: "staff", case: caseOf("Approved") });
      await page.reload();
      const again = panelOf(page);
      await expect(again).toBeVisible();
      await expect(step(again, "The student is back")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("wrong role: Sign in as the Dean signs out and opens the sign-in page with that account ready", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ case: caseOf("Dean Review", "With the Dean") }));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(panel).toContainText("This step is for the Dean. You are signed in as Graduate School staff.");
      await panel.getByRole("button", { name: "Sign in as the Dean" }).click();
      await expect(page).toHaveURL(/\/login\?as=dean%40usls\.edu\.ph/);
      await expect(page.locator("#login-email")).toHaveValue("dean@usls.edu.ph");
    } finally {
      await context.close();
    }
  });

  test("wrong page: Go to the page opens it", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ case: caseOf("Submitted") }));
      await page.goto("/students");
      const panel = await openGuide(page);
      await expect(panel).toContainText("This step happens on Readmission.");
      await panel.getByRole("button", { name: "Go to Readmission" }).click();
      await expect(page).toHaveURL(/\/workflow\/readmission$/);
      await expect(panel).not.toContainText("This step happens on");
    } finally {
      await context.close();
    }
  });

  test("follow another student: pick from the students who have a case; the guide asks about that student", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      const candidates = [
        { student_id: THERESE.id, name: THERESE.name, status_label: "Submitted" },
        { student_id: GABRIEL.id, name: GABRIEL.name, status_label: "With the Dean" },
      ];
      const asked = await mockState(page, (url) =>
        url.searchParams.get("student_id") === String(GABRIEL.id)
          ? stateBody({ student: GABRIEL, case: caseOf("Dean Review", "With the Dean"), candidates })
          : stateBody({ case: caseOf("Submitted"), candidates }),
      );
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(panel).toContainText("Therese Lacson");
      await panel.getByLabel("Follow another student").selectOption({ label: "Gabriel Domingo - With the Dean" });
      await expect(panel).toContainText("Gabriel Domingo");
      await expect(step(panel, "The Dean decides")).toBeVisible();
      expect(asked.some((url) => url.searchParams.get("student_id") === String(GABRIEL.id))).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("reset: staff reset the demo student after a confirmation; the Dean is told who can", async ({ browser }) => {
    const staff = await openAs(browser, "staff@usls.edu.ph");
    try {
      let current = stateBody({ case: caseOf("Dean Review", "With the Dean") });
      await mockState(staff.page, () => current);
      const resets = [];
      await staff.page.route("**/api/auth/demo-students/*/reset", (route) => {
        resets.push(new URL(route.request().url()).pathname);
        current = stateBody({ case: null });
        return route.fulfill({ json: { ok: true, message: "Therese Lacson's demo data was reset." } });
      });
      await staff.page.goto("/workflow/readmission");
      const panel = await openGuide(staff.page);
      await expect(step(panel, "The Dean decides")).toBeVisible();
      staff.page.once("dialog", (dialog) => dialog.accept());
      await panel.getByRole("button", { name: "Reset this demo student" }).click();
      await expect.poll(() => resets).toEqual(["/api/auth/demo-students/readmission-therese/reset"]);
      await expect(step(panel, "Ask to come back")).toBeVisible(); // restarted
    } finally {
      await staff.context.close();
    }
    const dean = await openAs(browser, "dean@usls.edu.ph");
    try {
      await mockState(dean.page, stateBody({ role: "dean", case: caseOf("Dean Review", "With the Dean") }));
      const resets = [];
      await dean.page.route("**/api/auth/demo-students/*/reset", (route) => { resets.push(route.request().url()); return route.fulfill({ json: { ok: true } }); });
      await dean.page.goto("/dean/approvals/readmission");
      const panel = await openGuide(dean.page);
      await expect(panel).toContainText("Only Graduate School staff can reset a demo student.");
      await expect(panel.getByRole("button", { name: "Reset this demo student" })).toHaveCount(0);
      expect(resets).toEqual([]);
    } finally {
      await dean.context.close();
    }
  });

  test("date waits: the switch state shows on a step that can wait for a date", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      let skip = false;
      await mockState(page, () => stateBody({ process: "awol", skip_date_waits: skip, student: { id: 9003, name: "Maya Torres", student_number: "GS-2026-AWOL-01" }, case: { ...caseOf("Return Submitted", "Return filed"), kind: "AWOL" } }));
      await page.route("**/api/auth/demo-settings", (route) => { skip = Boolean(route.request().postDataJSON().skip_date_waits); return route.fulfill({ json: { skip_date_waits: skip } }); });
      await page.goto("/workflow/awol");
      const panel = await openGuide(page, "AWOL return");
      await expect(step(panel, "Staff forward the return")).toBeVisible();
      await expect(panel).toContainText("Skip date waits is off");
      await panel.getByRole("button", { name: "Turn on skip date waits" }).click();
      await expect(panel).toContainText("Skip date waits is on");
    } finally {
      await context.close();
    }
  });

  test("closing: Close and Esc remove the panel and the app works as before; demo mode off renders nothing", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ case: caseOf("Submitted") }));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await panel.getByRole("button", { name: "Close the demo guide" }).click();
      await expect(panelOf(page)).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Readmission board" })).toBeVisible();
      await launcher(page).click();
      await expect(panelOf(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(panelOf(page)).toHaveCount(0);
      await page.route("**/api/auth/config", (route) => route.fulfill({ json: { demo_mode: false, show_accounts: false, skip_date_waits: false } }));
      await page.reload();
      await expect(page.getByRole("region", { name: "Readmission board" })).toBeVisible();
      await expect(launcher(page)).toHaveCount(0);
      await expect(panelOf(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("offline or server error: the guide says so and keeps its place; Try again recovers", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await page.route("**/api/demo/guide-state**", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(panel).toContainText("Could not read the record");
      await expect(panel.getByRole("heading", { level: 3 })).toHaveCount(0); // no guessed step
      await page.unroute("**/api/demo/guide-state**");
      await mockState(page, stateBody({ case: caseOf("Submitted") }));
      await panel.getByRole("button", { name: "Try again" }).click();
      await expect(step(panel, "Start the staff review")).toBeVisible();
      await expect(panel).not.toContainText("Could not read the record");
    } finally {
      await context.close();
    }
  });

  test("a status the script does not know: named, with a way out", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ case: caseOf("Withdrawn", "Withdrawn by student"), candidates: [{ student_id: THERESE.id, name: THERESE.name, status_label: "Withdrawn by student" }] }));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(panel).toContainText("which this script does not cover");
      await expect(panel.getByLabel("Follow another student")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("if a panelist asks: the questions for the step open to an answer; the step names its line to say", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ case: caseOf("Submitted") }));
      await page.goto("/workflow/readmission");
      const panel = await openGuide(page);
      await expect(panel).toContainText("Say");
      await expect(panel).toContainText("Do");
      await panel.getByText("If a panelist asks").click();
      await panel.getByText("Does the policy check decide?").click();
      await expect(panel).toContainText("It is advice for staff with Pass or Needs review.");
      await expect(page.getByTestId("demo-guide-ring")).toBeVisible(); // the soft ring on the board
    } finally {
      await context.close();
    }
  });

  test("a step finished by a write: the Monitoring Sheet guide moves on when a student is added", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@usls.edu.ph");
    try {
      await mockState(page, stateBody({ process: "monitoring", student: null, case: { status: "record", subject_count: 18, last_change: null } }));
      await page.goto("/monitoring-sheet");
      const panel = await openGuide(page, "Monitoring Sheet");
      await expect(step(panel, "Add a student")).toBeVisible(); // opening the page finished step 1
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("demo-guide:api", { detail: { method: "POST", path: "/monitoring/students", status: 200, message: "" } })));
      await expect(step(panel, "Add a subject row")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

// ------------------------------------------------------------------------------------------------ phone, screenshots, sign-in page
test.describe("screens", () => {
  for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) {
    test(`the open panel at ${width} px`, async ({ browser }) => {
      const { context, page } = await openAs(browser, "staff@usls.edu.ph", { width, height });
      try {
        await mockState(page, stateBody({ case: caseOf("Submitted"), candidates: [{ student_id: THERESE.id, name: THERESE.name, status_label: "Submitted" }] }));
        await page.goto("/workflow/readmission");
        const panel = await openGuide(page);
        await expect(step(panel, "Start the staff review")).toBeVisible();
        const box = await panel.boundingBox();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll").toBe(true);
        if (width < 640) {
          // a bottom sheet: full width, on the bottom edge, never taller than 60% of the screen
          expect(Math.round(box.width)).toBe(width);
          expect(Math.round(box.y + box.height)).toBe(height);
          expect(box.height).toBeLessThanOrEqual(height * 0.6 + 1);
          await panel.getByRole("button", { name: "Collapse" }).click();
          expect((await panel.boundingBox()).height).toBeLessThan(90);
          await panel.getByRole("button", { name: "Expand" }).click();
        } else {
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(box.width).toBeLessThan(width / 2);
        }
        await page.screenshot({ path: join(SHOTS, `panel-${width}.png`) });
      } finally {
        await context.close();
      }
    });
  }

  test("the sign-in page names the account to use for each demo", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto("/login");
      await page.getByRole("button", { name: /^Demo guide/ }).click();
      const entry = page.locator("#demo-guide-panel");
      await entry.getByRole("button", { name: /^Readmission/ }).click();
      await expect(entry).toContainText("Therese Lacson");
      await expect(entry).toContainText(THERESE_EMAIL);
      await expect(entry).toContainText("staff@usls.edu.ph");
      await expect(entry).toContainText("dean@usls.edu.ph");
      await entry.getByRole("button", { name: "Fill form for the Dean" }).click();
      await expect(page.locator("#login-email")).toHaveValue("dean@usls.edu.ph");
      await page.screenshot({ path: join(SHOTS, "login-entry-1366.png") });
    } finally {
      await context.close();
    }
  });
});
