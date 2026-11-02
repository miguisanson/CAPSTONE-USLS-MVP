// e2e-writes: isabel-flores, dean-queue-graduation
// Packet P3.3 (Phase 5 design system, dean stream, last packet): pins what the Dean's report pages and the graduation page
// DO that the sweep only photographs, so the restyle of DeanReportPages.jsx and DeanGraduationPage.jsx (and the stage-check
// list in DeanParts.jsx) onto the component library cannot change it. Written against the old code; it must pass on both.
// Through the real UI, as the Dean:
//   - Admission & Coursework Reports: the page and its two report panels;
//   - Reports & Analytics: rebuilt by p101 (I-141) - the Dean's four tabs and the waiting table (was: four tiles, "Decisions by
//     process", "Pending load by program");
//   - Graduation Endorsement: the header (waiting badge, "All approvals"), the two tabs, then on "Endorsement batches" the
//     shared board with the ready batch (candidates, step, owner, View details, table, the filter), its stage-check window
//     (which steps are complete, which is current, which is pending), the Dean decision that approves it, the approved batch
//     ("Export approved list" in View details downloads a CSV and shows the follow-up window, then "Export approved list again");
//   - Activity Log (was Decision History): the entry the approval wrote (link to the case, process, status), the process filter and its count.
// Setup (one graduation batch reaching the Dean) goes through each role's own API login, like p31 / p32. It changes data in
// the throwaway harness database and touches only the demo student Isabel Flores (2260007, "Batch 1 <this month>"), whom no
// other spec uses.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

// E2E_SHOTS_TAG lets a before/after comparison write to two folders; the default is "p33-dean".
const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p33-dean");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}

async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

const STUDENT_ID = 1; // Isabel Flores
// The app names a new batch after the month it is made in ("Batch 1 <Month> <Year>", default_graduation_batch_name, UTC), and the seed makes it on the run day (IM16).
const NOW = new Date();
const BATCH = `Batch 1 ${NOW.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${NOW.getUTCFullYear()}`;
const WINDOW = "AY 2026-2027";

/** Walk Isabel's graduation batch through every role until it is "Ready for Dean Review". */
async function putBatchInFrontOfTheDean(playwright) {
  // The seed already has a graduation endorsement waiting for the Dean (Hector Ong, I-062). These tests are about
  // Isabel's batch alone, so the Dean sends the seeded one back first.
  const dean = await apiAs(playwright, "dean@usls.edu.ph");
  const queue = await okJson(await dean.get("/api/approvals"), "the Dean's queue");
  for (const item of queue.workflow_pending.filter((entry) => entry.type === "graduation" && entry.student.id !== STUDENT_ID)) {
    await okJson(
      await dean.post(`/api/approvals/workflow/graduation/${item.id}/decide`, { data: { decision: "return", note: "Held back so this test sees one batch." } }),
      `return ${item.student.name}`,
    );
  }
  await dean.dispose();
  const steps = [
    ["staff@usls.edu.ph", "compile_to_ac"],
    ["academic@usls.edu.ph", "check_coursework"],
    ["research@usls.edu.ph", "validate_research"],
    ["staff@usls.edu.ph", "prepare_endorsement"],
    ["staff@usls.edu.ph", "send_to_dean"],
  ];
  for (const [email, action] of steps) {
    const ctx = await apiAs(playwright, email);
    const result = await okJson(
      await ctx.post("/api/graduation/batch-actions", { data: { student_ids: [STUDENT_ID], action, review_window: WINDOW } }),
      action,
    );
    expect(result.skipped, `${action} skipped nobody`).toEqual([]);
    await ctx.dispose();
  }
}

/** Full-page screenshot once the page's own fade-in has finished (otherwise the shot is half transparent). */
async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

/** No sideways page scroll (IM15). */
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const numberIn = async (locator) => Number((await locator.innerText()).match(/\d+/)?.[0]);

test.describe.configure({ mode: "serial" });

test.describe("P3.3 Dean reports and graduation", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test.beforeAll(async ({ playwright }) => {
    mkdirSync(SHOTS, { recursive: true });
    await putBatchInFrontOfTheDean(playwright);
  });

  test("Admission & Coursework Reports: the page and its two report panels", async ({ page }) => {
    await page.goto("/dean/gate-reports");
    await expect(page.getByRole("heading", { level: 1, name: "Admission & Coursework Reports" })).toBeVisible();
    await expect(page.getByText("Reports sent to the Dean for a decision: the admission onboarding report and the coursework status report.")).toBeVisible();
    await expect(page.getByText("Onboarding report & Dean approval")).toBeVisible();
    await expect(page.getByText("Coursework status report to the Dean")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await shot(page, "gate-reports-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Admission & Coursework Reports" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "gate-reports-390.png");
  });

  // CHANGED BY p101 (I-141): Reports & Analytics is rebuilt (four tiles, "Decisions by process", "Pending load by program" are
  // gone; DROP per the spec). Kept: the heading, one row per process with a link-able waiting count, the graduation batch counted
  // as waiting, no sideways scroll at 390. The page's own behaviour is pinned in p101-reports.spec.js.
  test("Reports & Analytics: the Dean's four tabs, the waiting decisions per process (graduation batch counted), no sideways scroll", async ({ page }) => {
    await page.goto("/dean/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
    await expect(page.getByText("What waits for the Dean's decision, how fast decisions are made, what was decided and where graduation candidates stand.")).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /Decisions waiting/ })).toHaveAttribute("href", "/dean/approvals");
    for (const name of ["Waiting for my decision", "How fast decisions are made", "Outcomes", "Graduation pipeline"]) {
      await expect(page.getByRole("tab", { name, exact: true }), name).toBeVisible();
    }
    for (const label of ["Pending load by program", "Approval share"]) await expect(main.getByText(label), `${label} is dropped`).toHaveCount(0);

    // The waiting table (behind "Show as table"): one row per process; the graduation row counts the batch waiting for the Dean.
    await main.getByRole("button", { name: "Show as table" }).click();
    const table = main.getByRole("table", { name: /Which decisions have waited the longest/ });
    for (const header of ["Process", "Waiting", "0-3 days", "4-7 days", "8-14 days", "15+ days", "Longest wait (days)"]) {
      await expect(table.getByRole("columnheader", { name: header }), header).toBeVisible();
    }
    const graduationRow = table.getByRole("row").filter({ has: page.getByText("Graduation Endorsement", { exact: true }) });
    expect(await numberIn(graduationRow.getByRole("cell").nth(1)), "graduation: waiting").toBeGreaterThanOrEqual(1);
    await shot(page, "analytics-1366.png");

    // 390: the page never scrolls sideways (the table scrolls inside its own box).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "analytics-390.png");
  });

  test("Graduation Endorsement: header, tabs, the roster", async ({ page }) => {
    await page.goto("/dean/approvals/graduation");
    await expect(page.getByRole("heading", { level: 1, name: "Graduation Endorsement" })).toBeVisible();
    await expect(page.getByText(/^The Academic Coordinator checks coursework, the Research Coordinator validates research evidence, .*export the approved list for the Registrar\.$/)).toBeVisible(); // CHANGED BY p100 (I-146): the page description says who does what
    const waiting = page.getByRole("main").getByText(/^\d+ waiting$/).first();
    expect(await numberIn(waiting), "the batch is waiting for the Dean").toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("main").getByRole("link", { name: "All approvals" })).toHaveAttribute("href", "/dean/approvals");
    const tabs = page.getByRole("tablist", { name: "Graduation views" });
    await expect(tabs.getByRole("tab", { name: "Roster & workflow" })).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab", { name: "Endorsement batches" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText(/AC checks coursework/)).toHaveCount(0); // CHANGED BY p98 (I-157): the loose "Dean view · AC checks coursework..." line is gone (the staff page says who does what in its description); conE: no card title repeating the page title
    await expect(page.getByText("Isabel Flores").first()).toBeVisible();
    await shot(page, "graduation-roster-1366.png");
  });

  // CHANGED BY p100 (I-146, I-147): "Endorsement batches" is the shared graduation board (the batch columns of the Roster tab),
  // no longer a private list with its own selection bar, "Grouped workflow board", stage-check window and decision window.
  // The stage check, students, Dean decision, print and export are in the batch's "View details" window, like on the Roster tab.
  const BOARD = "Graduation workflow Kanban board";
  const TOGGLE = "Choose how to show the requests";
  const boardOf = (page) => page.getByRole("region", { name: BOARD });
  const cardOf = (page) => boardOf(page).locator("div[draggable]").filter({ hasText: BATCH });
  const columnOf = (page, name) => boardOf(page).locator("section").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });

  test("Endorsement batches: the shared board, the ready batch, View details, table, filter", async ({ page }) => {
    await page.goto("/dean/approvals/graduation");
    await page.getByRole("tab", { name: "Endorsement batches" }).click();
    await expect(page).toHaveURL(/\/dean\/approvals\/graduation\?tab=batches$/);
    await expect(page.getByRole("tab", { name: "Endorsement batches" })).toHaveAttribute("aria-selected", "true");
    const main = page.getByRole("main");
    await expect(boardOf(page)).toBeVisible();
    await expect(main.getByRole("searchbox", { name: "Search list" })).toBeVisible();
    await expect(page.getByRole("group", { name: TOGGLE })).toBeVisible();

    // Batches only: no candidate columns, and the batch sits in "Dean review" with its students, step and owner.
    await expect(boardOf(page).getByRole("heading", { name: "Academically eligible", level: 3 })).toHaveCount(0);
    const card = columnOf(page, "Dean review").locator("div[draggable]").filter({ hasText: BATCH });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("1 candidate");
    await expect(card).toContainText("Students: Isabel Flores");
    await expect(card).toContainText("Step 7: Dean reviews graduation batch");
    await expect(card).toContainText("Next: Dean");
    await expect(card.getByRole("button", { name: /Move to/ })).toBeVisible();
    await expect(card.getByRole("button", { name: `View details for ${BATCH}` })).toBeVisible();
    await shot(page, "batches-ready-1366.png");

    // View details: the stage check, then every student of the batch with the requirement boxes; print is here for the Dean.
    await card.getByRole("button", { name: `View details for ${BATCH}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading").first()).toHaveText(`Graduation stage check for ${BATCH}`);
    await expect(dialog.getByText("Students in this batch")).toBeVisible();
    await expect(dialog).toContainText("Isabel Flores");
    for (const label of ["Coursework completed", "Thesis / research completed", "Practicum not required", "Eligible for graduation"]) {
      await expect(dialog.getByText(label, { exact: true }), label).toBeVisible();
    }
    await expect(dialog.getByRole("button", { name: "Print endorsement" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Approve endorsement list" })).toBeVisible();
    await shot(page, "batches-ready-details-1366.png");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The table lists the same batch, one row per student.
    await page.getByRole("group", { name: TOGGLE }).getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("table").getByRole("row", { name: /Isabel Flores/ })).toHaveCount(1);
    await page.getByRole("group", { name: TOGGLE }).getByRole("button", { name: "Board" }).click();

    // A search that matches nothing leaves the columns and no batch; clearing brings the batch back.
    const search = main.getByRole("searchbox", { name: "Search list" });
    await search.fill("zzzz-no-such-student");
    await expect(boardOf(page)).toBeVisible();
    await expect(cardOf(page)).toHaveCount(0);
    await expect(boardOf(page).getByText("No candidates here").first()).toBeVisible();
    await search.fill("");
    await expect(cardOf(page)).toHaveCount(1);

    // 390: no sideways scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(boardOf(page)).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "batches-ready-390.png");
  });

  // The shared stage check has eight steps (the Roster tab shows the same window).
  const SHARED_STEPS = [
    "Student submits graduation application",
    "GS Staff creates graduation batch",
    "GS Staff forwards batch for coursework review",
    "Academic Coordinator reviews coursework",
    "Research Coordinator validates research and practicum",
    "GS Staff prepares and forwards endorsement",
    "Dean reviews graduation batch",
    "Export Dean-approved list",
  ];
  async function expectSharedStageCheck(page, states) {
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading").first()).toHaveText(`Graduation stage check for ${BATCH}`);
    await expect(dialog.getByText("Follow where this batch is in the graduation endorsement process.")).toBeVisible();
    for (const [index, label] of SHARED_STEPS.entries()) {
      const row = dialog.getByRole("listitem").filter({ hasText: label });
      await expect(row, `step ${index + 1} ${label}`).toHaveCount(1);
      await expect(row, `step ${index + 1} state`).toContainText(states[index]);
      for (const other of ["Complete", "Current", "Pending", "Needs action"].filter((word) => word !== states[index])) {
        await expect(row, `step ${index + 1} is not ${other}`).not.toContainText(other);
      }
    }
  }

  test("the stage check of the ready batch: which steps are complete, current, pending", async ({ page }) => {
    await page.goto("/dean/approvals/graduation?tab=batches");
    await cardOf(page).getByRole("button", { name: `View details for ${BATCH}` }).click();
    await expectSharedStageCheck(page, ["Complete", "Complete", "Complete", "Complete", "Complete", "Complete", "Current", "Pending"]);
    await shot(page, "stage-check-ready-1366.png");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await cardOf(page).getByRole("button", { name: `View details for ${BATCH}` }).click();
    await expectSharedStageCheck(page, ["Complete", "Complete", "Complete", "Complete", "Complete", "Complete", "Current", "Pending"]);
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "stage-check-ready-390.png");
    await page.keyboard.press("Escape");
  });

  test("the Dean decision approves the batch; the approved batch exports a CSV", async ({ page }) => {
    await page.goto("/dean/approvals/graduation?tab=batches");
    await cardOf(page).getByRole("button", { name: `View details for ${BATCH}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve endorsement list" }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading", { level: 2 }).first()).toHaveText("Dean decision");
    await expect(dialog).toContainText("Isabel Flores");
    await dialog.getByRole("button", { name: "Approve endorsement list", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Approve endorsement list applied to 1 candidate" })).toBeVisible();

    // The batch moved from "Dean review" to "Approved, ready to export".
    await expect(columnOf(page, "Dean review").locator("div[draggable]").filter({ hasText: BATCH })).toHaveCount(0);
    const approved = columnOf(page, "Approved, ready to export").locator("div[draggable]").filter({ hasText: BATCH });
    await expect(approved).toHaveCount(1);
    await expect(approved).toContainText("Students: Isabel Flores");
    await shot(page, "batches-approved-1366.png");

    // Its stage check: the seven steps before the export are complete, the export is next.
    await approved.getByRole("button", { name: `View details for ${BATCH}` }).click();
    await expectSharedStageCheck(page, ["Complete", "Complete", "Complete", "Complete", "Complete", "Complete", "Complete", "Current"]);
    await shot(page, "stage-check-approved-1366.png");

    // Export: a CSV is downloaded, the follow-up window names it, and the button becomes "Export approved list again".
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog").getByRole("button", { name: "Export approved list", exact: true }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const followUp = page.getByRole("dialog");
    await expect(followUp.getByRole("heading").first()).toHaveText("Graduation CSV export complete");
    await expect(followUp).toContainText(download.suggestedFilename());
    await expect(followUp).toContainText("Email the endorsed graduation list to the Registrar");
    await shot(page, "export-follow-up-1366.png");
    await followUp.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: `${BATCH} exported as ${download.suggestedFilename()}` })).toBeVisible();
    await expect(approved.getByText("Exported - Ready to Send")).toBeVisible();
    await approved.getByRole("button", { name: `View details for ${BATCH}` }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Export approved list again" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(boardOf(page)).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "batches-approved-390.png");
  });

  test("Activity Log and the analytics table pick up the approval", async ({ page }) => {
    await page.goto("/dean/activity");
    await expect(page.getByRole("heading", { level: 1, name: "Activity Log" })).toBeVisible();
    await expect(page.getByText("Recent decisions recorded against the Dean account, newest first. Each entry keeps its full stage history on the case page.")).toBeVisible();
    const main = page.getByRole("main");

    // The approval is the newest entry: a link to the case, its process, the date and its status.
    const link = main.getByRole("link", { name: /Isabel Flores/ });
    await expect(link).toHaveAttribute("href", /^\/dean\/case\/graduation\/\d+$/);
    const entry = main.locator("li, tr").filter({ has: page.getByRole("link", { name: /Isabel Flores/ }) });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Graduation Endorsement");
    await expect(entry).toContainText("Dean Approved");
    await expect(entry).toContainText(/\w{3} \d{1,2}, \d{4}/);
    const total = await numberIn(main.getByText(/^\d+ entr(y|ies)$/));
    expect(total).toBeGreaterThanOrEqual(1);

    // The Process filter: its options, the graduation entry on its own, and an empty process says so.
    const filter = main.getByLabel("Process");
    await expect(filter.locator("option")).toHaveCount(1 + 7);
    await expect(filter.locator("option").first()).toHaveText("All processes");
    await filter.selectOption({ label: "Graduation Endorsement" });
    await expect(main.getByText("2 entries", { exact: true })).toBeVisible(); // Isabel approved + the seeded Hector Ong endorsement the Dean sent back in setup
    await expect(link).toBeVisible();
    await shot(page, "history-filtered-1366.png");
    for (const label of ["Leave of Absence", "Readmission", "AWOL & Residency", "Subject Withdrawal", "Practicum Reports", "Course Adjustments"]) {
      await filter.selectOption({ label });
      await expect(link, `${label} hides the graduation entry`).toHaveCount(0);
      const count = await numberIn(main.getByText(/^\d+ entr(y|ies)$/));
      if (count === 0) await expect(main.getByText("No decisions recorded yet")).toBeVisible();
      else await expect(main.getByText("No decisions recorded yet")).toHaveCount(0);
    }
    await filter.selectOption({ label: "All processes" });
    await expect(link).toBeVisible();

    await shot(page, "history-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Activity Log" })).toBeVisible();
    await expect(link).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "history-390.png");
    await page.setViewportSize({ width: 1366, height: 768 });

    // CHANGED BY p101 (I-141): the Outcomes tab (its table alternative) counts the approved batch under Approved.
    await page.goto("/dean/analytics?report=outcomes");
    const outcomes = page.getByRole("region", { name: "What was decided?" });
    await outcomes.getByRole("button", { name: "Show as table" }).click();
    const graduationRow = outcomes.getByRole("row").filter({ has: page.getByText("Graduation Endorsement", { exact: true }) });
    expect(await numberIn(graduationRow.getByRole("cell").nth(1)), "graduation: approved").toBeGreaterThanOrEqual(1);
  });
});
