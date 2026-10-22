// Packets P5.3-P5.5 (Phase 5 design system, stream D): pins what the leave / process dialogs DO, so moving
// pages/leave/* and pages/process/* onto the component library (Modal, DecisionPanel, InlineNotice, HistoryPanel,
// SearchInput, StatusChip, DataTable) cannot change it. Written against the old code; it must pass on both.
// Through the real UI, read-only (every dialog is opened and cancelled, nothing is decided; server answers that
// would need other data are edited with page.route, so the test changes no data):
//   - the case window on the four boards (Leave of Absence, Readmission, AWOL & Residency, Withdrawal) as staff and
//     the Withdrawal board as the Dean: a dialog named after the student, the request / files / history sections,
//     Escape closes it and the focus goes back to the "View details" button that opened it;
//   - the decision dialog (Return to student, Forward to Dean, Start review, Confirm AWOL): its comment box and label,
//     the empty-comment refusal, Escape closes only the top dialog and gives the focus back to the button that opened
//     it, Cancel closes it; the forward dialog on Readmission has the eligibility select, the return checklist and the
//     note for the Dean;
//   - the note / return forms inside the case window refuse an empty text; the history toggles open their lists;
//   - the group step bar (batch name, step button with the count, Clear selection) and the refused-batch message with
//     its "Skipped:" list; the search box; the Table view and its select-all box;
//   - the Registrar list (rows ticked, buttons, Export history), the follow-up strip, the AWOL Registrar list, the
//     Withdrawal export window, and the residency dialog with the I-012 rule (Record stays off when the checker says
//     "Needs Human Review", on when it says "Eligible for Residency").
// Demo data read only: Benjamin Santos, Therese Lacson, Gabriel Domingo (Leave of Absence), Maria Dela Cruz
// (Readmission), Clarisse Tan, Elena Mendoza (AWOL & Residency), Adrian Lim (Withdrawal).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

// E2E_SHOTS_DIR lets a before/after comparison write to two folders; the default is "p86".
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p86");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function shot(page, name) {
  await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, name) });
}

const open = async (page, name) => {
  const opener = page.getByRole("button", { name: `View details for ${name}`, exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  // the full case has loaded when the "The request" section is there
  await expect(dialog.getByRole("heading", { name: "The request", exact: true })).toBeVisible();
  return { opener, dialog };
};

// The case window's own step buttons sit in the footer, after the "Return to student" form button in the body.
const footerAction = (dialog, name) => dialog.getByRole("button", { name, exact: true }).last();

/** The newest dialog (the decision box over the case window). */
const top = (page) => page.getByRole("dialog").last();

test.describe("P5.3-P5.5 leave and process dialogs", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    for (const [slug, region, student] of [
      ["leave-of-absence", "Leave of absence board", "Therese Lacson"],
      ["readmission", "Readmission board", "Maria Dela Cruz"],
      ["awol", "AWOL and residency board", "Clarisse Tan"],
      ["withdrawal", "Subject withdrawal board", "Adrian Lim"],
    ]) {
      test(`${slug}: the case window opens, shows its sections, Escape closes it and the focus returns`, async ({ page }) => {
        await page.goto(`/workflow/${slug}`);
        await expect(page.getByRole("region", { name: region })).toBeVisible();
        const { opener, dialog } = await open(page, student);
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog.getByRole("button", { name: "Close details", exact: true })).toBeVisible();
        for (const heading of ["The request", "Messages", "Files", "History"]) {
          await expect(dialog.getByRole("heading", { name: heading, exact: true }), heading).toBeVisible();
        }
        await expect(dialog.getByRole("region", { name: "Where this request is" })).toBeVisible();
        await shot(page, `case-${slug}-1366.png`);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(opener).toBeFocused();
        // the X button and the "Close details" button close it too
        await opener.click();
        await expect(dialog.getByRole("heading", { name: "The request", exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Close request details", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await opener.click();
        await dialog.getByRole("button", { name: "Close details", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(opener).toBeFocused();
      });
    }

    test("Leave of Absence: Return to student asks for a reason; Escape closes only the top dialog and returns the focus", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { opener, dialog } = await open(page, "Benjamin Santos");
      const button = footerAction(dialog, "Return to student");
      await button.click();
      await expect(page.getByRole("dialog")).toHaveCount(2);
      const decision = top(page);
      await expect(decision.getByRole("heading", { level: 2, name: "Return to student", exact: true })).toBeVisible();
      await expect(decision).toContainText("Benjamin Santos - Leave of Absence");
      await expect(decision).toContainText("The request goes back to the student");
      const box = decision.getByLabel("What should the student fix? (the student will see this)");
      await expect(box).toBeVisible();
      await expect(box).toBeFocused(); // the cursor starts in the reason box
      await shot(page, "decision-return-1366.png");

      // an empty reason is refused and nothing is sent
      let sent = 0;
      await page.route("**/api/process-cases/leave-of-absence/*/transition", (route) => {
        sent += 1;
        return route.abort();
      });
      await decision.getByRole("button", { name: "Return to student", exact: true }).last().click();
      await expect(box).toBeFocused(); // the empty box is refused and the cursor stays in it
      expect(sent).toBe(0);
      await expect(page.getByRole("dialog")).toHaveCount(2);

      // Escape closes the decision box only; the case window stays; the focus is back on the step button
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(dialog.getByRole("heading", { level: 2, name: "Benjamin Santos", exact: true })).toBeVisible();
      await expect(button).toBeFocused();

      // Cancel closes it too, with a typed reason left unsent
      await button.click();
      await top(page).getByLabel("What should the student fix? (the student will see this)").fill("Please attach the signed form.");
      await top(page).getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(button).toBeFocused();
      expect(sent).toBe(0);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    // New in P5.3 (DecisionPanel): the refusal is said in words next to the box instead of a browser tooltip, and a
    // reason made of spaces counts as empty. The old box relied on the browser's own "required" check.
    test("Leave of Absence: an empty reason is refused with words; a reason of spaces too", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { dialog } = await open(page, "Benjamin Santos");
      await footerAction(dialog, "Return to student").click();
      const decision = top(page);
      const box = decision.getByLabel("What should the student fix? (the student will see this)");
      await expect(decision.getByText("Required for this step.")).toBeVisible();
      await decision.getByRole("button", { name: "Return to student", exact: true }).last().click();
      const message = decision.getByText("Please write the reason first. It is required for this step.");
      await expect(message).toBeVisible();
      await expect(box).toBeFocused();
      await expect(box).toHaveAttribute("aria-invalid", "true");
      await box.fill("   ");
      await decision.getByRole("button", { name: "Return to student", exact: true }).last().click();
      await expect(message).toBeVisible();
      await box.fill("Attach the signed form.");
      await expect(message).toHaveCount(0); // typing clears the message
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("Leave of Absence: Forward to Dean offers the eligibility result and a note; Start review has an optional note", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { dialog } = await open(page, "Benjamin Santos");
      await footerAction(dialog, "Forward to Dean").click();
      const forward = top(page);
      await expect(forward.getByRole("heading", { level: 2, name: "Forward to Dean", exact: true })).toBeVisible();
      await expect(forward).toContainText("The request goes to the Dean, who decides. Nothing is decided yet.");
      await expect(forward.getByLabel("Eligibility result")).toBeVisible();
      await expect(forward.getByLabel("Note for the Dean")).toBeVisible();
      await expect(forward.getByRole("button", { name: "Forward to Dean", exact: true })).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);

      await footerAction(dialog, "Start review").click();
      const review = top(page);
      await expect(review.getByRole("heading", { level: 2, name: "Start review", exact: true })).toBeVisible();
      await expect(review.getByLabel("Note (optional)")).toBeVisible();
      await expect(review).toContainText("Kept with this step in the history.");
      await review.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("Readmission: Forward to Dean has the return checklist and says how many items are not verified", async ({ page }) => {
      await page.goto("/workflow/readmission");
      const { dialog } = await open(page, "Maria Dela Cruz");
      await footerAction(dialog, "Forward to Dean").click();
      const forward = top(page);
      await expect(forward.getByRole("heading", { level: 2, name: "Forward to Dean", exact: true })).toBeVisible();
      await expect(forward.getByText("Return checklist", { exact: true })).toBeVisible();
      const ticks = forward.getByRole("checkbox");
      const count = await ticks.count();
      expect(count).toBeGreaterThan(0);
      await expect(forward.getByText(/not verified yet\./)).toBeVisible();
      await ticks.first().check();
      await expect(ticks.first()).toBeChecked();
      await shot(page, "decision-forward-readmission-1366.png");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("Leave of Absence: Confirm AWOL needs the reason and warns first", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { dialog } = await open(page, "Therese Lacson");
      const button = footerAction(dialog, "Confirm AWOL (leave ended, no return)");
      await button.click();
      const confirm = top(page);
      await expect(confirm.getByRole("heading", { level: 2, name: "Confirm AWOL (leave ended, no return)", exact: true })).toBeVisible();
      await expect(confirm).toContainText("Confirming records that the student did not come back.");
      await expect(confirm.getByLabel("Confirm the student is AWOL: what did you do to reach them?")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(button).toBeFocused();
    });

    test("the case window: a note and a return refuse an empty text; the history lists open", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { dialog } = await open(page, "Benjamin Santos");
      await dialog.getByRole("button", { name: "Save note", exact: true }).click();
      await expect(dialog.getByText("Write the note first.")).toBeVisible();
      // the return form in the Messages block
      await dialog.getByRole("button", { name: "Return to student", exact: true }).first().click();
      await expect(dialog.getByText("Tell the student what to fix. A reason is required.")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);

      // history: both lists open and the count bubble matches the rows
      const detail = (await (await page.request.get("/api/process-cases/leave-of-absence/1")).json()).case;
      const who = dialog.getByRole("button", { name: /who did what/i });
      await who.scrollIntoViewIfNeeded();
      await who.click();
      await expect(who).toHaveAttribute("aria-expanded", "true");
      const whoList = dialog.locator(`[id="${await who.getAttribute("aria-controls")}"]`);
      await expect(whoList.getByRole("listitem")).toHaveCount(detail.events.length);
      const activity = dialog.getByRole("button", { name: /activity log/i });
      await activity.click();
      await expect(activity).toHaveAttribute("aria-expanded", "true");
      const activityList = dialog.locator(`[id="${await activity.getAttribute("aria-controls")}"]`);
      await expect(activityList.getByRole("listitem")).toHaveCount(detail.history.length);
      await shot(page, "case-history-1366.png");
      await who.click();
      await expect(who).toHaveAttribute("aria-expanded", "false");
    });

    test("Leave of Absence: the group step bar, the refused batch, the search box and the Table view", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const board = page.getByRole("region", { name: "Leave of absence board" });
      await expect(board).toBeVisible();

      // search narrows the board and says how many are shown
      const search = page.getByLabel("Search requests by name, student number or program");
      await search.fill("Benjamin");
      await expect(page.getByText(/Showing 1 of \d+ requests/)).toBeVisible();
      await expect(board.getByRole("button", { name: "View details for Therese Lacson" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Clear 1 filter$/ })).toBeVisible();
      await page.getByRole("button", { name: /^Clear 1 filter$/ }).click();
      await expect(search).toHaveValue("");

      // the group step bar
      await page.getByRole("checkbox", { name: "Select Benjamin Santos for a batch step" }).check();
      const bar = page.getByRole("group", { name: "Apply a step to the selected requests" });
      await expect(bar).toBeVisible();
      await expect(bar.getByLabel("Batch name")).toBeVisible();
      await expect(bar.getByRole("button", { name: "Forward to Dean (1)", exact: true })).toBeVisible();
      await shot(page, "batch-bar-1366.png");

      // a refused batch shows its message and who was skipped
      await page.route("**/api/process-cases/leave-of-absence/batch", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ updated: [], skipped: [{ case_id: 1, student_name: "Benjamin Santos", reason: "Pretend the group step is refused." }], message: "No request was moved." }),
        }),
      );
      await bar.getByRole("button", { name: "Forward to Dean (1)", exact: true }).click();
      await expect(page.getByText("No request was moved.")).toBeVisible();
      await expect(page.getByText("Skipped:")).toBeVisible();
      await expect(page.getByText("Benjamin Santos - Pretend the group step is refused.")).toBeVisible();
      await page.getByRole("button", { name: /^Dismiss/ }).first().click();
      await expect(page.getByText("No request was moved.")).toHaveCount(0);

      // the Table view: select-all ticks the one request that can move as a group, "View" opens the case window
      await page.getByRole("button", { name: "Table", exact: true }).click();
      const table = page.getByRole("table").first();
      await expect(table.getByRole("columnheader", { name: "Student" })).toBeVisible();
      await page.getByRole("checkbox", { name: "Select every request that can be moved as a group" }).check();
      await expect(page.getByRole("checkbox", { name: "Select Benjamin Santos for a batch step" })).toBeChecked();
      await expect(bar).toBeVisible();
      await bar.getByRole("button", { name: "Clear selection" }).click();
      await expect(bar).toHaveCount(0);
      const view = table.getByRole("button", { name: "View details for Benjamin Santos" });
      await view.click();
      await expect(page.getByRole("dialog").getByRole("heading", { level: 2, name: "Benjamin Santos" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(view).toBeFocused();
    });

    test("Leave of Absence: the Registrar list shows the approved requests, ticks, and the export history", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const api = (await (await page.request.get("/api/process-cases?slug=leave-of-absence")).json()).cases;
      const listed = api.filter((item) => item.registrar?.status && item.registrar.status !== "Not Ready");
      expect(listed.length).toBeGreaterThan(0);
      const panel = page.getByRole("region", { name: "Registrar list" });
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole("heading", { level: 3, name: "Registrar list" })).toBeVisible();
      const rows = panel.getByRole("table").getByRole("row");
      await expect(rows).toHaveCount(listed.length + 1);
      for (const item of listed) await expect(rows.filter({ hasText: item.student.name })).toHaveCount(1);
      for (const head of ["Student", "Leave period", "Dean decision", "Handoff"]) {
        await expect(panel.getByRole("columnheader", { name: head })).toBeVisible();
      }
      await expect(panel.getByRole("button", { name: "Mark as sent" })).toBeDisabled();
      await expect(panel.getByText("Nothing ticked: a download includes every request still waiting to go out.")).toBeVisible();
      await panel.getByRole("checkbox", { name: "Tick every request in the Registrar list" }).check();
      await expect(panel.getByText(`${listed.length} requests ticked.`)).toBeVisible();
      await expect(panel.getByRole("button", { name: "Mark as sent" })).toBeEnabled();
      await expect(panel.getByRole("button", { name: "Mark as acknowledged" })).toBeEnabled();
      await panel.getByRole("checkbox", { name: "Tick every request in the Registrar list" }).uncheck();
      await expect(panel.getByText(/Nothing ticked/)).toBeVisible();
      // an approved row whose list was already sent cannot be downloaded again: the message says why
      await panel.getByRole("checkbox", { name: `Tick ${listed[0].student.name}` }).check();
      await panel.getByRole("button", { name: "Download list (CSV)" }).click();
      await expect(panel.getByText(/The ticked requests were already sent/)).toBeVisible();
      await panel.getByRole("button", { name: /^Dismiss/ }).click();
      await expect(panel.getByText(/The ticked requests were already sent/)).toHaveCount(0);

      const history = panel.getByRole("button", { name: /export history/i });
      await history.click();
      await expect(history).toHaveAttribute("aria-expanded", "true");
      const log = (await (await page.request.get("/api/leave-cases/export-log?slug=leave-of-absence")).json()).items;
      if (log.length) await expect(panel.getByRole("table").last().getByRole("row")).toHaveCount(log.length + 1);
      else await expect(panel.getByText("No lists downloaded yet")).toBeVisible();
      await shot(page, "registrar-list-1366.png");
    });

    test("Leave of Absence: the follow-up strip lists a leave that ended and opens the confirm box", async ({ page }) => {
      await page.route(/\/api\/process-cases\?slug=leave-of-absence/, async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        json.cases = json.cases.map((item) =>
          item.student.name === "Therese Lacson" ? { ...item, status: "Return Due", status_label: "Return due", awol_proposed: true, overdue_days: 3, period: { ...(item.period || {}), end_date: "2026-09-30" } } : item,
        );
        await route.fulfill({ response, json });
      });
      await page.goto("/workflow/leave-of-absence");
      const strip = page.getByRole("region", { name: "Needs follow-up" });
      await expect(strip.getByRole("heading", { name: "Needs follow-up (1)" })).toBeVisible();
      await expect(strip).toContainText("Therese Lacson");
      await expect(strip).toContainText("Overdue 3 days");
      await expect(strip).toContainText("AWOL proposed");
      const confirm = strip.getByRole("button", { name: "Confirm AWOL", exact: true });
      await confirm.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole("heading", { level: 2, name: "Confirm AWOL (leave ended, no return)" })).toBeVisible();
      await expect(dialog.getByLabel("Confirm the student is AWOL: what did you do to reach them?")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(confirm).toBeFocused();
      await strip.getByRole("button", { name: "View details", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("heading", { level: 2, name: "Therese Lacson" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("AWOL & Residency: the Registrar list shows the approved returns with their report link", async ({ page }) => {
      await page.route(/\/api\/process-cases\?slug=awol/, async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        json.cases = json.cases.map((item) => (item.student.name === "Clarisse Tan" ? { ...item, status: "Return Approved", status_label: "Return approved" } : item));
        await route.fulfill({ response, json });
      });
      await page.goto("/workflow/awol");
      const panel = page.getByRole("region", { name: "Registrar list" });
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole("heading", { level: 3, name: "Registrar list" })).toBeVisible();
      await expect(panel.getByText(/\d+ reports? available\./)).toBeVisible();
      const row = panel.getByRole("table").getByRole("row").filter({ hasText: "Clarisse Tan" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Return approved");
      await expect(row.getByRole("link", { name: "Download report" })).toHaveAttribute("href", "/api/awol/1/registrar-report");
      for (const head of ["Student", "Type", "Status"]) await expect(panel.getByRole("columnheader", { name: head })).toBeVisible();
      await shot(page, "awol-registrar-1366.png");
    });

    test("Withdrawal: the export window lists the tagged withdrawals; Escape closes it and returns the focus", async ({ page }) => {
      await page.route(/\/api\/process-cases\?slug=withdrawal/, async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        json.cases = json.cases.map((item) =>
          item.student.name === "Adrian Lim"
            ? {
                ...item,
                status: "Subject Tagged - Registrar Preparation",
                status_label: "Subject tagging",
                subject: { code: "IT 601", title: "Advanced Topics" },
                term_label: "1st Sem 2026",
                window: { deadline: "2026-11-30", fee_percent: 50, fee_tier: "Half" },
              }
            : item,
        );
        await route.fulfill({ response, json });
      });
      await page.goto("/workflow/withdrawal");
      const panel = page.getByRole("region", { name: "Registrar list" });
      await expect(panel).toContainText("1 tagged withdrawal waiting for the Excel list");
      const opener = panel.getByRole("button", { name: "Prepare Excel export", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole("heading", { level: 2, name: "Approved subject withdrawals" })).toBeVisible();
      await expect(dialog).toContainText("1 request ticked");
      const row = dialog.getByRole("table").getByRole("row").filter({ hasText: "Adrian Lim" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("IT 601");
      await expect(row).toContainText("Deadline: 2026-11-30");
      await expect(row).toContainText("50% of term (Half)");
      for (const head of ["Student", "Subject", "Semester / deadline", "Fee", "Status"]) {
        await expect(dialog.getByRole("columnheader", { name: head })).toBeVisible();
      }
      const tick = dialog.getByRole("checkbox", { name: "Tick Adrian Lim" });
      await expect(tick).toBeChecked();
      await tick.uncheck();
      await expect(dialog).toContainText("0 requests ticked");
      await expect(dialog.getByRole("button", { name: "Download Excel list" })).toBeDisabled();
      await tick.check();
      await expect(dialog.getByRole("button", { name: "Download Excel list" })).toBeEnabled();
      await shot(page, "withdrawal-export-1366.png");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    test("AWOL & Residency: the residency dialog keeps Record off when the checker says Needs Human Review (I-012)", async ({ page }) => {
      await page.goto("/workflow/awol");
      const opener = page.getByRole("button", { name: "Record residency", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole("heading", { level: 2, name: "Record residency", exact: true })).toBeVisible();
      await expect(dialog).toContainText("AWOL cannot be declared manually");
      const record = dialog.getByRole("button", { name: "Record residency", exact: true });
      await expect(record).toBeDisabled(); // nothing is checked yet
      await shot(page, "residency-1366.png");

      // Escape closes it and the focus returns to the page button
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await opener.click();

      // pick a student and a purpose, then run the checker (the answer is edited by the test)
      await dialog.getByRole("searchbox", { name: "Search a student" }).click();
      await dialog.getByRole("button", { name: /^\S.* \S+ · / }).first().click();
      await expect(dialog.getByText("Selected student")).toBeVisible();
      await dialog.getByLabel("Residency purpose").selectOption({ index: 1 });
      const review = (recommendation) => ({
        review: {
          recommendation,
          suggested_action: "Review the record",
          summary: "A pretend policy summary.",
          checks: [{ label: "Pretend check", detail: "Pretend detail.", status: recommendation === "Eligible for Residency" ? "Passed" : "Needs Review" }],
        },
      });
      await page.route("**/api/awol/policy-review", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review("Needs Human Review")) }),
      );
      await dialog.getByRole("button", { name: "Run residency policy checker" }).click();
      const result = dialog.getByRole("region", { name: "Residency policy result" });
      await expect(result).toContainText("Needs Human Review");
      await expect(result).toContainText("Pretend check");
      await expect(dialog.getByRole("alert").filter({ hasText: "cannot be recorded" })).toBeVisible();
      await expect(record).toBeDisabled();
      await expect(record).toHaveAttribute("title", /needs human review/);

      // a cleared case switches Record on (it is not clicked)
      await page.unroute("**/api/awol/policy-review");
      await page.route("**/api/awol/policy-review", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review("Eligible for Residency")) }),
      );
      await dialog.getByRole("button", { name: "Run residency policy checker" }).click();
      await expect(result).toContainText("Eligible for Residency");
      await expect(dialog.getByRole("alert").filter({ hasText: "cannot be recorded" })).toHaveCount(0);
      await expect(record).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  });

  test.describe("dean", () => {
    test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

    test("Withdrawal: the Dean's case window offers Return to student with a reason box; Escape returns the focus", async ({ page }) => {
      await page.goto("/dean/approvals/withdrawal");
      const { opener, dialog } = await open(page, "Adrian Lim");
      const button = footerAction(dialog, "Return to student");
      await button.click();
      await expect(page.getByRole("dialog")).toHaveCount(2);
      const decision = top(page);
      await expect(decision.getByRole("heading", { level: 2, name: "Return to student", exact: true })).toBeVisible();
      await expect(decision.getByLabel("What should the student fix? (the student will see this)")).toBeVisible();
      await decision.getByRole("button", { name: "Return to student", exact: true }).last().click();
      await expect(decision.getByLabel("What should the student fix? (the student will see this)")).toBeFocused();
      await shot(page, "dean-decision-return-1366.png");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(button).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    test("Leave of Absence: the Dean's case window has no step and says who is next", async ({ page }) => {
      await page.goto("/dean/approvals/leave-of-absence");
      const { dialog } = await open(page, "Benjamin Santos");
      await expect(dialog.getByRole("button", { name: "Close details", exact: true })).toBeVisible();
      await expect(dialog.getByText("No step is open right now.")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  });

  test.describe("at 390 px", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

    test("the case window, the decision box and the Registrar list fit the phone screen", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      const { dialog } = await open(page, "Benjamin Santos");
      const inside = async (locator) => {
        const box = await locator.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390 + 0.5);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(844 + 0.5);
      };
      await inside(dialog);
      expect(await noOverflow(page)).toBe(true);
      await shot(page, "case-leave-390.png");
      await footerAction(dialog, "Return to student").click();
      const decision = top(page);
      await expect(decision.getByLabel("What should the student fix? (the student will see this)")).toBeVisible();
      await inside(decision);
      expect(await noOverflow(page)).toBe(true);
      await shot(page, "decision-return-390.png");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const panel = page.getByRole("region", { name: "Registrar list" });
      await panel.scrollIntoViewIfNeeded();
      await expect(panel).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await shot(page, "registrar-list-390.png");
    });
  });
});
