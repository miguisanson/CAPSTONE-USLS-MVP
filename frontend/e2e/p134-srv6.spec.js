// e2e-writes: none
// srv6 (I-064): Panel Matching and Defense Scheduling open on the students waiting at that step. Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.describe("research coordinator", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 900 } });

  for (const [slug, step, title] of [["panel-matching", "panel", "Waiting for a panel"], ["defense-scheduling", "schedule", "Waiting for a defense date"]]) {
    test(`I-064: ${slug} lists the students waiting and a click loads one`, async ({ page }) => {
      const overview = await (await page.request.get("/api/research-gate/overview")).json();
      const waiting = overview.items.filter((row) => row.next_step === step);
      await page.goto(`/workflow/${slug}`);
      await expect(main(page).getByRole("heading", { name: title })).toBeVisible();
      await expect(main(page).getByText("Select a student to begin")).toHaveCount(0);
      if (!waiting.length) {
        await expect(main(page)).toContainText(/No student is waiting for a (panel|defense date) right now\./);
        return;
      }
      await main(page).getByRole("button", { name: `Choose ${waiting[0].student.name}` }).click();
      await expect(page).toHaveURL(new RegExp(`student_id=${waiting[0].student.id}`));
      await expect(main(page).getByRole("heading", { name: title })).toHaveCount(0);
    });
  }

  test("I-064: the waiting list does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workflow/panel-matching");
    await expect(main(page).getByRole("heading", { name: "Waiting for a panel" })).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
