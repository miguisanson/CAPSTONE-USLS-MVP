// e2e-writes: none
// Night 5, item 3: the Academic Coordinator reads Academic Semesters (sidebar link, the table with the dates) and sees no
// control that changes them. Staff keep their buttons (pinned by p84).
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json") });

let tracker;
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "academic-coordinator", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, "opening the page writes nothing").toEqual([]);
});

test("Academic Coordinator: Academic Semesters is in the sidebar, lists the dates and has no edit controls", async ({ page }) => {
  await page.goto("/");
  await page.locator("aside nav").getByRole("link", { name: "Academic Semesters" }).click();
  await expect(page).toHaveURL(/\/term-settings$/);
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: "Academic Semesters" })).toBeVisible();
  await expect(main.getByText("You can read the semesters and their dates here. Graduate School staff change them.")).toBeVisible();
  const table = main.locator("table").first();
  expect(await table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()))).toEqual(["Semester", "Semester dates"]);
  expect(await table.locator("tbody tr").count(), "at least one semester is listed").toBeGreaterThan(0);
  for (const name of ["Add semester", "Add next semester", /Edit dates/, /Set as current/, /Remove/]) {
    await expect(main.getByRole("button", { name }), `no "${name}" button for the coordinator`).toHaveCount(0);
  }
});
