// Packet P7.9 (senior review F-20 = I-074, F-30 = I-084, and I-106 for the Dean): the Dean's pages tell one story.
// Written BEFORE the change; red on the old code. Through the real UI, as the Dean (read only; the API answers that
// need a fixed scenario are edited in the browser with page.route, so no other spec's data matters):
//   - I-074  the home and Reports & Analytics count the same decisions (both read the same list): the figure called
//            "Decided this week" is equal on both pages, and when decisions exist the table does not say 0 everywhere
//            and "Approval share" is not "-";
//   - I-084  Dean pages never tell the Dean to "Generate one to send to the Dean" (that is staff's job): an empty
//            coursework report list says "No coursework reports have been sent to you yet."; the Approvals Queue shows
//            only the processes that have something waiting, and ONE line "Nothing waiting in: ..." for the rest (or
//            one empty state when nothing waits), not a stack of "Nothing waiting" boxes;
//   - I-106  the Dean's graduation board is as wide as the Dean's Leave of Absence board (no extra padded card around the roster).
// Screenshots go to E2E_SHOTS_DIR (default e2e-artifacts/p79) at 1366, 1920 and 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p79");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

const VIEWS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
];
const PROCESS_LABELS = {
  "course-adjustments": "Course Adjustments",
  "leave-of-absence": "Leave of Absence",
  readmission: "Readmission",
  awol: "AWOL & Residency",
  withdrawal: "Subject Withdrawal", // one name per page (pkt/vocab, lib/labels.js)
  practicum: "Practicum Reports",
  graduation: "Graduation Endorsement",
};
const TYPE_TO_PROCESS = {
  "leave-of-absence": "leave-of-absence",
  readmission: "readmission",
  "awol-return": "awol",
  withdrawal: "withdrawal",
  practicum: "practicum",
  graduation: "graduation",
};
const GENERATE_COPY = "Generate one to send to the Dean";

const main = (page) => page.locator("main");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const statValue = (page, name) =>
  main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${name}$`, "i") }).locator("xpath=..").locator('[data-slot="value"]');

async function shotsAt(page, path, name, ready) {
  mkdirSync(SHOTS, { recursive: true });
  for (const view of VIEWS) {
    await page.setViewportSize(view);
    await page.goto(path);
    await ready();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(SHOTS, `${name}-${view.width}.png`), fullPage: true });
  }
  await page.setViewportSize(VIEWS[0]);
}

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}

/** Martin Gonzales (used only by p72 and this spec) files a Leave of Absence and staff forward it, so it waits on the Dean. */
async function leaveToDean(playwright) {
  const student = await apiAs(playwright, "enrollment.martin@usls.edu.ph");
  const filed = await student.post("/api/student-portal/requests/leave-of-absence", {
    data: { effective_start: "AY 2026-2027 2nd Semester", effective_end: "AY 2026-2027 2nd Semester", reason_category: "Medical / health", reason_remarks: "Surgery and recovery." },
  });
  if (filed.ok()) {
    const staff = await apiAs(playwright, "staff@usls.edu.ph");
    const caseId = (await filed.json()).case_id;
    const moved = await staff.post(`/api/leave-cases/${caseId}/transition`, { data: { action: "forward", eligibility_result: "Eligible" } });
    expect(moved.ok(), "staff forward the leave").toBeTruthy();
    await staff.dispose();
  } else {
    expect(filed.status(), `Martin files a leave: ${await filed.text()}`).toBe(409); // a re-run: already with the Dean
  }
  await student.dispose();
}

/** A decided case as /api/approvals lists it (only the fields the Dean pages read). */
const decided = (type, id, status, student) => ({
  type, id, title: `${type} #${id}`, subtitle: student, status, workflow_status: status,
  submitted_at: new Date(Date.now() - 86400000).toISOString(), last_activity_at: new Date().toISOString(),
  student: { id: 9000 + id, name: student, student_number: `99${id}`, program_code: "MAED" },
});

/** Open the Approvals Queue and hand back what the page itself loaded. */
async function openQueue(page) {
  const approvals = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/approvals");
  await page.goto("/dean/approvals");
  await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return (await approvals).json();
}

test.describe("P7.9 Dean pages", () => {
  test.use({ storageState: authFile("dean"), viewport: VIEWS[0] });

  test("I-074: the home and Reports & Analytics count the same decisions this week", async ({ page }) => {
    await page.goto("/dean");
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome, / })).toBeVisible();
    const homeValue = statValue(page, "Decided this week");
    await expect(homeValue).toBeVisible();
    const home = Number((await homeValue.innerText()).trim());
    expect(Number.isFinite(home), "the home shows a number").toBe(true);

    await page.goto("/dean/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
    const analyticsValue = statValue(page, "Decided this week");
    await expect(analyticsValue, "Reports & Analytics has the same figure").toBeVisible();
    const analytics = Number((await analyticsValue.innerText()).trim());
    expect(analytics, "the same decisions are counted on both pages").toBe(home);

    // The table and the share come from the same decisions: not 0 and "-" while decisions exist.
    const rows = main(page).getByRole("row").filter({ has: page.getByRole("link") });
    let outcomes = 0;
    for (let i = 0; i < (await rows.count()); i++) {
      const cells = rows.nth(i).getByRole("cell");
      for (const c of [2, 3, 4]) outcomes += Number(((await cells.nth(c).innerText()).match(/\d+/) || [0])[0]);
    }
    if (home > 0) {
      expect(outcomes, "decisions exist, so the table shows some outcome").toBeGreaterThanOrEqual(home);
      await expect(statValue(page, "Approval share"), "the share is a percentage").toHaveText(/^\d+%$/);
    }
  });

  test("I-074: with a scheduled leave and a denial this week both pages count two, and the table splits them", async ({ page }) => {
    await page.route(/\/api\/approvals$/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const recent = [decided("leave-of-absence", 9101, "Leave Scheduled", "Test Leave"), decided("withdrawal", 9102, "Denied", "Test Withdrawal")];
      await route.fulfill({ response, json: { ...json, recent: [], workflow_recent: recent, workflow_overview: recent } });
    });
    await page.goto("/dean");
    await expect(statValue(page, "Decided this week")).toHaveText("2");
    await page.goto("/dean/analytics");
    await expect(statValue(page, "Decided this week"), "Reports & Analytics counts the same two").toHaveText("2");
    const cellOf = (process, column) => main(page).getByRole("row").filter({ has: page.getByRole("link", { name: process, exact: true }) }).getByRole("cell").nth(column);
    await expect(cellOf("Leave of Absence", 2), "a scheduled leave is an approved decision").toHaveText("1");
    await expect(cellOf("Subject Withdrawal", 4), "a denial is a denial").toHaveText("1");
    await expect(statValue(page, "Approval share")).toHaveText("50%");
  });

  test("I-084: the Approvals Queue lists what waits and one line for what does not", async ({ page, playwright }) => {
    await leaveToDean(playwright);
    // Scenario: one leave request and nothing else waits (the other six processes are empty), whatever other specs did.
    await page.route(/\/api\/approvals$/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const leave = (json.workflow_pending || []).filter((item) => item.type === "leave-of-absence").slice(0, 1);
      await route.fulfill({ response, json: { ...json, pending: [], workflow_pending: leave } });
    });
    const approvals = await openQueue(page);
    const filled = new Set();
    if ((approvals.pending || []).length) filled.add("course-adjustments");
    for (const item of approvals.workflow_pending || []) {
      if (item.type === "graduation" && item.eligibility?.eligible !== true) continue;
      filled.add(TYPE_TO_PROCESS[item.type]);
    }
    const empty = Object.keys(PROCESS_LABELS).filter((key) => !filled.has(key));
    expect(filled.size, "a leave request waits for the Dean").toBe(1);
    expect(empty.length, "and six processes have nothing waiting").toBe(6);

    const sections = main(page).getByRole("heading", { level: 2, name: /\s\d+$/ });
    for (const key of filled) {
      await expect(main(page).getByRole("heading", { level: 2, name: new RegExp(`^${PROCESS_LABELS[key]}\\s*\\d+$`) }), `${PROCESS_LABELS[key]} has its section`).toBeVisible();
    }
    for (const key of empty) {
      await expect(main(page).getByRole("heading", { level: 2, name: new RegExp(`^${PROCESS_LABELS[key]}\\s*\\d+$`) }), `${PROCESS_LABELS[key]} has no section`).toHaveCount(0);
    }
    const line = main(page).getByText(/^Nothing waiting in:/);
    await expect(line, "one line for the processes with nothing waiting").toHaveCount(1);
    for (const key of empty) {
      await expect(line.getByRole("link", { name: PROCESS_LABELS[key], exact: true }), `${PROCESS_LABELS[key]} stays reachable`).toHaveAttribute("href", `/dean/approvals/${key}`);
    }
    await expect(main(page).getByText("No request of this kind needs a Dean decision right now."), "no stack of empty boxes").toHaveCount(0);
    expect(await sections.count(), "sections = processes with something waiting (+ Adviser Designation)").toBeGreaterThanOrEqual(filled.size);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height, "the queue is not a wall of empty boxes").toBeLessThan(2200);
  });

  test("I-084: with nothing waiting the queue says so once", async ({ page }) => {
    await page.route(/\/api\/approvals$/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({ response, json: { ...json, pending: [], workflow_pending: [] } });
    });
    await page.goto("/dean/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();
    await expect(main(page).getByText("Nothing waiting", { exact: true }), "one empty state").toHaveCount(1);
    await expect(main(page).getByText(/^Nothing waiting in:/)).toHaveCount(0);
    for (const label of Object.values(PROCESS_LABELS)) {
      await expect(main(page).getByRole("heading", { level: 2, name: new RegExp(`^${label}\\s*\\d+$`) }), `${label}: no empty section`).toHaveCount(0);
    }
  });

  test("I-084: the Dean is never told to generate a report for the Dean", async ({ page }) => {
    await page.route(/\/api\/coursework\/reports$/, (route) => route.fulfill({ json: { items: [] } }));
    await page.route(/\/api\/onboarding\/reviews$/, (route) => route.fulfill({ json: { items: [] } }));
    await page.goto("/dean/gate-reports");
    await expect(page.getByRole("heading", { level: 1, name: "Admission & Coursework Reports" })).toBeVisible();
    await expect(main(page).getByText("No coursework reports have been sent to you yet.")).toBeVisible();
    await expect(main(page).getByText("Import a monitoring sheet", { exact: false }), "staff's instruction is not shown to the Dean").toHaveCount(0);
    for (const path of ["/dean", "/dean/approvals", "/dean/analytics", "/dean/activity", "/dean/gate-reports"]) {
      await page.goto(path);
      await expect(main(page).locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await main(page).innerText(), `${path} does not tell the Dean to generate a report`).not.toContain(GENERATE_COPY);
    }
    await page.unroute(/\/api\/coursework\/reports$/);
    await page.unroute(/\/api\/onboarding\/reviews$/);
  });

  test("I-106: the Dean's graduation board is as wide as the Dean's Leave of Absence board", async ({ page }) => {
    // Same kind of page, same board: the Leave of Absence board sits straight on the page; the graduation roster was
    // wrapped in one more padded card, so its columns were ~50 px narrower.
    await page.goto("/dean/approvals/leave-of-absence");
    const leave = page.getByRole("region", { name: "Leave of absence board" });
    await expect(leave).toBeVisible();
    const leaveBox = await leave.boundingBox();

    await page.goto("/dean/approvals/graduation");
    const graduation = page.getByRole("region", { name: "Graduation workflow Kanban board" });
    await expect(graduation).toBeVisible();
    const graduationBox = await graduation.boundingBox();

    expect(Math.abs(graduationBox.width - leaveBox.width), `graduation board ${Math.round(graduationBox.width)} px vs Leave of Absence board ${Math.round(leaveBox.width)} px`).toBeLessThanOrEqual(24);
    expect(Math.abs(graduationBox.x - leaveBox.x), "and it starts at the same left edge").toBeLessThanOrEqual(24);
    expect(await noOverflow(page), "no sideways scroll").toBe(true);
  });

  test("pictures: the five Dean pages at 1366, 1920 and 390 px", async ({ page }) => {
    const h1 = () => expect(main(page).locator("h1")).toBeVisible();
    await shotsAt(page, "/dean", "dean-home", h1);
    await shotsAt(page, "/dean/approvals", "dean-approvals", h1);
    await shotsAt(page, "/dean/analytics", "dean-analytics", h1);
    await shotsAt(page, "/dean/gate-reports", "dean-gate-reports", h1);
    await shotsAt(page, "/dean/approvals/graduation", "dean-graduation", h1);
  });
});
