// e2e-writes: none
// Owner feedback 2026-11-23 stage 3 (IM58), through the real UI, read-only: the student record's Course audit has a
// Curriculum section with two tabs. Completed lists each subject with the semester it was taken and its grade;
// Outstanding lists the current, incomplete and missing subjects. Each count with subjects behind it opens its tab.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

let tracker;
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "curriculum-tabs", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");

async function studentWith(context, test) {
  const list = await (await context.request.get("/api/students?q=&page_size=100")).json();
  for (const item of list.items || list.students || []) {
    const audit = (await (await context.request.get(`/api/students/${item.id}`)).json()).course_audit;
    if (test(audit)) return { id: item.id, audit };
  }
  return null;
}

test.describe("Curriculum tabs on the student record", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 900 } });

  test("Completed shows the semester taken; the Missing count opens Outstanding", async ({ page, context }) => {
    const found = await studentWith(context, (a) => a.completed.length > 0 && a.missing.length > 0);
    expect(found, "the seed has a student with completed and missing subjects").not.toBeNull();
    const { id, audit } = found;
    await page.goto(`/students/${id}`);
    await expect(main(page).getByText("Outstanding subjects", { exact: true })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: /Show subjects|Hide subjects/ })).toHaveCount(0);

    const outstanding = audit.current.length + audit.incomplete.length + audit.missing.length;
    // opens on Outstanding when something is left
    const outTab = main(page).getByRole("tab", { name: /^Outstanding/ });
    await expect(outTab).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByRole("tabpanel", { name: `Outstanding subjects (${outstanding})` }).getByRole("listitem")).toHaveCount(outstanding);

    await main(page).getByRole("button", { name: `Completed ${audit.completed.length}` }).click();
    const done = main(page).getByRole("tabpanel", { name: `Completed subjects (${audit.completed.length})` });
    await expect(done.getByRole("listitem")).toHaveCount(audit.completed.length);
    const withTerm = audit.completed.find((row) => row.term_label);
    if (withTerm) await expect(done.getByRole("listitem").filter({ hasText: withTerm.code })).toContainText(withTerm.term_label);
    const withGrade = audit.completed.find((row) => row.grade_value);
    if (withGrade) await expect(done.getByRole("listitem").filter({ hasText: withGrade.code })).toContainText(`Grade ${withGrade.grade_value}`);

    await main(page).getByRole("button", { name: `Missing ${audit.missing.length}` }).click();
    await expect(outTab).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByRole("tabpanel", { name: /^Outstanding subjects/ })).toContainText(audit.missing[0].code);
  });

  test("the tabs move with the arrow keys", async ({ page, context }) => {
    const found = await studentWith(context, (a) => a.completed.length > 0);
    await page.goto(`/students/${found.id}`);
    const tabs = main(page).getByRole("tablist", { name: "Curriculum" });
    await tabs.getByRole("tab", { selected: true }).focus();
    await page.keyboard.press("Home");
    await expect(tabs.getByRole("tab", { name: /^Completed/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: /^Outstanding/ })).toHaveAttribute("aria-selected", "true");
  });
});
