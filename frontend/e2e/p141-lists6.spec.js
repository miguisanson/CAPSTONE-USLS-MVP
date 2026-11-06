// e2e-writes: none
// Packet lists6 (I-430 Students filters and phone list, F8-06 stage words on student pages). Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const count = async (page) => Number((await page.getByText(/^Showing .* of \d+ students$/).first().innerText()).match(/of (\d+)/)[1]);

test.describe("lists6 Students", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 1366, height: 900 } });

  test("I-430 filter words are distinct and say what they mean", async ({ page }) => {
    await page.goto("/students");
    await expect(page.getByText(/^Showing .* of \d+ students$/).first()).toBeVisible();
    const words = async (name) => (await page.getByRole("combobox", { name, exact: true }).locator("option").allInnerTexts()).slice(1);
    expect(await words("All student status")).toEqual(["Compre exam eligible"]);
    const standing = await words("All standing");
    expect(standing).toContain("On leave");
    expect(standing.join("|")).not.toMatch(/LOA|not completed/);
    const stage = await words("All stage");
    expect(stage).toContain("Leave of Absence");
    expect(stage).not.toContain("LOA");
  });

  test("I-430 the home tile link count equals the list count and the tile says active students", async ({ page }) => {
    await page.goto("/");
    const tile = page.locator("main").getByRole("link", { name: /Active students at risk or delayed/i }).first();
    await expect(tile).toBeVisible();
    const value = Number((await tile.innerText()).match(/\d+/)[0]);
    await tile.click();
    await expect(page.getByText(/^Showing .* of \d+ students$/).first()).toBeVisible();
    expect(await count(page)).toBe(value);
  });

  test("I-430 at 390 px the list is cards with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/students");
    await expect(page.getByText(/^Showing .* of \d+ students$/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("main tbody tr").first().evaluate((el) => getComputedStyle(el).display)).toBe("block");
    const search = page.getByRole("searchbox", { name: "Search students" });
    expect(await search.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});

test("F8-06 a student on leave reads 'Leave of Absence', not LOA", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "withdrawal.elena@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json();
    data.student.current_stage = "LOA";
    await route.fulfill({ response, json: data });
  });
  const page = await context.newPage();
  for (const path of ["/student", "/student/profile"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("main").innerText();
    expect(text, path).toContain("Leave of Absence");
    expect(text, path).not.toMatch(/\bLOA\b/);
  }
  await context.close();
});
