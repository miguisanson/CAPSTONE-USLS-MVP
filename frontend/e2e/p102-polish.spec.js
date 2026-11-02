// e2e-writes: none
// Polish packet (I-180, I-182, I-184, I-185, I-186): small things the walkthrough captures and the integrator review showed.
// Written BEFORE the fixes. Every write is answered by page.route or never sent; shared state is mocked or read from the API.
//   - I-180 Dean Graduation "Endorsement batches" tab: the filter line counts batches, not candidates;
//   - I-182 Reports: "What is holding students back?" labels stay on one line at 1366; at 390 the six numbers are two
//     compact columns, so the tabs are not pushed down the page;
//   - I-184 student Enrollment: a Withdrawn subject cannot be ticked and shows its status;
//   - I-185 Panel Matching: after finalizing, each seat shows the member who holds that role;
//   - I-186 Dean pages: the Dean's list of decisions is called Activity Log everywhere (never "Decision History").
// I-183 (Monitoring Sheet banner on for seeded students) is a server-side cause, reported in .planning/ISSUES.md; nothing to pin here.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", "p102");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

test.describe("I-180 Dean Graduation batches tab", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("the filter line counts batches", async ({ page }) => {
    // Isabel and Hector sit in two batches; nobody else is batched.
    await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.roster.forEach((row) => { row.endorsement = { ...(row.endorsement || {}), batch_name: null }; });
      for (const [name, batch] of [["Isabel Flores", "Batch 1 October 2026"], ["Hector Ong", "Batch 2 October 2026"]]) {
        const row = body.roster.find((item) => item.student.name === name);
        row.endorsement = { ...(row.endorsement || {}), batch_name: batch, endorsement_status: "Ready for Dean Review", display_status: "Ready for Dean Review" };
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto("/dean/approvals/graduation?tab=batches");
    await expect(page.getByTestId("stage-board")).toBeVisible();
    await expect(main(page).getByText("Showing 2 of 2 batches")).toBeVisible();
    await main(page).getByRole("searchbox", { name: "Search list" }).fill("Isabel");
    await expect(main(page).getByText("Showing 1 of 2 batches")).toBeVisible();
  });
});

test.describe("I-182 Reports layout", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("1366: the cause labels sit on one line each", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 2, name: "What is holding students back?" })).toBeVisible();
    const ticks = page.locator(".recharts-yAxis .recharts-cartesian-axis-tick-value");
    await expect(ticks.first()).toBeVisible();
    const lines = await ticks.evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, lines: node.querySelectorAll("tspan").length })));
    expect(lines.length).toBeGreaterThan(0);
    for (const tick of lines) expect(tick.lines, `"${tick.text}" is drawn on ${tick.lines} lines`).toBe(1);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(SHOTS, "reports-1366.png"), fullPage: true });
  });

  test("390: the six numbers are two compact columns and the tabs stay near the top", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/reports");
    const strip = page.getByRole("group", { name: "Summary numbers" });
    await expect(strip.getByRole("button")).toHaveCount(6);
    const boxes = await strip.getByRole("button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map((box) => Math.round(box.left))).size, "two columns").toBe(2);
    const tabs = await page.getByRole("tablist").first().boundingBox();
    expect(tabs.y, "the tabs start within the first screen and a half").toBeLessThan(1100);
    const stripBox = await strip.boundingBox();
    expect(stripBox.height, "the six numbers take no more than 600 px").toBeLessThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll").toBe(true);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SHOTS, "reports-390.png"), fullPage: true });
  });
});

test.describe("I-184 student Enrollment", () => {
  test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 800 } });

  test("a withdrawn subject is locked and shows its status", async ({ page }) => {
    await page.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.student = { ...data.student, standing: "Active", enrollment_tag: "Enrolled" };
      const base = { category: "Major", units: 3, recommended_term: "1st Year 1st Semester", is_enrolled: false, is_offered: true };
      data.curriculum_subjects = [
        { ...base, id: 990001, code: "ZZ-WDR1", title: "Withdrawn Test Subject", status: "Withdrawn" },
        { ...base, id: 990002, code: "ZZ-OPEN1", title: "Open Test Subject", status: "Missing" },
      ];
      await route.fulfill({ response, json: data });
    });
    await page.goto("/student/enrollment");
    const withdrawn = main(page).locator("label", { hasText: "ZZ-WDR1" });
    await expect(withdrawn).toBeVisible();
    await expect(withdrawn.getByRole("checkbox")).toBeDisabled();
    await expect(withdrawn).toContainText("Withdrawn");
    await expect(main(page).locator("label", { hasText: "ZZ-OPEN1" }).getByRole("checkbox")).toBeEnabled();
  });
});

test.describe("I-185 Panel Matching seats", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 900 } });

  test("after finalizing, each role shows the member who holds it", async ({ page }) => {
    let panel = [];
    let roles = [];
    await page.route(/\/api\/transactions\/panel-matching\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      // The server lists the panel in any order; the seat is told by panel_role, not by position.
      body.assigned_panel = [...body.assigned_panel].reverse();
      panel = body.assigned_panel;
      roles = body.panel_roles;
      await route.fulfill({ response, json: body });
    });
    await page.goto("/workflow/panel-matching?student_id=146");
    await expect(main(page).getByText("Final panel selected")).toBeVisible();
    expect(roles.length).toBeGreaterThan(1);
    expect(panel.map((member) => member.panel_role), "the mock puts the panel out of seat order").not.toEqual(roles);
    for (const member of panel) {
      const select = main(page).locator("label", { hasText: member.panel_role }).locator("select");
      await expect(select, `${member.panel_role} shows ${member.faculty_name}`).toHaveValue(String(member.faculty_id));
    }
  });
});

test.describe("I-186 Dean pages use one name", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  for (const path of ["/dean", "/dean/analytics", "/dean/activity"]) {
    test(`${path}: no "Decision History"`, async ({ page }) => {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(/decision history/i);
    });
  }

  test("the activity page and the Dean home say Activity Log", async ({ page }) => {
    await page.goto("/dean");
    await expect(main(page).getByText("See Activity Log")).toBeVisible();
    await page.goto("/dean/activity");
    await expect(main(page).getByRole("heading", { level: 1, name: "Activity Log" })).toBeVisible();
  });
});
