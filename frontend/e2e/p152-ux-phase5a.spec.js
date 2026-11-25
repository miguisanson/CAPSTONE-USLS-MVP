// e2e-writes: none
// UX audit Phase 5a (2026-11-21, issue UX-27). Written before the change. Reads only.
// Owner IM46 ("lighter touch"): no hub, no renames; the sidebar groups fold. With no choice made, only the group holding
// the page you are on is open; a group you open or close stays that way (remembered on this browser); going to a page in
// a closed group opens it. A folded group with something waiting shows the count on its heading.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

async function signedIn(browser, email, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const sidebar = (page) => page.locator("aside nav").first();
const toggle = (page, name) => sidebar(page).getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("UX Phase 5a: folding sidebar groups", () => {
  test("UX-27 only the group of the page you are on is open; the others fold", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(toggle(page, "Standalone Processes")).toHaveAttribute("aria-expanded", "true");
      await expect(sidebar(page).getByRole("link", { name: "Readmission" })).toBeVisible();
      for (const name of ["Records", "Lifecycle Workflows", "Monitoring & support"]) {
        await expect(toggle(page, name), name).toHaveAttribute("aria-expanded", "false");
      }
      await expect(sidebar(page).getByRole("link", { name: /Research Gate/ })).toBeHidden();
      // the first group holds the home page: it never folds
      await expect(sidebar(page).getByRole("button", { name: /^Overview/ })).toHaveCount(0);
      await expect(sidebar(page).getByRole("link", { name: "Dashboard" })).toBeVisible();
      // nothing to scroll in the sidebar at 1366 x 768 with the groups folded
      const fits = await sidebar(page).evaluate((nav) => nav.scrollHeight <= nav.clientHeight + 1);
      expect(fits, "the folded sidebar fits without scrolling").toBeTruthy();
    } finally { await context.close(); }
  });

  test("UX-27 a group opens and closes by mouse and keyboard, and the choice is remembered", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/");
      await expect(page.locator("main h1")).toBeVisible();
      const records = toggle(page, "Records");
      await expect(records).toHaveAttribute("aria-expanded", "false");
      await records.click();
      await expect(records).toHaveAttribute("aria-expanded", "true");
      await expect(sidebar(page).getByRole("link", { name: "Students" })).toBeVisible();

      const lifecycle = toggle(page, "Lifecycle Workflows");
      await lifecycle.focus();
      await page.keyboard.press("Enter");
      await expect(lifecycle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Space");
      await expect(lifecycle).toHaveAttribute("aria-expanded", "false");

      await page.reload();
      await expect(page.locator("main h1")).toBeVisible();
      await expect(toggle(page, "Records"), "remembered after a reload").toHaveAttribute("aria-expanded", "true");
      await expect(toggle(page, "Lifecycle Workflows")).toHaveAttribute("aria-expanded", "false");

      // going to a page in a closed group opens it
      await page.goto("/workflow/research-gate");
      await expect(toggle(page, "Lifecycle Workflows")).toHaveAttribute("aria-expanded", "true");
      await expect(sidebar(page).locator('a[aria-current="page"]')).toBeVisible();
    } finally { await context.close(); }
  });

  test("UX-27 a folded group with something waiting shows the count on its heading (Dean)", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/dean/activity");
      await expect(page.locator("main h1")).toBeVisible();
      const approvals = toggle(page, "Approvals");
      await expect(approvals).toHaveAttribute("aria-expanded", "false");
      await expect(approvals.getByLabel(/^\d+ waiting$/)).toBeVisible();
      await approvals.click();
      await expect(approvals.getByLabel(/^\d+ waiting$/), "open, the counts are on the links again").toHaveCount(0);
    } finally { await context.close(); }
  });

  test("UX-27 the phone menu folds the same way", async ({ browser }) => {
    const context = await signedIn(browser, "student@usls.edu.ph", { width: 390, height: 844 });
    const page = await context.newPage();
    try {
      await page.goto("/student/requests");
      await expect(page.locator("main h1")).toBeVisible();
      await page.getByRole("button", { name: /open menu|menu/i }).first().click();
      const drawer = page.getByRole("dialog");
      await expect(drawer.getByRole("button", { name: /^Requests/ })).toHaveAttribute("aria-expanded", "true");
      await expect(drawer.getByRole("button", { name: /^Academics/ })).toHaveAttribute("aria-expanded", "false");
    } finally { await context.close(); }
  });
});
