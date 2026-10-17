// Component gallery proof for packet P1b (Phase 5, UI-SPEC sections 3, 3a and 4): StatusChip, Button, Card /
// SectionCard and Field / Input / Select / Textarea. Opens /__ui at 1366, 1920 and 390 and checks the P1b block of
// the gallery (data-gallery="p1b"): every tone, every button variant and size, every card padding, each field type;
// no console error, failed API call or horizontal overflow; screenshots saved.
// Needs a build made with VITE_UI_GALLERY=1 (`npm run e2e` does that). Read-only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const OUT_DIR = join(SCREENS_DIR, "ui-gallery-p1b");
const px = (n) => `${n}px`;

// Tone colours from lib/tone.js (brand-50/700, amber-50/800, red-50/700, blue-50/700, slate-100/700) as computed rgb().
const TONE_COLORS = {
  success: { bg: "rgb(237, 250, 241)", fg: "rgb(12, 97, 56)" },
  warning: { bg: "rgb(255, 251, 235)", fg: "rgb(146, 64, 14)" },
  danger: { bg: "rgb(254, 242, 242)", fg: "rgb(185, 28, 28)" },
  info: { bg: "rgb(239, 246, 255)", fg: "rgb(29, 78, 216)" },
  neutral: { bg: "rgb(241, 245, 249)", fg: "rgb(51, 65, 85)" },
};

for (const viewport of VIEWPORTS) {
  test(`P1b gallery block (StatusChip, Button, Card, Field) is complete and clean at ${viewport.width}px`, async ({ page, context }) => {
    const phone = viewport.width < 640;
    const tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery P1b [/__ui?field-error=1]", viewport: viewport.width } };
    await stubExternal(context);
    attachWatchers(page, tracker);
    await checkPage(page, tracker, { role: "admin", href: "/__ui?field-error=1", label: "UI gallery P1b", viewport, outDir: OUT_DIR });

    const block = page.locator('[data-gallery="p1b"]');
    await expect(block, "the P1b block is missing from /__ui (UiGallery.jsx must render it)").toBeVisible();
    const one = (name) => block.locator(`[data-case="${name}"]`);
    const style = (name, props) =>
      one(name).evaluate((el, names) => {
        const s = getComputedStyle(el);
        return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]));
      }, props);

    // --- StatusChip: every tone, both sizes, the server-tone fallback, long text, empty ------------------------
    const chipCases = {
      "chip-approved": "success",
      "chip-returned": "warning",
      "chip-denied": "danger",
      "chip-submitted": "info",
      "chip-notstarted": "neutral",
      "chip-sm-approved": "success",
      "chip-nodot": "success",
      "chip-server-warn": "warning", // unknown string + tone="warn" -> warning
      "chip-unmapped": "neutral", // unknown string, no tone -> neutral
      "chip-long": "danger",
      "chip-label": "success", // label overrides the visible words, tone still follows status
    };
    for (const [name, tone] of Object.entries(chipCases)) {
      await expect(one(name), `${name} is missing`).toBeVisible();
      await expect(one(name), `${name} tone`).toHaveAttribute("data-status-tone", tone);
      const s = await style(name, ["background-color", "color", "white-space"]);
      expect(s["background-color"], `${name} background`).toBe(TONE_COLORS[tone].bg);
      expect(s.color, `${name} text colour`).toBe(TONE_COLORS[tone].fg);
      expect(s["white-space"], `${name} never wraps`).toBe("nowrap");
    }
    await expect(one("chip-approved")).toHaveText("Approved");
    await expect(one("chip-label")).toHaveText("Approved by Dean");
    expect((await style("chip-approved", ["font-size"]))["font-size"]).toBe(px(12));
    expect((await style("chip-sm-approved", ["font-size"]))["font-size"]).toBe(px(11));
    await expect(one("chip-approved").locator("span")).toHaveCount(1); // the dot
    await expect(one("chip-nodot").locator("span")).toHaveCount(0);
    const longBox = await one("chip-long").boundingBox();
    expect(longBox.height, "a long status stays on one line").toBeLessThan(28);
    expect(longBox.x + longBox.width, "a long status stays inside the viewport").toBeLessThanOrEqual(viewport.width);
    await expect(one("chip-empty")).toHaveText("—"); // no status -> a dash, not an empty pill
    await expect(one("chip-empty")).not.toHaveAttribute("data-status-tone", /.+/);

    // --- Button: variants, sizes, icon, loading, disabled, link --------------------------------------------------
    const bgOf = async (name) => (await style(name, ["background-color"]))["background-color"];
    expect(await bgOf("btn-primary-md")).toBe("rgb(15, 122, 68)"); // brand-600
    expect(await bgOf("btn-secondary-md")).toBe("rgb(255, 255, 255)");
    expect(await bgOf("btn-danger-md")).toBe("rgb(220, 38, 38)"); // red-600
    for (const name of ["btn-primary-md", "btn-secondary-md", "btn-danger-md"]) {
      const box = await one(name).boundingBox();
      expect(box.height, `${name} touch height`).toBeGreaterThanOrEqual(phone ? 44 : 40);
      expect((await style(name, ["font-size"]))["font-size"], `${name} font`).toBe(px(14));
    }
    for (const name of ["btn-primary-sm", "btn-secondary-sm", "btn-danger-sm"]) {
      expect((await style(name, ["font-size"]))["font-size"], `${name} font`).toBe(px(12));
      const box = await one(name).boundingBox();
      if (phone) expect(box.height, `${name} touch height on a phone`).toBeGreaterThanOrEqual(44);
      else expect(box.height, `${name} is the compact size`).toBeLessThan(36);
    }
    const iconBox = await one("btn-icon").boundingBox();
    expect([Math.round(iconBox.width), Math.round(iconBox.height)], "icon button size").toEqual(phone ? [44, 44] : [40, 40]);
    await expect(one("btn-icon")).toHaveAttribute("aria-label", "Search");
    await expect(one("btn-icon-danger")).toHaveAttribute("aria-label", "Delete");
    await expect(one("btn-loading")).toBeDisabled();
    await expect(one("btn-loading")).toHaveAttribute("aria-busy", "true");
    await expect(one("btn-loading").locator(".animate-spin")).toHaveCount(1);
    await expect(one("btn-disabled")).toBeDisabled();
    await expect(one("btn-icon-text").locator("svg")).toHaveCount(1);
    expect(await one("btn-link").evaluate((el) => el.tagName)).toBe("A");
    await expect(one("btn-link")).toHaveAttribute("href", "#p1b-link");
    expect(await bgOf("btn-link")).toBe("rgb(15, 122, 68)");
    expect(await one("btn-plain").getAttribute("type"), "a Button defaults to type=button so it never submits a form").toBe("button");

    // --- Card / SectionCard ---------------------------------------------------------------------------------
    const pad = async (name) => parseFloat((await style(name, ["padding-top"]))["padding-top"]);
    expect(await pad("card-md")).toBe(phone ? 16 : 20);
    expect(await pad("card-sm")).toBe(12);
    expect(await pad("card-lg")).toBe(phone ? 20 : 24);
    expect(await pad("card-none")).toBe(0);
    const cardStyle = await style("card-md", ["border-top-left-radius", "background-color"]);
    expect(cardStyle["border-top-left-radius"]).toBe(px(18)); // rounded-2xl (1.125rem in tailwind.config.js)
    expect(cardStyle["background-color"]).toBe("rgb(255, 255, 255)");
    expect((await style("card-interactive", ["cursor"])).cursor).toBe("pointer");
    await expect(one("section-card").getByRole("heading", { level: 2, name: "Section card title" })).toBeVisible();
    await expect(one("section-card")).toContainText("Section card subtitle");
    await expect(one("section-card")).toContainText("Section card body");
    await expect(one("section-card").getByRole("button", { name: "Card action" })).toBeVisible();

    // --- Field / Input / Select / Textarea ----------------------------------------------------------------
    const fieldFont = phone ? px(16) : px(14);
    const name = block.getByLabel("Full name");
    await expect(name).toBeVisible();
    await expect(name).toHaveAttribute("aria-required", "true");
    const hintId = await name.getAttribute("aria-describedby");
    expect(hintId, "Input is described by the Field hint").toBeTruthy();
    await expect(block.locator(`[id="${hintId}"]`)).toContainText("As on the enrollment form");
    expect(await name.evaluate((el) => getComputedStyle(el).fontSize)).toBe(fieldFont);

    const email = block.getByLabel("Email address");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const errorId = await email.getAttribute("aria-describedby");
    expect(errorId, "Input is described by the Field error").toBeTruthy();
    const error = block.locator(`[id="${errorId}"]`);
    await expect(error).toHaveText("Enter a valid email address.");
    await expect(error).toHaveAttribute("role", "alert");
    expect(await email.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe("rgb(248, 113, 113)"); // red-400

    const program = block.getByLabel("Program");
    expect(await program.evaluate((el) => el.tagName)).toBe("SELECT");
    await expect(program.locator("option").first()).toHaveText("Select…");
    await expect(program.locator("option")).toHaveCount(4);
    expect(await program.evaluate((el) => getComputedStyle(el).fontSize)).toBe(fieldFont);

    const notes = block.getByLabel("Notes");
    expect(await notes.evaluate((el) => el.tagName)).toBe("TEXTAREA");
    expect(await notes.getAttribute("rows")).toBe("3");
    await expect(notes).not.toHaveAttribute("aria-invalid", "true");

    // --- the sweep's own rules: no console error, no overflow, no error banner ------------------------------------
    // The Field error (role="alert") and the red danger buttons are on this page on purpose; the sweep would call
    // the alert an "error banner", so that one text is exempt. Everything else must be clean.
    const exempt = (p) => /error banner visible: (danger notice|Enter a valid email address\.)/.test(p.problem);
    const report = formatProblems(tracker.problems.filter((p) => !exempt(p)));
    expect(report, report.join("\n")).toEqual([]);
  });
}
