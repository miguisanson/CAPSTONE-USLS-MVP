// Packet conD (consistency sweep IM24, findings 8, 9, 12 and the student part of 14; I-128).
// Pins that student pages of the same kind look and read alike:
//   8   the student Policy Assistant has the same chat-plus-rail layout as the Dean's, with "How this works";
//   9   the request pages say "Not submitted" (never "No request" / "Not Submitted"), the single-step ones share one form card,
//       every submit button reads "Submit <name>" / "Resubmit <name>", the busy text is "Submitting…", the Request Center
//       shows a lock reason in full;
//   12  "Adviser and panel" is one card with one layout on Research Progress and Defense Schedule, names wrap;
//   14  a load failure on a student page is the library danger notice with a "Try again" button.
//
// Order-independent and read-only (the specs share one database, see e2e/README.md): every state is the REAL portal
// context plus the state under test (page.route), and every write is answered by the browser.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const STUDENT = "student@usls.edu.ph";
const DEAN = "dean@usls.edu.ph";

/** A signed-in browser context. `mutate(data)` edits the real portal context; `failContext` answers the first N context requests with an error. */
async function ctxFor(browser, email, { mutate, failContext = 0, width = 1366, height = 768, slowWrites = null } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width, height } });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
  const stats = { contextCalls: 0, writes: [] };
  await context.route("**/api/student-portal/context", async (route) => {
    stats.contextCalls += 1;
    if (stats.contextCalls <= failContext) return route.fulfill({ status: 500, json: { error: "Spec: the server is down." } });
    try {
      const response = await route.fetch();
      const data = await response.json();
      mutate?.(data);
      await route.fulfill({ response, json: data });
    } catch (error) {
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    }
  });
  await context.route("**/api/student-portal/requests/*", async (route) => {
    stats.writes.push(route.request().url());
    if (slowWrites) await slowWrites;
    await route.fulfill({ json: { message: "Spec: request saved." } });
  });
  const page = await context.newPage();
  const close = context.close.bind(context);
  context.close = async () => {
    for (const open of context.pages()) await open.waitForLoadState("networkidle").catch(() => {});
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await close();
  };
  return { context, page, stats };
}

// ---- states injected on top of the real response ----------------------------------------------------------------

const SEM = (label, extra = {}) => ({ label, start_date: "2027-01-10", end_date: "2027-05-10", state: "Upcoming", filing_status: "Pass", filing_detail: "The selected semester begins 2027-01-10.", ...extra });
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
  o.loa_semester_options = [SEM("AY 2026-2027 2nd Semester"), SEM("AY 2027-2028 1st Semester", { start_date: "2027-08-01", end_date: "2027-11-29" })];
  o.can_file = { extension: { allowed: false, reason: "" }, loa: { allowed: true, reason: "" }, readmission: { allowed: false, reason: "Readmission is for students on an approved leave of absence." } };
  data.loa_allowed_reasons = ["Medical / health", "Family emergency"];
  data.workflow_messages = [];
}
const ENROLLED = (id, code) => ({
  id, course_code: code, course_title: `Spec ${code}`, term_label: "AY 2026-2027 1st Semester", status: "Enrolled", withdrawal_eligible: true,
  withdrawal_window: { eligible: true, deadline: "2026-11-20", status: "Withdrawal window open", term_start_date: "2026-11-07", fee_consequence: "Spec fee.", rule_source: "Spec Handbook p. 49", policy: "Spec policy." },
});
const STAGES = [
  { name: "Title Defense", gate: "Form 1 - Title Defense", complete: false, status: "Pending" },
  { name: "Proposal Defense", gate: "Form 4 - Proposal Defense Readiness", complete: false, status: "Locked" },
  { name: "Final Defense", gate: "Final Defense", complete: false, status: "Locked" },
  { name: "Completion", gate: "Completion Evidence", complete: false, status: "Locked" },
];
const LONG_PANEL = [
  { id: 1, faculty_name: "Dr. Maria Concepcion Villanueva-Santos de la Cruz", panel_role: "Panel Chair", specialization: "Spec specialization: qualitative research methods in higher education" },
  { id: 2, faculty_name: "Dr. Patricia Anne Gonzales-Hernandez", panel_role: "Panelist", specialization: "Spec specialization: educational leadership and policy studies" },
  { id: 3, faculty_name: "Dr. Marlon Gerardo Bartolome Reyes", panel_role: "Panelist", specialization: "Spec specialization: measurement and evaluation" },
  { id: 4, faculty_name: "Dr. Jose Rafael Dimagiba", panel_role: "Adviser", specialization: "Spec specialization: guidance and counseling" },
];
function researchBase(data) {
  data.research_case = { ...(data.research_case || {}), id: 1, title: "Spec Saved Title", status: "Pending", adviser_name: "Dr. Spec Adviser" };
  data.panel = LONG_PANEL;
  data.schedules = [];
  data.defense_follow_up = null;
  data.research_progress = {
    gate: "Form 1 - Title Defense", stage: "Title Defense", stage_index: 0, status: "Pending", stages: STAGES,
    milestone: { value: "Form 1 - Title Defense", label: "Title Defense Readiness", short_label: "Form 1", description: "Spec milestone.", student_uploads_ready: false, student_missing_count: 0, overall_complete: false, requirements: [] },
  };
}

/** One entry per request page: the path, how to put the student in the "nothing filed yet" state, and what the page's form is called. */
const PAGES = {
  loa: { path: "/student/requests/leave-of-absence", mutate: (d) => leaveBase(d), region: "Ask for a leave of absence", submit: "Submit leave request" },
  readmission: {
    path: "/student/requests/readmission",
    mutate: (d) => {
      leaveBase(d);
      d.leave_overview.can_file.readmission = { allowed: true, reason: "" };
      d.leave_overview.return_semester_options = ["AY 2026-2027 2nd Semester", "AY 2027-2028 1st Semester"];
      d.semester_options = ["AY 2025-2026 1st Semester", "AY 2026-2027 1st Semester"];
      d.readmission_requirements = ["Structured return intention completed"];
    },
    region: "Ask to come back",
    submit: "Submit readmission request",
  },
  awol: {
    path: "/student/requests/awol-return",
    mutate: (d) => {
      d.student.standing = "AWOL";
      d.student.enrollment_tag = "AWOL";
      d.awol_case = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), awol: [] };
      d.upcoming_semesters = ["AY 2026-2027 2nd Semester"];
      d.semester_options = ["AY 2026-2027 1st Semester"];
      d.workflow_messages = [];
    },
    region: "Tell us you are coming back",
    submit: "Submit return declaration",
  },
  withdrawal: {
    path: "/student/requests/withdrawal",
    mutate: (d) => {
      d.withdrawal_application = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.subject_enrollments = [ENROLLED(901, "SPEC-101")];
      d.workflow_messages = [];
    },
    region: "Ask to withdraw from a subject",
    submit: "Submit withdrawal request",
  },
  practicum: {
    path: "/student/practicum",
    mutate: (d) => {
      d.student.program_has_practicum = true;
      d.student.program_code = "MAPSY";
      d.student.program_name = "Master of Arts in Psychology";
      d.practicum_eligibility = { eligible: true, status: "Verified", checklist: [], program_scope: {} };
      d.practicum_record = null;
      d.workflow_messages = [];
    },
  },
  graduation: { path: "/student/graduation", mutate: (d) => { d.graduation_endorsement = null; d.workflow_messages = []; } },
  schedule: {
    path: "/student/defense-schedule",
    mutate: (d) => researchBase(d),
    submit: "Submit schedule request",
  },
};

const main = (page) => page.locator("main");
/** True when the element's whole text is visible: nothing cut off with an ellipsis or clipped sideways. */
const notCut = (locator) => locator.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis");

test.describe("conD: student pages that are alike behave alike", () => {
  // ---------------------------------------------------------------------------------------------- finding 8
  test("Policy Assistant (8): the student page is the Dean's layout: chat on the left, a 'How this works' rail on the right", async ({ browser }) => {
    const student = await ctxFor(browser, STUDENT);
    const dean = await ctxFor(browser, DEAN);
    try {
      const geometry = async (page, path) => {
        await page.goto(path);
        const rail = main(page).getByRole("heading", { level: 2, name: "How this works" });
        await expect(rail, `${path}: the rail`).toBeVisible();
        const log = await page.getByRole("log").boundingBox();
        const railBox = await rail.boundingBox();
        return { log, railBox };
      };
      const s = await geometry(student.page, "/student/assistant");
      const d = await geometry(dean.page, "/dean/assistant");
      expect(s.railBox.x, "the rail sits to the right of the chat").toBeGreaterThan(s.log.x + s.log.width - 1);
      expect(Math.abs(s.log.width - d.log.width), "the chat is as wide as the Dean's").toBeLessThanOrEqual(2);
      expect(Math.abs(s.railBox.x - d.railBox.x), "the rail starts where the Dean's does").toBeLessThanOrEqual(2);
      // the 'private and read-only' sentence is a line in the rail, not a blue notice above the chat
      await expect(main(student.page).getByText("Private and read-only")).toHaveCount(1);
      await expect(main(student.page).getByRole("status").filter({ hasText: "Private and read-only" })).toHaveCount(0);
      await expect(main(student.page).getByRole("listitem").filter({ hasText: "Private and read-only" })).toHaveCount(1);
      await expect(main(student.page).getByRole("listitem").filter({ hasText: "Offline answer" })).toHaveCount(1);
    } finally {
      await student.context.close();
      await dean.context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- finding 9
  test("Request pages (9): the header, the cards and the body say 'Not submitted', never 'No request' or 'Not Submitted'", async ({ browser }) => {
    for (const [name, spec] of Object.entries(PAGES)) {
      const { context, page } = await ctxFor(browser, STUDENT, { mutate: spec.mutate });
      try {
        await page.goto(spec.path);
        await expect(main(page).locator("h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        const text = await main(page).innerText();
        expect(text, `${name}: the empty state is called "Not submitted"`).toContain("Not submitted");
        expect(text, `${name}: no other word for it`).not.toMatch(/\bNo request\b|Not Submitted/);
      } finally {
        await context.close();
      }
    }
    // the Request Center lists every request with the same word
    const { context, page } = await ctxFor(browser, STUDENT, { mutate: (d) => { for (const spec of Object.values(PAGES)) spec.mutate(d); } });
    try {
      await page.goto("/student/requests");
      await expect(main(page).locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const text = await main(page).innerText();
      expect(text).toContain("Not submitted");
      expect(text).not.toMatch(/\bNo request\b|Not Submitted/);
    } finally {
      await context.close();
    }
  });

  test("Request pages (9): Leave of Absence, Readmission, Return from AWOL and Withdrawal share one form card and carry no stage chip", async ({ browser }) => {
    for (const name of ["loa", "readmission", "awol", "withdrawal"]) {
      const spec = PAGES[name];
      const { context, page } = await ctxFor(browser, STUDENT, { mutate: spec.mutate });
      try {
        await page.goto(spec.path);
        const card = main(page).getByRole("region", { name: spec.region });
        await expect(card, `${name}: the form card`).toBeVisible();
        await expect(card.getByRole("heading", { level: 3, name: spec.region }), `${name}: its title`).toBeVisible();
        await expect(card.getByRole("button", { name: spec.submit, exact: true }), `${name}: Submit is inside the card`).toBeVisible();
        for (const chip of ["Current stage", "Needs revision", "Pending review"]) {
          await expect(main(page).getByText(chip, { exact: true }), `${name}: no numbered-stage chip "${chip}"`).toHaveCount(0);
        }
      } finally {
        await context.close();
      }
    }
  });

  test("Request pages (9): every submit button reads 'Submit <request>' or 'Resubmit <request>'", async ({ browser }) => {
    const states = [
      ["loa", PAGES.loa.mutate, "Submit leave request"],
      ["loa (more time)", (d) => { leaveBase(d); d.leave_overview.cases = [LOA_CASE]; d.leave_overview.can_file = { extension: { allowed: true, reason: "", parent_case_id: 11, remaining_semesters: 1 }, loa: { allowed: false, reason: "" }, readmission: { allowed: false, reason: "" } }; }, "Submit leave extension request"],
      ["loa (returned)", (d) => { leaveBase(d); d.leave_overview.cases = [{ ...LOA_CASE, id: 12, status: "Returned", status_label: "Returned to student", status_tone: "warn", owner: "Student", editable: true, dean_remarks: "Spec: add the certificate.", period: { ...PERIOD, start_label: "AY 2026-2027 2nd Semester", end_label: "AY 2026-2027 2nd Semester" } }]; d.leave_overview.can_file.loa = { allowed: false, reason: "" }; }, "Resubmit leave request"],
      ["readmission", PAGES.readmission.mutate, "Submit readmission request"],
      ["awol", PAGES.awol.mutate, "Submit return declaration"],
      ["withdrawal", PAGES.withdrawal.mutate, "Submit withdrawal request"],
      ["withdrawal (returned)", (d) => {
        d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
        d.subject_enrollments = [ENROLLED(901, "SPEC-101")];
        d.workflow_messages = [];
        d.withdrawal_application = { id: 31, status: "Returned", dean_decision: null, reason: "Spec reason.", subject_enrollment_id: 901, created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00", subject: { course_code: "SPEC-101", course_title: "Spec SPEC-101", term_label: "AY 2026-2027 1st Semester" }, withdrawal_window: { deadline: "2026-11-20", status: "Open" }, attachments: [] };
      }, "Resubmit withdrawal request"],
      ["schedule", PAGES.schedule.mutate, "Submit schedule request"],
    ];
    const paths = { loa: PAGES.loa.path, readmission: PAGES.readmission.path, awol: PAGES.awol.path, withdrawal: PAGES.withdrawal.path, schedule: PAGES.schedule.path };
    for (const [name, mutate, label] of states) {
      const { context, page } = await ctxFor(browser, STUDENT, { mutate });
      try {
        await page.goto(paths[name.split(" ")[0]]);
        const submit = main(page).locator('button[type="submit"]').first();
        await expect(submit, `${name}: the submit button`).toBeVisible();
        await expect(submit, `${name}: its label`).toHaveText(label);
        expect(label, `${name}: pattern`).toMatch(/^(Submit|Resubmit) [a-z]/);
      } finally {
        await context.close();
      }
    }
  });

  test("Request pages (9): the busy text is 'Submitting…' with the ellipsis character on every form", async ({ browser }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    for (const name of ["awol", "withdrawal"]) {
      const spec = PAGES[name];
      const { context, page } = await ctxFor(browser, STUDENT, { mutate: spec.mutate, slowWrites: gate });
      try {
        await page.goto(spec.path);
        if (name === "awol") {
          await page.getByLabel(/Intended return semester/).selectOption({ index: 1 });
          await page.getByLabel(/Written intention to resume enrollment/).fill("Spec: I will return.");
          await page.getByLabel(/Reason for returning and readiness/).fill("Spec: ready.");
        } else {
          await page.getByLabel(/Reason for withdrawing from this subject/).fill("Spec: schedule clash.");
        }
        const submit = main(page).locator('button[type="submit"]').first();
        await submit.click();
        await expect(submit, `${name}: busy text`).toHaveText("Submitting…");
        release();
      } finally {
        release();
        await context.close();
      }
    }
  });

  test("Request Center (9): a lock reason is shown in full, wrapped, not cut with an ellipsis", async ({ browser }) => {
    const { context, page } = await ctxFor(browser, STUDENT, { mutate: (d) => { d.student.program_has_practicum = false; leaveBase(d); d.student.standing = "Active"; d.student.enrollment_tag = null; d.student.current_stage = "Coursework"; } });
    try {
      await page.goto("/student/requests");
      const reasons = [
        "Practicum is available only to Psychology and Master of Science in Guidance and Counseling (MSGC) students.",
        "Available only while your student record is marked AWOL.",
      ];
      for (const reason of reasons) {
        const line = main(page).getByText(reason, { exact: true });
        await expect(line, reason).toBeVisible();
        expect(await notCut(line), `"${reason}" is not cut`).toBe(true);
      }
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- finding 12
  test("Adviser and panel (12): one card, one layout on Research Progress and Defense Schedule; names wrap", async ({ browser }) => {
    const seen = {};
    for (const [name, path] of [["research", "/student/research"], ["schedule", "/student/defense-schedule"]]) {
      const { context, page } = await ctxFor(browser, STUDENT, { mutate: researchBase });
      try {
        await page.goto(path);
        const title = main(page).getByRole("heading", { level: 2, name: "Adviser and panel", exact: true });
        await expect(title, `${name}: the card`).toBeVisible();
        const card = title.locator("xpath=ancestor::div[contains(concat(' ',normalize-space(@class),' '),' card ')][1]");
        const box = await card.boundingBox();
        const names = card.getByText(/^Dr\. (Maria|Patricia|Marlon|Jose)/);
        await expect(names, `${name}: four people`).toHaveCount(4);
        for (const person of await names.all()) expect(await notCut(person), `${name}: "${await person.innerText()}" is not cut`).toBe(true);
        seen[name] = { box, hasSpecialization: await card.getByText("Spec specialization", { exact: false }).count(), cols: await card.locator("li").evaluateAll((items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().left))).size) };
      } finally {
        await context.close();
      }
    }
    expect(Math.abs(seen.research.box.width - seen.schedule.box.width), "the card is as wide on both pages").toBeLessThanOrEqual(2);
    expect(Math.abs(seen.research.box.x - seen.schedule.box.x), "the card starts at the same place").toBeLessThanOrEqual(2);
    expect(seen.research.cols, "the people sit in the same number of columns").toBe(seen.schedule.cols);
    expect(seen.research.hasSpecialization, "Research Progress keeps the specialization line").toBeGreaterThan(0);
    expect(seen.schedule.hasSpecialization, "Defense Schedule has no specialization line").toBe(0);
  });

  // ---------------------------------------------------------------------------------------------- finding 14
  test("Load failures (14): a student page that cannot load shows the danger notice with a 'Try again' button", async ({ browser }) => {
    const failing = async (page, title, reload) => {
      const notice = main(page).getByRole("alert").filter({ hasText: title });
      await expect(notice, title).toBeVisible();
      await expect(notice.getByRole("button", { name: "Try again" }), `${title}: Try again`).toBeVisible();
      return notice;
    };
    // the whole portal
    {
      const { context, page, stats } = await ctxFor(browser, STUDENT, { failContext: 1 });
      try {
        await page.goto("/student/requests");
        const notice = await failing(page, "Could not load your student portal");
        await notice.getByRole("button", { name: "Try again" }).click();
        await expect(main(page).getByRole("heading", { level: 1, name: "Request Center" })).toBeVisible();
        expect(stats.contextCalls, "Try again asks for the portal again").toBeGreaterThanOrEqual(2);
      } finally {
        await context.close();
      }
    }
    // adviser tracker and calendar
    for (const [path, api, title] of [["/student/adviser", "**/api/student-portal/adviser", "Could not load your adviser"], ["/student/calendar", "**/api/student-portal/research-calendar", "Could not load your calendar"]]) {
      const { context, page } = await ctxFor(browser, STUDENT);
      try {
        await context.route(api, (route) => route.fulfill({ status: 500, json: { error: "Spec: the server is down." } }));
        await page.goto(path);
        await failing(page, title);
      } finally {
        await context.close();
      }
    }
    // the leave pages without their leave information
    for (const path of [PAGES.loa.path, PAGES.readmission.path]) {
      const { context, page } = await ctxFor(browser, STUDENT, { mutate: (d) => { d.leave_overview = null; } });
      try {
        await page.goto(path);
        await failing(page, "Could not load your leave information");
      } finally {
        await context.close();
      }
    }
  });
});
