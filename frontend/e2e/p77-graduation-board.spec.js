// Packet P7.7 (senior review F-11 = I-065, and I-051): Graduation is the third board style. It must look and behave like
// the Leave of Absence board (ProcessBoardPage + StageBoard).
// Cause: GraduationRoster built its own column header (numbered "1 · ... — Awaiting ...", a paragraph of description,
// 380 px columns so ~2.5 fit at 1366 and the third is cut), four green requirement tiles and a "Completed-course cohort"
// line on every card, an extra "Completed course cohort" filter card, and no Board/Table toggle.
// Written BEFORE the change; red on the old code. Through the real UI, as Graduate School staff and as the Dean. The roster
// answer is edited in the browser (page.route) so the test does not depend on what other specs did to the demo data;
// nothing is saved (every dialog is opened and closed):
//   - the column headers are plain stage names (no "3 · " numbers), a count, and a short description of one line;
//   - a column has the default width, so the board either shows every stage or says how many are out of sight;
//   - a card is: name, student number · program, "Next: <owner>", ONE status chip and a View button; no requirement
//     tiles and no "Completed-course cohort" list (that list is only inside the batch dialog);
//   - the shared Board/Table toggle sits in the filter row; the table has student, program, stage, status, waiting on, updated;
//   - the filters are one toolbar (search, program, stage/status, completed course), no extra "Completed course cohort" card;
//   - every action still works: select students, create a batch, forward a batch, Dean approve/return, export (and its
//     "Exported - Ready to Send" chip), the lock reasons, "Move to...".
// Demo data read only: Bianca Santos, Carlo Mendoza, Hector Ong (eligible, MAED), Isabel Flores ("Batch 1 October 2026").
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p77");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const BOARD = "Graduation workflow Kanban board";
const BATCH = "Batch 1 October 2026";
const TOGGLE = "Choose how to show the requests";

const byName = (roster, name) => roster.find((row) => row.student.name === name);
const cardsOf = (scope) => scope.locator("div[draggable]");
const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** The roster answer is edited so the scenario is the same whatever other specs did to the data. */
async function mockRoster(page, mutate) {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    mutate(json.roster);
    await route.fulfill({ response, json });
  });
}

function setBatchStatus(roster, status, registrar = "Pending") {
  const isabel = byName(roster, "Isabel Flores");
  isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: status, display_status: status, registrar_status: registrar };
  isabel.next_action_owner = { "For Review": "Graduate School Staff", "Ready for Dean Review": "Dean", "Dean Approved": "Dean (export)" }[status] || "Graduate School Staff";
}

/** Staff scenario: Bianca and Hector wait for the application, Carlo has submitted it, Isabel's batch was just created. */
function staffScenario(roster) {
  const carlo = byName(roster, "Carlo Mendoza");
  Object.assign(carlo, { has_submitted_documents: true, application_submitted: true, application_status: "Application Submitted", next_action_owner: "Graduate School Staff", endorsement: null });
  setBatchStatus(roster, "For Review");
}

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

/** Where each column sits against the visible part of the board. */
async function measure(board) {
  return board.evaluate((region) => {
    const view = region.getBoundingClientRect();
    return [...region.querySelectorAll(":scope section[aria-label]")].map((section) => {
      const box = section.getBoundingClientRect();
      const title = section.querySelector("h3");
      const description = section.querySelector("header p");
      return {
        label: section.getAttribute("aria-label"),
        width: Math.round(box.width),
        fullyVisible: box.left >= view.left - 1 && box.right <= view.right + 1,
        titleClipped: title ? title.scrollWidth > title.clientWidth + 1 || getComputedStyle(title).textOverflow === "ellipsis" : false,
        description: description ? description.textContent.trim() : "",
      };
    });
  });
}

const ROLES = [
  ["staff", "/workflow/graduation"],
  ["dean", "/dean/approvals/graduation"],
];

for (const [role, path] of ROLES) {
  test.describe(`P7.7 Graduation board as ${role}`, () => {
    test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
    test.use({ storageState: authFile(role), viewport: { width: 1366, height: 768 } });

    test("the columns are plain stage names with a short description and the default width", async ({ page }) => {
      await mockRoster(page, staffScenario);
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      await shot(page, `${role}-board-1366.png`);
      const columns = await measure(board);
      expect(columns.length).toBeGreaterThanOrEqual(8);
      for (const item of columns) {
        expect(item.label, `"${item.label}" is numbered`).not.toMatch(/^\d+\s*·/);
        expect(item.label, `"${item.label}" is a sentence, not a stage name`).not.toMatch(/—/);
        expect(item.titleClipped, `${item.label}: title is cut off`).toBe(false);
        expect(item.width, `${item.label}: column is as wide as the other boards' columns`).toBeLessThanOrEqual(300);
        expect(item.description.length, `${item.label}: one short line, not a paragraph`).toBeGreaterThan(0);
        expect(item.description.length, `${item.label}: one short line, not a paragraph`).toBeLessThanOrEqual(60);
      }
      // A stage out of sight is announced, with how many.
      const hidden = columns.filter((item) => !item.fullyVisible).length;
      if (hidden > 0) {
        await expect(page.getByTestId("board-scroll-hint")).toHaveText(new RegExp(`${hidden} more stages? to the right`));
      }
      // At 1366 more than the old 2.5 columns are whole in the picture.
      expect(columns.filter((item) => item.fullyVisible).length, "stages fully in view").toBeGreaterThanOrEqual(3);
    });

    test("a card is name, number, Next, one status chip and View: no requirement tiles, no cohort list", async ({ page }) => {
      await mockRoster(page, staffScenario);
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      const cards = cardsOf(board);
      expect(await cards.count()).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < (await cards.count()); i++) {
        const text = (await cards.nth(i).textContent()) || "";
        expect(text, `card ${i} shows the cohort list`).not.toContain("Completed-course cohort");
        await expect(cards.nth(i).locator('[aria-label="Completed graduation requirements"]'), `card ${i}: requirement tiles`).toHaveCount(0);
        await expect(cards.nth(i).locator("span.rounded-full.ring-1"), `card ${i}: exactly one status chip`).toHaveCount(1);
        await expect(cards.nth(i).getByText(/^Next:/), `card ${i}: who is next`).toHaveCount(1);
        await expect(cards.nth(i).getByRole("button", { name: /^View details for / }), `card ${i}: View button`).toHaveCount(1);
      }
      const bianca = cards.filter({ hasText: "Bianca Santos" });
      await expect(bianca).toHaveCount(1);
      await expect(bianca).toContainText("GS-2026-GRAD-01 · MAED");
      await expect(bianca.getByText("Next: Student")).toBeVisible();
      await expect(bianca.getByText("Waiting for: Student (signed application)", { exact: true })).toBeVisible();
      await expect(bianca).toHaveAttribute("draggable", "false");
      // The old extra filter card is gone; the course filter is one more control in the toolbar.
      await expect(page.getByText("Completed course cohort", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: /Filter by completed courses/ })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Filter by program" })).toBeVisible();
    });

    test("the Board/Table toggle is in the filter row and the table lists the same students", async ({ page }) => {
      await mockRoster(page, staffScenario);
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      const toggle = page.getByRole("group", { name: TOGGLE });
      await expect(toggle.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
      const search = page.getByRole("searchbox").first();
      const toggleBox = await toggle.boundingBox();
      const searchBox = await search.boundingBox();
      expect(Math.abs(toggleBox.y - searchBox.y), "the toggle sits in the same row as the filters").toBeLessThan(60);

      await toggle.getByRole("button", { name: "Table" }).click();
      await expect(board).toHaveCount(0);
      const table = page.getByRole("table");
      await expect(table).toBeVisible();
      await shot(page, `${role}-table-1366.png`);
      for (const name of ["Student", "Program", "Stage", "Status", "Waiting on", "Updated"]) {
        await expect(table.getByRole("columnheader", { name }), `column "${name}"`).toBeVisible();
      }
      const rows = table.getByRole("row");
      expect(await rows.count(), "header + one row per student on the board").toBeGreaterThanOrEqual(5);
      const bianca = rows.filter({ hasText: "Bianca Santos" });
      await expect(bianca).toContainText("MAED");
      await expect(bianca).toContainText("Academically eligible");
      await expect(bianca).toContainText("Awaiting Student Application");
      await expect(bianca).toContainText("Student");
      const isabel = rows.filter({ hasText: "Isabel Flores" });
      await expect(isabel).toContainText(BATCH);
      await expect(isabel).toContainText("Batch created");
      await expect(isabel.getByRole("button", { name: /View details for Isabel Flores/ })).toBeVisible();
      // the search narrows the table the same way as the board
      await search.fill("Bianca");
      await expect(rows.filter({ hasText: "Isabel Flores" })).toHaveCount(0);
      await expect(rows.filter({ hasText: "Bianca Santos" })).toHaveCount(1);
      await search.fill("");
      await toggle.getByRole("button", { name: "Board" }).click();
      await expect(board).toBeVisible();
    });
  });
}

test.describe("P7.7 Graduation actions as staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("select students, create a batch (the cohort list is in the dialog), forward a batch, Move to", async ({ page }) => {
    await mockRoster(page, staffScenario);
    await page.goto("/workflow/graduation");
    const board = page.getByRole("region", { name: BOARD });
    await expect(board).toBeVisible();

    // Carlo submitted his application: his card can be selected, the others cannot.
    const ready = column(board, "Application submitted");
    const carlo = cardsOf(ready).filter({ hasText: "Carlo Mendoza" });
    await expect(carlo).toHaveCount(1);
    await expect(carlo.getByRole("checkbox", { name: /Select Carlo Mendoza/ })).toBeVisible();
    await expect(carlo.getByRole("link", { name: /View submitted graduation application PDF for Carlo Mendoza/ })).toHaveCount(0); // no file in the mocked data
    await expect(cardsOf(column(board, "Academically eligible")).first().getByRole("checkbox")).toHaveCount(0);
    await carlo.getByRole("checkbox").check();
    const bar = page.getByText("1 candidate selected");
    await expect(bar).toBeVisible();
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await expect(bar).toHaveCount(0);
    await ready.getByRole("button", { name: "Select all in this column" }).click();
    await expect(bar).toBeVisible();

    await page.getByRole("button", { name: "Create graduation batch" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading").first()).toContainText("Create batch");
    await expect(dialog.getByLabel("Batch No.")).toBeVisible();
    await expect(dialog.getByText("Completed-course cohort:")).toBeVisible(); // the cohort list lives here
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Isabel's batch: View details shows the stage check and the students; the card has the step button and "Move to...".
    const batch = cardsOf(column(board, "Batch created")).filter({ hasText: BATCH });
    await expect(batch).toHaveCount(1);
    await expect(batch.getByText("Next: Graduate School Staff")).toBeVisible();
    await batch.getByRole("button", { name: `View details for ${BATCH}` }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading").first()).toHaveText(`Graduation stage check for ${BATCH}`);
    await expect(dialog.getByText("Isabel Flores")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Message \/ Return/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Close details" }).first().click();

    await batch.getByRole("button", { name: "Forward to Academic Coordinator" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading").first()).toContainText("Forward to Academic Coordinator");
    await dialog.getByRole("button", { name: "Close details" }).click();

    await batch.getByRole("button", { name: /Move to/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Coursework review/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await shot(page, "staff-actions-1366.png");
  });

  test("the filters are one toolbar: the completed-course filter narrows the board", async ({ page }) => {
    await mockRoster(page, staffScenario);
    await page.goto("/workflow/graduation");
    const board = page.getByRole("region", { name: BOARD });
    await expect(board).toBeVisible();
    const before = await cardsOf(board).count();
    await page.getByRole("combobox", { name: "Filter by program" }).selectOption({ index: 1 });
    await expect(page.getByText(/^Showing \d+ of \d+ records$/)).toBeVisible();
    const course = page.getByRole("combobox", { name: /Filter by completed courses/ });
    const options = await course.locator("option").allTextContents();
    expect(options.length, "the course list has courses").toBeGreaterThan(1);
    await course.selectOption({ index: 1 });
    expect(await cardsOf(board).count()).toBeLessThanOrEqual(before);
  });
});

test.describe("P7.7 Graduation actions as the Dean", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("a batch waiting for the Dean offers approve or return", async ({ page }) => {
    await mockRoster(page, (roster) => { staffScenario(roster); setBatchStatus(roster, "Ready for Dean Review"); });
    await page.goto("/dean/approvals/graduation");
    const board = page.getByRole("region", { name: BOARD });
    await expect(board).toBeVisible();
    const batch = cardsOf(column(board, "Dean review")).filter({ hasText: BATCH });
    await expect(batch).toHaveCount(1);
    await expect(batch).toHaveAttribute("draggable", "true");
    await expect(batch.getByText("Next: Dean")).toBeVisible();
    await batch.getByRole("button", { name: "Approve endorsement list" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Dean decision")).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Return endorsement list for revision" })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Close details" }).click();
    await shot(page, "dean-ready-1366.png");
  });

  test("an approved batch offers Export, and says Exported once it was", async ({ page }) => {
    await mockRoster(page, (roster) => { staffScenario(roster); setBatchStatus(roster, "Dean Approved"); });
    await page.goto("/dean/approvals/graduation");
    const board = page.getByRole("region", { name: BOARD });
    await expect(board).toBeVisible();
    const approved = column(board, "Approved, ready to export");
    const batch = cardsOf(approved).filter({ hasText: BATCH });
    await expect(batch).toHaveCount(1);
    await expect(batch.getByRole("button", { name: "Export approved list" })).toBeVisible();
    await expect(batch.getByText("Use Export on the batch card.", { exact: true })).toBeVisible();
    await expect(batch.getByText("Exported - Ready to Send")).toHaveCount(0);

    await page.unroute(/\/api\/transactions\/graduation\/context/);
    await mockRoster(page, (roster) => { staffScenario(roster); setBatchStatus(roster, "Dean Approved", "Exported - Ready to Send"); });
    await page.reload();
    const exported = cardsOf(column(page.getByRole("region", { name: BOARD }), "Approved, ready to export")).filter({ hasText: BATCH });
    await expect(exported.getByText("Exported - Ready to Send")).toBeVisible();
    await expect(exported.getByRole("button", { name: "Export approved list again" })).toBeVisible();
  });
});

test.describe("P7.7 Graduation at 390 px", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("the board and the table scroll inside themselves, the page does not", async ({ page }) => {
    await mockRoster(page, staffScenario);
    await page.goto("/workflow/graduation");
    await expect(page.getByRole("region", { name: BOARD })).toBeVisible();
    await shot(page, "staff-board-390.png");
    expect(await noOverflow(page), "board").toBe(true);
    await page.getByRole("group", { name: TOGGLE }).getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "staff-table-390.png");
    expect(await noOverflow(page), "table").toBe(true);
  });
});
