// e2e-writes: elena-1119-flow, withdrawal-export-queue-1119, graduation-application-queue-1119
// Owner 2026-11-19 (third list), through the real screens on the test database:
//   - resetting a Withdrawal / Graduation demo student fills "Excel export" / "Application submitted" with five others;
//   - Excel export: Select all, then "Create batch and download Excel list" moves the batch to Exported - Ready to Send;
//     "Mark as sent to the Registrar" -> Waiting for Registrar acknowledgement -> "Mark as acknowledged" -> Acknowledged by Registrar;
//   - the request section shows the subject and reason in green boxes for staff and the Dean, and the Dean has no Deny;
//   - after the Dean approves, the student's enrollment page shows a red Withdrawn tag.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const ELENA = "withdrawal.elena@usls.edu.ph";

async function studentIdOf(request, number) {
  const body = await (await request.get(`/api/students?q=${number}`)).json();
  const rows = body.students || body.items || body;
  return rows.find((row) => row.student_number === number)?.id;
}

test.describe.serial("Withdrawal and Graduation demo flows", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("Graduation reset fills Application submitted with five others", async ({ page }) => {
    const id = await studentIdOf(page.request, "2690301");
    expect(id).toBeTruthy();
    expect((await page.request.post("/api/transactions/graduation/demo-reset", { data: { student_id: id } })).ok()).toBeTruthy();
    await page.goto("/workflow/graduation");
    const column = page.locator("section[aria-label='Application submitted']");
    await expect(column.locator("[data-card-id]").first()).toBeVisible();
    expect(await column.locator("[data-card-id]").count()).toBeGreaterThanOrEqual(5);
  });

  test("Withdrawal reset fills Excel export; select all, create batch and download, sent, acknowledged", async ({ page }) => {
    const id = await studentIdOf(page.request, "2690401");
    expect((await page.request.post("/api/transactions/withdrawal/demo-reset", { data: { student_id: id } })).ok()).toBeTruthy();
    await page.goto("/workflow/withdrawal");
    const exportColumn = page.locator("section[aria-label='Excel export']");
    await expect(exportColumn.locator("[data-card-id]").first()).toBeVisible();
    const count = await exportColumn.locator("[data-card-id]").count();
    expect(count).toBeGreaterThanOrEqual(5);
    await exportColumn.getByRole("button", { name: "Select all in this column" }).click();
    const create = exportColumn.getByRole("button", { name: `Create batch and download Excel list (${count})` });
    await expect(create).toBeEnabled();
    await page.context().on("page", (popup) => popup.close().catch(() => {})); // the Gmail draft tab
    const download = page.waitForEvent("download");
    await create.click();
    const confirm = page.getByRole("dialog").last();
    await expect(confirm.getByTestId("confirm-highlights")).toContainText(/Batch \d+ /);
    // UX-40 (2026-11-22): the demo data already holds other batches in these columns, so every later step names this batch.
    const label = (await confirm.getByTestId("confirm-highlights").textContent()).match(/Batch \d+ [A-Z][a-z]+ \d{4}/)[0];
    await confirm.getByRole("button", { name: "Create batch and download" }).click();
    await download;
    // CHANGED BY owner feedback 2026-11-23 (stage 8): wait for the export follow-up window before closing it - pressing Escape
    // before it opened left it open over the board, and the next click hit its backdrop.
    const followUp = page.getByRole("dialog", { name: "Withdrawal Excel export complete" });
    await expect(followUp).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(followUp).toHaveCount(0);
    // The ticked students travel as one batch card from here on (owner 2026-11-19), with the step at the top of the column.
    const exported = page.locator("section[aria-label='Exported - Ready to Send']");
    const batchCard = exported.locator("[data-batch-count]").filter({ hasText: label });
    await expect(batchCard).toHaveAttribute("data-batch-count", String(count));
    await expect(exportColumn.locator("[data-card-id]")).toHaveCount(0);
    const sent = exported.getByRole("button", { name: `Mark as sent to the Registrar: ${label}` });
    await sent.click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Mark as sent to the Registrar" }).click();
    const waiting = page.locator("section[aria-label='Waiting for Registrar acknowledgement']");
    await expect(waiting.locator("[data-batch-count]").filter({ hasText: label })).toHaveAttribute("data-batch-count", String(count));
    await waiting.getByRole("button", { name: `Mark as acknowledged: ${label}` }).click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Mark as acknowledged" }).click();
    await expect(waiting.locator("[data-batch-count]").filter({ hasText: label })).toHaveCount(0);
    await page.getByRole("button", { name: /^Closed\s*\d+$/ }).click(); // UX-29: Acknowledged by Registrar is behind "Closed"
    await expect(page.locator("section[aria-label='Acknowledged by Registrar'] [data-batch-count]").filter({ hasText: label })).toBeVisible();
  });

  test("Elena: green boxes for staff and Dean, no Deny, red Withdrawn tag after approval", async ({ page, browser, playwright }) => {
    const id = await studentIdOf(page.request, "2690401");
    expect((await page.request.post("/api/transactions/withdrawal/demo-reset", { data: { student_id: id } })).ok()).toBeTruthy();
    const student = await playwright.request.newContext({ baseURL: BASE_URL });
    await student.post("/api/auth/login", { data: { email: ELENA, password: PASSWORD } });
    const portal = await (await student.get("/api/student-portal/context")).json();
    const subject = (portal.subject_enrollments || []).find((item) => item.withdrawal_eligible);
    expect(subject).toBeTruthy();
    expect((await student.post("/api/student-portal/requests/withdrawal", { data: { reason: "My work schedule changed.", subject_enrollment_id: subject.id } })).ok()).toBeTruthy();

    await page.goto("/workflow/withdrawal");
    const card = page.locator("section[aria-label='Submitted'] [data-card-id]").filter({ hasText: "Elena Navarro" });
    await card.getByRole("button", { name: /^View details for / }).click();
    const boxes = page.getByRole("dialog").getByTestId("request-highlight");
    await expect(boxes).toHaveCount(2);
    await expect(boxes.first()).toContainText("Subject to be withdrawn");
    await expect(boxes.nth(1)).toContainText("My work schedule changed.");
    const cases = (await (await page.request.get("/api/process-cases?slug=withdrawal")).json()).cases;
    const elena = cases.find((item) => item.student.name.includes("Elena") && item.status === "Submitted to GS Staff");
    expect((await page.request.post(`/api/process-cases/withdrawal/${elena.id}/transition`, { data: { action: "forward" } })).ok()).toBeTruthy();

    const dean = await browser.newContext({ storageState: authFile("dean"), viewport: { width: 1366, height: 900 } });
    const deanPage = await dean.newPage();
    await deanPage.goto("/dean/approvals/withdrawal");
    const deanCard = deanPage.locator("section[aria-label='With the Dean'] [data-card-id]").filter({ hasText: "Elena Navarro" });
    await expect(deanCard).toHaveAttribute("data-fresh", "true");
    await deanCard.getByRole("button", { name: /^View details for / }).click();
    const deanDialog = deanPage.getByRole("dialog");
    await expect(deanDialog.getByTestId("request-highlight")).toHaveCount(2);
    await expect(deanDialog.getByRole("button", { name: /Deny/ })).toHaveCount(0);
    await deanDialog.getByRole("button", { name: /Approve the withdrawal/ }).first().click();
    await deanPage.getByRole("dialog").last().getByRole("button", { name: /Approve the withdrawal/ }).click();
    await expect(deanPage.getByTestId("board-notice")).toBeVisible();
    await dean.close();

    const studentBrowser = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
    await studentBrowser.request.post("/api/auth/login", { data: { email: ELENA, password: PASSWORD } });
    const studentPage = await studentBrowser.newPage();
    await studentPage.goto("/student/enrollment");
    const tag = studentPage.getByTestId("withdrawn-tag");
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveAttribute("data-status-tone", "danger");
    await studentBrowser.close();
  });
});
