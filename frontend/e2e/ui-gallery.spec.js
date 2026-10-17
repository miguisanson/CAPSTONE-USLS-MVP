// Component gallery proof (Phase 5, UI-SPEC section 4 "Component proof"). Opens /__ui at 1366, 1920 and 390 and
// checks what the design contract promises: the type scale, the button classes, 16px inputs on phones, the page
// width cap and the z-index scale; no console error, failed API call or horizontal overflow; screenshots saved.
//
// P1a delivers the tokens and classes, so this spec asserts those and is green. Each later packet (P1b-P1f) adds
// its component to pages/UiGallery.jsx and EXTENDS this file with checks for it (chips, modal, table, ...).
// The route only exists in a build made with VITE_UI_GALLERY=1: `npm run e2e` does that (scripts/e2e.mjs --build).
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const px = (n) => `${n}px`;
const OUT_DIR = join(SCREENS_DIR, "ui-gallery");

/** Computed style of the first element matching `selector`. */
const computed = (page, selector, props) =>
  page.locator(selector).first().evaluate((el, names) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]));
  }, props);

for (const viewport of VIEWPORTS) {
  test(`gallery renders the tokens cleanly at ${viewport.width}px`, async ({ page, context }) => {
    const tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery [/__ui]", viewport: viewport.width } };
    await stubExternal(context);
    attachWatchers(page, tracker);

    // Opens the page, waits for it to settle, checks overflow and error banners, saves the screenshot.
    await checkPage(page, tracker, { role: "admin", href: "/__ui", label: "UI gallery", viewport, outDir: OUT_DIR });
    await expect(page.locator('[data-gallery="page-title"]'), "the /__ui route did not render (build without VITE_UI_GALLERY=1?)").toBeVisible();

    // --- type scale: six steps + eyebrow -----------------------------------------------------------------
    const type = async (name) => computed(page, `[data-type="${name}"]`, ["font-size", "font-weight", "text-transform", "font-family"]);
    const pageTitle = await type("page-title");
    expect(pageTitle["font-size"]).toBe(px(24));
    expect(pageTitle["font-weight"]).toBe("600");
    expect(pageTitle["font-family"]).toContain("Poppins");
    expect((await type("section-title"))["font-size"]).toBe(px(18));
    expect((await type("card-title"))["font-size"]).toBe(px(16));
    expect((await type("body"))["font-size"]).toBe(px(14));
    expect((await type("meta"))["font-size"]).toBe(px(12));
    expect((await type("micro"))["font-size"]).toBe(px(11));
    const eyebrow = await type("eyebrow");
    expect(eyebrow["font-size"]).toBe(px(12));
    expect(eyebrow["text-transform"]).toBe("uppercase");
    expect(eyebrow["font-weight"]).toBe("600");

    // --- buttons -----------------------------------------------------------------------------------------
    const bg = async (name) => (await computed(page, `[data-btn="${name}"]`, ["background-color"]))["background-color"];
    expect(await bg("primary")).toBe("rgb(15, 122, 68)"); // brand-600
    expect(await bg("danger")).toBe("rgb(220, 38, 38)"); // red-600
    expect(await bg("ghost")).toBe("rgb(255, 255, 255)");
    await expect(page.locator('[data-btn="icon"]')).toHaveAttribute("aria-label", "Search");
    const icon = await page.locator('[data-btn="icon"]').boundingBox();
    const side = viewport.width < 640 ? 44 : 40; // 44px on phones, 40px from sm up
    expect([Math.round(icon.width), Math.round(icon.height)], "btn-icon size").toEqual([side, side]);
    await expect(page.locator('[data-btn="disabled"]')).toBeDisabled();

    // --- fields: 16px on phones (no iOS zoom), 14px from sm up -----------------------------------------
    const fieldSize = viewport.width < 640 ? px(16) : px(14);
    expect((await computed(page, '[data-field="input"]', ["font-size"]))["font-size"]).toBe(fieldSize);
    expect((await computed(page, '[data-field="select"]', ["font-size"]))["font-size"]).toBe(fieldSize);

    // --- layout tokens -----------------------------------------------------------------------------------
    const root = await page.locator('[data-gallery="root"]').boundingBox();
    expect(Math.round(root.width), "max-w-page caps the content at 1440px").toBe(Math.min(viewport.width, 1440));
    const stack = await computed(page, '[data-gallery="page-stack"]', ["display", "flex-direction", "row-gap"]);
    expect(stack).toEqual({ display: "flex", "flex-direction": "column", "row-gap": px(20) });
    const z = await page.locator("[data-z]").evaluateAll((els) => Object.fromEntries(els.map((el) => [el.dataset.z, getComputedStyle(el).zIndex])));
    expect(z).toEqual({ "z-header": "30", "z-drawer": "40", "z-modal": "100", "z-confirm": "110", "z-toast": "120" });

    // --- the four 'all clear' rules of the sweep ----------------------------------------------------------
    // The danger-tone notice swatch is red on purpose and looks like an ErrorNote, which the sweep treats as a failure.
    const report = formatProblems(tracker.problems.filter((p) => p.problem !== "error banner visible: danger notice"));
    expect(report, report.join("\n")).toEqual([]);
  });
}

// Owed by later packets (see UI-SPEC section 8). Listed here so the gallery spec shows what it will have to cover.
test.fixme("gallery shows StatusChip, Card, Field (P1b), Modal and Drawer (P1c), DataTable and Feedback (P1d), PageHeader, StatCard and Stepper (P1e), DecisionPanel and HistoryPanel (P1f) with a long-text and an empty case", async () => {});
