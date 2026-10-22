// Packet P3.1 (Phase 5 design system, dean stream): pins what the Dean's case page DOES, so the restyle onto
// Modal / DataTable / StatusChip / DecisionPanel / HistoryPanel cannot change it. It was written against the old
// code and must pass on both. Through the real UI, as the Dean:
//   - the approvals list shows the case and its "View details" link opens the case card;
//   - "Return for revision" with no comment is blocked: no confirmation window, no request to the server, a message
//     says a comment or reason is needed;
//   - with a comment it opens a confirmation window titled "Confirm: Return for revision" that shows the comment;
//     Escape closes it and decides nothing; confirming returns the case to the process list with the server's message;
//   - the decided case is read-only ("No Dean decision is due at this stage.") and its history ("View logs") has the
//     entry the decision wrote;
//   - "Mark reviewed" needs no comment, asks to confirm in a window titled after the button, and its history entry shows.
// Setup (the practicum report reaching the Dean) goes through each role's own API login, like section-j.spec.js.
// It changes data in the throwaway harness database and touches only the demo student Andrea Villanueva
// (practicum-andrea), whom no other spec uses.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = join(SCREENS_DIR, "..", "p31-dean");
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

/** A one-page PDF with real text. */
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  const stream = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td", ...lines.map((l) => `(${esc(l)}) Tj T*`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
const pdfFile = (name, lines) => ({ name, mimeType: "application/pdf", buffer: makePdf(lines) });

const STUDENT = "Andrea Villanueva";
const STUDENT_EMAIL = "practicum.andrea@usls.edu.ph";

/** Take Andrea from a fresh practicum to "Report Sent to Dean" (the only state the Dean can decide on). */
async function practicumToDean(playwright) {
  // The reset needs a signed-in session (I-055), as the sign-in page does it.
  const reset = await apiAs(playwright, "staff@usls.edu.ph");
  await okJson(await reset.post("/api/auth/demo-students/practicum-andrea/reset", { data: {} }), "reset practicum-andrea");
  await reset.dispose();

  const student = await apiAs(playwright, STUDENT_EMAIL);
  const me = await okJson(await student.get("/api/auth/me"), "me");
  const studentId = me.user.student_id;
  expect(studentId, "Andrea's student id").toBeTruthy();
  const attach = async (file) =>
    okJson(await student.post("/api/student-portal/request-attachments/upload", { multipart: { request_type: "practicum", file } }), `upload ${file.name}`);
  const attachmentId = (body) => body.attachment?.id ?? body.id ?? body.item?.id;

  const moa = attachmentId(await attach(pdfFile("Andrea_Villanueva_Signed_MOA.pdf", ["Memorandum of Agreement - Practicum"])));
  await okJson(
    await student.post("/api/student-portal/requests/practicum", {
      data: { attachment_id: moa, practicum_site: "Community Counselling Center", supervisor_name: "Ms. Rina Lopez", remarks: "MOA for review." },
    }),
    "student submits MOA",
  );
  const staff = await apiAs(playwright, "staff@usls.edu.ph");
  const coordinator = await apiAs(playwright, "academic@usls.edu.ph");
  const step = (ctx, status) => async () =>
    okJson(await ctx.post("/api/transactions/practicum", { data: { student_id: studentId, status } }), `practicum -> ${status}`);
  await step(staff, "MOA Under Review")();
  await step(coordinator, "Practicum In Progress")();
  // The student submits the completion documents; staff forward them; the coordinator records completion and sends the
  // report. After the Dean returns a report ("Additional Certificates Requested") the same walk starts again.
  const send = async () => {
    const certificate = attachmentId(
      await attach(pdfFile("Andrea_Villanueva_Practicum_Certificates.pdf", ["Practicum Hours Certificates", "200 of 200 hours completed"])),
    );
    await okJson(
      await student.post("/api/student-portal/requests/practicum", {
        data: { certificate_attachment_id: certificate, completed_hours: 200, remarks: "All 200 hours." },
      }),
      "student submits completion documents",
    );
    await step(staff, "Documents Under Review")();
    await step(coordinator, "Completed")();
    await step(coordinator, "Report Sent to Dean")();
  };
  await send();
  return { send, dispose: () => Promise.all([student.dispose(), staff.dispose(), coordinator.dispose()]) };
}

test.describe("P3.1 Dean decisions on a case card", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("return needs a comment and confirms; mark reviewed confirms; history shows each decision", async ({ page, playwright }) => {
    mkdirSync(SHOTS, { recursive: true });
    const setup = await practicumToDean(playwright);
    const decideCalls = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/approvals\/workflow\/practicum\/\d+\/decide$/.test(request.url())) {
        decideCalls.push(request.postDataJSON());
      }
    });

    // 1. The list shows the case; View details opens the card.
    await page.goto("/dean/approvals/practicum");
    // (conA I-122: the page is the shared board now - the report is a card, opened with "View details".)
    const card = page.getByRole("article").filter({ hasText: STUDENT });
    await expect(card.first()).toBeVisible();
    await expect(card.first()).toContainText("Report Sent to Dean");
    await card.first().getByRole("link", { name: /View details/ }).click();
    await expect(page).toHaveURL(/\/dean\/case\/practicum\/\d+$/);
    const caseId = page.url().match(/practicum\/(\d+)$/)[1];
    await expect(page.getByText(STUDENT).first()).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "case-card-1366.png"), fullPage: true });

    // 2. Return for revision without a comment: blocked.
    const returnButton = page.getByRole("button", { name: "Return for revision" });
    await returnButton.scrollIntoViewIfNeeded();
    await returnButton.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /comment|reason/i }).first()).toBeVisible();
    expect(decideCalls, "no decision request was sent").toEqual([]);
    await expect(returnButton).toBeEnabled();

    // 3. With a comment: a confirmation window titled after the button and showing the comment. Escape decides nothing.
    const comment = "Please attach the missing hour certificate.";
    await page.getByLabel(/Review comment/i).first().fill(comment);
    await returnButton.click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Return for revision");
    await expect(dialog).toContainText(comment);
    await page.screenshot({ path: join(SHOTS, "confirm-return-1366.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(decideCalls, "Escape decided nothing").toEqual([]);
    await expect(page.getByLabel(/Review comment/i).first()).toHaveValue(comment);

    // 4. Confirm: the server gets decision + comment, the Dean lands on the process list with the server's message.
    await returnButton.click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Return for revision" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dean\/approvals\/practicum$/);
    await expect(page.getByText("Practicum status returned by Dean").first()).toBeVisible();
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]).toMatchObject({ decision: "return", note: comment });

    // 5. The decided case is read-only and its history has the entry.
    await page.goto(`/dean/case/practicum/${caseId}`);
    await expect(page.getByText("No Dean decision is due at this stage.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Return for revision" })).toHaveCount(0);
    await page.getByRole("button", { name: /View logs/ }).click();
    await expect(page.getByRole("button", { name: /Hide logs/ })).toBeVisible();
    await expect(page.getByText("Practicum status returned by Dean").first()).toBeVisible();
    await expect(page.getByText(comment).first()).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "history-open-1366.png"), fullPage: true });

    // 6. Send the report to the Dean again and mark it reviewed: no comment needed, a window titled after the button.
    await setup.send();
    await page.goto(`/dean/case/practicum/${caseId}`);
    const approve = page.getByRole("button", { name: "Mark reviewed" });
    await approve.scrollIntoViewIfNeeded();
    await approve.click();
    const confirmDialog = page.getByRole("dialog").last();
    await expect(confirmDialog.getByRole("heading").first()).toHaveText("Confirm: Mark reviewed");
    await expect(confirmDialog.getByText("Approve current stage")).toHaveCount(0);
    await confirmDialog.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dean\/approvals\/practicum$/);
    await expect(page.getByText("Practicum status reviewed by Dean").first()).toBeVisible();
    expect(decideCalls).toHaveLength(2);
    expect(decideCalls[1]).toMatchObject({ decision: "review", note: "" });

    await page.goto(`/dean/case/practicum/${caseId}`);
    await page.getByRole("button", { name: /View logs/ }).click();
    await expect(page.getByText("Practicum status reviewed by Dean").first()).toBeVisible();
    await expect(page.getByText("Practicum status returned by Dean").first()).toBeVisible();
    await setup.dispose();
  });
});
