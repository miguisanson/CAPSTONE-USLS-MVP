// Packet P3.2 (Phase 5 design system, dean stream): pins what the Dean's pages DO that the sweep only photographs, so the
// restyle of DeanPages.jsx, DeanLeaveParts.jsx and DeanContext.jsx onto the component library cannot change it.
// Written against the old code; it must pass on both. Through the real UI, as the Dean:
//   - the dashboard: the key numbers go where they went, "Needs your action" lists the cases with a Review link and the
//     course plan with a link to the plan page, Recent decisions has its View all link (reshaped in P7.2, see below);
//   - the approvals queue: every process section with its count, the search / program / status / date filters and
//     "Clear filters", the course-plan row and the Adviser Designation section;
//   - the course-adjustments page: the plan card with its subject table, "Return for revision" without a note shows the
//     server's error banner, with a note it returns the plan, shows the server's message and moves the plan to "Recent
//     decisions";
//   - unknown routes: /approvals/leave, /approvals/<nothing> and a case that does not exist;
//   - the Leave of Absence case card (Maureen Castillo): the plain-language summary (timeline, facts, checklist, policy
//     check chips, standing bars, earlier cases), then Approve (needs no comment, confirms, read-only afterwards);
//   - a denied Leave of Absence (Daniel Fernandez): Deny needs a comment, then the card shows the "was denied" note;
//   - a readmission with an early return (Gabriel Domingo): the early-return note, the ticks and the policy chips.
// Setup (the requests reaching the Dean) goes through each role's own API login, like p31-dean.spec.js. It changes data in
// the throwaway harness database and touches only the demo students Maureen Castillo, Daniel Fernandez and Gabriel
// Domingo (no other spec uses them) and the Master of Science in Computer Science course-offering plan.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = join(SCREENS_DIR, "..", "p32-dean");
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

const TERM = "AY 2026-2027 2nd Semester";
const TERM_AFTER = "AY 2027-2028 1st Semester";
const CHECKLIST = [
  "Structured return intention completed",
  "Updated study plan confirmed",
  "Program or adviser consultation completed",
  "No pending accountability confirmed",
];

/** Put three leave cases and one course-offering plan in front of the Dean. */
async function putWorkInFrontOfTheDean(playwright) {
  const reset = await apiAs(playwright, "staff@usls.edu.ph"); // the reset needs a signed-in session (I-055)
  for (const key of ["leave-of-absence-maureen", "leave-of-absence-daniel", "readmission-gabriel"]) {
    await okJson(await reset.post(`/api/auth/demo-students/${key}/reset`, { data: {} }), `reset ${key}`);
  }
  await reset.dispose();

  const staff = await apiAs(playwright, "staff@usls.edu.ph");
  const forward = async (caseId) =>
    okJson(await staff.post(`/api/leave-cases/${caseId}/transition`, { data: { action: "forward", eligibility_result: "Eligible" } }), `forward case ${caseId}`);

  const maureen = await apiAs(playwright, "maureen.castillo@student.usls.edu.ph");
  const loa = await okJson(
    await maureen.post("/api/student-portal/requests/leave-of-absence", {
      data: { effective_start: TERM, effective_end: TERM, reason_category: "Medical / health", reason_remarks: "Surgery and recovery." },
    }),
    "Maureen files a leave",
  );
  await forward(loa.case_id);

  const daniel = await apiAs(playwright, "loa.daniel@usls.edu.ph");
  const loa2 = await okJson(
    await daniel.post("/api/student-portal/requests/leave-of-absence", {
      data: { effective_start: TERM, effective_end: TERM_AFTER, reason_category: "Family emergency", reason_remarks: "Caring for a family member." },
    }),
    "Daniel files a leave",
  );
  await forward(loa2.case_id);

  const gabriel = await apiAs(playwright, "readmission.gabriel@usls.edu.ph");
  const back = await okJson(
    await gabriel.post("/api/student-portal/requests/readmission", {
      data: { target_return_term: TERM, return_intent: "Ready to come back early.", readmission_items: CHECKLIST },
    }),
    "Gabriel files a readmission",
  );
  await forward(back.case_id);

  // The course-offering plan: the Academic Coordinator saves a draft and submits it (a re-run on the same database
  // finds it already submitted, which is fine).
  const coordinator = await apiAs(playwright, "academic@usls.edu.ph");
  const plan = { program_id: 1, term_label: TERM };
  await coordinator.post("/api/course-adjustments/plan", { data: { ...plan, action: "draft" } });
  await coordinator.post("/api/course-adjustments/plan", { data: { ...plan, action: "submit" } });

  await Promise.all([staff.dispose(), maureen.dispose(), daniel.dispose(), gabriel.dispose(), coordinator.dispose()]);
  return { loaId: loa.case_id, loa2Id: loa2.case_id, readmissionId: back.case_id };
}

/** Text colour + background of an element, to compare chip tones without hard-coding the palette. */
const look = (locator) =>
  locator.evaluate((el) => {
    const css = getComputedStyle(el);
    return `${css.color}|${css.backgroundColor}`;
  });

/** No sideways page scroll (IM15). */
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const caseRow = (page, name) => page.getByRole("row").filter({ hasText: name });

test.describe.configure({ mode: "serial" });

test.describe("P3.2 Dean pages", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });
  let ids;

  test.beforeAll(async ({ playwright }) => {
    mkdirSync(SHOTS, { recursive: true });
    ids = await putWorkInFrontOfTheDean(playwright);
  });

  // P7.2 (IM19): the Dean home became action first (see e2e/p72-dean-faculty-home.spec.js). What changed in this test, and
  // why, is listed in the commit message of the packet. Everything that still exists is pinned here as before.
  test("dashboard: key numbers and their links, the waiting decisions with a Review link each, the plan row, recent decisions", async ({ page }) => {
    await page.goto("/dean");
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome, / })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /Open approvals queue/ })).toHaveAttribute("href", "/dean/approvals");

    // The headline number: how many decisions wait and how long the oldest has.
    const waiting = page.getByRole("main").getByRole("link", { name: /Decisions waiting/ });
    await expect(waiting).toHaveAttribute("href", "/dean/approvals");
    const total = Number((await waiting.innerText()).match(/Decisions waiting\s+(\d+)/i)?.[1]);
    expect(total, "Maureen, Daniel, Gabriel and the plan are waiting").toBeGreaterThanOrEqual(4);
    await expect(page.getByRole("main").getByRole("link", { name: /Oldest wait/ })).toContainText(/(Today|\d+ days?)/);
    await expect(page.getByRole("main").getByRole("link", { name: /Waiting over 7 days/ })).toHaveAttribute("href", "/dean/approvals");
    await expect(page.getByRole("main").getByRole("link", { name: /Decided this week/ })).toHaveAttribute("href", "/dean/activity");

    // Needs your action: the oldest decisions first, each with a Review link to its case.
    const mine = page.locator("main section", { has: page.getByRole("heading", { name: "Needs your action", exact: true }) });
    await expect(mine).toBeVisible();
    for (const [name, type] of [["Maureen Castillo", "leave-of-absence"], ["Daniel Fernandez", "leave-of-absence"], ["Gabriel Domingo", "readmission"]]) {
      const row = mine.getByRole("listitem").filter({ hasText: name }).first();
      await expect(row, `${name} in Needs your action`).toBeVisible();
      await expect(row.getByRole("link", { name: "Review" })).toHaveAttribute("href", new RegExp(`^/dean/case/${type}/\\d+$`));
    }
    await expect(mine.getByRole("listitem").filter({ hasText: "Maureen Castillo" }).first()).toContainText("Leave of Absence");

    // The course offering plan is a row of its own and opens the plan page.
    const planRow = mine.getByRole("listitem").filter({ hasText: /Course offerings/ }).first();
    await expect(planRow).toBeVisible();
    await expect(planRow.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/dean/approvals/course-adjustments");

    // Recent decisions and its View all link.
    const recent = page.locator("main section", { has: page.getByRole("heading", { name: "Recent decisions", exact: true }) });
    await expect(recent).toBeVisible();
    await expect(recent.getByRole("link", { name: "View all", exact: true })).toHaveAttribute("href", "/dean/activity");

    await page.screenshot({ path: join(SHOTS, "dashboard-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome, / })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await page.screenshot({ path: join(SHOTS, "dashboard-390.png"), fullPage: true });
  });

  test("approvals queue: sections, counts, filters and Clear, plan row, Adviser Designation", async ({ page }) => {
    await page.goto("/dean/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();
    await expect(page.getByText(/^\d+ waiting$/).first()).toBeVisible();

    // Every process has its section with a count and an "Open ..." link.
    const sections = {
      "Course Adjustments": "course-adjustments",
      "Leave of Absence": "leave-of-absence",
      Readmission: "readmission",
      "AWOL & Residency": "awol",
      "Withdrawal Requests": "withdrawal",
      "Practicum Reports": "practicum",
      "Graduation Endorsement": "graduation",
    };
    for (const [label, key] of Object.entries(sections)) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${label}\\s*\\d+$`) }), `${label} section`).toBeVisible();
      await expect(page.getByRole("link", { name: `Open ${label}` }), `Open ${label}`).toHaveAttribute("href", `/dean/approvals/${key}`);
    }
    const leaveHeading = await page.getByRole("heading", { level: 2, name: /^Leave of Absence\s*\d+$/ }).innerText();
    expect(Number(leaveHeading.match(/(\d+)$/)[1]), "two leave requests wait").toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("heading", { level: 2, name: /^Adviser Designation\s*\d+$/ })).toBeVisible();

    // The course-plan row: what it is, how old, and a Review link to the plan page.
    const planRow = page.getByRole("listitem").filter({ hasText: /Course offerings · / });
    await expect(planRow.first()).toContainText(TERM);
    await expect(planRow.first()).toContainText(/subject\(s\) proposed · submitted/);
    await expect(planRow.first().getByText("today")).toBeVisible();
    await expect(planRow.first().getByRole("link", { name: "Review" })).toHaveAttribute("href", "/dean/approvals/course-adjustments");

    // Filters: search narrows, Clear brings everything back.
    const search = page.getByRole("searchbox", { name: "Search Dean review lists" });
    await search.fill("maureen");
    await expect(caseRow(page, "Maureen Castillo").first()).toBeVisible();
    await expect(caseRow(page, "Daniel Fernandez")).toHaveCount(0);
    await expect(caseRow(page, "Gabriel Domingo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear 1 filter" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^Leave of Absence\s*1$/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear 1 filter" }).click();
    await expect(search).toHaveValue("");
    await expect(caseRow(page, "Daniel Fernandez").first()).toBeVisible();

    // Program and status selects list what the cases have.
    const program = page.getByLabel("Filter Dean list by program");
    await expect(program.locator("option", { hasText: "MAED" })).toHaveCount(1);
    await program.selectOption("MAED");
    await expect(caseRow(page, "Maureen Castillo").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear 1 filter" })).toBeVisible();
    const status = page.getByLabel("Filter Dean list by stage or status");
    await expect(status.locator("option", { hasText: "Dean Review" }).first()).toHaveCount(1);
    await status.selectOption("Dean Review");
    await expect(page.getByRole("button", { name: "Clear 2 filters" })).toBeVisible();
    await expect(caseRow(page, "Gabriel Domingo").first()).toBeVisible();
    await page.getByRole("button", { name: "Clear 2 filters" }).click();

    // A date range in the far future matches nothing: every section shows its empty state.
    await page.getByLabel("Updated from").fill("2099-01-01");
    await expect(caseRow(page, "Maureen Castillo")).toHaveCount(0);
    await expect(page.getByText("Nothing waiting").first()).toBeVisible();
    await expect(page.getByText("No request of this kind needs a Dean decision right now.").first()).toBeVisible();
    await page.getByRole("button", { name: "Clear 1 filter" }).click();
    await expect(caseRow(page, "Maureen Castillo").first()).toBeVisible();

    // Sort by student name: Daniel comes before Gabriel before Maureen in Leave/Readmission order.
    await page.getByLabel("Sort").selectOption("student");
    const leaveSection = page.getByRole("heading", { level: 2, name: /^Leave of Absence\s*\d+$/ }).locator("xpath=ancestor::*[contains(@class,'card')][1]");
    const names = await leaveSection.getByRole("row").allInnerTexts();
    const order = ["Daniel Fernandez", "Maureen Castillo"].map((name) => names.findIndex((text) => text.includes(name)));
    expect(order[0], "Daniel row found").toBeGreaterThan(-1);
    expect(order[0], "Daniel sorts before Maureen").toBeLessThan(order[1]);

    await page.screenshot({ path: join(SHOTS, "queue-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dean/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await page.screenshot({ path: join(SHOTS, "queue-390.png"), fullPage: true });
  });

  test("course adjustments: plan card, subject table, a return needs a note and moves the plan to Recent decisions", async ({ page }) => {
    const decideCalls = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/approvals\/\d+\/decide$/.test(request.url())) decideCalls.push(request.postDataJSON());
    });
    await page.goto("/dean/approvals/course-adjustments");
    await expect(page.getByRole("heading", { level: 1, name: "Course Adjustments" })).toBeVisible();
    await expect(page.getByText(/^\d+ waiting$/).first()).toBeVisible();
    await expect(page.getByText("Course offering plans submitted by the Academic Coordinator. Approve them or return them for revision.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "All approvals" })).toHaveAttribute("href", "/dean/approvals");

    const plan = page.getByRole("heading", { level: 2, name: /^Course offerings · / }).first();
    await expect(plan).toBeVisible();
    const card = plan.locator("xpath=ancestor::*[contains(@class,'card')][1]");
    await expect(card).toContainText(TERM);
    await expect(card).toContainText(/\d+ subject\(s\) proposed · submitted/);
    await expect(card.getByText("Submitted", { exact: true }).first()).toBeVisible();

    // The subject table: four columns, one row per offering, each with its status chip.
    for (const header of ["Subject", "Demand", "Sections", "Decision"]) {
      await expect(card.getByRole("columnheader", { name: header }), header).toBeVisible();
    }
    const rows = card.getByRole("row");
    expect(await rows.count(), "header row plus at least one subject").toBeGreaterThan(1);
    const first = rows.nth(1);
    await expect(first).toContainText(/[A-Z]+-[A-Z]+\d+/);
    await expect(first).toContainText(/Suggested|Offered|Not Offered/);

    // Return for revision without a note: the server refuses, its message is shown, the plan stays.
    const note = card.getByRole("textbox", { name: /Optional decision note for / });
    await expect(note).toHaveAttribute("placeholder", "Optional note to the Graduate School…");
    await card.getByRole("button", { name: "Approve" }).waitFor();
    await card.getByRole("button", { name: "Return for revision" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a comment explaining what to revise before returning the plan." })).toBeVisible();
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]).toMatchObject({ decision: "return", note: "" });
    await expect(plan).toBeVisible();
    await expect(card.getByRole("button", { name: "Return for revision" })).toBeEnabled();
    await page.screenshot({ path: join(SHOTS, "plan-error-1366.png"), fullPage: true });

    // With a note it goes back to the Academic Coordinator; the server's message shows; the plan is under Recent decisions.
    await note.fill("Please add a second section for the high-demand subjects.");
    await card.getByRole("button", { name: "Return for revision" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Offering plan returned by Dean for revision" })).toBeVisible();
    expect(decideCalls).toHaveLength(2);
    expect(decideCalls[1]).toMatchObject({ decision: "return", note: "Please add a second section for the high-demand subjects." });
    await expect(page.getByRole("heading", { level: 2, name: /^Course offerings · / })).toHaveCount(0);
    await expect(page.getByText("No course offering plans waiting")).toBeVisible();
    await expect(page.getByText("Plans the Academic Coordinator submits for approval appear here.")).toBeVisible();
    const recent = page.getByRole("listitem").filter({ hasText: TERM });
    await expect(recent.first()).toContainText("Returned");
    await expect(page.getByText("Recent decisions", { exact: true })).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "plan-returned-1366.png"), fullPage: true });

    // Moving to another page clears the banners (they belong to the page where the action happened).
    await page.getByRole("main").getByRole("link", { name: "All approvals" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Offering plan returned" })).toHaveCount(0);
  });

  test("odd routes: /approvals/leave redirects, an unknown process goes to the queue, a missing case says so, practicum page", async ({ page }) => {
    await page.goto("/dean/approvals/leave");
    await expect(page).toHaveURL(/\/dean\/approvals\/leave-of-absence$/);
    await expect(page.getByText("Maureen Castillo").first()).toBeVisible();

    await page.goto("/dean/approvals/not-a-process");
    await expect(page).toHaveURL(/\/dean\/approvals$/);
    await expect(page.getByRole("heading", { level: 1, name: "Approvals Queue" })).toBeVisible();

    await page.goto("/dean/case/leave-of-absence/999999");
    await expect(page.getByRole("heading", { level: 1, name: "Case not found" })).toBeVisible();
    await expect(page.getByText("This request is no longer in your approvals lists. It may already have been decided.")).toBeVisible();
    await expect(page.getByText("Nothing to show")).toBeVisible();
    await expect(page.getByText("Go back to the approvals queue to see what is still waiting.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Approvals queue" })).toHaveAttribute("href", "/dean/approvals");
    await page.screenshot({ path: join(SHOTS, "case-not-found-1366.png"), fullPage: true });

    // The practicum page: header, filters, the waiting list (what is in it depends on the other specs).
    await page.goto("/dean/approvals/practicum");
    await expect(page.getByRole("heading", { level: 1, name: "Practicum Reports" })).toBeVisible();
    await expect(page.getByText("Practicum completion reports sent to the Dean for final review.")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search Dean review lists" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting for your decision" })).toBeVisible();
    await expect(page.getByText("Open a case to review it and decide")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "All approvals" })).toHaveAttribute("href", "/dean/approvals");
    await page.screenshot({ path: join(SHOTS, "practicum-1366.png"), fullPage: true });
  });

  test("Leave of Absence card: the plain summary, then Approve confirms and the card turns read-only", async ({ page }) => {
    const decideCalls = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/approvals\/workflow\/leave-of-absence\/\d+\/decide$/.test(request.url())) decideCalls.push(request.postDataJSON());
    });
    await page.goto("/dean/approvals");
    await page.getByRole("searchbox", { name: "Search Dean review lists" }).fill("Maureen");
    await caseRow(page, "Maureen Castillo").first().getByRole("link", { name: /^Review / }).click();
    await expect(page).toHaveURL(/\/dean\/case\/leave-of-absence\/\d+$/);
    expect(page.url()).toMatch(new RegExp(`/${ids.loaId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Maureen Castillo");
    await expect(page.getByRole("main").getByRole("link", { name: "Back to list" })).toHaveAttribute("href", "/dean/approvals/leave-of-absence");

    // Where the request is.
    await expect(page.getByRole("region", { name: "Where this request is" }).getByRole("listitem")).toHaveCount(6);
    await expect(page.getByText("Dean decision").first()).toBeVisible();

    // What is being asked: facts as term / definition pairs.
    const facts = page.getByRole("heading", { name: "What is being asked" }).locator("xpath=ancestor::section[1]");
    await expect(facts.getByText("Request", { exact: true })).toBeVisible();
    await expect(facts).toContainText(/Leave of Absence · Case #\d+ · /);
    await expect(facts.getByText("Leave period", { exact: true })).toBeVisible();
    await expect(facts).toContainText(TERM);
    await expect(facts).toContainText("1 semester");
    await expect(facts.getByText("Reason", { exact: true })).toBeVisible();
    await expect(facts).toContainText("Medical / health");
    await expect(facts.getByText("Reason in the student's words")).toBeVisible();
    await expect(facts).toContainText("Surgery and recovery.");
    await expect(facts.locator("dt")).toHaveCount(4);

    // Checklist panel: a leave has none; staff result and notes.
    const checklist = page.getByRole("heading", { name: "Checklist", exact: true }).locator("xpath=ancestor::section[1]");
    await expect(checklist).toContainText("No checklist was needed for this request.");
    await expect(checklist.getByText("Staff eligibility result")).toBeVisible();
    await expect(checklist).toContainText("Eligible");
    await expect(checklist).toContainText("No notes from staff.");

    // Policy check: each rule with its chip; the chip tones agree (green = Pass / Provided, amber = Needs Review).
    const policy = page.getByRole("heading", { name: "Policy check" }).locator("xpath=ancestor::section[1]");
    const policyRow = (label) => policy.getByRole("listitem").filter({ hasText: label });
    const chip = (label, word) => policyRow(label).getByText(word, { exact: true });
    await expect(chip("Allowed reason category", "Pass")).toBeVisible();
    await expect(chip("Effective period", "Pass")).toBeVisible();
    await expect(chip("Structured application source", "Provided")).toBeVisible();
    await expect(chip("Reason for leave", "Provided")).toBeVisible();
    await expect(chip("Minimum residency", "Needs Review")).toBeVisible();
    await expect(policyRow("Allowed reason category")).toContainText("Medical / health");
    const pass = await look(chip("Allowed reason category", "Pass"));
    expect(await look(chip("Structured application source", "Provided")), "Provided looks like Pass").toBe(pass);
    expect(await look(chip("Minimum residency", "Needs Review")), "Needs Review is not green").not.toBe(pass);
    await expect(policy.getByText(/^Suggested: /)).toBeVisible();
    await expect(policy.getByText("Advice only - you decide")).toBeVisible();

    // Student standing: two bars with their words, and the program level.
    const standing = page.getByRole("heading", { name: "Student standing" }).locator("xpath=ancestor::section[1]");
    await expect(standing.getByRole("img", { name: /^Years in the program: \d+ of \d+$/ })).toBeVisible();
    await expect(standing.getByRole("img", { name: "Leave already approved: 0 of 4" })).toBeVisible();
    await expect(standing).toContainText(/\d+ years? so far · normal \d+ · most allowed \d+/);
    await expect(standing).toContainText("0 of 4 semesters");
    await expect(standing).toContainText("level");
    await expect(page.getByRole("heading", { name: "Earlier cases of this student" }).locator("xpath=ancestor::section[1]")).toContainText("No earlier leave or readmission cases.");
    await expect(page.getByRole("heading", { name: "Comments on earlier decisions" })).toHaveCount(0);
    await expect(page.getByRole("note")).toHaveCount(0);
    await page.screenshot({ path: join(SHOTS, "loa-case-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Policy check" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await page.screenshot({ path: join(SHOTS, "loa-case-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });

    // Approve: no comment needed; a window titled after the button; confirming sends it and returns to the list.
    const approve = page.getByRole("button", { name: "Approve", exact: true });
    await approve.scrollIntoViewIfNeeded();
    await approve.click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Approve");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dean\/approvals\/leave-of-absence$/);
    await expect(page.getByRole("status").filter({ hasText: /approved|Approved/ }).first()).toBeVisible();
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]).toMatchObject({ decision: "approve" });

    // The card is read-only now and the history has the decision.
    await page.goto(`/dean/case/leave-of-absence/${ids.loaId}`);
    await expect(page.getByText("Read only. This request is not waiting for a Dean decision.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /View logs/ }).click();
    await expect(page.getByRole("button", { name: /Hide logs/ })).toBeVisible();
    await expect(page.getByText(/approved by Dean/i).first()).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "loa-case-decided-1366.png"), fullPage: true });
  });

  test("a denied Leave of Absence: Deny needs a comment, then the card says it was denied", async ({ page }) => {
    const decideCalls = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/approvals\/workflow\/leave-of-absence\/\d+\/decide$/.test(request.url())) decideCalls.push(request.postDataJSON());
    });
    await page.goto(`/dean/case/leave-of-absence/${ids.loa2Id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Daniel Fernandez");
    await expect(page.getByRole("heading", { name: "What is being asked" }).locator("xpath=ancestor::section[1]")).toContainText("Family emergency");

    const deny = page.getByRole("button", { name: "Deny", exact: true });
    await deny.scrollIntoViewIfNeeded();
    await deny.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /comment|reason/i }).first()).toBeVisible();
    expect(decideCalls, "nothing was sent without a comment").toEqual([]);

    const reason = "The semester is too far ahead; file again nearer the start date.";
    await page.getByLabel("Your comment").first().fill(reason);
    await deny.click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Deny request");
    await expect(dialog).toContainText(reason);
    await dialog.getByRole("button", { name: "Deny request" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dean\/approvals\/leave-of-absence$/);
    await expect(page.getByRole("status").first()).toBeVisible();
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]).toMatchObject({ decision: "deny" });
    expect(decideCalls[0].note).toContain(reason);

    await page.goto(`/dean/case/leave-of-absence/${ids.loa2Id}`);
    await expect(page.getByText(/This request was denied\. Follow-up owner: .+ Staff follow up with the student\./)).toBeVisible();
    await expect(page.getByText("Read only. This request is not waiting for a Dean decision.")).toBeVisible();
    // The Dean's remark and the comment show under "Comments on earlier decisions".
    const comments = page.getByRole("heading", { name: "Comments on earlier decisions" }).locator("xpath=ancestor::section[1]");
    await expect(comments).toContainText(reason);
    await page.screenshot({ path: join(SHOTS, "loa-case-denied-1366.png"), fullPage: true });
  });

  test("readmission with an early return: the note, the ticks, the leave being ended and the amber chips", async ({ page }) => {
    await page.goto(`/dean/case/readmission/${ids.readmissionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gabriel Domingo");

    // The early-return note is announced as a note, not an alert.
    const note = page.getByRole("note");
    await expect(note).toHaveCount(1);
    await expect(note).toContainText("Early return. The student asks to come back before the approved leave ends. You decide whether the leave ends early.");

    const facts = page.getByRole("heading", { name: "What is being asked" }).locator("xpath=ancestor::section[1]");
    await expect(facts).toContainText(/Readmission · Case #\d+ · /);
    await expect(facts.getByText("Return semester", { exact: true })).toBeVisible();
    await expect(facts).toContainText(TERM);
    await expect(facts.getByText("Leave being ended")).toBeVisible();
    await expect(facts).toContainText(/Leave of Absence · AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester/);
    await expect(facts.getByText("What the student intends to do")).toBeVisible();
    await expect(facts).toContainText("Ready to come back early.");

    // The checklist: four items, ticked by the student, not yet verified by staff.
    const checklist = page.getByRole("heading", { name: "Checklist", exact: true }).locator("xpath=ancestor::section[1]");
    for (const item of CHECKLIST) await expect(checklist).toContainText(item);
    await expect(checklist.getByText("Student ticked")).toHaveCount(4);
    await expect(checklist.getByText("Staff not verified")).toHaveCount(4);
    const ticked = await look(checklist.getByText("Student ticked").first());
    expect(await look(checklist.getByText("Staff not verified").first()), "a missing tick is greyed").not.toBe(ticked);

    // The policy chips: Pass/Provided green, the two Needs Review amber.
    const policy = page.getByRole("heading", { name: "Policy check" }).locator("xpath=ancestor::section[1]");
    const row = (label) => policy.getByRole("listitem").filter({ hasText: label });
    await expect(row("Return semester after the leave").getByText("Needs Review", { exact: true })).toBeVisible();
    await expect(row("Checklist verified by staff").getByText("Needs Review", { exact: true })).toBeVisible();
    await expect(row("Required return documents").getByText("Pass", { exact: true })).toBeVisible();
    await expect(row("Readmission application/reference").getByText("Provided", { exact: true })).toBeVisible();
    expect(await look(row("Return semester after the leave").getByText("Needs Review", { exact: true }))).toBe(
      await look(row("Checklist verified by staff").getByText("Needs Review", { exact: true })),
    );
    expect(await look(row("Required return documents").getByText("Pass", { exact: true }))).not.toBe(
      await look(row("Checklist verified by staff").getByText("Needs Review", { exact: true })),
    );

    // The earlier leave of this student is listed with its decision date.
    const earlier = page.getByRole("heading", { name: "Earlier cases of this student" }).locator("xpath=ancestor::section[1]");
    await expect(earlier).toContainText(/Leave of Absence · AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester/);
    await expect(earlier).toContainText(/Decided /);
    await page.screenshot({ path: join(SHOTS, "readmission-early-1366.png"), fullPage: true });
  });
});
