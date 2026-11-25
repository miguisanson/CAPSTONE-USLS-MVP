// e2e-writes: none
// UX audit Phase 7 (2026-11-21, issue UX-34). Written before the fix. The before/after measurement found one new axe
// violation: Phase 3 (UX-17) removed the Research Gate's second heading, so its column headings (h3) followed the page
// title (h1) with no h2 between them.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

test("UX-34 the Research Gate headings do not skip a level", async ({ page }) => {
  await page.goto("/workflow/research-gate");
  await expect(page.getByRole("region").filter({ has: page.locator("section[aria-label]") }).first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include("main").withRules(["heading-order"]).analyze();
  expect(violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
});
