// e2e-writes: gab-tolentino
// Packet research-gate (owner 2026-11-04, I-361 and I-362).
//   I-362  The Research Gate is a board with three numbered columns (1 Title Defense, 2 Proposal Defense, 3 Completion), each card a
//          student with program, adviser, title, next defense and what is missing, the requirement boxes, "Next:" and the buttons.
//   I-361  Graduate School staff (and the Research Coordinator) record the verdict for the panel from a card, with a reason; the
//          verdict says "Recorded by <name> for the panel"; a later correction shows in the history. The Academic Coordinator only reads.
// The writer is Gab Tolentino (2691203, MBA), the upcoming-defense demo student nobody else changes: staff record a Proposal Defense
// verdict and then correct it.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p121");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const BOARD = "Research Gate board";
const GAB = "Gab Tolentino"; // the writer: only the I-361 tests below change this student
const NICO = "Nico Barrientos"; // read only: the same kind of card, nobody changes it
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const column = (page, name) => page.getByRole("region", { name: BOARD }).locator("section").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });
const card = (page, name) => page.locator("article").filter({ hasText: name });

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

async function openGate(page) {
  await page.goto("/workflow/research-gate");
  await expect(page.getByRole("heading", { level: 1, name: "Research Gate" })).toBeVisible();
  await expect(page.getByRole("region", { name: BOARD })).toBeVisible();
}

test.describe("I-362: the Research Gate board (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("three numbered columns with counts that match the server", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    await openGate(page);
    const expected = { "Title Defense": 1, "Proposal Defense": 2, Completion: 3 };
    const numbers = await page.getByTestId("stage-number").allInnerTexts();
    expect(numbers).toEqual(["1", "2", "3"]);
    for (const [name, number] of Object.entries(expected)) {
      const count = overview.items.filter((row) => row.column === number).length;
      const section = column(page, name);
      await expect(section, `${name} column`).toBeVisible();
      await expect(section.getByLabel(`${count} in ${name}`)).toBeVisible();
      await expect(section.locator("article")).toHaveCount(Math.min(count, 8)); // "Show all" opens the rest
    }
    await expect(page.getByTestId("research-gate-summary")).toContainText(`${overview.items.length} students`);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "board-1366.png");
  });

  test("a card shows the facts, the requirement boxes, who is next and the buttons", async ({ page }) => {
    await openGate(page);
    const proposal = column(page, "Proposal Defense");
    const nico = proposal.locator("article").filter({ hasText: NICO });
    await expect(nico).toBeVisible();
    await expect(nico).toContainText("2691201");
    await expect(nico).toContainText("MBA");
    await expect(nico).toContainText("Adviser:");
    await expect(nico).toContainText("Proposal Defense:"); // the booked defense and its date
    await expect(nico).toContainText(/Missing:|Nothing missing/);
    await expect(nico).toContainText("Next:");
    await expect(nico.getByLabel(/^Requirements of Nico Barrientos/)).toBeVisible();
    await expect(nico.getByRole("button", { name: `Open the Research Gate record of ${NICO}` })).toBeVisible();
    await expect(nico.getByRole("button", { name: `Record the verdict for the panel for ${NICO}` })).toBeVisible();
  });

  test("the program filter narrows every column, and View opens the record", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    await openGate(page);
    await page.locator("#research-gate-overview").getByLabel("Filter by program").selectOption("MBA");
    const perColumn = [1, 2, 3].map((n) => overview.items.filter((row) => row.student.program_code === "MBA" && row.column === n).length);
    const shown = perColumn.reduce((sum, n) => sum + Math.min(n, 8), 0);
    await expect(page.getByRole("region", { name: BOARD }).locator("article")).toHaveCount(shown);
    await page.locator("#research-gate-overview").getByLabel("Filter by program").selectOption("");
    await card(page, NICO).getByRole("button", { name: `Open the Research Gate record of ${NICO}` }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Research Gate record" })).toBeVisible();
    await expect(page).toHaveURL(/student_id=\d+/);
  });

  test("the table view is still there", async ({ page }) => {
    await openGate(page);
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("columnheader", { name: /Status/ })).toBeVisible();
    await page.locator("#research-gate-overview").getByRole("searchbox").fill(NICO);
    await expect(page.getByRole("button", { name: `Open the Research Gate record of ${NICO}` })).toBeVisible();
  });

  test("a phone gets one stacked list and no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workflow/research-gate");
    await expect(page.getByRole("heading", { level: 1, name: "Research Gate" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Proposal Defense", exact: true }).first()).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "board-390.png");
  });

  test("a wide screen keeps the three columns together", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openGate(page);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "board-1920.png");
  });
});

test.describe("I-361: staff record, and correct, the verdict for the panel", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("the dialog needs a reason; then the card says who recorded it for the panel", async ({ page }) => {
    await openGate(page);
    await card(page, GAB).getByRole("button", { name: `Record the verdict for the panel for ${GAB}` }).click();
    const dialog = page.getByRole("dialog", { name: "Record the verdict for the panel" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Recorded by you for the panel");
    const save = dialog.getByRole("button", { name: "Record for the panel" });
    await expect(save, "no reason yet").toBeDisabled();
    await shot(page, "dialog-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "dialog-390.png");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot(page, "dialog-1920.png");
    await page.setViewportSize({ width: 1366, height: 768 });
    await dialog.getByLabel(/^Verdict/).selectOption("Passed");
    await dialog.getByLabel(/^Remarks/).fill("Clean defense, no conditions.");
    await dialog.getByLabel(/^Why are you recording/).fill("The panel chair is away and sent the result by email.");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Defense verdict recorded for the panel.")).toBeVisible();

    const gab = card(page, GAB);
    await expect(gab.getByTestId("panel-stamp")).toContainText(/Recorded by .+ for the panel/);
    await expect(gab).toContainText("Proposal Defense verdict: Passed");
    await expect(gab.getByRole("button", { name: `Record the verdict for the panel for ${GAB}` })).toHaveCount(0);
    await shot(page, "after-record-1366.png");
  });

  test("the verdict is stamped for the panel on the server and can be corrected with history", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    const row = overview.items.find((item) => item.student.name === GAB);
    expect(row.verdict.recorded_for_panel_by).toBeTruthy();
    expect(row.verdict.recorded_for_panel_label).toMatch(/^Recorded by .+ for the panel$/);
    expect(row.verdict.recorded_for_panel_reason).toContain("away");

    await openGate(page);
    await card(page, GAB).getByRole("button", { name: `Correct the verdict for the panel for ${GAB}` }).click();
    const dialog = page.getByRole("dialog", { name: "Correct the verdict for the panel" });
    await expect(dialog.getByTestId("panel-stamp")).toContainText("for the panel");
    await expect(dialog.getByText("History of this verdict")).toBeVisible();
    await dialog.getByLabel(/^Verdict/).selectOption("Failed");
    await dialog.getByLabel(/^Why is the verdict being corrected/).fill("The chair confirmed a different result.");
    await dialog.getByRole("button", { name: "Correct for the panel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Verdict corrected.")).toBeVisible();

    const after = await (await page.request.get("/api/research-gate/overview")).json();
    const corrected = after.items.find((item) => item.student.name === GAB).verdict;
    expect(corrected.original_result).toBe("Passed");
    expect(corrected.corrected_by).toContain("for the panel");
    expect(corrected.correction_reason).toContain("different result");
  });
});

test.describe("I-361: who sees the buttons", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

  test("the Academic Coordinator reads the board but has no panel buttons", async ({ page }) => {
    await openGate(page);
    await expect(card(page, NICO).getByRole("button", { name: `Open the Research Gate record of ${NICO}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /for the panel/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm revisions" })).toHaveCount(0);
  });
});

test.describe("I-361: the Research Coordinator can act for the panel too", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("the board offers the panel buttons where a verdict is due", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    const due = overview.items.filter((row) => row.can_record_verdict);
    await openGate(page);
    for (const row of due) {
      await expect(card(page, row.student.name).getByRole("button", { name: `Record the verdict for the panel for ${row.student.name}` })).toBeVisible();
    }
  });
});
