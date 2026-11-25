// e2e-writes: none
// UX audit Phase 1 (2026-11-20, issues UX-01..UX-07). Written before the change. Reads only: the student context is
// answered through page.route where a case must be forced, so no other spec's data matters.
//   UX-01 the student home's "Your open tasks" figure is the number of rows in "Needs your action"
//   UX-02 the Work Queue opens on the signed-in office's own tasks; "All owners" is one click away
//   UX-03 the board's count sentence is no longer shown (the column counts carry it); screen readers still hear it
//   UX-04 a long column scrolls inside itself, so a tall column out of sight does not leave an empty gap under the board
//   UX-05 the sidebar keeps its whole height for the links: no footer note under the navigation on a laptop screen
//   UX-06 the student home has no "Elsewhere in your portal" card (the sidebar already lists those pages)
//   UX-07 a student who is not yet eligible sees Graduation Endorsement locked, with the reason, in the Request Center
//   UX-08 a status chip inside a home figure tile stays inside the tile
//   UX-09 the smallest text on screen is at least 12px
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

async function signedIn(browser, email, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}

test.describe("UX Phase 1: the student home", () => {
  test("UX-01 the 'Your open tasks' figure equals the rows in 'Needs your action'", async ({ browser }) => {
    const context = await signedIn(browser, "student@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/student");
      await page.waitForLoadState("networkidle");
      const actions = page.locator("section").filter({ has: page.getByRole("heading", { name: "Needs your action" }) });
      const rows = await actions.locator("li").count();
      const tile = page.locator('[data-slot="stats"] > *').filter({ hasText: /Your open tasks/i });
      await expect(tile).toHaveCount(1);
      expect(rows, "Miguel has something waiting on him").toBeGreaterThan(0);
      await expect(tile.locator('[data-slot="value"]')).toHaveText(String(rows));
    } finally { await context.close(); }
  });

  test("UX-06 no 'Elsewhere in your portal' card", async ({ browser }) => {
    const context = await signedIn(browser, "student@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/student");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "Your lifecycle" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Elsewhere in your portal" })).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("UX-08 the Research tile's status chip stays inside the tile", async ({ browser }) => {
    const context = await signedIn(browser, "student@usls.edu.ph", { width: 1440, height: 900 });
    const page = await context.newPage();
    try {
      await page.goto("/student");
      await page.waitForLoadState("networkidle");
      const tile = page.locator('[data-slot="stats"] > *').filter({ hasText: /^Research/ });
      await expect(tile).toHaveCount(1);
      const card = await tile.locator(".card").boundingBox();
      const sub = tile.locator('[data-slot="sub"] > *').first();
      if (await sub.count()) {
        const chip = await sub.boundingBox();
        expect(chip.x + chip.width, "chip keeps clear of the tile edge (inside its padding)").toBeLessThanOrEqual(card.x + card.width - 12);
      }
    } finally { await context.close(); }
  });
});

test.describe("UX Phase 1: the Request Center", () => {
  test("UX-07 Graduation Endorsement is locked, with the reason, while the student is not eligible", async ({ browser }) => {
    const context = await signedIn(browser, "student@usls.edu.ph");
    await context.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.graduation_endorsement = null;
      data.graduation_eligibility = { ...(data.graduation_eligibility || {}), eligible: false, status: "Not eligible", practicum_gate: null };
      await route.fulfill({ response, json: data });
    });
    const page = await context.newPage();
    try {
      await page.goto("/student/requests");
      await page.waitForLoadState("networkidle");
      const card = page.getByRole("main").getByRole("link", { name: /Graduation Endorsement/ });
      await expect(card).toContainText(/opens only after coursework, research/i);
      await page.goto("/student/graduation");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/opens only after coursework, research/i)).toBeVisible();
    } finally { await context.close(); }
  });
});

test.describe("UX Phase 1: staff screens", () => {
  test("UX-02 the Work Queue opens on Graduate School Staff's own tasks; All owners is one click away", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      const first = page.waitForRequest((req) => req.url().includes("/api/tasks"));
      await page.goto("/work-queue");
      const url = new URL((await first).url());
      expect(url.searchParams.get("owner")).toBe("Graduate School Staff");
      // CHANGED BY UX phase 4 (UX-23..25): the office's own tasks are the Mine tab; All is the third tab.
      await expect(page.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true");
      const all = page.waitForRequest((req) => req.url().includes("/api/tasks") && !new URL(req.url()).searchParams.get("owner") && !new URL(req.url()).searchParams.get("not_owner"));
      await page.getByRole("tab", { name: "All" }).click();
      await all;
    } finally { await context.close(); }
  });

  test("UX-03 the count sentence above a board is for screen readers only; the column counts stay", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      const line = page.getByTestId("board-summary").locator("[data-summary-line]");
      await expect(line).toHaveCount(1);
      await expect(line).toHaveText(/^\d+ .+$|^No .+ yet$/);
      await expect(line).toHaveClass(/sr-only/);
      await expect(page.getByTestId("stage-count").first()).toBeVisible();
    } finally { await context.close(); }
  });

  test("UX-04 the board is no taller than its tallest visible column needs (long columns scroll inside)", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      const board = page.getByRole("region", { name: /board/i }).first();
      await expect(board).toBeVisible();
      const height = (await board.boundingBox()).height;
      expect(height, "board height (px)").toBeLessThanOrEqual(900);
      const bodies = board.getByTestId("stage-scroll");
      const n = await bodies.count();
      for (let i = 0; i < n; i++) {
        const overflow = await bodies.nth(i).evaluate((el) => getComputedStyle(el).overflowY);
        expect(["auto", "scroll"]).toContain(overflow);
      }
    } finally { await context.close(); }
  });

  test("UX-05 the sidebar has no footer note; the navigation runs to the bottom of the screen", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/");
      const aside = page.locator("aside").first();
      await expect(aside).toBeVisible();
      await expect(aside.getByText("Figures are computed live from recorded transactions.")).toHaveCount(0);
      const nav = await aside.locator("nav").boundingBox();
      expect(nav.y + nav.height, "nav bottom").toBeGreaterThanOrEqual(768 - 2);
    } finally { await context.close(); }
  });

  test("UX-09 no text on the staff home or a board is smaller than 12px", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of ["/", "/workflow/leave-of-absence", "/workflow/graduation"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const smallest = await page.evaluate(() => {
          let min = Infinity;
          let where = "";
          for (const el of document.querySelectorAll("body *")) {
            if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || el.closest(".sr-only")) continue;
            const size = parseFloat(style.fontSize);
            if (size < min) { min = size; where = el.textContent.trim().slice(0, 40); }
          }
          return { min, where };
        });
        expect(smallest.min, `${path}: smallest text "${smallest.where}"`).toBeGreaterThanOrEqual(12);
      }
    } finally { await context.close(); }
  });
});
