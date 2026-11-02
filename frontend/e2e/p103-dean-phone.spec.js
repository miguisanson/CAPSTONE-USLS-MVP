// e2e-writes: none
// Packet deanux (I-189..I-194, I-196; found by the persona test "Dean on a phone" and "staff in a hurry"). Written BEFORE
// the change; red on the old code. Through the real UI at 390 and 1366 px. Reads only: every number is read from the API at
// test time, the one write (the graduation list export) is answered by page.route and the roster is edited in the browser,
// so no other spec's data matters.
//   I-189  the Dean's Reports: a tile opens the students behind it, and a "Students by stage" tab counts the active students
//          per stage (each count opens its students), built from the active-students list the Dean may read;
//   I-190  Dean Graduation on a phone is a stacked list of cards (no ten-column board), and "Export approved list" is on the
//          page (not only inside a batch window), disabled with a reason while no batch is approved;
//   I-191  a decision page pins its buttons in a footer (like the graduation detail window) and the policy text folds away;
//   I-192  the student record's Course audit tiles open the subjects they count;
//   I-193  numbers that measure different things say so in their labels;
//   I-194  on a phone the Reports filters fold into a "Filters (n)" button so the numbers come first;
//   I-196  the Dean's case page names the case in the tab title and the breadcrumb; the staff dashboard's Leave of Absence
//          link opens the board on the open requests, with the preset in view.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p103");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const PERIOD = "term=last-12-months";
const BATCH = "Batch 1 October 2026";
const VIEWS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 768 },
];

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
async function getJson(page, path) {
  const res = await page.request.get(path);
  expect(res.status(), `GET ${path}`).toBe(200);
  return res.json();
}

// ------------------------------------------------------------------ I-189, I-193 (Dean Reports), I-194
for (const view of VIEWS) {
  test.describe(`Dean Reports at ${view.width}`, () => {
    test.use({ storageState: authFile("dean"), viewport: { width: view.width, height: view.height } });

    test("a tile opens its students, and Students by stage counts the active students per stage (I-189)", async ({ page }) => {
      const behind = await getJson(page, `/api/reports/summary/behind?${PERIOD}`);
      const active = await getJson(page, `/api/reports/summary/active?${PERIOD}`);
      await page.goto("/dean/analytics");
      await page.getByRole("button", { name: /Behind schedule/ }).click();
      const dialog = page.getByRole("dialog", { name: "Behind schedule" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(`${behind.count} rows`, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("table").getByRole("row").nth(1)).toContainText(behind.rows[0].student);
      await dialog.getByRole("button", { name: "Close Behind schedule" }).click();

      await page.getByRole("tab", { name: "Students by stage", exact: true }).click();
      await expect(page.getByRole("heading", { name: "How many active students are at each stage?" })).toBeVisible();
      const perStage = {};
      for (const row of active.rows) perStage[row.stage] = (perStage[row.stage] || 0) + 1;
      await page.getByRole("button", { name: "Show as table" }).click();
      for (const [stage, count] of Object.entries(perStage)) {
        await expect(page.getByRole("button", { name: `Show ${count} students in ${stage}`, exact: true }), `${stage}: ${count}`).toBeVisible();
      }
      const [stage, count] = Object.entries(perStage).sort((a, b) => b[1] - a[1])[0];
      await page.getByRole("button", { name: `Show ${count} students in ${stage}`, exact: true }).click();
      const list = page.getByRole("dialog");
      await expect(list.getByText(`${count} rows`, { exact: true })).toBeVisible();
      await shot(page, `reports-stage-list-${view.width}.png`);
      expect(await noOverflow(page)).toBe(true);
    });

    test("numbers that measure different things say so in their labels (I-193)", async ({ page }) => {
      await page.goto("/dean/analytics");
      const strip = page.getByRole("group", { name: "Summary numbers" });
      await expect(strip.getByRole("button", { name: /Requests waiting more than 7 days \(all offices\)/ })).toBeVisible();
      await expect(strip.getByRole("button", { name: /Active students/ })).toContainText("Standing Active, not completed or withdrawn");
      await page.goto("/dean");
      await expect(page.getByText("Waiting on you over 7 days", { exact: true })).toBeVisible();
    });
  });
}

test.describe("Reports filters on a phone (I-194)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  test("the filters fold into Filters (n) and the numbers show first", async ({ page }) => {
    await page.goto("/dean/analytics");
    const strip = page.getByRole("group", { name: "Summary numbers" });
    await expect(strip).toBeVisible();
    const button = page.getByRole("button", { name: /^Filters \(0\)/ });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Program")).toBeHidden();
    const top = await strip.evaluate((el) => el.getBoundingClientRect().top);
    expect(top, "the first number starts in the first screen, not below three big filters").toBeLessThan(420);
    await shot(page, "reports-filters-closed-390.png");
    await button.click();
    await expect(page.getByLabel("Program")).toBeVisible();
    await page.getByLabel("Program").selectOption({ index: 1 });
    await expect(page.getByRole("button", { name: /^Filters \(1\)/ })).toBeVisible();
    await shot(page, "reports-filters-open-390.png");
  });

  test("at desktop width the filters stay in view and there is no Filters button", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/dean/analytics");
    await expect(page.getByLabel("Program")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters \(/ })).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ I-190 Dean Graduation
/** Isabel's batch is approved and waits for the export; Hector's batch is with the Research Coordinator. */
async function mockGraduation(page, { approved = true } = {}) {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const isabel = body.roster.find((row) => row.student.name === "Isabel Flores");
    const status = approved ? "Dean Approved" : "Ready for Dean Review";
    isabel.endorsement = { ...isabel.endorsement, id: 987100, batch_name: BATCH, endorsement_status: status, display_status: status, registrar_status: "Pending" };
    isabel.next_action_owner = approved ? "Dean (export)" : "Dean";
    const hector = body.roster.find((row) => row.student.name === "Hector Ong");
    hector.endorsement = { ...isabel.endorsement, id: 987101, batch_name: "Batch 2 October 2026", endorsement_status: "Research Review", display_status: "Research Review", registrar_status: "Pending" };
    hector.has_submitted_documents = true;
    hector.next_action_owner = "Research Coordinator";
    await route.fulfill({ response, json: body });
  });
}

test.describe("Dean Graduation on a phone (I-190)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  test("a stacked list of cards instead of a ten-column board, with the export on the page", async ({ page }) => {
    await mockGraduation(page);
    let exportBody = null;
    await page.route(/\/graduation\/endorsed\.csv/, async (route) => {
      exportBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="endorsed-list.csv"' }, body: "student\nIsabel Flores\n" });
    });
    await page.goto("/dean/approvals/graduation");
    const list = page.getByRole("region", { name: "Graduation candidates by stage" });
    await expect(list).toBeVisible();
    await expect(page.getByRole("region", { name: "Graduation workflow Kanban board" })).toHaveCount(0);
    await expect(page.getByText(/more stages? to the right/)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Choose how to show the requests" })).toHaveCount(0);
    await expect(list.getByRole("heading", { name: /Approved, ready to export/ })).toBeVisible();
    await expect(list.getByRole("button", { name: `View details for ${BATCH}` })).toBeVisible();
    expect(await noOverflow(page), "the page does not scroll sideways").toBe(true);
    await shot(page, "dean-graduation-390.png");

    const exportButton = page.getByRole("main").getByRole("button", { name: "Export approved list", exact: true });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect(page.getByRole("dialog", { name: "Graduation CSV export complete" })).toBeVisible();
    expect(exportBody?.endorsement_ids, "the export asks for the approved batch").toEqual([987100]);
  });

  test("with no batch approved the export is there, disabled, and says why", async ({ page }) => {
    await mockGraduation(page, { approved: false });
    await page.goto("/dean/approvals/graduation");
    const exportButton = page.getByRole("main").getByRole("button", { name: "Export approved list", exact: true });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeDisabled();
    await expect(page.getByText("No batch is approved yet", { exact: false })).toBeVisible();
  });
});

test.describe("Dean Graduation on a desktop (I-190)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("the board stays, and the export is on the page", async ({ page }) => {
    await mockGraduation(page);
    await page.goto("/dean/approvals/graduation");
    await expect(page.getByRole("region", { name: "Graduation workflow Kanban board" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Graduation candidates by stage" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: "Export approved list", exact: true })).toBeEnabled();
  });
});

// ------------------------------------------------------------------ I-191, I-196 Dean case page
async function leaveCaseOf(page) {
  const data = await getJson(page, "/api/approvals");
  const item = data.workflow_pending.find((x) => x.type === "leave-of-absence" && x.case?.policy_review?.checks?.length);
  expect(item, "a Leave of Absence case waits for the Dean").toBeTruthy();
  return item;
}

for (const view of VIEWS) {
  test.describe(`Dean case page at ${view.width}`, () => {
    test.use({ storageState: authFile("dean"), viewport: { width: view.width, height: view.height } });

    test("Approve, Return and Deny are pinned in a footer, the policy check folds away (I-191)", async ({ page }) => {
      const item = await leaveCaseOf(page);
      await page.goto(`/dean/case/${item.type}/${item.id}`);
      const decision = page.getByRole("group", { name: "Decision" });
      await expect(decision).toBeVisible();
      await expect(decision.getByRole("button", { name: /^Approve/ })).toBeInViewport();
      await expect(decision.getByRole("button", { name: "Return for revision" })).toBeInViewport();
      await expect(decision.getByRole("button", { name: "Deny", exact: true })).toBeInViewport();
      const pinned = await page.getByTestId("decision-footer").evaluate((el) => getComputedStyle(el).position);
      expect(pinned).toBe("sticky");
      // still pinned after scrolling to the end of the page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(decision.getByRole("button", { name: /^Approve/ })).toBeInViewport();

      const policy = page.getByRole("button", { name: /^Policy check/ });
      await expect(policy).toBeVisible();
      const firstCheck = item.case.policy_review.checks[0].label;
      if (view.width < 640) {
        await expect(policy).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByText(firstCheck, { exact: true })).toBeHidden();
        await policy.click();
      }
      await expect(policy).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText(firstCheck, { exact: true })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `dean-case-${view.width}.png`);
    });

    test("the tab title and the breadcrumb name the case (I-196)", async ({ page }) => {
      const item = await leaveCaseOf(page);
      await page.goto(`/dean/case/${item.type}/${item.id}`);
      const name = `${item.student.name} · Leave of Absence`;
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await expect.poll(() => page.title()).toContain(name);
      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.locator("[aria-current='page']")).toHaveText(name);
      if (view.width >= 768) await expect(crumbs.getByRole("link", { name: "Approvals Queue" })).toBeVisible();
    });
  });
}

// ------------------------------------------------------------------ I-196 staff dashboard -> filtered board
test.describe("Staff dashboard Leave of Absence link (I-196)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("opens the board on the open requests, with the preset in view and a way to clear it", async ({ page }) => {
    const cases = await getJson(page, "/api/process-cases?slug=leave-of-absence");
    await page.goto("/");
    const link = page.getByRole("link", { name: "Open Leave of Absence" }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/workflow\/leave-of-absence\?show=open/);
    const preset = page.getByRole("button", { name: /Open requests only/ });
    await expect(preset).toBeVisible();
    const closed = new Set(["Closed", "Approved", "Expired", "Denied", "Withdrawn", "Cancelled"]);
    const open = cases.cases.filter((c) => !closed.has(c.status)).length;
    await expect(page.getByText(new RegExp(`Showing ${open} of ${cases.cases.length} requests`))).toBeVisible();
    await preset.click();
    await expect(page.getByText(new RegExp(`Showing ${cases.cases.length} of ${cases.cases.length} requests`))).toBeVisible();
    await expect(page).not.toHaveURL(/show=open/);
  });
});

// ------------------------------------------------------------------ I-193 staff dashboard vs Reports
test.describe("Staff active students (I-193)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("the dashboard says which 'active' it counts, and Reports says its own", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/\d+ with Active standing/)).toBeVisible();
    await page.goto("/reports");
    await expect(page.getByRole("group", { name: "Summary numbers" }).getByRole("button", { name: /Active students/ })).toContainText("Standing Active, not completed or withdrawn");
  });
});

// ------------------------------------------------------------------ I-192 student record
test.describe("Student record Course audit (I-192)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("the Completed tile opens the subjects it counts", async ({ page }) => {
    const student = await getJson(page, "/api/students/1");
    const audit = student.course_audit;
    expect(audit.completed.length, "student 1 has completed subjects").toBeGreaterThan(0);
    await page.goto("/students/1");
    const tile = page.getByRole("button", { name: new RegExp(`^Completed ${audit.completed.length}`) });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute("aria-expanded", "false");
    await tile.click();
    await expect(tile).toHaveAttribute("aria-expanded", "true");
    const list = page.getByRole("region", { name: `Completed subjects (${audit.completed.length})` });
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(audit.completed.length);
    await expect(list).toContainText(audit.completed[0].code);
    await expect(list).toContainText(audit.completed[0].title);
    await shot(page, "student-course-audit-1366.png");
    await tile.click();
    await expect(list).toHaveCount(0);
  });

  test("a tile with nothing behind it is only a number", async ({ page }) => {
    const student = await getJson(page, "/api/students/1");
    expect(student.course_audit.missing.length).toBe(0);
    await page.goto("/students/1");
    await expect(page.getByRole("button", { name: /^Missing 0/ })).toHaveCount(0);
    await expect(page.getByText("Missing", { exact: true })).toBeVisible();
  });
});
