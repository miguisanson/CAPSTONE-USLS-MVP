// e2e-writes: none
// Packet khloe-ui (owner 2026-11-04: "the graduation endorsement and the practicum had batch stuff.. I want khloe's work back").
// Pins the structure of Khloe's Graduation Endorsement and Practicum screens (branch v4.1-khloe, WorkflowPage.jsx), now on today's
// API and actions. Written BEFORE the port; red on the code that replaced her screens (commit c7e60a5).
//   Graduation, staff and Dean (the same roster component serves both):
//     - a "Created graduation batches" overview: one row per batch with its stage check (Step n, done/8) and an eye button;
//     - the two candidate columns are numbered (1, 2) and say what they hold;
//     - a candidate card shows the four requirement boxes and the completed-courses line;
//     - a batch card shows Students:, Next:, the stage-check strip, "View students", "Select batch" and the step button;
//     - "View students" opens the student list with each student's requirement boxes;
//     - the stage check window lists the eight steps (staff, Academic Coordinator, Research Coordinator, Dean...);
//     - the Dean's batch waiting for review says so on the card.
//   Practicum, staff and Dean: the scope note, a card with site, hours, submitted/updated dates, Next:, View and Message.
// Every write is answered by page.route or never made: nothing is saved.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p119");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const BOARD = "Graduation workflow Kanban board";
const BATCH = "Batch 1 October 2026";
const OTHER = "Batch 2 October 2026";
const byName = (roster, name) => roster.find((row) => row.student.name === name);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

/** Same scenario for every role: Carlo applied, Isabel's batch is new, Hector's batch is with the Research Coordinator. */
async function mockGraduation(page, isabelStatus = "For Review") {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const roster = json.roster;
    const carlo = byName(roster, "Carlo Mendoza");
    Object.assign(carlo, { has_submitted_documents: true, application_submitted: true, application_status: "Application Submitted", next_action_owner: "Graduate School Staff", endorsement: null });
    const isabel = byName(roster, "Isabel Flores");
    isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: isabelStatus, display_status: isabelStatus, registrar_status: "Pending" };
    isabel.next_action_owner = { "For Review": "Graduate School Staff", "Ready for Dean Review": "Dean", "Dean Approved": "Dean (export)" }[isabelStatus] || "Graduate School Staff";
    isabel.has_submitted_documents = true;
    const hector = byName(roster, "Hector Ong");
    hector.endorsement = { ...isabel.endorsement, id: 987001, batch_name: OTHER, endorsement_status: "Research Review", display_status: "Research Review", registrar_status: "Pending" };
    hector.has_submitted_documents = true;
    hector.next_action_owner = "Research Coordinator";
    await route.fulfill({ response, json });
  });
}

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });

for (const [role, path] of [["staff", "/workflow/graduation"], ["dean", "/dean/approvals/graduation"]]) {
  test.describe(`Khloe graduation as ${role}`, () => {
    test.use({ storageState: authFile(role), viewport: { width: 1366, height: 768 } });

    test("the batch overview lists each batch with its stage check", async ({ page }) => {
      await mockGraduation(page);
      await page.goto(path);
      const overview = page.getByRole("region", { name: "Created graduation batches" });
      await expect(overview).toBeVisible();
      await expect(overview).toContainText(/\d+ batches/);
      const showAll = overview.getByRole("button", { name: /^Show all/ });
      if (await showAll.count()) await showAll.click(); // the overview lists four batches until asked for the rest (the seed's history may hold fewer)
      for (const [label, step] of [[BATCH, "Step 3"], [OTHER, "Step 5"]]) {
        const row = overview.getByRole("listitem").filter({ hasText: label });
        await expect(row, label).toHaveCount(1);
        await expect(row).toContainText("1 candidate");
        await expect(row).toContainText(step);
        await expect(row.getByRole("button", { name: `Open stage check for ${label}` })).toBeVisible();
      }
      await expect(overview.getByRole("listitem").filter({ hasText: BATCH })).toContainText("Next: Graduate School Staff");
      await shot(page, `${role}-1366.png`);
    });

    test("candidate columns are numbered, candidate cards carry the four requirement boxes and the completed-courses line", async ({ page }) => {
      await mockGraduation(page);
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      const first = column(board, "Academically eligible");
      await expect(first.getByTestId("stage-number")).toHaveText("1");
      await expect(column(board, "Application submitted").getByTestId("stage-number")).toHaveText("2");
      await expect(first.locator("header p")).toContainText(/signed application/i);
      const bianca = first.locator("article").filter({ hasText: "Bianca Santos" });
      await expect(bianca).toHaveCount(1);
      const boxes = bianca.locator('[aria-label="Completed graduation requirements"]');
      await expect(boxes).toBeVisible();
      for (const label of ["Coursework completed", "Thesis / research completed", "Eligible for graduation"]) {
        await expect(boxes.getByText(label, { exact: true }), label).toBeVisible();
      }
      await expect(boxes.getByText(/^Practicum (completed|not required)$/)).toBeVisible();
      await expect(bianca.getByText("Completed courses:")).toBeVisible();
      // the later columns carry no number
      await expect(column(board, "Batch created").getByTestId("stage-number")).toHaveCount(0);
    });

    test("a batch card: students, next, stage strip, View students, Select batch and the step; the list opens in place", async ({ page }) => {
      await mockGraduation(page);
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      const card = board.locator("article").filter({ hasText: BATCH });
      await expect(card).toHaveCount(1);
      await expect(card.getByText("Students:")).toBeVisible();
      await expect(card).toContainText("Isabel Flores");
      await expect(card.getByText(/^Next:/).first()).toBeVisible();
      const strip = card.getByRole("group", { name: "Stage check" });
      await expect(strip).toContainText(/Step 3/);
      await expect(strip.getByTestId("stage-progress")).toBeVisible();
      await expect(card.getByRole("button", { name: "View students" })).toBeVisible();
      // the Dean ticks nothing: the Dean acts on one batch at a time
      if (role === "staff") await expect(card.getByRole("button", { name: "Select batch" })).toBeVisible();
      else await expect(card.getByRole("button", { name: "Select batch" })).toHaveCount(0);
      if (role === "staff") await expect(card.getByRole("button", { name: "Forward to Academic Coordinator" })).toBeVisible();
      await card.getByRole("button", { name: "View students" }).click();
      const list = card.getByRole("list").filter({ hasText: "Isabel Flores" });
      await expect(list).toBeVisible();
      await expect(list.locator('[aria-label="Completed graduation requirements"]')).toBeVisible();
      await expect(card.getByRole("button", { name: "Hide students" })).toBeVisible();
      await shot(page, `${role}-students-1366.png`);
    });

    test("the stage check window lists the eight steps", async ({ page }) => {
      await mockGraduation(page);
      await page.goto(path);
      await page.getByRole("region", { name: BOARD }).getByRole("button", { name: `View details for ${BATCH}` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading").first()).toHaveText(`Graduation stage check for ${BATCH}`);
      const steps = dialog.getByRole("listitem").filter({ has: dialog.page().locator("span", { hasText: /^[1-8]$/ }) });
      expect(await steps.count()).toBe(8);
      for (const text of ["Student submits graduation application", "Academic Coordinator reviews coursework", "Research Coordinator validates research and practicum", "Dean reviews graduation batch"]) {
        await expect(dialog.getByText(text, { exact: true }), text).toBeVisible();
      }
      await shot(page, `${role}-stagecheck-1366.png`);
    });
  });
}

test.describe("Khloe graduation: the Dean's batch", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("a batch waiting for the Dean says so and offers the decision on the card", async ({ page }) => {
    await mockGraduation(page, "Ready for Dean Review");
    await page.goto("/dean/approvals/graduation?tab=batches");
    const card = page.getByRole("region", { name: BOARD }).locator("article").filter({ hasText: BATCH });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Ready for Dean review", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Approve endorsement list" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Created graduation batches" })).toContainText("Ready for Dean review");
  });
});

test.describe("Khloe graduation at 390 px", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("overview and cards fit the screen", async ({ page }) => {
    await mockGraduation(page);
    await page.goto("/workflow/graduation");
    await expect(page.getByRole("region", { name: "Created graduation batches" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Graduation candidates by stage" })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "staff-390.png");
  });
});

/** One practicum case with a record, a message and a ready-for-Dean report, so the card has every fact. */
async function mockPracticum(page) {
  await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const row = body.roster.find((item) => item.student.student_number === "2690201");
    row.record = {
      id: 9100, student_id: row.student.id, status: "MOA Submitted", moa_status: "Uploaded", moa_uploaded: true,
      practicum_site: "Community Counselling Center", supervisor_name: "Ms. Rina Lopez", required_hours: 200, completed_hours: 40,
      document_status: "Missing", certificate_count: 0, remarks: "MOA for review.", completion_status: "Pending",
      coordinator_review_status: "Pending", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
      completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
    };
    row.moa_status = "Uploaded";
    row.documents_status = "Missing";
    row.has_submitted_documents = true;
    row.last_activity_at = "2026-10-20T08:00:00Z";
    row.next_action_owner = "Graduate School Staff";
    row.messages = [{ id: 1, comment: "Please add the supervisor's signature.", created_at: "2026-10-20T09:00:00Z" }];
    row.history = [];
    await route.fulfill({ response, json: body });
  });
}

test.describe("Khloe practicum as staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("scope note, the card with its facts, View and Message", async ({ page }) => {
    await mockPracticum(page);
    await page.goto("/workflow/practicum");
    const main = page.locator("main");
    await expect(main.getByText("Program scope: Psychology and MSGC only")).toBeVisible();
    const board = main.getByRole("region", { name: "Practicum workflow board" });
    const card = board.getByRole("article").filter({ hasText: "Andrea Villanueva" });
    await expect(card).toContainText("Community Counselling Center");
    await expect(card).toContainText("40 hrs reported, not verified");
    await expect(card).toContainText("Submitted");
    await expect(card).toContainText("Updated");
    await expect(card.getByText("1 visible message")).toBeVisible();
    await expect(card.getByText(/^Next: Graduate School Staff/)).toBeVisible();
    await expect(card.getByRole("button", { name: "View details for Andrea Villanueva" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Message Andrea Villanueva" })).toBeVisible();
    await card.getByRole("button", { name: "Message Andrea Villanueva" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await shot(page, "practicum-staff-1366.png");
  });

  test("390 px: the board and the page fit", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPracticum(page);
    await page.goto("/workflow/practicum");
    await expect(page.getByRole("region", { name: /Practicum/ }).first()).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "practicum-staff-390.png");
  });
});

test.describe("Khloe practicum as the Dean", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("a report waiting for the Dean is marked ready on its card, with site, hours and Next", async ({ page }) => {
    await page.route(/\/api\/approvals(\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const base = body.workflow_overview.find((item) => item.type === "practicum") || {};
      body.workflow_overview = [
        ...body.workflow_overview.filter((item) => item.type !== "practicum"),
        {
          ...base, type: "practicum", id: 9101, request_id: 9101, status: "Report Sent to Dean", workflow_status: "Report Sent to Dean",
          next_action_owner: "Dean", title: "Practicum report", subtitle: "Practicum",
          student: { id: 99101, name: "Tess Waitingdean", student_number: "GS-9101", program_code: "MAPSY" },
          record: { completed_hours: 200, required_hours: 200, practicum_site: "Counselling Center" }, messages: [], history: [],
        },
      ];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/dean/approvals/practicum");
    const card = page.getByRole("region", { name: "Practicum workflow board" }).getByRole("article").filter({ hasText: "Tess Waitingdean" });
    await expect(card.getByText("Ready for Dean review", { exact: true })).toBeVisible();
    await expect(card).toContainText("Counselling Center");
    await expect(card).toContainText("200/200 hrs");
    await expect(card.getByText("Next: Dean")).toBeVisible();
    await shot(page, "practicum-dean-1366.png");
  });
});

// The pictures for the design review (IM15): staff graduation, Dean graduation and the practicum board at three widths.
for (const [name, role, path, mock] of [
  ["staff-graduation", "staff", "/workflow/graduation", mockGraduation],
  ["dean-graduation", "dean", "/dean/approvals/graduation", (page) => mockGraduation(page, "Ready for Dean Review")],
  ["staff-practicum", "staff", "/workflow/practicum", mockPracticum],
]) {
  test.describe(`pictures: ${name}`, () => {
    test.use({ storageState: authFile(role) });
    test(`${name} at 1366, 1920 and 390 px`, async ({ page }) => {
      await mock(page);
      for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(await noOverflow(page), `${name} at ${width}px scrolls sideways`).toBe(true);
        await shot(page, `pic-${name}-${width}.png`);
      }
    });
  });
}
