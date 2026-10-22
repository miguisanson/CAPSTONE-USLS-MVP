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
    const schedules = [
      { id: 9301, defense_type: "Proposal Defense", preferred_date: "2026-08-08", status: "Held", display_status: "Finished", is_active: false, start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Spec Room", panelists: [], attention: [] },
      { id: 9302, defense_type: "Title Defense", preferred_date: "2026-06-09", status: "Held", display_status: "Finished", is_active: false, start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Spec Room", panelists: [], attention: [] },
    ];
    const { page, finish } = await studentPage(browser, {
      mutate: (d) => {
        d.research_case = { ...(d.research_case || {}), id: 1, status: "Pending Staff Action", adviser_name: "Dr. Spec Adviser" };
        d.student.adviser_name = "Dr. Spec Adviser";
        d.panel = [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }];
        d.schedules = schedules;
        d.defense_follow_up = null;
      },
    });
    try {
      await open(page, "/student/research");
      const card = cardOf(page, "Adviser and panel");
      await expect(card).toContainText("Assigned after Panel Matching; scheduling opens once a panel is in place");
      await expect(card).toContainText("Adviser: Dr. Spec Adviser");
      await expect(card).toContainText("Dr. Panel One");
      await expect(card).toContainText("Panel Chair");
      await expect(card.getByRole("link", { name: "Defense schedule" }), "the research page links to the schedule page").toHaveAttribute("href", "/student/defense-schedule");

      await open(page, "/student/defense-schedule", "defense");
      await expect(h2s(page).filter({ hasText: /^(Adviser and panel|Schedule requests)$/ })).toHaveText(["Adviser and panel", "Schedule requests"]);
      const list = cardOf(page, "Schedule requests");
      await expect(list.locator("ul.space-y-3 > li")).toHaveCount(2);
      for (const schedule of schedules) await expect(list).toContainText(schedule.defense_type);
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

// ============================================================================================================================
// P82 changes: the spec of what is meant to change. Red on the old pages.
// ============================================================================================================================

const FINISHED_PROPOSAL = {
  id: 9201, defense_type: "Proposal Defense", preferred_date: "2026-08-08", status: "Held", display_status: "Finished", is_active: false,
  start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Spec Room", panelists: [], attention: [],
};
const LIVE_FINAL = { id: 9202, defense_type: "Final Defense", preferred_date: "2027-03-01", status: "Scheduled", display_status: "Scheduled", is_active: true, start_time: "09:00", end_time: "10:30", mode: "In person", venue: "Spec Room", panelists: [], attention: [] };
const DEFERRED_FINAL = { id: 9203, defense_type: "Final Defense", preferred_date: "2026-09-01", status: "Deferred", display_status: "Deferred", is_active: false, start_time: null, end_time: null, mode: null, venue: null, panelists: [], attention: [] };

// A research case, a matched panel and these schedules: the Defense Schedule page shows its form (it is locked without a panel).
const atStage = (stage, schedules) => (d) => {
  d.research_case = { ...(d.research_case || {}), id: 1, status: "Pending Staff Action" };
  d.panel = [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }];
  d.defense_follow_up = null;
  d.student.current_stage = stage;
  d.research_progress = { ...(d.research_progress || {}), stage };
  d.schedules = schedules;
};

test.describe("P82 changes: the student home", () => {
  test("I-087: the Research key number says the stage in the figure and the status as a chip in the sub-line", async ({ browser }) => {
    const { page, finish } = await studentPage(browser, {
      mutate: (d) => {
        d.research_case = { ...(d.research_case || {}), id: 1, status: "Pending Staff Action", current_gate_label: "Proposal Defense Readiness" };
        d.research_progress = { ...(d.research_progress || {}), stage: "Proposal Defense", status: "Pending Staff Action" };
      },
    });
    try {
      await open(page, "/student");
      const card = stat(page, "Research");
      await expect(card.locator('[data-slot="value"]'), "the figure is the stage name").toHaveText("Proposal Defense");
      await expect(card.locator('[data-slot="value"] span.ring-1'), "no status chip in the figure").toHaveCount(0);
      const sub = card.locator('[data-slot="sub"]');
      await expect(sub.locator("span.ring-1"), "the status is a chip in the sub-line").toHaveText("Pending Staff Action");
      // the other three cards still show a plain number
      for (const label of ["Coursework", "Your open tasks", "Unread messages"]) await expect(stat(page, label).locator('[data-slot="value"] span.ring-1'), label).toHaveCount(0);
    } finally {
      await finish();
    }
  });

  test("I-087: with no research case the Research card says 'Not started' and how to begin", async ({ browser }) => {
    const { page, finish } = await studentPage(browser, { mutate: (d) => { d.research_case = null; d.research_progress = null; } });
    try {
      await open(page, "/student");
      const card = stat(page, "Research");
      await expect(card.locator('[data-slot="value"]')).toHaveText("Not started");
      await expect(card.locator('[data-slot="sub"]')).toContainText("Open the Research page to begin");
    } finally {
      await finish();
    }
  });
});

test.describe("P82 changes: the Defense Schedule page", () => {
  test("I-086: no link to the page the student is on; the research page keeps its link", async ({ browser }) => {
    const { page, finish } = await studentPage(browser);
    try {
      await open(page, "/student/defense-schedule");
      await expect(main(page).locator('a[href="/student/defense-schedule"]'), "no self-link on the Defense Schedule page").toHaveCount(0);
      await expect(h2s(page).filter({ hasText: "Adviser and panel" })).toHaveCount(1);
      await open(page, "/student/research");
      await expect(main(page).locator('a[href="/student/defense-schedule"]')).toHaveCount(1);
    } finally {
      await finish();
    }
  });

  test("I-086: the title chip shows the NEXT defense's state, not the last one that finished", async ({ browser }) => {
    const chip = (page) => h1(page).locator("xpath=..");
    // Final Defense stage, only the Proposal Defense is behind: the form below is for a new request
    let s = await studentPage(browser, { mutate: atStage("Final Defense", [FINISHED_PROPOSAL]) });
    try {
      await open(s.page, "/student/defense-schedule");
      await expect(chip(s.page)).not.toContainText("Finished");
      await expect(chip(s.page)).toContainText("No request");
      await expect(main(s.page).getByRole("button", { name: "Submit schedule request" })).toBeVisible();
      // the list below still shows the finished defense as Finished
      await expect(cardOf(s.page, "Schedule requests")).toContainText("Finished");
    } finally {
      await s.finish();
    }
    // a booked Final Defense: the chip says so, the form is closed
    s = await studentPage(browser, { mutate: atStage("Final Defense", [LIVE_FINAL, FINISHED_PROPOSAL]) });
    try {
      await open(s.page, "/student/defense-schedule");
      await expect(chip(s.page)).toContainText("Scheduled");
      await expect(chip(s.page)).not.toContainText("Finished");
    } finally {
      await s.finish();
    }
    // a deferred Final Defense: the chip follows that one
    s = await studentPage(browser, { mutate: atStage("Final Defense", [DEFERRED_FINAL, FINISHED_PROPOSAL]) });
    try {
      await open(s.page, "/student/defense-schedule");
      await expect(chip(s.page)).toContainText("Deferred");
      // the Request Center tile says the same
      await open(s.page, "/student/requests");
      await expect(main(s.page).locator('a[href="/student/defense-schedule"]')).toContainText("Deferred");
    } finally {
      await s.finish();
    }
  });
});

// ---- request forms: an error summary on submit (UX research section 3: items 1-4) -------------------------------------------

/** A form page: the real context plus a state; EVERY write is answered by the browser and recorded. */
async function formPage(browser, mutate, { failPath, failMessage = "Spec: the server said no." } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  await stubExternal(context);
  const res = await context.request.post("/api/auth/login", { data: { email: MIGUEL, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
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
    writes.push({ path, body });
    if (failPath && path.includes(failPath)) return route.fulfill({ status: 400, json: { error: failMessage } });
    return route.fulfill({ json });
  };
  await context.route("**/api/student-portal/requests/*", async (route) => answer(new URL(route.request().url()).pathname.replace("/api/student-portal/requests/", "requests/"), { message: "Spec: request saved." })(route));
  await context.route("**/api/student-portal/request-attachments/upload", answer("request-attachments/upload", { attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf", file_exists: true } }));
  const page = await context.newPage();
  const close = context.close.bind(context);
  context.close = async () => {
    for (const open of context.pages()) await open.waitForLoadState("networkidle").catch(() => {});
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await close();
  };
  return { context, page, writes };
}
const lastWrite = (writes, prefix) => [...writes].reverse().find((w) => w.path.startsWith(prefix));
const labelRe = (label) => new RegExp(`^${esc(label)}(\\s*\\*)?\\s*$`);
const fieldOf = (page, label) => page.locator("label.block").filter({ has: page.locator(".field-label", { hasText: labelRe(label) }) });
const ctl = (page, label) => fieldOf(page, label).locator("select, input:not([type=file]), textarea").first();
const submitButton = (page, name) => page.getByRole("button", { name, exact: true });
const summary = (page) => page.getByRole("alert").filter({ hasText: "There is a problem" });

/**
 * Press Submit with nothing filled in: the summary shows at the top of the form with one link per problem, its words are
 * repeated under the field, the first link moves the focus to its field, the page title starts with "Error: ", and nothing
 * is sent. `problems` = [[field label, message]].
 */
async function expectSummaryOnSubmit(page, writes, button, problems, { prefix, focusTarget }) {
  const submit = submitButton(page, button);
  await expect(submit, "Submit is not switched off while answers are missing").toBeEnabled();
  await submit.click();
  const box = summary(page);
  await expect(box).toBeVisible();
  await expect(box.getByRole("link")).toHaveCount(problems.length);
  for (const [label, message] of problems) {
    await expect(box.getByRole("link", { name: message, exact: true }), `summary item: ${message}`).toBeVisible();
    await expect(fieldOf(page, label).getByText(message, { exact: true }), `under "${label}"`).toBeVisible();
  }
  await expect(page, "the page title starts with Error:").toHaveTitle(/^Error: /);
  await box.getByRole("link", { name: problems[0][1], exact: true }).click();
  await expect(focusTarget ? focusTarget(page) : ctl(page, problems[0][0]), "the first link focuses its field").toBeFocused();
  expect(lastWrite(writes, prefix), "nothing was sent").toBeUndefined();
}

const SEM = (label, extra = {}) => ({ label, start_date: "2027-01-10", end_date: "2027-05-10", state: "Upcoming", filing_status: "Pass", filing_detail: "Spec.", ...extra });
function leaveOpen(data) {
  data.student.standing = "Active";
  data.student.enrollment_tag = "";
  const o = data.leave_overview;
  o.cases = [];
  o.banner = null;
  o.rules = { max_period_semesters: 2, max_total_semesters: 4 };
  o.loa_semester_options = [SEM("AY 2026-2027 2nd Semester"), SEM("AY 2027-2028 1st Semester", { start_date: "2027-08-01", end_date: "2027-11-29" })];
  o.can_file = { extension: { allowed: false, reason: "" }, loa: { allowed: true, reason: "" }, readmission: { allowed: false, reason: "" } };
  data.loa_allowed_reasons = ["Medical / health", "Family emergency"];
}

test.describe("P82 changes: request forms show an error summary on submit", () => {
  test("Leave of Absence: the summary lists what is missing; each link focuses its field; answers survive a server error", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, leaveOpen, { failPath: "requests/leave-of-absence", failMessage: "Spec: the Dean office is closed." });
    try {
      await page.goto("/student/requests/leave-of-absence");
      await expectSummaryOnSubmit(page, writes, "Submit leave request", [
        ["Leave starts", "Choose the semester your leave starts in."],
        ["Reason", "Choose the reason for your leave."],
        ["Tell us what is happening", "Explain what is happening so staff can review your request."],
      ], { prefix: "requests/leave-of-absence" });
      // fixing one problem and sending again: only the rest is listed
      await ctl(page, "Leave starts").selectOption("AY 2026-2027 2nd Semester");
      await ctl(page, "Reason").selectOption("Family emergency");
      await submitButton(page, "Submit leave request").click();
      await expect(summary(page).getByRole("link")).toHaveCount(1);
      await ctl(page, "Tell us what is happening").fill("Spec: a family matter.");
      await submitButton(page, "Submit leave request").click();
      await expect(page.getByRole("alert").filter({ hasText: "Spec: the Dean office is closed." })).toBeVisible();
      await expect(summary(page), "a clean form shows no summary").toHaveCount(0);
      // the server said no: every answer is still in the form
      await expect(ctl(page, "Leave starts")).toHaveValue("AY 2026-2027 2nd Semester");
      await expect(ctl(page, "Reason")).toHaveValue("Family emergency");
      await expect(ctl(page, "Tell us what is happening")).toHaveValue("Spec: a family matter.");
      await expect(submitButton(page, "Submit leave request")).toBeEnabled();
      expect(lastWrite(writes, "requests/leave-of-absence").body).toEqual({ effective_start: "AY 2026-2027 2nd Semester", effective_end: "AY 2026-2027 2nd Semester", reason_category: "Family emergency", reason_remarks: "Spec: a family matter." });
    } finally {
      await context.close();
    }
  });

  test("Readmission: the summary lists the missing answers and the unticked checklist", async ({ browser }) => {
    const ITEMS = ["Structured return intention completed", "Updated study plan confirmed"];
    const { context, page, writes } = await formPage(browser, (d) => {
      leaveOpen(d);
      d.leave_overview.can_file.readmission = { allowed: true, reason: "" };
      d.leave_overview.return_semester_options = ["AY 2026-2027 2nd Semester"];
      d.semester_options = ["AY 2025-2026 1st Semester"];
      d.readmission_requirements = ITEMS;
    });
    try {
      await page.goto("/student/requests/readmission");
      const submit = submitButton(page, "Submit readmission request");
      await expect(submit).toBeEnabled();
      await submit.click();
      const box = summary(page);
      await expect(box).toBeVisible();
      for (const message of ["Choose the semester your leave started in.", "Choose the semester your leave ended in.", "Choose the semester you want to return in.", "Say why you are ready to come back.", "Tick every item on the checklist."]) {
        await expect(box.getByRole("link", { name: message, exact: true }), message).toBeVisible();
      }
      await box.getByRole("link", { name: "Tick every item on the checklist.", exact: true }).click();
      await expect(page.getByRole("checkbox", { name: ITEMS[0] }), "the checklist link focuses its first item").toBeFocused();
      expect(lastWrite(writes, "requests/readmission")).toBeUndefined();
      // a fully answered form sends
      await ctl(page, "Your leave started in").selectOption("AY 2025-2026 1st Semester");
      await ctl(page, "Semester you want to return in").selectOption("AY 2026-2027 2nd Semester");
      await ctl(page, "Why you are ready to come back").fill("Spec: ready.");
      for (const item of ITEMS) await page.getByLabel(item).check();
      await submit.click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/readmission").body).toMatchObject({ target_return_term: "AY 2026-2027 2nd Semester", readmission_items: ITEMS });
    } finally {
      await context.close();
    }
  });

  test("Return from AWOL: the summary lists the three required answers", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.student.standing = "AWOL";
      d.student.enrollment_tag = "AWOL";
      d.awol_case = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), awol: [] };
      d.upcoming_semesters = ["AY 2026-2027 2nd Semester"];
      d.semester_options = ["AY 2025-2026 2nd Semester"];
    });
    try {
      await page.goto("/student/requests/awol-return");
      await expectSummaryOnSubmit(page, writes, "Submit return declaration", [
        ["Intended return semester", "Choose your intended return semester."],
        ["Written intention to resume enrollment", "Write your intention to resume enrollment."],
        ["Reason for returning and readiness to continue", "Explain why you are returning and how you are ready to continue."],
      ], { prefix: "requests/awol-return" });
    } finally {
      await context.close();
    }
  });

  test("Withdrawal: an empty reason is reported in the summary, not by the browser's own bubble", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.withdrawal_application = null;
      d.standalone_cases = { ...(d.standalone_cases || {}), withdrawal: [] };
      d.workflow_messages = [];
      d.subject_enrollments = [{
        id: 901, course_code: "SPEC-101", course_title: "Spec SPEC-101", term_label: "AY 2026-2027 1st Semester", status: "Enrolled", withdrawal_eligible: true,
        withdrawal_window: { eligible: true, deadline: "2026-11-20", status: "Withdrawal window open", term_start_date: "2026-11-07", fee_consequence: "Spec fee.", rule_source: "Spec", policy: "Spec policy." },
      }];
    });
    try {
      await page.goto("/student/requests/withdrawal");
      await expect(ctl(page, "Reason for withdrawing from this subject")).not.toHaveAttribute("required", /.*/);
      await expectSummaryOnSubmit(page, writes, "Send withdrawal request", [["Reason for withdrawing from this subject", "Explain why you are withdrawing from this subject."]], { prefix: "requests/withdrawal" });
      await ctl(page, "Reason for withdrawing from this subject").fill("Spec: schedule clash.");
      await submitButton(page, "Send withdrawal request").click();
      await expect(page.getByText("Spec: request saved.")).toBeVisible();
      expect(lastWrite(writes, "requests/withdrawal").body).toMatchObject({ reason: "Spec: schedule clash.", subject_enrollment_id: 901 });
    } finally {
      await context.close();
    }
  });

  test("Defense schedule request: a missing date is reported in the summary", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, atStage("Final Defense", [FINISHED_PROPOSAL]));
    try {
      await page.goto("/student/defense-schedule");
      await expectSummaryOnSubmit(page, writes, "Submit schedule request", [["Preferred date", "Choose the date you want for your defense."]], { prefix: "requests/defense-scheduling" });
    } finally {
      await context.close();
    }
  });

  test("Practicum MOA step: the site and the MOA file are reported in the summary", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.student.program_has_practicum = true;
      d.student.program_code = "MAPSY";
      d.practicum_eligibility = { eligible: true, status: "Verified", checklist: [], program_scope: {} };
      d.practicum_program_scope = { description: "Spec scope." };
      d.practicum_record = null;
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/practicum");
      await expectSummaryOnSubmit(page, writes, "Submit MOA stage", [
        ["Practicum site / company", "Enter the practicum site or company."],
        ["Practicum MOA PDF", "Upload the signed MOA as a PDF."],
      ], { prefix: "requests/practicum" });
    } finally {
      await context.close();
    }
  });

  test("Graduation application: the missing PDF is reported in the summary", async ({ browser }) => {
    const { context, page, writes } = await formPage(browser, (d) => {
      d.graduation_endorsement = null;
      d.graduation_eligibility = { eligible: true, status: "Eligible", missing_coursework: [], missing_research_requirements: [] };
      d.graduation_review_windows = ["2026-2027"];
      d.graduation_default_review_window = "2026-2027";
      d.workflow_messages = [];
    });
    try {
      await page.goto("/student/graduation");
      await expectSummaryOnSubmit(page, writes, "Submit graduation application", [["Signed graduation application / review-window PDF", "Upload your signed graduation application as a PDF."]], { prefix: "requests/graduation", focusTarget: (p) => p.locator('input[type="file"]').first() });
    } finally {
      await context.close();
    }
  });
});
