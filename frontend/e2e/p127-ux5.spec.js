// e2e-writes: none
// Packet ux5 (owner: "better user experience, animations"): gate card line, student Research card, phone filter chips, motion.
// Written BEFORE the change; red on the old code. Reads only.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, AUTH_DIR } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const shots = join(ARTIFACTS_DIR, "screens", "p127-ux5");
test.beforeAll(() => mkdirSync(shots, { recursive: true }));
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("Research Gate card: 'n of m done · Still to do: A, B +k more'", async ({ page }) => {
    await page.goto("/workflow/research-gate");
    const cards = page.locator("main article");
    await expect(cards.first()).toBeVisible();
    const texts = await cards.allTextContents();
    expect(texts.join(" ")).not.toMatch(/requirements ·|Missing:/);
    for (const text of texts) {
      expect(text).toMatch(/\d+ of \d+ done · (Nothing left|Still to do: .+)/);
      const todo = text.match(/Still to do: (.+?)(?:View|Open|$)/);
      if (todo) expect((todo[1].match(/ \+\d+ more/g) || []).length).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: join(shots, "gate-1366.png"), fullPage: true });
  });

  test("a board card lifts a little on hover (transform + shadow, motion-safe)", async ({ page }) => {
    await page.goto("/workflow/awol");
    const card = page.locator("[data-card-id]").first();
    await expect(card).toBeVisible();
    await card.hover();
    await page.waitForTimeout(300);
    const transform = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(transform, "lifted by translateY").not.toBe("none");
  });

  test("reduced motion cuts the dialog animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/workflow/awol");
    await page.locator("[data-card-id]").first().getByRole("button", { name: /^View details for / }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const seconds = await dialog.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(seconds).toBeLessThan(0.01);
  });
});

test.describe("phone filter chips", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("three chips with counts; default is Needs my action when it has cards", async ({ page }) => {
    await page.goto("/workflow/awol");
    const list = page.getByRole("region", { name: "AWOL and residency board" });
    await expect(list).toBeVisible();
    const chips = page.getByRole("group", { name: "Filter cards" });
    const mine = chips.getByRole("button", { name: /^Needs my action \(\d+\)$/ });
    const others = chips.getByRole("button", { name: /^Waiting on others \(\d+\)$/ });
    const finished = chips.getByRole("button", { name: /^Finished \(\d+\)$/ });
    await expect(mine).toBeVisible();
    await expect(others).toBeVisible();
    await expect(finished).toBeVisible();
    const count = async (b) => Number((await b.innerText()).match(/\((\d+)\)/)[1]);
    const nMine = await count(mine);
    if (nMine > 0) {
      await expect(mine).toHaveAttribute("aria-pressed", "true");
      await expect(list.locator("div[draggable]")).toHaveCount(nMine);
    }
    await others.click();
    await expect(others).toHaveAttribute("aria-pressed", "true");
    await expect(list.locator("div[draggable]")).toHaveCount(await count(others));
    await finished.click();
    await expect(list.locator("div[draggable]")).toHaveCount(await count(finished));
    await page.screenshot({ path: join(shots, "chips-390.png") });
  });
});

// The student home Research card keeps I-087 (stage in the figure, status chip in the sub-line); p82 pins it.

test.describe("I-370 Field", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 1366, height: 900 } });

  test("a control's accessible name is its label, not the hint or the error", async ({ page }) => {
    await page.goto("/__ui");
    await expect(page.getByRole("textbox", { name: "Full name *", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Notes", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Full name *", exact: true })).toHaveAccessibleDescription("As on the enrollment form");
  });
});
