// e2e-writes: none
// UX audit Phase 6 (2026-11-21, issues UX-30 to UX-33). Written before the change. Reads only.
//   UX-30 Monitoring Sheet grid: a code in every cell (a dash for "not taken"), a legend of at most 5 colours, Flag and
//         Edit buttons with words, and the last column can be scrolled fully into view
//   UX-31 Monitoring Sheet on a phone (390 px): one card per student with a bar per subject group, not the grid
//   UX-32 every student page at 390 px: no sideways scroll, tap targets at least 44 px, input text at least 16 px
//   UX-33 faculty home: "Upcoming defenses" is in the main column, under "Needs your action"
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const STUDENT_PAGES = [
  "", "progress", "enrollment", "class-schedule", "research", "adviser", "defense-schedule", "calendar", "practicum",
  "graduation", "requests", "requests/leave-of-absence", "requests/readmission", "requests/awol-return",
  "requests/withdrawal", "messages", "documents", "activity", "assistant", "profile",
];

test.describe("UX Phase 6: Monitoring Sheet at 1366", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("UX-30 a code in every cell, a legend of at most 5 colours, Flag and Edit in words, the last column reachable", async ({ page }) => {
    await page.goto("/monitoring-sheet");
    const table = page.locator("main table").first();
    await expect(table).toBeVisible();

    // every subject cell says what it is in a letter (or a dash), not only in a colour
    const codes = await table.locator("tbody button[aria-label*=' for '][aria-label*=': ']").allTextContents();
    expect(codes.length).toBeGreaterThan(20);
    for (const code of codes) expect(code.trim(), "a cell with no code").toMatch(/^[A-Z]$|^–$/);

    // the legend: at most 5 colours; each entry shows its code
    const legend = page.getByRole("list", { name: "Colour legend" });
    const swatches = await legend.locator("[data-swatch]").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    expect(swatches.length, "legend swatches").toBeGreaterThan(4);
    expect(new Set(swatches).size, `legend colours: ${[...new Set(swatches)].join(" | ")}`).toBeLessThanOrEqual(5);
    for (const code of ["C", "T", "E", "P", "F", "I", "W", "D", "–"]) await expect(legend.locator("[data-swatch]").filter({ hasText: new RegExp(`^${code}$`) })).toHaveCount(1);

    // the row buttons carry words
    const row = table.locator("tbody tr").first();
    await expect(row.getByRole("button", { name: /^Open flags for / })).toContainText("Flag");
    await expect(row.getByRole("button", { name: /^(Edit|View) monitoring record of / })).toContainText(/Edit|View/);

    // scrolled to the far right, the last column is whole and no header is cut short
    const box = page.getByTestId("monitoring-scroll");
    await box.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    const fit = await box.evaluate((node) => {
      const view = node.getBoundingClientRect();
      const heads = [...node.querySelectorAll("thead th")];
      const last = heads.reduce((a, b) => (b.getBoundingClientRect().right > a.getBoundingClientRect().right ? b : a));
      const clipped = heads.filter((th) => [...th.querySelectorAll("span")].some((span) => span.scrollWidth > span.clientWidth + 1 && getComputedStyle(span).writingMode === "horizontal-tb")).map((th) => th.textContent.trim());
      return { lastRight: last.getBoundingClientRect().right, viewRight: view.right, clipped };
    });
    expect(fit.lastRight, "the last column ends inside the sheet").toBeLessThanOrEqual(fit.viewRight + 1);
    expect(fit.clipped, "headers cut short").toEqual([]);
  });
});

test.describe("UX Phase 6: Monitoring Sheet at 390", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("UX-31 one card per student, a bar per subject group, no grid", async ({ page }) => {
    await page.goto("/monitoring-sheet");
    const cards = page.getByTestId("monitoring-card");
    await expect(cards.first()).toBeVisible();
    await expect(page.locator("main table").first()).toBeHidden();
    const first = cards.first();
    const bars = first.getByRole("progressbar");
    expect(await bars.count(), "a bar per subject group").toBeGreaterThanOrEqual(2);
    await expect(bars.first()).toHaveAccessibleName(/^\w[\w &/-]* \d+ of \d+ done$/);
    for (const name of [/^Open flags for /, /^(Edit|View) monitoring record of /]) {
      const size = await first.getByRole("button", { name }).boundingBox();
      expect(Math.min(size.width, size.height), "a phone-sized button").toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "no sideways scroll").toBeLessThanOrEqual(1);
  });
});

test.describe("UX Phase 6: student pages at 390", () => {
  test.use({ storageState: authFile("student"), viewport: { width: 390, height: 844 } });

  test("UX-32 no sideways scroll, tap targets of 44 px, input text of 16 px", async ({ page }) => {
    test.setTimeout(180000);
    const problems = [];
    for (const path of STUDENT_PAGES) {
      await page.goto(`/student/${path}`);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      const found = await page.evaluate(() => {
        const shown = (node) => { const box = node.getBoundingClientRect(); return box.width > 2 && box.height > 2 && getComputedStyle(node).visibility !== "hidden"; };
        const out = [];
        const over = document.documentElement.scrollWidth - window.innerWidth;
        if (over > 1) out.push(`scrolls sideways by ${over}px`);
        const controls = document.querySelectorAll("main button, main a[href], main [role=tab], main summary, main select, main input[type=checkbox], main input[type=radio]");
        for (const node of controls) {
          if (!shown(node) || node.closest("p")) continue; // a link inside a sentence is text, not a tap target
          const target = (node.closest("label") || node).getBoundingClientRect(); // a box's label is part of its target
          if (Math.min(target.width, target.height) < 44) out.push(`small target "${(node.getAttribute("aria-label") || node.textContent || node.tagName).trim().slice(0, 40)}" ${Math.round(target.width)}x${Math.round(target.height)}`);
        }
        for (const node of document.querySelectorAll("main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), main select, main textarea")) {
          if (shown(node) && parseFloat(getComputedStyle(node).fontSize) < 16) out.push(`small input text "${node.getAttribute("aria-label") || node.name || node.tagName}"`);
        }
        return out;
      });
      for (const problem of found) problems.push(`/student/${path}: ${problem}`);
    }
    expect(problems).toEqual([]);
  });
});

test.describe("UX Phase 6: faculty home", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

  test("UX-33 Upcoming defenses is in the main column, under Needs your action", async ({ page }) => {
    await page.goto("/faculty-portal");
    const actions = page.locator("main section").filter({ has: page.getByRole("heading", { name: "Needs your action" }) }).first();
    const defenses = page.locator("main section").filter({ has: page.getByRole("heading", { name: "Upcoming defenses" }) }).first();
    await expect(defenses).toBeVisible();
    const a = await actions.boundingBox();
    const d = await defenses.boundingBox();
    expect(Math.round(d.x), "same left edge as Needs your action").toBe(Math.round(a.x));
    expect(Math.round(d.width), "as wide as Needs your action").toBe(Math.round(a.width));
    expect(d.y, "below it").toBeGreaterThan(a.y);
  });
});
