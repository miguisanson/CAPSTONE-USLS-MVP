// e2e-writes: none
// Packet rep6 (I-407): Graduation list one click from Reports; Download PDF shows a "Downloaded" line. Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("rep6 staff Reports", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("I-407 one click from Reports reaches the Graduation list", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("tab", { name: "Graduation", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Graduation candidates", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "By year started", exact: true })).toBeVisible();
  });

  test("I-407 Download PDF says what was downloaded", async ({ page }) => {
    await page.goto("/reports?report=graduation-list");
    const pdf = page.getByRole("link", { name: "Download PDF" });
    await expect(pdf).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), pdf.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await expect(page.getByRole("status").filter({ hasText: /^Downloaded .*\.pdf$/ })).toBeVisible();
  });
});

test.describe("rep6 Dean Reports", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 900 } });

  test("I-407 the Dean reaches the graduation list in one click", async ({ page }) => {
    await page.goto("/dean/analytics");
    await page.getByRole("tab", { name: "Graduation pipeline", exact: true }).click();
    await expect(page).toHaveURL(/report=graduation/);
  });
});
