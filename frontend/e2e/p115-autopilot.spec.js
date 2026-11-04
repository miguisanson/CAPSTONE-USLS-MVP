// e2e-writes: autopilot-loa, autopilot-readmission, autopilot-awol, autopilot-monitoring, autopilot-withdrawal, autopilot-practicum, autopilot-graduation
// The Demo Guide autopilot (owner request 2026-11-04, .planning/demo-guide/DESIGN.md "Autopilot"): a started demo locks into a
// slideshow whose Next performs each step on the real page (cursor, typing, clicks) and only moves on when the record says the
// step is done.
//
//   action player   a controlled input, select and checkbox are set the way a person would, so React state follows (the form
//                   submits the typed values; the tick changes the count under Save)
//   Take over       cancels a run in the middle of a step and removes the click-shield and the cursor
//   reduced motion  the same run is instant (no glide, no pulse, no typing delay)
//   every guide     from the sign-in page: Start a guided demo, press Next until the end on the seeded database, and read the
//                   final record from GET /api/demo/guide-state (the end-to-end check of the process)
//   screenshots     mid-glide and the slideshow bar at 1366 and 390 px, to e2e-artifacts/screens/p115/
//
// Data: this spec runs AFTER every other writer (playwright.config.js, project "autopilot": it needs the demo students that
// p32 (Daniel), p114 (Therese) and section-j (Paolo) also use). It resets each student before and after its own run.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { GUIDES } from "../src/lib/demoGuide/guides/index.js";

const SHOTS = join(ARTIFACTS_DIR, "screens", "p115");
mkdirSync(SHOTS, { recursive: true });

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  expect((await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}
async function resetStudents(playwright, ...keys) {
  const staff = await apiAs(playwright, "staff@usls.edu.ph"); // the reset needs a signed-in session (I-055)
  for (const key of keys) {
    const res = await staff.post(`/api/auth/demo-students/${key}/reset`, { data: {} });
    expect(res.ok(), `reset ${key}: ${res.status()}`).toBeTruthy();
  }
  await staff.dispose();
}
async function signedIn(browser, email, { width = 1366, height = 768, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width, height }, reducedMotion });
  expect((await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `sign in as ${email}`).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe(email);
  await context.addInitScript(() => { try { window.localStorage.setItem("usls-demo-guide-on", "1"); } catch { /* none */ } });
  return { context, page: await context.newPage() };
}
const bar = (page) => page.getByTestId("autopilot-bar");
const player = (page, actions) =>
  page.evaluate(
    async (list) => {
      await window.__uslsDemoPlayer.runActions(list, { signal: new AbortController().signal, go() {}, signInAs() {}, onCaption() {} });
      window.__uslsDemoPlayer.clearStage();
    },
    actions,
  );

const LOA = GUIDES.find((guide) => guide.id === "leave-of-absence");

// ------------------------------------------------------------------------------------------------ the action player
test.describe("the action player", () => {
  test("select, type and click set React state: the form sends exactly what was typed", async ({ browser }) => {
    const { context, page } = await signedIn(browser, "student@usls.edu.ph");
    try {
      const writes = [];
      await context.route("**/api/student-portal/requests/*", (route) => {
        writes.push(JSON.parse(route.request().postData() || "{}"));
        return route.fulfill({ json: { message: "Spec: saved." } });
      });
      await page.goto("/student/requests/leave-of-absence");
      await page.waitForFunction(() => Boolean(window.__uslsDemoPlayer && document.querySelector('#loa-remarks')));
      await player(page, [
        { select: "#loa-start", index: 1 },
        { select: "#loa-end", index: 1 },
        { select: "#loa-reason", index: 1 },
        { type: "#loa-remarks", text: "Typed by the action player." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ]);
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0].reason_remarks).toBe("Typed by the action player.");
      expect(writes[0].effective_start).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test("a checkbox is ticked through a real click: the page counts it", async ({ browser }) => {
    const { context, page } = await signedIn(browser, "student@usls.edu.ph");
    try {
      // The real record has every subject locked; one subject is opened up for this page (nothing is saved).
      await context.route("**/api/student-portal/context", async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        Object.assign(data.student, { standing: "Active", enrollment_tag: "" });
        data.leave_overview = null;
        data.curriculum_subjects[0] = { ...data.curriculum_subjects[0], status: "Missing", is_enrolled: false, is_offered: true };
        await route.fulfill({ response, json: data });
      });
      await page.goto("/student/enrollment");
      await page.waitForFunction(() => Boolean(window.__uslsDemoPlayer));
      const free = page.locator('main input[type="checkbox"]:not(:disabled)');
      await expect(free).toHaveCount(1);
      const name = await free.getAttribute("aria-label");
      const count = page.getByRole("main").getByText(/subjects? checked for this semester/);
      const before = await count.innerText();
      await player(page, [{ check: { role: "checkbox", name } }]);
      await expect(page.getByRole("checkbox", { name })).toBeChecked();
      await expect(count, "the page counted the tick (React state followed)").not.toHaveText(before);
    } finally {
      await context.close();
    }
  });

  test("reduced motion: the same run is instant (no glide, no typing delay)", async ({ browser }) => {
    const text = "x".repeat(120);
    const timed = async (reducedMotion) => {
      const { context, page } = await signedIn(browser, "student@usls.edu.ph", { reducedMotion });
      try {
        await page.goto("/student/requests/leave-of-absence");
        await page.waitForFunction(() => Boolean(window.__uslsDemoPlayer && document.querySelector('#loa-remarks')));
        const started = Date.now();
        await player(page, [{ type: "#loa-remarks", text }]);
        return { ms: Date.now() - started, value: await page.locator('#loa-remarks').inputValue() };
      } finally {
        await context.close();
      }
    };
    const calm = await timed("reduce");
    const normal = await timed("no-preference");
    expect(calm.value).toBe(text);
    expect(normal.value).toBe(text);
    expect(calm.ms, "reduced motion: no glide, no typing").toBeLessThan(500);
    expect(normal.ms, "normal motion types ~35 ms a character, capped near 1.5 s").toBeGreaterThan(1200);
  });
});

// ------------------------------------------------------------------------------------------------ every guide, end to end
// Final record per guide: the status GET /api/demo/guide-state reports once Next has played the last step.
const PLAN = {
  "leave-of-absence": { key: "autopilot-loa", reset: ["leave-of-absence-daniel"], number: "2690802", final: "On Leave" },
  readmission: { key: "autopilot-readmission", reset: ["readmission-therese"], number: "2690901", final: "Approved" },
  awol: { key: "autopilot-awol", reset: ["awol-maya"], number: "2691001", final: "Return Approved" },
  monitoring: { key: "autopilot-monitoring", reset: [], number: null, final: null },
  reports: { key: "reports", reset: [], number: null, final: null },
  withdrawal: { key: "autopilot-withdrawal", reset: ["withdrawal-elena"], number: "2690401", final: "Exported - Ready to Send" },
  practicum: { key: "autopilot-practicum", reset: ["practicum-paolo"], number: "2690202", final: "Dean Reviewed" },
  graduation: { key: "autopilot-graduation", reset: ["graduation-carlo"], number: "2690302", final: "Dean Approved" },
};

/** Press Next and wait until the step is done: the label moves on, or the bar says the demo is finished, or it stopped with a reason. */
async function pressNext(page) {
  const before = await bar(page).getByTestId("autopilot-step").innerText();
  await bar(page).getByTestId("autopilot-next").click();
  await expect
    .poll(
      async () => {
        try {
          const now = bar(page);
          if (!(await now.count())) return "loading"; // a sign-in as the next person reloads the page
          const status = await now.getAttribute("data-status");
          if (status === "error") await page.screenshot({ path: join(SHOTS, "stopped.png") });
          if (status === "error") throw new Error(`The autopilot stopped on "${before}": ${(await now.innerText()).replace(/\s+/g, " ")}`);
          if (status !== "idle") return "running";
          const label = await now.getByTestId("autopilot-step").innerText();
          const finished = (await now.getByText("That is the whole demo").count()) > 0;
          return label !== before || finished ? "moved" : "same";
        } catch (error) {
          if (/The autopilot stopped/.test(String(error.message))) throw error;
          return "loading";
        }
      },
      { timeout: 240_000, intervals: [400], message: `Next on "${before}"` },
    )
    .toBe("moved");
}

function guideTest(guide) {
  const plan = PLAN[guide.id];
  test(`${guide.title}: Next plays every step to the end${plan.final ? ` (record: ${plan.final})` : ""}`, async ({ browser, playwright }) => {
    test.setTimeout(10 * 60_000);
    await resetStudents(playwright, ...plan.reset);
    const { context, page } = await startDemo(browser, guide);
    try {
      const count = guide.steps.filter((step) => !step.side).length;
      const writes = [];
      page.on("response", (res) => {
        if (res.request().method() === "POST" && /\/api\/monitoring\/students/.test(res.url())) writes.push(`${new URL(res.url()).pathname.replace(/\d+/g, "*")} ${res.status()}`);
      });
      // Starting on the first step's page already finishes a step that only asks for that page (Monitoring Sheet, Reports), so count by the bar.
      for (let n = 0; n < count && !(await bar(page).getByText("That is the whole demo").count()); n += 1) await pressNext(page);
      await expect(bar(page).getByText("That is the whole demo")).toBeVisible();
      await page.screenshot({ path: join(SHOTS, `${guide.id}-done-1366.png`) });
      if (plan.final) {
        const after = await (await page.request.get(`/api/demo/guide-state?process=${guide.process}&student_number=${plan.number}`)).json();
        expect(after.case && after.case.status, `${guide.title}: the final record`).toBe(plan.final);
      }
      // The Monitoring Sheet has no case: the record is the student it added and the subject row it gave that student.
      if (guide.process === "monitoring") expect(writes).toEqual(["/api/monitoring/students 201", "/api/monitoring/students/*/subjects 201"]);
    } finally {
      await context.close();
      if (!process.env.P115_KEEP) await resetStudents(playwright, ...plan.reset); // P115_KEEP=1 leaves the record where it stopped, to look at it
    }
  });
}

// ------------------------------------------------------------------------------------------------ the slideshow
const startBox = (page) => page.getByRole("region", { name: "Start a guided demo" });
async function startDemo(browser, guide, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const page = await context.newPage();
  await page.goto("/login");
  await startBox(page).getByRole("button", { name: new RegExp(`^${guide.title}`) }).click();
  await expect(bar(page)).toBeVisible({ timeout: 60_000 });
  return { context, page };
}

test.describe("the slideshow bar", () => {
  test.describe.configure({ mode: "serial" }); // the last test files Daniel's request; the others expect none
  test.beforeAll(async ({ playwright }) => resetStudents(playwright, "leave-of-absence-daniel"));
  test.afterAll(async ({ playwright }) => resetStudents(playwright, "leave-of-absence-daniel"));

  test("Take over stops a run in the middle of the step and removes the shield and the cursor; Stop closes the bar", async ({ browser }) => {
    const { context, page } = await startDemo(browser, LOA);
    try {
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(`Step 1 of ${LOA.steps.filter((s) => !s.side).length}`);
      await bar(page).getByTestId("autopilot-next").click();
      await expect(bar(page)).toHaveAttribute("data-status", "running");
      await expect(page.getByTestId("demo-shield")).toHaveCount(1);
      await expect(page.getByTestId("demo-cursor")).toHaveCount(1);
      await expect(bar(page).getByTestId("autopilot-caption")).toContainText(/Choosing|Clicking|Typing/);
      await page.screenshot({ path: join(SHOTS, "mid-glide-1366.png") });
      await bar(page).getByRole("button", { name: "Take over" }).click();
      await expect(bar(page)).toHaveAttribute("data-status", "paused");
      await expect(page.getByTestId("demo-shield")).toHaveCount(0);
      await expect(page.getByTestId("demo-cursor")).toHaveCount(0);
      await expect(bar(page)).toContainText("You have the controls");
      // the presenter works freely: the page answers a click that the shield would have eaten
      await page.locator('#loa-remarks').fill("Typed by hand after taking over.");
      await expect(page.locator('#loa-remarks')).toHaveValue("Typed by hand after taking over.");
      // nothing was filed: the record is still where it was
      const state = await (await page.request.get("/api/demo/guide-state?process=leave-of-absence&student_number=2690802")).json();
      expect(state.case).toBeNull();
      await bar(page).getByRole("button", { name: "Stop" }).click();
      await expect(bar(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("owner 2026-11-04: the guide panel starts collapsed and both the panel's > and the Right arrow key make the app do the step", async ({ browser }) => {
    const { context, page } = await startDemo(browser, LOA);
    try {
      await page.keyboard.press("ArrowRight");
      // the side panel steps aside while the app fills the form
      await expect(page.getByRole("button", { name: "Expand" })).toBeVisible();
      await expect(bar(page)).toHaveAttribute("data-status", "running");
      await expect(page.getByTestId("demo-cursor")).toHaveCount(1);
      await bar(page).getByRole("button", { name: "Take over" }).click();
      await expect(bar(page)).toHaveAttribute("data-status", "paused");
      await page.getByRole("button", { name: "Expand" }).click();
      await page.getByRole("button", { name: "Next step: the app does it" }).click();
      await expect(bar(page)).toHaveAttribute("data-status", "running");
      await expect(page.getByRole("button", { name: "Play as a slideshow" })).toHaveCount(0);
      await bar(page).getByRole("button", { name: "Take over" }).click();
      await bar(page).getByRole("button", { name: "Stop" }).click();
      await expect(bar(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("Esc pauses a run like Take over", async ({ browser }) => {
    const { context, page } = await startDemo(browser, LOA);
    try {
      await bar(page).getByTestId("autopilot-next").click();
      await expect(bar(page)).toHaveAttribute("data-status", "running");
      await page.keyboard.press("Escape");
      await expect(bar(page)).toHaveAttribute("data-status", "paused");
      await expect(page.getByTestId("demo-shield")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("mid-glide on a phone: the cursor, the caption and the bar share 390 px", async ({ browser }) => {
    const { context, page } = await startDemo(browser, LOA, { width: 390, height: 844 });
    try {
      await bar(page).getByTestId("autopilot-next").click();
      await expect(page.getByTestId("demo-shield")).toHaveCount(1);
      await expect(bar(page).getByTestId("autopilot-caption")).toContainText(/Choosing|Clicking|Typing/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll").toBe(true);
      await page.screenshot({ path: join(SHOTS, "mid-glide-390.png") });
      await bar(page).getByRole("button", { name: "Take over" }).click();
      await expect(page.getByTestId("demo-shield")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("Take over, then a different value by hand: Next carries on from the record", async ({ browser }) => {
    test.setTimeout(4 * 60_000);
    const { context, page } = await startDemo(browser, LOA);
    try {
      await bar(page).getByTestId("autopilot-next").click();
      await expect(bar(page)).toHaveAttribute("data-status", "running");
      await bar(page).getByRole("button", { name: "Take over" }).click();
      await expect(bar(page)).toHaveAttribute("data-status", "paused");
      // a panelist asks for something else: one semester, another reason, other words (the script says two semesters)
      await page.locator("#loa-start").selectOption({ index: 3 });
      await page.locator("#loa-end").selectOption({ index: 1 });
      await page.locator("#loa-reason").selectOption({ label: "Family emergency" });
      await page.locator("#loa-remarks").fill("A different value typed by hand during the demo.");
      await page.getByRole("button", { name: "Submit leave request" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Send request" }).click();
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(/^Step 2 of /, { timeout: 30_000 }); // the guide followed the record
      await pressNext(page); // the autopilot plays the staff step on the request the presenter filed
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(/^Step 3 of /);
      const state = await (await page.request.get("/api/demo/guide-state?process=leave-of-absence&student_number=2690802")).json();
      expect(state.case.status).toBe("Staff Review");
    } finally {
      await context.close();
    }
  });

  for (const [name, viewport] of [["1366", { width: 1366, height: 768 }], ["390", { width: 390, height: 844 }]]) {
    test(`the bar at ${name} px, with no sideways scroll`, async ({ browser }) => {
      const { context, page } = await startDemo(browser, LOA, viewport);
      try {
        await expect(bar(page).getByTestId("autopilot-next")).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll").toBe(true);
        const box = await bar(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        await page.screenshot({ path: join(SHOTS, `bar-${name}.png`) });
      } finally {
        await context.close();
      }
    });
  }

  guideTest(LOA);
});

// Leave of Absence plays inside the slideshow group above (same demo student, so never at the same time); every other guide has its own student.
for (const guide of GUIDES) if (guide.id !== LOA.id) guideTest(guide);
