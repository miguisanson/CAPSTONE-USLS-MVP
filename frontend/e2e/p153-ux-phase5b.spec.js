// e2e-writes: none
// UX audit Phase 5b (2026-11-21, issues UX-28, UX-29). Written before the change. Reads only (no card is dropped).
//   UX-28 an empty column is a narrow strip with its name and 0 (it still takes a drop)
//   UX-29 the final columns (Ended, Not approved, Approved, Acknowledged ...) sit behind one "Closed" strip at the end of
//         the board, folded; a click opens it, and a card dragged over it opens it, so drag works as before (owner IM48)
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

async function signedIn(browser, email) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const board = (page) => page.locator("main").getByTestId("stage-board");

const FINAL = {
  "/workflow/leave-of-absence": ["Ended", "Not approved"],
  "/workflow/readmission": ["Approved - back in the program", "Not approved"],
  "/workflow/awol": ["Back in the program", "Not approved", "Residency closed"],
  "/workflow/withdrawal": ["Acknowledged by Registrar", "Not approved"],
  "/workflow/practicum": ["Completed"],
  "/workflow/graduation": ["Acknowledged by Registrar"],
};

test.describe("UX Phase 5b: boards", () => {
  test("UX-28 an empty column is a narrow strip with its name and 0", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of ["/workflow/leave-of-absence", "/workflow/withdrawal"]) {
        await page.goto(path);
        await expect(board(page)).toBeVisible();
        await page.waitForLoadState("networkidle");
        const strips = board(page).locator("[data-empty-strip]");
        expect(await strips.count(), `${path} has an empty stage`).toBeGreaterThan(0);
        for (let i = 0; i < (await strips.count()); i++) {
          const strip = strips.nth(i);
          const box = await strip.boundingBox();
          expect(box.width, `${path}: strip ${i} is narrow`).toBeLessThanOrEqual(64);
          await expect(strip).toHaveAttribute("aria-label", /\S/);
          await expect(strip).toContainText("0");
          await expect(strip.getByText("No requests here")).toHaveCount(0);
        }
        // a column with cards is a full column
        const full = board(page).locator("section[aria-label]:not([data-empty-strip]):not([data-closed-strip])");
        expect(await full.count()).toBeGreaterThan(0);
      }
    } finally { await context.close(); }
  });

  test("UX-29 the final columns are behind one folded Closed strip at the end; a click opens and closes it", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const [path, finals] of Object.entries(FINAL)) {
        await page.goto(path);
        await expect(board(page)).toBeVisible();
        await page.waitForLoadState("networkidle");
        const closed = board(page).getByRole("button", { name: /^Closed\s*\d+$/ });
        await expect(closed, path).toHaveAttribute("aria-expanded", "false");
        for (const name of finals) await expect(board(page).locator(`section[aria-label="${name}"]`), `${path}: ${name} folded`).toHaveCount(0);
        // the Closed strip is the last thing on the board
        const last = board(page).locator("[role=region] > div > *").last();
        await expect(last).toHaveAttribute("data-closed-strip", /.*/);

        await closed.click();
        await expect(closed).toHaveAttribute("aria-expanded", "true");
        for (const name of finals) await expect(board(page).locator(`section[aria-label="${name}"]`), `${path}: ${name} shown`).toHaveCount(1);
        await closed.click();
        await expect(closed).toHaveAttribute("aria-expanded", "false");
      }
    } finally { await context.close(); }
  });

  test("UX-29 a card dragged over the folded Closed strip opens it (drag stays as it was)", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      await expect(board(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      const strip = board(page).locator("[data-closed-strip]");
      const transfer = await page.evaluateHandle(() => new DataTransfer());
      await strip.dispatchEvent("dragenter", { dataTransfer: transfer });
      await strip.dispatchEvent("dragover", { dataTransfer: transfer });
      await expect(board(page).getByRole("button", { name: /^Closed\s*\d+$/ })).toHaveAttribute("aria-expanded", "true");
      await expect(board(page).locator('section[aria-label="Not approved"]')).toHaveCount(1);
    } finally { await context.close(); }
  });

  test("UX-28/29 the Leave of Absence board needs less sideways room", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      await expect(board(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      const { scroll, client } = await board(page).locator('[role="region"][tabindex="0"]').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      // nine stages of 248 px with 12 px gaps were 2,328 px; folded and stripped it is well under that
      expect(scroll, `board width ${scroll}px in ${client}px`).toBeLessThan(1700);
    } finally { await context.close(); }
  });
});
