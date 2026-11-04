// e2e-writes: none
// Packet F (consistency, student side): the student request pages behave alike.
//   I-149  "Request sent" stays on the page after Withdrawal / Practicum / Graduation / AWOL return are sent; AWOL locks on "Return Submitted"
//   I-150  every student request asks "Send this request?" with a short summary before it goes; Course Adjustments asks before submit and publish
//   I-151  where the student cannot withdraw a request, one visible line says who to contact
//   I-153  the Research Gate form checks its answers itself (noValidate + the error summary)
//   I-176  a student never reads developer text ("No AI key is set ... Add a Gemini key")
//   I-178  outside the withdrawal window the form is replaced by a notice; the Request Center uses the sidebar's heading
//
// Read-only and order-independent (see e2e/DATA-OWNERSHIP.md): every state is the REAL portal context plus the state under
// test (page.route), and EVERY write is answered by the browser, so nothing reaches the database.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL, SCREENS_DIR } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const EMAIL = "student@usls.edu.ph";
const SHOTS = process.env.P99_SHOTS || join(SCREENS_DIR, "..", "p99-student-requests");
mkdirSync(SHOTS, { recursive: true });
const PDF = { name: "spec.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 spec") };

/**
 * Signs in as the demo student. `mutate(data, writes)` edits the real portal context; `writes` lets it change the state once a
 * request was "sent" (the way the server would after the write). Every write is answered here and recorded.
 */
async function studentPage(browser, mutate) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), `sign in as ${EMAIL}`).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email, { message: "signed in" }).toBe(EMAIL);
  const info = { studentId: null };
  const writes = [];
  await context.route("**/api/student-portal/context", async (route) => {
    try {
      const response = await route.fetch();
      const data = await response.json();
      info.studentId = data.student.id;
      mutate?.(data, writes);
      await route.fulfill({ response, json: data });
    } catch (error) {
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    }
  });
  await context.route("**/api/student-portal/requests/*", async (route) => {
    const request = route.request();
    let body = null;
    try { body = JSON.parse(request.postDataBuffer()?.toString("latin1") || ""); } catch { /* empty */ }
    writes.push({ path: new URL(request.url()).pathname.replace("/api/student-portal/", ""), body });
    await route.fulfill({ json: { message: "Spec: request saved." } });
  });
  await context.route("**/api/student-portal/request-attachments/upload", (route) => route.fulfill({ json: { attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf", file_exists: true } } }));
  const page = await context.newPage();
  const close = context.close.bind(context);
  context.close = async () => {
    for (const open of context.pages()) await open.waitForLoadState("networkidle").catch(() => {});
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await close();
  };
  return { context, page, writes, info };
}

const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function ctl(page, label) {
  const name = new RegExp(`^${esc(label)}(\\s*\\*)?\\s*$`);
  return page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: name }) }).locator("select, input:not([type=file]), textarea").first();
}
const submitButton = (page, name) => page.getByRole("button", { name, exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Send this request?" });
/** Screenshot at 1366 and at 390, then back to 1366. */
async function snap(page, name) {
  for (const [width, height] of [[1366, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const sentNote = (page) => page.getByRole("status").filter({ hasText: "Spec: request saved." });
/** The one line that says who to contact (I-151). */
const contactLine = (page) => page.locator("main").getByText("You cannot cancel this request yourself.");

const ENROLLED = (id, code, extra = {}) => ({
  id, course_code: code, course_title: `Spec ${code}`, term_label: "AY 2026-2027 1st Semester", status: "Enrolled", withdrawal_eligible: true,
  withdrawal_window: { eligible: true, deadline: "2026-11-20", status: "Withdrawal window open", term_start_date: "2026-11-07", fee_consequence: "Spec fee: 10% of the term's total is charged.", rule_source: "Spec Handbook p. 49", policy: "Spec policy: withdraw before the deadline." },
  ...extra,
});
const CLOSED = (id, code) => ENROLLED(id, code, { withdrawal_eligible: false, withdrawal_window: { eligible: false, deadline: "2026-01-23", status: "Withdrawal window closed", term_start_date: "2026-01-10", fee_consequence: "Spec: 100% of the fees.", rule_source: "Spec Handbook p. 49", policy: "Spec closed policy." } });
const SENT_WITHDRAWAL = { id: 31, status: "For Review", dean_decision: null, reason: "Spec: schedule clash.", subject_enrollment_id: 901, created_at: "2026-11-09T09:00:00", updated_at: "2026-11-09T09:00:00", subject: { course_code: "SPEC-101", course_title: "Spec SPEC-101", term_label: "AY 2026-2027 1st Semester" }, withdrawal_window: { deadline: "2026-11-20", status: "Withdrawal window open", fee_consequence: "Spec fee: 10%." }, attachments: [] };

test.describe("P99 student requests behave alike", () => {
  test("Withdrawal: Submit asks first (subject, semester, fee), Cancel sends nothing, the sent notice and the contact line stay", async ({ browser }) => {
    const { context, page, writes, info } = await studentPage(browser, (d, w) => {
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.subject_enrollments = [ENROLLED(901, "SPEC-101")];
      d.withdrawal_application = w.length ? SENT_WITHDRAWAL : null;
    });
    try {
      await page.goto("/student/requests/withdrawal");
      const main = page.locator("main");
      await expect(contactLine(page), "nothing sent yet: no contact line").toHaveCount(0);
      await ctl(page, "Reason for withdrawing from this subject").fill("Spec: schedule clash.");
      await submitButton(page, "Submit withdrawal request").click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page)).toContainText("SPEC-101");
      await expect(dialog(page)).toContainText("AY 2026-2027 1st Semester");
      await expect(dialog(page)).toContainText("Spec fee: 10% of the term's total is charged.");
      await snap(page, "withdrawal-confirm");
      await dialog(page).getByRole("button", { name: "Cancel" }).click();
      await expect(dialog(page)).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(writes, "Cancel sends nothing").toHaveLength(0);
      await submitButton(page, "Submit withdrawal request").click();
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toBeVisible();
      expect(writes.at(-1).body).toEqual({ student_id: info.studentId, reason: "Spec: schedule clash.", subject_enrollment_id: 901 });
      // the form is gone (a request exists now) and the notice is still there
      await expect(main.getByRole("heading", { level: 3, name: "Your withdrawal request" })).toBeVisible();
      await expect(sentNote(page)).toBeVisible();
      await expect(contactLine(page)).toBeVisible();
      await expect(main.getByRole("link", { name: "Open your Messages" })).toHaveAttribute("href", "/student/messages");
      await snap(page, "withdrawal-sent");
    } finally {
      await context.close();
    }
  });

  test("Return from AWOL: asks first, the sent notice stays, 'Return Submitted' locks the form", async ({ browser }) => {
    const { context, page, writes } = await studentPage(browser, (d, w) => {
      d.student.standing = "AWOL";
      d.student.enrollment_tag = "AWOL";
      d.standalone_cases = { ...(d.standalone_cases || {}), awol: [] };
      d.awol_return = { last_enrolled_term: "AY 2026-2027 1st Semester", return_semester_options: ["AY 2026-2027 2nd Semester", "AY 2027-2028 1st Semester"], default_return_term: null };
      d.awol_case = w.length ? { id: 5, status: "Return Submitted", last_enrolled_term: "AY 2026-2027 1st Semester", return_intent: "Spec intention.", return_reason: "Spec reason." } : null;
    });
    try {
      await page.goto("/student/requests/awol-return");
      await ctl(page, "Intended return semester").selectOption("AY 2027-2028 1st Semester");
      await ctl(page, "Written intention to resume enrollment").fill("Spec intention.");
      await ctl(page, "Reason for returning and readiness to continue").fill("Spec reason.");
      await submitButton(page, "Submit return declaration").click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page)).toContainText("AY 2027-2028 1st Semester");
      expect(writes).toHaveLength(0);
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toBeVisible();
      await expect(page.locator("main")).toContainText("Your return declaration has already been routed for review.");
      await expect(submitButton(page, "Submit return declaration")).toHaveCount(0);
      await expect(sentNote(page)).toBeVisible();
      await expect(contactLine(page)).toBeVisible();
      await snap(page, "awol-sent");
    } finally {
      await context.close();
    }
  });

  test("Practicum and Graduation: asks first, the sent notice stays after the page changes, the contact line shows", async ({ browser }) => {
    const { context, page, writes } = await studentPage(browser, (d, w) => {
      d.student.program_has_practicum = true;
      d.student.program_code = "MAPSY";
      d.student.program_name = "Master of Arts in Psychology";
      d.practicum_eligibility = { eligible: true, status: "Verified", checklist: [], program_scope: {} };
      d.practicum_program_scope = { description: "Spec practicum scope text." };
      d.practicum_record = w.length ? { id: 21, status: "MOA Submitted", updated_at: "2026-11-02T09:00:00", practicum_site: "Spec Clinic", supervisor_name: "", required_hours: 200, completed_hours: 0, moa_attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf" }, attachments: [] } : null;
      d.workflow_messages = [];
      d.graduation_endorsement = null;
      d.graduation_eligibility = { eligible: true, status: "Eligible", missing_coursework: [], missing_research_requirements: [], missing_practicum_requirement: "" };
      d.graduation_review_windows = ["AY 2026-2027"];
      d.graduation_default_review_window = "AY 2026-2027";
      if (w.some((item) => item.path.endsWith("graduation"))) {
        d.graduation_endorsement = { id: 9, endorsement_status: "For Review", review_window: "AY 2026-2027", registrar_status: "", updated_at: "2026-11-02T09:00:00", request_attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf" }, attachments: [] };
      }
    });
    try {
      await page.goto("/student/practicum");
      await ctl(page, "Practicum site / company").fill("Spec Clinic");
      await page.locator("main").locator('input[type="file"]').setInputFiles(PDF);
      await expect(page.locator("main").getByText("View uploaded application")).toBeVisible();
      await submitButton(page, "Submit MOA stage").click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page)).toContainText("Spec Clinic");
      expect(writes).toHaveLength(0);
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toBeVisible();
      await expect(submitButton(page, "Submit MOA stage")).toHaveCount(0);
      await expect(sentNote(page)).toBeVisible();
      await expect(contactLine(page)).toBeVisible();

      await page.goto("/student/graduation");
      await expect(sentNote(page), "a new page starts without the old notice").toHaveCount(0);
      await page.locator("main").locator('input[type="file"]').setInputFiles(PDF);
      await expect(page.locator("main").getByText("View uploaded application")).toBeVisible();
      await submitButton(page, "Submit graduation application").click();
      await expect(dialog(page)).toContainText("AY 2026-2027");
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toBeVisible();
      await expect(submitButton(page, "Submit graduation application")).toHaveCount(0);
      await expect(sentNote(page)).toBeVisible();
      await expect(contactLine(page)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("Leave of Absence: asks first with the semesters and the reason; the sent notice shows once", async ({ browser }) => {
    const { context, page, writes } = await studentPage(browser, (d) => {
      const o = d.leave_overview;
      o.cases = [];
      o.banner = null;
      o.rules = { max_period_semesters: 2, max_total_semesters: 4, return_due_days: 30, return_grace_days: 14 };
      o.loa_semester_options = [{ label: "AY 2027-2028 2nd Semester", start_date: "2028-01-10", end_date: "2028-05-10", state: "Upcoming", filing_status: "Pass", filing_detail: "Spec ok." }];
      o.can_file = { extension: { allowed: false, reason: "" }, loa: { allowed: true, reason: "" }, readmission: { allowed: false, reason: "Spec." } };
      d.loa_allowed_reasons = ["Medical / health", "Family emergency"];
    });
    try {
      await page.goto("/student/requests/leave-of-absence");
      await ctl(page, "Leave starts").selectOption("AY 2027-2028 2nd Semester");
      await ctl(page, "Leave ends").selectOption("AY 2027-2028 2nd Semester");
      await ctl(page, "Reason").selectOption("Medical / health");
      await ctl(page, "Tell us what is happening").fill("Spec: surgery.");
      await submitButton(page, "Submit leave request").click();
      await expect(dialog(page)).toContainText("AY 2027-2028 2nd Semester");
      await expect(dialog(page)).toContainText("Medical / health");
      expect(writes).toHaveLength(0);
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toHaveCount(1);
      expect(writes.at(-1).path).toBe("requests/leave-of-absence");
    } finally {
      await context.close();
    }
  });

  test("Research Gate (I-153): checks its own answers, no browser bubble, the error summary links to the title", async ({ browser }) => {
    const { context, page, writes } = await studentPage(browser, (d) => {
      d.research_case = { ...(d.research_case || {}), id: 1, title: "Research title pending Form 1 submission", status: "Pending", adviser_name: "Dr. Spec Adviser" };
      d.panel = [];
      d.research_progress = {
        gate: "Form 1 - Title Defense", stage: "Title Defense", stage_index: 0, status: "Pending", stages: [{ name: "Title Defense", gate: "Form 1 - Title Defense", complete: false, status: "Pending" }],
        milestone: { value: "Form 1 - Title Defense", label: "Title Defense Readiness", short_label: "Form 1", description: "Spec milestone.", student_uploads_ready: true, student_missing_count: 0, overall_complete: false, requirements: [] },
      };
    });
    try {
      await page.goto("/student/research");
      const form = page.locator("main form").first();
      await expect(form).toHaveAttribute("novalidate", "");
      await submitButton(page, "Submit Form 1 for review").click();
      const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
      await expect(summary.getByRole("link")).toHaveCount(1);
      await summary.getByRole("link").click();
      await expect(page.locator("#research-title")).toBeFocused();
      expect(writes).toHaveLength(0);
      await page.locator("#research-title").fill("Spec Research Title");
      await submitButton(page, "Submit Form 1 for review").click();
      await expect(dialog(page)).toContainText("Spec Research Title");
      await dialog(page).getByRole("button", { name: "Send request" }).click();
      await expect(sentNote(page)).toBeVisible();
      expect(writes.at(-1).body).toMatchObject({ research_title: "Spec Research Title" });
    } finally {
      await context.close();
    }
  });

  test("Withdrawal outside the window (I-178): a notice with the reason, the window and a way to ask, no form; the Request Center uses the sidebar's heading", async ({ browser }) => {
    const { context, page } = await studentPage(browser, (d) => {
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.withdrawal_application = null;
      d.subject_enrollments = [CLOSED(903, "SPEC-103")];
    });
    try {
      await page.goto("/student/requests/withdrawal");
      const main = page.locator("main");
      const notice = main.getByRole("status").filter({ hasText: "Subject withdrawal is closed right now" });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("Spec closed policy.");
      await expect(notice).toContainText("SPEC-103");
      await expect(notice).toContainText("Withdrawal window closed");
      await expect(notice).toContainText("Spec Handbook p. 49");
      await expect(notice.getByRole("link", { name: "Open your Messages" })).toHaveAttribute("href", "/student/messages");
      await expect(submitButton(page, "Submit withdrawal request")).toHaveCount(0);
      await expect(page.getByText("Reason for withdrawing from this subject")).toHaveCount(0);
      await snap(page, "withdrawal-closed");
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);

      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/student/requests");
      const sidebar = page.getByRole("navigation").first();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Research & Defense", "Requests", "Completion"]);
      await expect(sidebar).toContainText("Requests");
      const group = main.locator("section, div").filter({ has: page.getByRole("heading", { level: 2, name: "Requests" }) }).filter({ has: page.locator('a[href="/student/requests/withdrawal"]') });
      await expect(group.first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("Policy Assistant (I-176): a student reads no developer text about an AI key", async ({ browser }) => {
    const { context, page } = await studentPage(browser);
    try {
      await context.route("**/api/student-portal/assistant", (route) => route.fulfill({
        json: {
          answer: "A single subject can be withdrawn until the end of the second week.",
          citations: [], personal: false,
          source: {
            label: "Answered from the documents (keyword search)",
            detail: "Found by keyword search in the Handbook. No AI service was used; add a Gemini key for fuller, reworded answers.",
            ai_used: false, ai_configured: false, offline: true, badge: "Offline answer",
            note: "No AI key is set, so answers are quoted straight from the documents. Add a Gemini key for fuller, reworded answers.",
          },
        },
      }));
      await page.goto("/student/assistant");
      await page.getByRole("textbox", { name: "Your question" }).fill("Until when can I withdraw a subject?");
      await page.getByRole("button", { name: "Send question" }).click();
      const badge = page.getByTestId("answer-badge").last();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("The assistant is answering from the policy documents without AI right now");
      const everything = await page.locator("body").evaluate((el) => el.innerText + [...el.querySelectorAll("[title]")].map((n) => n.getAttribute("title")).join(" "));
      expect(everything).not.toMatch(/Gemini key|No AI key|API key/i);
    } finally {
      await context.close();
    }
  });
});

test.describe("P99 Course Adjustments asks before it submits or publishes", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("Submit for approval asks first; Cancel sends nothing; Confirm sends the submit", async ({ page }) => {
    test.setTimeout(120_000);
    const writes = [];
    await page.route("**/api/course-adjustments/plan", async (route) => {
      writes.push(JSON.parse(route.request().postData() || "{}"));
      await route.abort();
    });
    await page.route(/\/api\/course-adjustments(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.latest_plan = null;
      data.planning_window_open = true;
      data.permissions = { ...(data.permissions || {}), can_manage: true };
      await route.fulfill({ response, json: data });
    });
    await page.goto("/course-adjustments");
    const submit = page.getByRole("button", { name: "Submit for approval" });
    await expect(submit).toBeEnabled();
    await submit.click();
    const ask = page.getByRole("dialog", { name: "Submit this plan for approval?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(ask).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(writes, "Cancel sends nothing").toHaveLength(0);
    await submit.click();
    await ask.getByRole("button", { name: "Submit plan" }).click();
    await expect.poll(() => writes.length).toBeGreaterThan(0);
    expect(writes.at(-1).action).toBe("submit");
  });
});
