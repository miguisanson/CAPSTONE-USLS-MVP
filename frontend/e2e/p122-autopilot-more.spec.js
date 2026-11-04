// e2e-writes: more-course-adjustments, more-enrollment, more-dropping, more-policy-assistant, more-handoff, more-business-rules, more-policy-documents, more-residency, more-calendars, more-portals, more-best-features
// The Demo Guide autopilot for the other processes (owner request 2026-11-04: "make sure all processes have a guide"): each guide
// is started from the sign-in page ("Start a guided demo") and played with Next to the last step, as p115 does for the case
// processes. These guides keep no case row, so the end state is the writes the steps did: each one must have answered 2xx
// (a screen tour has none and only has to reach its last step). [pattern, n] means at least n of them.
//
// Data: runs in the same project as p115 (after every other writer). Each guide resets its own demo student before and after.
//   course-adjustments  the MAED plan of AY 2026-2027 2nd Semester (draft, submit, Dean approves, publish); MAED-MAJ1's schedule
//   enrollment          the class list of AY 2026-2027 1st Semester (enrollment-clarissa and -martin tagged on MAED-MAJ2)
//   dropping            withdrawal-joshua: MAED-MAJ2 dropped (reset before and after)
//   handoff             two students added to the MSN program from the sample workbook (a second run adds none)
//   policy-documents    one memo uploaded, tested and removed again
//   residency           residency-nicolas: one residency recorded (reset before and after)
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { GUIDES } from "../src/lib/demoGuide/guides/index.js";

const SHOTS = join(ARTIFACTS_DIR, "screens", "p122");
mkdirSync(SHOTS, { recursive: true });

// Per guide: the demo students to reset around the run, and the writes (METHOD path, without /api) that must have answered 2xx.
const PLAN = {
  calendars: { reset: [], writes: [] },
  portals: { reset: [], writes: [] },
  "best-features": { reset: [], writes: [["POST /assistant", 1]] },
  residency: { reset: ["residency-nicolas"], writes: ["POST /transactions/awol"] },
  enrollment: { reset: ["enrollment-clarissa", "enrollment-martin"], writes: ["POST /enrollment/class-list-import", "POST /enrollment"] },
  dropping: { reset: ["withdrawal-joshua"], writes: ["PATCH /enrollment/subject-status"] },
  "policy-documents": { reset: [], writes: ["POST /policy-documents", "DELETE /policy-documents/*"] },
  "student-handoff": { reset: [], writes: [["POST /transactions/student-handoff/import", 2]] },
  "business-rules": { reset: [], writes: [] },
  "policy-assistant": { reset: [], writes: [["POST /assistant", 4], ["POST /student-portal/assistant", 1]] },
  "course-adjustments": { reset: ["course-adjustments-lianne"], writes: [["POST /course-adjustments/plan", 3], "POST /approvals/*/decide", "PATCH /course-offerings/bulk"] }, // draft, submit and publish all post the plan
};

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  expect((await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}
async function resetStudents(playwright, ...keys) {
  if (!keys.length) return;
  const staff = await apiAs(playwright, "staff@usls.edu.ph"); // the reset needs a signed-in session (I-055)
  for (const key of keys) {
    const res = await staff.post(`/api/auth/demo-students/${key}/reset`, { data: {} });
    expect(res.ok(), `reset ${key}: ${res.status()}`).toBeTruthy();
  }
  await staff.dispose();
}
const bar = (page) => page.getByTestId("autopilot-bar");
const startBox = (page) => page.getByRole("region", { name: "Start a guided demo" });
async function startDemo(browser, guide) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await page.goto("/login");
  await startBox(page).getByRole("button", { name: new RegExp(`^${guide.title}`) }).click();
  await expect(bar(page)).toBeVisible({ timeout: 60_000 });
  return { context, page };
}

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

const matches = (pattern, line) => {
  const [method, path] = pattern.split(" ");
  const [m, p, status] = line.split(" ");
  return m === method && Number(status) < 300 && new RegExp(`^${path.replace(/\*/g, "[^/]+")}$`).test(p);
};

function guideTest(guide) {
  const plan = PLAN[guide.id];
  test(`${guide.title}: Next plays every step to the end`, async ({ browser, playwright }) => {
    test.setTimeout(10 * 60_000);
    await resetStudents(playwright, ...plan.reset);
    const { context, page } = await startDemo(browser, guide);
    try {
      const writes = [];
      page.on("response", (res) => {
        const url = new URL(res.url());
        if (res.request().method() !== "GET" && url.pathname.startsWith("/api/")) writes.push(`${res.request().method()} ${url.pathname.slice(4).replace(/\/\d+(?=\/|$)/g, "/*")} ${res.status()}`);
      });
      const count = guide.steps.filter((step) => !step.side).length;
      // Starting on the first step's page already finishes a step that only asks for that page, so count by the bar.
      for (let n = 0; n < count && !(await bar(page).getByText("That is the whole demo").count()); n += 1) await pressNext(page);
      await expect(bar(page).getByText("That is the whole demo")).toBeVisible();
      await page.screenshot({ path: join(SHOTS, `${guide.id}-done-1366.png`) });
      console.log(`[p122] ${guide.id} writes:\n  ${writes.filter((w) => !/notifications|auth\//.test(w)).join("\n  ")}`);
      for (const entry of plan.writes) {
        const [pattern, min] = Array.isArray(entry) ? entry : [entry, 1];
        expect(writes.filter((line) => matches(pattern, line)).length, `${guide.title}: ${pattern} answered 2xx`).toBeGreaterThanOrEqual(min);
      }
    } finally {
      await context.close();
      if (!process.env.P122_KEEP) await resetStudents(playwright, ...plan.reset);
    }
  });
}

for (const guide of GUIDES) if (PLAN[guide.id]) guideTest(guide);
