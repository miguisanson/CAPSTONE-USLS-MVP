// Behaviour pin for packet P8.3 (Phase 5 migration of pages/Enrollment.jsx: P6.7 modals + Field, P6.8 tables + history,
// plus I-081 "developer jargon widget" and I-082 "two student pickers"). Part 1 was written BEFORE the migration and is
// green on the old code, so it proves the migrated page keeps the same heading, filters, offered-subjects table, the
// Record dropped subject dialog, the class-list preview dialog, the study-plan section and the enrollment history.
// Part 2 (the "P8.3 changes" describe) is the new behaviour and is red until it is built.
//
// Everything is reached through the real UI (sidebar link, selects, buttons) as GS staff. The test reads the API at test
// time to know what to expect, so it does not depend on data other specs change. It never saves: the dialogs are opened
// and closed (or filled and abandoned), the class-list file is only previewed.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_DIR lets a before/after comparison write to two folders; the default is "p83" next to the sweep screens.
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p83");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p83", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ helpers
async function getJson(page, path) {
  const res = await page.request.get(path);
  expect(res.ok(), `GET ${path}: ${res.status()}`).toBeTruthy();
  return res.json();
}

/** Screenshot at 1366, 1920 and 390, then back to 1366 and assert nothing scrolls sideways at any of them. */
async function shotAll(page, name, { full = true } = {}) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500); // the page's own fade-in
  for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${name} scrolls sideways by ${overflow}px at ${width}`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(200);
}

const heading1 = (page, name) => page.getByRole("heading", { level: 1, name });
const sidebarLink = (page, name) => page.locator("aside nav").getByRole("link", { name });
const headTexts = (table) => table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));

/** The page's Student picker: the third filter after Program and Academic semester (as section-j I-001 finds it). */
const studentSelect = (page) => page.locator("select.field-input").nth(2);

async function openEnrollment(page) {
  await page.goto("/");
  await page.locator('aside nav a[href="/enrollment"]').click();
  await expect(heading1(page, "Enrollment")).toBeVisible();
  // the page settles on a program, a semester and a student, and writes them into the address
  await expect(page).toHaveURL(/student_id=\d+/);
  await expect(page.getByRole("heading", { level: 2, name: "Official offered subjects" })).toBeVisible();
}

/** The default view's data, plus a student of the same program/semester that has a subject enrolled in the semester. */
async function readSetup(page) {
  const first = await getJson(page, "/api/enrollment");
  const q = (student) => `/api/enrollment?program_id=${first.program.id}&term_id=${first.term.id}&student_id=${student.id}`;
  let withEnrolled = null;
  for (const student of first.students) {
    const data = await getJson(page, q(student));
    const row = data.offered_subjects.find((s) => s.enrollment_state === "enrolled_current");
    if (row) {
      withEnrolled = { student, row, data };
      break;
    }
  }
  return { first, q, withEnrolled };
}

const studentLabel = (s) => `${s.last_name}, ${s.first_name} — ${s.student_number}`;

// ================================================================================================ Part 1: the pin
test.describe("Enrollment (GS staff): behaviour that must not change", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("heading, filters, student summary and the offered-subjects table", async ({ page }) => {
    await openEnrollment(page);
    const { first } = await readSetup(page);

    await expect(page.getByText("Assign official semester offerings to an individual student.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Offering list" })).toHaveAttribute("href", /course-adjustments\?view=offerings/);
    await expect(page.getByText("Upload class list")).toBeVisible();

    // The three filters, in order: program, semester, student.
    const selects = page.locator("select.field-input");
    await expect(selects.nth(0)).toHaveValue(String(first.program.id));
    await expect(selects.nth(1)).toHaveValue(String(first.term.id));
    await expect(selects.nth(2)).toHaveValue(String(first.selected_student.id));
    await expect(selects.nth(0).locator("option")).toHaveCount(first.programs.length);
    await expect(selects.nth(1).locator("option")).toHaveCount(first.terms.length);
    await expect(selects.nth(2).locator("option")).toHaveCount(first.students.length);
    await expect(selects.nth(2).locator("option", { hasText: first.selected_student.student_number }).first()).toBeAttached();

    // Student summary
    await expect(page.getByRole("heading", { level: 2, name: first.selected_student.name })).toBeVisible();
    await expect(page.getByText(`${first.selected_student.student_number} · ${first.selected_student.program_code} · ${first.term.label}`)).toBeVisible();
    await expect(page.getByText("0 selected").or(page.getByText(/\d+ selected/)).first()).toBeVisible();

    // The four subject-status counters
    for (const label of ["Completed", "Enrolled", "Not taken", "Needs review"]) {
      await expect(page.getByLabel("Monitoring sheet subject status summary").getByText(label, { exact: true })).toBeVisible();
    }

    // Offered subjects: one table row per offering, with the same four columns and the subject code first.
    expect(first.offered_subjects.length, "the demo program offers subjects this semester").toBeGreaterThan(0);
    await expect(page.getByText(`${first.offered_subjects.length} offered`, { exact: true })).toBeVisible();
    const table = page.locator("main table").first();
    expect(await headTexts(table)).toEqual(["Subject", "Student status", "Demand", "Enrollment"]);
    await expect(table.locator("tbody tr")).toHaveCount(first.offered_subjects.length);
    for (const subject of first.offered_subjects.slice(0, 3)) {
      const row = table.locator("tbody tr").filter({ hasText: subject.course_code }).first();
      await expect(row).toContainText(subject.course_title);
      await expect(row).toContainText(`${subject.demand_count} student${subject.demand_count === 1 ? "" : "s"}`);
    }

    // The draft panel and its buttons
    await expect(page.getByRole("heading", { level: 2, name: "Enrollment draft" })).toBeVisible();
    await expect(page.getByLabel("Source / reference")).toHaveValue("Graduate School enrollment review");
    await expect(page.getByRole("button", { name: /Confirm enrollment/ })).toBeVisible();

    await shotAll(page, "enrollment");
  });

  test("the Student picker changes the student shown", async ({ page }) => {
    await openEnrollment(page);
    const { first, q } = await readSetup(page);
    const other = first.students.find((s) => s.id !== first.selected_student.id);
    test.skip(!other, "the demo program has only one student");
    const data = await getJson(page, q(other));

    await studentSelect(page).selectOption(String(other.id));
    await expect(page).toHaveURL(new RegExp(`student_id=${other.id}`));
    await expect(page.getByRole("heading", { level: 2, name: data.selected_student.name })).toBeVisible();
    await expect(page.locator("main table").first().locator("tbody tr")).toHaveCount(data.offered_subjects.length);
  });

  test("adding a subject puts it in the draft and Remove takes it out again (nothing is saved)", async ({ page }) => {
    await openEnrollment(page);
    const { first } = await readSetup(page);
    const addable = first.offered_subjects.find((s) => s.selectable && s.enrollment_state !== "enrolled_current" && s.enrollment_state !== "completed");
    test.skip(!addable, "the default student has no subject that can be added");

    const row = page.locator("main table").first().locator("tbody tr").filter({ hasText: addable.course_code }).first();
    await row.getByRole("button", { name: /^Add$/ }).click();
    await expect(row.getByRole("button", { name: "Selected" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${addable.course_code}` })).toBeVisible();

    await page.getByRole("button", { name: `Remove ${addable.course_code}` }).click();
    await expect(page.getByText("Unsaved changes")).toBeHidden();
    await expect(row.getByRole("button", { name: /^Add$/ })).toBeVisible();
  });

  test("Record dropped subject dialog opens, can be filled, and closes with Escape and with its close button", async ({ page }) => {
    await openEnrollment(page);
    const { first, withEnrolled } = await readSetup(page);
    test.skip(!withEnrolled, "no demo student has a subject enrolled this semester");
    if (withEnrolled.student.id !== first.selected_student.id) await studentSelect(page).selectOption(String(withEnrolled.student.id));
    await expect(page.getByRole("heading", { level: 2, name: withEnrolled.data.selected_student.name })).toBeVisible();

    const code = withEnrolled.row.course_code;
    const dialog = page.getByRole("dialog", { name: "Record dropped subject" });

    // 1. Escape closes it
    await page.getByRole("button", { name: `Change ${code} student status` }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(withEnrolled.data.selected_student.name);
    await expect(dialog).toContainText(code);
    await expect(dialog.getByLabel("New status")).toBeVisible();
    await expect(dialog.getByLabel("Effective date")).toBeVisible();
    await expect(dialog.getByLabel(/Unexcused absences/)).toBeVisible();
    await expect(dialog.getByLabel("Coordinator note")).toBeVisible();
    await expect(dialog.getByText("When a subject can be dropped")).toBeVisible();
    await page.waitForTimeout(400);
    await shotAll(page, "enrollment-drop-dialog", { full: false });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // the focus goes back to the button that opened it
    await expect(page.getByRole("button", { name: `Change ${code} student status` })).toBeFocused();

    // 2. fill every field: the Save button names the status and can be pressed (we do not press it)
    await page.getByRole("button", { name: `Change ${code} student status` }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("New status").selectOption("Dropped");
    await dialog.getByLabel(/Unexcused absences/).fill("25");
    await dialog.getByLabel("Coordinator note").fill("Pin test: abandoned, not saved.");
    await expect(dialog.getByRole("button", { name: "Save Dropped" })).toBeEnabled();

    // 3. the close button closes it
    await dialog.getByRole("button", { name: /^Close/ }).first().click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: `Change ${code} student status` })).toBeVisible();
  });

  test("Preview class list dialog opens from an uploaded file and closes (nothing is imported)", async ({ page }) => {
    await openEnrollment(page);
    const { first } = await readSetup(page);
    const subject = first.offered_subjects[0];
    const csv =
      "Academic Year,Term,Student ID,Subject Code,Faculty,Enrollment Status,Status Effective Date\n" +
      `${subject.academic_year},${subject.semester},${first.selected_student.student_number},${subject.course_code},Dr. Pin Test,Enrolled,2026-08-10\n`;

    await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({ name: "pin-class-list.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    const dialog = page.getByRole("dialog", { name: "Preview class list" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("pin-class-list.csv");
    for (const label of ["Rows detected: 1", "Ready:", "Already enrolled:", "Needs review:"]) {
      await expect(dialog.getByText(label)).toBeVisible();
    }
    const table = dialog.locator("table");
    expect(await headTexts(table)).toEqual(["Row", "Student", "Program", "Subject", "Faculty", "Import result"]);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody tr").first()).toContainText(first.selected_student.student_number);
    await expect(table.locator("tbody tr").first()).toContainText(subject.course_code);
    await expect(dialog.getByRole("button", { name: "Confirm import" })).toBeVisible();
    await expect(dialog.getByText("Rows that need review are skipped.")).toBeVisible();
    await page.waitForTimeout(400);
    await shotAll(page, "enrollment-classlist-dialog", { full: false });

    await dialog.getByRole("button", { name: "Choose another file" }).click();
    await expect(dialog).toBeHidden();

    // and Escape closes it as well
    await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({ name: "pin-class-list.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the study-plan section and the enrollment history are on the page", async ({ page }) => {
    await openEnrollment(page);
    const { first } = await readSetup(page);

    const plan = page.getByRole("heading", { level: 2, name: "Curriculum version & study plan draft" });
    await plan.scrollIntoViewIfNeeded();
    await expect(plan).toBeVisible();
    await expect(page.getByRole("button", { name: "Tag curriculum version" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate study plan draft" })).toBeVisible();
    await expect(page.getByText("Recent study plan drafts").first()).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: "Enrollment history" })).toBeVisible();
    const rows = (first.history || []).filter((r) => r.status !== "Cancelled").slice(0, 8);
    if (rows.length) {
      const toggle = page.getByRole("button", { name: /View enrollment history/ });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByRole("button", { name: /Hide enrollment history/ })).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText(rows[0].course_code).last()).toBeVisible();
    } else {
      await expect(page.getByText("No semester enrollment has been saved yet.")).toBeVisible();
    }
    await shotAll(page, "enrollment-bottom");
  });
});

// ================================================================================================ Part 2: P8.3 changes
// What changes on purpose. The server's answer is read at test time (or replaced by page.route) so these do not depend on
// seeded state that other specs change.

/** Serve /api/enrollment as the server does, with `patch(json)` applied to the answer. */
async function patchEnrollment(page, patch) {
  await page.route(/\/api\/enrollment(\?|$)/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: patch(json) || json });
  });
}

test.describe("Enrollment (GS staff): P8.3 changes", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("I-082: one student picker; the study-plan section follows the student chosen at the top", async ({ page }) => {
    await openEnrollment(page);
    const { first, q } = await readSetup(page);

    // exactly one student picker on the whole page (a select that lists this student), and no "Select a student…"
    await expect(page.locator("select").filter({ has: page.locator("option", { hasText: first.selected_student.student_number }) })).toHaveCount(1);
    await expect(page.locator("option", { hasText: "Select a student…" })).toHaveCount(0);

    const plan = page.getByRole("heading", { level: 2, name: "Curriculum version & study plan draft" });
    await plan.scrollIntoViewIfNeeded();
    await expect(page.getByText(`Study plan for ${first.selected_student.name}`)).toBeVisible();
    // no second pick is needed: the buttons are live and the version list is open
    await expect(page.getByRole("button", { name: "Generate study plan draft" })).toBeEnabled();
    await expect(page.getByLabel("Curriculum version")).toBeEnabled();

    // choosing another student at the top changes the study-plan section
    const other = first.students.find((s) => s.id !== first.selected_student.id);
    test.skip(!other, "the demo program has only one student");
    const data = await getJson(page, q(other));
    await studentSelect(page).selectOption(String(other.id));
    await expect(page.getByText(`Study plan for ${data.selected_student.name}`)).toBeVisible();
    await expect(page.getByText(`Study plan for ${first.selected_student.name}`)).toHaveCount(0);
  });

  test("I-081: no 'Cross-screen consistency' widget when the check is clean", async ({ page }) => {
    await patchEnrollment(page, (json) => {
      json.integrity = { status: "Consistent", issue_count: 0, checked_enrollments: 3, issues: [], surfaces: [] };
    });
    await openEnrollment(page);
    await expect(page.getByText("Cross-screen consistency")).toHaveCount(0);
    await expect(page.getByText(/enrollment row\(s\) checked/)).toHaveCount(0);
    await expect(page.getByText("no inconsistencies")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Enrollment history" })).toBeVisible();
  });

  test("I-081: a problem the check found is a plain warning beside the subject it is about", async ({ page }) => {
    let subject;
    await patchEnrollment(page, (json) => {
      subject = json.offered_subjects[0];
      json.integrity = {
        status: "Needs review",
        issue_count: 1,
        checked_enrollments: 3,
        surfaces: [],
        issues: [{
          id: "projection-1",
          type: "Monitoring/profile mismatch",
          line: `${json.selected_student.student_number} · ${subject.course_code}`,
          message: "Enrollment says Enrolled in this term, but the shared monitoring/profile row says Missing.",
          student_id: json.selected_student.id,
        }],
      };
    });
    await openEnrollment(page);
    const row = page.locator("main table").first().locator("tbody tr").filter({ hasText: subject.course_code }).first();
    await expect(row.getByText("This subject's status differs from the Monitoring Sheet:")).toBeVisible();
    await expect(row).toContainText("the shared monitoring/profile row says Missing");
    // the note sits on that subject only
    await expect(page.getByText("This subject's status differs from the Monitoring Sheet:")).toHaveCount(1);
    await expect(page.getByText("Cross-screen consistency")).toHaveCount(0);
    await shotAll(page, "enrollment-row-warning");
  });

  test("forms: Record dropped subject marks required fields and checks them when Save is pressed", async ({ page }) => {
    await openEnrollment(page);
    const { first, withEnrolled } = await readSetup(page);
    test.skip(!withEnrolled, "no demo student has a subject enrolled this semester");
    if (withEnrolled.student.id !== first.selected_student.id) await studentSelect(page).selectOption(String(withEnrolled.student.id));
    const code = withEnrolled.row.course_code;
    await page.getByRole("button", { name: `Change ${code} student status` }).click();
    const dialog = page.getByRole("dialog", { name: "Record dropped subject" });
    await expect(dialog).toBeVisible();

    // required fields say so, and the button is not greyed out
    for (const name of ["New status", "Effective date", "Unexcused absences", "Coordinator note"]) {
      await expect(dialog.getByLabel(name)).toHaveAttribute("aria-required", "true");
    }
    const save = dialog.getByRole("button", { name: /^Save/ });
    await expect(save).toBeEnabled();

    // pressing Save with the form empty: an error summary with a link to each field, and the answers stay put
    await dialog.getByLabel("Effective date").fill("2026-10-01");
    await save.click();
    await expect(dialog).toBeVisible();
    const summary = dialog.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveCount(3); // status, absences, note (the date is filled in)
    await expect(summary).toContainText("Choose Dropped as the new status.");
    await expect(summary).toContainText("Add a coordinator note");
    await expect(dialog.getByLabel("Effective date")).toHaveValue("2026-10-01");
    await expect(summary).toBeFocused();

    // each message links to its field
    await summary.getByRole("link", { name: /coordinator note/i }).click();
    await expect(dialog.getByLabel("Coordinator note")).toBeFocused();
    // and the same message sits beside the field
    await expect(dialog.getByLabel("Coordinator note")).toHaveAttribute("aria-invalid", "true");
    await shotAll(page, "enrollment-drop-errors", { full: false });
  });

  test("empty draft tells the coordinator what to do", async ({ page }) => {
    await patchEnrollment(page, (json) => {
      json.current_course_ids = [];
    });
    await openEnrollment(page);
    await expect(page.getByText("No subjects selected yet")).toBeVisible();
    await expect(page.getByText(/Choose Add on a subject/)).toBeVisible();
  });
});
