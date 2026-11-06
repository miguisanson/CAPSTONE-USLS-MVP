// e2e-writes: none
// I-408: Course Audit shows the end-of-term roster per subject and the students with missing subjects. Read-only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.describe("academic coordinator", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 900 } });

  test("roster for a chosen subject with a count line, students with missing subjects, nothing that saves a status", async ({ page }) => {
    await page.goto("/workflow/course-audit");
    await expect(main(page).getByRole("heading", { level: 1, name: "Course Audit" })).toBeVisible();
    const subject = main(page).getByRole("combobox", { name: "Subject" });
    await expect(subject.locator("option").nth(1)).toBeAttached();
    await subject.selectOption({ index: 1 });
    await expect(main(page).getByText(/^\d+ in the class · \d+ completed · \d+ not completed yet$/)).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Students with missing subjects" })).toBeVisible();
    await expect(main(page).getByRole("combobox", { name: "Program" })).toBeVisible();
    await expect(main(page).getByText(/^Take next: /).first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Open record" }).first()).toHaveAttribute("href", /^\/students\/\d+/);
    await expect(main(page).getByText("Completion comes from the AIMS export.")).toBeVisible();
    await expect(main(page).getByRole("button", { name: /save|mark|set status|complete/i })).toHaveCount(0);
    for (const old of ["term-scoped source records", "dedicated coursework modules"]) await expect(main(page)).not.toContainText(old);
  });

  test("phone: no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/workflow/course-audit");
    await expect(main(page).getByText(/^Take next: /).first()).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
});
