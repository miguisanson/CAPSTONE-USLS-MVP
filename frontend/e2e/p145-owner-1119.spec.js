// e2e-writes: none
// Owner 2026-11-19 (Withdrawal, Practicum and Graduation only). Every write is answered by the browser (page.route), so
// nothing is saved. The server side is tested in tests/test_owner_1119.py.
//   Practicum  The Academic Coordinator saves the verified hours first: until then "Request additional certificates" is grey
//              (disabled); saving keeps the case window open and turns the button green; the request says the student's
//              Practicum Document submission has been reopened.
//   Boards     Withdrawal, Practicum and Graduation cards never move to another column by hand (no "Move to..."), they can be
//              reordered inside their column (draggable, up/down buttons).
//   Graduation Ticking candidates in "Application submitted" shows "Create graduation batch" in that column.
// Second list (same day): withdrawal confirm windows show the subject and reason in their own boxes (student, staff, Dean);
// no Deny anywhere for a withdrawal; the student's enrollment page tags a withdrawn subject in red; the Withdrawal board has
// "Waiting for Registrar acknowledgement"; the batch popup can open each student's submitted application.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("Practicum: hours first, then additional certificates", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });
  test.afterEach(async ({ page }) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.unrouteAll({ behavior: "ignoreErrors" }); });

  test("the request button is grey until the hours are saved, then green; the request reopens the student's submission", async ({ page }) => {
    const writes = [];
    let verified = null;
    let status = "Documents Under Review";
    await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const row = body.roster.find((item) => item.student.student_number === "2690201");
      row.record = {
        id: 9100, student_id: row.student.id, status, moa_status: "Verified", moa_uploaded: true,
        practicum_site: "Community Counselling Center", supervisor_name: "Ms. Rina Lopez", required_hours: 200,
        completed_hours: 150, reported_hours: 150, verified_hours: verified,
        document_status: "Pending Review", certificate_count: 1, remarks: "", completion_status: "Pending",
        coordinator_review_status: "Under Review", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
        completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
      };
      row.hours_status = verified != null && verified >= 200 ? "Complete" : "Incomplete";
      row.documents_status = "Pending Review";
      row.has_submitted_documents = true;
      row.next_action_owner = "Academic Coordinator";
      row.messages = [];
      row.history = [];
      await route.fulfill({ response, json: body });
    });
    await page.route("**/api/transactions/practicum", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const body = JSON.parse(route.request().postData() || "{}");
      writes.push(body);
      if (body.status === "Record Verified Hours") verified = Number(body.verified_hours);
      if (body.status === "Additional Certificates Requested") status = "Additional Certificates Requested";
      return route.fulfill({ json: { ok: true, message: "Spec: saved." } });
    });
    await page.goto("/workflow/practicum");
    const board = page.getByRole("region", { name: "Practicum workflow board" });
    const card = board.getByRole("article").filter({ hasText: "Andrea Villanueva" });
    await card.getByRole("button", { name: "View details for Andrea Villanueva" }).click();
    const dialog = page.getByRole("dialog");
    const request = dialog.getByRole("button", { name: "Request additional certificates" });
    await expect(request, "grey until the hours are saved").toBeDisabled();
    await expect(dialog.getByText("Save the verified hours first.")).toBeVisible();

    await dialog.getByLabel(/^Verified hours/).fill("150");
    await dialog.getByRole("button", { name: "Save verified hours" }).click();
    await expect(dialog.getByText(/Verified hours saved \(150\)/), "the case window stays open").toBeVisible();
    await expect(request, "green once the hours are saved").toBeEnabled();
    await expect(request).toHaveClass(/btn-primary/);

    await request.click();
    const confirm = page.getByRole("dialog", { name: /Confirm: Request additional certificates/ });
    await confirm.getByRole("textbox").fill("Upload the certificate for the remaining 50 hours.");
    await confirm.getByRole("button", { name: "Request additional certificates" }).click();
    await expect(page.getByText(/Practicum Document submission has been reopened for a new submission/)).toBeVisible();
    expect(writes.map((body) => body.status)).toEqual(["Record Verified Hours", "Additional Certificates Requested"]);
  });
});

for (const { label, path, region, role } of [
  { label: "Withdrawal", path: "/workflow/withdrawal", region: "Subject withdrawal board", role: "staff" },
  { label: "Practicum", path: "/workflow/practicum", region: "Practicum workflow board", role: "staff" },
  { label: "Graduation", path: "/workflow/graduation", region: "Graduation workflow Kanban board", role: "staff" },
]) {
  test.describe(`${label} board: no moving to another column by hand`, () => {
    test.use({ storageState: authFile(role), viewport: { width: 1366, height: 768 } });

    test(`${label}: no Move to..., cards can be dragged inside their column`, async ({ page }) => {
      await page.goto(path);
      const board = page.getByRole("region", { name: region });
      await expect(board).toBeVisible();
      await expect(board.getByRole("button", { name: /Move to/ })).toHaveCount(0);
      const cards = board.locator("[data-card-id]");
      expect(await cards.count()).toBeGreaterThan(0);
      await expect(cards.first()).toHaveAttribute("draggable", "true");
      await expect(page.getByTestId("board-summary")).toContainText("moves to the next column by itself");
    });
  });
}

test.describe("Graduation: Create graduation batch sits in Application submitted", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("Select all in this column shows the Create graduation batch button there", async ({ page }) => {
    await page.goto("/workflow/graduation");
    const board = page.getByRole("region", { name: "Graduation workflow Kanban board" });
    await expect(board.locator("[data-card-id]").first()).toBeVisible();
    const column = board.getByRole("region", { name: "Application submitted" }).or(board.locator("section[aria-label='Application submitted']"));
    const selectAll = column.getByRole("button", { name: "Select all in this column" });
    test.skip((await selectAll.count()) === 0, "the seed has no submitted application right now");
    await expect(column.getByRole("button", { name: /^Create graduation batch/ })).toHaveCount(0);
    await selectAll.click();
    const create = column.getByRole("button", { name: /^Create graduation batch \(\d+\)$/ });
    await expect(create).toBeVisible();
    await create.click();
    await expect(page.getByRole("dialog").getByRole("heading").first()).toContainText("Create batch");
  });
});

test.describe("Withdrawal: green means new and waiting on you (Dean)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("a request with the Dean is green for the Dean; the staff columns are not", async ({ page }) => {
    await page.goto("/dean/approvals/withdrawal");
    const board = page.getByRole("region", { name: "Subject withdrawal board" });
    await expect(board).toBeVisible();
    const withDean = board.locator("section[aria-label='With the Dean'] [data-card-id]");
    test.skip((await withDean.count()) === 0, "nothing waits on the Dean in this data");
    await expect(withDean.first()).toHaveAttribute("data-fresh", "true");
    await expect(withDean.first().getByText("New for you")).toBeVisible();
    await expect(board.locator("section[aria-label='Submitted'] [data-fresh='true']")).toHaveCount(0);
  });
});

test.describe("Withdrawal confirm windows show the subject and the reason in their own boxes", () => {
  test("the student's Send this request? window", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
    expect((await context.request.post("/api/auth/login", { data: { email: "withdrawal.elena@usls.edu.ph", password: PASSWORD } })).ok()).toBeTruthy();
    const page = await context.newPage();
    await page.route("**/api/student-portal/requests/withdrawal", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
    await page.goto("/student/requests/withdrawal");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const subject = page.locator("#withdrawal-subject");
    test.skip((await subject.count()) === 0, "Elena has a request already in this data");
    const value = await subject.locator("option:not([disabled])").nth(1).getAttribute("value");
    test.skip(!value, "no eligible subject in this data");
    await subject.selectOption(value);
    await page.locator("#withdrawal-reason").fill("My work schedule changed.");
    await page.getByRole("button", { name: /Submit withdrawal request/ }).click();
    const boxes = page.getByTestId("confirm-highlights");
    await expect(boxes).toBeVisible();
    await expect(boxes).toContainText("Subject to be withdrawn");
    await expect(boxes).toContainText("Reason for withdrawing");
    await expect(boxes).toContainText("My work schedule changed.");
    await page.getByRole("button", { name: "Cancel" }).click();
    await context.close();
  });

  for (const [role, path, column] of [["staff", "/workflow/withdrawal", "Submitted"], ["dean", "/dean/approvals/withdrawal", "With the Dean"]]) {
    test(`${role}: the step window and no Deny`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: authFile(role), viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      await page.route(/\/api\/process-cases\/withdrawal\/[^/]+\/transition/, (route) => route.abort());
      await page.goto(path);
      await expect(page.locator("[data-card-id]").first()).toBeVisible();
      const card = page.locator(`section[aria-label='${column}'] [data-card-id]`).first();
      test.skip((await card.count()) === 0, `nothing in ${column}`);
      await card.getByRole("button", { name: /^View details for / }).click();
      const detail = page.getByRole("dialog").first();
      await expect(detail.getByRole("button", { name: /Deny/ })).toHaveCount(0);
      await detail.getByRole("button", { name: role === "staff" ? /Record and forward to Dean/ : /Approve the withdrawal/ }).first().click();
      const facts = page.getByTestId("withdrawal-facts");
      await expect(facts).toBeVisible();
      await expect(facts).toContainText("Subject to be withdrawn");
      await expect(facts).toContainText("Reason for withdrawing");
      await context.close();
    });
  }

  test("the Dean's Approvals queue offers no Deny for a withdrawal", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("dean"), viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const body = await (await page.request.get("/api/process-cases?slug=withdrawal")).json();
    for (const item of body.cases) expect(item.actions.map((action) => action.action)).not.toContain("deny");
    await context.close();
  });
});

test.describe("Withdrawal: Registrar columns", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });
  test("Exported, Waiting for Registrar acknowledgement and Acknowledged by Registrar are separate columns", async ({ page }) => {
    await page.goto("/workflow/withdrawal");
    const board = page.getByRole("region", { name: "Subject withdrawal board" });
    for (const label of ["Exported - Ready to Send", "Waiting for Registrar acknowledgement", "Acknowledged by Registrar"]) {
      await expect(board.locator(`section[aria-label='${label}']`)).toHaveCount(1);
    }
    const exported = board.locator("section[aria-label='Exported - Ready to Send']");
    if (await exported.locator("[data-card-id]").count()) {
      await expect(exported.getByRole("button", { name: /^Mark as sent to the Registrar: / }).first()).toBeVisible();
    }
  });
});

test.describe("Student enrollment page: a withdrawn subject is tagged in red", () => {
  test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 900 } });
  test("Withdrawn tag", async ({ page }) => {
    await page.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const subjects = body.curriculum_subjects || [];
      if (subjects[0]) Object.assign(subjects[0], { status: "Withdrawn", is_enrolled: false });
      await route.fulfill({ response, json: body });
    });
    await page.goto("/student/enrollment");
    const tag = page.getByTestId("withdrawn-tag").first();
    await expect(tag).toHaveText(/Withdrawn/);
    await expect(tag).toHaveAttribute("data-status-tone", "danger");
  });
});

test.describe("Graduation batch popup: View submitted document", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });
  test("each candidate with a file has the button", async ({ page }) => {
    await page.goto("/workflow/graduation");
    await expect(page.locator("[data-card-id]").first()).toBeVisible();
    const selectAll = page.getByRole("button", { name: "Select all in this column" });
    test.skip((await selectAll.count()) === 0, "no submitted application");
    await selectAll.click();
    await page.getByRole("button", { name: /^Create graduation batch \(/ }).click();
    const dialog = page.getByRole("dialog");
    const link = dialog.getByRole("link", { name: /View the submitted graduation application of/ }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
  });
});

test.describe("Practicum: a card is green again when it reaches Completion review", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 900 } });
  test("opened at Documents review (white), then green in Completion review", async ({ page }) => {
    let status = "Documents Under Review";
    await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const row = body.roster.find((item) => item.student.student_number === "2690201");
      row.record = {
        id: 9101, student_id: row.student.id, status, moa_status: "Verified", moa_uploaded: true, practicum_site: "Center",
        supervisor_name: "Ms. Lopez", required_hours: 200, completed_hours: 200, reported_hours: 200, verified_hours: 200,
        document_status: status === "Completed" ? "Verified" : "Pending Review", certificate_count: 1, remarks: "", completion_status: "Pending",
        coordinator_review_status: "Under Review", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
        completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
      };
      Object.assign(row, { hours_status: "Complete", documents_status: "Pending Review", has_submitted_documents: true, next_action_owner: "Academic Coordinator", messages: [], history: [] });
      await route.fulfill({ response, json: body });
    });
    await page.goto("/workflow/practicum");
    const card = () => page.locator("[data-card-id]").filter({ hasText: "Andrea Villanueva" });
    await expect(card()).toHaveAttribute("data-fresh", "true");
    await card().getByRole("button", { name: "View details for Andrea Villanueva" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300); // the "opened" mark is saved on the next render
    await page.reload();
    await expect(card()).not.toHaveAttribute("data-fresh", "true");
    status = "Completed"; // the Coordinator's "Verify completion" moved it to Completion review
    await page.reload();
    await expect(page.locator("section[aria-label='Completion Review']").locator("[data-card-id]").filter({ hasText: "Andrea Villanueva" })).toHaveAttribute("data-fresh", "true");
  });
});

test.describe("Owner 2026-11-19 (fifth list)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("Withdrawal: checkboxes only in Excel export; the Registrar step is a button on the batch card", async ({ page }) => {
    await page.goto("/workflow/withdrawal");
    const board = page.getByRole("region", { name: "Subject withdrawal board" });
    await expect(board.locator("[data-card-id]").first()).toBeVisible();
    // Owner 2026-11-19: checkboxes only in "Excel export" (forwarding and the Dean's decision are one request at a time).
    for (const column of ["Submitted", "With the Dean", "Subject tagging"]) {
      const section = board.locator(`section[aria-label='${column}']`);
      await expect(section.getByRole("checkbox"), column).toHaveCount(0);
      await expect(section.getByRole("button", { name: /Select all in this column/ }), column).toHaveCount(0);
    }
    for (const column of ["Exported - Ready to Send", "Waiting for Registrar acknowledgement"]) {
      const section = board.locator(`section[aria-label='${column}']`);
      // no step buttons loose in the column: each sits inside a batch card
      const loose = await section.getByRole("button", { name: /^Mark as (sent to the Registrar|acknowledged):/ }).evaluateAll((nodes) => nodes.filter((node) => !node.closest("[data-batch-count]")).length);
      expect(loose, column).toBe(0);
    }
  });

  test("Withdrawal (Dean): no checkbox in With the Dean", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("dean"), viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    await page.goto("/dean/approvals/withdrawal");
    await expect(page.locator("[data-card-id]").first()).toBeVisible();
    await expect(page.locator("section[aria-label='With the Dean']").getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator("section[aria-label='With the Dean']").getByRole("button", { name: /Select all in this column/ })).toHaveCount(0);
    await context.close();
  });

  test("Practicum: the newest card is at the top of its column", async ({ page }) => {
    let newest = "";
    await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.roster.forEach((row) => { row.last_activity_at = "2026-01-01T08:00:00Z"; if (row.record) row.record.updated_at = "2026-01-01T08:00:00Z"; });
      const rows = body.roster.filter((row) => row.record).slice(0, 3);
      rows.forEach((row, index) => {
        row.record.status = "Practicum In Progress";
        row.last_activity_at = `2026-10-0${index + 1}T08:00:00Z`; // the last row is the newest
      });
      newest = rows[rows.length - 1]?.student.name || "";
      await route.fulfill({ response, json: body });
    });
    await page.goto("/workflow/practicum");
    const column = page.locator("section[aria-label='In Progress']");
    await expect(column.locator("[data-card-id]").first()).toBeVisible();
    expect(newest).toBeTruthy();
    await expect(column.locator("[data-card-id]").first()).toContainText(newest);
  });
});
