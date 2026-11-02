// e2e-writes: none
// Packet motion (I-148, I-154, I-156; spec .planning/research/CONSISTENCY-PROCESSES-2026-11-02.md packets A and B).
// Written BEFORE the change; red on the old code. Staff on the AWOL & Residency board (Clarisse Tan, "Return review", is the
// card that has a step). Read-only: every write is answered by page.route, nothing is sent to the server.
//   - the "Move to..." menu works from the keyboard: focus moves in, Arrow keys / Home / End move, Escape closes and
//     gives the focus back to the button;
//   - a refused move shows a BoardNotice (role=status, inside the board) that is scrolled into view;
//   - while a move waits on its confirm dialog the card says "Moving to <column>"; Cancel clears it;
//   - the motion tokens exist: dialog panel + backdrop animate, a notice drops in, and prefers-reduced-motion switches
//     all of it off;
//   - SkeletonBoard (columns with two card bars, aria-busy, label "Loading board") is in the gallery.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 600 } });

const BOARD = { name: "AWOL and residency board" };
const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });

async function openBoard(page) {
  // Belt and braces: no write of any kind leaves the browser.
  await page.route(/\/api\/process-cases\/[^?]*/, async (route) => {
    if (route.request().method() === "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Done." }) });
  });
  await page.goto("/workflow/awol");
  const board = page.getByRole("region", BOARD);
  await expect(board).toBeVisible();
  const card = column(board, "Return review").locator("div[draggable]").filter({ hasText: "Clarisse Tan" });
  await expect(card).toHaveCount(1);
  return { board, card };
}

test("Move to menu: keyboard complete", async ({ page }) => {
  const { card } = await openBoard(page);
  const button = card.getByRole("button", { name: /Move to/ });
  await button.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const items = menu.getByRole("menuitem");
  const count = await items.count();
  expect(count).toBeGreaterThan(2);
  await expect(items.first(), "focus moves into the menu on open").toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.nth(count - 1)).toBeFocused();
  await page.keyboard.press("ArrowDown"); // wraps
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(button, "Escape returns the focus to the button").toBeFocused();
});

test("a refused move shows a BoardNotice inside the board, scrolled into view", async ({ page }) => {
  const { board, card } = await openBoard(page);
  await card.getByRole("button", { name: /Move to/ }).click();
  const refused = page.getByRole("menuitem").and(page.locator('[aria-disabled="true"]')).first();
  await expect(refused).toBeVisible();
  // Put the card at the top of the window so the top of the board is out of sight.
  await card.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8));
  await refused.click({ force: true }); // aria-disabled, so Playwright calls it "not enabled"; the menu still answers
  const notice = page.getByTestId("stage-board").getByTestId("board-notice");
  await expect(notice).toHaveAttribute("role", "status");
  expect(await notice.evaluate((node) => getComputedStyle(node).animationName)).toBe("notice-in");
  await expect(notice).toBeInViewport();
  await expect(board).toBeVisible();
});

test("a move waiting on its confirm dialog shows 'Moving to <column>' until Cancel", async ({ page }) => {
  const { card } = await openBoard(page);
  await card.getByRole("button", { name: /Move to/ }).click();
  const allowed = page.getByRole("menuitem").and(page.locator('[aria-disabled="false"]')).first();
  await expect(allowed).toBeVisible();
  const label = (await allowed.locator("span").first().innerText()).trim();
  await allowed.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(card.getByText(`Moving to ${label}`, { exact: true })).toBeVisible();
  // The dialog panel and its backdrop animate in.
  const names = await dialog.evaluate((panel) => [getComputedStyle(panel).animationName, getComputedStyle(panel.parentElement).animationName]);
  expect(names).toEqual(["dialog-panel-in", "backdrop-in"]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card.getByText(/^Moving to /)).toHaveCount(0);
});

test("reduced motion switches the new animations off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { card } = await openBoard(page);
  await card.getByRole("button", { name: /Move to/ }).click();
  await page.getByRole("menuitem").and(page.locator('[aria-disabled="true"]')).first().click({ force: true });
  const notice = page.getByTestId("board-notice");
  await expect(notice).toBeVisible();
  const seconds = await notice.evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
  expect(seconds, "animation-duration in seconds").toBeLessThan(0.001);
});

test("SkeletonBoard: columns of card bars, aria-busy, labelled", async ({ page }) => {
  await page.goto("/__ui");
  const skeleton = page.getByTestId("skeleton-board");
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveAttribute("aria-busy", "true");
  await expect(skeleton).toHaveAccessibleName("Loading board");
  expect(await skeleton.locator("[data-skeleton-column]").count()).toBeGreaterThanOrEqual(3);
  expect(await skeleton.locator("[data-skeleton-column]").first().locator("[data-skeleton-card]").count()).toBe(2);
});
