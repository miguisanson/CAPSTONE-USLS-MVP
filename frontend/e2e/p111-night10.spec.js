// e2e-writes: none
// pkt/night10 (stakeholder demo findings), through the real UI, read-only:
//   - I-238: a student record's "Outstanding subjects" lists every subject its "Missing" and "Incomplete" cards count
//     (it used to stop at eight);
//   - I-239: the "Your open tasks" tile says what its second number counts.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

let tracker;
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "night10", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");

test.describe("night10", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 900 } });

  test("I-238: Outstanding subjects lists as many subjects as the Missing and Incomplete cards count", async ({ page, context }) => {
    const found = await (await context.request.get("/api/students?q=Dela%20Cruz&page_size=50")).json();
    const maed = (found.items || found.students || []).filter((s) => (s.program_code || s.program?.code) === "MAED");
    expect(maed.length, "the seed has MAED students named Dela Cruz").toBeGreaterThan(0);
    let longest = 0;
    for (const student of maed) {
      const audit = (await (await context.request.get(`/api/students/${student.id}`)).json()).course_audit;
      const outstanding = audit.missing.length + audit.incomplete.length;
      longest = Math.max(longest, outstanding);
      await page.goto(`/students/${student.id}`);
      const box = main(page).locator("div", { has: page.getByText("Outstanding subjects", { exact: true }) }).last();
      if (!outstanding) continue;
      await expect(box.locator("li"), `${student.name}: every outstanding subject is listed`).toHaveCount(outstanding);
    }
    expect(longest, "one of them has more than eight outstanding subjects").toBeGreaterThan(8);
  });

  test("I-239: the Your open tasks tile says what its second number counts", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const tile = main(page).locator('[data-slot="label"]', { hasText: /^Your open tasks$/i }).locator("xpath=..");
    await expect(tile.locator('[data-slot="sub"]')).toHaveText(/\d+ past their due date/);
    const risk = main(page).locator('[data-slot="label"]', { hasText: /^At risk or delayed$/i }).locator("xpath=..");
    await expect(risk.locator('[data-slot="sub"]')).toHaveText(/delayed, all students$/);
  });
});
