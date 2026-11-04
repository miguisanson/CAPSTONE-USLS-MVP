// e2e-writes: lianne, elena-navarro
// Edit anything, with history (owner request 2026-11-04, .planning/edit-history/CONTRACT.md): through the real screens, a
// typo in a request field or a chat message is fixed, the text shows an "Edited" chip, the chip opens the history (before,
// after, who, when, why), and an edit the server refuses shows its reason.
//   Leave of Absence  Lianne Mercado (course-adjustments-lianne) files a leave; as the student she fixes the circumstances
//                     (reason needed) and a chat message (no reason needed while it is new); once staff have forwarded the
//                     request, the stale Edit button is refused with the plain-English reason and the text stays.
//   Subject withdrawal  Elena Navarro (withdrawal-elena) files a withdrawal; Graduate School staff correct the student's reason in
//                     the case window (reason needed) and a staff chat message (own message), and read the history.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const TERM = "AY 2026-2027 2nd Semester";
const TERM_AFTER = "AY 2027-2028 1st Semester";
const LIANNE = "adjustments.lianne@usls.edu.ph";
const ELENA = "withdrawal.elena@usls.edu.ph";

async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

/** A browser context signed in through the API with its own session. */
async function signedIn(browser, email, viewport = { width: 1366, height: 900 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  expect((await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } })).ok(), `sign in as ${email}`).toBeTruthy();
  return { context, page: await context.newPage() };
}

const field = (page, name) => page.locator(`[data-edit-field="${name}"]`).first();

/** Open the edit window of one field, type the new text and the reason, save. */
async function editField(page, name, text, reason) {
  await field(page, name).getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  const boxes = dialog.locator("textarea, input[type=text], input:not([type])");
  await boxes.first().fill(text);
  if (reason) await dialog.getByLabel(/Reason for the change/).fill(reason);
  return dialog;
}

test.describe("p116 edit anything with history", () => {
  test("Leave of Absence: the student fixes a request field and a chat message, then a stale edit is refused", async ({ browser, playwright }) => {
    const student = await playwright.request.newContext({ baseURL: BASE_URL });
    await okJson(await student.post("/api/auth/login", { data: { email: LIANNE, password: PASSWORD } }), "Lianne signs in");
    await okJson(
      await student.post("/api/student-portal/requests/leave-of-absence", {
        data: { effective_start: TERM, effective_end: TERM_AFTER, reason_category: "Medical / health", reason_remarks: "Surgery and recovry." },
      }),
      "Lianne files a leave",
    );
    await okJson(
      await student.post("/api/transactions/leave-of-absence/messages", {
        data: { comment: "Pleese tell me what to bring.", recipient_role: "Graduate School Staff", action_type: "note", template: "Remarks" },
      }),
      "Lianne writes to staff",
    );

    const { context, page } = await signedIn(browser, LIANNE);
    await page.goto("/student/requests/leave-of-absence");
    await expect(page.getByText("Surgery and recovry.")).toBeVisible();

    // 1. A request field: the reason is required, so Save stays off until it is given.
    const dialog = await editField(page, "reason_text", "Surgery and recovery.", "");
    await expect(dialog.getByRole("button", { name: "Save change" })).toBeDisabled();
    await dialog.getByLabel(/Reason for the change/).fill("Fixed a typo");
    await dialog.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(field(page, "reason_text")).toContainText("Surgery and recovery.");
    const chip = field(page, "reason_text").locator("[data-edit-chip]");
    await expect(chip).toHaveText("Edited");
    await chip.click();
    const history = page.getByRole("dialog");
    await expect(history.getByRole("heading", { name: /Change history/ })).toBeVisible();
    await expect(history).toContainText("Surgery and recovry.");
    await expect(history).toContainText("Surgery and recovery.");
    await expect(history).toContainText("Reason: Fixed a typo");
    await history.getByRole("button", { name: "Close", exact: true }).first().click();

    // 2. A chat message: the author fixes it while it is new, with no reason.
    await page.goto("/student/messages");
    await expect(page.getByText("Pleese tell me what to bring.")).toBeVisible();
    const messageDialog = await editField(page, "comment", "Please tell me what to bring.", "");
    await expect(messageDialog.getByRole("button", { name: "Save change" })).toBeEnabled();
    await messageDialog.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Please tell me what to bring.")).toBeVisible();
    await expect(field(page, "comment").locator("[data-edit-chip]")).toHaveText("Edited");

    // 3. Staff forward the request; the Edit button on this open page is stale, so the save is refused with the reason.
    await page.goto("/student/requests/leave-of-absence");
    await expect(field(page, "reason_text").getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const staff = await playwright.request.newContext({ baseURL: BASE_URL });
    await okJson(await staff.post("/api/auth/login", { data: { email: "staff@usls.edu.ph", password: PASSWORD } }), "staff sign in");
    const cases = await okJson(await staff.get("/api/leave-cases?slug=leave-of-absence"), "staff list");
    const lianne = JSON.stringify(cases).includes("Lianne");
    expect(lianne).toBeTruthy();
    const caseId = (cases.items || cases.cases || []).find((item) => item.student?.name?.includes("Lianne"))?.id;
    expect(caseId, "Lianne's case id").toBeTruthy();
    await okJson(await staff.post(`/api/leave-cases/${caseId}/transition`, { data: { action: "forward", eligibility_result: "Eligible" } }), "staff forward");
    const stale = await editField(page, "reason_text", "Surgery, recovery and rest.", "Adding detail");
    await stale.getByRole("button", { name: "Save change" }).click();
    await expect(stale.getByRole("alert")).toContainText("Graduate School staff have already acted on this request");
    await stale.getByRole("button", { name: "Cancel" }).click();
    await expect(field(page, "reason_text")).toContainText("Surgery and recovery.");

    await context.close();
    await Promise.all([student.dispose(), staff.dispose()]);
  });

  test("Subject withdrawal: staff correct the student's reason and their own message, and read the history", async ({ browser, playwright }) => {
    const staffApi = await playwright.request.newContext({ baseURL: BASE_URL });
    await okJson(await staffApi.post("/api/auth/login", { data: { email: "staff@usls.edu.ph", password: PASSWORD } }), "staff sign in");

    const student = await playwright.request.newContext({ baseURL: BASE_URL });
    await okJson(await student.post("/api/auth/login", { data: { email: ELENA, password: PASSWORD } }), "Elena signs in");
    const portal = await okJson(await student.get("/api/student-portal/context"), "Elena's portal");
    const subject = (portal.subject_enrollments || []).find((item) => item.withdrawal_eligible);
    expect(subject, "an eligible subject for Elena").toBeTruthy();
    await okJson(
      await student.post("/api/student-portal/requests/withdrawal", {
        data: { reason: "I cannot attend the clases.", subject_enrollment_id: subject.id },
      }),
      "Elena files a withdrawal",
    );
    const me = await okJson(await student.get("/api/auth/me"), "Elena me");
    const name = me.user.full_name || me.user.name;
    await okJson(
      await staffApi.post("/api/transactions/withdrawal/messages", {
        data: { student_id: portal.student?.id || me.user.student_id, comment: "Pleese bring your slip.", recipient_role: "Student", action_type: "note", template: "Remarks" },
      }),
      "staff writes to Elena",
    );

    const { context, page } = await signedIn(browser, "staff@usls.edu.ph");
    await page.goto("/workflow/withdrawal");
    await page.getByRole("button", { name: `View details for ${name}`, exact: true }).click();
    const caseWindow = page.getByRole("dialog");
    await expect(caseWindow.getByRole("heading", { name: "The request", exact: true })).toBeVisible();

    // The student's reason: staff may correct it, with a reason of their own.
    await field(page, "reason").getByRole("button", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("dialog").last();
    await editor.locator("textarea").first().fill("I cannot attend the classes.");
    await editor.getByLabel(/Reason for the change/).fill("Typo, confirmed with the student");
    await editor.getByRole("button", { name: "Save change" }).click();
    await expect(field(page, "reason")).toContainText("I cannot attend the classes.");
    const chip = field(page, "reason").locator("[data-edit-chip]");
    await expect(chip).toHaveText("Edited");
    await chip.click();
    const history = page.getByRole("dialog").last();
    await expect(history).toContainText("I cannot attend the clases.");
    await expect(history).toContainText("Typo, confirmed with the student");
    await history.getByRole("button", { name: "Close", exact: true }).first().click();

    // Staff's own chat message: within 15 minutes no reason is needed.
    await field(page, "comment").getByRole("button", { name: "Edit", exact: true }).click();
    const messageEditor = page.getByRole("dialog").last();
    await messageEditor.locator("textarea").first().fill("Please bring your slip.");
    await messageEditor.getByRole("button", { name: "Save change" }).click();
    await expect(field(page, "comment")).toContainText("Please bring your slip.");
    await expect(field(page, "comment").locator("[data-edit-chip]")).toHaveText("Edited");

    await context.close();
    await Promise.all([student.dispose(), staffApi.dispose()]);
  });
});
