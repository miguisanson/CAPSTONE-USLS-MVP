// e2e-writes: none
// Packet P-E (F5-10, F5-15 / I-299): the residency dialog fills the purpose from the student's stage, shows the active term
// read-only and runs the policy check by itself; list and report pages show a skeleton, not a lone spinner, while loading.
// Read only: the policy check and the student record are answered by page.route; nothing is saved.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.describe("P-E polish", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  // the routed /api calls can still be in flight when a test ends; drop them so they do not fail the next test
  test.afterEach(async ({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

  async function pickStudent(page, stage) {
    await page.route(/\/api\/students\/\d+$/, async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill(json({ ...body, student: { ...body.student, current_stage: stage } }));
    });
    await page.goto("/workflow/awol");
    await page.getByRole("button", { name: "Record residency", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("searchbox", { name: "Search a student" }).click();
    await dialog.getByRole("button", { name: /^\S.* \S+ · / }).first().click();
    return dialog;
  }

  test("residency: purpose from the stage, semester read-only, check runs by itself", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/awol/policy-review", (route) => {
      calls += 1;
      return route.fulfill(json({ review: { recommendation: "Eligible for Residency", suggested_action: "Record", summary: "Fine.", checks: [] } }));
    });
    const dialog = await pickStudent(page, "Comprehensive Exam");
    await expect(dialog.getByRole("region", { name: "Residency policy result" })).toContainText("Eligible for Residency");
    expect(calls).toBe(1);
    await expect(dialog.getByRole("combobox", { name: "Residency purpose" })).toHaveCount(0);
    await expect(dialog.getByTestId("residency-purpose")).toHaveText("Comprehensive examination");
    await expect(dialog.getByRole("combobox", { name: "Semester" })).toHaveCount(0);
    await expect(dialog.getByTestId("residency-semester")).not.toBeEmpty();
    await expect(dialog.getByRole("button", { name: "Check again" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Record residency", exact: true })).toBeEnabled();
  });

  test("residency: a stage with no answer leaves the purpose editable", async ({ page }) => {
    const dialog = await pickStudent(page, "Coursework");
    await expect(dialog.getByRole("combobox", { name: "Residency purpose" })).toBeVisible();
  });

  const delay = (page) =>
    page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (/\/api\/(auth|me|meta|session)/.test(url)) return route.continue();
      await new Promise((r) => setTimeout(r, 1500));
      return route.continue();
    });

  for (const path of ["/work-queue", "/reports"]) {
    test(`loading: ${path} shows a skeleton, not a lone spinner`, async ({ page }) => {
      await delay(page);
      await page.goto(path);
      await expect(page.locator("[data-skeleton-table],[data-skeleton-line]").first()).toBeVisible({ timeout: 1400 });
      await expect(page.locator(".animate-spin")).toHaveCount(0); // no page-level spinner while the data is on its way
    });
  }
});
