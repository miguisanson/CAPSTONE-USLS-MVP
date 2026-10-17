// P1e proof (Phase 5, UI-SPEC section 4 "PageHeader", "StatCard", "Stepper" rows, sections 5 and 8; idea X-02):
// opens /__ui at 1366, 1920 and 390 and checks the P1e block of the gallery (data-gallery="p1e"):
//   - PageHeader: one title class (.page-title), a long title with three actions fits at 390 with the actions
//     wrapped under the title, a back link, a badge, a title-only header; nothing leaves the viewport;
//   - StatCard: md and sm sizes, the tone tint, `to` makes the whole tile a link, `badge` shows a StatusChip,
//     a 2-column grid at 390 with equal-height tiles;
//   - Stepper: a wrapping row from sm up and a vertical list at 390 (orientation="auto"), an <ol>, aria-current="step"
//     on the current step only, an sr-only state word on every step, returned / denied states, a stopped chip
//     for an off-track stage (LOA) built by lib/stages.js stageSteps().
// No console error, failed API call or horizontal overflow; screenshots saved. Needs the VITE_UI_GALLERY=1 build
// (`npm run e2e` makes it). Read-only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const OUT_DIR = join(SCREENS_DIR, "ui-gallery-p1e");
const px = (n) => `${n}px`;
const LIFECYCLE = ["Admission", "Coursework", "Comprehensive Exam", "Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense"];

for (const viewport of VIEWPORTS) {
  test(`P1e gallery block (PageHeader, StatCard, Stepper) is complete and clean at ${viewport.width}px`, async ({ page, context }) => {
    const phone = viewport.width < 640;
    const tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery P1e [/__ui]", viewport: viewport.width } };
    await stubExternal(context);
    attachWatchers(page, tracker);
    await checkPage(page, tracker, { role: "admin", href: "/__ui", label: "UI gallery P1e", viewport, outDir: OUT_DIR });

    const block = page.locator('[data-gallery="p1e"]');
    await expect(block, "the P1e block is missing from /__ui (UiGallery.jsx must render it)").toBeVisible();
    const one = (name) => block.locator(`[data-case="${name}"]`);
    const box = async (loc) => {
      const b = await loc.boundingBox();
      expect(b, "element has a box").not.toBeNull();
      return b;
    };
    const css = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

    // --- the gallery's own heading is now the PageHeader: the page's one h1 ---------------------------------------
    const h1 = page.locator("h1");
    await expect(h1, "the gallery has exactly one h1, from PageHeader").toHaveCount(1);
    await expect(h1).toHaveText("UI gallery");
    await expect(h1).toHaveClass(/page-title/);
    expect(await css(h1, "font-size")).toBe(px(24));
    expect(await css(h1, "font-weight")).toBe("600");

    // --- PageHeader --------------------------------------------------------------------------------------------
    const long = one("header-long");
    const longTitle = long.getByRole("heading", { level: 2 });
    await expect(longTitle, "level={2}: only the page's own header is an h1").toHaveClass(/page-title/);
    await expect(longTitle).toContainText("Dissertation proposal defense scheduling");
    await expect(long.locator('[data-slot="badge"]')).toBeVisible();
    await expect(long.locator('[data-slot="description"]')).toBeVisible();
    const actions = long.locator('[data-slot="actions"]');
    await expect(actions.getByRole("button")).toHaveCount(3);
    const lh = await box(long);
    const title = await box(longTitle);
    const act = await box(actions);
    expect(act.x + act.width, "actions stay inside the header").toBeLessThanOrEqual(lh.x + lh.width + 1);
    expect(lh.x + lh.width, "header stays inside the viewport").toBeLessThanOrEqual(viewport.width);
    for (const b of await actions.getByRole("button").all()) {
      const bb = await box(b);
      expect(bb.x + bb.width, "each action is inside the viewport").toBeLessThanOrEqual(viewport.width);
      if (phone) expect(bb.height, "action touch height on phones").toBeGreaterThanOrEqual(44);
    }
    if (phone) {
      expect(act.y, "at 390 the actions sit under the title").toBeGreaterThanOrEqual(title.y + title.height - 1);
      expect(act.x, "stacked actions start at the left edge of the header").toBeLessThanOrEqual(lh.x + 2);
    } else {
      expect(act.y, "from sm up the actions sit beside the title").toBeLessThan(title.y + title.height);
      expect(act.x, "actions are to the right of the title block").toBeGreaterThan(title.x + 200);
    }
    // icon tile: hidden below sm, 44px from sm up
    const tile = long.locator('[data-slot="icon"]');
    if (phone) await expect(tile).toBeHidden();
    else {
      const tb = await box(tile);
      expect([Math.round(tb.width), Math.round(tb.height)]).toEqual([44, 44]);
    }

    const back = one("header-back");
    const backLink = back.locator('[data-slot="back"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveText(/Students/);
    expect(await backLink.getAttribute("href")).toBe("/students");
    if (phone) expect((await box(backLink)).height, "back link touch height").toBeGreaterThanOrEqual(44);

    const min = one("header-min");
    await expect(min.getByRole("heading", { level: 2 })).toHaveText("Title only");
    await expect(min.locator('[data-slot="actions"]')).toHaveCount(0);
    await expect(min.locator('[data-slot="description"]')).toHaveCount(0);

    // --- StatCard ----------------------------------------------------------------------------------------------
    const grid = one("stat-grid");
    const cards = grid.locator("[data-stat]");
    await expect(cards).toHaveCount(7);
    const first = await box(cards.nth(0));
    const second = await box(cards.nth(1));
    const third = await box(cards.nth(2));
    expect(Math.abs(first.y - second.y), "the first two stat cards share a row").toBeLessThan(2);
    if (phone) expect(third.y, "2 columns at 390: the third card wraps").toBeGreaterThan(first.y + first.height - 1);
    expect(Math.abs(first.height - second.height), "tiles in a row have equal height").toBeLessThan(2);
    for (let i = 0; i < 7; i++) {
      const b = await box(cards.nth(i));
      expect(b.x + b.width, `stat ${i} inside the viewport`).toBeLessThanOrEqual(viewport.width);
    }

    const md = grid.locator('[data-stat="md"]');
    expect(await css(md.locator('[data-slot="value"]'), "font-size")).toBe(px(24));
    expect(await css(md.locator('[data-slot="label"]'), "text-transform")).toBe("uppercase");
    await expect(md.locator('[data-slot="label"]')).toHaveText("Active students");
    const sm = grid.locator('[data-stat="sm"]');
    expect(await css(sm.locator('[data-slot="value"]'), "font-size")).toBe(px(16));
    // tone tint on the icon tile: success (brand-50) vs danger (red-50); legacy "amber" = warning
    expect(await css(grid.locator('[data-stat="tone-success"] [data-slot="icon"]'), "background-color")).toBe("rgb(237, 250, 241)");
    expect(await css(grid.locator('[data-stat="tone-danger"] [data-slot="icon"]'), "background-color")).toBe("rgb(254, 242, 242)");
    expect(await css(grid.locator('[data-stat="tone-legacy"] [data-slot="icon"]'), "background-color")).toBe("rgb(255, 251, 235)");
    // `to` makes the whole tile a link
    const linked = grid.locator("a[data-stat]");
    await expect(linked).toHaveCount(1);
    expect(await linked.getAttribute("href")).toBe("/students");
    await expect(linked).toContainText("Active students");
    // badge: the value is a status chip, not a big number
    const badge = grid.locator('[data-stat="badge"]');
    await expect(badge.locator("[data-status-tone]")).toHaveText("On Track");
    await expect(badge.locator("[data-status-tone]")).toHaveAttribute("data-status-tone", "success");
    expect(await css(badge.locator("[data-status-tone]"), "font-size")).not.toBe(px(24));
    // long label/value never leave the tile
    const longCard = grid.locator('[data-stat="long"]');
    const lb = await box(longCard);
    const lv = await box(longCard.locator('[data-slot="value"]'));
    expect(lv.x + lv.width, "a long value stays inside its tile").toBeLessThanOrEqual(lb.x + lb.width + 1);

    // --- Stepper: lifecycle (Proposal Defense) -------------------------------------------------------------------
    const life = one("stepper-lifecycle");
    const list = life.locator("ol");
    await expect(list).toHaveCount(1);
    const items = list.locator("> li");
    await expect(items).toHaveCount(8);
    for (let i = 0; i < 8; i++) await expect(items.nth(i)).toContainText(LIFECYCLE[i]);
    const current = list.locator('[aria-current="step"]');
    await expect(current, "exactly one step is the current one").toHaveCount(1);
    await expect(current).toContainText("Proposal Defense");
    await expect(current.locator(".sr-only")).toHaveText(/Current/);
    await expect(items.nth(0).locator(".sr-only")).toHaveText(/Complete/);
    await expect(items.nth(7).locator(".sr-only")).toHaveText(/Upcoming/);
    const i0 = await box(items.nth(0));
    const i1 = await box(items.nth(1));
    const i7 = await box(items.nth(7));
    if (phone) {
      expect(i1.y, "vertical at 390: each step under the last").toBeGreaterThan(i0.y + i0.height - 1);
      expect(Math.abs(i1.x - i0.x), "vertical steps share a left edge").toBeLessThan(2);
    } else {
      expect(i1.x, "horizontal from sm up: the second step is to the right of the first").toBeGreaterThan(i0.x + 40);
      expect(Math.abs(i1.y - i0.y), "the first two steps share a row").toBeLessThan(2);
      expect(i7.x + i7.width, "a wrapping row stays inside the viewport").toBeLessThanOrEqual(viewport.width);
    }
    // the dot is 24px
    const dot = items.nth(0).locator('[data-slot="dot"]');
    const db = await box(dot);
    expect([Math.round(db.width), Math.round(db.height)]).toEqual([24, 24]);

    // --- Stepper: states (returned, denied) and compact ---------------------------------------------------------
    const states = one("stepper-states");
    const st = (n) => states.locator(`[data-state="${n}"]`);
    await expect(st("complete")).toHaveCount(1);
    await expect(st("returned")).toHaveCount(1);
    await expect(st("denied")).toHaveCount(1);
    await expect(st("upcoming")).toHaveCount(1);
    await expect(st("returned").locator(".sr-only")).toHaveText(/Returned/);
    await expect(st("denied").locator(".sr-only")).toHaveText(/Denied/);
    await expect(st("returned")).toContainText("Needs a revised draft"); // hint
    await expect(states.locator('[aria-current="step"]')).toHaveCount(0); // none of these is `current`
    expect(await css(st("returned").locator('[data-slot="dot"]'), "border-top-color")).toBe("rgb(245, 158, 11)"); // amber-500
    expect(await css(st("denied").locator('[data-slot="dot"]'), "border-top-color")).toBe("rgb(239, 68, 68)"); // red-500
    const compact = one("stepper-compact");
    await expect(compact.locator("ol > li")).toHaveCount(3);
    await expect(compact.getByText("Hint hidden in compact")).toHaveCount(0);

    // --- Stepper: off-track stage -> stopped chip ---------------------------------------------------------------
    const off = one("stepper-offtrack");
    await expect(off.locator("ol")).toHaveCount(1);
    await expect(off.locator('[aria-current="step"]')).toHaveCount(0);
    const stopped = off.locator('li[data-state="stopped"]');
    await expect(stopped, "an off-track stage shows one stopped step").toHaveCount(1);
    await expect(stopped.locator(".sr-only")).toHaveText(/Stopped/);
    const chip = stopped.locator("[data-status-tone]");
    await expect(chip).toHaveText("LOA");
    await expect(chip).toHaveAttribute("data-status-tone", "warning"); // lib/status.js: LOA = warning
    const sb = await box(stopped);
    expect(sb.x + sb.width, "the stopped chip stays inside the viewport").toBeLessThanOrEqual(viewport.width);
    // AWOL is the same shape in the danger tone, Completed has no stopped step
    await expect(one("stepper-awol").locator('li[data-state="stopped"] [data-status-tone]')).toHaveAttribute("data-status-tone", "danger");
    await expect(one("stepper-completed").locator('li[data-state="stopped"]')).toHaveCount(0);
    await expect(one("stepper-completed").locator('li[data-state="complete"]')).toHaveCount(9);
    // a title names the list for assistive technology
    const labelled = await off.locator("ol").getAttribute("aria-labelledby");
    expect(labelled, "the list is labelled by the title").toBeTruthy();
    await expect(off.locator(`[id="${labelled}"]`)).toHaveText("Student lifecycle");

    // --- the sweep's own rules: no console error, no overflow, no error banner ---------------------------------
    const report = formatProblems(tracker.problems);
    expect(report, report.join("\n")).toEqual([]);

    // keep a clean screenshot of just this block for the review
    await block.screenshot({ path: join(OUT_DIR, `p1e-block-${viewport.width}.png`) });
  });
}
