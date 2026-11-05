// e2e-writes: none
// Packets E and C (I-148, I-152, I-155, I-156, I-157; spec .planning/research/CONSISTENCY-PROCESSES-2026-11-02.md).
// Written BEFORE the change; red on the old code. Every write is answered by page.route, nothing reaches the server.
//   Packet E, one staff step dialog (components/StepDialog.jsx): the same dialog, the same heading pattern (an h2), a reason
//   box that asks for the reason in words ("... is required", role=alert, the box takes the focus), Escape / Cancel hand the
//   focus back to the button that opened it. Pinned on four steps:
//     - a process board return (Leave of Absence, "Return to student");
//     - the Practicum return ("Message / Return" in the case window);
//     - the Graduation Dean decision (Approve / Return the endorsement list);
//     - a gate return outside the boards (the Dean returns an onboarding report).
//   Packet C, the boards share one place for what happened (BoardNotice, data-testid=board-notice) and one loading look
//   (SkeletonBoard), and Practicum keeps its columns when the filters match nothing.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", "p98");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const BATCH = "Batch 1 October 2026";

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
// A refetch answered through page.route can still be in flight when a test ends; let it go quietly.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

/** The same checks on every step dialog: heading, a reason box, the refusal in words, the focus back on the opener. */
async function emptyReasonIsRefused(page, { opener, confirmName }) {
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { level: 2 }).first()).toBeVisible();
  const box = dialog.getByRole("textbox");
  await expect(box).toHaveCount(1);
  await expect(box, "the cursor starts in the reason box").toBeFocused();
  await dialog.getByRole("button", { name: confirmName, exact: true }).last().click();
  await expect(dialog.getByRole("alert").filter({ hasText: /required/i }), "the refusal is said in words").toBeVisible();
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Escape");
  await expect(opener, "Escape gives the focus back to the button that opened it").toBeFocused();
  return dialog;
}

const notice = (page) => page.getByTestId("board-notice");

/** The practicum roster of the seed plus one case with a record (as p78 does), so there is a case window to open. */
async function withOneCase(page) {
  await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const row = body.roster.find((item) => item.student.student_number === "2690201");
    row.record = {
      id: 9100, student_id: row.student.id, status: "MOA Submitted", moa_status: "Uploaded", moa_uploaded: true,
      practicum_site: "Community Counselling Center", supervisor_name: "Ms. Rina Lopez", required_hours: 200, completed_hours: 0,
      document_status: "Missing", certificate_count: 0, remarks: "MOA for review.", completion_status: "Pending",
      coordinator_review_status: "Pending", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
      completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
    };
    Object.assign(row, { moa_status: "Uploaded", documents_status: "Missing", has_submitted_documents: true, last_activity_at: "2026-10-20T08:00:00Z", next_action_owner: "Graduate School Staff", messages: [], history: [] });
    await route.fulfill({ response, json: body });
  });
}

async function mockGraduationRoster(page) {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const isabel = body.roster.find((row) => row.student.name === "Isabel Flores");
    isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: "Ready for Dean Review", display_status: "Ready for Dean Review", registrar_status: "Pending" };
    isabel.next_action_owner = "Dean";
    await route.fulfill({ response, json: body });
  });
}

test.describe("one step dialog, staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 800 } });

  test("process board: Return to student", async ({ page }) => {
    await page.route("**/api/process-cases/leave-of-absence/*/transition", (route) => json(route, { message: "Process return sent." }));
    await page.goto("/workflow/leave-of-absence");
    await page.getByRole("button", { name: "View details for Benjamin Santos", exact: true }).click();
    const caseWindow = page.getByRole("dialog");
    await expect(caseWindow.getByRole("heading", { name: "The request", exact: true })).toBeVisible();
    const opener = caseWindow.getByRole("button", { name: "Return to student", exact: true }).last();
    await opener.click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await emptyReasonIsRefused(page, { opener, confirmName: "Return to student" });
    await opener.click();
    await page.getByRole("dialog").last().getByRole("textbox").fill("Attach the signed form.");
    await page.getByRole("dialog").last().getByRole("button", { name: "Return to student", exact: true }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page), "one place for what happened").toHaveCount(1);
    await expect(notice(page)).toContainText("Process return sent.");
    await expect(page.getByText("Process return sent.")).toHaveCount(1);
    await page.screenshot({ path: join(SHOTS, "board-notice-1366.png") });
  });

  test("Practicum: Message / Return", async ({ page }) => {
    await withOneCase(page);
    await page.route("**/api/transactions/practicum/messages", (route) => json(route, { message: "Practicum return sent." }));
    await page.goto("/workflow/practicum");
    await page.getByRole("button", { name: "View details for Andrea Villanueva", exact: true }).click();
    const caseWindow = page.getByRole("dialog");
    const opener = caseWindow.getByRole("button", { name: /Message \/ Return/ });
    await opener.click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await emptyReasonIsRefused(page, { opener, confirmName: "Return to student" });
    await opener.click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await page.waitForTimeout(400); // the dialog has finished animating in
    await page.screenshot({ path: join(SHOTS, "step-dialog-1366.png") });
    await page.getByRole("dialog").last().getByRole("textbox").fill("The MOA is missing a signature.");
    await page.getByRole("dialog").last().getByRole("button", { name: "Return to student", exact: true }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("Practicum return sent.");
    await expect(page.getByText("Practicum return sent.")).toHaveCount(1);
  });

  test("Practicum: a step with a confirm window, and the notice after it", async ({ page }) => {
    await withOneCase(page);
    await page.route("**/api/transactions/practicum", (route) => (route.request().method() === "POST" ? json(route, { message: "Forwarded (test)." }) : route.continue()));
    await page.goto("/workflow/practicum");
    await page.getByRole("button", { name: "View details for Andrea Villanueva", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Forward to Academic Coordinator" }).click();
    const step = page.getByRole("dialog").last();
    await expect(step.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await step.getByRole("button", { name: "Forward to Academic Coordinator", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("Forwarded (test).");
  });

  test("Practicum keeps its columns when the filters match nothing; the table button says View", async ({ page }) => {
    await withOneCase(page);
    await page.goto("/workflow/practicum");
    const board = page.getByRole("region", { name: "Practicum workflow board" });
    await expect(board).toBeVisible();
    await page.getByPlaceholder(/Search students/).fill("zzzz-nobody");
    await expect(board, "the columns stay").toBeVisible();
    for (const column of ["Awaiting Submission", "Submitted", "Eligibility Review", "Documents Review", "In Progress", "Completion Review", "Completed", "Returned"]) {
      await expect(board.getByRole("heading", { name: column, level: 3 }), column).toBeVisible();
    }
    await expect(board.getByText(/^No .+ here$/)).toHaveCount(8);
    await expect(page.getByText("No recent practicum submissions match the filters.")).toHaveCount(0);
    await page.getByPlaceholder(/Search students/).fill("");
    await page.getByRole("button", { name: "Table" }).click();
    const row = page.getByRole("table").getByRole("row", { name: /Andrea Villanueva/ });
    await expect(row.getByRole("button", { name: "View details for Andrea Villanueva", exact: true })).toHaveText("View");
    await expect(page.getByText("Open case")).toHaveCount(0);
  });

  test("the stray header lines are gone from Practicum and Graduation", async ({ page }) => {
    await page.goto("/workflow/practicum");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // the scope note is part of the page description now, not a line of its own under the header
    await expect(page.locator("main p.meta").filter({ hasText: /^Practicum applies to Psychology and MSGC students only/ })).toHaveCount(0);
    await expect(page.getByText(/Psychology and MSGC/).first()).toBeVisible();
    await page.goto("/workflow/graduation");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/AC checks coursework/)).toHaveCount(0);
  });

  for (const [label, pattern, path] of [
    ["process board", /\/api\/process-cases\?slug=leave-of-absence/, "/workflow/leave-of-absence"],
    ["Practicum", /\/api\/transactions\/practicum\/context/, "/workflow/practicum"],
    ["Graduation", /\/api\/transactions\/graduation\/context/, "/workflow/graduation"],
  ]) {
    test(`${label}: a skeleton board shows while the board request is held`, async ({ page }) => {
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      await page.route(pattern, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto(path);
      const skeleton = page.getByTestId("skeleton-board");
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute("aria-busy", "true");
      await page.screenshot({ path: join(SHOTS, `skeleton-${label.replace(/\W+/g, "-")}-1366.png`) });
      release();
      await expect(skeleton).toHaveCount(0);
      await expect(page.getByTestId("stage-board")).toBeVisible();
    });
  }
});

test.describe("one step dialog, Dean", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("Graduation: the Dean's decision is the same dialog, with a reason to return", async ({ page }) => {
    await mockGraduationRoster(page);
    await page.route("**/api/graduation/batch-actions", (route) => json(route, { message: "Graduation return sent." }));
    await page.goto("/dean/approvals/graduation");
    const board = page.getByRole("region", { name: "Graduation workflow Kanban board" });
    await expect(board).toBeVisible();
    await board.getByRole("button", { name: `View details for ${BATCH}` }).click();
    const batchWindow = page.getByRole("dialog");
    const opener = batchWindow.getByRole("button", { name: "Approve endorsement list" });
    await opener.click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await emptyReasonIsRefused(page, { opener, confirmName: "Return endorsement list for revision" });
    await opener.click();
    const step = page.getByRole("dialog").last();
    await expect(step.getByLabel("Dean decision"), "no select: the decision is two buttons").toHaveCount(0);
    await step.getByRole("textbox").fill("Two names are missing.");
    await step.getByRole("button", { name: "Return endorsement list for revision", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("Graduation return sent.");
    await expect(page.getByText("Graduation return sent.")).toHaveCount(1);
  });

  test("a gate return outside the boards: the Dean returns an onboarding report", async ({ page }) => {
    let decided = null;
    await page.route("**/api/onboarding/reviews", (route) => json(route, {
      items: [{
        id: 9001, program_code: "MAED", student_count: 3, new_student_count: 1, source_file: "maed-intake.xlsx", status: "Dean Review",
        checklist: [{ label: "Every row is valid", passed: true, detail: "3 of 3 rows" }], checklist_complete: true, dean_remarks: "", admission_completed_at: null,
      }],
    }));
    await page.route("**/api/onboarding/reviews/9001/decision", (route) => {
      decided = route.request().postDataJSON();
      return json(route, { ok: true });
    });
    await page.goto("/dean/gate-reports");
    const opener = page.getByRole("button", { name: "Return", exact: true }).first();
    await expect(opener).toBeVisible();
    await expect(page.getByLabel("Dean remarks (required to return)"), "no loose remarks box next to the buttons").toHaveCount(0);
    await opener.click();
    await emptyReasonIsRefused(page, { opener, confirmName: "Return" });
    await opener.click();
    const step = page.getByRole("dialog").last();
    await step.getByRole("textbox").fill("Check the MAED rows again.");
    await step.getByRole("button", { name: "Return", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(decided).toMatchObject({ decision: "return", remarks: "Check the MAED rows again." });
  });
});

test.describe("at 390 px", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("the step dialog and the board fit the phone screen", async ({ page }) => {
    await withOneCase(page);
    await page.goto("/workflow/practicum");
    await expect(page.getByTestId("stage-board")).toBeVisible();
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await fits(), "board").toBe(true);
    await page.screenshot({ path: join(SHOTS, "board-390.png") });
    await page.getByRole("button", { name: "View details for Andrea Villanueva", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Message \/ Return/ }).click();
    const step = page.getByRole("dialog").last();
    await expect(step.getByRole("heading", { level: 2 }).first()).toBeVisible();
    const box = await step.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    expect(await fits(), "dialog").toBe(true);
    await step.getByRole("button", { name: "Return to student", exact: true }).last().click();
    await expect(step.getByRole("alert").filter({ hasText: /required/i })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, "step-dialog-390.png") });
  });
});
