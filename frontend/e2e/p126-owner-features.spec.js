// e2e-writes: none
// Owner requests 2026-11-08 (screens):
//   - after an export the portal opens a pre-filled Gmail draft (To: the Registrar) and the export window keeps
//     "Open Gmail" / "Use my mail app instead" buttons;
//   - Graduation and Withdrawal show the history of exported lists;
//   - a "Needs your action" row not opened yet is green with "New" until it is opened;
//   - a board card that moved by itself is green ("Moved here · new") until it is touched.
// Read-only against the data: the export answer is mocked, the rest only reads and clicks.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const BOARD = "Graduation workflow Kanban board";
const BATCH = "Batch 1 October 2026";
const byName = (roster, name) => roster.find((row) => row.student.name === name);
const cardsOf = (scope) => scope.locator("div[draggable]");
const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });

test.describe("Gmail after a graduation export (Dean)", () => {
  test.use({ storageState: authFile("dean") });

  test("the export opens a Gmail draft to the Registrar and the window keeps the mail buttons", async ({ page, context }) => {
    await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const isabel = byName(json.roster, "Isabel Flores");
      isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: "Dean Approved", display_status: "Dean Approved", registrar_status: "Pending" };
      isabel.next_action_owner = "Dean (export)";
      await route.fulfill({ response, json });
    });
    await page.route(/\/api\/graduation\/endorsed\.csv/, (route) => route.fulfill({
      status: 200,
      contentType: "text/csv",
      headers: { "Content-Disposition": 'attachment; filename="graduate-school-endorsed-list.csv"', "X-Exported-Count": "1", "X-Registrar-Email": "registrar@usls.edu.ph" },
      body: "Graduate School Endorsed List\n",
    }));
    // Gmail itself is not loaded: the new tab is caught and closed.
    await context.route(/mail\.google\.com/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Gmail</title>" }));

    await page.goto("/dean/approvals/graduation");
    const batch = cardsOf(column(page.getByRole("region", { name: BOARD }), "Approved, ready to export")).filter({ hasText: BATCH });
    const tabPromise = context.waitForEvent("page");
    await batch.getByRole("button", { name: "Export batch", exact: true }).click();
    const tab = await tabPromise;
    const url = new URL(tab.url());
    expect(url.hostname).toBe("mail.google.com");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("registrar@usls.edu.ph");
    expect(url.searchParams.get("su")).toContain("Endorsed graduation list");
    expect(url.searchParams.get("body")).toContain("graduate-school-endorsed-list.csv");
    await tab.close();

    const dialog = page.getByRole("dialog", { name: /export complete/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Gmail opened in a new tab/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Open Gmail" })).toHaveAttribute("href", /mail\.google\.com\/mail\/\?view=cm/);
    await expect(dialog.getByRole("link", { name: "Use my mail app instead" })).toHaveAttribute("href", /^mailto:registrar%40usls\.edu\.ph\?/);
    await page.unrouteAll({ behavior: "ignoreErrors" }); // the board reloads after the export; let that request finish quietly
  });
});

test.describe("Export history", () => {
  test.use({ storageState: authFile("staff") });

  test("Withdrawal and Graduation list the exported files", async ({ page }) => {
    await page.goto("/workflow/withdrawal");
    await page.getByRole("button", { name: "Export history" }).click();
    await expect(page.getByRole("table", { name: "Withdrawal lists downloaded" }).or(page.getByText("No lists downloaded yet"))).toBeVisible();

    await page.goto("/workflow/graduation");
    await page.getByRole("button", { name: "Exported batches (history)" }).click();
    const history = page.getByRole("table", { name: "Graduation lists downloaded" });
    await expect(history.or(page.getByText("No lists downloaded yet"))).toBeVisible();
    if (await history.count()) await expect(history.getByRole("columnheader", { name: "Batches" })).toBeVisible();
  });
});

test.describe("New and moved items are green until opened (staff)", () => {
  test.use({ storageState: authFile("staff") });

  test("a Needs your action row is New until it is opened", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Needs your action" }) }).first();
    const rows = section.locator("li");
    test.skip((await rows.count()) === 0, "nothing waits on staff in this data");
    const first = rows.first();
    await expect(first).toHaveAttribute("data-fresh", "true");
    await expect(first.getByText("New", { exact: true })).toBeVisible();
    await first.getByRole("link").first().click();
    await page.goto("/");
    await expect(section.locator("li").first()).not.toHaveAttribute("data-fresh", "true");
  });

  test("a card that moved by itself is green until it is touched", async ({ page }) => {
    await page.goto("/workflow/withdrawal");
    const board = page.getByRole("region", { name: /board/i }).first();
    const card = board.locator("[data-card-id]").first();
    await expect(card).toBeVisible();
    // The first visit only records where every card is: nothing is green.
    await expect(board.locator('[data-fresh="true"]')).toHaveCount(0);
    const id = await card.getAttribute("data-card-id");
    // Pretend this card was last seen in another column (someone else moved it), then come back.
    await page.evaluate((cardId) => {
      const key = Object.keys(localStorage).find((name) => name.startsWith("usls-seen:board:"));
      const marks = JSON.parse(localStorage.getItem(key));
      marks[cardId] = "some-other-column";
      localStorage.setItem(key, JSON.stringify(marks));
    }, id);
    await page.reload();
    const moved = page.locator(`[data-card-id="${id}"]`).first();
    await expect(moved).toHaveAttribute("data-fresh", "true");
    await expect(moved.getByText("Moved here · new")).toBeVisible();
    await moved.click({ position: { x: 8, y: 8 } });
    await expect(moved).not.toHaveAttribute("data-fresh", "true");
    await page.reload();
    await expect(page.locator(`[data-card-id="${id}"]`).first()).not.toHaveAttribute("data-fresh", "true");
  });
});
