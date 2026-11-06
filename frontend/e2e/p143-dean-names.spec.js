// e2e-writes: none
// Persona round 7 (Dean on a phone): a student's name in a report list sent the Dean back to the Dashboard, because the
// Dean has no student record page. The Dean reads the name as plain text; staff keep the link to the record.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.describe("Dean report lists", () => {
  test.use({ storageState: join(AUTH_DIR, "dean.json"), viewport: { width: 390, height: 844 } });

  test("names in the Behind schedule list are not links to a page the Dean cannot open", async ({ page }) => {
    await page.goto("/dean/analytics");
    await page.getByRole("button", { name: /Behind schedule/ }).click();
    const dialog = page.getByRole("dialog", { name: "Behind schedule" });
    await expect(dialog.getByText(/\d+ rows?/).first()).toBeVisible();
    await expect(dialog.locator('a[href^="/students/"]')).toHaveCount(0);
  });
});

test.describe("staff report lists", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("staff still open the student record from the list", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: /^Behind schedule/ }).click();
    const dialog = page.getByRole("dialog", { name: "Behind schedule" });
    await expect(dialog.locator('a[href^="/students/"]').first()).toBeVisible();
  });
});
