// Packet P4.1 (Phase 5 design system, student stream): pins what the shared student-portal parts DO, so moving
// pages/student/{shared,Panels,ProcessCaseCard,LeaveCaseCards,requestMeta}.jsx onto the component library (InlineNotice,
// StatusChip, HistoryPanel, Stepper, StatCard, Fact) cannot change it. Written against the old code; it passes on both.
//
// Through the real UI, as demo students, on the real seeded data. Where a state is not in the seed (a returned leave,
// a readmission with a checklist, a process case with messages, a booked defense, a missing document...), the browser
// answers /api/student-portal/context with the REAL response plus that state (page.route), so nothing is written to the
// database and every value is fixed. Pages covered:
//   /student                           the action-first home (IM19): header, key numbers, lifecycle, action rows, the one-line links
//                                      and the empty states
//   /student/progress                  My Academic Status (stage list), Workflow Status; a broken page lands in the section boundary
//   /student/documents                 Administrative Documents (upload / view buttons), Activity History
//   /student/activity                  Activity History (logs)
//   /student/defense-schedule          Schedule requests
//   /student/requests/leave-of-absence the leave case card: chip, waiting line, why it was sent back, facts, reason,
//                                      timeline, withdraw, stage history, earlier requests (+ their messages)
//   /student/requests/readmission      the readmission card: checklist, linked leave, intent
//   /student/requests/awol-return      the process case card (real seed, then with a returned case + earlier case)
//   /student/requests/withdrawal       the process case card for a withdrawal, the numbered stage card, the discussion panel
//   /student/graduation                the numbered stage cards, the PDF upload field, the saved-files list
//   /student/enrollment                the leave / AWOL banner with its link
// At 390 px every page must not scroll sideways. Demo students used: Therese Lacson (readmission.therese), Maya Torres
// (awol.maya), Carlo (graduation.carlo): no other spec uses them. Nothing is written.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = join(SCREENS_DIR, "..", "p41-student-parts");
const THERESE = "readmission.therese@usls.edu.ph";
const MAYA = "awol.maya@usls.edu.ph";
const CARLO = "graduation.carlo@usls.edu.ph";

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** A page of a demo student, signed in through the API (their own cookie jar). `mutate(data)` edits the portal context. */
async function studentPage(browser, email, mutate) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
  if (mutate) {
    await context.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      mutate(data);
      await route.fulfill({ response, json: data });
    });
  }
  return { context, page: await context.newPage() };
}

/** Run `body(page)` at 1366, screenshot, then at 390: no sideways scroll, screenshot. */
async function runPage(browser, { email, mutate, path, shot }, body) {
  const { context, page } = await studentPage(browser, email, mutate);
  try {
    await page.goto(path);
    await body(page);
    await page.screenshot({ path: join(SHOTS, `${shot}-1366.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect(await noOverflow(page), `${shot} at 390 px: no sideways scroll`).toBe(true);
    await page.screenshot({ path: join(SHOTS, `${shot}-390.png`), fullPage: true });
  } finally {
    await context.close();
  }
}

/** The card (article) whose h3 is `name`. */
const article = (page, name) => page.locator("article").filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
/** A panel: the card around an h2. */
const panel = (page, title) =>
  page.getByRole("heading", { level: 2, name: title, exact: true }).locator("xpath=ancestor::div[contains(concat(' ',normalize-space(@class),' '),' card ')][1]");
/** One `label: value` fact of a card (dl > div > dt + dd). */
const fact = (scope, label) =>
  scope.locator("dl > div").filter({ has: scope.page().locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }) });
/** The key number (StatCard) with a label, on the action-first home. */
const stat = (page, label) =>
  page.locator("main").locator('[data-slot="label"]', { hasText: new RegExp(`^${label}$`, "i") }).locator("xpath=..");
/** A section of the home, by its heading. */
const sectionOf = (page, name) => page.locator("main").locator("section", { has: page.getByRole("heading", { name, exact: true }) });
/** Text A appears above text B on the page. */
async function above(page, a, b) {
  const ya = (await page.getByText(a, { exact: true }).first().boundingBox()).y;
  const yb = (await page.getByText(b, { exact: true }).first().boundingBox()).y;
  expect(ya, `"${a}" above "${b}"`).toBeLessThan(yb);
}

// ---- states injected on top of the real response ---------------------------------------------------------------

const PERIOD = { start_date: "2026-08-01", start_label: "AY 2026-2027 1st Semester", end_date: "2026-11-29", end_label: "AY 2026-2027 1st Semester", semesters: 1, text: "AY 2026-2027 1st Semester" };

function leaveScenario(data) {
  const base = data.leave_overview.cases[0];
  const returnedLoa = {
    ...base, id: 3, kind: "LOA", kind_label: "Leave of Absence", status: "Returned", status_label: "Returned to student", status_tone: "warn",
    owner: "Student", editable: false, days_until_end: 20, overdue_days: 0, closed_reason: null,
    dean_remarks: "Dean: add the clinic certificate.",
    submitted_at: "2026-08-18T09:00:00", forwarded_at: "2026-08-20T09:00:00", decided_at: null, started_at: null, closed_at: null,
    period: PERIOD, reason_category: "Medical / health", reason_text: "Spec reason text.", linked_case: null, checklist: [],
    messages: [
      { id: 1001, action_type: "return", sender_role: "Graduate School Staff", sender_name: "Staff Anna", recipient_role: "Student", comment: "The certificate is missing.", created_at: "2026-09-01T09:00:00", status: "Open" },
      { id: 1002, action_type: "reply", sender_role: "Academic Coordinator", sender_name: "Coordinator Lee", recipient_role: "Student", comment: "We still wait for your certificate.", created_at: "2026-09-02T09:00:00", status: "Open" },
    ],
    history: [
      { id: 1, result: "Request sent back", created_at: "2026-09-01T09:00:00", previous_status: "Staff Review", new_status: "Returned", notes: "Missing certificate" },
      { id: 2, result: "Request received", created_at: "2026-08-18T09:00:00", previous_status: null, new_status: "Submitted", notes: null },
    ],
    timeline: [{ label: "Request submitted", state: "complete" }, { label: "Staff review", state: "returned" }, { label: "Dean decision", state: "upcoming" }, { label: "Leave begins", state: "upcoming" }],
  };
  const readmission = {
    ...base, id: 4, kind: "READMISSION", kind_label: "Readmission", slug: "readmission", status: "Staff Review", status_label: "In staff review", status_tone: "info",
    owner: "Graduate School Staff", editable: false, days_until_end: null, overdue_days: 0, closed_reason: null, dean_remarks: null,
    target_term: "AY 2026-2027 2nd Semester", return_intent: "Spec: I am ready to return.",
    linked_case: { id: 3, kind_label: "Leave of Absence", period_text: "AY 2026-2027 1st Semester", status_label: "Returned to student" },
    checklist: [
      { item: "Structured return intention completed", checked: true, confirmed: true },
      { item: "Updated study plan confirmed", checked: false, confirmed: false },
    ],
    period: { ...PERIOD, text: "" }, reason_category: null, reason_text: null, messages: [], history: [],
    submitted_at: "2026-10-01T09:00:00", forwarded_at: null, decided_at: null, started_at: null, closed_at: null,
    timeline: [{ label: "Request submitted", state: "complete" }, { label: "Staff review", state: "current" }, { label: "Dean decision", state: "upcoming" }, { label: "Back in the program", state: "upcoming" }],
  };
  const denied = {
    ...base, id: 2, kind: "LOA", kind_label: "Leave of Absence", status: "Denied", status_label: "Not approved", status_tone: "bad", owner: null, editable: false,
    days_until_end: null, overdue_days: 0, closed_reason: "The Dean did not approve this leave.", dean_remarks: null,
    submitted_at: "2025-11-20T09:00:00", forwarded_at: null, decided_at: null, started_at: null, closed_at: null,
    period: { ...PERIOD, text: "AY 2025-2026 1st Semester" }, reason_category: null, reason_text: null, linked_case: null, checklist: [],
    messages: [{ id: 1101, action_type: "decision", sender_role: "Dean", sender_name: "Dean Cruz", recipient_role: "Student", comment: "Not approved this term.", created_at: "2025-12-01T09:00:00" }],
    history: [],
    timeline: [{ label: "Request submitted", state: "complete" }, { label: "Dean decision", state: "denied" }],
  };
  data.leave_overview.cases = [returnedLoa, readmission, denied];
}

const BANNER = { tone: "warn", title: "Spec leave banner", text: "Spec banner text for the student." };

function overviewScenario(data) {
  leaveScenario(data);
  data.leave_overview.banner = BANNER;
  data.logs = [
    { id: 1, result: "Leave of absence returned", actor_role: "Graduate School Staff", next_owner: "Student", created_at: "2026-09-01T09:00:00", notes: "Add the clinic certificate." },
    { id: 2, result: "Request received", actor_role: "Student", next_owner: null, created_at: "2026-08-18T09:00:00", notes: null },
  ];
  data.schedules = [
    {
      id: 901, defense_type: "Title Defense", preferred_date: "2026-12-04", status: "Scheduled", display_status: "Scheduled", is_active: true,
      start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Conference Room B",
      panelists: [{ faculty_id: 1, name: "Dr. Ana Reyes", role: "Panel Chair" }, { faculty_id: 2, name: "Dr. Ben Cruz", role: "Content Specialist" }],
      ics_url: "/api/defense-schedules/901/event.ics", attention: ["Bring two printed copies."],
    },
    {
      id: 902, defense_type: "Proposal Defense", preferred_date: "2026-09-01", status: "Deferred", display_status: "Deferred", is_active: false,
      start_time: null, end_time: null, mode: null, venue: null, panelists: [], change_reason: "Panel not complete", attention: [],
    },
  ];
  data.recommendations = [
    { recommendation: "Spec step one", owner: "Student" },
    { recommendation: "Spec step two", owner: "Graduate School Staff" },
    { recommendation: "Spec step three", owner: "Dean" },
    { recommendation: "Spec step four hidden", owner: "Registrar" },
  ];
}

function processScenario(data) {
  const awol = data.standalone_cases.awol[0];
  const rows = (awol.summary_rows || []).map((row) => (row.label === "Reason for return" ? { ...row, value: "Spec: because I am ready." } : row));
  rows.push({ label: "Empty note", value: "None" }, { label: "Unrecorded note", value: "Not recorded" });
  const current = {
    ...awol, status: "Returned for Revision", status_label: "Returned for revision", status_tone: "warn", owner: "Student",
    card_lines: ["Return sent back", "Please explain your plan"], summary_rows: rows,
    messages: [{ id: 2001, action_type: "return", sender_role: "Dean", sender_name: "Dean Cruz", recipient_role: "Student", comment: "Explain your plan to return.", created_at: "2026-10-02T09:00:00" }],
    events: [
      { id: 11, action: "Return sent back", created_at: "2026-10-02T09:00:00", from_status: "Return Filed", to_status: "Returned for Revision", comment: "Explain your plan.\nSecond line." },
      { id: 10, action: "Return filed", created_at: "2026-10-01T09:00:00", from_status: "AWOL Declared", to_status: "Return Filed", comment: null },
      { id: 9, action: null, created_at: "2026-09-30T09:00:00", from_status: "AWOL", to_status: "AWOL", comment: null },
    ],
  };
  const earlier = {
    ...awol, id: "awol-2", status: "Not Accepted", status_label: "Not approved", status_tone: "bad", owner: null,
    card_lines: ["Earlier return"], events: [],
    messages: [{ id: 2101, action_type: "decision", sender_role: "Dean", sender_name: "Dean Cruz", recipient_role: "Student", comment: "Not accepted last time.", created_at: "2026-06-01T09:00:00" }],
    timeline: [{ label: "AWOL flagged", state: "complete" }, { label: "Return filed", state: "complete" }, { label: "Dean decision", state: "denied" }],
  };
  data.standalone_cases.awol = [current, earlier];
  data.standalone_cases.withdrawal = [
    {
      ...awol, id: "withdrawal-7", kind: "WITHDRAWAL", kind_label: "Subject Withdrawal", slug: "withdrawal", status: "Submitted", status_label: "Submitted", status_tone: "info", owner: "Dean",
      card_lines: ["Withdraw MAED-COG1", "Filed Oct 1"], events: [], messages: [],
      summary_rows: [{ label: "Type", value: "Subject Withdrawal" }, { label: "Subject", value: "MAED-COG1" }, { date: true, label: "Filed on", value: "2026-10-01" }, { full: true, label: "Reason given", value: "Spec: schedule clash." }],
      timeline: [{ label: "Request submitted", state: "complete" }, { label: "Dean decision", state: "current" }],
    },
  ];
  data.workflow_messages = [
    { id: 3001, transaction_slug: "withdrawal", action_type: "return", status: "Open", recipient_role: "Student", sender_role: "Graduate School Staff", sender_name: "Staff Anna", comment: "Choose the right subject first.", created_at: "2026-10-03T09:00:00", requires_document_resubmission: true, is_unread: false },
  ];
}

test.describe("P4.1 shared student parts", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test("Overview (Therese): the action-first home keeps the header, key numbers, lifecycle, action rows and one-line links (IM19)", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: overviewScenario, path: "/student", shot: "overview" }, async (page) => {
      const m = page.locator("main");
      // what the old hero showed, as the new header: name, program, student number, AY entry, course year, progress chip
      await expect(m.locator("h1")).toHaveText("Welcome, Therese");
      const header = m.locator("h1").locator("xpath=ancestor::*[.//p][1]");
      await expect(header).toContainText("Master of Arts in Education");
      await expect(header).toContainText("GS-2026-READ-01");
      await expect(header).toContainText(/AY entry 2026-2027/);
      await expect(header).toContainText(/Year 1/);
      await expect(header).toContainText("On Track");
      // the key numbers: label and value together (Coursework and Research; Stage moved into the lifecycle card)
      await expect(stat(page, "Coursework")).toContainText("16.7%");
      await expect(stat(page, "Research")).toContainText("Not started");
      await expect(sectionOf(page, "Your lifecycle")).toContainText("You are at: LOA");

      // the leave notice (tone warn) is now an action row, not a banner region
      const mine = sectionOf(page, "Needs your action");
      await expect(mine).toContainText("Spec leave banner");
      await expect(mine).toContainText("Spec banner text for the student.");
      // Next Step: the first three recommendations become action rows, each with its owner
      await expect(mine).toContainText("Spec step one");
      await expect(mine).toContainText("Owner: Student");
      await expect(mine).toContainText("Spec step three");
      await expect(mine).toContainText("Owner: Dean");
      await expect(mine).not.toContainText("Spec step four hidden");

      // Recent activity: title, who and who is next, date
      const recent = sectionOf(page, "Recent activity");
      await expect(recent).toContainText("Leave of absence returned");
      await expect(recent).toContainText("Graduate School Staff - next: Student");
      await expect(recent).toContainText("Request received");
      await expect(recent).toContainText("Student - next: Pending");
      await expect(recent.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/student/activity");

      // the blocks that left the home: one line each and a link to the page that holds the full content
      const elsewhere = sectionOf(page, "Elsewhere in your portal");
      const line = (label) => elsewhere.locator("li").filter({ has: page.getByRole("link", { name: label, exact: true }) });
      await expect(elsewhere.getByRole("link", { name: "Defense Schedule", exact: true })).toHaveAttribute("href", "/student/defense-schedule");
      await expect(line("Defense Schedule")).toContainText("Your Title Defense is booked for Fri, Dec 4, 2026.");
      await expect(elsewhere.getByRole("link", { name: "Request Center", exact: true })).toHaveAttribute("href", "/student/requests");
      await expect(line("Request Center")).toContainText("Graduation: Needs verification");
      await expect(elsewhere.getByRole("link", { name: "Leave of Absence", exact: true })).toHaveAttribute("href", "/student/requests/leave-of-absence");
      await expect(line("Leave of Absence")).toContainText("Leave of Absence: On leave · Readmission: In staff review");
      await expect(elsewhere.getByRole("link", { name: "Research Adviser", exact: true })).toHaveAttribute("href", "/student/adviser");
      await expect(line("Research Adviser")).toContainText("Dr. Liwayway Bautista");
    });
  });

  test("My Progress (Therese): the stage list, coursework and research, and the workflow rows", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: overviewScenario, path: "/student/progress", shot: "progress-therese" }, async (page) => {
      // My Academic Status: the leave notice, the stage names in order, coursework and research
      const status = panel(page, "My Academic Status");
      await expect(status).toContainText("Your current stage, requirements, and next step");
      await expect(status).toContainText("You are on Leave of Absence, so you cannot enroll in subjects.");
      const text = await status.innerText();
      const order = ["Admission", "Coursework", "Comprehensive Exam", "Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense"];
      let at = -1;
      for (const stage of order) {
        const found = text.indexOf(stage, at + 1);
        expect(found, `stage "${stage}" after the previous one`).toBeGreaterThan(at);
        at = found;
      }
      await expect(status).toContainText("Coursework completion");
      await expect(status).toContainText("16.7%");
      await expect(status).toContainText("3 completed, 0 current, 15 missing.");
      await expect(status).toContainText("No research case opened yet");
      await expect(status).toContainText("Adviser: Dr. Liwayway Bautista");
      await expect(status.getByText("Research not started", { exact: true })).toBeVisible();

      // Workflow Status: one row per request with chip and detail
      const workflow = panel(page, "Workflow Status");
      await expect(workflow).toContainText("Administrative and completion requests currently visible to you");
      for (const [label, chip, detail] of [
        ["Withdrawal", "No request", "No withdrawal request is active."],
        ["Graduation Endorsement", "Needs verification", "Resolve graduation missing coursework"],
      ]) {
        const row = workflow.getByText(label, { exact: true }).locator("xpath=ancestor::div[.//p][1]");
        await expect(row, label).toContainText(chip);
        await expect(row, label).toContainText(detail);
      }
    });
  });

  test("Activity page (Therese): the logs, their toggle and their entries", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: overviewScenario, path: "/student/activity", shot: "activity-therese" }, async (page) => {
      const activity = panel(page, "Activity Log");
      await expect(activity).toContainText("Submissions, decisions, and next owners");
      const toggle = activity.getByRole("button", { name: /View logs/ });
      await expect(toggle).toContainText("2");
      await toggle.click();
      await expect(activity.getByRole("button", { name: /Hide logs/ })).toBeVisible();
      await expect(activity).toContainText("Leave of absence returned");
      await expect(activity).toContainText("Graduate School Staff");
      await expect(activity).toContainText("next: Student");
      await expect(activity).toContainText("Sep 1, 2026");
      await expect(activity).toContainText("Add the clinic certificate.");
      await expect(activity).toContainText("Request received");
      await expect(activity).toContainText("next: Pending");
      await expect(activity).toContainText("Aug 18, 2026");
    });
  });

  test("Defense Schedule page (Therese): a booked and a deferred defense in full", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: overviewScenario, path: "/student/defense-schedule", shot: "defense-therese" }, async (page) => {
      const sched = panel(page, "Schedule requests");
      await expect(sched).toContainText("Title Defense");
      await expect(sched).toContainText(/Fri, Dec 4, 2026/);
      await expect(sched.getByText("Scheduled", { exact: true })).toBeVisible();
      await expect(sched).toContainText("09:00-10:30 (Philippine time) - In person - Conference Room B");
      await expect(sched).toContainText("Dr. Ana Reyes - Panel Chair");
      await expect(sched).toContainText("Dr. Ben Cruz - Content Specialist");
      await expect(sched).toContainText("Bring two printed copies.");
      await expect(sched.getByRole("link", { name: /Add to calendar/ })).toHaveCount(1);
      await expect(sched.getByRole("link", { name: /Add to calendar/ })).toHaveAttribute("href", "/api/defense-schedules/901/event.ics");
      await expect(sched).toContainText("Proposal Defense");
      await expect(sched.getByText("Deferred", { exact: true })).toBeVisible();
      await expect(sched).toContainText("Time not set (Philippine time) - Mode not set - Venue or link not set yet");
      await expect(sched).toContainText("Waiting for the Research Coordinator to set a new date.");
      await expect(sched).toContainText("Panel not complete");
    });
  });

  test("Overview (Maya): the empty states of activity and schedules on the home and on their pages; the AWOL rows", async ({ browser }) => {
    const mutate = (data) => {
      data.logs = [];
      data.schedules = [];
      data.recommendations = [];
    };
    await runPage(browser, { email: MAYA, mutate, path: "/student", shot: "overview-empty" }, async (page) => {
      await expect(page.locator("main h1")).toHaveText("Welcome, Maya");
      await expect(sectionOf(page, "Your lifecycle")).toContainText("You are at: AWOL");
      const recent = sectionOf(page, "Recent activity");
      await expect(recent).toContainText("No activity yet");
      await expect(recent.getByRole("button")).toHaveCount(0);
      await expect(sectionOf(page, "Elsewhere in your portal")).toContainText("No defense is booked yet.");
    });
    await runPage(browser, { email: MAYA, mutate, path: "/student/activity", shot: "activity-empty" }, async (page) => {
      await expect(panel(page, "Activity Log")).toContainText("No activity yet");
      await expect(panel(page, "Activity Log").getByRole("button")).toHaveCount(0);
    });
    await runPage(browser, { email: MAYA, mutate, path: "/student/defense-schedule", shot: "defense-empty" }, async (page) => {
      await expect(panel(page, "Schedule requests")).toContainText("No schedule requests");
    });
    await runPage(browser, { email: MAYA, mutate, path: "/student/progress", shot: "progress-maya" }, async (page) => {
      // the stage list shows where Maya is: the on-path stages are listed, and the AWOL stage is named
      const status = await panel(page, "My Academic Status").innerText();
      for (const stage of ["Admission", "Coursework", "Final Defense", "AWOL"]) expect(status).toContain(stage);
      // the AWOL row of Workflow Status
      const workflow = panel(page, "Workflow Status");
      await expect(workflow).toContainText("AWOL / Return");
      await expect(workflow.getByText("AWOL Declared", { exact: true })).toBeVisible();
      await expect(workflow).toContainText("Awaiting return intent");
    });
  });

  test("Progress page: the same panels; a broken page lands in the section boundary", async ({ browser }) => {
    await runPage(browser, { email: THERESE, path: "/student/progress", shot: "progress" }, async (page) => {
      await expect(panel(page, "My Academic Status")).toContainText("Coursework completion");
      await expect(panel(page, "Workflow Status")).toContainText("Graduation Endorsement");
    });
    await runPage(browser, { email: THERESE, mutate: (data) => { data.course_audit = null; }, path: "/student/progress", shot: "progress-broken" }, async (page) => {
      await expect(page.getByText("This page could not load", { exact: true })).toBeVisible();
      await expect(page.getByText("Please try another section or refresh the portal. The rest of your student portal is still available.")).toBeVisible();
      await expect(page.getByRole("link", { name: /Request Center/ }).first()).toBeVisible(); // the sidebar is still there
    });
  });

  test("Documents: the administrative list with upload and view buttons; the research gates are left out", async ({ browser }) => {
    const mutate = (data) => {
      data.documents_by_gate = {
        "Spec Gate": [
          { id: 9001, display_name: "Signed form", item_name: "Signed form", status: "Missing", status_label: "Missing", files: [], evidence_reference: "" },
          { id: 9002, display_name: null, item_name: "Clearance slip", status: "Complete", status_label: "Verified by staff", files: [{ url: "/api/files/spec.pdf" }], evidence_reference: "" },
          { id: 9003, display_name: "Recommendation letter", item_name: "Recommendation letter", status: "Pending Review", status_label: "Pending Review", files: [], evidence_reference: "" },
        ],
        "Other Gate": [{ id: 9004, display_name: "Birth certificate", item_name: "Birth certificate", status: "Complete", status_label: "Complete", files: [], evidence_reference: "https://example.org/record" }],
        "Form 1 - Title Defense": [{ id: 9005, display_name: "Research hidden item", item_name: "Research hidden item", status: "Missing", status_label: "Missing", files: [] }],
      };
      data.logs = [{ id: 5, result: "Document received", actor_role: "Graduate School Staff", next_owner: "Student", created_at: "2026-09-10T09:00:00", notes: "Thank you." }];
    };
    await runPage(browser, { email: THERESE, mutate, path: "/student/documents", shot: "documents" }, async (page) => {
      const docs = panel(page, "Administrative Documents");
      await expect(docs).toContainText("Admission and general records outside your research submissions");
      await expect(docs).toContainText("Spec Gate");
      await expect(docs).toContainText("Other Gate");
      await expect(docs).not.toContainText("Research hidden item");
      await expect(docs).not.toContainText("Form 1 - Title Defense");
      await expect(docs.getByText("Signed form", { exact: true })).toBeVisible();
      await expect(docs.getByText("Clearance slip", { exact: true })).toBeVisible(); // item_name when there is no display name
      await expect(docs.getByText("Missing", { exact: true })).toBeVisible();
      await expect(docs.getByText("Verified by staff", { exact: true })).toBeVisible();
      await expect(docs.getByText("Pending Review", { exact: true })).toBeVisible();
      // only the missing document can be uploaded; every other one has a view button
      await expect(docs.getByLabel("Upload PDF")).toHaveCount(1);
      await expect(docs.getByRole("button", { name: "View document" })).toHaveCount(3);
      await expect(docs.getByRole("button", { name: "View document" }).nth(0)).toBeEnabled(); // has a file
      await expect(docs.getByRole("button", { name: "View document" }).nth(1)).toBeDisabled(); // nothing recorded
      await expect(docs.getByRole("button", { name: "View document" }).nth(1)).toHaveAttribute("title", "No document reference recorded yet");
      await expect(docs.getByRole("button", { name: "View document" }).nth(2)).toBeEnabled(); // a reference link
    });
    // the Activity page: the same panel with the same logs
    await runPage(browser, { email: THERESE, mutate, path: "/student/activity", shot: "activity" }, async (page) => {
      const activity = panel(page, "Activity Log");
      await activity.getByRole("button", { name: /View logs/ }).click();
      await expect(activity).toContainText("Document received");
      await expect(activity).toContainText("Thank you.");
      await expect(activity).toContainText("next: Student");
    });
  });

  test("Leave of Absence page: a returned request in full, its history, withdraw dialog, earlier requests", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: (data) => { leaveScenario(data); data.leave_overview.banner = { tone: "bad", title: "Spec bad banner", text: "Spec bad text." }; }, path: "/student/requests/leave-of-absence", shot: "leave" }, async (page) => {
      // the banner, tone bad = an alert
      await expect(page.getByRole("alert").filter({ hasText: "Spec bad banner" })).toContainText("Spec bad text.");

      const c = article(page, "Leave of Absence").first();
      await expect(c).toContainText("AY 2026-2027 1st Semester (1 semester)");
      await expect(c.getByText("Returned to student", { exact: true })).toBeVisible();
      await expect(c).toContainText("Waiting for: you. Correct your request and send it again.");
      await expect(c).toContainText("20 days left until the leave ends.");
      await expect(c).toContainText("Why it was sent back");
      await expect(c).toContainText("The certificate is missing.");
      await expect(c).toContainText("Comment from the Dean");
      await expect(c).toContainText("Dean: add the clinic certificate.");
      await expect(c).toContainText("Latest message from Coordinator Lee");
      await expect(c).toContainText("We still wait for your certificate.");

      // the facts: present ones with their values, absent ones not drawn
      await expect(fact(c, "Filed")).toContainText("Aug 18, 2026");
      await expect(fact(c, "Sent to the Dean")).toContainText("Aug 20, 2026");
      await expect(fact(c, "Leave starts")).toContainText("AY 2026-2027 1st Semester, Aug 1, 2026");
      await expect(fact(c, "Leave ends")).toContainText("AY 2026-2027 1st Semester, Nov 29, 2026");
      await expect(c.locator("dt")).toHaveCount(4);
      await expect(c.locator("dt").filter({ hasText: /^(Decision|Leave began|Closed)$/i })).toHaveCount(0);

      await expect(c).toContainText("Your reason");
      await expect(c).toContainText("Medical / health");
      await expect(c).toContainText("Spec reason text.");

      // the timeline
      const steps = c.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
      await expect(steps).toHaveCount(4);
      for (const [i, label] of ["Request submitted", "Staff review", "Dean decision", "Leave begins"].entries()) await expect(steps.nth(i)).toContainText(label);

      // no messages toggle on the current card; stage history with a count
      await expect(c.getByRole("button", { name: /View messages/ })).toHaveCount(0);
      const history = c.getByRole("button", { name: /View stage history/ });
      await expect(history).toContainText("2");
      await history.click();
      await expect(c.getByRole("button", { name: /Hide stage history/ })).toBeVisible();
      await expect(c.getByText("Request sent back", { exact: true })).toBeVisible();
      await expect(c).toContainText(/Staff Review\W*Returned/); // from and to status
      await expect(c).toContainText("Missing certificate");
      await expect(c.getByText("Request received", { exact: true })).toBeVisible();
      await expect(c).toContainText(/Sep 1, 2026/);
      await expect(c).toContainText(/Aug 18, 2026/);
      await above(page, "Request sent back", "Request received"); // the order the server gave is kept

      // withdraw: a confirmation that can be declined
      await expect(c.getByRole("button", { name: "Cancel this leave" })).toHaveCount(0);
      await c.getByRole("button", { name: "Withdraw request" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Withdraw this leave of absence request?");
      await expect(dialog).toContainText("This stops the review. Your record does not change, and you can file a new request later.");
      await dialog.getByRole("button", { name: "Keep my request" }).click();
      await expect(dialog).toHaveCount(0);

      // the earlier (denied) request, collapsed until opened
      const earlier = page.getByRole("button", { name: /Earlier requests/ });
      await expect(earlier).toContainText("1");
      await expect(article(page, "Leave of Absence")).toHaveCount(1);
      await earlier.click();
      await expect(article(page, "Leave of Absence")).toHaveCount(2);
      const old = article(page, "Leave of Absence").nth(1);
      await expect(old).toContainText("AY 2025-2026 1st Semester (1 semester)");
      await expect(old.getByText("Not approved", { exact: true })).toBeVisible();
      await expect(old).toContainText("The Dean did not approve this leave.");
      await expect(old).toContainText("Latest message from Dean Cruz");
      await expect(old).not.toContainText("Waiting for");
      await expect(fact(old, "Filed")).toContainText("Nov 20, 2025");
      const msgs = old.getByRole("button", { name: /View messages/ });
      await expect(msgs).toContainText("1");
      await msgs.click();
      await expect(old.getByText("Not approved this term.").first()).toBeVisible();
      const oldHistory = old.getByRole("button", { name: /View stage history/ });
      await expect(oldHistory).toContainText("0");
      await oldHistory.click();
      await expect(old.getByText("Nothing has happened on this request yet.")).toBeVisible();
    });
  });

  test("Leave of Absence page with nothing to file: the reason note", async ({ browser }) => {
    const mutate = (data) => {
      data.leave_overview.cases = [];
      data.leave_overview.can_file.loa = { allowed: false, reason: "Spec: you cannot ask for leave now." };
      data.leave_overview.can_file.extension = { allowed: false, reason: "" };
      data.leave_overview.banner = { tone: "good", title: "Spec good banner", text: "Spec good text." };
    };
    await runPage(browser, { email: THERESE, mutate, path: "/student/requests/leave-of-absence", shot: "leave-note" }, async (page) => {
      await expect(page.getByRole("status").filter({ hasText: "Spec good banner" })).toContainText("Spec good text.");
      await expect(page.getByText("Spec: you cannot ask for leave now.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Submit leave request|Send request for more time/ })).toHaveCount(0);
    });
  });

  test("Banner tones: each one shows its words, bad as an alert and the rest as a status", async ({ browser }) => {
    for (const tone of ["bad", "warn", "info", "good", "muted"]) {
      const mutate = (data) => { data.leave_overview.banner = { tone, title: `Spec ${tone} title`, text: `Spec ${tone} text` }; };
      const { context, page } = await studentPage(browser, THERESE, mutate);
      try {
        await page.goto("/student/requests/readmission");
        const region = page.getByRole(tone === "bad" ? "alert" : "status").filter({ hasText: `Spec ${tone} title` });
        await expect(region, tone).toContainText(`Spec ${tone} text`);
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: join(SHOTS, `banner-${tone}-1366.png`) });
      } finally {
        await context.close();
      }
    }
  });

  test("Readmission page: the case card with checklist, linked leave and intent", async ({ browser }) => {
    await runPage(browser, { email: THERESE, mutate: leaveScenario, path: "/student/requests/readmission", shot: "readmission" }, async (page) => {
      const c = article(page, "Readmission").first();
      await expect(c).toContainText("Return in AY 2026-2027 2nd Semester");
      await expect(c.getByText("In staff review", { exact: true })).toBeVisible();
      await expect(c).toContainText("Waiting for: Graduate School Staff");
      await expect(fact(c, "Filed")).toContainText("Oct 1, 2026");
      await expect(fact(c, "Return semester")).toContainText("AY 2026-2027 2nd Semester");
      await expect(c.locator("dt").filter({ hasText: /^(Leave starts|Leave ends|Decision|Closed)$/i })).toHaveCount(0);
      await expect(c).toContainText("Leave you are ending:");
      await expect(c).toContainText("Leave of Absence, AY 2026-2027 1st Semester (Returned to student)");
      await expect(c).toContainText("What you told us");
      await expect(c).toContainText("Spec: I am ready to return.");
      await expect(c).toContainText("Return checklist");
      const items = c.locator("li").filter({ hasText: /Structured return intention completed|Updated study plan confirmed/ });
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText("Structured return intention completed");
      await expect(items.nth(0)).toContainText("(you ticked this)");
      await expect(items.nth(0).getByText("Staff confirmed", { exact: true })).toBeVisible();
      await expect(items.nth(1)).toContainText("(not ticked)");
      await expect(c.getByText("Staff confirmed", { exact: true })).toHaveCount(1);
      await expect(c.getByRole("button", { name: "Withdraw request" })).toBeVisible();
      const steps = c.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
      await expect(steps).toHaveCount(4);
      await expect(c.locator('[aria-current="step"]')).toContainText("Staff review");
      const history = c.getByRole("button", { name: /View stage history/ });
      await history.click();
      await expect(c.getByText("Nothing has happened on this request yet.")).toBeVisible();
    });
  });

  test("Readmission page with nothing to file: the reason note", async ({ browser }) => {
    const mutate = (data) => {
      data.leave_overview.cases = [];
      data.leave_overview.can_file.readmission = { allowed: false, reason: "Spec: no leave to end." };
    };
    await runPage(browser, { email: THERESE, mutate, path: "/student/requests/readmission", shot: "readmission-note" }, async (page) => {
      await expect(page.getByText("Spec: no leave to end.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Submit readmission request/ })).toHaveCount(0);
    });
  });

  test("Return from AWOL page (real seed): the process case card", async ({ browser }) => {
    await runPage(browser, { email: MAYA, path: "/student/requests/awol-return", shot: "awol-real" }, async (page) => {
      const c = article(page, "Return from AWOL");
      await expect(c).toBeVisible();
      await expect(c).toContainText("Awaiting return intent");
      await expect(c).toContainText(/No return filed yet · AWOL since \d{4}-\d{2}-\d{2}/);
      await expect(c.getByText("AWOL (flagged by the system)", { exact: true })).toBeVisible();
      await expect(c).toContainText("Waiting for: you.");
      await expect(c).not.toContainText("Correct your request and send it again.");
      for (const [label, value] of [
        ["AWOL effective date", /^AWOL effective date\s*[A-Z][a-z]{2} \d{1,2}, \d{4}$/i],
        ["Detection source", /Recorded AWOL standing/],
        ["Last enrolled semester", /AY 2025-2026 2nd Semester/],
        ["Returning in", /Not chosen yet/],
        ["Policy classification", /Awaiting return intent/],
        ["Years in the program", /Not calculated/],
        ["Residence limits", /Not calculated/],
        ["Dean decision", /Not Submitted/],
      ]) await expect(fact(c, label), label).toHaveText(value);
      await expect(c.locator("dt").filter({ hasText: /^(Type|Reason for return|Dean decided)$/i })).toHaveCount(0);
      await expect(c).toContainText("Student's written intention");
      await expect(c).toContainText("Not filed yet");
      const steps = c.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
      await expect(steps).toHaveCount(4);
      await expect(c.locator('[aria-current="step"]')).toContainText("AWOL flagged");
      await expect(c.getByRole("button", { name: /View messages/ })).toHaveCount(0);
      const history = c.getByRole("button", { name: /View stage history/ });
      await expect(history).toContainText("1");
      await history.click();
      await expect(c.getByText("Student automatically flagged AWOL", { exact: true })).toBeVisible();
      await expect(c).toContainText(/AWOL\W*AWOL Declared/);
      await expect(c).toContainText("The official/imported student standing is AWOL.");
      await expect(c).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?[AP]M/);
    });
  });

  test("Return from AWOL page (a returned case and an earlier one)", async ({ browser }) => {
    await runPage(browser, { email: MAYA, mutate: processScenario, path: "/student/requests/awol-return", shot: "awol" }, async (page) => {
      const c = article(page, "Return from AWOL").first();
      await expect(c).toContainText("Return sent back");
      await expect(c).toContainText("Please explain your plan");
      await expect(c.getByText("Returned for revision", { exact: true })).toBeVisible();
      await expect(c).toContainText("Waiting for: you. Correct your request and send it again.");
      await expect(c).toContainText("Why it was sent back");
      await expect(c).toContainText("Explain your plan to return.");
      // facts keep their order; rows with no real value are dropped; long texts get their own block
      await expect(fact(c, "Detection source")).toContainText("Recorded AWOL standing");
      await expect(c.locator("dt").filter({ hasText: /^(Empty note|Unrecorded note|Type)$/i })).toHaveCount(0);
      await expect(c).toContainText("Reason for return");
      await expect(c).toContainText("Spec: because I am ready.");
      // messages and stage history
      const msgs = c.getByRole("button", { name: /View messages/ });
      await expect(msgs).toContainText("1");
      await msgs.click();
      await expect(c.getByText("Explain your plan to return.").first()).toBeVisible();
      const history = c.getByRole("button", { name: /View stage history/ });
      await expect(history).toContainText("3");
      await history.click();
      await expect(c.getByText("Return sent back", { exact: true }).first()).toBeVisible();
      await expect(c).toContainText(/Return Filed\W*Returned for Revision/);
      await expect(c).toContainText(/AWOL Declared\W*Return Filed/);
      await expect(c).toContainText("Explain your plan.");
      await expect(c).toContainText("Second line.");
      await expect(c.getByText("Return filed", { exact: true })).toBeVisible();
      await expect(c.getByText("Update", { exact: true })).toBeVisible(); // an entry with no action is called Update
      await expect(c).toContainText(/Oct 2, 2026/);
      await above(page, "Return filed", "Update");

      // earlier requests
      const earlier = page.getByRole("button", { name: /Earlier requests/ });
      await expect(earlier).toContainText("1");
      await expect(article(page, "Return from AWOL")).toHaveCount(1);
      await earlier.click();
      const old = article(page, "Return from AWOL").nth(1);
      await expect(old).toContainText("Earlier return");
      await expect(old.getByText("Not approved", { exact: true })).toBeVisible();
      await expect(old).not.toContainText("Waiting for");
      await old.getByRole("button", { name: /View stage history/ }).click();
      await expect(old.getByText("Nothing has happened on this request yet.")).toBeVisible();
    });
  });

  test("Withdrawal page: the process case card, the numbered stage card and the discussion panel", async ({ browser }) => {
    await runPage(browser, { email: MAYA, mutate: processScenario, path: "/student/requests/withdrawal", shot: "withdrawal" }, async (page) => {
      const c = article(page, "Subject Withdrawal");
      await expect(c).toContainText("Withdraw MAED-COG1");
      await expect(c).toContainText("Filed Oct 1");
      await expect(c.getByText("Submitted", { exact: true })).toBeVisible();
      await expect(c).toContainText("Waiting for: Dean");
      await expect(fact(c, "Subject")).toContainText("MAED-COG1");
      await expect(fact(c, "Filed on")).toContainText("Oct 1, 2026");
      await expect(c).toContainText("Reason given");
      await expect(c).toContainText("Spec: schedule clash.");
      const steps = c.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
      await expect(steps).toHaveCount(2);
      await expect(c.getByRole("button", { name: /View messages/ })).toHaveCount(0);
      await c.getByRole("button", { name: /View stage history/ }).click();
      await expect(c.getByText("Nothing has happened on this request yet.")).toBeVisible();

      // the numbered stage card of the form
      const stage = page.locator("section").filter({ has: page.getByRole("heading", { level: 3, name: "Send your withdrawal request", exact: true }) });
      await expect(stage.first()).toContainText("Choose one eligible enrolled subject and state the reason for withdrawing.");
      await expect(stage.first().getByText("Current stage", { exact: true })).toBeVisible();
      await expect(stage.first().getByText("1", { exact: true })).toBeVisible();

      // the discussion panel: a message with a required PDF, and a reply box
      const talk = page.getByRole("region", { name: "Request discussion" });
      await expect(talk).toContainText("Messages and replies are shown chronologically. The newest post is highlighted in green.");
      await expect(talk.getByText("New PDF required", { exact: true })).toBeVisible();
      await expect(talk).toContainText("Step 1 has been reopened. Upload a replacement graduation application PDF before resubmitting.");
      await expect(talk).toContainText("Choose the right subject first.");
      await expect(talk.getByText("Reply to Staff Anna")).toBeVisible();
      const send = talk.getByRole("button", { name: "Send reply" });
      await expect(send).toBeDisabled();
      await talk.getByRole("textbox").fill("I will fix it.");
      await expect(send).toBeEnabled();
    });
  });

  test("Graduation page (Carlo): numbered stage cards, the PDF upload field and the missing-PDF summary", async ({ browser }) => {
    await runPage(browser, { email: CARLO, path: "/student/graduation", shot: "graduation" }, async (page) => {
      const cards = [
        ["Application / Review Window", "Current stage", "What you need to submit now: the review window and signed graduation application / review-window PDF."],
        ["Staff and Coursework Review", "Locked", "This stage opens after the application is submitted."],
        ["Requirements Validation", "Locked", "Coursework, research, practicum, and completion records are checked here."],
        ["Dean Endorsement", "Locked", "Available after eligibility is confirmed and staff prepares the endorsement."],
        ["Endorsement Export", "Locked", "Available after Dean approval."],
        ["Dean Emails List and Waits for Acknowledgement", "Locked", "Available after the endorsed list is exported."],
      ];
      for (const [i, [title, chip, helper]] of cards.entries()) {
        const s = page.locator("section").filter({ has: page.getByRole("heading", { level: 3, name: title, exact: true }) }).last();
        await expect(s, title).toContainText(helper);
        await expect(s.getByText(chip, { exact: true }).first(), title).toBeVisible();
        await expect(s.getByText(String(i + 1), { exact: true }).first(), title).toBeVisible();
      }
      // the PDF field; Submit stays usable and, with no PDF, lists the problem (P82)
      await expect(page.locator(".field-label", { hasText: "Signed graduation application / review-window PDF" })).toBeVisible();
      await expect(page.getByText("Choose PDF file", { exact: true })).toBeVisible();
      await expect(page.getByText("Browse", { exact: true })).toBeVisible();
      await expect(page.getByText("PDF only, up to 25 MB. The file is stored with your request.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Submit graduation application" })).toBeEnabled();
      await page.getByRole("button", { name: "Submit graduation application" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "There is a problem" }).getByRole("link", { name: "Upload your signed graduation application as a PDF." })).toBeVisible();
      // a non-PDF is refused with a message, nothing is sent
      await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
      await expect(page.getByText("Please choose a PDF file.", { exact: true })).toBeVisible();
    });
  });

  test("Graduation page with saved files: names, who and when, view link, unavailable file", async ({ browser }) => {
    const mutate = (data) => {
      data.graduation_endorsement = {
        id: 7001, endorsement_status: "Returned for Clarification", review_window: "AY 2026-2027", registrar_status: "", request_attachment: null,
        attachments: [
          { id: 1, name: "application-v1.pdf", uploaded_by: "Carlo Reyes", uploaded_at: "2026-09-01T09:00:00", stage: "Application", url: "/api/files/1.pdf", file_exists: true },
          { id: 2, name: "lost-copy.pdf", uploaded_by: null, uploaded_at: "2026-09-02T09:00:00", stage: null, url: "/api/files/2.pdf", file_exists: false },
        ],
      };
    };
    await runPage(browser, { email: CARLO, mutate, path: "/student/graduation", shot: "graduation-files" }, async (page) => {
      await expect(page.getByText("Already submitted", { exact: true })).toBeVisible();
      await expect(page.getByText("application-v1.pdf", { exact: true })).toBeVisible();
      await expect(page.getByText(/Uploaded by Carlo Reyes · Sep 1, 2026 · Application/)).toBeVisible();
      await expect(page.getByRole("link", { name: "View file" })).toHaveCount(1);
      await expect(page.getByRole("link", { name: "View file" })).toHaveAttribute("href", "/api/files/1.pdf");
      await expect(page.getByText("lost-copy.pdf", { exact: true })).toBeVisible();
      await expect(page.getByText(/Uploaded by Uploader not recorded · Sep 2, 2026/)).toBeVisible();
      await expect(page.getByText("File unavailable", { exact: true })).toBeVisible();
    });
  });

  test("Enrollment page (Therese on leave, Maya AWOL): the banner with its link", async ({ browser }) => {
    await runPage(browser, { email: THERESE, path: "/student/enrollment", shot: "enrollment-leave" }, async (page) => {
      await expect(page.getByText("Subjects can be added again once you are back in the program.")).toBeVisible();
      await expect(page.getByText("You are on leave of absence", { exact: true })).toBeVisible();
      const link = page.getByRole("link", { name: /Ask to come back \(Readmission\)/ });
      await expect(link).toHaveAttribute("href", "/student/requests/readmission");
    });
    await runPage(browser, { email: MAYA, path: "/student/enrollment", shot: "enrollment-awol" }, async (page) => {
      const link = page.getByRole("link", { name: /Open Return from AWOL/ });
      await expect(link).toHaveAttribute("href", "/student/requests/awol-return");
      await expect(page.getByText("Subjects can be added again once you are back in the program.")).toBeVisible();
    });
  });

  test("Request Center (Therese): the leave statuses beside each request", async ({ browser }) => {
    await runPage(browser, { email: THERESE, path: "/student/requests", shot: "request-center" }, async (page) => {
      await expect(page.getByRole("heading", { level: 1, name: "Request Center" })).toBeVisible();
      await expect(page.getByText("Leave of Absence", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("On leave", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Readmission", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Not submitted", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Return from AWOL", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Available only while your student record is marked AWOL.")).toBeVisible();
    });
  });
});
