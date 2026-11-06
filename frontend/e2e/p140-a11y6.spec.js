// e2e-writes: none
// Packet a11y6 (I-429 Activity Log filters have visible labels, I-431 policy document titles wrap).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

for (const key of ["admin", "staff"]) {
  test.describe(`a11y6 Activity Log (${key})`, () => {
    test.use({ storageState: authFile(key), viewport: { width: 1366, height: 768 } });

    test("I-429 search and both lists are found by label, and filtering works", async ({ page }) => {
      await page.goto("/activity");
      const search = page.getByLabel("Search", { exact: true });
      const workflow = page.getByLabel("Workflow");
      const owner = page.getByLabel("Next owner");
      await expect(search).toBeVisible();
      await expect(page.locator("span.field-label", { hasText: "Workflow" })).toBeVisible(); // visible, like Reports
      await expect(owner).toBeVisible();
      await expect(page.getByText(/Showing \d+ of \d+ activities/)).toBeVisible();
      const all = Number((await page.getByText(/Showing \d+ of \d+ activities/).innerText()).match(/Showing (\d+)/)[1]);
      const options = await workflow.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
      expect(options.length).toBeGreaterThan(0);
      await workflow.selectOption(options[0]);
      const some = Number((await page.getByText(/Showing \d+ of \d+ activities/).innerText()).match(/Showing (\d+)/)[1]);
      expect(some).toBeGreaterThan(0);
      expect(some).toBeLessThanOrEqual(all);
    });

    test("no accessibility violations on the Activity Log", async ({ page }) => {
      await page.goto("/activity");
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  });
}

test.describe("a11y6 Policy Documents", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test("I-431 the operations manual title is shown in full (wraps, not cut)", async ({ page }) => {
    await page.goto("/policy-documents");
    const title = page.getByRole("heading", { name: /USLS Graduate School Operations Manual/ });
    await expect(title).toBeVisible();
    const cut = await title.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === "ellipsis" || getComputedStyle(el).whiteSpace === "nowrap");
    expect(cut).toBe(false);
    await expect(title).toHaveAttribute("title", /Operations Manual/);
  });
});
