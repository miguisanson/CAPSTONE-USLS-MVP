// Packet P2.4 (Phase 5, UI-SPEC section 8): the shared parts that appear on many pages -- the Subject-needs report
// (Course Adjustments), the Handoff import result, "Rules applied on this screen", the assistant's sources, the case
// discussion thread, and the defense scheduling parts (availability request panel, slot check, calendar page and its
// private-link card). Pins what each shows and does BEFORE it is moved onto the component library (DataTable, StatCard,
// HistoryPanel, StatusChip, Modal, InlineNotice). Written first and green on the old markup; it must stay green after
// the restyle, except the lines marked CHANGED BY P87 (named in the commit that changes them).
//
// Every part is reached through the real UI as the role that sees it. Nothing is saved: where a state is not in the seed the
// page's GET (or the read-only POST it makes on its own) is answered with a fixed body through page.route, so the spec does
// not depend on the shared database (e2e/README.md "Specs share one database"). The only POSTs are the ones the page makes
// to import / ask / check; the import and the assistant answer are mocked, the others are never clicked.
// Screenshots go to E2E_SHOTS_DIR (default e2e-artifacts/p87) at 1366 and 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p87");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const VIEWS = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
];

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p87", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

const main = (page) => page.locator("main");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const sidebarLink = (page, name) => page.locator("aside nav").getByRole("link", { name });

/** Screenshot at 1366 and 390 (full page), check nothing scrolls sideways, then back to 1366. */
async function shotAll(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  for (const view of VIEWS) {
    await page.setViewportSize(view);
    await page.waitForTimeout(300);
    expect(await noOverflow(page), `${name} scrolls sideways at ${view.width}px`).toBe(true);
    await page.screenshot({ path: join(SHOTS, `${name}-${view.width}.png`), fullPage: true });
  }
  await page.setViewportSize(VIEWS[0]);
  await page.waitForTimeout(200);
}

/** Answer the page's GET of `pattern` with a fixed body. Any other method goes on to the real server. */
async function mockGet(page, pattern, json) {
  await page.route(pattern, (route) => (route.request().method() === "GET" ? route.fulfill({ json }) : route.fallback()));
}
/** Answer the page's GET with the REAL response after `change(body)` edited it. */
async function editGet(page, pattern, change) {
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: change(body) ?? body });
  });
}

// ===================================================================================================================
// Subject-needs report (Course Adjustments)
// ===================================================================================================================
const student = (id, name, no, year, due, reason = "Not taken") => ({ id, name, student_number: no, course_year_label: year, due_next: due, reason });
const REPORT = {
  program: { id: 1, code: "MAED", name: "Master of Arts in Education" },
  term: { id: 1, label: "AY 2026-2027 First Semester" },
  generated_at: "2026-10-22T08:00:00",
  summary: { students_reviewed: 12, subjects_with_need: 2, student_subject_needs: 4, subjects_not_taken: 3 },
  rows: [
    {
      course: { id: 901, code: "SPEC 101", title: "Spec Research Methods", units: 3, category: "Core", recommended_term: "1st Year, 1st Sem" },
      need_count: 3, not_taken_count: 4, retake_count: 1,
      students: [
        student(1, "Ana Spec", "SP-001", "1st Year", true),
        student(2, "Ben Spec", "SP-002", "1st Year", true, "Failed"),
        student(3, "Cora Spec", "SP-003", "1st Year", true),
        student(4, "Dan Spec", "SP-004", "2nd Year", false),
      ],
    },
    {
      course: { id: 902, code: "SPEC 102", title: "Spec Seminar", units: 1, category: "Core", recommended_term: "1st Year, 2nd Sem" },
      need_count: 1, not_taken_count: 1, retake_count: 0,
      students: [student(5, "Eva Spec", "SP-005", "1st Year", true)],
    },
    {
      course: { id: 903, code: "SPEC 201", title: "Spec Thesis Writing", units: 3, category: "Research", recommended_term: "2nd Year, 1st Sem" },
      need_count: 0, not_taken_count: 2, retake_count: 0,
      students: [student(6, "Finn Spec", "SP-006", "2nd Year", false), student(7, "Gina Spec", "SP-007", "2nd Year", false)],
    },
  ],
};

/** The plan's own demand rows for the report's subjects, so the one subjects table and the report agree (I-117). */
function demandFor(report, { zero = false } = {}) {
  return report.rows.map((row) => {
    const due = zero ? [] : row.students.filter((s) => s.due_next);
    const delayed = row.course.id === 901 && !zero ? 1 : 0;
    return {
      course: { id: row.course.id, code: row.course.code, title: row.course.title, category: row.course.category },
      demand_count: zero ? 0 : row.need_count,
      student_sample: [],
      affected_students: due.map((s, i) => ({ id: s.id, name: s.name, student_number: s.student_number, impact_basis: "Next semester", will_be_delayed: delayed > 0 && i === 0 })),
      affected_count: due.length,
      delayed_count: delayed,
      suggested_sections: 1,
      availability_count: 0,
      faculty_candidates: [],
      priority: "Manual",
      recommendation: "",
      demand_status: zero ? "no_demand" : "meets_minimum",
      offering_status: zero ? null : "Suggested",
      section_count: 1,
      offering_notes: "",
      assigned_faculty_id: null,
      assigned_faculty_name: null,
      assignment_status: "Unassigned",
      selection_source: zero ? "Manual" : "Demand",
    };
  });
}

async function openSubjectNeeds(page, { report = REPORT, zero = false } = {}) {
  await mockGet(page, /\/api\/course-adjustments\/subject-needs-report/, report);
  await editGet(page, /\/api\/course-adjustments(\?.*)?$/, (body) => ({ ...body, demand: demandFor(REPORT, { zero }) }));
  await page.goto("/");
  await sidebarLink(page, /Course Adjustments$/).click();
  await expect(page).toHaveURL(/\/course-adjustments/);
  const card = main(page).locator(".card", { has: page.getByRole("heading", { level: 2, name: "Course offering decisions" }) });
  await expect(card).toBeVisible();
  return { card, table: card.getByRole("table", { name: "Course offering decisions" }) };
}
const subjectRow = (table, code) => table.locator("tbody tr").filter({ has: table.page().getByRole("button", { name: `Details for ${code}` }) });

// I-117: the report is no longer a second list of the same subjects. Its figures, search, filter, CSV and students live
// in the one Course offering decisions card (a table row per subject, the students in the row's Details drawer).
test.describe("Subject needs in the Course offering decisions card (staff, Course Adjustments)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("program line, four figures, the two meanings and the download", async ({ page }) => {
    test.setTimeout(120_000);
    const { card } = await openSubjectNeeds(page);
    await expect(card).toContainText("MAED");
    await expect(card).toContainText("Master of Arts in Education");
    await expect(card).toContainText("planning for ");
    await expect(card).toContainText("generated ");
    // the two meanings
    await expect(card.getByText("Needing next term:", { exact: false }).first()).toBeVisible(); // CHANGED BY I-117: was "Needing next term." (a sentence in its own box)
    await expect(card.getByText("Not taken yet:", { exact: false }).first()).toBeVisible(); // CHANGED BY I-117: was "Not taken yet."
    // the four figures, as one line (CHANGED BY I-117: were four tiles, label then number)
    await expect(card.getByText("12 students reviewed · 2 subjects needed next term · 4 student seats needed · 3 subjects with a backlog")).toBeVisible();
    // the CSV: one line per student per subject, with a header
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: "Download CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("maed-subject-needs.csv");
    const text = readFileSync(await file.path(), "utf8").replace(/^﻿/, "");
    const lines = text.split("\r\n");
    expect(lines[0]).toContain('"Program","Subject code","Subject title","Units"');
    expect(lines).toHaveLength(1 + 7);
    expect(text).toContain('"SP-002","Ben Spec","1st Year","Yes","Failed (retake)"');
    await shotAll(page, "subject-needs");
  });

  test("one row per subject, due first; the later subjects are a filter; a row's students are behind Details and its scope tabs", async ({ page }) => {
    test.setTimeout(120_000);
    const { card, table } = await openSubjectNeeds(page);
    // every subject once, the ones needed next term first
    await expect(table.locator("tbody tr")).toHaveCount(3);
    const order = await table.locator("tbody tr td:first-child p:first-child").allTextContents();
    expect(order).toEqual(["SPEC 101", "SPEC 102", "SPEC 201"]);
    // the filter (CHANGED BY I-117: was a "Later in the curriculum" toggle with aria-expanded; now aria-pressed pills)
    const all = card.getByRole("button", { name: "All subjects (3)" });
    const due = card.getByRole("button", { name: "Needed next term (2)" });
    const later = card.getByRole("button", { name: "Later in the curriculum (1)" });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await due.click();
    await expect(due).toHaveAttribute("aria-pressed", "true");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(subjectRow(table, "SPEC 201")).toHaveCount(0);
    await later.click();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(subjectRow(table, "SPEC 201")).toBeVisible();
    await all.click();

    // a row: counts (CHANGED BY I-117: "Needing next" and "Not taken yet" are table columns, the retakes sit in the first)
    const row = subjectRow(table, "SPEC 101");
    await expect(row.locator("td").nth(1)).toHaveText(/^\s*3\s*1 retake$/);
    await expect(row.locator("td").nth(2)).toHaveText("4");
    await expect(card.getByRole("button", { name: "Show students" })).toHaveCount(0); // CHANGED BY I-117: the students are in Details
    await row.getByRole("button", { name: "Details for SPEC 101" }).click();
    const drawer = page.getByRole("dialog", { name: /SPEC 101/ });
    await expect(drawer).toContainText("3 students need it next term");
    await expect(drawer).toContainText("4 not taken yet");
    await expect(drawer).toContainText("1 delayed if withheld");
    const duePill = drawer.getByRole("button", { name: "Needing next term (3)" });
    const everyone = drawer.getByRole("button", { name: "All who have not taken it (4)" });
    await expect(duePill).toHaveAttribute("aria-pressed", "true");
    await expect(everyone).toHaveAttribute("aria-pressed", "false");
    // default scope: only the students due next term
    await expect(drawer.getByText("Ana Spec")).toBeVisible();
    await expect(drawer.getByText("Ana Spec").locator("xpath=ancestor::li[1]")).toContainText("delayed if not offered");
    await expect(drawer.getByText("Ben Spec").locator("xpath=ancestor::li[1]")).toContainText("Failed · retake");
    await expect(drawer.getByText("Cora Spec")).toBeVisible();
    await expect(drawer.getByText("Dan Spec")).toHaveCount(0);
    await everyone.click();
    await expect(everyone).toHaveAttribute("aria-pressed", "true");
    await expect(drawer.getByText("Dan Spec").locator("xpath=ancestor::li[1]")).toContainText("Later");
    await shotAll(page, "subject-needs-open");
  });

  test("search narrows the subjects (and names the student it matched); no match says so", async ({ page }) => {
    test.setTimeout(120_000);
    const { card, table } = await openSubjectNeeds(page);
    const search = card.getByLabel("Search subjects or students");
    await expect(search).toBeVisible();
    await search.fill("Eva");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(subjectRow(table, "SPEC 102")).toContainText("Student match: Eva Spec");
    await search.fill("Finn"); // a student only a later subject needs
    await expect(subjectRow(table, "SPEC 201")).toContainText("Student match: Finn Spec");
    await search.fill("spec thesis"); // a subject title
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(subjectRow(table, "SPEC 201")).not.toContainText("Student match");
    await search.fill("zzzz-nobody");
    await expect(card.getByText("Nothing matches that search")).toBeVisible();
    await expect(card.getByText("Try a subject code, a title or a student name.")).toBeVisible();
    await search.fill("");
    await expect(table.locator("tbody tr")).toHaveCount(3);
  });

  test("a program where nobody needs a subject still lists its subjects, and the empty group says so", async ({ page }) => {
    test.setTimeout(120_000);
    const { card, table } = await openSubjectNeeds(page, { report: { ...REPORT, summary: { ...REPORT.summary, students_reviewed: 0 }, rows: [] }, zero: true });
    await expect(table.locator("tbody tr")).toHaveCount(3); // every curriculum subject stays open to a manual decision
    await expect(subjectRow(table, "SPEC 101").locator("td").nth(1)).toHaveText("0");
    await card.getByRole("button", { name: "Needed next term (0)" }).click();
    await expect(card.getByText("No subject in this group")).toBeVisible();
    await expect(card.getByText("Choose All subjects to see every curriculum subject.")).toBeVisible();
  });
});

// ===================================================================================================================
// Rules applied on this screen
// ===================================================================================================================
const RULES = {
  items: [
    {
      key: "spec_rule_one", title: "Spec: filing window", description: "A request is filed within the window.", citation: "Graduate School Handbook p. 12",
      source_section: "Section 4.2", value: 14, value_type: "number", unit: "days", enforced: true, status: "confirmed", not_enforced_reason: "",
    },
    {
      key: "spec_rule_two", title: "Spec: counselling note", description: "The student sees the counsellor first.", citation: "Research Protocol",
      source_section: "", value: true, value_type: "bool", unit: "", enforced: false, status: "needs_review", not_enforced_reason: "Spec: the office does this by hand.",
    },
  ],
};

async function checkRules(page, { staffLink }) {
  const rules = page.locator('section[aria-label="Rules applied on this screen"]');
  await expect(rules).toBeVisible();
  const toggle = rules.getByRole("button");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(rules).toContainText("2 rules from the Graduate School policies · 1 needs review");
  await expect(rules.getByText("Spec: filing window")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const one = rules.locator("div.ring-1", { hasText: "Spec: filing window" });
  await expect(one).toContainText("14 days");
  await expect(one).toContainText("A request is filed within the window.");
  await expect(one).toContainText("Source: Graduate School Handbook p. 12 (Section 4.2)");
  await expect(one).toContainText("Enforced by the system");
  await expect(one).not.toContainText("Needs review");
  const two = rules.locator("div.ring-1", { hasText: "Spec: counselling note" });
  await expect(two).toContainText("Yes");
  await expect(two).toContainText("Source: Research Protocol");
  await expect(two).toContainText("Documented only");
  await expect(two).toContainText("Needs review");
  await expect(two).toContainText("Spec: the office does this by hand.");
  const link = rules.getByRole("link", { name: "See every business rule and its history" });
  await expect(link).toHaveCount(staffLink ? 1 : 0);
  if (staffLink) await expect(link).toHaveAttribute("href", "/business-rules");
}

test.describe("Rules applied on this screen", () => {
  test.describe("student", () => {
    test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 768 } });

    test("collapsed first; opens to each rule with value, source and badges; no link to the rules page", async ({ page }) => {
      await mockGet(page, /\/api\/business-rules/, RULES);
      await page.goto("/student/requests/withdrawal");
      await checkRules(page, { staffLink: false });
      await shotAll(page, "rules-student");
    });
  });

  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    test("the same box on a staff board, with the link to every business rule", async ({ page }) => {
      await mockGet(page, /\/api\/business-rules/, RULES);
      await page.goto("/workflow/practicum");
      await expect(main(page).getByRole("heading", { level: 1, name: "Practicum" })).toBeVisible();
      await checkRules(page, { staffLink: true });
      await shotAll(page, "rules-staff");
    });

    test("a process with no rules shows no box at all", async ({ page }) => {
      await mockGet(page, /\/api\/business-rules/, { items: [] });
      await page.goto("/workflow/practicum");
      await expect(main(page).getByRole("heading", { level: 1, name: "Practicum" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator('section[aria-label="Rules applied on this screen"]')).toHaveCount(0);
    });
  });
});

// ===================================================================================================================
// Handoff import result
// ===================================================================================================================
const IMPORT_RESULT = {
  message: "Spec import done: 3 students created.",
  program: "MAED", program_id: 7, subjects: 22,
  created: 3, skipped: 2, updated: 4, subject_changes: 9, conflict_count: 2, unresolved_count: 2,
  accounts: [
    { name: "Ana Spec", email: "ana.spec@usls.edu.ph", password: "SpecPass-001", must_change_password: true },
    { name: "Ben Spec", email: "ben.spec@usls.edu.ph", password: "SpecPass-002", must_change_password: true },
  ],
  standing_needs_review: [{ student_number: "SP-010", name: "Cora Spec", note: "on leave", suggested_standing: "On Leave" }],
  standing_from_note: [{ student_number: "SP-011", name: "Dan Spec", note: "LOA 2026", standing: "On Leave" }],
  duplicates: [{ incoming_student_number: "SP-012", incoming_name: "Eva Spec", matched_student: { id: 9001, name: "Eva Existing", student_number: "GS-0001" } }],
  sample: [
    { id: 9101, name: "Ana Spec", student_number: "SP-001", program_code: "MAED", stage: "Coursework", completed: 4, total_subjects: 22 },
    { id: 9102, name: "Ben Spec", student_number: "SP-002", program_code: "MAED", stage: "Coursework", completed: 0, total_subjects: 22 },
  ],
  validation_issues: [],
};

test.describe("Handoff import result (staff, Student Handoff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  async function importWith(page, result) {
    await page.route(/\/api\/transactions\/student-handoff\/import/, (route) => route.fulfill({ json: result }));
    await page.goto("/");
    await sidebarLink(page, /1 · Student Handoff/).click();
    await expect(page).toHaveURL(/\/workflow\/student-handoff/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Student Handoff" })).toBeVisible();
    await main(page).locator('input[type="file"]').setInputFiles({
      name: "spec-monitoring.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("not a real workbook; the server answer is mocked"),
    });
    await main(page).getByRole("button", { name: "Import students" }).click();
    // the result box: the nearest fading-in block around the message
    return main(page).getByText(result.message).locator("xpath=ancestor::div[contains(@class,'animate-fade-up')][1]");
  }

  test("counts, the warning, the two links and each detail section (the logins open, the rest closed)", async ({ page }) => {
    const box = await importWith(page, IMPORT_RESULT);
    await expect(box).toContainText("Spec import done: 3 students created.");
    await expect(box).toContainText("MAED · 22 subjects");
    for (const [label, value] of [["New students", "3"], ["Already in system", "2"], ["Year level refreshed", "4"], ["Subject cells changed", "9"], ["Need your decision", "2"]]) {
      await expect(box.getByText(label, { exact: true }).locator("xpath=.."), label).toContainText(value);
    }
    await expect(box.getByRole("status")).toContainText("2 records differ from what is already stored. Nothing was overwritten; open the validation results below and choose what to keep.");
    await expect(box.getByRole("link", { name: "Open Monitoring Sheet" })).toHaveAttribute("href", "/monitoring-sheet?program_id=7");
    await expect(box.getByRole("link", { name: "View Students" })).toHaveAttribute("href", "/students");

    // the new logins are open by default and name each password once
    const logins = box.locator("details", { hasText: "New student logins - shown only now" });
    await expect(logins).toHaveAttribute("open", "");
    await expect(logins).toContainText("2"); // the count bubble
    await expect(logins).toContainText("Ana Spec · ana.spec@usls.edu.ph");
    await expect(logins.locator("code").first()).toHaveText("SpecPass-001");
    // the others start closed and open on a click
    for (const [title, text] of [
      ["NOTE suggests a different standing (nothing changed)", "suggests On Leave"],
      ["Standing read from the NOTE column", "LOA 2026"],
      ["Already in the system - not imported again", "In the system as Eva Existing · GS-0001"],
      ["Imported students", "4/22 subjects"],
    ]) {
      const section = box.locator("details", { hasText: title });
      await expect(section, title).not.toHaveAttribute("open", "");
      await section.locator("summary").click();
      await expect(section, title).toHaveAttribute("open", "");
      await expect(section, title).toContainText(text);
    }
    const imported = box.locator("details", { hasText: "Imported students" });
    await expect(imported.getByRole("link", { name: /Open/ }).first()).toHaveAttribute("href", "/students/9101");
    await shotAll(page, "handoff-result");
  });

  test("a clean import: no warning, no logins, no detail sections", async ({ page }) => {
    const box = await importWith(page, {
      message: "Spec clean import.", program: "MAED", program_id: 7, subjects: 22,
      created: 0, skipped: 5, updated: 0, subject_changes: 0, conflict_count: 0, unresolved_count: 0, accounts: [], sample: [], duplicates: [],
    });
    await expect(box).toContainText("Spec clean import.");
    await expect(box.getByRole("status")).toHaveCount(0);
    await expect(box.locator("details")).toHaveCount(0);
    await expect(box.getByText("Need your decision", { exact: true }).locator("xpath=..")).toContainText("0");
  });
});

// ===================================================================================================================
// Assistant sources
// ===================================================================================================================
const COVERED_REPLY = {
  answer: "Spec: the maximum residence period is seven years.",
  source: { label: "Policy documents", detail: "Spec detail", ai_used: false, offline: true },
  sources: [
    { id: 1, title: "Graduate School Handbook", page: 21, section: "Residence > Maximum period", source: "handbook.pdf", quote: "Spec quote: seven years from first enrollment." },
    { id: 2, title: "Research Protocol", page: null, section: "", source: "protocol.pdf", text: "Spec second passage.", warning: "Spec: an older edition." },
  ],
};
const NOT_COVERED_REPLY = { answer: "Spec: not in the documents.", not_covered: true, source: null, sources: [] };

test.describe("Assistant sources (staff, Policy Assistant)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("an answer's label and its sources open to the exact passage; a not-covered answer shows the calm notice", async ({ page }) => {
    let calls = 0;
    await page.route(/\/api\/assistant$/, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      calls += 1;
      return route.fulfill({ json: calls === 1 ? COVERED_REPLY : NOT_COVERED_REPLY });
    });
    await page.goto("/assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Policy Assistant" })).toBeVisible();
    const box = page.getByRole("textbox", { name: "Your question" });
    await box.fill("Spec: how long can I stay?");
    await page.getByRole("button", { name: "Send question" }).click();

    const badge = page.getByTestId("answer-badge").last();
    await expect(badge).toContainText("Offline answer");
    await expect(badge).toContainText("Found by keyword search; Gemini was not used");
    const sources = page.getByTestId("source-list").last();
    await expect(sources).toContainText("Sources (2)");
    const first = sources.locator("details").nth(0);
    await expect(first.locator("summary")).toContainText("Graduate School Handbook");
    await expect(first.locator("summary")).toContainText("Page 21 · Residence › Maximum period");
    await expect(first.locator("blockquote")).toBeHidden();
    await first.locator("summary").click();
    await expect(first.locator("blockquote")).toContainText("Spec quote: seven years from first enrollment.");
    const second = sources.locator("details").nth(1);
    await expect(second.locator("summary")).toContainText("protocol.pdf"); // no page or section: the file name
    await second.locator("summary").click();
    await expect(second).toContainText("Spec: an older edition.");
    await expect(second.locator("blockquote")).toContainText("Spec second passage.");
    await shotAll(page, "assistant-sources");

    await box.fill("Spec: what time does the gym open?");
    await page.getByRole("button", { name: "Send question" }).click();
    const notCovered = page.getByTestId("not-covered");
    await expect(notCovered).toContainText("Not covered by the policy documents");
    await expect(notCovered).toContainText("Ask the Graduate School office.");
    await expect(page.getByTestId("source-list")).toHaveCount(1);
  });
});

// ===================================================================================================================
// Case discussion (WorkflowDiscussion)
// ===================================================================================================================
const THREAD = [
  { id: 8101, transaction_slug: "leave-of-absence", request_id: 41, thread_key: "loa:41", action_type: "return", status: "Open", recipient_role: "Student", sender_role: "Graduate School Staff", sender_name: "Staff Anna", comment: "Spec: please add the clinic certificate.", created_at: "2026-10-02T09:00:00", is_unread: false, stage: "Staff Review", visibility: "student_visible" },
  { id: 8102, transaction_slug: "leave-of-absence", request_id: 41, thread_key: "loa:41", action_type: "response", status: "Answered", recipient_role: "Graduate School Staff", sender_role: "Student", sender_name: "Miguel Yu", comment: "Spec: it is attached now.", created_at: "2026-10-03T09:00:00", is_unread: false, stage: "Staff Review", reply_to_message_id: 8101 },
];

test.describe("Case discussion", () => {
  test.describe("student Messages (embedded thread with a reply box)", () => {
    test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 768 } });

    test("posts in order, the reply nested under its parent, the latest highlighted, reply only to the other side", async ({ page }) => {
      await editGet(page, /\/api\/student-portal\/context/, (d) => { d.workflow_messages = THREAD; });
      await page.goto("/student/messages");
      await expect(page.locator("main h1").first()).toHaveText("Messages");
      const thread = main(page).locator("section").filter({ hasText: "Leave of Absence request #41" }).last();
      await expect(thread).toContainText("2 messages");
      const list = thread.getByRole("list", { name: "Leave of Absence discussion" });
      await expect(list).toBeVisible();
      const posts = list.locator("> li");
      await expect(posts).toHaveCount(2);
      await expect(posts.nth(0)).toHaveAttribute("aria-label", "Discussion post");
      await expect(posts.nth(1)).toHaveAttribute("aria-label", "Reply level 1");
      await expect(posts.nth(0)).toContainText("Staff Anna (Graduate School Staff)");
      await expect(posts.nth(0)).toContainText("Student");
      await expect(posts.nth(0)).toContainText("Spec: please add the clinic certificate.");
      await expect(posts.nth(0)).toContainText("Open");
      await expect(posts.nth(0)).toContainText("Student visible");
      await expect(posts.nth(0)).not.toContainText("Latest");
      await expect(posts.nth(1)).toContainText("Replying to Staff Anna");
      await expect(posts.nth(1)).toContainText("Spec: it is attached now.");
      await expect(posts.nth(1)).toContainText("Latest");
      await expect(posts.nth(1)).toContainText("Answered");
      await expect(posts.nth(0).locator("time")).toHaveAttribute("datetime", "2026-10-02T09:00:00");
      // the student can answer the staff post, not their own
      await expect(posts.nth(0).getByLabel("Reply to Staff Anna")).toBeVisible();
      await expect(posts.nth(1).getByLabel(/^Reply to /)).toHaveCount(0);
      await shotAll(page, "discussion-student");
    });
  });

  test.describe("staff Practicum case window (headed thread with a Reply button)", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    async function openCase(page, messages) {
      await editGet(page, /\/api\/transactions\/practicum\/context/, (body) => {
        const row = body.roster.find((item) => item.student.student_number === "GS-2026-PRAC-01");
        row.record = {
          id: 9100, student_id: row.student.id, status: "MOA Submitted", moa_status: "Uploaded", moa_uploaded: true, practicum_site: "Community Counselling Center",
          supervisor_name: "Ms. Rina Lopez", required_hours: 200, completed_hours: 0, document_status: "Missing", certificate_count: 0, remarks: "MOA for review.",
          completion_status: "Pending", coordinator_review_status: "Pending", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
          completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
        };
        row.has_submitted_documents = true;
        row.messages = messages;
        row.history = [];
      });
      await page.goto("/workflow/practicum");
      await main(page).getByRole("button", { name: "Table" }).click();
      await main(page).getByRole("table").getByRole("row", { name: /Andrea Villanueva/ }).getByRole("button", { name: /Open case/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Andrea Villanueva" })).toBeVisible();
      return dialog;
    }

    test("the header with its count, the posts, Reply on the other side's posts only", async ({ page }) => {
      const messages = [
        { id: 7001, transaction_slug: "practicum", action_type: "submission", status: "MOA Submitted", sender_role: "Student", sender_name: "Andrea Villanueva", recipient_role: "Graduate School Staff", comment: "Spec: MOA attached.", created_at: "2026-10-19T09:00:00", visibility: "student_visible" },
        { id: 7002, transaction_slug: "practicum", action_type: "return", status: "Returned", sender_role: "Graduate School Staff", sender_name: "Staff Anna", recipient_role: "Student", comment: "Spec: the MOA is unsigned.", created_at: "2026-10-20T09:00:00", visibility: "internal" },
      ];
      const dialog = await openCase(page, messages);
      await expect(dialog.getByText("Case discussion / reviewer remarks")).toBeVisible();
      await expect(dialog.getByText("2 messages", { exact: true })).toBeVisible();
      const list = dialog.getByRole("list", { name: "Case discussion / reviewer remarks" });
      const posts = list.locator("> li");
      await expect(posts).toHaveCount(2);
      await expect(posts.nth(0)).toContainText("Andrea Villanueva (Student)");
      await expect(posts.nth(0)).toContainText("Spec: MOA attached.");
      await expect(posts.nth(1)).toContainText("Staff Anna (Graduate School Staff)");
      await expect(posts.nth(1)).toContainText("Internal");
      await expect(posts.nth(1)).toContainText("Returned");
      await expect(posts.nth(1)).toContainText("Latest"); // practicum threads highlight only the latest post
      await expect(posts.nth(0)).not.toContainText("Latest");
      // staff can reply to the student's post, not to staff's own
      await expect(posts.nth(0).getByRole("button", { name: "Reply" })).toBeVisible();
      await expect(posts.nth(1).getByRole("button", { name: "Reply" })).toHaveCount(0);
      await shotAll(page, "discussion-practicum");
    });

    test("no messages: the empty sentence and a zero count", async ({ page }) => {
      const dialog = await openCase(page, []);
      await expect(dialog.getByText("Case discussion / reviewer remarks")).toBeVisible();
      await expect(dialog.getByText("0 messages", { exact: true })).toBeVisible();
      await expect(dialog.getByText("No submission remarks or reviewer comments yet.")).toBeVisible();
    });
  });
});

// ===================================================================================================================
// Defense scheduling: availability request panel, slot check
// ===================================================================================================================
test.describe("Defense scheduling parts (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("availability of the panel: who has entered, who was asked, the form, and who answered", async ({ page }) => {
    let people = [];
    await editGet(page, /\/api\/transactions\/defense-scheduling\/context/, (body) => {
      people = body.availability.participants;
      body.availability.participants = people.map((p, i) => (i === 0
        ? { ...p, availability_entered: false, availability_source: "not_entered", availability_updated_at: null }
        : { ...p, availability_entered: true, availability_source: "entered", availability_updated_at: "2026-10-01" }));
      body.availability_requests = [
        { id: 501, faculty_id: people[0].faculty_id, faculty_name: people[0].name, status: "Open", window_start: "2026-11-02", window_end: "2026-11-30", created_at: "2026-10-20T08:00:00", answered_at: null },
        { id: 502, faculty_id: people[1].faculty_id, faculty_name: people[1].name, status: "Answered", window_start: "2026-11-02", window_end: "2026-11-30", created_at: "2026-10-18T08:00:00", answered_at: "2026-10-19T08:00:00" },
      ];
    });
    await page.goto("/workflow/defense-scheduling?student_id=146");
    const panel = main(page).locator("section[aria-labelledby='panel-availability-request']");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Availability of the panel", { exact: true })).toBeVisible();
    await expect(panel).toContainText("Nobody is assumed to be free.");
    await expect(panel).toContainText("1 not entered");
    const items = panel.locator("ul").first().locator("> li");
    await expect(items).toHaveCount(people.length);
    await expect(items.nth(0)).toContainText(people[0].name);
    await expect(items.nth(0)).toContainText("Availability not entered");
    await expect(items.nth(0)).toContainText("Asked on Oct 20, 2026; waiting for an answer.");
    await expect(items.nth(1)).toContainText("Entered - updated Oct 1, 2026");
    // the ask form: not sent
    await expect(panel.getByText("Ask the adviser and the panel for their available dates")).toBeVisible();
    await expect(panel.getByLabel("Dates needed from")).toBeVisible();
    await expect(panel.getByLabel("Until")).toBeVisible();
    await expect(panel.getByLabel("Message (optional)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Ask for availability" })).toBeEnabled();
    // who answered
    await expect(panel.getByText("Who answered", { exact: true })).toBeVisible();
    const table = panel.getByRole("table");
    for (const header of ["Faculty", "Window", "Status", "Answered"]) {
      await expect(table.getByRole("columnheader", { name: header }), header).toBeVisible();
    }
    await expect(table.getByRole("row")).toHaveCount(1 + 2);
    await expect(table.getByRole("row", { name: new RegExp(people[1].name) })).toContainText("Nov 2, 2026 – Nov 30, 2026");
    await expect(table.getByRole("row", { name: new RegExp(people[1].name) })).toContainText("Answered");
    await expect(table.getByRole("row", { name: new RegExp(people[0].name) })).toContainText("Open");
    await shotAll(page, "availability-panel");
  });

  test("the slot check under the final-schedule form: cannot be booked, needs a reason, no conflicts", async ({ page }) => {
    let answer = { hard: ["Spec: Room 1 is booked then."], soft: [], matched_count: 3, participant_count: 5, earliest_date: "2026-11-05", lead_days: 14 };
    await page.route(/\/api\/defense-schedules\/check/, (route) => route.fulfill({ json: answer }));
    await page.goto("/workflow/defense-scheduling?student_id=146");
    await main(page).getByRole("button", { name: /Earliest option/ }).click(); // fills date and both times: the check runs
    await expect(main(page).getByRole("alert").filter({ hasText: "Cannot be booked" })).toContainText("Spec: Room 1 is booked then.");
    await expect(main(page)).toContainText("Earliest allowed date: Nov 5, 2026 (14-day lead time).");
    await expect(main(page)).toContainText("Times are Philippine time.");
    answer = { ...answer, hard: [], soft: ["Spec: Dr. Spec has not entered availability."] };
    await main(page).getByLabel(/Venue/).fill("Spec Room 2"); // any change of the form asks again
    await expect(main(page).getByText("Needs a reason")).toBeVisible();
    await expect(main(page)).toContainText("Spec: Dr. Spec has not entered availability.");
    await expect(main(page)).toContainText("To book anyway, tick the override box below and write why.");
    answer = { ...answer, soft: [] };
    await main(page).getByLabel(/Venue/).fill("Spec Room 3");
    await expect(main(page).getByText("No conflicts found")).toBeVisible();
    await expect(main(page)).toContainText("(3 of 5 checked)");
    await shotAll(page, "slot-check");
  });
});

// ===================================================================================================================
// Calendar page (staff tab, faculty "My Calendar") and the private-link card
// ===================================================================================================================
const today = new Date();
const pad = (n) => String(n).padStart(2, "0");
const TODAY = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const EVENT = {
  id: "d-1", kind: "defense", schedule_id: 77, student_id: 146, student_name: "Spec Student", student_number: "SP-777", defense_type: "Proposal Defense", status: "Needs Re-confirmation",
  date: TODAY, start: `${TODAY}T09:00:00`, end: `${TODAY}T10:30:00`, venue: "Spec Room 1", mode: "On-site", program_code: "MAED", adviser: "Dr. Spec Adviser",
  panel: [{ faculty_id: 1, name: "Dr. Panel One", role: "Panel Chair" }], attention: ["Spec: a panelist has not confirmed."], verdict_overdue: false, has_verdict: false,
  change_reason: "Spec: moved by an hour.", my_role: "Panel Member", ics_url: "/api/defense-schedules/77/event.ics",
};
const DEADLINE = { id: "dl-1", kind: "deadline", label: "Spec: manuscript due", date: TODAY, urgency: "soon", done: false, student_name: "Spec Student", student_id: 146, defense_type: "Proposal Defense" };
const CALENDAR = {
  events: [EVENT], deadlines: [DEADLINE], availability: null, busy: [], busy_status: "", timezone: "Asia/Manila",
  filters: { programs: [{ id: 1, code: "MAED", name: "Master of Arts in Education" }], defense_types: ["Proposal Defense"], statuses: ["Scheduled"], faculty: [{ id: 1, name: "Dr. Panel One" }], venues: ["Spec Room 1"] },
};

test.describe("Calendar page", () => {
  test.describe("staff: the Calendar tab of Defense Scheduling", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    test("filters, layers, a defense's details, the attention list, a deadline and the private-link card", async ({ page }) => {
      await mockGet(page, /\/api\/calendar(\?|$)/, CALENDAR);
      await mockGet(page, /\/api\/calendar-feed/, { feed: null });
      await page.goto("/workflow/defense-scheduling?view=calendar");
      await expect(main(page).getByText("All defenses with stage, status, panel and venue, plus the protocol deadlines.")).toBeVisible();
      await expect(main(page).getByRole("button", { name: "Print" })).toBeVisible();
      for (const label of ["Program", "Stage", "Status", "Panelist or adviser", "Venue", "Student"]) {
        await expect(main(page).locator("label", { hasText: new RegExp(`^${label}`) }).first(), label).toBeVisible();
      }
      await expect(main(page).getByRole("checkbox", { name: "Deadlines" })).toBeChecked();
      await expect(main(page).getByText("Select a defense or a deadline to see the details.")).toBeVisible();
      // a filter shows Clear, which empties it
      await main(page).locator("label", { hasText: /^Student/ }).getByPlaceholder("Name or ID").fill("Spec");
      await main(page).getByRole("button", { name: "Clear", exact: true }).click();
      await expect(main(page).getByRole("button", { name: "Clear", exact: true })).toHaveCount(0);

      // needs attention lists the flagged defense; opening it fills the details card
      const attention = main(page).locator(".card", { has: page.getByRole("heading", { name: "Needs attention" }) });
      await expect(attention).toContainText("Proposal Defense · Spec Student");
      await attention.getByRole("button").first().click();
      const details = main(page).locator(".card", { hasText: "Add to my calendar (.ics)" });
      await expect(details).toContainText("Proposal Defense");
      await expect(details).toContainText("Spec Student · SP-777");
      await expect(details.getByText("Needs Re-confirmation", { exact: true })).toBeVisible();
      await expect(details).toContainText("Spec: a panelist has not confirmed.");
      for (const [label, value] of [["Time", "09:00–10:30"], ["Venue", "Spec Room 1"], ["Mode", "On-site"], ["Program", "MAED"], ["Adviser", "Dr. Spec Adviser"], ["Last change", "Spec: moved by an hour."]]) {
        await expect(details.getByText(label, { exact: true }), label).toBeVisible();
        await expect(details, label).toContainText(value);
      }
      await expect(details.getByText("Panel", { exact: true })).toBeVisible();
      await expect(details).toContainText("Dr. Panel One");
      await expect(details.getByRole("link", { name: "Add to my calendar (.ics)" })).toHaveAttribute("href", "/api/defense-schedules/77/event.ics");
      await expect(details.getByRole("link", { name: /Open in Defense Scheduling/ })).toHaveAttribute("href", "/workflow/defense-scheduling?student_id=146");
      await expect(details.getByRole("button", { name: "I cannot attend this defense" })).toHaveCount(0); // staff are not panelists
      await shotAll(page, "calendar-staff");
      await details.getByRole("button", { name: "Close" }).click();
      await expect(main(page).getByText("Select a defense or a deadline to see the details.")).toBeVisible();

      // the deadline in the month grid opens its own details
      await main(page).getByRole("button", { name: /Spec: manuscript due/ }).first().click();
      const deadline = main(page).locator(".card", { hasText: "Spec: manuscript due" }).filter({ hasText: "Deadline" });
      await expect(deadline).toContainText("Due soon");
      await expect(deadline).toContainText("Spec Student");
      await expect(deadline.getByRole("link", { name: /Open Defense Scheduling/ })).toHaveAttribute("href", "/workflow/defense-scheduling?student_id=146");

      // the private link: none yet
      const feed = main(page).locator(".card", { has: page.getByRole("heading", { name: "Subscribe to this calendar" }) });
      await expect(feed.getByRole("button", { name: "Create my private link" })).toBeVisible();
    });
  });

  test.describe("faculty: My Calendar", () => {
    test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

    test("own layers, 'I cannot attend' opens a reason form, and the private link can be renewed or turned off (asks first)", async ({ page }) => {
      await mockGet(page, /\/api\/calendar(\?|$)/, { ...CALENDAR, events: [{ ...EVENT, status: "Scheduled", attention: [] }], busy_status: "Google Calendar is not connected." });
      await mockGet(page, /\/api\/calendar-feed/, { feed: { absolute_url: "http://127.0.0.1/feed/spec-token.ics", last_used_at: null } });
      await page.goto("/faculty-portal/calendar");
      await expect(page.getByRole("heading", { level: 1, name: "My Calendar" })).toBeVisible();
      await expect(main(page).getByRole("checkbox", { name: "My availability" })).toBeChecked();
      await expect(main(page).getByRole("checkbox", { name: "Google busy times" })).toBeChecked();
      await expect(main(page).getByText("Google Calendar is not connected.")).toBeVisible();
      await expect(main(page).getByLabel("Program")).toHaveCount(0); // faculty have no filter bar
      await main(page).getByRole("checkbox", { name: "Deadlines" }).uncheck();
      await main(page).getByRole("checkbox", { name: "Deadlines" }).check();

      // open the defense from the month grid
      await main(page).getByRole("button", { name: /09:00–10:30.*Proposal · Spec Student/ }).first().click();
      const details = main(page).locator(".card", { hasText: "Add to my calendar (.ics)" });
      await expect(details).toContainText("Your role");
      await expect(details).toContainText("Panel Member");
      await details.getByRole("button", { name: "I cannot attend this defense" }).click();
      const send = details.getByRole("button", { name: "Send request" });
      await expect(details.getByLabel("Why can you not attend?")).toBeVisible();
      await expect(send).toBeDisabled();
      await details.getByLabel("Why can you not attend?").fill("Spec reason");
      await expect(send).toBeEnabled(); // not clicked
      await details.getByRole("button", { name: "Cancel" }).click();
      await expect(details.getByRole("button", { name: "I cannot attend this defense" })).toBeVisible();

      // the private link: shown, copyable; both actions ask first
      const feed = main(page).locator(".card", { has: page.getByRole("heading", { name: "Subscribe to this calendar" }) });
      await expect(feed.getByLabel("Your private link")).toHaveValue("http://127.0.0.1/feed/spec-token.ics");
      await expect(feed).toContainText("Not read yet.");
      await expect(feed.getByRole("button", { name: "Copy link" })).toBeVisible();
      await feed.getByRole("button", { name: /New link/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Make a new private link?" })).toBeVisible();
      await expect(dialog).toContainText("The current link stops working.");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await feed.getByRole("button", { name: /Turn off/ }).click();
      await expect(page.getByRole("dialog").getByRole("heading", { name: "Turn off the private link?" })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await shotAll(page, "calendar-faculty");
    });
  });
});
