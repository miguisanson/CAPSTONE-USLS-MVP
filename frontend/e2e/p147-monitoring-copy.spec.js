// e2e-writes: none
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json") });

test("Monitoring Sheet puts the grid ahead of background copy", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator("aside nav").getByRole("link", { name: "Monitoring Sheet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Monitoring Sheet", level: 1 })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 30_000 });
  const search = page.getByRole("searchbox", { name: "Student" });
  const rows = page.locator("main table tbody tr");
  // CHANGED BY data cleanup (IM54-IM57, 2026-11-22): Hector Ong replaces Camille Bernardo.
  await search.fill("Hector Ong");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Ong, Hector");
  const studentId = (await rows.first().getByText(/^Student ID /).textContent()).trim().replace(/^Student ID /, "");
  await search.fill(studentId);
  await expect(rows.first()).toContainText("Ong, Hector");
  await search.fill("no-such-student");
  await expect(page.getByText("No students match this search")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).last().click(); // CHANGED BY owner feedback 2026-11-23 (stage 4): the search box has its own clear (x) too
  await expect(rows.first()).toBeVisible();
  for (const width of [390, 1366, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("monitoring-" + width + ".png"), fullPage: true, animations: "disabled" });
  }
  await expect(page.getByText(/Curriculum progress for each student/)).toBeHidden();
  await expect(page.getByText(/Records match \(\d+ checked\)/)).toBeHidden();
  await expect(page.getByText("Monitoring Sheet help", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Colour legend" })).toBeVisible();
  await page.getByRole("button", { name: "Add student", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add student" });
  await expect(dialog.getByText("Creates a student login and records a manual entry.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
});
