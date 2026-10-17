// Packet P7.3 (owner decision IM24, issue I-049): boards of the same kind behave the same.
// The owner could move Leave of Absence and Readmission cards but not AWOL & Residency cards, and nothing said why.
// Cause: an "AWOL flagged" card waits for the student (no step for staff), so the board silently refuses to drag it.
// Written BEFORE the change; red on the old code. Through the real UI, read-only (a "Move to..." menu is only opened
// and cancelled, nothing is moved), as staff:
//   - AWOL & Residency: every card in the "AWOL" column is waiting for the student, so it shows a lock and
//     "Waiting for: Student" as real text, is not draggable and offers no "Move to..." (the reason takes its place);
//   - a card that has a step (Clarisse Tan, "Return review") is draggable and still offers "Move to...", with no lock;
//   - Leave of Absence: a card waiting on the student (the server answer is edited for one card, so the test needs
//     no data change) shows the same lock and the same words; the other cards keep "Move to...";
//   - the four process boards carry the same toolbar: search, program, status, Board/Table, "How this works",
//     "View recent activity";
//   - Practicum and Graduation (WorkflowPage boards) follow the same rule: every card either offers "Move to..." or
//     says why not, never both and never neither; Practicum uses the same Board/Table toggle as the process boards.
// Demo data read only: Clarisse Tan, Benjamin Santos, Maya Torres.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

// E2E_SHOTS_TAG lets a before/after comparison write to two folders; the default is "p73".
const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p73");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });
const cardsOf = (scope) => scope.locator("div[draggable]");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function shot(page, name) {
  await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

test.describe.configure({ mode: "serial" });

test.describe("P7.3 boards of the same kind behave the same", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("AWOL & Residency: a card waiting for the student says so and cannot be moved", async ({ page }) => {
    await page.goto("/workflow/awol");
    const board = page.getByRole("region", { name: "AWOL and residency board" });
    await expect(board).toBeVisible();
    await shot(page, "awol-1366.png");
    const flagged = cardsOf(column(board, "AWOL"));
    const count = await flagged.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const card = flagged.nth(i);
      await expect(card.getByText("Waiting for: Student", { exact: true }), `card ${i}: the reason is text`).toBeVisible();
      await expect(card.locator("svg.lucide-lock"), `card ${i}: the lock icon`).toBeVisible();
      await expect(card).toHaveAttribute("draggable", "false");
      await expect(card.getByRole("button", { name: /Move to/ }), `card ${i}: no Move to`).toHaveCount(0);
      await expect(card).not.toHaveCSS("cursor", "grab");
    }
  });

  test("AWOL & Residency: a card that has a step is draggable and offers Move to...", async ({ page }) => {
    await page.goto("/workflow/awol");
    const board = page.getByRole("region", { name: "AWOL and residency board" });
    const card = cardsOf(column(board, "Return review")).filter({ hasText: "Clarisse Tan" });
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("draggable", "true");
    await expect(card.getByText(/^Waiting for:/)).toHaveCount(0);
    await expect(card.locator("svg.lucide-lock")).toHaveCount(0);
    const move = card.getByRole("button", { name: /Move to/ });
    await expect(move).toBeVisible();
    await move.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape"); // cancel: nothing is moved
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("Leave of Absence: the same lock, the same words, for a card waiting on the student", async ({ page }) => {
    await page.route(/\/api\/process-cases\?slug=leave-of-absence/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.cases = json.cases.map((item) => (item.student.name === "Benjamin Santos" ? { ...item, actions: [], owner: "Student" } : item));
      await route.fulfill({ response, json });
    });
    await page.goto("/workflow/leave-of-absence");
    const board = page.getByRole("region", { name: "Leave of absence board" });
    await expect(board).toBeVisible();
    await shot(page, "loa-1366.png");
    const locked = cardsOf(board).filter({ hasText: "Benjamin Santos" });
    await expect(locked).toHaveCount(1);
    await expect(locked.getByText("Waiting for: Student", { exact: true })).toBeVisible();
    await expect(locked.locator("svg.lucide-lock")).toBeVisible();
    await expect(locked).toHaveAttribute("draggable", "false");
    await expect(locked.getByRole("button", { name: /Move to/ })).toHaveCount(0);
    // a card that still has a step keeps both
    const open = cardsOf(board).filter({ hasText: "Therese Lacson" });
    await expect(open).toHaveAttribute("draggable", "true");
    await expect(open.getByRole("button", { name: /Move to/ })).toBeVisible();
    await expect(open.locator("svg.lucide-lock")).toHaveCount(0);
  });

  test("the four process boards carry the same toolbar", async ({ page }) => {
    for (const [slug, region] of [
      ["leave-of-absence", "Leave of absence board"],
      ["readmission", "Readmission board"],
      ["awol", "AWOL and residency board"],
      ["withdrawal", "Subject withdrawal board"],
    ]) {
      await page.goto(`/workflow/${slug}`);
      await expect(page.getByRole("region", { name: region }), slug).toBeVisible();
      await expect(page.getByRole("button", { name: "How this works" }), `${slug}: guide`).toBeVisible();
      await expect(page.getByRole("button", { name: "View recent activity" }), `${slug}: activity`).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Search requests by name/ }), `${slug}: search`).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Filter by program" }), `${slug}: program`).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Filter by status" }), `${slug}: status`).toBeVisible();
      const toggle = page.getByRole("group", { name: "Choose how to show the requests" });
      await expect(toggle.getByRole("button", { name: "Board" }), `${slug}: board toggle`).toHaveAttribute("aria-pressed", "true");
      await expect(toggle.getByRole("button", { name: "Table" }), `${slug}: table toggle`).toBeVisible();
    }
  });

  for (const [slug, region] of [
    ["practicum", "Practicum workflow board"],
    ["graduation", "Graduation workflow Kanban board"],
  ]) {
    test(`${slug}: every card offers Move to... or says why not, and the page has the same toggle`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: region });
      await expect(board).toBeVisible();
      const cards = cardsOf(board);
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const hasMenu = (await card.getByRole("button", { name: /Move to/ }).count()) > 0;
        const hasReason = (await card.locator("svg.lucide-lock").count()) > 0;
        const draggable = (await card.getAttribute("draggable")) === "true";
        if (hasReason) {
          expect(hasMenu, `card ${i}: a locked card has no Move to`).toBe(false);
          expect(draggable, `card ${i}: a locked card is not draggable`).toBe(false);
          await expect(card.getByText(/^(Waiting for|Only|Open the case|Use)/).first(), `card ${i}: the reason is text`).toBeVisible();
        } else {
          expect(hasMenu, `card ${i}: a card without a reason offers Move to`).toBe(true);
          expect(draggable, `card ${i}: and is draggable`).toBe(true);
        }
      }
      if (slug === "practicum") {
        const toggle = page.getByRole("group", { name: "Choose how to show the requests" });
        await expect(toggle.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
        await toggle.getByRole("button", { name: "Table" }).click();
        await expect(page.getByRole("table")).toBeVisible();
        await toggle.getByRole("button", { name: "Board" }).click();
        await expect(board).toBeVisible();
      }
      await shot(page, `${slug}-1366.png`);
    });
  }

  test.describe("at 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const [slug, region] of [
      ["awol", "AWOL and residency board"],
      ["leave-of-absence", "Leave of absence board"],
    ]) {
      test(`${slug}: the reason fits and the page does not scroll sideways`, async ({ page }) => {
        await page.goto(`/workflow/${slug}`);
        await expect(page.getByRole("region", { name: region })).toBeVisible();
        await shot(page, `${slug}-390.png`);
        expect(await noOverflow(page)).toBe(true);
        if (slug === "awol") {
          const board = page.getByRole("region", { name: region });
          await expect(cardsOf(column(board, "AWOL")).first().getByText("Waiting for: Student", { exact: true })).toBeVisible();
        }
      });
    }
  });
});
