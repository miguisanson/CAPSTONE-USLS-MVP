// Component gallery proof for packet P1f (Phase 5, UI-SPEC section 4 "DecisionPanel" and "HistoryPanel" rows, sections 5
// and 8; ideas X-04 and X-05). Opens /__ui at 1366, 1920 and 390 and checks the P1f block (data-gallery="p1f"):
//   DecisionPanel (the one widget for the EXISTING approve / return / reject actions - it adds no action):
//     - only the actions the caller passes are shown, in the order given; approve = .btn-primary, return = .btn-ghost,
//       reject = .btn-danger;
//     - ONE comment box; return and reject need a comment: with none (or only spaces) the click is blocked, the handler is
//       NOT called, a field error is shown (role="alert"), the box is marked invalid and takes the focus; typing clears it;
//     - approve needs no comment and calls the handler exactly once with the trimmed comment;
//     - reject asks for confirmation in a Modal first (the safe button, Cancel, has the focus); Cancel calls nothing;
//     - keyboard only: type, Tab through the buttons, Enter - nothing needs the mouse, and the focus goes back to the
//       button after the confirm closes;
//     - a disabled action shows why (hint); `busy` disables everything; `validate` can block (the Adviser form's
//       "tick the exception"); an `error` prop shows a danger notice;
//     - at 390 the buttons are full width, at least 44 px tall, and nothing leaves the viewport.
//   HistoryPanel (one history / audit trail list; HistoryDisclosure is rebuilt on it):
//     - entries are listed newest first (whatever order the caller sends them in) with title, actor and role, a <time>,
//       the note, and a from -> to change as two status chips;
//     - the toggle shows a count, is keyboard operable, aria-expanded follows it; an empty trail says so; `limit` shows
//       the newest N and a "Show all" button; the old HistoryDisclosure (free children) keeps its labels and look.
// No console error, failed API call or horizontal overflow at any width. Screenshots are saved.
// Needs a build made with VITE_UI_GALLERY=1 (`npm run e2e` does that). Read-only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

const OUT_DIR = join(SCREENS_DIR, "ui-gallery-p1f");
const REQUIRED = "Add a comment so the student knows what to fix.";

for (const viewport of VIEWPORTS) {
  test.describe(`P1f gallery block (DecisionPanel, HistoryPanel) at ${viewport.width}px`, () => {
    const phone = viewport.width < 640;
    let block;
    let tracker;

    test.beforeEach(async ({ page, context }) => {
      tracker = { problems: [], writes: [], where: { role: "admin", page: "UI gallery P1f", viewport: viewport.width } };
      await stubExternal(context);
      attachWatchers(page, tracker);
      await checkPage(page, tracker, { role: "admin", href: "/__ui?decision-error=1", label: "UI gallery P1f", viewport, outDir: OUT_DIR });
      block = page.locator('[data-gallery="p1f"]');
      await expect(block, "the P1f block is missing from /__ui (UiGallery.jsx must render it)").toBeVisible();
    });

    test.afterEach(async () => {
      // The sweep calls any visible role="alert" an error banner. Exempt the pre-existing gallery text ("danger notice",
      // the tones block) and this block's one deliberate danger sample, which mounts only on ?decision-error=1.
      const exempt = (p) => /error banner visible: (danger notice|P1f danger sample)/.test(p.problem);
      const report = formatProblems(tracker.problems.filter((p) => !exempt(p)));
      expect(report, report.join("\n")).toEqual([]);
    });

    const one = (name) => block.locator(`[data-case="${name}"]`);
    const css = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
    const box = async (loc) => {
      const b = await loc.boundingBox();
      expect(b, "element has a box").not.toBeNull();
      return b;
    };
    /** The decision log under a panel: how many times its handler ran and with what. */
    const log = (name) => one(name);
    const calls = async (name) => Number(await log(name).getAttribute("data-calls"));

    test("DecisionPanel: only the passed actions, in order, styled approve / return / reject, one comment box", async () => {
      const panel = one("decision-main");
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Dean decision")).toBeVisible();
      await expect(panel.getByText("Maria Santos")).toBeVisible();
      const buttons = panel.getByRole("button");
      await expect(buttons, "exactly the three passed actions, no extra button").toHaveCount(3);
      await expect(buttons.nth(0)).toHaveText("Approve");
      await expect(buttons.nth(1)).toHaveText("Return for revision");
      await expect(buttons.nth(2)).toHaveText("Deny request");
      await expect(buttons.nth(0)).toHaveClass(/btn-primary/);
      await expect(buttons.nth(1)).toHaveClass(/btn-ghost/);
      await expect(buttons.nth(2)).toHaveClass(/btn-danger/);
      expect(await css(buttons.nth(2), "background-color"), "reject is red-600").toBe("rgb(220, 38, 38)");
      for (const b of await buttons.all()) {
        expect((await box(b)).height, "button height").toBeGreaterThanOrEqual(phone ? 44 : 40);
        expect((await box(b)).x + (await box(b)).width, "inside the viewport").toBeLessThanOrEqual(viewport.width);
      }
      // one comment box with a visible label; its limit is 2000
      const comment = panel.getByRole("textbox", { name: /Comment for the student/ });
      await expect(comment).toHaveCount(1);
      await expect(panel.locator("textarea")).toHaveCount(1);
      expect(await comment.getAttribute("maxlength")).toBe("2000");
      await expect(panel.getByText(/Required to return for revision or deny request/)).toBeVisible();
      // the card variant has the card border, the plain one has none
      expect(await css(panel, "border-top-width")).toBe("1px");
      expect(await css(one("decision-plain"), "border-top-width")).toBe("0px");
      if (phone) {
        const p = await box(panel);
        for (const b of await buttons.all()) {
          const bb = await box(b);
          expect(bb.width, "full-width buttons below sm").toBeGreaterThan(p.width - 60);
        }
      } else {
        const first = await box(buttons.nth(0));
        const second = await box(buttons.nth(1));
        expect(Math.abs(first.y - second.y), "one row from sm up").toBeLessThan(2);
      }
    });

    test("DecisionPanel: return needs a comment - blocked with a field error, handler not called", async () => {
      const panel = one("decision-main");
      const comment = panel.getByRole("textbox", { name: /Comment for the student/ });
      const ret = panel.getByRole("button", { name: "Return for revision" });
      await expect(log("decision-main-log")).toHaveAttribute("data-calls", "0");

      await ret.click();
      expect(await calls("decision-main-log"), "blocked: no handler call").toBe(0);
      const err = panel.getByText(REQUIRED);
      await expect(err).toBeVisible();
      await expect(err).toHaveAttribute("role", "alert");
      await expect(comment).toHaveAttribute("aria-invalid", "true");
      await expect(comment, "the focus goes to the box that needs the comment").toBeFocused();
      await expect(comment, "the invalid border is red").toHaveClass(/border-red-400/);
      expect(await comment.getAttribute("aria-describedby")).toContain(await err.getAttribute("id"));

      // spaces only is still no comment
      await comment.fill("    ");
      await ret.click();
      expect(await calls("decision-main-log")).toBe(0);
      await expect(err).toBeVisible();

      // typing clears the error
      await comment.fill("Fix the title page");
      await expect(err).toHaveCount(0);
      await expect(comment).not.toHaveAttribute("aria-invalid", "true");

      // with a comment the handler runs once, with the TRIMMED text
      await comment.fill("  Fix the title page  ");
      await ret.click();
      await expect(log("decision-main-log")).toHaveAttribute("data-calls", "1");
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "return|Fix the title page");
      await expect(comment, "the box is emptied after a decision").toHaveValue("");
    });

    test("DecisionPanel: approve calls the handler once, no comment needed, no confirmation", async ({ page }) => {
      const panel = one("decision-main");
      await panel.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByRole("dialog"), "approve asks nothing").toHaveCount(0);
      await expect(log("decision-main-log")).toHaveAttribute("data-calls", "1");
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "approve|");
      await expect(panel.getByText(REQUIRED)).toHaveCount(0);
      // an approve note is passed along, trimmed
      await panel.getByRole("textbox").fill(" Looks complete ");
      await panel.getByRole("button", { name: "Approve" }).click();
      await expect(log("decision-main-log")).toHaveAttribute("data-calls", "2");
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "approve|Looks complete");
    });

    test("DecisionPanel: reject asks for confirmation in a Modal; Cancel calls nothing", async ({ page }) => {
      const panel = one("decision-main");
      const comment = panel.getByRole("textbox");
      const reject = panel.getByRole("button", { name: "Deny request" });

      await reject.click();
      expect(await calls("decision-main-log"), "reject without a comment is blocked before any confirmation").toBe(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(panel.getByText(REQUIRED)).toBeVisible();

      await comment.fill("Outside the policy window");
      await reject.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Deny request?" })).toBeVisible();
      await expect(dialog).toContainText("The student is told and cannot send this request again.");
      expect(await calls("decision-main-log"), "nothing is decided while the question is open").toBe(0);
      await expect(dialog.getByRole("button", { name: "Cancel" }), "the safe button has the focus").toBeFocused();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      expect(await calls("decision-main-log"), "Cancel decides nothing").toBe(0);
      await expect(comment, "the comment is kept after Cancel").toHaveValue("Outside the policy window");

      await reject.click();
      await page.getByRole("dialog").getByRole("button", { name: "Deny request" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(log("decision-main-log")).toHaveAttribute("data-calls", "1");
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "reject|Outside the policy window");
    });

    test("DecisionPanel: works with the keyboard only", async ({ page }) => {
      const panel = one("decision-main");
      const comment = panel.getByRole("textbox");
      await comment.focus();
      await page.keyboard.type("Fix the title page");
      await page.keyboard.press("Tab");
      await expect(panel.getByRole("button", { name: "Approve" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(panel.getByRole("button", { name: "Return for revision" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "return|Fix the title page");
      expect(await calls("decision-main-log"), "one Enter = one decision").toBe(1);

      // reject: comment, Tab to the button, Enter, confirm with the keyboard
      await comment.focus();
      await page.keyboard.type("Not eligible");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const reject = panel.getByRole("button", { name: "Deny request" });
      await expect(reject).toBeFocused();
      await page.keyboard.press("Space");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Deny request" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(log("decision-main-log")).toHaveAttribute("data-last", "reject|Not eligible");
      expect(await calls("decision-main-log")).toBe(2);
      await expect(reject, "the focus goes back to the button").toBeFocused();

      // Escape closes the confirm without deciding
      await comment.focus();
      await page.keyboard.type("Again");
      await reject.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await calls("decision-main-log")).toBe(2);
    });

    test("DecisionPanel: plain variant, disabled action with its reason, Cancel, validate, busy, long labels, error", async ({ page }) => {
      // plain: single enabled action + a disabled one that says why + Cancel
      const plain = one("decision-plain");
      const approve = plain.getByRole("button", { name: "Endorse and sign" });
      const blocked = plain.getByRole("button", { name: "Deny request" });
      await expect(plain.locator("textarea"), "withComment={false}: no comment box").toHaveCount(0);
      await expect(blocked).toBeDisabled();
      await expect(plain.getByText("Sign the form first.")).toBeVisible();
      await expect(blocked).toHaveAttribute("aria-describedby", /.+/);
      await approve.click();
      await expect(log("decision-plain-log")).toHaveAttribute("data-last", "endorse|");
      await plain.getByRole("button", { name: "Cancel" }).click();
      await expect(log("decision-plain-log")).toHaveAttribute("data-cancelled", "1");

      // validate: the Adviser form's "tick the exception first" blocks the approve, before any call
      const val = one("decision-validate");
      await val.getByRole("button", { name: "Appoint adviser" }).click();
      await expect(val.getByText("Tick the Dean's exception to appoint another advisee.")).toBeVisible();
      expect(await calls("decision-validate-log")).toBe(0);
      await val.getByRole("checkbox").check();
      await val.getByRole("button", { name: "Appoint adviser" }).click();
      await expect(val.getByText("Tick the Dean's exception")).toHaveCount(0);
      await expect(log("decision-validate-log")).toHaveAttribute("data-last", "appoint|");
      // a minimum length applies too (3 characters)
      const note = one("decision-validate").getByRole("textbox", { name: /Reason for returning/ });
      await val.getByRole("button", { name: "Return application" }).click();
      await note.fill("no");
      await val.getByRole("button", { name: "Return application" }).click();
      await expect(val.getByText("Give the reason this application is not approved. The student will see it.")).toBeVisible();

      // busy: every action disabled, nothing can be pressed
      const busy = one("decision-busy");
      for (const b of await busy.getByRole("button").all()) await expect(b).toBeDisabled();
      await expect(busy.getByRole("textbox")).toBeDisabled();

      // long labels never leave the panel
      const long = one("decision-long");
      const lp = await box(long);
      expect(lp.x + lp.width).toBeLessThanOrEqual(viewport.width);
      for (const b of await long.getByRole("button").all()) {
        const bb = await box(b);
        expect(bb.x + bb.width, "long button label stays inside the panel").toBeLessThanOrEqual(lp.x + lp.width + 1);
        expect(bb.x).toBeGreaterThanOrEqual(lp.x - 1);
      }

      // an error from the caller shows as a danger notice, the buttons stay usable
      const failed = one("decision-error");
      const notice = failed.getByRole("alert");
      await expect(notice).toContainText("P1f danger sample");
      await expect(failed.getByRole("button", { name: "Approve" })).toBeEnabled();

      // a handler that throws is caught and shown (the panel keeps working)
      const bad = one("decision-throws");
      await bad.getByRole("button", { name: "Approve" }).click();
      await expect(bad.getByRole("alert")).toContainText("The server refused that step.");
      await expect(bad.getByRole("button", { name: "Approve" })).toBeEnabled();
      await page.waitForTimeout(50);
    });

    test("HistoryPanel: newest first, actor, role, time, note, status change; count; keyboard", async ({ page }) => {
      const main = one("history-main");
      await expect(main).toBeVisible();
      const toggle = main.getByRole("button", { name: /history/i }).first();
      await expect(toggle).toHaveAttribute("aria-expanded", "true"); // defaultOpen
      await expect(toggle).toContainText("Hide history");
      await expect(toggle.getByText("3", { exact: true }), "count bubble").toBeVisible();
      const items = main.locator("ol > li");
      await expect(items).toHaveCount(3);
      // sent B, A, C (not in time order); shown C, B, A
      await expect(items.nth(0)).toContainText("Returned for revision");
      await expect(items.nth(1)).toContainText("Sent to the Dean");
      await expect(items.nth(2)).toContainText("Filed by the student");

      const first = items.nth(0);
      await expect(first.locator("time")).toHaveAttribute("datetime", "2026-08-07T09:45:00Z");
      await expect(first.locator("time")).toHaveText(/2026/);
      await expect(first).toContainText("Dean Reyes (Dean)");
      const chips = first.locator("[data-status-tone]");
      await expect(chips).toHaveCount(2);
      await expect(chips.nth(0)).toHaveText("Dean Review");
      await expect(chips.nth(1)).toHaveText("Returned");
      await expect(first).toContainText("The title page does not match");
      expect(await css(first.getByText("The title page does not match"), "white-space"), "notes keep their line breaks").toBe("pre-wrap");
      // an entry with only a "to" status shows one chip; one with no change shows none
      await expect(items.nth(2).locator("[data-status-tone]")).toHaveCount(1);
      // the entry look: rounded-xl, hairline border, tinted
      expect(await css(first, "border-top-width")).toBe("1px");
      expect(await css(first, "border-top-left-radius")).toBe("14px");
      for (const li of await items.all()) {
        const b = await box(li);
        expect(b.x + b.width, "entry inside the viewport").toBeLessThanOrEqual(viewport.width);
      }

      // keyboard: the collapsed one opens with Enter and closes with Space
      const collapsed = one("history-collapsed");
      const t2 = collapsed.getByRole("button", { name: /View history/ });
      await expect(t2).toHaveAttribute("aria-expanded", "false");
      await expect(collapsed.locator("ol")).toHaveCount(0);
      await expect(t2.getByText("2", { exact: true })).toBeVisible();
      await t2.focus();
      await page.keyboard.press("Enter");
      await expect(collapsed.getByRole("button", { name: /Hide history/ })).toHaveAttribute("aria-expanded", "true");
      await expect(collapsed.locator("ol > li")).toHaveCount(2);
      await page.keyboard.press("Space");
      await expect(collapsed.locator("ol")).toHaveCount(0);
    });

    test("HistoryPanel: empty sentence, limit with Show all, a title, the old HistoryDisclosure unchanged", async () => {
      const empty = one("history-empty");
      await expect(empty.getByText("Nothing has happened on this record yet.")).toBeVisible();
      await expect(empty.locator("ol")).toHaveCount(0);

      const limited = one("history-limit");
      await expect(limited.getByText("Stage history")).toBeVisible(); // title
      await expect(limited.locator("ol > li")).toHaveCount(3);
      await expect(limited.locator("ol > li").first()).toContainText("Step 8");
      const more = limited.getByRole("button", { name: /Show all 8/ });
      await expect(more).toBeVisible();
      if (phone) expect((await box(more)).height).toBeGreaterThanOrEqual(44);
      await more.click();
      await expect(limited.locator("ol > li")).toHaveCount(8);
      await expect(limited.getByRole("button", { name: /Show all/ })).toHaveCount(0);

      // HistoryDisclosure keeps its props and look
      const legacy = one("history-legacy");
      const toggle = legacy.getByRole("button", { name: /View logs/ });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle.getByText("4", { exact: true })).toBeVisible();
      expect(await css(toggle, "border-top-left-radius")).toBe("14px");
      expect(await css(toggle, "font-weight")).toBe("600");
      expect(await css(toggle, "padding-top")).toBe("10px");
      expect(await toggle.getAttribute("aria-controls"), "the toggle names the region it opens").toBeTruthy();
      await toggle.click();
      await expect(legacy.getByRole("button", { name: /Hide logs/ })).toHaveAttribute("aria-expanded", "true");
      await expect(legacy.getByText("Free-form children go here.")).toBeVisible();
    });

    test("whole P1f block fits the viewport and is screenshotted", async ({ page }) => {
      const b = await box(block);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(1);
      await block.screenshot({ path: join(OUT_DIR, `p1f-block-${viewport.width}.png`) });
    });
  });
}
