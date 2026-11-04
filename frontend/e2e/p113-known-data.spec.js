// e2e-writes: none
// Owner rule 2026-11-04: "never make a user type, pick or tick something the system already knows or can check."
// Pins the forms that used to ask for a known value (issues I-245 to I-253, I-262, I-263): the page shows the value as text
// (or pre-fills it) and the request body no longer carries it. Every write is answered by the browser (page.route), so
// nothing is saved and the exact request bodies can be asserted. The server side of the same rule is tested in tests/.
//
// Student forms (the seeded demo student, the portal context rewritten per test, as p42 does):
//   ResearchRequestForm   I-245 title box only at the Title Defense gate while no title is on record; I-253 no student_id
//   ScheduleRequestForm   I-250 no "Defense type" picker; I-253 no student_id
//   GraduationRequestForm I-251 school year is text, no review_window sent; I-253 no student_id
//   PracticumRequestForm  I-253 no student_id, required hours shown not posted
//   MyCoursesPanel        I-246 no term_id sent
// Monitoring Sheet (GS staff):
//   Add student / Correct details   I-247 adviser is a faculty pick (adviser_faculty_id), I-262 school year pre-filled
//   Subject rows                    I-249 "Term taken" is a pick, I-263 an "other subject" code in the curriculum fills title and units
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const EMAIL = "student@usls.edu.ph";
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PDF = { name: "spec.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 spec") };
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

/** The control of the field whose label is `label` (select / input / textarea). */
function ctl(page, label) {
  const name = new RegExp(`^${esc(label)}(\\s*\\*)?\\s*$`);
  return page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: name }) }).locator("select, input:not([type=file]), textarea").first();
}
const submitButton = (page, name) => page.getByRole("button", { name, exact: true });
const lastWrite = (writes, prefix) => [...writes].reverse().find((w) => w.path.startsWith(prefix));

// ================================================================================================ student forms
async function formPage(browser, mutate, extraRoutes) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), `sign in as ${EMAIL}`).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe(EMAIL);
  const writes = [];
  await context.route("**/api/student-portal/context", async (route) => {
    try {
      const response = await route.fetch();
      const data = await response.json();
      mutate?.(data);
      await route.fulfill({ response, json: data });
    } catch (error) {
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    }
  });
  const answer = (path, json) => async (route) => {
    const request = route.request();
    let body = null;
    try { body = JSON.parse(request.postDataBuffer()?.toString("latin1") || ""); } catch { /* multipart */ }
    writes.push({ method: request.method(), path, body });
    return route.fulfill({ json });
  };
  await context.route("**/api/student-portal/requests/*", async (route) => answer(new URL(route.request().url()).pathname.replace("/api/student-portal/requests/", "requests/"), { message: "Spec: request saved." })(route));
  await context.route("**/api/student-portal/request-attachments/upload", answer("request-attachments/upload", { attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf", file_exists: true } }));
  await context.route("**/api/student-portal/research-evidence/upload", answer("research-evidence/upload", { research_title: "Spec Title From Form 1", document: { evidence_reference: "spec-form1.pdf" } }));
  await context.route("**/api/student-portal/enrollment", answer("enrollment", { message: "Spec: subjects saved." }));
  const page = await context.newPage();
  const close = context.close.bind(context);
  context.close = async () => {
    for (const open of context.pages()) await open.waitForLoadState("networkidle").catch(() => {});
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await close();
  };
  return { context, page, writes };
}

const STAGES = [
  { name: "Title Defense", gate: "Form 1 - Title Defense", complete: false, status: "Pending" },
  { name: "Proposal Defense", gate: "Form 4 - Proposal Defense Readiness", complete: false, status: "Locked" },
  { name: "Final Defense", gate: "Final Defense", complete: false, status: "Locked" },
  { name: "Completion", gate: "Completion Evidence", complete: false, status: "Locked" },
];
const REQ = (item_name, label, extra = {}) => ({
  item_name, label, description: `Spec description of ${label}.`, student_upload: true, required_file_count: 1, file_count: 0, files: [],
  status: "Missing", status_label: "Missing", adviser_signature_required: false, outcome: null, source_type: "student_upload", template_url: null, ...extra,
});
/** A research case at `stage` whose files are all uploaded (Submit is on). `title` null = no title on record yet. */
function researchAt(data, { stage = "Title Defense", title = null, panel = false } = {}) {
  const index = STAGES.findIndex((s) => s.name === stage);
  data.research_case = { ...(data.research_case || {}), id: 1, title: title || "Research title pending Form 1 submission", status: "Pending" };
  data.panel = panel ? [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }] : [];
  data.research_progress = {
    gate: STAGES[index].gate, stage, stage_index: index, status: "Pending", stages: STAGES,
    milestone: {
      value: STAGES[index].gate, label: `${stage} Readiness`, short_label: "Milestone", description: "Spec milestone.",
      student_uploads_ready: true, student_missing_count: 0, overall_complete: false,
      requirements: [REQ("Spec upload", "Spec upload", { file_count: 1, status_label: "Uploaded" })],
    },
  };
}
async function confirmSend(page) {
  await page.getByRole("dialog", { name: "Send this request?" }).getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Spec: request saved.")).toBeVisible();
}

test.describe("Student forms never ask for what the system knows", () => {
  test("I-245 / I-253: the research title box shows only at the Title Defense gate with no title on record; no student_id", async ({ browser }) => {
    // 1. Title Defense, no title yet: the box stays (Form 1 fills it), the body has the title and no student_id
    const first = await formPage(browser, (d) => researchAt(d));
    try {
      await first.page.goto("/student/research");
      await expect(ctl(first.page, "Research title from uploaded Form 1")).toBeVisible();
      await ctl(first.page, "Research title from uploaded Form 1").fill("Spec Typed Title");
      await submitButton(first.page, "Submit Milestone for review").click();
      await confirmSend(first.page);
      expect(lastWrite(first.writes, "requests/research-gate").body).toEqual({ research_title: "Spec Typed Title", submitted_package: "" });
    } finally {
      await first.context.close();
    }
    // 2. Title Defense with a title on record: shown as text, no box, no research_title sent
    const second = await formPage(browser, (d) => researchAt(d, { title: "Spec Saved Title" }));
    try {
      await second.page.goto("/student/research");
      await expect(second.page.locator("main")).toContainText("Spec Saved Title");
      await expect(second.page.getByText("Research title from uploaded Form 1")).toHaveCount(0);
      await submitButton(second.page, "Submit Milestone for review").click();
      await confirmSend(second.page);
      expect(lastWrite(second.writes, "requests/research-gate").body).toEqual({ submitted_package: "" });
    } finally {
      await second.context.close();
    }
    // 3. A later gate: the same
    const third = await formPage(browser, (d) => researchAt(d, { stage: "Proposal Defense", title: "Spec Saved Title" }));
    try {
      await third.page.goto("/student/research");
      await expect(third.page.locator("main")).toContainText("Spec Saved Title");
      await expect(third.page.getByText("Research title from uploaded Form 1")).toHaveCount(0);
      await submitButton(third.page, "Submit Milestone for review").click();
      await confirmSend(third.page);
      expect(lastWrite(third.writes, "requests/research-gate").body).toEqual({ submitted_package: "" });
    } finally {
      await third.context.close();
    }
  });

  test("I-250 / I-253: the defense type is shown, not picked; the body has no defense_type and no student_id", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      researchAt(d, { stage: "Proposal Defense", title: "Spec Saved Title", panel: true });
      d.schedules = [];
      d.defense_follow_up = null;
    });
    try {
      await page.goto("/student/defense-schedule");
      await expect(page.getByText("Defense type", { exact: true })).toHaveCount(0); // the picker is gone
      await expect(page.locator("main select").filter({ has: page.locator("option", { hasText: "Final Defense" }) })).toHaveCount(0);
      await expect(page.locator("main")).toContainText("Your next defense: Proposal Defense");
      await ctl(page, "Preferred date").fill("2026-12-04");
      await submitButton(page, "Submit schedule request").click();
      await confirmSend(page);
      expect(lastWrite(writes, "requests/defense-scheduling").body).toEqual({ preferred_date: "2026-12-04", mode: "On-site", venue: "", constraints: "" });
    } finally {
      await context.close();
    }
  });

  test("I-251 / I-253: the graduation school year is text; the body has no review_window and no student_id", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.graduation_endorsement = null;
      d.graduation_eligibility = { eligible: true, status: "Eligible", missing_coursework: [], missing_research_requirements: [], missing_practicum_requirement: "" };
      d.graduation_review_windows = ["AY 2026-2027", "AY 2025-2026"];
      d.graduation_default_review_window = "AY 2026-2027";
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/graduation");
      const main = page.locator("main");
      await expect(main.locator("select")).toHaveCount(0);
      await expect(main).toContainText("Graduation school year");
      await expect(main).toContainText("AY 2026-2027");
      await main.locator('input[type="file"]').setInputFiles(PDF);
      await ctl(page, "Remarks for the reviewer").fill("Spec graduation remarks.");
      await submitButton(page, "Submit graduation application").click();
      await confirmSend(page);
      expect(lastWrite(writes, "requests/graduation").body).toEqual({ attachment_id: 7001, remarks: "Spec graduation remarks." });
    } finally {
      await context.close();
    }
  });

  test("I-253: the practicum body has no student_id and no required_hours (shown as text)", async ({ browser }) => {
    const record = {
      id: 21, status: "Practicum In Progress", updated_at: "2026-10-02T09:00:00", practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec", required_hours: 200, completed_hours: 50,
      certificate_count: 1, moa_attachment: { id: 6001, name: "moa-spec.pdf", url: "/spec/moa.pdf", file_exists: true, uploaded_by: "Spec Student", uploaded_at: "2026-09-01T09:00:00" },
      certificate_attachment: null, completion_attachments: [], attachments: [],
    };
    const { context, page, writes } = await formPage(browser, (d) => {
      d.student.program_has_practicum = true;
      d.student.program_code = "MAPSY";
      d.student.program_name = "Master of Arts in Psychology";
      d.practicum_eligibility = { eligible: true, status: "Verified", checklist: [], program_scope: {} };
      d.practicum_program_scope = { description: "Spec practicum scope text." };
      d.practicum_record = record;
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/practicum");
      const main = page.locator("main");
      await expect(main).toContainText("Required hours");
      await expect(main).toContainText("200"); // as text
      await expect(page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: /^Required hours/ }) }).locator("input")).toHaveCount(0);
      await main.locator('input[type="file"]').setInputFiles(PDF);
      await ctl(page, "Completed hours").fill("200");
      await submitButton(page, "Submit completion stage").click();
      await confirmSend(page);
      expect(lastWrite(writes, "requests/practicum").body).toEqual({
        attachment_id: 6001, certificate_attachment_id: 7001, practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec", completed_hours: "200", remarks: "",
      });
    } finally {
      await context.close();
    }
  });

  test("I-246: saving the current subjects sends only the subjects, never a term_id", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.current_term = { id: 5, label: "AY 2026-2027 1st Semester" };
      d.leave_overview = { ...(d.leave_overview || {}), banner: null };
      d.student = { ...d.student, enrollment_tag: "Enrolled", current_stage: d.student.current_stage };
      d.curriculum_subjects = [
        { id: 801, code: "SPEC 101", title: "Spec One", units: 3, category: "Core", status: "Missing", is_enrolled: false, is_offered: true, recommended_term: "1st" },
        { id: 802, code: "SPEC 102", title: "Spec Two", units: 3, category: "Core", status: "Missing", is_enrolled: false, is_offered: true, recommended_term: "1st" },
      ];
    });
    try {
      await page.goto("/student/enrollment");
      await page.getByLabel("Currently enrolled in SPEC 101").check();
      await page.getByRole("button", { name: "Save current subjects" }).click();
      await expect(page.getByText("Spec: subjects saved.")).toBeVisible();
      expect(lastWrite(writes, "enrollment").body).toEqual({ course_ids: [801] });
    } finally {
      await context.close();
    }
  });
});

// ================================================================================================ Monitoring Sheet
async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}
/** "AY 2026-2027 1st Semester" -> "26-27" */
const LEGACY = "AY 2019-2020 1st Semester";
const ayEntry = (label) => { const m = /(\d{4})\s*-\s*(\d{4})/.exec(label); return `${m[1].slice(2)}-${m[2].slice(2)}`; };

test.describe("Monitoring Sheet (GS staff) uses what the system knows", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180_000 });

  async function facts(page) {
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const current = grid.terms.find((t) => t.relative_label === "Current");
    expect(current, "a current semester is configured").toBeTruthy();
    const faculty = (await okJson(await page.request.get("/api/faculty"), "faculty")).items.filter((f) => f.active !== false);
    expect(faculty.length, "seeded faculty").toBeGreaterThan(1);
    const salonga = grid.students.find((s) => s.last_name === "Salonga" && s.first_name === "Bea");
    return { grid, current, faculty, salonga };
  }
  /** Answers writes with `json`, records them, lets every other request through. */
  async function captureWrites(page, pattern, method, json, writes) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      if (request.method() !== method) return route.fallback();
      writes.push({ method, url: new URL(request.url()).pathname, body: request.postDataJSON() });
      return route.fulfill({ json });
    });
  }
  /** Shapes the student's record: one curriculum subject not taken, one taken with an old semester label. */
  async function stubRecord(page, studentId, adviser = () => null) {
    const real = await okJson(await page.request.get(`/api/monitoring/students/${studentId}`), "record");
    const curriculum = real.subjects.filter((s) => s.in_curriculum && !s.removed);
    const [missing, taken] = curriculum;
    await page.route(new RegExp(`/api/monitoring/students/${studentId}$`), async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const response = await route.fetch();
      const data = await response.json();
      data.permissions = { ...(data.permissions || {}), can_edit: true };
      if (adviser()) data.student.adviser_name = adviser();
      data.subjects = data.subjects.map((row) => {
        if (row.course_id === missing.course_id) return { ...row, status: "Missing", record_id: null, term_label: "", source: "" };
        if (row.course_id === taken.course_id) return { ...row, status: "Completed", record_id: 990001, term_label: LEGACY, source: "Manual" };
        return row;
      });
      return route.fulfill({ response, json: data });
    });
    return { missing, taken };
  }
  const openPanel = async (page, name) => {
    await page.goto("/monitoring-sheet");
    await page.locator("main table tbody tr").filter({ hasText: name }).getByRole("button", { name: `Edit monitoring record of ${name}` }).click();
    const panel = page.getByRole("dialog", { name: new RegExp(esc(name)) });
    await expect(panel).toBeVisible();
    return panel;
  };

  test("I-247 / I-262: Add student picks the adviser from the faculty and pre-fills the school year", async ({ page }) => {
    const { current, faculty } = await facts(page);
    const writes = [];
    await captureWrites(page, "**/api/monitoring/students", "POST", { message: "Spec: added.", student: { id: 1 }, account: { email: "spec@usls.edu.ph", must_change_password: false } }, writes);
    await page.goto("/monitoring-sheet");
    await page.getByRole("button", { name: "Add student", exact: true }).first().click();
    const add = page.getByRole("dialog", { name: "Add student" });
    await expect(add).toBeVisible();
    // I-262: the school year is the current semester's, still editable
    const year = add.getByLabel("School year / AY entry");
    await expect(year).toHaveValue(ayEntry(current.label));
    await expect(year).toBeEditable();
    // I-247: a pick of active faculty, with an empty choice
    const adviser = add.locator("label", { hasText: "Adviser" }).locator("select");
    await expect(adviser).toHaveCount(1);
    await expect(adviser.locator("option").first()).toHaveText("No adviser yet");
    await expect(adviser.locator("option")).toHaveCount(faculty.length + 1);
    const program = add.locator("select").first();
    if (!(await program.inputValue())) await program.selectOption({ index: 1 });
    await add.getByLabel("Student ID").fill("7700999");
    await add.getByLabel("First name").fill("Spec");
    await add.getByLabel("Last name").fill("Picker");
    await adviser.selectOption(String(faculty[0].id));
    await add.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(add.getByText("Spec: added.")).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0].body.adviser_faculty_id).toBe(faculty[0].id);
    expect(writes[0].body).not.toHaveProperty("adviser_name");
    expect(writes[0].body.academic_year_entry).toBe(ayEntry(current.label));
  });

  test("I-247: Correct details preselects the adviser's faculty record; a name that matches none is shown and sends nothing", async ({ page }) => {
    const { faculty, salonga } = await facts(page);
    let adviserName = faculty[0].name;
    await stubRecord(page, salonga.id, () => adviserName);
    const writes = [];
    await captureWrites(page, new RegExp(`/api/monitoring/students/${salonga.id}$`), "PATCH", { message: "Spec: corrected." }, writes);

    // matching name: the faculty is preselected, nothing about the adviser is sent unless it changes
    let panel = await openPanel(page, "Salonga, Bea");
    await panel.getByRole("tab", { name: /Student details/ }).click();
    await panel.getByRole("button", { name: "Correct details" }).click();
    const adviser = panel.locator("label", { hasText: "Adviser" }).locator("select");
    await expect(adviser).toHaveCount(1);
    await expect(adviser).toHaveValue(String(faculty[0].id));
    await panel.getByLabel("First name").fill("Beatrice");
    await panel.getByRole("button", { name: "Review correction" }).click();
    let reason = page.getByRole("dialog", { name: "Save this correction?" });
    await reason.getByLabel(/Reason/).fill("Spec reason");
    await reason.getByRole("button", { name: "Save correction" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body).not.toHaveProperty("adviser_name");
    expect(writes[0].body).not.toHaveProperty("adviser_faculty_id");
    // picking another faculty sends its id
    panel = page.getByRole("dialog", { name: /Salonga, Bea/ });
    await panel.getByRole("tab", { name: /Student details/ }).click();
    await panel.getByRole("button", { name: "Correct details" }).click();
    await adviser.selectOption(String(faculty[1].id));
    await panel.getByRole("button", { name: "Review correction" }).click();
    reason = page.getByRole("dialog", { name: "Save this correction?" });
    await reason.getByLabel(/Reason/).fill("Spec reason");
    await reason.getByRole("button", { name: "Save correction" }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.adviser_faculty_id).toBe(faculty[1].id);
    expect(writes[1].body).not.toHaveProperty("adviser_name");

    // a name that is no faculty record: shown as a note, the pick is empty, nothing about the adviser is sent
    adviserName = "Dr. Typed Long Ago";
    await page.reload();
    panel = await openPanel(page, "Salonga, Bea");
    await panel.getByRole("tab", { name: /Student details/ }).click();
    await panel.getByRole("button", { name: "Correct details" }).click();
    await expect(adviser).toHaveValue("");
    await expect(panel).toContainText("Dr. Typed Long Ago is not a faculty record");
    await panel.getByLabel("Last name").fill("Salonga-Spec");
    await panel.getByRole("button", { name: "Review correction" }).click();
    reason = page.getByRole("dialog", { name: "Save this correction?" });
    await reason.getByLabel(/Reason/).fill("Spec reason");
    await reason.getByRole("button", { name: "Save correction" }).click();
    await expect.poll(() => writes.length).toBe(3);
    expect(writes[2].body).not.toHaveProperty("adviser_name");
    expect(writes[2].body).not.toHaveProperty("adviser_faculty_id");
  });

  test("I-249: Term taken is a pick of the configured semesters, the current one for a new row", async ({ page }) => {
    const { grid, current, salonga } = await facts(page);
    const labels = grid.terms.map((t) => t.label);
    expect(labels).not.toContain(LEGACY);
    const { missing, taken } = await stubRecord(page, salonga.id);
    const writes = [];
    await captureWrites(page, new RegExp(`/api/monitoring/students/${salonga.id}/subjects$`), "POST", { message: "Spec: row added." }, writes);
    const panel = await openPanel(page, "Salonga, Bea");

    // a new row (Add on a not-taken subject): a select, current semester chosen, nothing else to type
    await panel.getByRole("button", { name: `Add ${missing.code}` }).click();
    const form = panel.getByRole("form", { name: `Add ${missing.code}` });
    const term = form.locator("label", { hasText: "Term taken" }).locator("select");
    await expect(term).toHaveCount(1);
    await expect(term).toHaveValue(current.label);
    await expect(term.locator("option")).toHaveText(["Not recorded", ...labels]);
    await form.getByRole("button", { name: "Add row" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.term_label).toBe(current.label);

    // an existing row keeps its value, even when it is not in the list
    await panel.getByRole("button", { name: `Edit ${taken.code}` }).click();
    const editTerm = panel.getByRole("form", { name: `Edit ${taken.code}` }).locator("label", { hasText: "Term taken" }).locator("select");
    await expect(editTerm).toHaveValue(LEGACY);
    await expect(editTerm.locator("option", { hasText: LEGACY })).toHaveCount(1);
  });

  test("I-263: an other-subject code that is in the curriculum fills the title and units and locks them", async ({ page }) => {
    const { salonga } = await facts(page);
    const { missing: known, taken } = await stubRecord(page, salonga.id);
    const writes = [];
    await captureWrites(page, new RegExp(`/api/monitoring/students/${salonga.id}/subjects$`), "POST", { message: "Spec: row added." }, writes);
    const panel = await openPanel(page, "Salonga, Bea");
    await panel.getByRole("button", { name: "Add other subject" }).click();
    const form = panel.getByRole("form", { name: "Add other subject" });
    await form.getByLabel("Subject code").fill(known.code.toLowerCase());
    await expect(form.getByLabel("Title")).toHaveValue(known.title);
    await expect(form.getByLabel("Title")).toHaveAttribute("readonly", "");
    await expect(form.getByLabel("Units")).toHaveValue(String(known.units));
    await expect(form.getByLabel("Units")).toHaveAttribute("readonly", "");
    await expect(form).toContainText("is in this program's curriculum");
    await form.getByRole("button", { name: "Add row" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.course_id).toBe(known.course_id);
    expect(writes[0].body).not.toHaveProperty("title");
    expect(writes[0].body).not.toHaveProperty("units");
    // a code that already has a row on this record is refused here (use Edit); a code the curriculum lacks stays free text
    await panel.getByRole("button", { name: "Add other subject" }).click();
    await form.getByLabel("Subject code").fill(taken.code);
    await expect(form).toContainText("already on this record");
    await expect(form.getByRole("button", { name: "Add row" })).toBeDisabled();
    await form.getByLabel("Subject code").fill("ZZZ 999");
    await expect(form.getByLabel("Title")).toBeEditable();
    await expect(form.getByLabel("Units")).toBeEditable();
  });
});
