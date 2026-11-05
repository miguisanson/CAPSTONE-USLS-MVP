// e2e-writes: none
// The Demo Guide always starts from the top (owner 2026-11-05): every start (sign-in box, "Start over", a second guide after Stop)
// calls POST /api/demo/sandbox/reset and plays step 1; the slideshow bar has "Start over" and no Back; the sign-in switch
// "Demo guide panel" OFF hides the whole guided-demo list. The reset and the record are answered by page.route.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";

const GUIDE_ON = "usls-demo-guide-on";
const bar = (page) => page.getByTestId("autopilot-bar");
const startBox = (page) => page.getByRole("region", { name: "Start a guided demo" });
const state = { demo_mode: true, role: "student", skip_date_waits: true, process: "readmission", student: { id: 9001, name: "Therese Lacson", student_number: "2690901" }, case: null, candidates: [] };

async function fresh(browser, { on }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 800 } });
  await context.addInitScript(([key, value]) => { try { window.localStorage.setItem(key, value); } catch { /* none */ } }, [GUIDE_ON, on ? "1" : "0"]);
  const resets = [];
  await context.route("**/api/demo/sandbox/reset", (route) => { resets.push(route.request().method()); return route.fulfill({ json: { ok: true, sandbox: true } }); });
  await context.route("**/api/demo/guide-state**", (route) => route.fulfill({ json: state }));
  return { context, page: await context.newPage(), resets };
}

test.describe("the Demo Guide starts from the top", () => {
  test("switch off: the sign-in page shows no guide list, only the switch; turning it on brings the list back", async ({ browser }) => {
    const { context, page } = await fresh(browser, { on: false });
    try {
      await page.goto("/login");
      const toggle = page.getByRole("switch", { name: /Demo guide panel/ });
      await expect(toggle).toBeVisible();
      await expect(startBox(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Readmission/ })).toHaveCount(0);
      await toggle.check();
      await expect(startBox(page)).toBeVisible();
      await expect(startBox(page).getByRole("button", { name: /^Readmission/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("the bar has Start over and no Back; Start over and a second guide after Stop each reset and land on step 1", async ({ browser }) => {
    const { context, page, resets } = await fresh(browser, { on: true });
    try {
      await page.goto("/login");
      await startBox(page).getByRole("button", { name: /^Readmission/ }).click();
      await expect(bar(page)).toBeVisible({ timeout: 30_000 });
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(/^Step 1 of /);
      expect(resets.length, "starting from the sign-in page resets").toBe(1);
      await expect(bar(page).getByRole("button", { name: "Start this demo over from the first step" })).toBeVisible();
      await expect(bar(page).getByRole("button", { name: /^Back$/ })).toHaveCount(0);

      await page.goto("/student"); // wander off the first step's page
      await bar(page).getByRole("button", { name: "Start this demo over from the first step" }).click();
      await expect(page).toHaveURL(/\/student\/requests\/readmission$/, { timeout: 30_000 });
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(/^Step 1 of /);
      expect(resets.length, "Start over resets").toBe(2);

      await bar(page).getByRole("button", { name: "Stop" }).click();
      await expect(bar(page)).toHaveCount(0);
      await page.getByRole("button", { name: /^Demo guide/ }).click();
      await page.getByRole("region", { name: "Demo guide" }).getByRole("button", { name: /^Leave of Absence/ }).click();
      await expect(page).toHaveURL(/\/student\/requests\/leave-of-absence$/, { timeout: 30_000 });
      await expect(bar(page).getByTestId("autopilot-step")).toHaveText(/^Step 1 of /);
      expect(resets.length, "a guide picked after Stop resets").toBe(3);
    } finally {
      await context.close();
    }
  });
});
