// Component gallery proof for packet P1d (Phase 5, UI-SPEC sections 4 and 5): DataTable and the Feedback set
// (EmptyState, Spinner, Skeleton, InlineNotice, SearchInput, Pagination). Opens /__ui at 1366, 1920 and 390 and
// checks the P1d block of the gallery (data-gallery="p1d"):
//   - DataTable with 30 rows and 8 columns: header cells carry scope="col", sorting reorders rows, the filter narrows
//     them, 10 rows per page, CSV export downloads the filtered/sorted set with its header row, the empty state shows
//     when there are no rows; at 390 px the table scrolls inside its own wrapper and the page never scrolls sideways;
//   - InlineNotice: info is BLUE (AD1), success is green, role="status" for info/success/warning, role="alert" only
//     for danger (the danger examples mount only on /__ui?notice-danger=1, because the shared sweep counts any
//     visible role="alert" as an error banner); Spinner, Skeleton, EmptyState, SearchInput and Pagination render.
// No console error, failed API call or horizontal overflow at any width. Screenshots are saved.
// Needs a build made with VITE_UI_GALLERY=1 (`npm run e2e` does that). Read-only.
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const OUT_DIR = join(SCREENS_DIR, "ui-gallery-p1d");
const HEADERS = ["Student", "Number", "Program", "Stage", "Status", "Units", "Updated", "Adviser"];

// Notice colours from lib/tone.js (blue-50/800, brand-50, amber-50/900, red-50/800) as computed rgb().
const NOTICE = {
  info: { bg: "rgb(239, 246, 255)", fg: "rgb(30, 64, 175)", role: "status" },
  success: { bg: "rgb(237, 250, 241)", role: "status" },
  warning: { bg: "rgb(255, 251, 235)", fg: "rgb(120, 53, 15)", role: "status" },
  danger: { bg: "rgb(254, 242, 242)", fg: "rgb(153, 27, 27)", role: "alert" },
};

for (const viewport of VIEWPORTS) {
  test.describe(`P1d gallery block (DataTable, Feedback) at ${viewport.width}px`, () => {
    const phone = viewport.width < 640;
    let block;
    let tracker;

    test.beforeEach(async ({ page, context }) => {
      tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery P1d", viewport: viewport.width } };
      await stubExternal(context);
      attachWatchers(page, tracker);
      await checkPage(page, tracker, { role: "admin", href: "/__ui?notice-danger=1", label: "UI gallery P1d", viewport, outDir: OUT_DIR });
      block = page.locator('[data-gallery="p1d"]');
      await expect(block, "the P1d block is missing from /__ui (UiGallery.jsx must render it)").toBeVisible();
    });

    test.afterEach(async () => {
      // The sweep calls any visible role="alert" an error banner. Exempt the one pre-existing gallery text ("danger notice",
      // the tones block) and the two deliberate danger samples of this block, which mount only on ?notice-danger=1.
      const exempt = (p) => /error banner visible: (danger notice|P1d danger sample|P1d legacy error sample)/.test(p.problem);
      const report = formatProblems(tracker.problems.filter((p) => !exempt(p)));
      expect(report, report.join("\n")).toEqual([]);
    });

    const one = (name) => block.locator(`[data-case="${name}"]`);
    const rows = (table) => table.locator("tbody tr");
    const cells = (table, column) => table.locator(`tbody tr td:nth-child(${column})`).allTextContents();
    const summary = (table) => table.locator("[data-pagination-summary]");

    test("DataTable: columns, scope=col, sticky header, scrolls inside its wrapper, never the page", async ({ page }) => {
      const table = one("table-main");
      await expect(table).toBeVisible();
      const wrapper = table.locator("[data-table-scroll]");
      expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX), "wrapper overflow-x").toBe("auto");
      expect(await wrapper.evaluate((el) => getComputedStyle(el).position), "wrapper is the positioning context").toBe("relative");

      // 8 columns; "Adviser" has hideBelow="lg" so a phone shows 7 (UI-SPEC section 2, 390 px row)
      const heads = table.locator("thead th");
      const visible = [];
      for (const th of await heads.all()) if (await th.isVisible()) visible.push((await th.textContent()).trim());
      expect(visible).toEqual(viewport.width >= 1024 ? HEADERS : HEADERS.slice(0, 7));
      expect(await heads.count(), "all 8 columns exist in the DOM").toBe(8);
      for (const th of await heads.all()) expect(await th.getAttribute("scope"), "every header cell is scope=col").toBe("col");
      await expect(table.locator("caption")).toHaveText("Students table with thirty rows");

      // sticky header
      expect(await heads.first().evaluate((el) => getComputedStyle(el).position), "sticky header").toBe("sticky");

      // sideways scrolling lives in the wrapper
      expect(await rows(table).count()).toBe(10);
      const m = await wrapper.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(doc.scroll, "the page never scrolls sideways").toBeLessThanOrEqual(doc.inner);
      if (phone) {
        expect(m.scroll, "at 390 px the table is wider than its wrapper").toBeGreaterThan(m.client + 50);
        await wrapper.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        expect(await wrapper.evaluate((el) => el.scrollLeft), "the wrapper scrolled").toBeGreaterThan(0);
        const doc2 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, x: window.scrollX }));
        expect(doc2.scroll, "page still fits after scrolling the table").toBeLessThanOrEqual(doc2.inner);
        expect(doc2.x, "page did not scroll").toBe(0);
      } else {
        expect(m.scroll, "at desktop widths the table fits").toBeLessThanOrEqual(m.client + 1);
      }
      await table.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(OUT_DIR, `table-main-${viewport.width}.png`) });
    });

    test("DataTable: sorting a column reorders rows (asc, desc, back to none) with aria-sort", async () => {
      const table = one("table-main");
      const unitsTh = table.locator("thead th", { hasText: "Units" });
      await expect(unitsTh).toHaveAttribute("aria-sort", "none");
      const before = await cells(table, 1);
      expect(before[0]).toBe("Student 01");

      await unitsTh.getByRole("button", { name: "Units" }).click();
      await expect(unitsTh).toHaveAttribute("aria-sort", "ascending");
      const asc = (await cells(table, 6)).map(Number);
      expect(asc, "ascending on page 1").toEqual([...asc].sort((a, b) => a - b));
      expect(asc[0], "the smallest value of all 30 rows comes first").toBe(1);
      expect(await cells(table, 1)).not.toEqual(before);
      await table.getByRole("button", { name: "Next" }).click();
      const asc2 = (await cells(table, 6)).map(Number);
      expect(asc2[0], "page 2 continues the sorted order").toBeGreaterThanOrEqual(asc[asc.length - 1]);
      await table.getByRole("button", { name: "Previous" }).click();

      await unitsTh.getByRole("button", { name: "Units" }).click();
      await expect(unitsTh).toHaveAttribute("aria-sort", "descending");
      const desc = (await cells(table, 6)).map(Number);
      expect(desc[0], "the largest value comes first").toBe(11);
      expect(desc).toEqual([...desc].sort((a, b) => b - a));

      await unitsTh.getByRole("button", { name: "Units" }).click();
      await expect(unitsTh).toHaveAttribute("aria-sort", "none");
      expect(await cells(table, 1)).toEqual(before);

      // keyboard: the sort control is a real button
      await unitsTh.getByRole("button", { name: "Units" }).focus();
      await unitsTh.page().keyboard.press("Enter");
      await expect(unitsTh).toHaveAttribute("aria-sort", "ascending");
      // a non-sortable column has no button and no aria-sort
      const adviserTh = table.locator("thead th", { hasText: "Adviser" });
      await expect(adviserTh.getByRole("button")).toHaveCount(0);
      expect(await adviserTh.getAttribute("aria-sort")).toBeNull();
    });

    test("DataTable: the filter narrows the rows, shows the empty state when nothing matches, clears back", async () => {
      const table = one("table-main");
      const search = table.getByRole("searchbox", { name: "Search students" });
      await expect(search).toBeVisible();
      await expect(summary(table)).toHaveText(/Showing 1.10 of 30/);

      await search.fill("mba");
      await expect(summary(table)).toHaveText(/Showing 1.8 of 8/);
      expect(await rows(table).count()).toBe(8);
      for (const program of await cells(table, 3)) expect(program).toBe("MBA");
      await expect(table.getByRole("button", { name: "Next" })).toHaveCount(0);

      await search.fill("zzzz-no-such-student");
      await expect(table.getByText("No students to show")).toBeVisible();
      await expect(table.getByText("Try a different search or filter.")).toBeVisible();
      await expect(table.locator("table")).toHaveCount(0);
      await page_screenshot(table, `table-filter-empty-${viewport.width}.png`);

      await table.getByRole("button", { name: "Clear search" }).click();
      await expect(search).toHaveValue("");
      await expect(summary(table)).toHaveText(/Showing 1.10 of 30/);
      expect(await rows(table).count()).toBe(10);
    });

    test("DataTable: pagination shows 10 per page", async () => {
      const table = one("table-main");
      await expect(summary(table)).toHaveText(/Showing 1.10 of 30/);
      const prev = table.getByRole("button", { name: "Previous" });
      const next = table.getByRole("button", { name: "Next" });
      await expect(prev).toBeDisabled();
      await expect(table.getByText("Page 1 of 3")).toBeVisible();
      const first = await cells(table, 1);
      expect(first).toHaveLength(10);
      expect(first[0]).toBe("Student 01");

      await next.click();
      await expect(summary(table)).toHaveText(/Showing 11.20 of 30/);
      expect((await cells(table, 1))[0]).toBe("Student 11");
      await next.click();
      await expect(summary(table)).toHaveText(/Showing 21.30 of 30/);
      expect(await rows(table).count()).toBe(10);
      await expect(next).toBeDisabled();
      await prev.click();
      await expect(summary(table)).toHaveText(/Showing 11.20 of 30/);
      for (const control of [prev, next]) {
        const box = await control.boundingBox();
        expect(box.height, "touch target height").toBeGreaterThanOrEqual(phone ? 43.5 : 0);
      }
    });

    test("DataTable: CSV export downloads a file with the header row and every filtered row", async ({ page }) => {
      const table = one("table-main");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        table.getByRole("button", { name: "Export CSV" }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("gallery-students.csv");
      const text = readFileSync(await download.path(), "utf8").replace(/^﻿/, "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      expect(lines[0]).toBe(HEADERS.map((h) => `"${h}"`).join(","));
      expect(lines.length, "header + all 30 rows, not just the 10 on screen").toBe(31);
      expect(lines[1]).toContain('"Student 01"');

      // the export follows the filter
      await table.getByRole("searchbox", { name: "Search students" }).fill("mba");
      const [filtered] = await Promise.all([
        page.waitForEvent("download"),
        table.getByRole("button", { name: "Export CSV" }).click(),
      ]);
      const filteredLines = readFileSync(await filtered.path(), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
      expect(filteredLines.length).toBe(9);
    });

    test("DataTable: empty state, loading skeleton, server pagination and clickable rows", async ({ page }) => {
      // empty
      const empty = one("table-empty");
      await expect(empty.getByText("No students to show")).toBeVisible();
      await expect(empty.getByText("Students will see items here once they are admitted.")).toBeVisible();
      await expect(empty.locator("tbody tr")).toHaveCount(0);

      // loading
      const loading = one("table-loading");
      await expect(loading.locator("[data-skeleton-table]")).toBeVisible();
      expect(await loading.locator("[data-skeleton-table]").evaluate((el) => el.getBoundingClientRect().height), "reserves height").toBeGreaterThan(100);

      // server mode: the caller owns paging and sorting, DataTable only reports and shows
      const server = one("table-server");
      await expect(summary(server)).toHaveText(/Showing 1.5 of 12/);
      await expect(server.locator("tbody tr")).toHaveCount(5);
      await server.getByRole("button", { name: "Next" }).click();
      await expect(summary(server)).toHaveText(/Showing 6.10 of 12/);
      await expect(server.locator("tbody tr").first()).toContainText("Server row 06");
      await server.getByRole("button", { name: "Next" }).click();
      await expect(summary(server)).toHaveText(/Showing 11.12 of 12/);
      await expect(server.locator("tbody tr")).toHaveCount(2);
      await server.locator("thead th", { hasText: "Name" }).getByRole("button", { name: "Name" }).click();
      await expect(server.locator("thead th", { hasText: "Name" })).toHaveAttribute("aria-sort", "ascending");
      await expect(page.locator('[data-case="server-sort-log"]')).toHaveText("sort: name asc");

      // clickable rows: reachable by keyboard
      const clickable = one("table-click");
      const row = clickable.locator("tbody tr").nth(1);
      expect(await row.getAttribute("tabindex")).toBe("0");
      await row.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator('[data-case="click-log"]')).toHaveText("opened: Row B");
      await clickable.locator("tbody tr").nth(2).click();
      await expect(page.locator('[data-case="click-log"]')).toHaveText("opened: Row C");
    });

    test("InlineNotice: info is blue, roles are status/alert, dismiss and icons work", async () => {
      for (const [tone, want] of Object.entries(NOTICE)) {
        const notice = one(`notice-${tone}`);
        await expect(notice, `notice ${tone}`).toBeVisible();
        expect(await notice.getAttribute("role"), `role of ${tone}`).toBe(want.role);
        const style = await notice.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
        expect(style.bg, `${tone} background`).toBe(want.bg);
        if (want.fg) expect(style.fg, `${tone} text`).toBe(want.fg);
      }
      // info and success no longer look the same (AD1)
      const infoBg = await one("notice-info").evaluate((el) => getComputedStyle(el).backgroundColor);
      const successBg = await one("notice-success").evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(infoBg).not.toBe(successBg);
      // only danger uses role=alert in the whole block
      expect(await block.locator('[data-case^="notice-"][role="alert"]').count()).toBe(2); // danger + legacy "error"
      expect(await block.locator('[data-case^="notice-"][role="status"]').count()).toBeGreaterThanOrEqual(4);
      // legacy tones still work
      expect(await one("notice-legacy-warn").getAttribute("role")).toBe("status");
      expect(await one("notice-legacy-warn").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(NOTICE.warning.bg);
      expect(await one("notice-error").getAttribute("role")).toBe("alert");
      // title, icon
      await expect(one("notice-titled").getByText("Saved to the audit log")).toBeVisible();
      await expect(one("notice-titled").locator("svg")).toHaveCount(1);
      await expect(one("notice-info").locator("svg")).toHaveCount(0);
      // dismiss
      const dismissable = one("notice-dismiss");
      await expect(dismissable).toBeVisible();
      await dismissable.getByRole("button", { name: "Dismiss" }).click();
      await expect(dismissable).toHaveCount(0);
    });

    test("Feedback: Spinner, Skeleton, EmptyState, SearchInput and Pagination render and behave", async ({ page }) => {
      const spinner = one("spinner");
      await expect(spinner).toBeVisible();
      await expect(spinner).toContainText("Loading");
      expect(await spinner.getAttribute("role")).toBe("status");
      await expect(one("spinner-sm")).toBeVisible();
      await expect(one("spinner-custom")).toContainText("Checking the roster");

      const skeleton = one("skeleton");
      await expect(skeleton).toBeVisible();
      expect(await skeleton.getAttribute("aria-busy")).toBe("true");
      expect(await skeleton.locator("[data-skeleton-line]").count()).toBe(4);

      const empty = one("empty-state");
      await expect(empty.getByText("No requests to show")).toBeVisible();
      await expect(empty.getByText("Requests will appear here once a student submits one.")).toBeVisible();
      await expect(empty.getByRole("button", { name: "Refresh" })).toBeVisible();
      await expect(one("empty-state-sm")).toBeVisible();
      const mdHeight = (await empty.boundingBox()).height;
      const smHeight = (await one("empty-state-sm").boundingBox()).height;
      expect(smHeight, "size sm is tighter than md").toBeLessThan(mdHeight);

      const search = one("search").getByRole("searchbox", { name: "Search the roster" });
      await expect(search).toBeVisible();
      expect(await search.getAttribute("type")).toBe("search");
      expect(await search.evaluate((el) => getComputedStyle(el).fontSize)).toBe(phone ? "16px" : "14px");
      await expect(one("search").getByRole("button", { name: "Clear search" })).toHaveCount(0);
      await search.fill("marites");
      await expect(page.locator('[data-case="search-value"]')).toHaveText("value: marites");
      await one("search").getByRole("button", { name: "Clear search" }).click();
      await expect(page.locator('[data-case="search-value"]')).toHaveText("value:");
      await search.fill("abc");
      await search.press("Escape");
      await expect(search).toHaveValue("");

      const pagination = one("pagination");
      await expect(pagination.getByText("Showing 21–30 of 95")).toBeVisible();
      await expect(pagination.getByText("Page 3 of 10")).toBeVisible();
      await pagination.getByRole("button", { name: "Next" }).click();
      await expect(pagination.getByText("Showing 31–40 of 95")).toBeVisible();
    });

    async function page_screenshot(locator, name) {
      mkdirSync(OUT_DIR, { recursive: true });
      await locator.page().screenshot({ path: join(OUT_DIR, name) });
    }
  });
}
