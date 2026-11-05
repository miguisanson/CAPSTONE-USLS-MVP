// e2e-writes: none
// pkt/seed2, I-383: the demo has a practicum case waiting for the hours check (Nicole Alvarez, 2360092: certificates sent,
// 200 hours reported, nothing verified), and every student with a practicum case is on the coordinator's Practicum board
// (Isabel Mendoza's report to the Dean is on the home, so the board must list her too). Read only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("I-383: the coordinator's Practicum board", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

  test("lists Isabel Mendoza and the case waiting for the hours check", async ({ page }) => {
    await page.goto("/workflow/practicum");
    const board = page.getByRole("region", { name: "Practicum workflow board" });
    await expect(board).toBeVisible();
    await expect(board.getByRole("article").filter({ hasText: "Isabel Mendoza" })).toHaveCount(1);
    const waiting = board.getByRole("article").filter({ hasText: "Nicole Alvarez" });
    await expect(waiting).toHaveCount(1);
    await waiting.getByRole("button", { name: "View details for Nicole Alvarez" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Reported by the student:")).toBeVisible();
    await expect(dialog.getByLabel(/^Verified hours/)).toBeVisible();
  });
});
