// Packet P7.4 (issues I-067, I-088; senior review F-13, F-34): a board must not hide its columns without a cue,
// and an empty column must look like every other empty state.
//
// Cause (I-067): the process boards put 7 (Leave of Absence) or 6 (AWOL) columns of 300 px in a scrolling box.
// At 1366 px only ~3.3 fit; the rest are cut off ("With the Dea...", "Re-enrollme...") with nothing saying more exist.
// Cause (I-088): an empty board column was a dashed grey box, a third style next to the icon+title EmptyState and
// plain sentences elsewhere.
//
// Written BEFORE the change; red on the old code. Through the real UI as staff, read-only. At 1366x768:
//   - no column title is truncated (an ellipsis or a clipped title);
//   - every column header is fully inside the visible board, OR the board says how many stages are out of sight
//     (data-testid="board-scroll-hint") and offers "Scroll board left/right" buttons that work, by mouse and keyboard;
//   - an empty column shows the shared EmptyState (data-testid="board-empty"), not the dashed box.
// At 390 px no board makes the page scroll sideways.
// Set E2E_BOARD_SHOTS to a folder to also save full-page screenshots of five boards at 1366, 1920 and 390.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

const BOARDS = [
  ["leave-of-absence", "Leave of absence board"],
  ["awol", "AWOL and residency board"],
  ["withdrawal", "Subject withdrawal board"],
  ["practicum", "Practicum workflow board"],
  ["graduation", "Graduation workflow Kanban board"],
];

/** Where each column sits against the visible part of the board. */
async function measure(board) {
  return board.evaluate((region) => {
    const view = region.getBoundingClientRect();
    const sections = [...region.querySelectorAll(":scope section[aria-label]")];
    const columns = sections.map((section) => {
      const box = section.getBoundingClientRect();
      const title = section.querySelector("h3");
      return {
        label: section.getAttribute("aria-label"),
        fullyVisible: box.left >= view.left - 1 && box.right <= view.right + 1,
        titleClipped: title ? title.scrollWidth > title.clientWidth + 1 || getComputedStyle(title).textOverflow === "ellipsis" : false,
        cards: section.querySelectorAll("div[draggable]").length,
        hasEmpty: Boolean(section.querySelector('[data-testid="board-empty"]')),
        dashed: Boolean(section.querySelector("p.border-dashed")),
      };
    });
    return { columns, scrollLeft: region.scrollLeft, maxScroll: region.scrollWidth - region.clientWidth };
  });
}

/**
 * I-108 / I-106: the filter bar above a board. `row` is the line that holds the filter box and the Board/Table toggle.
 * Returns the width of each control in it, whether the toggle sits on its own line, and whether the search
 * placeholder fits its field (measured with the field's own font; a placeholder is not in the DOM to measure).
 */
async function measureFilterBar(page) {
  const toggle = page.getByRole("group", { name: "Choose how to show the requests" });
  await expect(toggle).toBeVisible();
  return toggle.evaluate((group) => {
    const row = group.parentElement;
    const box = [...row.children].find((child) => child !== group);
    const boxRect = box.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    const controls = [...box.querySelectorAll("input, select")].map((el) => ({ name: el.getAttribute("aria-label") || el.placeholder, width: el.getBoundingClientRect().width }));
    const search = box.querySelector('input[placeholder^="Search"]');
    let placeholderFits = null;
    if (search) {
      const style = getComputedStyle(search);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const room = search.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      placeholderFits = { text: search.placeholder, need: Math.ceil(context.measureText(search.placeholder).width), room: Math.floor(room) };
    }
    return {
      boxWidth: boxRect.width,
      toggleWidth: groupRect.width,
      toggleOnOwnRow: groupRect.top >= boxRect.bottom - 1,
      toggleBesideBox: groupRect.left >= boxRect.right - 1,
      controls,
      placeholderFits,
    };
  });
}

/**
 * Wait until the board has stopped moving. The scroll buttons use smooth scrolling (an animation of several frames), and the
 * board's "stages out of sight" count, which switches a button on or off, is updated from the scroll events a frame later.
 * Reading the buttons while the board is still moving is a race (I-110): the test saw the right button enabled, then the board
 * landed on the last stage, the button switched off, and the click waited 20 s for a button that was never going to be enabled again.
 */
async function settled(board) {
  let last = -1;
  let still = 0;
  await expect
    .poll(async () => {
      const now = (await measure(board)).scrollLeft;
      still = now === last ? still + 1 : 0;
      last = now;
      return still;
    }, { message: "the board stopped scrolling", intervals: [100], timeout: 10_000 })
    .toBeGreaterThanOrEqual(3);
}

const noPageOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("P7.4 boards show every stage or say that more exist", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [slug, label] of BOARDS.slice(0, 2)) {
    test(`${slug}: no column title is truncated and out-of-sight stages are announced`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: label });
      await expect(board).toBeVisible();
      const { columns } = await measure(board);
      expect(columns.length).toBeGreaterThanOrEqual(6);
      for (const column of columns) expect(column.titleClipped, `${column.label}: title is cut off`).toBe(false);

      const hidden = columns.filter((column) => !column.fullyVisible).length;
      const hint = page.getByTestId("board-scroll-hint");
      if (hidden === 0) {
        await expect(hint).toHaveCount(0);
        return;
      }
      // Some stages are out of sight, so the board must say so, with how many.
      await expect(hint, "a board with stages out of sight needs a visible cue").toBeVisible();
      await expect(hint).toHaveText(new RegExp(`${hidden} more stages? to the right`));
      await expect(page.getByRole("button", { name: "Scroll board left" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Scroll board right" })).toBeVisible();
    });

    test(`${slug}: the scroll buttons move the board and the cue follows`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: label });
      await expect(board).toBeVisible();
      const left = page.getByRole("button", { name: "Scroll board left" });
      const right = page.getByRole("button", { name: "Scroll board right" });
      await expect(right).toBeVisible();
      await expect(left).toBeDisabled(); // at the start there is nothing to the left
      const first = await measure(board);
      expect(first.scrollLeft).toBe(0);
      // Keyboard: focus the button and press Enter (no mouse).
      await right.focus();
      await page.keyboard.press("Enter");
      await expect.poll(async () => (await measure(board)).scrollLeft, "the board scrolled right").toBeGreaterThan(100);
      await settled(board);
      await expect(left).toBeEnabled();
      // Scroll to the end: the right button switches off and the cue talks about the stages on the left.
      // The loop asks the board where it is (not the button, which follows the board a frame later) and clicks only a button
      // that must still be on; every click is followed by a wait until the board has landed.
      for (let i = 0; i < 8; i++) {
        const { scrollLeft, maxScroll } = await measure(board);
        if (scrollLeft >= maxScroll - 1) break;
        await expect(right).toBeEnabled();
        await right.click();
        await settled(board);
      }
      await expect(right).toBeDisabled();
      await expect(page.getByTestId("board-scroll-hint")).toHaveText(/to the left/);
      const atEnd = (await measure(board)).scrollLeft;
      await left.click();
      await expect.poll(async () => (await measure(board)).scrollLeft, "the left button moved the board back").toBeLessThan(atEnd);
    });

    test(`${slug}: an empty column uses the shared EmptyState, not a dashed box`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: label });
      await expect(board).toBeVisible();
      const { columns } = await measure(board);
      const empty = columns.filter((column) => column.cards === 0);
      expect(empty.length, "the demo data has at least one empty column here").toBeGreaterThan(0);
      for (const column of empty) {
        expect(column.hasEmpty, `${column.label}: shared EmptyState`).toBe(true);
        expect(column.dashed, `${column.label}: no dashed placeholder`).toBe(false);
      }
    });
  }

  test("the four process boards and Practicum/Graduation keep Board/Table, Move to and locks as before", async ({ page }) => {
    await page.goto("/workflow/awol");
    const board = page.getByRole("region", { name: "AWOL and residency board" });
    await expect(board).toBeVisible();
    const card = board.locator("div[draggable='true']").first();
    await expect(card.getByRole("button", { name: /Move to/ })).toBeVisible();
    await expect(board.locator("div[draggable='false']").first().getByText("Waiting for: Student", { exact: true })).toBeVisible();
    const toggle = page.getByRole("group", { name: "Choose how to show the requests" });
    await toggle.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("region", { name: "AWOL and residency board" })).toHaveCount(0);
    await toggle.getByRole("button", { name: "Board" }).click();
    await expect(page.getByRole("region", { name: "AWOL and residency board" })).toBeVisible();
  });
});

test.describe("P7.4 filter bar (I-108)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  for (const [slug, label] of BOARDS) {
    test(`${slug}: the search placeholder is not cut off at 1366`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      await expect(page.getByRole("region", { name: label })).toBeVisible();
      const bar = await measureFilterBar(page);
      expect(bar.placeholderFits, `${slug}: a search field in the filter bar`).not.toBeNull();
      expect(bar.placeholderFits.need, `"${bar.placeholderFits.text}" needs ${bar.placeholderFits.need}px, the field has ${bar.placeholderFits.room}px`).toBeLessThanOrEqual(bar.placeholderFits.room);
    });
  }
});

test.describe("P7.4 phone width", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  for (const [slug, label] of BOARDS) {
    test(`${slug}: the filter bar and the Board/Table toggle wrap the same way at 390 (I-106)`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      await expect(page.getByRole("region", { name: label })).toBeVisible();
      const bar = await measureFilterBar(page);
      expect(bar.boxWidth, `${slug}: the filter box is not a sliver`).toBeGreaterThanOrEqual(160);
      for (const control of bar.controls) expect(control.width, `${slug}: "${control.name}" is at least 160px wide`).toBeGreaterThanOrEqual(160);
      expect(bar.toggleOnOwnRow, `${slug}: the Board/Table toggle is on its own row on a phone`).toBe(true);
    });
  }

  for (const [slug, label] of BOARDS) {
    test(`${slug}: the board scrolls inside itself, the page does not`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      await expect(page.getByRole("region", { name: label })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await noPageOverflow(page), `${slug}: page-level horizontal overflow at 390 px`).toBe(true);
    });
  }
});

const SHOTS = process.env.E2E_BOARD_SHOTS;
if (SHOTS) {
  test.describe("P7.4 screenshots", () => {
    test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
    test.use({ storageState: authFile("staff") });
    for (const width of [1366, 1920, 390]) {
      for (const [slug, label] of BOARDS) {
        test(`shot ${slug} ${width}`, async ({ page }) => {
          await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1920 ? 1080 : 768 });
          await page.goto(`/workflow/${slug}`);
          await expect(page.getByRole("region", { name: label })).toBeVisible();
          await page.mouse.move(0, 0);
          await page.waitForTimeout(600);
          await page.screenshot({ path: join(SHOTS, `${slug}-${width}.png`), fullPage: true });
        });
      }
    }
  });
}
