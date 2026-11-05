// e2e-writes: none
// Round 4 (persona admin: I-394, I-395; student-new: I-393). Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.describe("admin", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 1366, height: 900 } });

  test("I-394/I-395: Students shows the count at the top, names its dropdowns as they read, and Active matches the dashboard", async ({ page }) => {
    const dashboard = await (await page.request.get("/api/dashboard")).json();
    await page.goto("/students");
    await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
    await expect(main(page).getByText(/^Showing 1–\d+ of \d+ students$/).first()).toBeVisible();
    for (const name of ["All risk", "All standing", "All stage", "All program", "All student status"]) {
      await expect(page.getByRole("combobox", { name, exact: true }), name).toBeVisible();
    }
    await expect(page.getByRole("combobox", { name: "All risk", exact: true }).locator("option")).toContainText(["Delayed"]);
    const listed = page.waitForResponse((r) => r.url().includes("/api/students") && r.url().includes("standing=Active"));
    await page.getByRole("combobox", { name: "All standing", exact: true }).selectOption("Active");
    const json = await (await listed).json();
    expect(json.total, "Standing = Active is the dashboard's active students").toBe(dashboard.kpis.active_students);
  });

  test("I-395: one word per state on Business Rules and Policy Documents", async ({ page }) => {
    await page.goto("/business-rules");
    await expect(page.getByRole("heading", { level: 1, name: "Business Rules" })).toBeVisible();
    await expect(main(page).getByText("Need review", { exact: true })).toHaveCount(0);
    await expect(main(page).getByText("Needs review", { exact: true }).first()).toBeVisible();
    await page.goto("/policy-documents");
    await expect(page.getByRole("heading", { level: 1, name: "Policy Documents" })).toBeVisible();
    await expect(main(page)).not.toContainText("approved PDF and Word");
    await expect(main(page)).not.toContainText("Drafts pending validation");
    await expect(main(page).getByText("Draft", { exact: true })).toHaveCount(0);
    await expect(main(page).getByText("Pending validation", { exact: true }).first()).toBeVisible();
  });

  test("I-395: the Activity Log workflow filter writes AWOL in capitals", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.getByText(/Showing \d+ of \d+ activities/)).toBeVisible();
    const options = await page.getByRole("combobox", { name: "Filter activity by workflow" }).locator("option").allTextContents();
    expect(options.filter((text) => /^awol$/i.test(text.trim())), options.join("|")).toEqual([]);
  });

  test("I-395: on a phone the policy cards wrap their titles so they can be told apart", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/policy-documents");
    await expect(page.getByRole("heading", { level: 1, name: "Policy Documents" })).toBeVisible();
    const titles = page.locator("main h3.card-title");
    await expect(titles.first()).toBeVisible();
    const clipped = await titles.evaluateAll((nodes) => nodes.filter((n) => n.scrollWidth > n.clientWidth + 1).length);
    expect(clipped, "no title is cut off with an ellipsis").toBe(0);
  });
});
