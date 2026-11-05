// e2e-writes: none
// Packet kstand (owner 2026-11-04, I-360: "lets follow that more and update our other standalone processes... it was good but just
// needs more POLISH"). Khloe's design rules (.planning/khloe-ui/COMPARE.md, "Khloe's design rules") now apply to Leave of Absence,
// Readmission, AWOL, Subject Withdrawal and Residency, for staff and for the Dean (one page template: ProcessBoardPage).
// Written BEFORE the change; red on the old cards and column headers. Read-only: nothing is saved, every write is mocked or never made.
//   - every column header has a number in a circle (1, 2, 3 ... in board order) and a line saying what the column holds;
//   - every card is Khloe's card: a facts grid with the key fact of the process, the status, the submitted and updated dates,
//     "Next: <owner>", and the buttons View ("View details for <student>") and Message ("Message <student>");
//   - a card that waits for the Dean is green and says "Ready for Dean review";
//   - the amber message box shows when the case has open messages; Message opens the case window on the note box;
//   - requirement boxes on the cards that have requirements (readmission checks, AWOL residence limit, withdrawal window);
//   - a column is as tall as its cards (an empty one is short) and "Select all in this column" sits right under the last card;
//   - 390 px: the page does not scroll sideways.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p120");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

// slug, board region name, the kind of fact on the card
const BOARDS = [
  { slug: "leave-of-absence", region: "Leave of absence board", fact: /^(Reason not given|[A-Z][\w ,'/&()-]+)$/ },
  { slug: "readmission", region: "Readmission board", fact: /^(Returning: .+|Return semester not chosen yet)$/ },
  { slug: "awol", region: "AWOL and residency board", fact: /.+/ },
  { slug: "withdrawal", region: "Subject withdrawal board", fact: /^[A-Z][\w-]* ?[\w-]* - .+|^Subject pending$/ },
];
const ROLES = [
  { role: "staff", path: (slug) => `/workflow/${slug}` },
  { role: "dean", path: (slug) => `/dean/approvals/${slug}` },
];

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

for (const { role, path } of ROLES) {
  test.describe(`standalone boards in Khloe's layout as ${role}`, () => {
    test.use({ storageState: authFile(role), viewport: { width: 1366, height: 768 } });

    for (const board of BOARDS) {
      test(`${board.slug}: numbered columns that say what they hold, and Khloe's card`, async ({ page }) => {
        await page.goto(path(board.slug));
        const region = page.getByRole("region", { name: board.region });
        await expect(region).toBeVisible();

        // Column headers: 1, 2, 3 ... in board order, and a purpose line under each title.
        const sections = region.locator(":scope section[aria-label]");
        const columns = await sections.count();
        expect(columns, "the board has stages").toBeGreaterThan(3);
        for (let i = 0; i < columns; i++) {
          const section = sections.nth(i);
          const label = await section.getAttribute("aria-label");
          await expect(section.getByTestId("stage-number"), `${label}: number ${i + 1}`).toHaveText(String(i + 1));
          const purpose = ((await section.locator("header p").first().textContent()) || "").trim();
          expect(purpose.length, `${label}: says what the column holds`).toBeGreaterThan(10);
        }

        // Cards: the shared anatomy.
        const cards = region.locator("article");
        const count = await cards.count();
        expect(count, "the demo data has cards on this board").toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          const card = cards.nth(i);
          const who = ((await card.locator("p").first().textContent()) || "").trim();
          const facts = card.getByTestId("case-facts");
          await expect(facts, `card ${i} (${who}): the facts grid`).toBeVisible();
          const key = ((await card.getByTestId("case-key-fact").textContent()) || "").trim();
          expect(key, `card ${i} (${who}): the key fact`).toMatch(board.fact);
          await expect(facts.getByTestId("case-key-fact"), "the key fact is in the grid").toHaveCount(1);
          await expect(facts, `card ${i}: the status`).toContainText(/\S/);
          await expect(card.getByText(/^Next: |^No further step$/), `card ${i}: who is next`).toBeVisible();
          await expect(card.getByRole("button", { name: `View details for ${who}`, exact: true }), `card ${i}: View`).toBeVisible();
          await expect(card.getByRole("button", { name: `View details for ${who}`, exact: true })).toHaveText("View");
          await expect(card.getByRole("button", { name: `Message ${who}`, exact: true }), `card ${i}: Message`).toBeVisible();
        }
        await shot(page, `${board.slug}-${role}-1366.png`);
      });

      test(`${board.slug}: columns are as tall as their cards, "Select all" right under the last card`, async ({ page }) => {
        await page.goto(path(board.slug));
        const region = page.getByRole("region", { name: board.region });
        await expect(region.locator("article").first()).toBeVisible();
        const sizes = await region.locator(":scope section[aria-label]").evaluateAll((nodes) =>
          nodes.map((node) => {
            const box = node.getBoundingClientRect();
            const cards = [...node.querySelectorAll("div[draggable], [data-card-id]")];
            const last = cards.length ? cards[cards.length - 1].getBoundingClientRect().bottom : 0;
            const select = [...node.querySelectorAll("button")].find((b) => /in this column$/.test(b.textContent || ""));
            return { label: node.getAttribute("aria-label"), height: box.height, cards: cards.length, gapToSelect: select ? select.getBoundingClientRect().top - last : null };
          }),
        );
        const heights = sizes.map((size) => size.height);
        const tallest = Math.max(...heights);
        for (const size of sizes) {
          // A column does not stretch to the tallest one: an empty column is short, a full one is as tall as its cards.
          if (size.cards === 0) expect(size.height, `${size.label}: an empty column is short`).toBeLessThan(Math.max(360, tallest * 0.6));
          if (size.gapToSelect !== null) expect(size.gapToSelect, `${size.label}: "Select all" right under the last card`).toBeLessThan(80);
        }
        expect(Math.min(...heights), "a sensible minimum height").toBeGreaterThan(120);
      });
    }

    test("Leave of Absence: a card that waits for the Dean is green and says so; an Extension keeps its chip", async ({ page }) => {
      await page.goto(path("leave-of-absence"));
      const region = page.getByRole("region", { name: "Leave of absence board" });
      await expect(region.locator("article").first()).toBeVisible();
      const waiting = region.locator("article").filter({ hasText: "Next: Dean" });
      expect(await waiting.count(), "the demo data has a leave request with the Dean").toBeGreaterThan(0);
      await expect(waiting.first()).toContainText("Ready for Dean review");
      await expect(waiting.first()).toHaveClass(/bg-emerald-50/);
      const others = region.locator("article").filter({ hasNotText: "Next: Dean" });
      if (await others.count()) await expect(others.first()).not.toContainText("Ready for Dean review");
    });

    test("Readmission: the cards show the return checks as requirement boxes", async ({ page }) => {
      await page.goto(path("readmission"));
      const region = page.getByRole("region", { name: "Readmission board" });
      const card = region.locator("article").first();
      await expect(card).toBeVisible();
      const boxes = card.getByLabel("Requirements for this request");
      await expect(boxes).toBeVisible();
      await expect(boxes.getByText("Written intention")).toBeVisible();
      await expect(boxes.getByText("Business Office clearance")).toBeVisible();
    });

    test("AWOL: an AWOL card shows the residence limit; a Residency card is marked Residency", async ({ page }) => {
      await page.goto(path("awol"));
      const region = page.getByRole("region", { name: "AWOL and residency board" });
      await expect(region.locator("article").first()).toBeVisible();
      await expect(region.getByLabel("Requirements for this request").first().getByText("Within the residence limits")).toBeVisible();
      const residency = region.locator("article").filter({ has: page.getByText("Residency", { exact: true }) });
      expect(await residency.count(), "the board has a residency card marked with its type").toBeGreaterThan(0);
    });

    test("Withdrawal: the cards show the withdrawal window as a requirement box", async ({ page }) => {
      await page.goto(path("withdrawal"));
      const region = page.getByRole("region", { name: "Subject withdrawal board" });
      await expect(region.locator("article").first()).toBeVisible();
      await expect(region.getByLabel("Requirements for this request").first().getByText("Within the withdrawal window")).toBeVisible();
    });

    test("the amber message box and the Message button (the case window opens on the note box)", async ({ page }) => {
      // Server fields the next packet adds: unresolved_messages is on every row today; latest_message is not (reported).
      await page.route(/\/api\/process-cases\?slug=leave-of-absence/, async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        json.cases[0].unresolved_messages = 2;
        json.cases[0].latest_message = { comment: "Please send the medical certificate before the leave starts." };
        await route.fulfill({ response, json });
      });
      await page.goto(path("leave-of-absence"));
      const region = page.getByRole("region", { name: "Leave of absence board" });
      await expect(region.locator("article").first()).toBeVisible();
      const card = region.locator("article").filter({ hasText: "2 visible messages" }).first();
      await expect(card).toBeVisible();
      await expect(card).toContainText("Please send the medical certificate");
      const who = ((await card.locator("p").first().textContent()) || "").trim();
      await card.getByRole("button", { name: `Message ${who}`, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Note" })).toBeFocused();
      await page.keyboard.press("Escape");
    });
  });
}

test.describe("standalone boards at 1920 and 390 px", () => {
  for (const { role, path } of ROLES) {
    for (const board of BOARDS) {
      test(`${board.slug} as ${role}: 1920 and 390`, async ({ browser }) => {
        const context = await browser.newContext({ storageState: authFile(role), viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();
        await page.goto(path(board.slug));
        await expect(page.getByRole("region", { name: board.region }).locator("article").first()).toBeVisible();
        await shot(page, `${board.slug}-${role}-1920.png`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(path(board.slug));
        const first = page.locator('[data-testid="stage-board"] article').first();
        await expect(first).toBeVisible();
        await expect(first.getByTestId("case-facts")).toBeVisible();
        await expect(first.getByRole("button", { name: /^Message / })).toBeVisible();
        expect(await noOverflow(page), `${board.slug} at 390 px scrolls sideways`).toBeLessThanOrEqual(1);
        await shot(page, `${board.slug}-${role}-390.png`);
        await context.close();
      });
    }
  }
});
