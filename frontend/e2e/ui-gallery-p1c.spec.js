// P1c proof (Phase 5, UI-SPEC section 4 "Modal" row and section 5 "Modals"): Modal sizes sm/md/lg/xl, Drawer and the
// ConfirmProvider that is built on Modal. Opens each one from the /__ui gallery at 1366x768 and 390x844 and checks:
//   - the panel fits the viewport; header and footer stay put while the body scrolls; the footer button is reachable;
//   - Escape closes and focus goes back to the button that opened it; Tab and Shift+Tab never leave the dialog;
//   - ONE backdrop covers the WHOLE viewport (I-040: a ~20 px strip at the top used to stay uncovered);
//   - a destructive confirm does not confirm on Enter (AD1); a non-destructive one still does;
//   - a confirm over a modal sits one z-level up, Escape closes only the top one, the page does not scroll behind.
// The route only exists in a build made with VITE_UI_GALLERY=1: `npm run e2e` does that.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const OUT_DIR = join(SCREENS_DIR, "ui-gallery");
const VIEWS = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
];
// max-w-md, max-w-xl, max-w-3xl, max-w-6xl in px.
const MAX_WIDTH = { sm: 448, md: 576, lg: 768, xl: 1152 };

const opener = (page, key) => page.locator(`[data-open="${key}"]`);
const backdrop = (page) => page.locator("[data-modal-backdrop]");

/** What is at the point (x, y), as "backdrop" / "dialog" / "page". */
async function whatIsAt(page, x, y) {
  return page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return "nothing";
    if (el.closest('[role="dialog"]')) return "dialog";
    if (el.closest("[data-modal-backdrop]")) return "backdrop";
    return `page:${el.tagName}.${String(el.className).slice(0, 40)}`;
  }, [x, y]);
}

/** Every corner, every edge midpoint and a spot 5 px from the top: nothing of the page may show through. */
async function expectFullBackdrop(page, vp) {
  const points = [
    [5, 5], [Math.round(vp.width / 2), 5], [vp.width - 5, 5],
    [5, Math.round(vp.height / 2)], [vp.width - 5, Math.round(vp.height / 2)],
    [5, vp.height - 5], [Math.round(vp.width / 2), vp.height - 5], [vp.width - 5, vp.height - 5],
  ];
  for (const [x, y] of points) {
    const hit = await whatIsAt(page, x, y);
    expect(["backdrop", "dialog"], `element at (${x}, ${y}) is ${hit}, the backdrop must cover the whole viewport`).toContain(hit);
  }
}

async function expectInsideViewport(box, vp, what) {
  expect(box, `${what} has a box`).toBeTruthy();
  expect(box.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(box.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width, `${what} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box.y + box.height, `${what} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

/** Tab (or Shift+Tab) more times than the dialog has controls: focus must always stay inside it. */
async function expectFocusTrapped(page, dialog, presses = 14) {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < presses; i += 1) {
      await page.keyboard.press(key);
      const inside = await dialog.evaluate((root) => root.contains(document.activeElement));
      expect(inside, `${key} #${i + 1} moved focus out of the dialog`).toBe(true);
    }
  }
}

for (const vp of VIEWS) {
  test.describe(`Modal, Drawer and ConfirmProvider at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test.beforeEach(async ({ page, context }, info) => {
      await stubExternal(context);
      info.tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery modals", viewport: vp.width } };
      attachWatchers(page, info.tracker);
      await page.goto("/__ui");
      await expect(page.locator('[data-gallery="page-title"]'), "the /__ui route did not render (build without VITE_UI_GALLERY=1?)").toBeVisible();
      await page.locator('[data-gallery="modals"]').scrollIntoViewIfNeeded();
    });

    test.afterEach(async ({}, info) => {
      const report = formatProblems(info.tracker.problems);
      expect(report, report.join("\n")).toEqual([]);
    });

    for (const size of ["sm", "md", "lg", "xl"]) {
      test(`Modal ${size}: fits, scrolls inside, keeps header and footer, closes on Escape and returns focus`, async ({ page }) => {
        mkdirSync(OUT_DIR, { recursive: true });
        const open = opener(page, size);
        await open.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        const titleId = await dialog.getAttribute("aria-labelledby");
        expect(titleId, "aria-labelledby").toBeTruthy();
        await expect(page.locator(`[id="${titleId}"]`)).toHaveText(new RegExp(`Modal ${size}`));
        await page.waitForTimeout(450); // let the fade-up animation finish before measuring

        // 1. size: capped by the size's max width and by the viewport gutter (p-3 below sm, p-6 from sm up)
        const box = await dialog.boundingBox();
        await expectInsideViewport(box, vp, `Modal ${size}`);
        const gutter = vp.width < 640 ? 24 : 48;
        expect(Math.round(box.width), `Modal ${size} width`).toBe(Math.min(MAX_WIDTH[size], vp.width - gutter));
        // the long content makes it as tall as it may be: at most 90% of the viewport
        expect(box.height, "height is bounded").toBeLessThanOrEqual(vp.height * 0.9 + 1);

        // 2. one backdrop that covers the whole viewport (I-040)
        await expect(backdrop(page)).toHaveCount(1);
        expect(await backdrop(page).boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
        await expectFullBackdrop(page, vp);
        await page.screenshot({ path: join(OUT_DIR, `modal-${size}-${vp.width}.png`) });

        // 3. the body scrolls, the header and the footer do not
        const body = dialog.locator("[data-modal-body]");
        const header = dialog.locator("[data-modal-header]");
        const footer = dialog.locator("[data-modal-footer]");
        const metrics = await body.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, overflowY: getComputedStyle(el).overflowY }));
        expect(metrics.overflowY, "body overflow-y").toBe("auto");
        expect(metrics.scroll, "the long content is taller than the body").toBeGreaterThan(metrics.client + 50);
        const headerBefore = await header.boundingBox();
        const footerBefore = await footer.boundingBox();
        await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        expect(await body.evaluate((el) => el.scrollTop), "the body scrolled").toBeGreaterThan(0);
        expect(await header.boundingBox(), "header stays put").toEqual(headerBefore);
        expect(await footer.boundingBox(), "footer stays put").toEqual(footerBefore);
        await expectInsideViewport(footerBefore, vp, "footer");

        // 4. the footer button is reachable and works (the last line of the content is also reachable)
        const save = footer.getByRole("button", { name: "Save changes" });
        await save.scrollIntoViewIfNeeded();
        const saveBox = await save.boundingBox();
        await expectInsideViewport(saveBox, vp, "Save button");
        await expect(dialog.locator("[data-last-line]")).toBeInViewport();
        // below sm the footer buttons are full width and stacked, primary first
        if (vp.width < 640) {
          const cancelBox = await footer.getByRole("button", { name: "Cancel" }).boundingBox();
          expect(Math.round(saveBox.width), "footer button is full width on phones").toBeGreaterThan(vp.width - 80);
          expect(saveBox.y, "primary button on top when stacked").toBeLessThan(cancelBox.y);
          expect(saveBox.height, "touch target >= 44px below sm").toBeGreaterThanOrEqual(43.5);
        }

        // 5. Tab and Shift+Tab never leave the dialog
        await expectFocusTrapped(page, dialog);

        // 6. Escape closes, and focus goes back to the button that opened it
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(open).toBeFocused();
        await expect(backdrop(page)).toHaveCount(0);
        expect(await page.evaluate(() => document.body.style.overflow), "page scroll restored").not.toBe("hidden");
      });
    }

    test("Modal: a short body is not stretched; the X button, a backdrop click and Cancel close it", async ({ page }) => {
      const open = opener(page, "short");
      await open.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(450);
      const box = await dialog.boundingBox();
      expect(box.height, "a short modal is much shorter than the viewport").toBeLessThan(vp.height * 0.7);
      // description is wired up when there is a subtitle
      const describedBy = await dialog.getAttribute("aria-describedby");
      expect(describedBy, "aria-describedby (subtitle exists)").toBeTruthy();
      await expect(page.locator(`[id="${describedBy}"]`)).toContainText("Subtitle");
      await expect(backdrop(page)).toHaveCount(1);

      // the first control of the body has the focus (not the page behind)
      expect(await dialog.evaluate((root) => root.contains(document.activeElement)), "focus moved into the dialog").toBe(true);

      // X button
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toBeHidden();
      await expect(open).toBeFocused();

      // backdrop click
      await open.click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeHidden();
      await expect(open).toBeFocused();

      // a click inside the panel does not close it
      await open.click();
      await expect(dialog).toBeVisible();
      await dialog.locator("[data-modal-body]").click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    });

    test("Modal dismissible={false} (saving): Escape, the backdrop and the X button do nothing", async ({ page }) => {
      const open = opener(page, "locked");
      await open.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Close" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Finish saving" }).click(); // the demo's way out
      await expect(dialog).toBeHidden();
      await expect(open).toBeFocused();
    });

    test("I-040: the backdrop covers the whole viewport even when the opener sits inside a space-y parent", async ({ page }) => {
      // `.space-y-5 > * + *` puts margin-top: 20px on every later child, and a `fixed inset-0` backdrop that was rendered in
      // place inherited it: 20 px of the sticky header stayed uncovered. The Modal must not depend on where it is rendered.
      const open = opener(page, "space-y");
      await expect(page.locator('[data-gallery="space-y-host"]')).toHaveClass(/space-y-5/);
      await open.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(450);
      expect(await backdrop(page).boundingBox(), "backdrop starts at the very top-left corner").toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
      expect(await backdrop(page).evaluate((el) => getComputedStyle(el).marginTop), "no inherited margin").toBe("0px");
      await expectFullBackdrop(page, vp);
      // and it is above the sticky page header (z-header) and everything else on the page
      const z = await backdrop(page).evaluate((el) => getComputedStyle(el).zIndex);
      expect(Number(z), "backdrop z-index is the modal layer (100)").toBe(100);
      await page.keyboard.press("Escape");
    });

    for (const side of ["right", "left"]) {
      test(`Drawer ${side}: full height, covers the viewport, traps focus, Escape closes, focus returns`, async ({ page }) => {
        const open = opener(page, `drawer-${side}`);
        await open.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAccessibleName(new RegExp(`Drawer ${side}`));
        await page.waitForTimeout(450);
        const box = await dialog.boundingBox();
        await expectInsideViewport(box, vp, `Drawer ${side}`);
        expect(Math.round(box.height), "a drawer is as tall as the viewport").toBe(vp.height);
        if (side === "left") expect(Math.round(box.x), "left drawer touches the left edge").toBe(0);
        else expect(Math.round(box.x + box.width), "right drawer touches the right edge").toBe(vp.width);
        expect(await backdrop(page).boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
        expect(Number(await backdrop(page).evaluate((el) => getComputedStyle(el).zIndex)), "drawer layer is z-drawer (40)").toBe(40);
        await expectFullBackdrop(page, vp);
        expect(await dialog.evaluate((root) => root.contains(document.activeElement)), "focus moved into the drawer").toBe(true);
        await expectFocusTrapped(page, dialog, 8);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(open).toBeFocused();
      });
    }

    test("Drawer: a click on the backdrop closes it", async ({ page }) => {
      const open = opener(page, "drawer-right");
      await open.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.mouse.click(5, Math.round(vp.height / 2));
      await expect(dialog).toBeHidden();
      await expect(open).toBeFocused();
    });

    test("Confirm (AD1): Enter does NOT confirm a destructive dialog; Cancel is focused; the red button confirms", async ({ page }) => {
      const open = opener(page, "confirm-danger");
      const result = page.locator('[data-gallery="confirm-result"]');
      await open.click();
      const dialog = page.getByRole("dialog", { name: "Remove this record?" });
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(450);
      await expectInsideViewport(await dialog.boundingBox(), vp, "confirm");
      await expectFullBackdrop(page, vp);
      expect(Math.round((await dialog.boundingBox()).width), "confirm is a size-sm modal").toBe(Math.min(MAX_WIDTH.sm, vp.width - (vp.width < 640 ? 24 : 48)));
      await page.screenshot({ path: join(OUT_DIR, `confirm-danger-${vp.width}.png`) });
      // the safe button has the focus when a destructive dialog opens
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
      // red confirm button (the pointer is parked at the corner first: where the opener was clicked it can hover this button, hover = red-700)
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400); // the hover colour fades out over the button transition
      const bg = await dialog.getByRole("button", { name: "Remove record" }).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, "destructive confirm button is red-600").toBe("rgb(220, 38, 38)");
      await page.keyboard.press("Enter");
      await expect(dialog).toBeHidden();
      await expect(result).not.toHaveText(/confirmed/);
      await expect(result).toHaveText("cancelled");
      await expect(open).toBeFocused();

      // Enter with the focus anywhere else in the dialog (here: the body) must not confirm either
      await open.click();
      await expect(dialog).toBeVisible();
      await dialog.locator("[data-modal-body]").click();
      await page.keyboard.press("Enter");
      await expect(result).not.toHaveText(/confirmed/);

      // the red button confirms
      if (await dialog.isVisible()) {
        await dialog.getByRole("button", { name: "Remove record" }).click();
        await expect(result).toHaveText("confirmed");
      } else {
        await open.click();
        await dialog.getByRole("button", { name: "Remove record" }).click();
        await expect(result).toHaveText("confirmed");
      }
      await expect(dialog).toBeHidden();
    });

    test("Confirm: Escape and the backdrop cancel; a normal confirm has the primary button focused and Enter confirms", async ({ page }) => {
      const result = page.locator('[data-gallery="confirm-result"]');
      const open = opener(page, "confirm");
      await open.click();
      const dialog = page.getByRole("dialog", { name: "Set as the current semester?" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Enrollment, course adjustments");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(result).toHaveText("cancelled");

      await open.click();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeHidden();
      await expect(result).toHaveText("cancelled");

      await open.click();
      await expect(dialog.getByRole("button", { name: "Set as current" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeHidden();
      await expect(result).toHaveText("confirmed");
      await expect(open).toBeFocused();
    });

    test("Nested: a confirm over a modal is one z-level up, Escape closes only the top one, focus unwinds, scroll stays locked", async ({ page }) => {
      const open = opener(page, "nested");
      const result = page.locator('[data-gallery="confirm-result"]');
      await open.click();
      const modal = page.getByRole("dialog", { name: "Modal with a confirm" });
      await expect(modal).toBeVisible();
      const askButton = modal.getByRole("button", { name: "Discard draft" });
      await askButton.click();
      const confirm = page.getByRole("dialog", { name: "Discard this draft?" });
      await expect(confirm).toBeVisible();
      await page.waitForTimeout(450);
      const zs = await page.locator("[data-modal-backdrop]").evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).zIndex)));
      expect(zs.sort((a, b) => a - b), "modal 100, confirm 110").toEqual([100, 110]);
      // the confirm is on top of the modal at its own spot
      expect(await whatIsAt(page, Math.round(vp.width / 2), Math.round(vp.height / 2))).toBe("dialog");
      expect(await confirm.evaluate((root) => root.contains(document.activeElement)), "focus is in the confirm").toBe(true);
      await expectFocusTrapped(page, confirm, 6);
      // Escape closes the confirm only
      await page.keyboard.press("Escape");
      await expect(confirm).toBeHidden();
      await expect(modal).toBeVisible();
      await expect(result).toHaveText("cancelled");
      await expect(askButton).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow), "scroll stays locked while the first modal is open").toBe("hidden");
      // Escape again closes the modal and focus returns to the very first opener
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
      await expect(open).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    });
  });
}
