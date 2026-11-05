// e2e-writes: none
// Packet staffux (I-198, I-199; owner's top concern IM24: same-kind pages behave alike). Written BEFORE the change; red on the
// old code. Through the real UI as Graduate School staff, reads only (nothing is moved or saved; the dashboard's task list is
// answered by page.route so the links under test do not depend on the demo tasks).
//   I-199  on a phone (390 px) EVERY staff board - Leave of Absence, Readmission, AWOL, Withdrawal, Practicum, Graduation -
//          is the same stacked list of cards grouped by stage (the Dean's Graduation page already was); each card keeps its
//          "View details" button and either "Move to..." or the reason it cannot move. At 1366 px the column board stays.
//   I-198  every dashboard task that opens a process board opens it on the open requests (?show=open), and the board shows
//          the "Open requests only" chip, which clears the filter and the address.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p104");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

// slug, the board's region name at 1366, and on a phone
const BOARDS = [
  ["leave-of-absence", "Leave of absence board", "Leave of absence board"],
  ["readmission", "Readmission board", "Readmission board"],
  ["awol", "AWOL and residency board", "AWOL and residency board"],
  ["withdrawal", "Subject withdrawal board", "Subject withdrawal board"],
  ["practicum", "Practicum workflow board", "Practicum workflow board"],
  ["graduation", "Graduation workflow Kanban board", "Graduation candidates by stage"],
];

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

test.describe("staff boards on a phone (I-199)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  let moveMenus = 0;
  for (const [slug, , phoneName] of BOARDS) {
    test(`${slug}: stacked cards grouped by stage, not a scrolling board`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const list = page.getByRole("region", { name: phoneName });
      await expect(list).toBeVisible();
      expect(await list.evaluate((el) => getComputedStyle(el).overflowX), "the list does not scroll sideways").not.toBe("auto");
      await expect(page.getByText(/more stages? to the right/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Scroll board/ })).toHaveCount(0);
      const groups = list.locator("section").filter({ has: page.getByRole("heading", { level: 3 }) });
      expect(await groups.count(), "at least one stage group with cards").toBeGreaterThan(0);
      // CHANGED BY p126 (F5-05): stages with no card for this role start closed; open them all to check every card.
      const closed = list.locator("section h3 button[aria-expanded=false]");
      while (await closed.count()) await closed.first().click();
      const show = list.getByRole("button", { name: /^Show finished/ });
      if (await show.count()) {
        await show.click();
        while (await closed.count()) await closed.first().click();
      }
      const cards = list.locator("div[draggable]");
      const count = await cards.count();
      expect(count, "the demo data puts cards on this board").toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.getByRole("button", { name: /^View details for / }), `card ${i}: View details`).toHaveCount(1);
        const move = await card.getByRole("button", { name: /Move to/ }).count();
        const lock = await card.locator(":scope > p").count(); // the lock note under a card that cannot move: its reason in plain text
        expect(move + lock, `card ${i}: either Move to... or the reason it cannot move`).toBeGreaterThan(0);
      }
      // a group's heading carries its count
      await expect(groups.first().getByTestId("stage-count")).toHaveText(/^\d+$/);
      const firstMove = list.getByRole("button", { name: /Move to/ }).first();
      if (await firstMove.count()) {
        moveMenus += 1;
        await firstMove.click();
        await expect(page.getByRole("menu")).toBeVisible();
        expect(await page.getByRole("menuitem").count(), "the menu lists the other stages").toBeGreaterThan(1);
        await page.keyboard.press("Escape");
      }
      expect(await noOverflow(page), "the page does not scroll sideways").toBe(true);
      await shot(page, `${slug}-390.png`);
    });
  }

  test("somewhere on the six boards a card offers Move to...", async () => {
    expect(moveMenus).toBeGreaterThan(0);
  });
});

test.describe("staff boards on a desktop keep the columns (I-199)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [slug, desktopName] of BOARDS) {
    test(`${slug}: column board`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: desktopName });
      await expect(board).toBeVisible();
      expect(await board.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
      expect(await board.locator("section").count(), "one column per stage").toBeGreaterThanOrEqual(4);
      await shot(page, `${slug}-1366.png`);
    });
  }
});

// ------------------------------------------------------------------ I-198
const TASKS = [
  ["Review student readmission request", "/workflow/readmission"],
  ["Record and forward withdrawal request", "/workflow/withdrawal"],
  ["Check AWOL return declaration", "/workflow/awol"],
  ["Record and forward practicum MOA", "/workflow/practicum"],
  ["Prepare graduation endorsement list", "/workflow/graduation"],
  ["Tell the Registrar the approved leave was cancelled", "/workflow/leave-of-absence"],
];

test.describe("dashboard tasks open the boards on the open requests (I-198)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("each task link ends in ?show=open", async ({ page }) => {
    const due = new Date(Date.now() + 3 * 86400000).toISOString();
    const items = TASKS.map(([title], i) => ({ id: 910000 + i, title, owner_role: "Graduate School Staff", status: "Pending", due_at: due, student_id: null, student_name: "" }));
    await page.route(/\/api\/tasks(\?|$)/, (route) => route.fulfill({ json: { items, total: items.length, page: 1, page_size: 200, pages: 1 } }));
    await page.goto("/");
    const mine = page.locator("main section", { has: page.getByRole("heading", { name: "Needs your action", exact: true }) });
    for (const [title, path] of TASKS) {
      const link = mine.locator("li", { hasText: title }).getByRole("link");
      await expect(link, title).toHaveAttribute("href", `${path}?show=open`);
    }
  });

  for (const [slug] of BOARDS) {
    test(`${slug}: ?show=open shows the chip and only the open requests; the chip clears both`, async ({ page }) => {
      await page.goto(`/workflow/${slug}?show=open`);
      const chip = page.getByRole("button", { name: /^Open requests only/ });
      await expect(chip).toBeVisible();
      const showing = async () => {
        const text = await page.getByText(/^Showing \d+ of \d+/).first().textContent();
        const [, shown, total] = text.match(/Showing (\d+) of (\d+)/);
        return [Number(shown), Number(total)];
      };
      const [shown, total] = await showing();
      expect(shown).toBeLessThanOrEqual(total);
      await chip.click();
      await expect(chip).toHaveCount(0);
      await expect(page).not.toHaveURL(/show=open/);
      const [all, allTotal] = await showing();
      expect(all, "without the filter every request shows").toBe(allTotal);
      expect(all).toBeGreaterThanOrEqual(shown);
    });
  }
});
