// Behaviour pin for packet P6.4 (Phase 5 migration of pages/MonitoringGrid.jsx, pages/EnrollmentClassList.jsx,
// pages/AdviserRecordCard.jsx). Written BEFORE the migration and green on the old code, so it proves the migrated pages
// keep the same headings, filters, table columns, rows, flag dialog and form rules. Everything is reached through the
// real UI (sidebar links, tabs, buttons), signed in as the role that owns the page.
//
// Data: it reads the seeded demo students and only WRITES one thing for real - a monitoring flag on the demo student
// Bea Salonga, which the same test resolves again (no other spec uses her). The adviser appointment of the record card
// is answered by a stubbed endpoint (the payload is asserted), so no adviser assignment is left behind.
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_DIR lets a before/after comparison write to two folders; the default is "p64" next to the sweep screens.
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p64");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p64", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ helpers
async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
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
const rowOf = (page, text) => page.locator("main table tbody tr").filter({ hasText: text });

// ================================================================================================ Monitoring Sheet
test.describe("Monitoring Sheet (GS staff, can edit)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("page: heading, actions, filters, legend, notices and the subject matrix", async ({ page }) => {
    test.setTimeout(120_000);
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const courses = grid.categories.flatMap((c) => c.courses);
    const salonga = grid.students.find((s) => s.last_name === "Salonga" && s.first_name === "Bea");
    expect(salonga, "seeded student Bea Salonga").toBeTruthy();

    await page.goto("/");
    await sidebarLink(page, "Monitoring Sheet").click();
    await expect(page).toHaveURL(/\/monitoring-sheet$/);
    await expect(heading1(page, "Monitoring Sheet")).toBeVisible();
    await expect(page.getByText("Curriculum progress for each student. Add students and edit subject rows here, or upload a workbook under Student Handoff.")).toBeVisible();

    // actions
    await expect(page.getByRole("link", { name: "Export workbook" })).toHaveAttribute("href", /\/api\/monitoring\/export\?program_id=\d+/);
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toBeVisible();

    // filters, with their options
    const select = (label) => page.getByLabel(label, { exact: true });
    await expect(select("Program")).toHaveValue(String(grid.program.id));
    await expect(select("Program").locator("option")).toContainText([`${grid.program.code} — ${grid.program.name}`]);
    expect(await select("Semester").locator("option").count()).toBeGreaterThanOrEqual(2);
    await expect(select("Progress").locator("option")).toHaveText(["All progress", "Not started", "In progress", "All subjects complete", "Eligible for compre"]);
    await expect(select("Risk").locator("option")).toHaveText(["All risk", "On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"]);
    await expect(select("Enrollment status").locator("option")).toHaveText(["All enrollment", "LOA", "AWOL", "LOA or AWOL", "Enrolled", "Withdrawn"]);
    await expect(select("Sort monitoring sheet").locator("option")).toHaveCount(7);
    await expect(select("Sort monitoring sheet").locator("option").first()).toHaveText("Sort: Last name");
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();

    // notices
    await expect(page.getByText("Select a subject cell or the pencil beside a name to add or edit a row.")).toBeVisible();
    await expect(page.getByText(/Imported values are never overwritten silently/)).toBeVisible();
    await expect(page.getByText(/Enrollment and student profiles are synchronized \(\d+ rows checked\)/)).toBeVisible();

    // legend
    for (const word of ["Officially completed", "Taken", "Enrolled", "Failed", "Dropped", "Planned", "INC", "Not taken", "Manual entry"]) {
      await expect(page.getByText(word, { exact: true }).filter({ visible: true }).first(), `legend: ${word}`).toBeVisible();
    }

    // the matrix: two header rows, grouped by category, one vertical column per subject
    const table = page.locator("main table").first();
    await expect(table).toBeVisible();
    const heads = await headTexts(table);
    for (const text of ["Student", "AY Entry", "YR", ...grid.categories.map((c) => c.name), "Compre Exam", "Research", "Title", "Proposal", "Ethics", "Final", ...courses.map((c) => c.code)]) {
      expect(heads, `column header ${text}`).toContain(text);
    }
    expect(await table.locator("thead tr").count()).toBe(2);

    // a seeded row, by content
    const row = rowOf(page, "Salonga, Bea");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`IDNO ${salonga.student_number}`);
    await expect(row).toContainText(salonga.risk);
    await expect(row).toContainText(salonga.academic_year_entry);
    await expect(row.getByRole("button", { name: "Open flags for Salonga, Bea" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Edit monitoring record of Salonga, Bea" })).toBeVisible();
    await expect(row.locator("button[aria-label*=' for Salonga, Bea: ']")).toHaveCount(courses.length);
    const done = courses.find((c) => salonga.cells[c.id] === "Completed");
    if (done) {
      await expect(row.getByRole("button", { name: new RegExp(`^${done.code} for Salonga, Bea: Completed`) })).toHaveText("C");
    }
    const notTaken = courses.find((c) => !salonga.cells[c.id] || salonga.cells[c.id] === "Missing");
    if (notTaken) {
      await expect(row.getByRole("button", { name: new RegExp(`^${notTaken.code} for Salonga, Bea: not taken`) })).toHaveText("");
    }
    // every student of the grid has a row
    expect(await page.locator("main table tbody tr").count()).toBeGreaterThanOrEqual(grid.students.length);
    await shotAll(page, "monitoring-grid");
  });

  test("filters and sorting write the URL, change the rows and show the empty state", async ({ page }) => {
    test.setTimeout(120_000);
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    await page.goto("/monitoring-sheet");
    await expect(heading1(page, "Monitoring Sheet")).toBeVisible();
    const select = (label) => page.getByLabel(label, { exact: true });
    const rows = page.locator("main table tbody tr");
    await expect(rows.first()).toBeVisible();

    // default order: last name, first name
    await expect(rows.first()).toContainText("Bernardo, Camille");

    // risk filter -> only that risk
    const atRisk = grid.students.filter((s) => s.risk === "At Risk of Delay");
    await select("Risk").selectOption("At Risk of Delay");
    await expect(page).toHaveURL(/risk=At\+Risk\+of\+Delay|risk=At%20Risk%20of%20Delay/);
    await expect(rows).toHaveCount(atRisk.length);
    await expect(rows.first()).toContainText("At Risk of Delay");

    // a filter nobody matches -> the empty state, with the add button for editors
    expect(grid.students.filter((s) => s.risk === "Delayed")).toHaveLength(0);
    await select("Risk").selectOption("Delayed");
    await expect(page.getByText("No students in this program yet")).toBeVisible();
    await expect(page.getByText("Add a student here, or import a monitoring workbook under Student Handoff.")).toBeVisible();
    await expect(page.locator("main table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toHaveCount(2); // header + empty state
    await shotAll(page, "monitoring-empty");

    // clear it again, then the other filters
    await select("Risk").selectOption("");
    await expect(rows.first()).toBeVisible();
    await select("Enrollment status").selectOption("LOA");
    await expect(page).toHaveURL(/enrollment=LOA/);
    await expect(rows.or(page.getByText("No students in this program yet")).first()).toBeVisible();
    await select("Enrollment status").selectOption("");
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(grid.students.length); // wait for this answer before the next filter, so answers cannot cross
    await select("Progress").selectOption("not-started");
    await expect(page).toHaveURL(/progress=not-started/);
    const notStarted = await okJson(await page.request.get("/api/monitoring/grid?progress=not-started"), "grid not-started");
    // (>= : the P2.2 spec may add a student with no subjects while this one runs)
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(notStarted.students.length);
    expect(await rows.count()).toBeLessThan(grid.students.length);
    await select("Progress").selectOption("");
    await expect(rows.first()).toBeVisible();

    // sorting writes the URL. (Known defect pinned as it is today: choosing a sort on its own does not
    // re-sort the rows or keep the choice in the select, because the sort state is only re-read when another filter
    // changes. P6.4 fixes that and then tightens this step to check the order.)
    await select("Sort monitoring sheet").selectOption("entry-newest");
    await expect(page).toHaveURL(/sort=entry-newest/);
    await select("Sort monitoring sheet").selectOption("name");
    await expect(page).not.toHaveURL(/sort=/);

    // program and semester
    await select("Semester").selectOption({ index: 1 });
    await expect(page).toHaveURL(/term_id=\d+/);
    const mba = grid.programs.find((p) => p.code === "MBA");
    expect(mba, "MBA is a seeded program").toBeTruthy();
    await select("Program").selectOption(String(mba.id));
    await expect(page).toHaveURL(new RegExp(`program_id=${mba.id}`));
    await expect(select("Program")).toHaveValue(String(mba.id));
    await expect(page.getByRole("link", { name: "Export workbook" })).toHaveAttribute("href", new RegExp(`program_id=${mba.id}`));
  });

  test("Export CSV downloads the sheet in the current order", async ({ page }) => {
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const courses = grid.categories.flatMap((c) => c.courses);
    await page.goto("/monitoring-sheet");
    await expect(page.locator("main table tbody tr").first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toBe(`monitoring-${grid.program.code}.csv`);
    const text = readFileSync(await download.path(), "utf8");
    const lines = text.split("\n");
    expect(lines[0]).toBe(["Student", "IDNO", "AY Entry", "YR", ...courses.map((c) => c.code), "Completed", "Total", "% Complete"].join(","));
    expect(lines.length).toBeGreaterThan(grid.students.length);
    expect(lines[1]).toContain('"Bernardo, Camille"');
    expect(text).toContain('"Salonga, Bea"');
  });

  test("a cell, the pencil and the name open the record panel and the student profile", async ({ page }) => {
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const courses = grid.categories.flatMap((c) => c.courses);
    const salonga = grid.students.find((s) => s.last_name === "Salonga");
    await page.goto("/monitoring-sheet");
    const row = rowOf(page, "Salonga, Bea");
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "Edit monitoring record of Salonga, Bea" }).click();
    const panel = page.getByRole("dialog", { name: /Salonga, Bea/ });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Close record panel" }).click();
    await expect(panel).toBeHidden();

    await row.locator(`button[aria-label^='${courses[0].code} for Salonga, Bea: ']`).click();
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Close record panel" }).click();
    await expect(panel).toBeHidden();

    await row.getByText("Salonga, Bea", { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/students/${salonga.id}$`));
  });

  test("Add student opens its dialog, which Cancel and Escape close without sending anything", async ({ page }) => {
    await page.goto("/monitoring-sheet");
    await expect(page.locator("main table tbody tr").first()).toBeVisible();
    await page.getByRole("button", { name: "Add student", exact: true }).first().click();
    const add = page.getByRole("dialog", { name: "Add student" });
    await expect(add).toBeVisible();
    await expect(add.getByRole("button", { name: "Add student", exact: true })).toBeDisabled();
    await add.getByRole("button", { name: "Cancel" }).click();
    await expect(add).toBeHidden();
    await page.getByRole("button", { name: "Add student", exact: true }).first().click();
    await expect(add).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    expect(tracker.writes, "nothing was sent").toEqual([]);
  });

  test("flag dialog: add a flag, see it on the row, resolve it", async ({ page }) => {
    test.setTimeout(180_000);
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const courses = grid.categories.flatMap((c) => c.courses);
    const salonga = grid.students.find((s) => s.last_name === "Salonga");
    const posts = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes(`/api/students/${salonga.id}/`)) posts.push({ path: new URL(r.url()).pathname, body: r.postDataJSON() });
    });

    await page.goto("/monitoring-sheet");
    const row = rowOf(page, "Salonga, Bea");
    await expect(row).toHaveCount(1);
    const flagButton = row.getByRole("button", { name: "Open flags for Salonga, Bea" });
    await expect(flagButton).toHaveAttribute("title", "0 open flag(s) for Salonga, Bea");

    await flagButton.click();
    const dialog = page.getByRole("dialog", { name: "Flags for Salonga, Bea" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`${salonga.student_number} · monitoring remains read-only`);
    await expect(dialog.getByText("Open flags", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Add a manual flag")).toBeVisible();
    await expect(dialog.getByText(/Source-correctable flags can close automatically after a clean monitoring upload/)).toBeVisible();
    const target = dialog.getByLabel("What is this flag about?");
    const category = dialog.getByLabel("Flag category");
    const note = dialog.getByLabel("Note / reason");
    await expect(target.locator("option").first()).toHaveText("Whole record");
    await expect(target.locator("option")).toHaveCount(courses.length + 1);
    await expect(category.locator("option")).toHaveText(["Choose category", ...grid.flag_categories]);
    const save = dialog.getByRole("button", { name: "Save flag" });
    await expect(save).toBeDisabled();
    await category.selectOption("Other");
    await expect(save, "category alone is not enough").toBeDisabled();
    await note.fill("   ");
    await expect(save, "a blank note is not enough").toBeDisabled();
    await note.fill("Pinned by the P6.4 spec");
    await expect(save).toBeEnabled();
    await shotAll(page, "monitoring-flag-dialog", { full: false });

    // Cancel and the X close without saving
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await flagButton.click();
    await expect(dialog).toBeVisible();
    await expect(note, "the form starts empty again").toHaveValue("");
    await dialog.getByRole("button", { name: "Close flag dialog" }).click();
    await expect(dialog).toBeHidden();
    expect(posts).toEqual([]);

    // a click on the backdrop closes it too
    await flagButton.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 400); // left edge, below the sticky header
    await expect(dialog).toBeHidden();

    // save a flag about one subject
    await flagButton.click();
    const subject = courses[0];
    await dialog.getByLabel("What is this flag about?").selectOption({ label: `${subject.code} — ${subject.title}` });
    await dialog.getByLabel("Flag category").selectOption("Other");
    await dialog.getByLabel("Note / reason").fill("Pinned by the P6.4 spec");
    await dialog.getByRole("button", { name: "Save flag" }).click();
    await expect(dialog).toBeHidden();
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe(`/api/students/${salonga.id}/flag-issue`);
    expect(posts[0].body).toEqual({ category: "Other", note: "Pinned by the P6.4 spec", target_kind: "Subject", target_label: `${subject.code} — ${subject.title}` });
    await expect(flagButton).toHaveAttribute("title", "1 open flag(s) for Salonga, Bea");
    await expect(flagButton).toContainText("1");

    // reopen: the open flag is listed with its details
    await flagButton.click();
    await expect(dialog.getByText("Open flags", { exact: true })).toBeVisible();
    await expect(dialog).toContainText("Other");
    await expect(dialog).toContainText(`On: ${subject.code} — ${subject.title}`);
    await expect(dialog).toContainText("Pinned by the P6.4 spec");
    await expect(dialog.getByText("Open", { exact: true })).toBeVisible();
    await shotAll(page, "monitoring-flag-open", { full: false });

    // resolving needs a note; Cancel leaves the flag open
    await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
    const resolve = dialog.getByRole("button", { name: "Resolve flag" });
    await expect(resolve).toBeDisabled();
    await dialog.getByLabel("How was this resolved?").fill("Checked and fixed");
    await expect(resolve).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).first().click();
    await expect(dialog.getByLabel("How was this resolved?")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Resolve", exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
    await dialog.getByLabel("How was this resolved?").fill("Checked and fixed");
    await dialog.getByRole("button", { name: "Resolve flag" }).click();
    await expect(dialog.getByText("Open flags", { exact: true })).toHaveCount(0);
    expect(posts).toHaveLength(2);
    expect(posts[1].path).toMatch(new RegExp(`^/api/students/${salonga.id}/flags/\\d+/resolve$`));
    expect(posts[1].body).toEqual({ resolution_note: "Checked and fixed" });
    await dialog.getByRole("button", { name: "Close flag dialog" }).click();
    await expect(dialog).toBeHidden();
    await expect(flagButton).toHaveAttribute("title", "0 open flag(s) for Salonga, Bea");
  });
});

test.describe("Monitoring Sheet (Research Coordinator, view only)", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("view-only wording, no add button, cells still open the record", async ({ page }) => {
    await page.goto("/workflow/graduation");
    await sidebarLink(page, "Monitoring Sheet").click();
    await expect(heading1(page, "Monitoring Sheet")).toBeVisible();
    await expect(page.getByText("Curriculum progress for each student (view only).")).toBeVisible();
    await expect(page.getByText("View only.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Only Graduate School staff and the Academic Coordinator can edit/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add student" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Export workbook" })).toBeVisible();
    const row = rowOf(page, "Salonga, Bea");
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("button", { name: "View monitoring record of Salonga, Bea" })).toBeVisible();
    await expect(row.locator("button[aria-label$='Select to view.']").first()).toBeVisible();
    await shotAll(page, "monitoring-view-only");
  });
});

// ================================================================================================ Enrollment Class List
test.describe("Enrollment Class List (GS staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("one class: header, pills, roster table and the read-only notice", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await okJson(await page.request.get("/api/monitoring/class-list"), "class list");
    const offering = data.selected_offering;
    expect(offering?.course_code, "a seeded class").toBeTruthy();

    await page.goto("/");
    await sidebarLink(page, "Enrollment Class List").click();
    await expect(page).toHaveURL(/\/enrollment-class-list$/);
    await expect(heading1(page, "Enrollment Class List")).toBeVisible();
    // (P6.4: the small "Enrollment record" line above the title is gone; PageHeader has no eyebrow.)
    await expect(page.getByText("Read-only class rosters synchronized automatically with confirmed Enrollment records.")).toBeVisible();
    await expect(page.getByText("Read-only roster.")).toBeVisible();
    await expect(page.getByText(/Confirm or change enrollment in the Enrollment workspace; this list updates automatically/)).toBeVisible();

    await expect(page.getByLabel("Program", { exact: true })).toHaveValue(String(data.program.id));
    await expect(page.getByLabel("Semester", { exact: true })).toHaveValue(String(data.term.id));
    await expect(page.getByLabel("Class list view", { exact: true })).toHaveValue(String(data.selected_course_id));
    await expect(page.getByLabel("Class list view", { exact: true }).locator("option").first()).toHaveText("All class lists");
    await expect(page.getByLabel("Class list view", { exact: true }).locator("option")).toHaveCount(data.offerings.length + 1);
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();

    await expect(page.getByText("Enrollment-synchronized class list")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: `${offering.course_code} — ${offering.course_title}` })).toBeVisible();
    await expect(page.getByText("Faculty not assigned · Schedule not set · Section not set")).toBeVisible();
    await expect(page.getByText(`${data.summary.students_in_selected_class} listed`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${data.summary.active_students} active`, { exact: true })).toBeVisible();

    const table = page.locator("main table");
    await expect(table).toHaveCount(1);
    expect(await headTexts(table)).toEqual(["Student", "IDNO", "Program", "Enrollment status", "Enrolled", "Source"]);
    const mendoza = rowOf(page, "Mendoza, Bianca");
    await expect(mendoza).toHaveCount(1);
    await expect(mendoza).toContainText("2560052");
    await expect(mendoza).toContainText("DBA");
    await expect(mendoza).toContainText("Enrolled");
    await expect(mendoza).toContainText("Seeded current DBA enrollment");
    await shotAll(page, "class-list-single");

    // another class
    const other = data.offerings.find((o) => o.course_id !== data.selected_course_id);
    await page.getByLabel("Class list view", { exact: true }).selectOption(String(other.course_id));
    await expect(page.getByRole("heading", { level: 3, name: `${other.course_code} — ${other.course_title}` })).toBeVisible();
  });

  test("All class lists shows every class, and Export CSV downloads the roster", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await okJson(await page.request.get("/api/monitoring/class-list?view=all"), "class lists");
    await page.goto("/enrollment-class-list");
    await expect(heading1(page, "Enrollment Class List")).toBeVisible();
    await expect(page.locator("main table")).toHaveCount(1);

    // CSV of the single class first
    const [single] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(single.suggestedFilename()).toBe(`class-list-${(await okJson(await page.request.get("/api/monitoring/class-list"), "cl")).selected_offering.course_code}.csv`);
    const singleRaw = readFileSync(await single.path(), "utf8");
    expect(singleRaw.charCodeAt(0), "byte-order mark (P6.4)").toBe(0xfeff);
    const singleText = singleRaw.slice(1).split("\r\n");
    expect(singleText[0]).toBe('"Subject","Faculty","Student","IDNO","Program","Status","Enrolled at","Source"');
    expect(singleText.join("\r\n")).toContain('"Mendoza, Bianca","2560052","DBA","Enrolled"');

    await page.getByLabel("Class list view", { exact: true }).selectOption("all");
    await expect(page.getByText("All class lists", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: `${data.program.code} · ${data.term.label}` })).toBeVisible();
    await expect(page.getByText("Every offered class is expanded below for one-page review.")).toBeVisible();
    const n = (value, one, many) => `${value} ${value === 1 ? one : many}`;
    await expect(page.getByText(n(data.summary.offered_classes, "class", "classes"), { exact: true })).toBeVisible();
    await expect(page.getByText(n(data.summary.class_list_entries, "roster entry", "roster entries"), { exact: true })).toBeVisible();
    await expect(page.getByText(n(data.summary.unique_students, "student", "students"), { exact: true })).toBeVisible(); // P6.4: "1 student", not "1 students"
    await expect(page.locator("main table")).toHaveCount(data.class_lists.length);
    for (const list of data.class_lists) {
      await expect(page.getByRole("heading", { level: 3, name: `${list.offering.course_code} — ${list.offering.course_title}` })).toBeVisible();
    }
    expect(await headTexts(page.locator("main table").first())).toEqual(["Student", "IDNO", "Program", "Enrollment status", "Enrolled", "Source"]);
    await shotAll(page, "class-list-all");

    const [all] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(all.suggestedFilename()).toBe(`class-lists-all-${data.program.code}.csv`);
    const allText = readFileSync(await all.path(), "utf8");
    for (const list of data.class_lists) expect(allText).toContain(`"${list.offering.course_code}"`);
  });

  test("a program without classes shows the empty state", async ({ page }) => {
    const meta = await okJson(await page.request.get("/api/meta"), "meta");
    let empty = null;
    for (const program of meta.programs) {
      const data = await okJson(await page.request.get(`/api/monitoring/class-list?program_id=${program.id}`), "cl");
      if (!data.offerings.length) { empty = program; break; }
    }
    expect(empty, "a seeded program with no classes this semester").toBeTruthy();
    await page.goto("/enrollment-class-list");
    await expect(heading1(page, "Enrollment Class List")).toBeVisible();
    await page.getByLabel("Program", { exact: true }).selectOption(String(empty.id));
    await expect(page.getByText("No classes offered this semester")).toBeVisible();
    await expect(page.getByText(/Add a subject under Course Adjustments/)).toBeVisible();
    await expect(page.locator("main table")).toHaveCount(0);
    await shotAll(page, "class-list-empty");
  });
});

// ================================================================================================ Adviser record card
test.describe("Record an adviser appointed outside the portal (GS staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("the collapsible form: toggle, required fields, payload and the success note", async ({ page }) => {
    test.setTimeout(120_000);
    const payloads = [];
    await page.route("**/api/adviser-appointments/record", async (route) => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "stubbed by the spec" }) });
    });

    await page.goto("/");
    await sidebarLink(page, "4 · Research Gate").click();
    await page.getByRole("tab", { name: "Adviser designation" }).click();
    await expect(page).toHaveURL(/view=adviser/);

    const toggle = page.getByRole("button", { name: /Record an adviser appointed outside the portal/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("For students imported from the monitoring sheet who already have an adviser.");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#adviser-record-form")).toHaveCount(0);
    await shotAll(page, "adviser-card-closed");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const form = page.locator("#adviser-record-form");
    await expect(form).toBeVisible();
    await expect(form.getByText(/^Student \*$/)).toBeVisible();
    await expect(form.getByLabel("Research adviser")).toBeVisible();
    await expect(form.getByLabel("Appointment date")).toBeVisible();
    await expect(form.getByText("Leave empty to use today.")).toBeVisible();
    await expect(form.getByLabel("Note (optional)")).toHaveAttribute("maxlength", "500");
    await shotAll(page, "adviser-card-open");

    // nothing chosen -> a message, nothing sent
    await form.getByRole("button", { name: "Record the appointment" }).click();
    await expect(form.getByText("Choose the student and the adviser.")).toBeVisible();
    expect(payloads).toEqual([]);

    // choose a student through the picker, an adviser, a date and a note
    await form.getByRole("searchbox", { name: "Search a student" }).fill("Castillo");
    await form.getByRole("button", { name: /Irene Castillo/ }).click();
    await expect(form.getByText("Selected student")).toBeVisible();
    await form.getByLabel("Research adviser").selectOption({ index: 1 });
    const adviserLabel = await form.getByLabel("Research adviser").locator("option:checked").textContent();
    await form.getByLabel("Appointment date").fill("2026-09-01");
    await form.getByLabel("Note (optional)").fill("Appointed by letter before the portal");
    await form.getByRole("button", { name: "Record the appointment" }).click();

    await expect(form.getByText(`Recorded: ${adviserLabel} is now the adviser of Castillo, Irene.`)).toBeVisible();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({ appointed_on: "2026-09-01", note: "Appointed by letter before the portal" });
    expect(typeof payloads[0].student_id).toBe("number");
    expect(typeof payloads[0].faculty_id).toBe("number");
    // the form is cleared, the picker is back
    await expect(form.getByRole("searchbox", { name: "Search a student" })).toBeVisible();
    await expect(form.getByLabel("Note (optional)")).toHaveValue("");

    // collapsing keeps the success note visible
    await toggle.click();
    await expect(page.locator("#adviser-record-form")).toHaveCount(0);
    await expect(page.getByText(`Recorded: ${adviserLabel} is now the adviser of Castillo, Irene.`)).toBeVisible();
    await shotAll(page, "adviser-card-done");
  });
});
