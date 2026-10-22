// Packet P3.3 (Phase 5 design system, dean stream, last packet): pins what the Dean's report pages and the graduation page
// DO that the sweep only photographs, so the restyle of DeanReportPages.jsx and DeanGraduationPage.jsx (and the stage-check
// list in DeanParts.jsx) onto the component library cannot change it. Written against the old code; it must pass on both.
// Through the real UI, as the Dean:
//   - Admission & Coursework Reports: the page and its two report panels;
//   - Reports & Analytics: the four tiles and where they link, the "Decisions by process" table (its columns, one row per
//     process with a link to that process, the live waiting / approved numbers), "Pending load by program";
//   - Graduation Endorsement: the header (waiting badge, "All approvals"), the two tabs, then on "Endorsement batches" the
//     ready batch (candidates, step chip, selection bar, View students, the grouped board, the filter's empty note), its
//     stage-check window (six steps: which are complete, which is current, which is pending), the Dean group action that
//     approves it, the approved batch (stage check all complete, "Export approved list" downloads a CSV and shows the
//     follow-up window, then "Export again");
//   - Decision History: the entry the approval wrote (link to the case, process, status), the process filter and its count.
// Setup (one graduation batch reaching the Dean) goes through each role's own API login, like p31 / p32. It changes data in
// the throwaway harness database and touches only the demo student Isabel Flores (2260007, "Batch 1 October 2026"), whom no
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
const BATCH = "Batch 1 October 2026";
const WINDOW = "AY 2026-2027";

/** Walk Isabel's graduation batch through every role until it is "Ready for Dean Review". */
async function putBatchInFrontOfTheDean(playwright) {
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

const STEPS = [
  ["Compile graduation list", "GS Staff created the candidate batch."],
  ["Academic Coordinator checks course completion", "Coursework completion was checked before Dean review."],
  ["Research Coordinator validates research requirements", "Research completion evidence was validated before endorsement."],
  ["GS Staff prepares endorsement list", "The endorsement list was prepared or revised for Dean action."],
  ["Dean reviews endorsement list", "Dean approves the batch or returns it for revision."],
  ["Export endorsed list", "Dean-approved candidates are available as a CSV download for manual email to the Registrar."],
];

/** The six stage-check steps in the open window, with the state words each one shows. */
async function expectStageCheck(page, states, headerStep) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading").first()).toHaveText(`Graduation stage check for ${BATCH}`);
  await expect(dialog).toContainText(`1 candidate · Step ${headerStep.number}: ${headerStep.label}`);
  await expect(dialog.getByText("Stage check", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Follow where this batch is in the graduation endorsement process.")).toBeVisible();
  await expect(dialog).toContainText(`Step ${headerStep.number}: ${headerStep.state}`);
  for (const [index, [label, detail]] of STEPS.entries()) {
    const row = dialog.getByRole("listitem").filter({ hasText: label });
    await expect(row, `step ${index + 1} ${label}`).toHaveCount(1);
    await expect(row).toContainText(detail);
    await expect(row, `step ${index + 1} state`).toContainText(states[index]);
    for (const other of ["Complete", "Current", "Pending", "Needs action"].filter((word) => word !== states[index])) {
      // only the state word of THIS row's own state may appear (the labels and details never contain the others)
      await expect(row, `step ${index + 1} is not ${other}`).not.toContainText(other);
    }
  }
}

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

  test("Reports & Analytics: tiles, the Decisions by process table, Pending load by program", async ({ page }) => {
    await page.goto("/dean/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
    await expect(page.getByText("Where Dean decisions stand across every process. Figures are computed live from the approvals records.")).toBeVisible();
    const main = page.getByRole("main");

    // The four tiles; three of them open something.
    await expect(main.getByRole("link", { name: /Waiting now/ })).toHaveAttribute("href", "/dean/approvals");
    await expect(main.getByRole("link", { name: /Decided \(recent\)/ })).toHaveAttribute("href", "/dean/activity");
    await expect(main.getByRole("link", { name: /Course plans waiting/ })).toHaveAttribute("href", "/dean/approvals/course-adjustments");
    await expect(main.getByText("Approval share")).toBeVisible();
    await expect(main.getByText("of recent workflow decisions")).toBeVisible();
    await expect(main.getByText("across all processes")).toBeVisible();

    // The table: its six columns, and one row per process with a link to that process.
    await expect(main.getByRole("heading", { level: 2, name: "Decisions by process" })).toBeVisible();
    await expect(main.getByText("Current pending load and recent outcomes")).toBeVisible();
    for (const header of ["Process", "Waiting", "Approved / completed", "Returned", "Denied", "Average wait"]) {
      await expect(main.getByRole("columnheader", { name: header }), header).toBeVisible();
    }
    const processes = {
      "Leave of Absence": "leave-of-absence",
      Readmission: "readmission",
      "AWOL & Residency": "awol",
      "Withdrawal Requests": "withdrawal",
      "Practicum Reports": "practicum",
      "Graduation Endorsement": "graduation",
      "Course Adjustments": "course-adjustments",
    };
    for (const [label, key] of Object.entries(processes)) {
      const link = main.getByRole("row").getByRole("link", { name: label, exact: true });
      await expect(link, `row for ${label}`).toHaveAttribute("href", `/dean/approvals/${key}`);
    }
    await expect(main.getByRole("row")).toHaveCount(1 + Object.keys(processes).length);

    // The graduation row counts the batch that is waiting for the Dean (the first number in the Waiting cell).
    const graduationRow = main.getByRole("row").filter({ has: page.getByRole("link", { name: "Graduation Endorsement", exact: true }) });
    expect(await numberIn(graduationRow.getByRole("cell").nth(1)), "graduation: waiting").toBeGreaterThanOrEqual(1);

    // Pending load by program: MAED has at least the graduation batch waiting.
    await expect(main.getByRole("heading", { level: 2, name: "Pending load by program" })).toBeVisible();
    await expect(main.getByText("Where the waiting requests come from")).toBeVisible();
    const maed = main.getByRole("listitem").filter({ hasText: /^MAED\s*\d+$/ });
    await expect(maed).toHaveCount(1);
    expect(await numberIn(maed), "MAED pending").toBeGreaterThanOrEqual(1);
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
    await expect(page.getByText("Review the endorsement lists prepared by Graduate School staff, approve or return them, then export the approved list for the Registrar.")).toBeVisible();
    const waiting = page.getByRole("main").getByText(/^\d+ waiting$/).first();
    expect(await numberIn(waiting), "the batch is waiting for the Dean").toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("main").getByRole("link", { name: "All approvals" })).toHaveAttribute("href", "/dean/approvals");
    const tabs = page.getByRole("tablist", { name: "Graduation views" });
    await expect(tabs.getByRole("tab", { name: "Roster & workflow" })).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab", { name: "Endorsement batches" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText("Graduation endorsement candidates")).toBeVisible();
    await expect(page.getByText("Isabel Flores").first()).toBeVisible();
    await shot(page, "graduation-roster-1366.png");
  });

  test("Endorsement batches: the ready batch, selection, View students, board, filter", async ({ page }) => {
    await page.goto("/dean/approvals/graduation");
    await page.getByRole("tab", { name: "Endorsement batches" }).click();
    await expect(page).toHaveURL(/\/dean\/approvals\/graduation\?tab=batches$/);
    await expect(page.getByRole("tab", { name: "Endorsement batches" })).toHaveAttribute("aria-selected", "true");
    const main = page.getByRole("main");
    await expect(main.getByRole("searchbox", { name: "Search Dean review lists" })).toBeVisible();

    // The ready batch: its name, size, state, students, step and actions.
    await expect(main.getByText("Ready graduation batches")).toBeVisible();
    await expect(main.getByText("Select or process a whole batch while still seeing every student in it.")).toBeVisible();
    await expect(main.getByText("1 batch", { exact: true })).toBeVisible();
    // The batches are a list, not draggable cards: there is no board to drop them on (I-106).
    await expect(main.locator("[draggable=true]"), "no draggable batch card on this tab").toHaveCount(0);
    const batch = main.getByRole("listitem").filter({ hasText: BATCH }).filter({ hasText: "Ready for Dean review" });
    await expect(batch).toHaveCount(1);
    await expect(batch).toContainText("1 candidate");
    await expect(batch).toContainText("Students: Isabel Flores");
    await expect(batch).toContainText("Dean reviews endorsement list");
    await expect(batch).toContainText("Step 5: Current");
    await expect(batch.getByRole("button", { name: `View graduation stage check for ${BATCH}` })).toBeVisible();
    for (const name of ["View students", "Print endorsement", "Select batch", "Review endorsement list"]) {
      await expect(batch.getByRole("button", { name }), name).toBeVisible();
    }

    // Selection bar: nothing selected; Select all ready selects the candidate and lists them; Clear undoes it.
    await expect(main.getByText("0 graduation candidates selected")).toBeVisible();
    await expect(main.getByRole("button", { name: "Apply Dean group action" })).toBeDisabled();
    await main.getByRole("button", { name: "Select all ready" }).click();
    await expect(main.getByText("1 graduation candidate selected")).toBeVisible();
    await expect(main.getByRole("button", { name: "Apply Dean group action" })).toBeEnabled();
    await expect(main.getByText("Selected graduation candidates").first()).toBeVisible();
    await expect(main.getByText(`Isabel Flores · 2260007 · ${BATCH}`)).toBeVisible();
    await expect(main.getByRole("checkbox", { name: "Select Isabel Flores for Dean group action" })).toBeChecked();
    await shot(page, "batches-selected-1366.png");
    await main.getByRole("button", { name: "Clear selection" }).click();
    await expect(main.getByText("0 graduation candidates selected")).toBeVisible();
    await expect(main.getByRole("checkbox", { name: "Select Isabel Flores for Dean group action" })).not.toBeChecked();

    // The grouped board lists the candidate's card.
    await expect(main.getByText("Grouped workflow board")).toBeVisible();
    await expect(main.getByText("Open a card to review files, history, messages, and role-appropriate actions.")).toBeVisible();
    await expect(main.getByRole("article").filter({ hasText: "Isabel Flores" })).toHaveCount(1);

    // View students: the requirement boxes appear, Hide students closes them.
    await batch.getByRole("button", { name: "View students" }).click();
    await expect(batch.getByRole("button", { name: "Hide students" })).toBeVisible();
    for (const label of ["Coursework completed", "Thesis / research completed", "Practicum not required", "Eligible for graduation"]) {
      await expect(batch.getByText(label), label).toBeVisible();
    }
    await expect(batch).toContainText("2260007 · MAED");
    await shot(page, "batches-ready-1366.png");
    await batch.getByRole("button", { name: "Hide students" }).click();
    await expect(batch.getByText("Thesis / research completed")).toHaveCount(0);

    // A search that matches nothing shows the empty note and no batch; clearing brings the batch back.
    const search = main.getByRole("searchbox", { name: "Search Dean review lists" });
    await search.fill("zzzz-no-such-student");
    await expect(main.getByText("No graduation endorsement batches match these filters.")).toBeVisible();
    await expect(main.getByText("Ready graduation batches")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear 1 filter" }).click();
    await expect(main.getByText("Ready graduation batches")).toBeVisible();

    // 390: no sideways scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(main.getByText("Ready graduation batches")).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "batches-ready-390.png");
  });

  test("the stage check of the ready batch: which steps are complete, current, pending", async ({ page }) => {
    await page.goto("/dean/approvals/graduation?tab=batches");
    await page.getByRole("button", { name: `View graduation stage check for ${BATCH}` }).click();
    await expectStageCheck(
      page,
      ["Complete", "Complete", "Complete", "Complete", "Current", "Pending"],
      { number: 5, label: "Dean reviews endorsement list", state: "Current" },
    );
    await shot(page, "stage-check-ready-1366.png");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: `View graduation stage check for ${BATCH}` }).click();
    await expectStageCheck(
      page,
      ["Complete", "Complete", "Complete", "Complete", "Current", "Pending"],
      { number: 5, label: "Dean reviews endorsement list", state: "Current" },
    );
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "stage-check-ready-390.png");
    await page.keyboard.press("Escape");
  });

  test("the Dean group action approves the batch; the approved batch exports a CSV", async ({ page }) => {
    await page.goto("/dean/approvals/graduation?tab=batches");
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Review endorsement list" }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm Dean graduation group action");
    await expect(dialog).toContainText(`1 selected candidate · ${BATCH} · stage checks apply to every record`);
    await expect(dialog).toContainText("Isabel Flores");
    await dialog.getByRole("button", { name: "Approve endorsement list" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Approve endorsement list applied to 1 candidate(s)" })).toBeVisible();

    // The batch moved from "Ready" to "Approved graduation batches".
    await expect(main.getByText("Ready graduation batches")).toHaveCount(0);
    await expect(main.getByText("Approved graduation batches")).toBeVisible();
    await expect(main.getByText("Export the Dean-approved list, then email it to the Registrar and wait for acknowledgement.")).toBeVisible();
    await expect(main.getByText("1 approved", { exact: true })).toBeVisible();
    const batch = main
      .locator("div")
      .filter({ has: page.getByRole("button", { name: /Export approved list|Export again/ }) })
      .filter({ hasText: "1 approved candidate" })
      .last();
    await expect(batch).toContainText("Students: Isabel Flores");
    await expect(batch).toContainText("Step 6: Complete");
    await expect(batch.getByRole("button", { name: "View students" })).toBeVisible();
    await expect(batch.getByRole("button", { name: "Export approved list" })).toBeVisible();
    await shot(page, "batches-approved-1366.png");

    // Its stage check: every step complete.
    await batch.getByRole("button", { name: `View graduation stage check for ${BATCH}` }).click();
    await expectStageCheck(
      page,
      ["Complete", "Complete", "Complete", "Complete", "Complete", "Complete"],
      { number: 6, label: "Export endorsed list", state: "Complete" },
    );
    await shot(page, "stage-check-approved-1366.png");
    await page.keyboard.press("Escape");

    // Export: a CSV is downloaded, the follow-up window names it, and the button becomes "Export again".
    const [download] = await Promise.all([page.waitForEvent("download"), batch.getByRole("button", { name: "Export approved list" }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const followUp = page.getByRole("dialog");
    await expect(followUp.getByRole("heading").first()).toHaveText("Graduation CSV export complete");
    await expect(followUp).toContainText(download.suggestedFilename());
    await expect(followUp).toContainText("Email the endorsed graduation list to the Registrar");
    await shot(page, "export-follow-up-1366.png");
    await followUp.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: `${BATCH} exported as ${download.suggestedFilename()}` })).toBeVisible();
    await expect(batch.getByRole("button", { name: "Export again" })).toBeVisible();
    await expect(batch).toContainText("Exported");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(main.getByText("Approved graduation batches")).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "batches-approved-390.png");
  });

  test("Decision History and the analytics table pick up the approval", async ({ page }) => {
    await page.goto("/dean/activity");
    await expect(page.getByRole("heading", { level: 1, name: "Decision History" })).toBeVisible();
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
    await expect(main.getByText("1 entry", { exact: true })).toBeVisible();
    await expect(link).toBeVisible();
    await shot(page, "history-filtered-1366.png");
    for (const label of ["Leave of Absence", "Readmission", "AWOL & Residency", "Withdrawal Requests", "Practicum Reports", "Course Adjustments"]) {
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
    await expect(page.getByRole("heading", { level: 1, name: "Decision History" })).toBeVisible();
    await expect(link).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "history-390.png");
    await page.setViewportSize({ width: 1366, height: 768 });

    // The analytics table now counts the approved batch under Approved / completed.
    await page.goto("/dean/analytics");
    const graduationRow = page.getByRole("main").getByRole("row").filter({ has: page.getByRole("link", { name: "Graduation Endorsement", exact: true }) });
    expect(await numberIn(graduationRow.getByRole("cell").nth(2)), "graduation: approved / completed").toBeGreaterThanOrEqual(1);
  });
});
