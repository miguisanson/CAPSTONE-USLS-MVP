// Packet conC (owner rule IM24; issues I-123, I-126, part of I-128; consistency sweep 2026-10-22, findings 2, 6 and 13).
// Every page under /workflow/<slug> is one family. Written BEFORE the change; red on the old code. Through the real UI as
// Graduate School staff, read-only (windows are opened and closed, nothing is saved). Order-independent: no seeded count or
// card position is assumed; the page is compared with what the API answered at the same moment.
//   - finding 2: "How this works" and "View recent activity" are the two buttons in the page header of every workflow page,
//     and there is no "How this works" / "Recent in this workflow" card in a side rail or under the page;
//   - finding 6: the Practicum and Graduation boards carry the same summary line (a count per column, and how to move a
//     card) as the process boards, every column has a one-line description, a card has "View details" and no inline
//     primary button;
//   - finding 13: a card held by the Dean shows a lock on every process board unless the server lists a step for staff
//     there (Withdrawal: "Return to student"), so the screen matches the server on every board.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p91");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");
const cardsOf = (scope) => scope.locator("div[draggable]");

const WORKFLOW_PAGES = [
  "student-handoff",
  "course-audit",
  "research-gate?student_id=146",
  "panel-matching?student_id=125",
  "defense-scheduling?student_id=146",
  "practicum",
  "graduation",
  "leave-of-absence",
  "readmission",
  "awol",
  "withdrawal",
];

const BOARDS = [
  ["leave-of-absence", "Leave of absence board"],
  ["readmission", "Readmission board"],
  ["awol", "AWOL and residency board"],
  ["withdrawal", "Subject withdrawal board"],
  ["practicum", "Practicum workflow board"],
  ["graduation", "Graduation workflow Kanban board"],
];

test.describe("conC: one place for the guide and the activity", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const path of WORKFLOW_PAGES) {
    test(`/workflow/${path}: the guide and the activity open from the two header buttons and nowhere else`, async ({ page }) => {
      await page.goto(`/workflow/${path}`);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      const header = main(page).locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }).first();
      for (const name of ["How this works", "View recent activity"]) {
        await expect(header.getByRole("button", { name, exact: true }), `${name}: in the page header`).toHaveCount(1);
        await expect(main(page).getByRole("button", { name, exact: true }), `${name}: once on the page`).toHaveCount(1);
      }
      // No second copy of either as a card: not in a side rail, not under the page.
      await expect(main(page).getByRole("heading", { name: /^(How this works|Recent in this workflow|Recent activity)$/ }), "no rail card").toHaveCount(0);

      await header.getByRole("button", { name: "How this works", exact: true }).click();
      const guide = page.getByRole("dialog");
      await expect(guide).toBeVisible();
      await expect(guide.getByRole("heading").first()).toContainText(/works/i);
      await expect(guide.getByText("Purpose", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await header.getByRole("button", { name: "View recent activity", exact: true }).click();
      const activity = page.getByRole("dialog");
      await expect(activity).toBeVisible();
      await expect(activity.getByRole("heading").first()).toContainText(/activity/i);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
});

test.describe("conC: the six boards have the same parts", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [slug, region] of BOARDS) {
    test(`${slug}: summary line, column descriptions, and cards with "View details" only`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: region });
      await expect(board).toBeVisible();

      // The summary line: "<n> <column>, <n> <column>" for the cards that exist, and how to move a card.
      const summary = page.getByTestId("board-summary");
      await expect(summary, "one summary block").toHaveCount(1);
      const line = summary.locator("[data-summary-line]");
      await expect(line).toBeVisible();
      const lineText = ((await line.textContent()) || "").trim();
      expect(lineText, "a count per column, or 'No ... yet'").toMatch(/^\d+ .+$|^No .+ yet$/);
      await expect(summary).toContainText("Move to");
      // The numbers add up to the cards on the board (nothing is filtered at page load).
      const cards = cardsOf(board);
      const total = [...lineText.matchAll(/(?:^|, )(\d+) /g)].reduce((sum, match) => sum + Number(match[1]), 0);
      expect(total, `"${lineText}" adds up to the cards on the board`).toBe(await cards.count());

      // Every column has a one-line description under its title.
      const sections = board.locator(":scope section[aria-label]");
      const columnCount = await sections.count();
      expect(columnCount).toBeGreaterThan(3);
      for (let i = 0; i < columnCount; i++) {
        const label = await sections.nth(i).getAttribute("aria-label");
        const description = ((await sections.nth(i).locator("header p").first().textContent().catch(() => "")) || "").trim();
        expect(description.length, `${label}: has a description line`).toBeGreaterThan(0);
        expect(description.length, `${label}: description is one short line`).toBeLessThanOrEqual(90);
      }

      // A card: "View details" is the only button apart from "Move to...", and there is no inline primary button.
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const buttons = card.getByRole("button");
        const names = await buttons.evaluateAll((nodes) => nodes.map((node) => ({ name: node.getAttribute("aria-label") || node.textContent.trim(), text: node.textContent.trim(), primary: node.classList.contains("btn-primary") })));
        const view = names.filter((item) => /^View details for /.test(item.name));
        expect(view.length, `card ${i}: one View details button`).toBe(1);
        expect(view[0].text, `card ${i}: the button says "View details"`).toBe("View details");
        for (const item of names) {
          expect(item.primary, `card ${i}: "${item.name}" is a primary button on a card`).toBe(false);
          expect(/^View details for /.test(item.name) || /^Move to/.test(item.text), `card ${i}: unexpected button "${item.name}"`).toBe(true);
        }
      }
      await page.mouse.move(0, 0);
      await page.screenshot({ path: join(SHOTS, `${slug}-1366.png`), fullPage: true });
    });
  }
});

test.describe("conC: a card held by the Dean", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [slug, region] of BOARDS.slice(0, 4)) {
    test(`${slug}: staff see a lock unless the server lists a step for staff`, async ({ page }) => {
      const answer = page.waitForResponse((response) => response.url().includes(`/api/process-cases?slug=${slug}`) && response.ok());
      await page.goto(`/workflow/${slug}`);
      const data = await (await answer).json();
      const board = page.getByRole("region", { name: region });
      await expect(board).toBeVisible();
      const deanKey = (data.vocabulary.columns[slug] || []).find((column) => column.key === "dean")?.key;
      test.skip(!deanKey, `${slug} has no Dean column`);
      const deanStatuses = data.vocabulary.columns[slug].find((column) => column.key === "dean").statuses;
      const held = data.cases.filter((item) => deanStatuses.includes(item.status));
      test.skip(held.length === 0, "no case is with the Dean right now");
      for (const item of held) {
        const card = cardsOf(board).filter({ hasText: item.student.name }).first();
        await expect(card, `${item.student.name} is on the board`).toBeVisible();
        if ((item.actions || []).length === 0) {
          await expect(card.getByText("Waiting for: Dean", { exact: true }), `${item.student.name}: the reason`).toBeVisible();
          await expect(card.locator("svg.lucide-lock")).toBeVisible();
          await expect(card.getByRole("button", { name: /Move to/ })).toHaveCount(0);
        } else {
          // The server lists a real step for staff here: the card offers it and has no lock.
          await expect(card.getByRole("button", { name: /Move to/ }), `${item.student.name}: staff have ${item.actions.map((a) => a.label).join(", ")}`).toBeVisible();
          await expect(card.locator("svg.lucide-lock")).toHaveCount(0);
        }
      }
    });
  }
});
