// Packet P82 (Phase 5 design system P4.3 + P4.4, student stream; review findings F-33 and F-37; I-086, I-087).
// Pins what the student PAGES show, so moving pages/student/{StudentOverview,StudentProgress,MyCourses,StudentAdviserPage,
// StudentRequestPages,StudentInbox,StudentCalendarPage,StudentSupportPages,StudentAssistant,StudentRoutes}.jsx onto the
// component library (PageHeader, DataTable, StatCard, StatusChip, Stepper, Card, Modal) cannot change what a student sees.
// The first half is written against the old code and passes on both; the second half ("P82 changes") is the spec of the
// intended changes and is red until they land.
//
// Through the real UI, as the seeded demo student (student@usls.edu.ph). Nothing is written: every expectation is read from the
// API at test time (so other specs that move the demo student do not matter), and where a state is not in the seed the browser
// answers the page's GET with the REAL response plus that state (page.route). Pages: /student, /progress, /enrollment, /adviser,
// /requests and the request pages, /defense-schedule, /messages, /calendar, /documents, /activity, /assistant, /profile and the
// route fallback. Screenshots (when P82_SHOTS is set) at 1366 / 1920 / 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const MIGUEL = "student@usls.edu.ph";
const SHOTS = process.env.P82_SHOTS || "";
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The demo student in its own browser context, signed in through the API.
 * `mutate(data)` edits the portal context; `adviser(real)` / `calendar(real)` return the tracker / calendar the page should get.
 */
async function studentPage(browser, { email = MIGUEL, mutate, adviser, calendar } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  await stubExternal(context);
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
  const tracker = { problems: [], writes: [], where: { role: "student", page: "p82", viewport: 1366 } };
  const answer = (path, change) => async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    try {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({ response, json: change(data) ?? data });
    } catch (error) {
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    }
  };
  if (mutate) await context.route("**/api/student-portal/context", answer("context", (d) => { mutate(d); return d; }));
  if (adviser) await context.route("**/api/student-portal/adviser", answer("adviser", adviser));
  if (calendar) await context.route("**/api/student-portal/research-calendar", answer("calendar", calendar));
  const page = await context.newPage();
  attachWatchers(page, tracker);
  const portal = async () => (await context.request.get("/api/student-portal/context")).json();
  const finish = async () => {
    const report = formatProblems(tracker.problems);
    expect(report, report.join("\n")).toEqual([]);
    expect(tracker.writes, `writes: ${tracker.writes.join(", ")}`).toEqual([]);
    await context.close();
  };
  return { context, page, portal, finish, tracker };
}

/** Open a path, wait for the page, screenshot it (when asked) at the three widths, and be back at 1366. */
async function open(page, path, shot) {
  await page.goto(path);
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (!SHOTS || !shot) return;
  mkdirSync(SHOTS, { recursive: true });
  for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `${shot}-${w}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

const main = (page) => page.locator("main");
const h1 = (page) => main(page).locator("h1");
const h2s = (page) => main(page).locator("h2");
/** The card (element with class `card`) around the h2 `name`. */
const cardOf = (page, name) =>
  page.getByRole("heading", { level: 2, name, exact: true }).locator("xpath=ancestor::div[contains(concat(' ',normalize-space(@class),' '),' card ')][1]");
/** The key number (StatCard) whose label is `label`. */
const stat = (page, label) => main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${esc(label)}$`, "i") }).locator("xpath=..");

// ---- states injected on top of the real response ---------------------------------------------------------------------

const OPEN_APPLICATION = {
  id: 91, kind: "Initial", status: "Pending", faculty_id: 9, faculty_name: "Dr. Spec Nominee", applied_at: "2026-10-01T09:00:00",
  steps: [
    { key: "applied", label: "Form 3 submitted", done: true, current: false, at: "2026-10-01T09:00:00" },
    { key: "noted", label: "Academic Coordinator notes the application", done: false, current: true, at: null },
    { key: "deliberation", label: "Research Coordinator sends it to the Dean", done: false, current: false, at: null },
    { key: "decision", label: "Dean decides", done: false, current: false, at: null },
  ],
  ac_note: "Spec: noted by the coordinator.", decision_note: null, adviser_response: null, adviser_response_reason: null,
  current_adviser_consent: null, warnings: ["Spec warning: this adviser is nearly full."],
};

const adviserState = (change) => (real) => { change(real); return real; };
const noAdviserYet = adviserState((t) => { t.current = null; t.open = null; t.can_apply = true; t.can_request_change = false; t.change_blocked_reason = null; t.history = []; });

const NEXT_DEFENSE = {
  id: 5, kind: "defense", defense_type: "Final Defense", date: "2027-02-03", start: "2027-02-03T09:00:00", end: "2027-02-03T10:30:00", status: "Scheduled",
  countdown_days: 12, venue: "Spec Room 1", mode: "On-site", adviser: "Dr. Spec Adviser", change_reason: "Spec: moved by one hour.",
  panel: [{ faculty_id: 1, name: "Dr. Panel One", role: "Panel Chair" }], attention: ["Spec: bring two printed copies."], ics_url: "/api/defense-schedules/5/event.ics",
};

const THREAD = [
  { id: 8101, transaction_slug: "leave-of-absence", request_id: 41, thread_key: "loa:41", action_type: "return", status: "Open", recipient_role: "Student", sender_role: "Graduate School Staff", sender_name: "Staff Anna", comment: "Spec: please add the clinic certificate.", created_at: "2026-10-02T09:00:00", is_unread: false, stage: "Staff Review" },
  { id: 8102, transaction_slug: "leave-of-absence", request_id: 41, thread_key: "loa:41", action_type: "response", status: "Answered", recipient_role: "Graduate School Staff", sender_role: "Student", sender_name: "Miguel Yu", comment: "Spec: it is attached now.", created_at: "2026-10-03T09:00:00", is_unread: false, stage: "Staff Review", reply_to_message_id: 8101 },
];

test.describe("P82 student pages (pinned)", () => {
  test("Home: header, four key numbers with their links, lifecycle and the one-line links", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser);
    try {
      const data = await portal();
      const student = data.student;
      await open(page, "/student", "home");
      await expect(h1(page)).toHaveText(`Welcome, ${student.first_name || student.name.split(" ")[0]}`);
      await expect(main(page)).toContainText(student.program_name);
      await expect(main(page)).toContainText(student.student_number);

      const labels = (await main(page).locator('[data-slot="label"]').allTextContents()).map((t) => t.trim().toLowerCase());
      expect([...labels].sort()).toEqual(["coursework", "research", "unread messages", "your open tasks"]);
      const audit = data.course_audit;
      await expect(stat(page, "Coursework").locator('[data-slot="value"]')).toHaveText(`${audit.completion_rate}%`);
      await expect(stat(page, "Coursework").locator('[data-slot="sub"]')).toHaveText(`${audit.completed.length} completed, ${audit.missing_count} missing`);
      const own = (data.tasks || []).filter((t) => t.owner_role === "Student");
      await expect(stat(page, "Your open tasks").locator('[data-slot="value"]')).toHaveText(String(own.length));
      await expect(stat(page, "Your open tasks").locator('[data-slot="sub"]')).toHaveText(`${own.filter((t) => t.overdue).length} overdue`);
      const unread = (data.workflow_messages || []).filter((m) => m.is_unread).length;
      await expect(stat(page, "Unread messages").locator('[data-slot="value"]')).toHaveText(String(unread));
      for (const [label, href] of [["Coursework", "/student/progress"], ["Research", "/student/research"], ["Unread messages", "/student/messages"]]) {
        await expect(main(page).locator(`a[href="${href}"]`).filter({ has: page.locator('[data-slot="label"]', { hasText: new RegExp(`^${esc(label)}$`, "i") }) }), `${label} links to ${href}`).toHaveCount(1);
      }
      await expect(main(page).locator("a").filter({ has: page.locator('[data-slot="label"]', { hasText: /^Your open tasks$/i }) }), "open tasks is not a link").toHaveCount(0);

      // the lifecycle and the moved blocks
      const life = main(page).locator("section", { has: page.getByRole("heading", { name: "Your lifecycle", exact: true }) });
      await expect(life).toContainText(`You are at: ${student.current_stage}`);
      await expect(life.locator("ol > li")).toHaveCount(Math.min(8, data.stages.length));
      await expect(life.locator('ol [aria-current="step"]')).toContainText(student.current_stage);
      const elsewhere = main(page).locator("section", { has: page.getByRole("heading", { name: "Elsewhere in your portal", exact: true }) });
      await expect(elsewhere.locator("li")).toHaveCount(4);
      for (const [name, href] of [["Defense Schedule", "/student/defense-schedule"], ["Research Adviser", "/student/adviser"], ["Request Center", "/student/requests"], ["Leave of Absence", "/student/requests/leave-of-absence"]]) {
        await expect(elsewhere.getByRole("link", { name }), name).toHaveAttribute("href", href);
      }
      await expect(main(page).getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
      await expect(main(page).getByRole("link", { name: "View all" }).last()).toHaveAttribute("href", "/student/activity");
    } finally {
      await finish();
    }
  });

  test("My Progress: academic status, workflow rows, and the curriculum table of every category", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser);
    try {
      const data = await portal();
      await open(page, "/student/progress", "progress");
      await expect(h1(page)).toHaveText("My Progress");
      await expect(main(page)).toContainText("Your lifecycle stage, requirement status, and curriculum, read from the monitoring record.");
      await expect(h2s(page)).toHaveText(["My Academic Status", "Workflow Status", "Curriculum progress"]);

      const status = cardOf(page, "My Academic Status");
      await expect(status.locator("ol > li")).toHaveCount(Math.min(8, data.stages.length));
      await expect(status.locator('ol [aria-current="step"]')).toContainText(data.student.current_stage);
      await expect(status).toContainText("Coursework completion");
      await expect(status).toContainText(`${data.course_audit.completion_rate}%`);
      await expect(status).toContainText(`${data.course_audit.completed.length} completed, ${data.course_audit.current.length} current, ${data.course_audit.missing_count} missing.`);
      await expect(status).toContainText(data.research_case?.title || "No research case opened yet");

      const workflow = cardOf(page, "Workflow Status");
      for (const label of ["Withdrawal", "Graduation Endorsement"]) await expect(workflow, label).toContainText(label);

      const curriculum = cardOf(page, "Curriculum progress");
      const audit = data.course_audit;
      await expect(curriculum).toContainText(`${audit.completed_units} / ${audit.total_units}`);
      for (const [label, value] of [["Completed", audit.completed.length], ["Current", audit.current.length], ["Missing", audit.missing_count]]) {
        await expect(curriculum.getByText(label, { exact: true }).first().locator("xpath=..")).toContainText(String(value));
      }
      await expect(curriculum.getByRole("link", { name: "Enroll in subjects" })).toHaveAttribute("href", "/student/enrollment");
      const groups = {};
      for (const subject of data.curriculum_subjects) (groups[subject.category || "Other"] ||= []).push(subject);
      await expect(curriculum.locator("h3")).toHaveText(Object.keys(groups));
      await expect(curriculum.locator("table")).toHaveCount(Object.keys(groups).length);
      for (const [category, rows] of Object.entries(groups)) {
        await expect(curriculum.getByText(`${rows.length} subject${rows.length === 1 ? "" : "s"}`, { exact: true }).first()).toBeVisible();
        const head = curriculum.getByRole("heading", { level: 3, name: category, exact: true }).locator("xpath=ancestor::section[1]");
        await expect(head.locator("th")).toHaveText(["Subject", "Units", "Suggested term", "Status"]);
        await expect(head.locator("tbody tr")).toHaveCount(rows.length);
        await expect(head.locator("tbody tr").first()).toContainText(rows[0].code);
        await expect(head.locator("tbody tr").first()).toContainText(rows[0].status === "Missing" ? "Not taken" : rows[0].status);
      }
    } finally {
      await finish();
    }
  });

  test("Enrollment: the checkbox list per category, locked rows, the count under Save", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser, {
      mutate: (d) => {
        d.student.standing = "Active";
        d.student.enrollment_tag = "";
        d.leave_overview = null;
        d.curriculum_subjects[0] = { ...d.curriculum_subjects[0], status: "Missing", is_enrolled: false, is_offered: true };
        d.curriculum_subjects[1] = { ...d.curriculum_subjects[1], status: "Current", is_enrolled: true, is_offered: true };
      },
    });
    try {
      const real = await portal();
      await open(page, "/student/enrollment", "courses");
      await expect(h1(page)).toHaveText("Enrollment");
      await expect(main(page)).toContainText("Choose the published subjects you are taking this semester. Subjects already on your record stay locked.");
      await expect(page.getByRole("link", { name: "View my progress" })).toHaveAttribute("href", "/student/progress");
      await expect(h2s(page)).toHaveText(["My suggested curriculum"]);
      await expect(main(page)).toContainText(real.current_term?.label || "Current semester");
      const boxes = main(page).getByRole("checkbox");
      await expect(boxes).toHaveCount(real.curriculum_subjects.length);
      await expect(boxes.filter({ has: page.locator(":scope:enabled") })).toHaveCount(1);
      const first = real.curriculum_subjects[0];
      const second = real.curriculum_subjects[1];
      const box = main(page).getByRole("checkbox", { name: `Currently enrolled in ${first.code}` });
      await expect(box).toBeEnabled();
      await expect(box).not.toBeChecked();
      await expect(main(page).getByRole("checkbox", { name: `Currently enrolled in ${second.code}` })).toBeDisabled();
      await expect(main(page).getByRole("checkbox", { name: `Currently enrolled in ${second.code}` })).toBeChecked();
      await expect(main(page)).toContainText("1 subject checked for this semester.");
      await box.check();
      await expect(main(page)).toContainText("2 subjects checked for this semester.");
      await expect(main(page).getByRole("button", { name: "Save current subjects" })).toBeEnabled();
      await box.uncheck();
      await expect(main(page)).toContainText("1 subject checked for this semester.");
      const groups = new Set(real.curriculum_subjects.map((s) => s.category || "Other"));
      await expect(main(page).locator("h3")).toHaveCount(groups.size);
    } finally {
      await finish();
    }
  });

  test("Research Adviser: the current adviser, an application in progress, the nomination form, the notices and the history", async ({ browser }) => {
    // 1. the seeded student: the current adviser and why a change is closed
    let s = await studentPage(browser);
    try {
      await open(s.page, "/student/adviser", "adviser");
      await expect(h1(s.page)).toHaveText("Research Adviser");
      await expect(main(s.page)).toContainText("You nominate an adviser on Form 3.");
      await expect(h2s(s.page)).toHaveText(["Your research adviser"]);
      const tracker = await (await s.context.request.get("/api/student-portal/adviser")).json();
      const card = cardOf(s.page, "Your research adviser");
      await expect(card).toContainText(tracker.current.faculty_name);
      await expect(card).toContainText(tracker.current.status);
      await expect(card).toContainText(/Appointed/);
      if (tracker.change_blocked_reason) await expect(card).toContainText(tracker.change_blocked_reason);
    } finally {
      await s.finish();
    }

    // 2. an application in progress: the step list, the notes, the warning, withdraw
    s = await studentPage(browser, { adviser: adviserState((t) => { t.current = null; t.open = OPEN_APPLICATION; t.can_apply = false; t.history = []; }) });
    try {
      await open(s.page, "/student/adviser");
      await expect(h2s(s.page)).toHaveText(["Adviser application in progress"]);
      const card = cardOf(s.page, "Adviser application in progress");
      await expect(card).toContainText("Adviser you nominated");
      await expect(card).toContainText("Dr. Spec Nominee");
      await expect(card.getByText("Pending", { exact: true })).toBeVisible();
      const steps = s.page.getByRole("list", { name: "Where your application stands" });
      await expect(steps.locator("li")).toHaveCount(4);
      await expect(steps.locator('li[aria-current="step"]')).toHaveCount(1);
      await expect(steps.locator('li[aria-current="step"]')).toContainText("Academic Coordinator notes the application");
      await expect(steps.locator("li").first()).toContainText("Form 3 submitted");
      await expect(card).toContainText("Academic Coordinator note: Spec: noted by the coordinator.");
      await expect(card.getByRole("status").filter({ hasText: "Spec warning: this adviser is nearly full." })).toBeVisible();
      await expect(card.getByRole("button", { name: "Withdraw application" })).toBeEnabled();
    } finally {
      await s.finish();
    }

    // 3. the nomination form: search, choose, the full-adviser notice, the button
    s = await studentPage(browser, { adviser: noAdviserYet });
    try {
      await open(s.page, "/student/adviser");
      await expect(h2s(s.page)).toHaveText(["Nominate your research adviser (Form 3)"]);
      const tracker = await (await s.context.request.get("/api/student-portal/adviser")).json();
      const radios = main(s.page).getByRole("radio");
      await expect(radios).toHaveCount(tracker.candidates.length);
      const send = main(s.page).getByRole("button", { name: "Send Form 3 application" });
      await expect(send).toBeDisabled();
      await main(s.page).getByLabel("Find a faculty member").fill("zzz-no-such-person");
      await expect(main(s.page)).toContainText("No faculty member matches your search.");
      await main(s.page).getByLabel("Find a faculty member").fill("");
      const full = tracker.candidates.find((c) => !c.available);
      if (full) {
        await main(s.page).locator("label", { hasText: full.name }).first().click();
        await expect(send).toBeEnabled();
        await expect(main(s.page).getByRole("status").filter({ hasText: `${full.name} already has ${full.advisees} of ${full.max_advisees} advisees.` })).toBeVisible();
      }
      await expect(main(s.page).getByLabel("Note (optional)")).toBeVisible();
    } finally {
      await s.finish();
    }

    // 4. cannot apply; earlier applications
    s = await studentPage(browser, {
      adviser: adviserState((t) => {
        t.current = null; t.open = null; t.can_apply = false;
        t.history = [{ id: 71, kind: "Change", faculty_name: "Dr. Spec Earlier", status: "Declined", applied_at: "2026-05-01T09:00:00", adviser_response_reason: "Spec: not my field." }];
      }),
    });
    try {
      await open(s.page, "/student/adviser");
      await expect(main(s.page).getByRole("status").filter({ hasText: "You cannot apply for an adviser right now." })).toBeVisible();
      await expect(h2s(s.page)).toHaveText(["Earlier applications"]);
      const row = main(s.page).locator("li", { hasText: "Dr. Spec Earlier" });
      await expect(row).toContainText("change of adviser");
      await expect(row).toContainText("Declined");
      await expect(row).toContainText("Spec: not my field.");
    } finally {
      await s.finish();
    }
  });

  test("Request Center: three groups, every request with its link, the locked ones with their reason", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser);
    try {
      const data = await portal();
      await open(page, "/student/requests", "requests");
      await expect(h1(page)).toHaveText("Request Center");
      await expect(main(page)).toContainText("Every request you can file, with its current status. Choose the one that matches your situation.");
      await expect(h2s(page)).toHaveText(["Research & Defense", "Leave & Return", "Completion"]);
      const links = [
        ["Research Progress", "/student/research"], ["Defense Schedule", "/student/defense-schedule"], ["Leave of Absence", "/student/requests/leave-of-absence"],
        ["Readmission", "/student/requests/readmission"], ["Return from AWOL", "/student/requests/awol-return"], ["Subject Withdrawal", "/student/requests/withdrawal"],
        ["Practicum", "/student/practicum"], ["Graduation Endorsement", "/student/graduation"],
      ];
      for (const [name, href] of links) await expect(main(page).locator(`a[href="${href}"]`), name).toContainText(name);
      await expect(main(page).locator("ul > li > a")).toHaveCount(links.length);
      if (!data.student.program_has_practicum) {
        await expect(main(page).locator('a[href="/student/practicum"]')).toContainText("Practicum is available only to Psychology and Master of Science in Guidance and Counseling (MSGC) students.");
        await expect(main(page).locator('a[href="/student/practicum"] [aria-label="Locked"]')).toHaveCount(1);
      }
    } finally {
      await finish();
    }
  });

  test("Request pages: title, description, status chip and the way back, on every request page", async ({ browser }) => {
    const { page, finish } = await studentPage(browser);
    try {
      for (const [path, title, desc] of [
        ["/student/research", "Research Progress", "Upload your milestone files, submit them for review, and follow your title, proposal and final defense requirements."],
        ["/student/defense-schedule", "Defense Schedule", "Request a defense date once your panel is matched."],
        ["/student/requests/leave-of-absence", "Leave of Absence", "Ask for a leave of absence, or for more time on a leave you are already on."],
        ["/student/requests/readmission", "Readmission", "Ask to come back to your studies when your leave of absence is ending."],
        ["/student/requests/withdrawal", "Subject Withdrawal", "Withdraw from one enrolled subject until the end of the second week of classes"],
        ["/student/practicum", "Practicum", "Submit your MOA and completion evidence for the practicum requirement"],
        ["/student/graduation", "Graduation Endorsement", "Apply for the Graduate School graduation endorsement"],
      ]) {
        await open(page, path);
        await expect(h1(page), path).toHaveText(title);
        await expect(main(page), path).toContainText(desc);
        await expect(h1(page).locator("xpath=.."), `${path}: a status chip beside the title`).toHaveText(new RegExp(`^${esc(title)}\\s*\\S+`));
        await expect(main(page).getByRole("link", { name: "All requests" }), path).toHaveAttribute("href", "/student/requests");
      }
    } finally {
      await finish();
    }
  });

  test("Research Progress and Defense Schedule: the adviser-and-panel card, the schedule list", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser);
    try {
      const data = await portal();
      await open(page, "/student/research");
      const card = cardOf(page, "Adviser and panel");
      await expect(card).toContainText("Assigned after Panel Matching; scheduling opens once a panel is in place");
      await expect(card).toContainText(`Adviser: ${data.student.adviser_name || data.research_case?.adviser_name || "Not assigned"}`);
      for (const member of data.panel || []) await expect(card).toContainText(member.panel_role);
      await expect(card.getByRole("link", { name: "Defense schedule" }), "the research page links to the schedule page").toHaveAttribute("href", "/student/defense-schedule");

      await open(page, "/student/defense-schedule", "defense");
      await expect(h2s(page).filter({ hasText: /^(Adviser and panel|Schedule requests)$/ })).toHaveText(["Adviser and panel", "Schedule requests"]);
      const list = cardOf(page, "Schedule requests");
      await expect(list.locator("ul.space-y-3 > li")).toHaveCount((data.schedules || []).length || 1);
      for (const schedule of data.schedules || []) await expect(list).toContainText(schedule.defense_type);
      await expect(main(page).getByRole("link", { name: "All requests" })).toHaveAttribute("href", "/student/requests");
    } finally {
      await finish();
    }
  });

  test("Messages: the page, the question form, the filter, a thread with its reply box, and the empty view", async ({ browser }) => {
    // the seeded student has no messages
    let s = await studentPage(browser, { mutate: (d) => { d.workflow_messages = []; } });
    try {
      await open(s.page, "/student/messages", "messages");
      await expect(h1(s.page)).toHaveText("Messages");
      await expect(main(s.page)).toContainText("Clarification requests, staff replies and questions about your active requests.");
      await expect(h2s(s.page)).toHaveText(["Inbox / Messages"]);
      await expect(main(s.page)).toContainText("No messages in this view");
      await expect(main(s.page).getByLabel("Filter messages").locator("option")).toHaveText(["All workflows", "Leave of Absence", "Readmission", "Course Audit", "AWOL / Residency", "Practicum", "Withdrawal", "Graduation"]);
    } finally {
      await s.finish();
    }

    s = await studentPage(browser, { mutate: (d) => { d.workflow_messages = THREAD; } });
    try {
      await open(s.page, "/student/messages");
      await expect(main(s.page).getByText("Ask about an active request")).toBeVisible();
      await expect(main(s.page).getByLabel("Workflow").locator("option")).toHaveText(["Leave of Absence"]);
      await expect(main(s.page).getByLabel("Recipient").locator("option")).toHaveText(["Graduate School Staff"]);
      const send = main(s.page).getByRole("button", { name: "Send question" });
      await expect(send).toBeDisabled();
      await main(s.page).getByLabel("Question or clarification").fill("Spec question?");
      await expect(send).toBeEnabled();
      const thread = main(s.page).locator("section").filter({ hasText: "Leave of Absence request #41" }).last();
      await expect(thread).toContainText("2 messages");
      await expect(thread).toContainText("current stage Staff Review");
      await expect(thread).toContainText("Spec: please add the clinic certificate.");
      await expect(thread).toContainText("Spec: it is attached now.");
      const reply = thread.getByLabel("Reply to Staff Anna");
      await expect(reply).toBeVisible();
      const sendReply = thread.getByRole("button", { name: "Send reply" });
      await expect(sendReply).toBeDisabled();
      await reply.fill("Spec reply");
      await expect(sendReply).toBeEnabled();
      await main(s.page).getByLabel("Filter messages").selectOption("practicum");
      await expect(main(s.page)).toContainText("No messages in this view");
      await main(s.page).getByLabel("Filter messages").selectOption("all");
      await thread.getByRole("button", { name: /Open request/ }).click();
      await expect(s.page).toHaveURL(/\/student\/requests\/leave-of-absence$/);
    } finally {
      await s.finish();
    }
  });

  test("Research Calendar: an empty calendar and a booked defense with its deadlines", async ({ browser }) => {
    let s = await studentPage(browser);
    try {
      await open(s.page, "/student/calendar", "calendar");
      await expect(h1(s.page)).toHaveText("Research Calendar");
      await expect(main(s.page)).toContainText("Your defense date, the deadlines that lead to it");
      await expect(main(s.page)).toContainText("Research adviser:");
      await expect(main(s.page).getByRole("link", { name: /Adviser page|Apply for an adviser/ })).toHaveAttribute("href", "/student/adviser");
      for (const name of ["Your next defense", "Next deadlines", "Calendar"]) await expect(main(s.page).getByRole("heading", { level: 2, name, exact: true }), name).toBeVisible();
      await expect(main(s.page)).toContainText("No defense is booked yet");
      await expect(main(s.page).getByRole("link", { name: "Request a defense schedule" })).toHaveAttribute("href", "/student/defense-schedule");
      await expect(main(s.page)).toContainText("No deadlines right now");
      await expect(main(s.page).getByRole("status").filter({ hasText: "If your defense is moved" })).toBeVisible();
      await expect(main(s.page)).toContainText("Select a defense or a deadline in the calendar to see its details.");
    } finally {
      await s.finish();
    }

    s = await studentPage(browser, {
      calendar: (real) => ({
        ...real,
        next_defense: NEXT_DEFENSE,
        events: [],
        deadlines: [
          { id: "d1", label: "Spec: send the manuscript", date: "2027-01-20", urgency: "soon", done: false },
          { id: "d2", label: "Spec: already sent", date: "2027-01-10", urgency: "later", done: true },
        ],
      }),
    });
    try {
      await open(s.page, "/student/calendar");
      const next = cardOf(s.page, "Your next defense");
      await expect(next).toContainText("Final Defense");
      await expect(next).toContainText("Scheduled");
      await expect(next).toContainText("In 12 days");
      await expect(next).toContainText("09:00-10:30");
      await expect(next).toContainText("Spec Room 1 (On-site)");
      await expect(next).toContainText("Dr. Spec Adviser");
      await expect(next).toContainText("Dr. Panel One");
      await expect(next).toContainText("Spec: bring two printed copies.");
      await expect(next).toContainText("Last change: Spec: moved by one hour.");
      await expect(next.getByRole("link", { name: /Add to calendar/ })).toHaveAttribute("href", "/api/defense-schedules/5/event.ics");
      const deadlines = cardOf(s.page, "Next deadlines");
      await expect(deadlines.locator("li")).toHaveCount(1); // the done one is left out
      await expect(deadlines).toContainText("Spec: send the manuscript");
      await expect(deadlines).toContainText("Due soon");
    } finally {
      await s.finish();
    }
  });

  test("Documents, Activity, Policy Assistant and My Profile: titles, headings and facts", async ({ browser }) => {
    const { page, portal, finish } = await studentPage(browser);
    try {
      const data = await portal();
      const student = data.student;
      await open(page, "/student/documents", "documents");
      await expect(h1(page)).toHaveText("Documents");
      await expect(main(page).getByRole("link", { name: "Research uploads" })).toHaveAttribute("href", "/student/research");
      const hasAdmin = Object.keys(data.documents_by_gate || {}).some((gate) => !["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"].includes(gate));
      if (hasAdmin) await expect(h2s(page)).toHaveText(["Administrative Documents"]);
      else await expect(main(page)).toContainText("No administrative documents on file");

      await open(page, "/student/activity", "activity");
      await expect(h1(page)).toHaveText("Activity Log");
      await expect(h2s(page)).toHaveText(["Activity Log"]);
      await expect(main(page)).toContainText("Submissions, decisions, and next owners");

      await open(page, "/student/assistant", "assistant");
      await expect(h1(page)).toHaveText("Policy Assistant");
      await expect(main(page).getByText("Private and read-only")).toBeVisible();
      await expect(main(page)).toContainText("It cannot see other students");

      await open(page, "/student/profile", "profile");
      await expect(h1(page)).toHaveText("My Profile");
      await expect(h2s(page)).toHaveText([student.name]);
      await expect(main(page)).toContainText(`${student.student_number} · ${student.program_name}`);
      const row = (label) => main(page).getByText(label, { exact: true }).locator("xpath=..");
      for (const [label, value] of [["Student number", student.student_number], ["Email", student.email], ["Program", `${student.program_code} · ${student.program_name}`], ["College", student.college || "Not recorded"], ["Academic year of entry", student.academic_year_entry || "Not recorded"], ["Course year", student.course_year_label || "Not available"], ["Lifecycle stage", student.current_stage], ["Standing", student.standing], ["Enrollment tag", student.enrollment_tag || "None"], ["Adviser", student.adviser_name || data.research_case?.adviser_name || "Not assigned"], ["Comprehensive exam", student.comprehensive_exam_status || "Not recorded"], ["Progress status", data.progress_status?.level || "Not yet assessed"]]) {
        await expect(row(label), label).toContainText(value);
      }
    } finally {
      await finish();
    }
  });

  test("Routes: an unknown student path lands on the home", async ({ browser }) => {
    const { page, finish } = await studentPage(browser);
    try {
      await page.goto("/student/not-a-page");
      await expect(page).toHaveURL(/\/student$/);
      await expect(h1(page)).toContainText("Welcome,");
    } finally {
      await finish();
    }
  });

  test("Every page: one h1, no console errors, no sideways scroll at 390 px", async ({ browser }) => {
    const { page, finish, tracker } = await studentPage(browser);
    try {
      for (const path of ["/student", "/student/progress", "/student/enrollment", "/student/adviser", "/student/requests", "/student/research", "/student/defense-schedule", "/student/calendar", "/student/messages", "/student/documents", "/student/activity", "/student/assistant", "/student/profile"]) {
        tracker.where = { role: "student", page: path, viewport: 390 };
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(path);
        await expect(main(page).locator("h1")).toHaveCount(1);
        await page.waitForLoadState("networkidle");
        expect(await noOverflow(page), `${path} at 390 px: no sideways scroll`).toBe(true);
      }
    } finally {
      await finish();
    }
  });
});

