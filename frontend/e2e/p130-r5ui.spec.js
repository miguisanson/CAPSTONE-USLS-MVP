// e2e-writes: none
// Packet r5ui (I-396, I-397, I-400, I-401): persona round 5 UI fixes. Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("faculty at 683x384", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 683, height: 384 } });

  test("I-396: an unconnected Google Calendar card is compact, so the legend is on the first screen", async ({ page }) => {
    await page.route("**/api/faculty-portal", async (route) => {
      const res = await route.fetch(); const data = await res.json();
      data.faculty = { ...data.faculty, calendar: { ...(data.faculty?.calendar || {}), connected: false } };
      await route.fulfill({ response: res, json: data });
    });
    await page.goto("/faculty-portal/calendar");
    await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
    const card = page.getByRole("region", { name: "Google Calendar connection" });
    expect((await card.boundingBox()).height, "card height").toBeLessThan(130);
  });

  test("I-397: advisee cards say 'Documents to sign' and spell out stage words", async ({ page }) => {
    await page.goto("/faculty-portal/advisees");
    await page.waitForLoadState("networkidle");
    const main = page.locator("main");
    await expect(main).not.toContainText("Needs signature");
    await expect(main).not.toContainText("No signature needed");
    await expect(main.getByText("Documents to sign").first()).toBeVisible();
  });
});

test.describe("dean on a phone", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  test("I-400: tiles name the target and the all-offices count has its own title", async ({ page }) => {
    await page.goto("/dean/analytics");
    const strip = page.getByRole("group", { name: "Summary numbers" });
    await expect(strip).not.toContainText("Misses target");
    await expect(strip.getByText(/^Target: .+ · (met|missed)$/).first()).toBeVisible();
    await expect(strip.getByRole("button", { name: /All offices: requests waiting more than 7 days/ })).toBeVisible();
  });

  test("I-400: the stage name opens the students, like the bar", async ({ page }) => {
    await page.goto("/dean/analytics?report=stages");
    await page.getByRole("tab", { name: "Students by stage", exact: true }).click();
    await page.getByRole("button", { name: "Show as table" }).click();
    const stageButton = page.getByRole("table").locator("tbody").getByRole("button").first();
    await stageButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("I-401: the menu's last item can scroll fully clear of the fade", async ({ page }) => {
    await page.goto("/dean");
    await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("dialog").locator("nav").last();
    const pad = await nav.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(pad, "bottom padding covers the 28 px fade").toBeGreaterThanOrEqual(28);
  });

});

test.describe("staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("I-401: Export CSV says which file was downloaded", async ({ page }) => {
    await page.goto("/workflow/graduation");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    await expect(page.getByRole("status").filter({ hasText: `Downloaded ${download.suggestedFilename()}` })).toBeVisible();
  });
});
