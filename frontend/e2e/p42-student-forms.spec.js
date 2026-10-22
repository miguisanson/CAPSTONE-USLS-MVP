// Packet P4.2 (Phase 5 design system, student stream): pins what the student request forms DO, so moving
// pages/student/{RequestForms,ResearchForms,CompletionForms}.jsx onto the component library (Field/Input/Select/Textarea,
// InlineNotice, StatusChip, Button) cannot change it. Written against the old code; it passes on both.
//
// Forms covered (found through StudentRoutes.jsx -> StudentRequestPages.jsx):
//   /student/requests/leave-of-absence   LoaRequestForm   new request, more time (extension), correcting a returned request
//   /student/requests/readmission        ReadmissionRequestForm   with and without a linked leave
//   /student/requests/awol-return        AwolReturnRequestForm    AWOL, residency, already routed for review
//   /student/requests/withdrawal         WithdrawalRequestForm    eligible subjects, none eligible (I-037), read-only, returned
//   /student/research                    ResearchRequestForm + ResearchEvidenceUpload + ConceptPaperCompliance
//   /student/defense-schedule            ScheduleRequestForm + RevisionSubmitForm
//   /student/practicum                   PracticumRequestForm    MOA step, completion step, read-only
//   /student/graduation                  GraduationRequestForm   application, not yet eligible
//
// Through the real UI as the seeded demo student (student@usls.edu.ph). The browser answers /api/student-portal/context with the
// REAL response plus the state under test (page.route), and EVERY write is answered by the browser (POST requests, uploads,
// deletes), so nothing is ever written to the database and the payloads can be asserted exactly. Checked: every label with its
// required marker, the hint that says why Submit is off, the validation / server messages, the accepted file type, the exact
// request body, the loading text, and (at 390 px) no sideways scroll. Screenshots: P42_SHOTS (default e2e-artifacts/p42-student-forms).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = process.env.P42_SHOTS || join(SCREENS_DIR, "..", "p42-student-forms");
const EMAIL = "student@usls.edu.ph";

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PDF = { name: "spec.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 spec") };
const TXT = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a pdf") };

/**
 * Signs in as the demo student in its own browser context. `mutate(data)` edits the real portal context. Every write is
 * answered here and recorded in `writes` ({ method, path, body, raw }); `fail` makes the next request to a path answer an error.
 */
async function formPage(browser, mutate, { failPath, failMessage = "Spec: the server said no." } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), `sign in as ${EMAIL}`).toBeTruthy();
  const info = { studentId: null };
  const writes = [];
  await context.route("**/api/student-portal/context", async (route) => {
    try {
      const response = await route.fetch();
      const data = await response.json();
      info.studentId = data.student.id;
      mutate?.(data);
      await route.fulfill({ response, json: data });
    } catch (error) {
      // The page can drop a request it no longer needs (e.g. an older refetch) before this answer is sent; that is not a failure.
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    }
  });
  const answer = (path, json) => async (route) => {
    const request = route.request();
    const raw = request.postDataBuffer()?.toString("latin1") || "";
    let body = null;
    try { body = JSON.parse(raw); } catch { /* multipart or empty */ }
    writes.push({ method: request.method(), path, body, raw });
    if (failPath && path.includes(failPath)) return route.fulfill({ status: 400, json: { error: failMessage } });
    return route.fulfill({ json: typeof json === "function" ? json(body) : json });
  };
  await context.route("**/api/student-portal/requests/*", async (route) => answer(new URL(route.request().url()).pathname.replace("/api/student-portal/requests/", "requests/"), { message: "Spec: request saved." })(route));
  await context.route("**/api/student-portal/request-attachments/upload", answer("request-attachments/upload", { attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf", file_exists: true } }));
  await context.route("**/api/student-portal/research-evidence/upload", answer("research-evidence/upload", { research_title: "Spec Title From Form 1", document: { evidence_reference: "spec-form1.pdf" } }));
  await context.route(/\/api\/student-portal\/research-evidence\/\d+$/, answer("research-evidence/delete", {}));
  await context.route("**/api/research-evidence/*/concept-paper-compliance", answer("concept-paper-compliance", {}));
  await context.route("**/api/student-portal/defense-verdicts/*/revisions", answer("defense-verdicts/revisions", { message: "Spec: revisions sent." }));
  const page = await context.newPage();
  // Switching the viewport makes the portal fetch its context again; let that finish before the browser goes away.
  const close = context.close.bind(context);
  context.close = async () => {
    for (const open of context.pages()) await open.waitForLoadState("networkidle").catch(() => {});
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await close();
  };
  return { context, page, writes, info };
}

/** The last recorded write whose path starts with `prefix`. */
const lastWrite = (writes, prefix) => [...writes].reverse().find((w) => w.path.startsWith(prefix));

/** Screenshot at 1366 and at 390 (no sideways scroll at 390), then back to 1366. */
async function snap(page, name) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, `${name}-1366.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  expect(await noOverflow(page), `${name} at 390 px: no sideways scroll`).toBe(true);
  await page.screenshot({ path: join(SHOTS, `${name}-390.png`), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForLoadState("networkidle");
}

/** The control (select / input / textarea) of the field whose label is `label`. */
function ctl(page, label) {
  const name = new RegExp(`^${esc(label)}(\\s*\\*)?\\s*$`);
  return page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: name }) }).locator("select, input:not([type=file]), textarea").first();
}
/** The whole field (label, control, hint, error) whose label is `label`. */
function fieldOf(page, label) {
  const name = new RegExp(`^${esc(label)}(\\s*\\*)?\\s*$`);
  return page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: name }) });
}
/** The red * of a label (a required field) shows once, an optional one has none. */
async function expectRequired(page, label, required) {
  const star = fieldOf(page, label).locator(".field-label span.text-red-500");
  await expect(star, `"${label}" required marker`).toHaveCount(required ? 1 : 0);
  if (required) await expect(ctl(page, label), `"${label}" aria-required`).toHaveAttribute("aria-required", "true");
}
const submitButton = (page, name) => page.getByRole("button", { name, exact: true });

// ---- states injected on top of the real response ---------------------------------------------------------------

const SEM = (label, extra = {}) => ({ label, start_date: "2027-01-10", end_date: "2027-05-10", state: "Upcoming", filing_status: "Pass", filing_detail: "The selected semester begins 2027-01-10.", ...extra });
const LOA_OPTIONS = [
  SEM("AY 2026-2027 1st Semester", { start_date: "2026-08-01", end_date: "2026-11-29", state: "Running", filing_detail: "Filed in the second half of the semester: the enrolled courses are marked W (withdrawn) and no refund of tuition and fees is given." }),
  SEM("AY 2026-2027 2nd Semester"),
  SEM("AY 2027-2028 1st Semester", { start_date: "2027-08-01", end_date: "2027-11-29", filing_status: "Fail", filing_detail: "Spec: the filing date for this semester has passed." }),
];
const PERIOD = { start_date: "2026-08-01", start_label: "AY 2026-2027 1st Semester", end_date: "2026-11-29", end_label: "AY 2026-2027 1st Semester", semesters: 1, text: "AY 2026-2027 1st Semester" };
const LOA_CASE = {
  id: 11, kind: "LOA", kind_label: "Leave of Absence", slug: "leave-of-absence", status: "On Leave", status_label: "On leave", status_tone: "good",
  owner: null, editable: false, days_until_end: 20, overdue_days: 0, closed_reason: null, dean_remarks: null,
  submitted_at: "2026-08-18T09:00:00", forwarded_at: "2026-08-20T09:00:00", decided_at: "2026-08-25T09:00:00", started_at: "2026-09-01T09:00:00", closed_at: null,
  period: PERIOD, reason_category: "Medical / health", reason_text: "Spec reason text.", linked_case: null, checklist: [], messages: [], history: [],
  timeline: [{ label: "Request submitted", state: "complete" }, { label: "Dean decision", state: "complete" }, { label: "Leave begins", state: "current" }],
};

function leaveBase(data) {
  const o = data.leave_overview;
  o.cases = [];
  o.banner = null;
  o.rules = { max_period_semesters: 2, max_total_semesters: 4, return_due_days: 30, return_grace_days: 14 };
  o.loa_semester_options = LOA_OPTIONS;
  o.can_file = { extension: { allowed: false, reason: "" }, loa: { allowed: true, reason: "" }, readmission: { allowed: false, reason: "Readmission is for students on an approved leave of absence." } };
  data.loa_allowed_reasons = ["Medical / health", "Family emergency", "Other documented circumstance"];
}

const ENROLLED = (id, code, extra = {}) => ({
  id, course_code: code, course_title: `Spec ${code}`, term_label: "AY 2026-2027 1st Semester", status: "Enrolled", withdrawal_eligible: true,
  withdrawal_window: { eligible: true, deadline: "2026-11-20", status: "Withdrawal window open", term_start_date: "2026-11-07", fee_consequence: "Spec fee: 10% of the term's total is charged.", rule_source: "Spec Handbook p. 49", policy: "Spec policy: withdraw before the deadline." },
  ...extra,
});
const CLOSED = (id, code) => ENROLLED(id, code, { withdrawal_eligible: false, withdrawal_window: { eligible: false, deadline: "2026-01-23", status: "Withdrawal window closed", term_start_date: "2026-01-10", fee_consequence: "Spec: 100% of the fees.", rule_source: "Spec Handbook p. 49", policy: "Spec closed policy." } });

const REQ = (item_name, label, extra = {}) => ({
  item_name, label, description: `Spec description of ${label}.`, student_upload: true, required_file_count: 1, file_count: 0, files: [],
  status: "Missing", status_label: "Missing", adviser_signature_required: false, outcome: null, source_type: "student_upload", template_url: null, ...extra,
});
const STAGES = [
  { name: "Title Defense", gate: "Form 1 - Title Defense", complete: false, status: "Pending" },
  { name: "Proposal Defense", gate: "Form 4 - Proposal Defense Readiness", complete: false, status: "Locked" },
  { name: "Final Defense", gate: "Final Defense", complete: false, status: "Locked" },
  { name: "Completion", gate: "Completion Evidence", complete: false, status: "Locked" },
];
const FORM1 = "Form 1 - Application for Title Defense";
const CONCEPT = "Three concept papers";
function researchBase(data, { ready = false, panel = false, caseTitle = null, files = false } = {}) {
  data.research_case = { ...(data.research_case || {}), id: 1, title: caseTitle || "Research title pending Form 1 submission", status: "Pending", adviser_name: "Dr. Spec Adviser" };
  data.panel = panel ? [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }] : [];
  data.research_progress = {
    gate: "Form 1 - Title Defense", stage: "Title Defense", stage_index: 0, status: "Pending", stages: STAGES,
    milestone: {
      value: "Form 1 - Title Defense", label: "Title Defense Readiness", short_label: "Form 1", description: "Spec milestone: submit Form 1 and three concept papers.",
      student_uploads_ready: ready, student_missing_count: ready ? 0 : 2, overall_complete: false,
      requirements: [
        REQ(FORM1, "Form 1 application", files ? { file_count: 1, status_label: "Uploaded", files: [{ id: 401, name: "form1-spec.pdf", url: "/spec/form1.pdf" }] } : {}),
        REQ(CONCEPT, "Three concept papers", {
          required_file_count: 3, file_count: files ? 1 : 0, status_label: files ? "Pending Review" : "Missing",
          files: files ? [{
            id: 501, name: "concept-one.pdf", url: "/spec/concept1.pdf", compliance_status: "Compliant", compliance_score: 88,
            compliance: { summary: "Spec compliance summary", checks: [{ id: "c1", label: "Has an abstract", status: "Passed", evidence: "Spec evidence line." }], citations: [{ id: "s1", source: "Spec Handbook", text: "Spec citation text." }] },
          }] : [],
        }),
        REQ("Panel matching", "Panel matching", { student_upload: false, status_label: "Pending Staff Action" }),
      ],
    },
  };
}

const PRACTICUM_CHECK = [
  { key: "program_scope", label: "Practicum program scope", source_field: "student.program", actual_value: "MAPSY - Spec", required_value: null, passed: true },
  { key: "basic", label: "Basic units completed", source_field: "course_audit.by_category", actual_value: 9, required_value: 6, passed: true },
  { key: "x", label: "Spec unknown check", source_field: "", actual_value: null, required_value: null, passed: null },
];
function practicumBase(data, record = null) {
  data.student.program_has_practicum = true;
  data.student.program_code = "MAPSY";
  data.student.program_name = "Master of Arts in Psychology";
  data.practicum_eligibility = { eligible: true, status: "Verified", checklist: PRACTICUM_CHECK, program_scope: {} };
  data.practicum_program_scope = { description: "Spec practicum scope text." };
  data.practicum_record = record;
  data.workflow_messages = [];
}

test.describe("P4.2 student request forms", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  // ---------------------------------------------------------------------------------------------- Leave of Absence
  test("Leave of Absence (new): labels, filing rules, the problem summary, the exact payload and the server error", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => { leaveBase(d); });
    try {
      await page.goto("/student/requests/leave-of-absence");
      const form = page.getByRole("region", { name: "Ask for a leave of absence" });
      await expect(form.getByRole("heading", { level: 3, name: "Ask for a leave of absence" })).toBeVisible();
      await expect(form).toContainText("Choose the semesters you want to be away and tell us why. Graduate School staff check your request first, then the Dean decides.");
      await expect(form).toContainText("A leave can last up to 2 semesters at a time. It can be renewed once. All your leave together can never be more than 4 semesters.");
      for (const [label, required] of [["Leave starts", true], ["Leave ends", true], ["Reason", true], ["Tell us what is happening", true]]) await expectRequired(page, label, required);

      // nothing chosen: Submit stays usable and, when pressed, lists what is missing (P82); the end select waits for the start
      const submit = submitButton(page, "Submit leave request");
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link")).toHaveCount(3);
      expect(lastWrite(writes, "requests/leave-of-absence")).toBeUndefined();
      await expect(ctl(page, "Leave ends")).toBeDisabled();
      await expect(ctl(page, "Leave ends").locator("option").first()).toHaveText("Choose when it starts first");
      await expect(ctl(page, "Leave starts").locator("option").first()).toHaveText("Choose a semester");
      await expect(ctl(page, "Leave starts").locator("option")).toHaveCount(4);
      await expect(ctl(page, "Leave starts").locator("option").nth(1)).toHaveText("AY 2026-2027 1st Semester · Running (Aug 1, 2026 to Nov 29, 2026)");
      await expect(ctl(page, "Reason").locator("option")).toHaveText(["Choose a reason", "Medical / health", "Family emergency", "Other documented circumstance"]);
      await expect(ctl(page, "Tell us what is happening")).toHaveAttribute("placeholder", "Explain your situation in a few sentences.");
      await snap(page, "loa-new-empty");

      // a running semester in its second half: the warning (status), the end follows the start
      await ctl(page, "Leave starts").selectOption("AY 2026-2027 1st Semester");
      const warning = form.getByRole("status").filter({ hasText: "Please read before you send this request" });
      await expect(warning).toContainText("Filed in the second half of the semester");
      await expect(ctl(page, "Leave ends")).toHaveValue("AY 2026-2027 1st Semester");
      await expect(fieldOf(page, "Leave ends")).toContainText("That is 1 semester.");
      await snap(page, "loa-new-warning");

      // a semester that fails the filing rule: the alert, Submit stays off with its own hint
      await ctl(page, "Leave starts").selectOption("AY 2027-2028 1st Semester");
      await expect(form.getByRole("alert").filter({ hasText: "Spec: the filing date for this semester has passed." })).toBeVisible();
      await expect(warning).toHaveCount(0);
      await ctl(page, "Reason").selectOption("Medical / health");
      await ctl(page, "Tell us what is happening").fill("Spec reason text.");
      await expect(submit).toBeDisabled();
      await expect(form).toContainText("You cannot send this request for the semester you chose. Choose another semester.");
      await snap(page, "loa-new-fail");

      // a valid choice over two semesters
      await ctl(page, "Leave starts").selectOption("AY 2026-2027 2nd Semester");
      await expect(form.getByRole("alert").filter({ hasText: "filing date" })).toHaveCount(0);
      await expect(ctl(page, "Leave ends").locator("option")).toHaveCount(3); // placeholder + 2nd semester + 1st of next year (span 2)
      await ctl(page, "Leave ends").selectOption("AY 2027-2028 1st Semester");
      await expect(fieldOf(page, "Leave ends")).toContainText("That is 2 semesters.");
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(form.getByRole("status").filter({ hasText: "Spec: request saved." })).toBeVisible();
      const write = lastWrite(writes, "requests/leave-of-absence");
      expect(write.method).toBe("POST");
      expect(write.body).toEqual({ effective_start: "AY 2026-2027 2nd Semester", effective_end: "AY 2027-2028 1st Semester", reason_category: "Medical / health", reason_remarks: "Spec reason text." });
      await snap(page, "loa-new-sent");
    } finally {
      await context.close();
    }
  });

  test("Leave of Absence (new): a server error is shown in the form and the button is usable again", async ({ browser }) => {
    const { context, page } = await formPage(browser, (d) => { leaveBase(d); }, { failPath: "requests/leave-of-absence", failMessage: "Spec: the Dean office is closed." });
    try {
      await page.goto("/student/requests/leave-of-absence");
      await ctl(page, "Leave starts").selectOption("AY 2026-2027 2nd Semester");
      await ctl(page, "Reason").selectOption("Family emergency");
      await ctl(page, "Tell us what is happening").fill("Spec.");
      await submitButton(page, "Submit leave request").click();
      await expect(page.getByRole("alert").filter({ hasText: "Spec: the Dean office is closed." })).toBeVisible();
      await expect(submitButton(page, "Submit leave request")).toBeEnabled();
      await snap(page, "loa-error");
    } finally {
      await context.close();
    }
  });

  test("Leave of Absence (more time): the extra time starts after the current leave and the extension payload", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      leaveBase(d);
      d.leave_overview.cases = [LOA_CASE];
      d.leave_overview.can_file = { extension: { allowed: true, reason: "", parent_case_id: 11, remaining_semesters: 1 }, loa: { allowed: false, reason: "" }, readmission: { allowed: false, reason: "" } };
    });
    try {
      await page.goto("/student/requests/leave-of-absence");
      const form = page.getByRole("region", { name: "Ask for more time" });
      await expect(form.getByRole("heading", { level: 3, name: "Ask for more time" })).toBeVisible();
      await expect(form).toContainText("Your leave can be renewed once, and never beyond 4 semesters in all. The extra time starts in the semester after your current leave ends (Nov 29, 2026).");
      await expect(form).toContainText("You can ask for up to 1 more semester now.");
      await expect(form).not.toContainText("It can be renewed once.");
      await expectRequired(page, "Extra time starts", true);
      await expectRequired(page, "Extra time ends", true);
      await expect(ctl(page, "Extra time starts")).toHaveValue("AY 2026-2027 2nd Semester"); // the only choice, preselected
      await expect(ctl(page, "Extra time ends")).toHaveValue("AY 2026-2027 2nd Semester");
      const submit = submitButton(page, "Submit leave extension request");
      await expect(submit).toBeEnabled();
      await submit.click(); // the semesters are preselected: the reason and the explanation are listed (P82)
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link")).toHaveCount(2);
      expect(lastWrite(writes, "requests/leave-of-absence")).toBeUndefined();
      await snap(page, "loa-extension");
      await ctl(page, "Reason").selectOption("Other documented circumstance");
      await ctl(page, "Tell us what is happening").fill("Need one more semester.");
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/leave-of-absence").body).toEqual({ effective_start: "AY 2026-2027 2nd Semester", effective_end: "AY 2026-2027 2nd Semester", reason_category: "Other documented circumstance", reason_remarks: "Need one more semester." });
    } finally {
      await context.close();
    }
  });

  test("Leave of Absence (returned): the form is filled with the earlier answers and sends them again", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      leaveBase(d);
      d.leave_overview.cases = [{
        ...LOA_CASE, id: 12, status: "Returned", status_label: "Returned to student", status_tone: "warn", owner: "Student", editable: true, dean_remarks: "Spec: add the clinic certificate.",
        period: { ...PERIOD, start_label: "AY 2026-2027 2nd Semester", end_label: "AY 2026-2027 2nd Semester", start_date: "2027-01-10", end_date: "2027-05-10", text: "AY 2026-2027 2nd Semester" },
      }];
      d.leave_overview.can_file.loa = { allowed: false, reason: "" };
    });
    try {
      await page.goto("/student/requests/leave-of-absence");
      const form = page.getByRole("region", { name: "Correct your request and send it again" });
      await expect(form).toContainText("Change what the comment above asks for, then send your request again.");
      await expect(ctl(page, "Leave starts")).toHaveValue("AY 2026-2027 2nd Semester");
      await expect(ctl(page, "Leave ends")).toHaveValue("AY 2026-2027 2nd Semester");
      await expect(ctl(page, "Reason")).toHaveValue("Medical / health");
      await expect(ctl(page, "Tell us what is happening")).toHaveValue("Spec reason text.");
      await ctl(page, "Tell us what is happening").fill("Spec reason text, with the certificate.");
      await snap(page, "loa-returned");
      await submitButton(page, "Resubmit leave request").click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/leave-of-absence").body).toEqual({ effective_start: "AY 2026-2027 2nd Semester", effective_end: "AY 2026-2027 2nd Semester", reason_category: "Medical / health", reason_remarks: "Spec reason text, with the certificate." });
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Readmission
  test("Readmission (no linked leave): the problem summary walks through the missing parts, the checklist and the exact payload", async ({ browser }) => {
    const ITEMS = ["Structured return intention completed", "Updated study plan confirmed", "Program or adviser consultation completed", "No pending accountability confirmed"];
    const { context, page, writes } = await formPage(browser, (d) => {
      leaveBase(d);
      d.leave_overview.can_file.readmission = { allowed: true, reason: "" };
      d.leave_overview.return_semester_options = ["AY 2026-2027 2nd Semester", "AY 2027-2028 1st Semester"];
      d.semester_options = ["AY 2025-2026 1st Semester", "AY 2025-2026 2nd Semester", "AY 2026-2027 1st Semester"];
      d.readmission_requirements = ITEMS;
    });
    try {
      await page.goto("/student/requests/readmission");
      const form = page.getByRole("region", { name: "Ask to come back" });
      await expect(form).toContainText("Graduate School staff check your request first, then the Dean decides.");
      for (const label of ["Your leave started in", "Your leave ended in", "Semester you want to return in", "Why you are ready to come back"]) await expectRequired(page, label, true);
      await expect(fieldOf(page, "Semester you want to return in")).toContainText("You can ask to return before your leave ends, but the Dean decides whether that is allowed.");
      await expect(form).toContainText("Before you send this, confirm each item");
      await expect(form.getByRole("checkbox")).toHaveCount(4);
      const submit = submitButton(page, "Submit readmission request");
      const problems = page.getByRole("alert").filter({ hasText: "There is a problem" });
      await expect(submit).toBeEnabled();
      await snap(page, "readmission-empty");
      await submit.click(); // nothing answered: five problems (P82)
      await expect(problems.getByRole("link")).toHaveCount(5);
      expect(lastWrite(writes, "requests/readmission")).toBeUndefined();
      await ctl(page, "Semester you want to return in").selectOption("AY 2027-2028 1st Semester");
      await ctl(page, "Why you are ready to come back").fill("Spec: I am ready.");
      await ctl(page, "Your leave started in").selectOption("AY 2025-2026 2nd Semester");
      await expect(ctl(page, "Your leave ended in")).toHaveValue("AY 2025-2026 2nd Semester"); // follows the start
      await submit.click(); // only the checklist is left
      await expect(problems.getByRole("link")).toHaveCount(1);
      await expect(problems).toContainText("Tick every item on the checklist.");
      expect(lastWrite(writes, "requests/readmission")).toBeUndefined();
      for (const item of ITEMS) await form.getByLabel(item).check();
      await expect(submit).toBeEnabled();
      await snap(page, "readmission-ready");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/readmission").body).toEqual({
        target_return_term: "AY 2027-2028 1st Semester", return_intent: "Spec: I am ready.", readmission_items: ITEMS,
        previous_loa_start: "AY 2025-2026 2nd Semester", previous_loa_end: "AY 2025-2026 2nd Semester",
      });
    } finally {
      await context.close();
    }
  });

  test("Readmission (linked leave): the leave being ended is shown and no previous-leave fields are sent", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      leaveBase(d);
      d.leave_overview.cases = [LOA_CASE];
      d.leave_overview.can_file.readmission = { allowed: true, reason: "", linked_case_id: 11, leave_period: "AY 2026-2027 1st Semester", leave_end: "2026-11-29" };
      d.leave_overview.return_semester_options = ["AY 2026-2027 2nd Semester"];
      d.readmission_requirements = [];
    });
    try {
      await page.goto("/student/requests/readmission");
      const form = page.getByRole("region", { name: "Ask to come back" });
      await expect(form).toContainText("You are ending your leave: AY 2026-2027 1st Semester.");
      await expect(form).toContainText("It runs until Nov 29, 2026.");
      await expect(fieldOf(page, "Your leave started in")).toHaveCount(0);
      await expect(form).not.toContainText("Before you send this, confirm each item");
      await ctl(page, "Semester you want to return in").selectOption("AY 2026-2027 2nd Semester");
      await ctl(page, "Why you are ready to come back").fill("Spec: back after the leave.");
      await snap(page, "readmission-linked");
      await submitButton(page, "Submit readmission request").click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/readmission").body).toEqual({ target_return_term: "AY 2026-2027 2nd Semester", return_intent: "Spec: back after the leave.", readmission_items: [] });
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Return from AWOL
  test("Return from AWOL: the AWOL notice, labels, the problem summary and the exact payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => {
      d.student.standing = "AWOL";
      d.student.enrollment_tag = "AWOL";
      d.awol_case = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), awol: [] };
      d.upcoming_semesters = ["AY 2026-2027 2nd Semester", "AY 2027-2028 1st Semester"];
      d.semester_options = ["AY 2025-2026 2nd Semester", "AY 2026-2027 1st Semester"];
    });
    try {
      await page.goto("/student/requests/awol-return");
      const main = page.locator("main");
      await expect(main).toContainText("Your record was automatically flagged AWOL from an official standing or full-semester withdrawal without approved LOA. Registration privileges remain restricted until your return request is reviewed.");
      await expect(main).toContainText("The handbook requires a written intention to enroll routed through the Graduate School Dean. Complete the form below; no file needs to be uploaded.");
      await expectRequired(page, "Intended return semester", true);
      await expectRequired(page, "Last enrolled semester", false);
      await expectRequired(page, "Written intention to resume enrollment", true);
      await expectRequired(page, "Reason for returning and readiness to continue", true);
      await expect(ctl(page, "Written intention to resume enrollment")).toHaveAttribute("placeholder", "I intend to resume enrollment in the selected semester…");
      await expect(ctl(page, "Intended return semester").locator("option").first()).toHaveText("Select semester");
      const submit = submitButton(page, "Submit return declaration");
      await expect(submit).toBeEnabled();
      await snap(page, "awol-empty");
      await submit.click(); // nothing answered: three problems (P82)
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link")).toHaveCount(3);
      expect(lastWrite(writes, "requests/awol-return")).toBeUndefined();
      await ctl(page, "Intended return semester").selectOption("AY 2027-2028 1st Semester");
      await ctl(page, "Written intention to resume enrollment").fill("Spec intention.");
      await submit.click();
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link")).toHaveCount(1);
      expect(lastWrite(writes, "requests/awol-return")).toBeUndefined();
      await ctl(page, "Reason for returning and readiness to continue").fill("Spec reason.");
      await ctl(page, "Last enrolled semester").selectOption("AY 2025-2026 2nd Semester");
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/awol-return").body).toEqual({
        student_id: info.studentId, target_return_term: "AY 2027-2028 1st Semester", last_enrolled_term: "AY 2025-2026 2nd Semester",
        return_intent: "Spec intention.", return_reason: "Spec reason.",
      });
      await snap(page, "awol-sent");
    } finally {
      await context.close();
    }
  });

  test("Return from AWOL: the residency notice, a returned declaration to resubmit, and the locked state", async ({ browser }) => {
    let scenario = "residency";
    const { context, page, writes } = await formPage(browser, (d) => {
      d.student.standing = "AWOL";
      d.student.enrollment_tag = scenario === "residency" ? "Residency" : "AWOL";
      d.standalone_cases = { ...(d.standalone_cases || {}), awol: [] };
      d.upcoming_semesters = ["AY 2026-2027 2nd Semester"];
      d.semester_options = ["AY 2026-2027 1st Semester"];
      if (scenario === "returned") d.awol_case = { id: 5, status: "Returned for Revision", last_enrolled_term: "AY 2026-2027 1st Semester", return_intent: "Spec old intention.", return_reason: "Spec old reason." };
      if (scenario === "locked") d.awol_case = { id: 5, status: "Dean Review", last_enrolled_term: "AY 2026-2027 1st Semester", return_intent: "Spec old intention.", return_reason: "Spec old reason." };
    });
    try {
      await page.goto("/student/requests/awol-return");
      await expect(page.locator("main")).toContainText("You are enrolled in residency without subjects for an approved academic purpose. Check the workflow status for the recorded semester and purpose.");
      await snap(page, "awol-residency");

      scenario = "returned";
      await page.reload();
      await expect(ctl(page, "Written intention to resume enrollment")).toHaveValue("Spec old intention.");
      await expect(ctl(page, "Last enrolled semester")).toHaveValue("AY 2026-2027 1st Semester");
      await ctl(page, "Intended return semester").selectOption("AY 2026-2027 2nd Semester");
      await submitButton(page, "Resubmit return declaration").click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/awol-return").body).toMatchObject({ target_return_term: "AY 2026-2027 2nd Semester", last_enrolled_term: "AY 2026-2027 1st Semester", return_intent: "Spec old intention.", return_reason: "Spec old reason." });

      scenario = "locked";
      await page.reload();
      await expect(page.locator("main")).toContainText("Your return declaration has already been routed for review. Watch the Inbox for the Dean's decision or a revision request.");
      await expect(page.getByRole("button", { name: /return declaration/ })).toHaveCount(0);
      await expect(fieldOf(page, "Intended return semester")).toHaveCount(0);
      await snap(page, "awol-locked");
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Withdrawal
  test("Withdrawal: the window card, the policy, the problem summary on the empty reason and the exact payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => {
      d.withdrawal_application = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.subject_enrollments = [ENROLLED(901, "SPEC-101"), ENROLLED(902, "SPEC-102", { withdrawal_window: { ...ENROLLED(902, "x").withdrawal_window, deadline: "2026-11-25", fee_consequence: "Spec fee two." } }), CLOSED(903, "SPEC-103")];
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/requests/withdrawal");
      const main = page.locator("main");
      await expect(main).toContainText("When you can withdraw a subject");
      await expect(main).toContainText("Spec policy: withdraw before the deadline.");
      await expect(main.getByRole("heading", { level: 3, name: "Ask to withdraw from a subject" })).toBeVisible();
      await expect(main).toContainText("Choose one eligible enrolled subject and state the reason for withdrawing.");
      await expect(main.getByText("Current stage", { exact: true })).toHaveCount(0);
      await expect(fieldOf(page, "Enrolled subject").locator(".field-label span.text-red-500")).toHaveCount(1);
      await expectRequired(page, "Reason for withdrawing from this subject", true);
      const subject = ctl(page, "Enrolled subject");
      await expect(subject.locator("option")).toHaveCount(4);
      await expect(subject.locator("option").first()).toHaveText("Choose an eligible enrolled subject");
      await expect(subject.locator("option").nth(1)).toHaveText("SPEC-101 — Spec SPEC-101 · AY 2026-2027 1st Semester · ELIGIBLE UNTIL 2026-11-20");
      await expect(subject.locator("option").nth(3)).toHaveText("SPEC-103 — Spec SPEC-103 · AY 2026-2027 1st Semester · WITHDRAWAL WINDOW CLOSED");
      await expect(subject.locator("option").nth(3)).toHaveAttribute("disabled", "");
      await expect(subject).toHaveValue("901"); // the first eligible subject is preselected
      // the deadline card of the chosen subject
      const card = main.getByRole("status").filter({ hasText: "Withdrawal deadline" });
      await expect(card).toContainText("Eligible until Nov 20, 2026");
      await expect(card).toContainText("Withdrawal window open · Classes begin Nov 7, 2026");
      await expect(card).toContainText("Fee: Spec fee: 10% of the term's total is charged.");
      await expect(card).toContainText("Rule: Spec Handbook p. 49");
      await snap(page, "withdrawal-form");
      await subject.selectOption("902");
      await expect(card).toContainText("Eligible until Nov 25, 2026");
      await expect(card).toContainText("Fee: Spec fee two.");

      // no reason: the form's own problem summary stops it (P82), nothing is sent
      const submit = submitButton(page, "Submit withdrawal request");
      await expect(submit).toBeEnabled();
      await submit.click();
      await page.waitForTimeout(300);
      expect(lastWrite(writes, "requests/withdrawal")).toBeUndefined();
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toContainText("Explain why you are withdrawing from this subject.");
      await ctl(page, "Reason for withdrawing from this subject").fill("Spec: schedule clash.");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      // a chosen subject is the select's string (the preselected one keeps its numeric id: see the returned-request test)
      expect(lastWrite(writes, "requests/withdrawal").body).toEqual({ student_id: info.studentId, reason: "Spec: schedule clash.", subject_enrollment_id: "902" });
    } finally {
      await context.close();
    }
  });

  test("Withdrawal (I-037): with no subject inside the window the message is a calm info notice, not an alert", async ({ browser }) => {
    const { context, page } = await formPage(browser, (d) => {
      d.withdrawal_application = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.subject_enrollments = [CLOSED(903, "SPEC-103")];
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/requests/withdrawal");
      const main = page.locator("main");
      const message = "No active subject is currently inside the withdrawal window (until the end of the second week of classes). Contact Graduate School staff if the recorded semester dates are incorrect.";
      await expect(main.getByRole("status").filter({ hasText: message })).toHaveCount(1);
      await expect(main.getByRole("alert").filter({ hasText: "No active subject" })).toHaveCount(0);
      await expect(main).toContainText("When you can withdraw a subject");
      await expect(ctl(page, "Enrolled subject")).toHaveValue("");
      await expect(submitButton(page, "Submit withdrawal request")).toBeDisabled();
      await expect(main).toContainText("No subject is currently inside the withdrawal window.");
      await snap(page, "withdrawal-none");
      // choosing the closed subject is impossible (its option is disabled), so no red "window closed" card appears
      await expect(main.getByText("Withdrawal window closed", { exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("Withdrawal (read-only and returned): the saved request shows its eligibility; a returned one can be sent again", async ({ browser }) => {
    let returned = false;
    const application = (extra = {}) => ({
      id: 31, status: "Submitted", dean_decision: null, reason: "Spec saved reason.", subject_enrollment_id: 901, created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00", effective_term: "AY 2026-2027 1st Semester",
      subject: { course_code: "SPEC-101", course_title: "Spec SPEC-101", term_label: "AY 2026-2027 1st Semester" },
      withdrawal_window: { deadline: "2026-11-20", status: "Withdrawal window open", fee_consequence: "Spec fee: 10%." }, attachments: [], ...extra,
    });
    const { context, page, writes, info } = await formPage(browser, (d) => {
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.subject_enrollments = [ENROLLED(901, "SPEC-101")];
      d.workflow_messages = [];
      d.withdrawal_application = returned ? application({ status: "Returned", reason: "Spec first reason." }) : application();
    });
    try {
      await page.goto("/student/requests/withdrawal");
      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 3, name: "Your withdrawal request" })).toBeVisible();
      await expect(main).toContainText("Your selected subject and reason are saved and read-only.");
      await expect(main).toContainText("SPEC-101 — Spec SPEC-101");
      await expect(main).toContainText("AY 2026-2027 1st Semester · submitted Oct 1, 2026");
      await expect(main).toContainText("Eligibility recorded at submission");
      await expect(main).toContainText("Eligible until Nov 20, 2026");
      await expect(main).toContainText("Withdrawal window open");
      await expect(main).toContainText("Fee: Spec fee: 10%.");
      await expect(main).toContainText("Spec saved reason.");
      await expect(main.getByText("Completed", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /withdrawal/i })).toHaveCount(0);
      await snap(page, "withdrawal-readonly");

      returned = true;
      await page.reload();
      await expect(main.getByRole("heading", { level: 3, name: "Ask to withdraw from a subject" })).toBeVisible();
      await expect(main.getByText("Needs revision", { exact: true })).toHaveCount(0);
      await expect(ctl(page, "Reason for withdrawing from this subject")).toHaveValue("Spec first reason.");
      await submitButton(page, "Resubmit withdrawal request").click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/withdrawal").body).toEqual({ student_id: info.studentId, reason: "Spec first reason.", subject_enrollment_id: 901 });
      await snap(page, "withdrawal-returned");
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Research
  test("Research (Title Defense): stage header, requirement rows, PDF rules, the Form 1 title auto-fill and the payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => researchBase(d, { ready: true, files: true, caseTitle: "Spec Saved Title" }));
    try {
      await page.goto("/student/research");
      const main = page.locator("main");
      await expect(main).toContainText("Automatically detected stage");
      await expect(main).toContainText("Title Defense");
      await expect(main).toContainText("Spec milestone: submit Form 1 and three concept papers.");
      await expect(main.getByText("Pending", { exact: true }).first()).toBeVisible();
      await expect(main).toContainText("Research title");
      await expect(main).toContainText("Spec Saved Title");
      await expect(main).toContainText("Adviser");
      for (const stage of ["Title Defense", "Proposal Defense", "Final Defense", "Completion"]) await expect(main.getByText(stage, { exact: true }).first()).toBeVisible();
      await expectRequired(page, "Research title from uploaded Form 1", false);
      await expect(fieldOf(page, "Research title from uploaded Form 1")).toContainText("This fills automatically after the Form 1 application PDF is uploaded below.");
      await expect(ctl(page, "Research title from uploaded Form 1")).toHaveValue("Spec Saved Title");
      await expect(ctl(page, "Research title from uploaded Form 1")).toHaveAttribute("placeholder", "Upload Form 1 below to auto-fill");
      await expect(main).toContainText("Files you upload");
      await expect(main).toContainText("Only these items require action from you for this milestone.");
      await expect(main).toContainText("Form 1 application");
      await expect(main).toContainText("1 of 1 file uploaded");
      await expect(main).toContainText("1 of 3 files uploaded");
      await expect(main).toContainText("Completed by staff or the system");
      await expect(main).toContainText("These update automatically after review, panel matching, or scheduling.");
      await expect(main).toContainText("Pending Staff Action");
      await expect(fieldOf(page, "Message to the Research Coordinator")).toContainText("Optional context for this submission.");
      await expectRequired(page, "Message to the Research Coordinator", false);
      await expect(main.locator('input[type="file"]')).toHaveCount(2);
      await expect(main.locator('input[type="file"]').first()).toHaveAttribute("accept", "application/pdf,.pdf");
      await expect(main.getByText("Add another", { exact: true })).toHaveCount(1); // Form 1 has all its files: the button offers another
      await expect(main.getByText("Upload PDF", { exact: true })).toHaveCount(1); // the concept papers still need two more
      // the compliance of the first concept paper
      await expect(main).toContainText("88%");
      const compliance = main.locator("details").filter({ hasText: "Spec compliance summary" });
      await compliance.locator("summary").click();
      await expect(compliance).toContainText("Has an abstract");
      await expect(compliance).toContainText("Spec evidence line.");
      await expect(compliance).toContainText("Spec Handbook");
      await expect(compliance).toContainText("Spec citation text.");
      await expect(compliance.getByText("Sources", { exact: true })).toBeVisible();
      await expect(main).toContainText("Removing Form 1 or any concept paper revokes the Academic Coordinator endorsement and clears Panel Matching.");
      await snap(page, "research-title");

      // only a PDF is accepted
      await main.locator('input[type="file"]').nth(0).setInputFiles(TXT);
      await expect(main.getByText("Please choose a PDF file.", { exact: true })).toBeVisible();
      expect(writes.filter((w) => w.path === "research-evidence/upload")).toHaveLength(0);
      // a Form 1 upload sends the gate, the item and the file, then fills the title from the answer
      await main.locator('input[type="file"]').nth(0).setInputFiles(PDF);
      await expect(ctl(page, "Research title from uploaded Form 1")).toHaveValue("Spec Title From Form 1");
      await expect(main.getByText("Auto-filled from spec-form1.pdf.", { exact: true })).toBeVisible();
      const upload = lastWrite(writes, "research-evidence/upload");
      expect(upload.raw).toContain('name="gate"');
      expect(upload.raw).toContain("Form 1 - Title Defense");
      expect(upload.raw).toContain('name="item_name"');
      expect(upload.raw).toContain(FORM1);
      expect(upload.raw).toContain('filename="spec.pdf"');
      await expect(main.getByText("Please choose a PDF file.", { exact: true })).toHaveCount(0);

      // Submit: the exact payload
      await ctl(page, "Message to the Research Coordinator").fill("Spec message.");
      const submit = submitButton(page, "Submit Form 1 for review");
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/research-gate").body).toEqual({ student_id: info.studentId, research_title: "Spec Title From Form 1", submitted_package: "Spec message." });
      await snap(page, "research-sent");
    } finally {
      await context.close();
    }
  });

  test("Research (not ready): Submit is off with its reasons; a failed upload shows the server message", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => researchBase(d, { ready: false }), { failPath: "research-evidence/upload", failMessage: "Spec: the file is too big." });
    try {
      await page.goto("/student/research");
      const main = page.locator("main");
      await expect(main).toContainText("0 of 1 file uploaded");
      await expect(main).toContainText("0 of 3 files uploaded");
      await expect(main.getByText("Upload PDF", { exact: true })).toHaveCount(2);
      await expect(ctl(page, "Research title from uploaded Form 1")).toHaveValue("");
      const submit = submitButton(page, "Submit Form 1 for review");
      await expect(submit).toBeDisabled();
      await expect(main).toContainText("Upload all required files before submitting this milestone.");
      await snap(page, "research-empty");
      await main.locator('input[type="file"]').nth(1).setInputFiles(PDF);
      await expect(main.getByText("Spec: the file is too big.", { exact: true })).toBeVisible();
      expect(writes.filter((w) => w.path === "research-evidence/upload")).toHaveLength(1);
      await snap(page, "research-upload-error");
    } finally {
      await context.close();
    }
  });

  test("Research (ready, no title yet): the hint asks for Form 1", async ({ browser }) => {
    const { context, page } = await formPage(browser, (d) => researchBase(d, { ready: true }));
    try {
      await page.goto("/student/research");
      await expect(submitButton(page, "Submit Form 1 for review")).toBeDisabled();
      await expect(page.locator("main")).toContainText("Upload Form 1 so the research title can be read automatically.");
      await expect(page.locator("main")).toContainText("Research title pending Form 1 submission");
    } finally {
      await context.close();
    }
  });

  test("Research (files): removing a file asks first, a concept paper can be checked, a matched panel locks the package", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => researchBase(d, { ready: true, files: true, caseTitle: "Spec Saved Title" }));
    try {
      await page.goto("/student/research");
      const main = page.locator("main");
      // cancel: nothing is deleted
      await main.getByRole("button", { name: "Remove form1-spec.pdf" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Remove file?");
      await expect(dialog).toContainText('Remove "form1-spec.pdf"? This will clear the current Panel Matching result for this stage.');
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes.filter((w) => w.path === "research-evidence/delete")).toHaveLength(0);
      // confirm: the file is deleted
      await main.getByRole("button", { name: "Remove form1-spec.pdf" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Remove file" }).click();
      await expect.poll(() => writes.filter((w) => w.path === "research-evidence/delete").length).toBe(1);
      expect(lastWrite(writes, "research-evidence/delete").method).toBe("DELETE");
      await page.waitForLoadState("networkidle"); // the page fetches its context again after a delete
      // a compliance check of the concept paper
      await main.getByRole("button", { name: "Recheck" }).click();
      await expect.poll(() => writes.filter((w) => w.path === "concept-paper-compliance").length).toBe(1);
      expect(lastWrite(writes, "concept-paper-compliance").method).toBe("POST");
      expect(lastWrite(writes, "concept-paper-compliance").body).toEqual({});
      await page.waitForLoadState("networkidle");
    } finally {
      await context.close();
    }
  });

  test("Research (panel matched): the title-defense package is locked", async ({ browser }) => {
    const locked = await formPage(browser, (d) => researchBase(d, { ready: true, files: true, caseTitle: "Spec Saved Title", panel: true }));
    try {
      await locked.page.goto("/student/research");
      const main = locked.page.locator("main");
      await expect(main.getByText("Locked after panel match", { exact: true })).toHaveCount(2);
      await expect(main).toContainText("This title-defense package is read-only because a panel has already been matched.");
      await expect(main.locator('input[type="file"]').first()).toBeDisabled();
      await expect(main.getByRole("button", { name: "Remove form1-spec.pdf" })).toBeDisabled();
      await snap(locked.page, "research-locked");
    } finally {
      await locked.context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Defense schedule
  test("Defense schedule: the request form, the missing-date summary and the exact payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => {
      researchBase(d, { panel: true, caseTitle: "Spec Saved Title" });
      d.schedules = [];
      d.defense_follow_up = null;
    });
    try {
      await page.goto("/student/defense-schedule");
      const main = page.locator("main");
      await expectRequired(page, "Preferred date", true);
      await expectRequired(page, "Defense type", true);
      await expectRequired(page, "Mode", false);
      await expectRequired(page, "Venue / meeting link", false);
      await expectRequired(page, "Scheduling constraints", false);
      await expect(fieldOf(page, "Defense type")).toContainText("Your current stage is Title Defense.");
      await expect(ctl(page, "Defense type")).toHaveValue("Title Defense");
      await expect(ctl(page, "Defense type").locator("option")).toHaveText(["Title Defense", "Proposal Defense", "Final Defense"]);
      await expect(ctl(page, "Mode").locator("option")).toHaveText(["On-site", "Online", "Hybrid"]);
      await expect(ctl(page, "Mode")).toHaveValue("On-site");
      await expect(ctl(page, "Preferred date")).toHaveAttribute("type", "date");
      const submit = submitButton(page, "Submit schedule request");
      await expect(submit).toBeEnabled();
      await snap(page, "schedule-form");
      await submit.click(); // no date: the problem summary stops it (P82)
      await page.waitForTimeout(300);
      expect(lastWrite(writes, "requests/defense-scheduling")).toBeUndefined();
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toContainText("Choose the date you want for your defense.");
      await ctl(page, "Preferred date").fill("2026-12-04");
      await ctl(page, "Defense type").selectOption("Final Defense");
      await ctl(page, "Mode").selectOption("Online");
      await ctl(page, "Venue / meeting link").fill("https://meet.example/spec");
      await ctl(page, "Scheduling constraints").fill("Not on Mondays.");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/defense-scheduling").body).toEqual({
        student_id: info.studentId, preferred_date: "2026-12-04", defense_type: "Final Defense", mode: "Online", venue: "https://meet.example/spec", constraints: "Not on Mondays.",
      });
      await expect(main).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("Defense schedule: a booked defense closes the form; revisions need a note or a file and send both", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      researchBase(d, { panel: true, caseTitle: "Spec Saved Title" });
      d.schedules = [{ id: 901, defense_type: "Title Defense", preferred_date: "2026-12-04", status: "Scheduled", display_status: "Scheduled", is_active: true, start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Room B", panelists: [], attention: [] }];
      d.defense_follow_up = { can_submit_revisions: true, label: "Pass with revisions", summary: "Spec summary of the revisions.", confirmed_by_role: "Adviser", verdict: { id: 55 } };
    });
    try {
      await page.goto("/student/defense-schedule");
      const main = page.locator("main");
      await expect(main.getByRole("status").filter({ hasText: "A defense is already booked, so you cannot send another request." })).toContainText("Your Title Defense is scheduled. To change it, ask the Research Coordinator.");
      await expect(submitButton(page, "Submit schedule request")).toBeDisabled();
      await expect(main).toContainText("New requests are closed while a defense is booked.");
      await expect(ctl(page, "Preferred date")).toBeDisabled();
      await snap(page, "schedule-booked");

      // the revision form
      const revisions = page.getByRole("form", { name: "Submit revised manuscript" });
      await expect(revisions.getByRole("heading", { level: 3, name: "Submit revised manuscript" })).toBeVisible();
      await expect(revisions).toContainText("Defense outcome: Pass with revisions");
      await expect(revisions).toContainText("Spec summary of the revisions.");
      await expect(revisions).toContainText("Your Adviser confirms the revisions. Only after that can you move to the next stage.");
      await expectRequired(page, "What you revised", false);
      await expectRequired(page, "Revised manuscript", false);
      await expect(fieldOf(page, "What you revised")).toContainText("Optional when you attach the manuscript.");
      await expect(fieldOf(page, "Revised manuscript")).toContainText("Optional when you describe the revisions above.");
      await expect(revisions.locator('input[type="file"]')).not.toHaveAttribute("accept", /./);
      const send = revisions.getByRole("button", { name: "Submit revisions", exact: true });
      await send.click();
      await expect(revisions.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link", { name: "Attach the revised manuscript or describe what you revised." })).toBeVisible();
      expect(writes.filter((w) => w.path === "defense-verdicts/revisions")).toHaveLength(0);
      await snap(page, "schedule-revisions-error");
      await ctl(page, "What you revised").fill("Spec: fixed chapter 3.");
      await revisions.locator('input[type="file"]').setInputFiles({ name: "manuscript-spec.docx", mimeType: "application/octet-stream", buffer: Buffer.from("docx") });
      await expect(revisions).toContainText("manuscript-spec.docx");
      await send.click();
      await expect(revisions.getByRole("status").filter({ hasText: "Spec: revisions sent." })).toBeVisible();
      const write = lastWrite(writes, "defense-verdicts/revisions");
      expect(write.method).toBe("POST");
      expect(write.raw).toContain('name="note"');
      expect(write.raw).toContain("Spec: fixed chapter 3.");
      expect(write.raw).toContain('filename="manuscript-spec.docx"');
      await expect(ctl(page, "What you revised")).toHaveValue(""); // cleared after sending
      await snap(page, "schedule-revisions-sent");
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Practicum
  test("Practicum (MOA step): scope notice, eligibility rows, required site, MOA upload rules and the exact payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => practicumBase(d, null));
    try {
      await page.goto("/student/practicum");
      const main = page.locator("main");
      await expect(main).toContainText("Psychology and MSGC students only");
      await expect(main).toContainText("Spec practicum scope text. Your program, MAPSY — Master of Arts in Psychology, is within this scope.");
      await expect(main).toContainText("Current practicum stage");
      await expect(main).toContainText("Only the requirements due now can be edited. Completed submissions stay available below.");
      await expect(main).toContainText("Not submitted");
      await expect(main).toContainText("Eligibility Check / Pre-Practicum Requirements");
      await expect(main).toContainText("Eligibility recommendation");
      await expect(main).toContainText("Based on the encoded course audit and research milestone records.");
      await expect(main).toContainText("MAPSY - Spec");
      await expect(main).toContainText("9 / 6");
      await expect(main).toContainText("Source: course_audit.by_category");
      await expect(main).toContainText("Source: Not recorded");
      await expect(main).toContainText("No source data");
      await expect(main.getByText("Verified", { exact: true }).first()).toBeVisible();
      await expect(main.getByText("Needs verification", { exact: true })).toHaveCount(1);
      await expect(main).toContainText("MOA Submission");
      await expect(main).toContainText("What you need to submit now: practicum site details and the signed MOA PDF.");
      await expectRequired(page, "Practicum site / company", true);
      await expectRequired(page, "Supervisor name", false);
      await expectRequired(page, "Practicum MOA PDF", false);
      await expectRequired(page, "Remarks for the reviewer", false);
      await expect(fieldOf(page, "Practicum MOA PDF")).toContainText("PDF only, up to 25 MB. The file is stored with your request.");
      await expect(main.locator('input[type="file"]')).toHaveAttribute("accept", "application/pdf,.pdf");
      await expect(ctl(page, "Remarks for the reviewer")).toHaveAttribute("placeholder", "Add a message for the staff reviewing this submission.");
      const submit = submitButton(page, "Submit MOA stage");
      await expect(submit).toBeEnabled();
      await submit.click(); // no site, no MOA: both are listed (P82)
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link")).toHaveCount(2);
      expect(lastWrite(writes, "requests/practicum")).toBeUndefined();
      await snap(page, "practicum-moa");
      // a non-PDF is refused in the field, a PDF is stored and unlocks Submit
      await main.locator('input[type="file"]').setInputFiles(TXT);
      await expect(fieldOf(page, "Practicum MOA PDF").getByRole("alert")).toHaveText("Please choose a PDF file.");
      expect(writes.filter((w) => w.path === "request-attachments/upload")).toHaveLength(0);
      await main.locator('input[type="file"]').setInputFiles(PDF);
      await expect(main.getByText("View uploaded application")).toHaveAttribute("href", "/spec/spec.pdf");
      const upload = lastWrite(writes, "request-attachments/upload");
      expect(upload.raw).toContain('name="request_type"');
      expect(upload.raw).toContain("practicum");
      expect(upload.raw).toContain('filename="spec.pdf"');
      await expect(submit).toBeEnabled();
      await ctl(page, "Practicum site / company").fill("Spec Clinic");
      await ctl(page, "Supervisor name").fill("Dr. Spec");
      await ctl(page, "Remarks for the reviewer").fill("Spec remarks.");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/practicum").body).toEqual({
        student_id: info.studentId, attachment_id: 7001, certificate_attachment_id: null, practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec",
        required_hours: 200, completed_hours: 0, remarks: "Spec remarks.",
      });
      await snap(page, "practicum-moa-sent");
    } finally {
      await context.close();
    }
  });

  test("Practicum (completion step): hours, certificate count, the new PDF and the payload; MOA read-only", async ({ browser }) => {
    const record = {
      id: 21, status: "Practicum In Progress", updated_at: "2026-10-02T09:00:00", practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec", required_hours: 200, completed_hours: 50,
      certificate_count: 1, moa_attachment: { id: 6001, name: "moa-spec.pdf", url: "/spec/moa.pdf", file_exists: true, uploaded_by: "Spec Student", uploaded_at: "2026-09-01T09:00:00" },
      certificate_attachment: null, completion_attachments: [], attachments: [],
    };
    const { context, page, writes, info } = await formPage(browser, (d) => practicumBase(d, record));
    try {
      await page.goto("/student/practicum");
      const main = page.locator("main");
      await expect(main).toContainText("Practicum In Progress");
      // the MOA is read-only now
      await expect(main).toContainText("Completed MOA information is read-only while you continue to the next stage.");
      await expect(main).toContainText("Practicum site");
      await expect(main).toContainText("Spec Clinic");
      await expect(main).toContainText("Dr. Spec");
      await expect(main).toContainText("moa-spec.pdf");
      await expect(main.getByRole("link", { name: "View file" })).toHaveAttribute("href", "/spec/moa.pdf");
      // the completion step
      await expect(main).toContainText("What you need to submit now: completed hours and one PDF containing the required completion documents.");
      await expectRequired(page, "Required hours", false);
      await expectRequired(page, "Completed hours", true);
      await expect(ctl(page, "Required hours")).toHaveAttribute("readonly", "");
      await expect(ctl(page, "Required hours")).toHaveAttribute("aria-readonly", "true");
      await expect(ctl(page, "Required hours")).toHaveValue("200");
      await expect(ctl(page, "Completed hours")).toHaveAttribute("min", "0");
      await expect(ctl(page, "Completed hours")).toHaveValue("50");
      await expect(main).toContainText("Certificates are counted automatically");
      await expect(main).toContainText("The system currently detects 1 submitted certificate file. Uploading an additional file updates this count.");
      await expect(fieldOf(page, "Completion certificates / forms / hours proof PDF")).toBeVisible();
      const submit = submitButton(page, "Submit completion stage");
      await expect(submit).toBeEnabled();
      await submit.click(); // the new PDF is missing (P82)
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link", { name: "Upload the completion certificates as a PDF." })).toBeVisible();
      expect(lastWrite(writes, "requests/practicum")).toBeUndefined();
      await snap(page, "practicum-completion");
      await main.locator('input[type="file"]').setInputFiles(PDF);
      await expect(submit).toBeEnabled();
      await ctl(page, "Completed hours").fill("200");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/practicum").body).toEqual({
        student_id: info.studentId, attachment_id: 6001, certificate_attachment_id: 7001, practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec",
        required_hours: 200, completed_hours: "200", remarks: "",
      });
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- Graduation
  test("Graduation (eligible): the school-year choices, the PDF upload and the exact payload", async ({ browser }) => {
    const { context, page, writes, info } = await formPage(browser, (d) => {
      d.graduation_endorsement = null;
      d.graduation_eligibility = { eligible: true, status: "Eligible", missing_coursework: [], missing_research_requirements: [], missing_practicum_requirement: "" };
      d.graduation_review_windows = ["AY 2026-2027", "AY 2025-2026"];
      d.graduation_default_review_window = "AY 2026-2027";
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/graduation");
      const main = page.locator("main");
      await expect(main).toContainText("Current graduation stage");
      await expect(main).toContainText("Your application stays visible while each reviewing office completes its part.");
      await expect(main).toContainText("Not submitted");
      await expect(main).toContainText("What you need to submit now: the review window and signed graduation application / review-window PDF.");
      await expectRequired(page, "Graduation school year", true);
      await expect(fieldOf(page, "Graduation school year")).toContainText("Only AY 2026-2027 is open. Other school years are shown in gray and cannot be selected.");
      const year = ctl(page, "Graduation school year");
      await expect(year.locator("option")).toHaveText(["AY 2026-2027 — Current school year", "AY 2025-2026 — Not currently open"]);
      await expect(year.locator("option").nth(1)).toHaveAttribute("disabled", "");
      await expect(year).toHaveValue("AY 2026-2027");
      await expectRequired(page, "Signed graduation application / review-window PDF", false);
      await expectRequired(page, "Remarks for the reviewer", false);
      const submit = submitButton(page, "Submit graduation application");
      await expect(submit).toBeEnabled();
      await submit.click(); // no PDF yet (P82)
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link", { name: "Upload your signed graduation application as a PDF." })).toBeVisible();
      expect(lastWrite(writes, "requests/graduation")).toBeUndefined();
      for (const title of ["Staff and Coursework Review", "Requirements Validation", "Dean Endorsement", "Endorsement Export", "Dean Emails List and Waits for Acknowledgement"]) await expect(main.getByRole("heading", { level: 3, name: title })).toBeVisible();
      await expect(main).toContainText("Monitoring eligibility recommendation");
      await expect(main).toContainText("No missing requirements are currently flagged by the monitoring layer.");
      await snap(page, "graduation-form");
      await main.locator('input[type="file"]').setInputFiles(TXT);
      await expect(fieldOf(page, "Signed graduation application / review-window PDF").getByRole("alert")).toHaveText("Please choose a PDF file.");
      await main.locator('input[type="file"]').setInputFiles(PDF);
      await expect(submit).toBeEnabled();
      await ctl(page, "Remarks for the reviewer").fill("Spec graduation remarks.");
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/graduation").body).toEqual({ student_id: info.studentId, attachment_id: 7001, review_window: "AY 2026-2027", remarks: "Spec graduation remarks." });
      await snap(page, "graduation-sent");
    } finally {
      await context.close();
    }
  });

  test("Graduation (not eligible yet): the form is locked and the missing requirements are listed", async ({ browser }) => {
    const { context, page } = await formPage(browser, (d) => {
      d.graduation_endorsement = null;
      d.graduation_eligibility = {
        eligible: false, status: "Not eligible", missing_coursework: ["Spec course A"], missing_research_requirements: ["Spec research B"], missing_practicum_requirement: "Spec practicum C",
      };
      d.graduation_review_windows = ["AY 2026-2027"];
      d.graduation_default_review_window = "AY 2026-2027";
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/graduation");
      const main = page.locator("main");
      await expect(main).toContainText("This step opens only after coursework, research, completion documents, and any required practicum are complete.");
      await expect(main).toContainText("Complete the requirements listed in Step 3 before submitting a graduation application.");
      await expect(main).toContainText("Not eligible");
      for (const line of ["Coursework: Spec course A", "Research: Spec research B", "Practicum: Spec practicum C"]) await expect(main).toContainText(line);
      await expect(page.getByRole("button", { name: /graduation application/ })).toHaveCount(0);
      await expect(fieldOf(page, "Graduation school year")).toHaveCount(0);
      await snap(page, "graduation-locked");
    } finally {
      await context.close();
    }
  });
});
