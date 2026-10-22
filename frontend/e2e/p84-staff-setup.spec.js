// Packet P6.5 (Phase 5 migration of pages/CourseAdjustments.jsx, CourseOfferings.jsx, CoursePlanning.jsx,
// TermSettings.jsx, PolicyDocuments.jsx; issues I-069 = review F-15, I-081 part = F-27, I-063 part = F-09).
//
// Part 1 ("pins") was written BEFORE the migration and is green on the old code: the five staff set-up pages keep
// their headings, filters, key controls, dialogs and main tables. Part 2 ("P6.5 changes") holds the assertions for what
// changes on purpose and was committed RED first:
//   - I-069  Course Adjustments is ONE decision table (subject, demand, decision, sections, faculty). A faculty
//            suggestion is shown on a row only when it differs between subjects; when every subject has the same
//            suggestion no row shows it and ONE note above the table says so. A row's details open in a drawer.
//   - F-09   the five pages open with the one PageHeader (an h1.page-title, no dark-green hero, no eyebrow line).
//   - I-081  the Policy Documents "Test a question" placeholder is a real graduate-school question.
//
// Everything is reached through the real sidebar. Read-only: nothing is saved (a faculty choice on the Course
// Adjustments page autosaves, so the pins never change it; the faculty-profile dialog is opened by mocking the
// GET response with page.route). The expectations are read from the API at test time (e2e/README.md "Specs share one
// database"): no count, plan status or document list is assumed.
// Screenshots go to E2E_SHOTS_DIR (default e2e-artifacts/p84) at 1366, 1920 and 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p84");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const VIEWS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
];

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p84", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ helpers
const main = (page) => page.locator("main");
const heading1 = (page, name) => page.getByRole("heading", { level: 1, name });
const sidebarLink = (page, name) => page.locator("aside nav").getByRole("link", { name });
const norm = (text) => (text || "").replace(/\s+/g, " ").trim();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Screenshot at 1366, 1920 and 390 (full page), then back to 1366. */
async function shotAll(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500); // the page's own fade-in
  for (const view of VIEWS) {
    await page.setViewportSize(view);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${name}-${view.width}.png`), fullPage: true });
  }
  await page.setViewportSize(VIEWS[0]);
  await page.waitForTimeout(200);
}

/** The JSON of the next GET of /api/<path> (exact path, any query) - call BEFORE the action that loads it. */
function nextGet(page, path) {
  return page
    .waitForResponse((r) => new URL(r.url()).pathname === `/api/${path}` && r.request().method() === "GET")
    .then((r) => r.json());
}

/** What the page does with the plan: the same rule as CourseAdjustments.jsx (canEdit). */
function canEditOf(data) {
  const status = data.latest_plan?.status || null;
  return data.permissions?.can_manage === true && (status === null || status === "Draft" || status === "Returned") && data.planning_window_open !== false;
}

/** The figure printed beside a label, whichever way the tile is built (value then label, or label then value). */
const tileOf = (page, label) => main(page).getByText(label, { exact: true }).first().locator("xpath=..");

async function openCourseAdjustments(page) {
  const loaded = nextGet(page, "course-adjustments");
  await page.goto("/");
  await sidebarLink(page, /Course Adjustments$/).click();
  await expect(page).toHaveURL(/\/course-adjustments/);
  await expect(heading1(page, "Course Adjustments")).toBeVisible();
  const data = await loaded;
  await expect(main(page).getByText("Course offering decisions", { exact: true })).toBeVisible();
  return data;
}

async function openOfferingSetup(page) {
  await openCourseAdjustments(page);
  const loaded = nextGet(page, "course-offerings");
  await page.getByRole("tab", { name: "Offering setup" }).click();
  const data = await loaded;
  await expect(main(page).getByRole("heading", { name: "Course Offering Setup" })).toBeVisible();
  // the page writes the program and semester into the URL and loads once more (which clears local edits): let it settle
  await expect(page).toHaveURL(/program_id=\d+/);
  await page.waitForLoadState("networkidle");
  return data;
}

// ================================================================================================ Part 1: pins
test.describe("pins: the five set-up pages keep their behaviour (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("Course Adjustments: heading, tabs, filters, plan card, figures and one decision per subject", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openCourseAdjustments(page);

    await expect(main(page).getByText("Review subject demand, decide what to offer, then complete the semester schedule and faculty assignments in one workspace.")).toBeVisible();

    // the two screens of the workspace
    const tabs = page.getByRole("tablist", { name: "Course adjustment screens" });
    await expect(tabs.getByRole("tab", { name: "Demand & adjustments" })).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab", { name: "Offering setup" })).toHaveAttribute("aria-selected", "false");

    // filters
    await expect(page.getByLabel("Program", { exact: true })).toHaveValue(String(data.program.id));
    await expect(page.getByLabel("Academic year and semester")).toBeVisible();
    await expect(main(page).getByText("Subject needs are calculated automatically")).toBeVisible();

    // the plan card: the four steps, the status sentence, the actions (staff only read)
    for (const step of ["Draft", "Submitted", "Approved", "Published"]) {
      await expect(main(page).getByText(new RegExp(`(^|\\s|\\d)${step}$`)).first()).toBeVisible(); // "1Draft", "Draft", "Current: Draft"
    }
    await expect(main(page).getByText("Graduate School Staff have read-only access.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Save|Update) draft/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

    // the four figures
    const offered = data.demand.filter((row) => {
      const status = row.offering_status || (row.demand_count > 0 ? "Suggested" : null);
      return status === "Offered" || status === "Suggested";
    }).length;
    await expect(tileOf(page, "Curriculum subjects")).toContainText(String(data.summary.curriculum_subjects ?? data.demand.length));
    await expect(tileOf(page, "Affected students")).toContainText(String(data.summary.affected_students ?? 0));
    await expect(tileOf(page, "Delayed if withheld")).toContainText(String(data.summary.students_delayed_if_not_offered ?? 0));
    await expect(tileOf(page, "Selected to offer")).toContainText(String(offered));

    // the subject-needs report and the decisions
    await expect(main(page).getByText("Subject-needs report")).toBeVisible();
    await expect(main(page).getByText("Course offering decisions", { exact: true })).toBeVisible();
    await expect(main(page).locator('input[aria-label^="Sections for "]')).toHaveCount(data.demand.length);
    await expect(main(page).locator('select[aria-label^="Faculty assignment for "]')).toHaveCount(data.demand.length);
    for (const row of data.demand) {
      await expect(main(page).locator(`input[aria-label="Sections for ${row.course.code}"]`)).toBeDisabled();
      await expect(main(page).locator(`button[aria-label="Offer ${row.course.code}"], button[aria-label="Hold ${row.course.code}"]`)).toHaveCount(1);
    }

    // the coursework report panel below
    await expect(main(page).getByRole("heading", { name: "Coursework status report to the Dean" })).toBeVisible();
    await expect(main(page).getByText("Adding or changing a subject: rules applied")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await shotAll(page, "course-adjustments-staff");
  });

  test("Course Adjustments: an assigned faculty member has a View profile button that opens the profile dialog", async ({ page }) => {
    test.setTimeout(120_000);
    // The live plan may have nobody assigned (it autosaves on any change), so the first row is shown as assigned.
    await page.route("**/api/course-adjustments*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      if (body.demand?.length && body.faculty_profiles?.length) body.demand[0].assigned_faculty_id = body.faculty_profiles[0].id;
      return route.fulfill({ response, json: body });
    });
    const data = await openCourseAdjustments(page);
    const faculty = data.faculty_profiles[0];
    const view = main(page).getByRole("button", { name: "View profile" });
    await expect(view).toHaveCount(1);
    await view.click();
    const dialog = page.getByRole("dialog", { name: faculty.name });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Preferred subjects")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("Offering setup: heading, filters, the offerings table and its empty state", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openOfferingSetup(page);
    await expect(page).toHaveURL(/view=offerings/);
    await expect(page.getByRole("tab", { name: "Offering setup" })).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByText("Complete the official offering list, then choose the faculty, schedule, and section.")).toBeVisible();
    await expect(page.getByLabel("Program", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Semester", { exact: true })).toBeVisible();

    if (data.offerings.length) {
      const table = main(page).locator("table").first();
      const heads = await table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
      expect(heads).toEqual(["Subject", "Faculty", "Schedule", "Section", "Enrolled"]); // staff only read: no Actions column
      await expect(table.locator("tbody tr")).toHaveCount(data.offerings.length);
      for (const offering of data.offerings) await expect(table.locator("tbody tr").filter({ hasText: offering.code }).first()).toBeVisible();
    } else {
      await expect(main(page).getByText("No subjects offered yet for this semester")).toBeVisible();
    }
    // staff cannot add or edit offerings
    await expect(main(page).getByText("Add a subject to this semester's offerings")).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Add offering" })).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
    await shotAll(page, "offering-setup-staff");
  });

  test("Academic Semesters: heading, actions, the semesters table and its dialogs", async ({ page }) => {
    test.setTimeout(120_000);
    const loaded = nextGet(page, "admin/terms");
    await page.goto("/");
    await sidebarLink(page, "Academic Semesters").click();
    await expect(page).toHaveURL(/\/term-settings$/);
    await expect(heading1(page, "Academic Semesters")).toBeVisible();
    const terms = (await loaded).items;
    await expect(main(page).getByText("Maintain the list of academic semesters and mark the current planning term.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add semester", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add next semester" })).toBeVisible();

    // the table: one row per semester, the current one marked
    const table = main(page).locator("table").first();
    const heads = await table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(heads).toEqual(["Semester", "Semester dates", "Actions"]);
    await expect(table.locator("tbody tr")).toHaveCount(terms.length);
    const current = terms.find((term) => term.is_active_planning_term);
    if (current) {
      const row = table.locator("tbody tr").filter({ hasText: current.label });
      await expect(row.getByText("Current", { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: /Set as current/ })).toHaveCount(0);
      await expect(row.getByRole("button", { name: /Remove/ })).toBeDisabled();
    }
    await shotAll(page, "academic-semesters-staff");

    // Set as current -> a confirmation dialog; Cancel changes nothing
    const other = terms.find((term) => !term.is_active_planning_term);
    const otherRow = table.locator("tbody tr").filter({ hasText: other.label }).first();
    await otherRow.getByRole("button", { name: /Set as current/ }).click();
    const confirm = page.getByRole("dialog", { name: "Set as the current semester?" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(other.label)).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);

    // Remove -> a danger confirmation dialog; Cancel changes nothing
    await otherRow.getByRole("button", { name: /Remove/ }).click();
    const removal = page.getByRole("dialog", { name: "Remove this academic semester?" });
    await expect(removal).toBeVisible();
    await removal.getByRole("button", { name: "Cancel" }).click();
    await expect(removal).toHaveCount(0);

    // Edit dates -> the date fields; saving without a change says so
    await otherRow.getByRole("button", { name: /Edit dates/ }).click();
    await expect(page.getByText(`Edit dates: ${other.label}`)).toBeVisible();
    await expect(page.getByLabel("Start date")).toBeVisible();
    await expect(page.getByLabel("Planning opens (optional)")).toBeVisible();
    await page.getByRole("button", { name: "Save dates" }).click();
    await expect(page.getByText("No dates were changed.")).toBeVisible();
    await expect(page.getByText(`Edit dates: ${other.label}`)).toHaveCount(0);

    // Add semester -> the form; saving it empty is refused on the page
    await page.getByRole("button", { name: "Add semester", exact: true }).click();
    await expect(page.getByLabel("Semester name")).toBeVisible();
    await page.getByRole("button", { name: "Save semester" }).click();
    await expect(page.getByText("Enter the semester name, start date, and end date.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Semester name")).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
  });

  test("Policy Documents: heading, figures, test question, filters, document cards, menu and the add dialog", async ({ page }) => {
    test.setTimeout(120_000);
    const loaded = nextGet(page, "policy-documents");
    await page.goto("/");
    await sidebarLink(page, "Policy Documents").click();
    await expect(page).toHaveURL(/\/policy-documents$/);
    await expect(heading1(page, "Policy Documents")).toBeVisible();
    const data = await loaded;
    await expect(main(page).getByText("Manage the approved PDF and Word documents the Policy Assistant searches.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add document" })).toBeVisible();

    // the four figures
    await expect(tileOf(page, "All sources")).toContainText(String(data.summary.total || 0));
    await expect(tileOf(page, "Staff uploads")).toContainText(String(data.summary.managed || 0));
    await expect(tileOf(page, "Drafts pending validation")).toContainText(String(data.summary.draft || 0));
    await expect(tileOf(page, "Ready for assistant")).toContainText(String(data.summary.ready || 0));

    // test a question: the box, the sample questions, a run
    await expect(main(page).getByRole("heading", { name: "Test a question" })).toBeVisible();
    const question = page.getByLabel("Question to test");
    await expect(question).toBeVisible();
    await expect(page.getByRole("button", { name: "Find passages" })).toBeDisabled();
    await main(page).getByRole("button", { name: "What is the maximum residence period for a master's program?" }).click();
    await expect(main(page).locator('[aria-live="polite"]')).not.toBeEmpty({ timeout: 30_000 });
    await expect(question).toHaveValue("What is the maximum residence period for a master's program?");

    // one card per document, each with its status
    await expect(main(page).getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    for (const item of data.items) {
      await expect(main(page).getByRole("heading", { level: 3, name: item.title })).toBeVisible();
    }
    for (const item of data.items.filter((entry) => entry.status === "draft")) {
      await expect(main(page).getByText("pending validation", { exact: false }).first()).toBeVisible();
      expect(item.title).toBeTruthy();
    }

    // filters
    const search = page.getByLabel("Search documents");
    await search.fill("zz-no-such-document-zz");
    await expect(main(page).getByText("No documents found")).toBeVisible();
    await expect(main(page).getByText("Try a different search or clear the filters.")).toBeVisible();
    await search.fill("");
    await expect(main(page).getByRole("heading", { level: 3, name: data.items[0].title })).toBeVisible();
    await page.getByLabel("Filter by status").selectOption("archived");
    const archived = data.items.filter((entry) => entry.status === "archived");
    if (!archived.length) await expect(main(page).getByText("No documents found")).toBeVisible();
    await page.getByLabel("Filter by status").selectOption("");
    await expect(page.getByLabel("Filter by category")).toBeVisible();

    // the card menu of a staff upload
    const managed = data.items.find((entry) => entry.can_edit);
    if (managed) {
      await page.getByRole("button", { name: `Actions for ${managed.title}` }).click();
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitem", { name: /Edit details/ })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /Replace file/ })).toBeVisible();
      await menu.getByRole("menuitem", { name: /Edit details/ }).click();
      const edit = page.getByRole("dialog", { name: "Edit document details" });
      await expect(edit).toBeVisible();
      await expect(edit.getByLabel("Document title")).toHaveValue(managed.title);
      await edit.getByRole("button", { name: "Cancel" }).click();
      await expect(edit).toHaveCount(0);
    }
    await shotAll(page, "policy-documents-staff");

    // the add dialog: a drop zone, the fields, nothing to save until a file is chosen
    await page.getByRole("button", { name: "Add document" }).click();
    const add = page.getByRole("dialog", { name: "Add policy document" });
    await expect(add).toBeVisible();
    await expect(add.getByText("Drag a PDF or Word file here, or click to choose")).toBeVisible();
    for (const label of ["Document title", "Category", "Effective date", "Status", "Description (optional)"]) {
      await expect(add.getByLabel(label, { exact: false }).first()).toBeVisible();
    }
    await expect(add.getByRole("button", { name: "Upload and index" })).toBeDisabled();
    await add.getByLabel("Document title").fill("A title without a file");
    await expect(add.getByRole("button", { name: "Upload and index" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(add).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
  });
});

test.describe("pins: the Academic Coordinator edits the offering setup", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

  test("Course Adjustments: the decision controls follow the plan status", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openCourseAdjustments(page);
    const canEdit = canEditOf(data);
    await expect(main(page).getByText("Graduate School Staff have read-only access.")).toHaveCount(0);
    const sections = main(page).locator('input[aria-label^="Sections for "]');
    await expect(sections).toHaveCount(data.demand.length);
    if (canEdit) {
      await expect(sections.first()).toBeEnabled();
      await expect(page.getByRole("button", { name: "Submit for approval" })).toBeEnabled();
    } else {
      await expect(sections.first()).toBeDisabled();
    }
    // the hold/offer toggle of the first subject is named after its code
    const code = data.demand[0].course.code;
    await expect(main(page).locator(`button[aria-label="Offer ${code}"], button[aria-label="Hold ${code}"]`)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
  });

  test("Offering setup: add control, editable rows, View profile dialog, remove confirmation", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openOfferingSetup(page);
    expect(data.permissions.can_manage).toBe(true);
    await expect(main(page).getByText("Add a subject to this semester's offerings")).toBeVisible();
    await expect(page.getByLabel("Subject to add to this semester's offerings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add offering" })).toBeDisabled(); // nothing chosen yet

    test.skip(!data.offerings.length, "no offerings to edit on this database");
    const table = main(page).locator("table").first();
    const heads = await table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(heads).toEqual(["Subject", "Faculty", "Schedule", "Section", "Enrolled", "Actions"]);
    const code = data.offerings[0].code;
    const row = table.locator("tbody tr").filter({ hasText: code }).first();
    await expect(row.getByLabel(`Schedule for ${code}`)).toBeVisible();
    await expect(row.getByLabel(`Section for ${code}`)).toBeVisible();
    await expect(row.getByRole("button", { name: /Save/ })).toBeVisible();

    // choosing a faculty member is local until Save; it reveals View profile, which opens the profile dialog
    const select = row.getByLabel(`Faculty for ${code}`);
    await select.selectOption({ index: 1 });
    const chosen = Number(await select.inputValue());
    const faculty = data.faculty_profiles.find((entry) => entry.id === chosen);
    await row.getByRole("button", { name: "View profile" }).click();
    const dialog = page.getByRole("dialog", { name: faculty.name });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await row.getByRole("button", { name: `Remove ${code} from the offerings` }).click();
    const removal = page.getByRole("dialog", { name: "Remove this offering?" });
    await expect(removal).toBeVisible();
    await removal.getByRole("button", { name: "Cancel" }).click();
    await expect(removal).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
    await shotAll(page, "offering-setup-coordinator");
  });
});

// ================================================================================================ Part 2: P6.5 changes (RED first)
/** The decision row of one subject (found by its Sections box, so DBA-COG1 never matches DBA-COG10). */
const rowOf = (page, table, code) => table.locator("tbody tr").filter({ has: page.locator(`input[aria-label="Sections for ${code}"]`) });
const headTexts = (table) => table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));

test.describe("P6.5: one header style on the five pages (review F-09)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [label, path, title] of [
    ["Course Adjustments", /Course Adjustments$/, "Course Adjustments"],
    ["Academic Semesters", "Academic Semesters", "Academic Semesters"],
    ["Policy Documents", "Policy Documents", "Policy Documents"],
  ]) {
    test(`${label}: the title is the PageHeader (one h1.page-title in a header, no hero, no eyebrow line)`, async ({ page }) => {
      await page.goto("/");
      await sidebarLink(page, path).click();
      await expect(heading1(page, title)).toBeVisible();
      await expect(main(page).locator("h1")).toHaveCount(1);
      await expect(main(page).locator("h1.page-title")).toHaveCount(1);
      await expect(main(page).locator("h1").locator("xpath=ancestor::header[1]")).toHaveCount(1);
      await expect(main(page).locator(".bg-gradient-to-br")).toHaveCount(0);
      await expect(main(page).getByText(/Academic lifecycle/i)).toHaveCount(0);
      await expect(main(page).getByText(/Who uses it/i)).toHaveCount(0);
    });
  }

  test("Offering setup: still one h1 (the page's), and the section is an h2", async ({ page }) => {
    await openOfferingSetup(page);
    await expect(main(page).locator("h1")).toHaveCount(1);
    await expect(main(page).locator("h1.page-title")).toHaveCount(1);
    await expect(main(page).getByRole("heading", { level: 2, name: "Course Offering Setup" })).toBeVisible();
  });
});

test.describe("P6.5: Course Adjustments is one decision table (I-069, review F-15)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("one table: subject, demand, decision, sections, faculty; one row per subject, none taller than 96 px on average (two-line subject titles; the old stacked cards were ~250 px)", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openCourseAdjustments(page);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    await expect(table).toBeVisible();
    const heads = await headTexts(table);
    expect(heads.slice(0, 5)).toEqual(["Subject", "Demand", "Decision", "Sections", "Faculty"]);
    await expect(table.locator("tbody tr")).toHaveCount(data.demand.length);
    for (const row of data.demand) {
      const line = rowOf(page, table, row.course.code);
      await expect(line).toBeVisible();
      await expect(line.locator(`input[aria-label="Sections for ${row.course.code}"]`)).toHaveCount(1);
      await expect(line.locator(`select[aria-label="Faculty assignment for ${row.course.code}"]`)).toHaveCount(1);
      await expect(line.locator(`button[aria-label="Offer ${row.course.code}"], button[aria-label="Hold ${row.course.code}"]`)).toHaveCount(1);
    }
    const box = await table.locator("tbody").boundingBox();
    expect(box.height / data.demand.length, `average row height ${Math.round(box.height / data.demand.length)} px`).toBeLessThan(96);
    // the stacked cards of the old page are gone
    await expect(main(page).getByText(/^Show the \d+ affected students?$/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(4300); // was 4,790 px before P6.5; real subject titles add lines (I-117 merges the two subject lists)
    for (const view of VIEWS.slice(1)) {
      await page.setViewportSize(view);
      expect(await noOverflow(page), `sideways scroll at ${view.width}`).toBe(true);
    }
  });

  test("the plan's four steps are one Stepper whose current step is the plan status", async ({ page }) => {
    const data = await openCourseAdjustments(page);
    const steps = main(page).getByRole("list", { name: "Offering plan progress" });
    await expect(steps.getByRole("listitem")).toHaveCount(4);
    const known = ["Draft", "Submitted", "Approved", "Published"];
    const status = data.latest_plan?.status || null;
    await expect(steps.locator('[aria-current="step"]')).toHaveCount(known.includes(status) ? 1 : 0);
    if (known.includes(status)) await expect(steps.locator('[aria-current="step"]')).toContainText(status);
  });

  test("when every subject has the same suggested faculty member no row repeats it; one note above the table says so", async ({ page }) => {
    // the live data is the 18-subject case; force it so the test does not depend on the seed
    await page.route("**/api/course-adjustments*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      for (const row of body.demand) row.faculty_candidates = [{ id: 1, name: "Dr. Same Everywhere", preferred: false, current_load: 0, projected_load: 3 }];
      return route.fulfill({ response, json: body });
    });
    const data = await openCourseAdjustments(page);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    await expect(table).toBeVisible();
    await expect(table.getByText(/Suggested:/)).toHaveCount(0);
    await expect(table.getByText("Dr. Same Everywhere")).toHaveCount(0);
    const note = main(page).getByText(/same suggested faculty member/);
    await expect(note).toHaveCount(1);
    await expect(note).toContainText("Dr. Same Everywhere");
    const noteBox = await note.boundingBox();
    const tableBox = await table.boundingBox();
    expect(noteBox.y, "the note sits above the table").toBeLessThan(tableBox.y);
    expect(data.demand.length).toBeGreaterThan(1);
  });

  test("when the suggestions differ each row shows its own and there is no 'same for every subject' note", async ({ page }) => {
    await page.route("**/api/course-adjustments*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.demand.forEach((row, i) => {
        row.faculty_candidates = [{ id: 1 + (i % 2), name: i % 2 ? "Dr. Beta Reyes" : "Dr. Alpha Cruz", preferred: false, current_load: 0, projected_load: 3 }];
      });
      return route.fulfill({ response, json: body });
    });
    const data = await openCourseAdjustments(page);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    await expect(main(page).getByText(/same suggested faculty member/)).toHaveCount(0);
    await expect(rowOf(page, table, data.demand[0].course.code)).toContainText("Suggested: Dr. Alpha Cruz");
    await expect(rowOf(page, table, data.demand[1].course.code)).toContainText("Suggested: Dr. Beta Reyes");
  });

  test("a row's details (who is affected) open in a drawer, not in the row", async ({ page }) => {
    test.setTimeout(120_000);
    const data = await openCourseAdjustments(page);
    const withStudents = data.demand.find((row) => (row.affected_students || []).length > 0);
    test.skip(!withStudents, "no subject has an affected student on this database");
    const code = withStudents.course.code;
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    await table.getByRole("button", { name: `Details for ${code}` }).click();
    const drawer = page.getByRole("dialog", { name: new RegExp(code) });
    await expect(drawer).toBeVisible();
    for (const student of withStudents.affected_students.slice(0, 3)) await expect(drawer.getByText(student.name).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(table.getByRole("button", { name: `Details for ${code}` })).toBeFocused();
  });
});

// I-117: the Subject-needs report and the Course offering decisions listed the same subjects twice (page ~4,000 px at
// 1366). Now ONE table: subject, needing next term, not taken yet, decision, sections, faculty, Details. "Show students"
// and "delayed if withheld" live in the row's Details drawer.
test.describe("I-117: Course Adjustments lists each subject once", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  /** The page's two GETs: the plan with its demand rows, and the subject-needs report. */
  async function openWithReport(page) {
    const reportLoaded = nextGet(page, "course-adjustments/subject-needs-report");
    const data = await openCourseAdjustments(page);
    const report = await reportLoaded;
    return { data, report };
  }
  // the title follows the code with no space in the row text, so a code ending in a digit must not be followed by another digit (COG1 vs COG10)
  const codeRe = (code) => new RegExp(code + (/[0-9]$/.test(code) ? "(?![0-9])" : ""));

  test("the page is under 3,000 px tall at 1366 and each subject code is in exactly one table row, not in a second list", async ({ page }) => {
    test.setTimeout(120_000);
    const { data } = await openWithReport(page);
    for (const row of data.demand) {
      const re = codeRe(row.course.code);
      await expect(main(page).locator("tr").filter({ hasText: re }), `${row.course.code} rows`).toHaveCount(1);
      await expect(main(page).getByRole("listitem").filter({ hasText: re }), `${row.course.code} list items`).toHaveCount(0);
    }
    await expect(main(page).getByRole("heading", { name: "Subject-needs report" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Show students" })).toHaveCount(0);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height, `page height ${height} px`).toBeLessThan(3000);
  });

  test("columns: subject, needing next term, not taken yet, decision, sections, faculty, details - with the report's numbers", async ({ page }) => {
    test.setTimeout(120_000);
    const { data, report } = await openWithReport(page);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    expect(await headTexts(table)).toEqual(["Subject", "Needing next term", "Not taken yet", "Decision", "Sections", "Faculty", "Details"]);
    await expect(table.locator("tbody tr")).toHaveCount(data.demand.length);
    const byCourse = new Map(report.rows.map((row) => [row.course.id, row]));
    for (const row of data.demand) {
      const line = rowOf(page, table, row.course.code);
      const mine = byCourse.get(row.course.id);
      const cells = line.locator("td");
      await expect(cells.nth(1), `${row.course.code} needing next term`).toHaveText(new RegExp("^\\s*" + (mine ? mine.need_count : 0) + "(\\D|$)"));
      await expect(cells.nth(2), `${row.course.code} not taken yet`).toHaveText(new RegExp("^\\s*" + (mine ? mine.not_taken_count : 0) + "(\\D|$)"));
    }
    // the report's other parts: summary figures and the download
    await expect(main(page).getByText(new RegExp(`${report.summary.students_reviewed} students? reviewed`))).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Download CSV" })).toBeVisible();
  });

  test("the later subjects are a filter; the default shows every subject", async ({ page }) => {
    test.setTimeout(120_000);
    const { data, report } = await openWithReport(page);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    const due = report.rows.filter((row) => row.need_count > 0).length;
    const later = report.rows.filter((row) => row.need_count === 0 && row.not_taken_count > 0).length;
    const all = main(page).getByRole("button", { name: /^All subjects/ });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(table.locator("tbody tr")).toHaveCount(data.demand.length);
    await main(page).getByRole("button", { name: /^Needed next term/ }).click();
    await expect(table.locator("tbody tr")).toHaveCount(due);
    await main(page).getByRole("button", { name: /^Later in the curriculum/ }).click();
    await expect(table.locator("tbody tr")).toHaveCount(later);
    await all.click();
    await expect(table.locator("tbody tr")).toHaveCount(data.demand.length);
  });

  test("Details holds the students (Show students) and who is delayed if the subject is withheld", async ({ page }) => {
    test.setTimeout(120_000);
    const { data, report } = await openWithReport(page);
    const mine = report.rows.find((row) => row.need_count > 0);
    test.skip(!mine, "no subject is needed next term on this database");
    const demand = data.demand.find((row) => row.course.id === mine.course.id);
    const table = main(page).getByRole("table", { name: "Course offering decisions" });
    await table.getByRole("button", { name: `Details for ${mine.course.code}` }).click();
    const drawer = page.getByRole("dialog", { name: new RegExp(mine.course.code) });
    await expect(drawer).toBeVisible();
    const due = mine.students.filter((student) => student.due_next);
    const everyone = drawer.getByRole("button", { name: `All who have not taken it (${mine.students.length})` });
    await expect(drawer.getByRole("button", { name: `Needing next term (${due.length})` })).toHaveAttribute("aria-pressed", "true");
    for (const student of due.slice(0, 3)) await expect(drawer.getByText(student.name).first()).toBeVisible();
    await everyone.click();
    await expect(everyone).toHaveAttribute("aria-pressed", "true");
    for (const student of mine.students.slice(0, 3)) await expect(drawer.getByText(student.name).first()).toBeVisible();
    if (demand.delayed_count) await expect(drawer.getByText(new RegExp(`${demand.delayed_count} delayed if withheld`)).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
});

test.describe("P6.5: the library on the other pages", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("Offering setup and Academic Semesters tables are DataTables; Academic Semesters dialogs are real dialogs", async ({ page }) => {
    test.setTimeout(120_000);
    const offerings = await openOfferingSetup(page);
    if (offerings.offerings.length) await expect(main(page).locator("[data-table-scroll] table")).toHaveCount(1);

    await page.goto("/");
    await sidebarLink(page, "Academic Semesters").click();
    await expect(heading1(page, "Academic Semesters")).toBeVisible();
    await expect(main(page).locator("[data-table-scroll] table")).toHaveCount(1);
    const currentRow = main(page).locator("tbody tr").filter({ has: page.getByText("Current", { exact: true }) });
    await expect(currentRow.locator("[data-status-tone]")).toHaveCount(1);

    const other = main(page).locator("tbody tr").filter({ hasNot: page.getByText("Current", { exact: true }) }).first();
    await other.getByRole("button", { name: /Edit dates/ }).click();
    const edit = page.getByRole("dialog", { name: /^Edit dates/ });
    await expect(edit).toBeVisible();
    await expect(edit.locator("[data-modal-header]")).toHaveCount(1);
    await expect(edit.getByLabel("Start date")).toBeVisible();
    await edit.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).toHaveCount(0);

    await page.getByRole("button", { name: "Add semester", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Add semester" });
    await expect(add).toBeVisible();
    await add.getByRole("button", { name: "Save semester" }).click();
    await expect(add.getByText("Enter the semester name, start date, and end date.")).toBeVisible(); // the message is IN the dialog
    await page.keyboard.press("Escape");
    await expect(add).toHaveCount(0);
  });

  test("Policy Documents: library tiles, chips and dialog; the test-question example is a graduate-school question (I-081)", async ({ page }) => {
    test.setTimeout(120_000);
    const loaded = nextGet(page, "policy-documents");
    await page.goto("/");
    await sidebarLink(page, "Policy Documents").click();
    await expect(heading1(page, "Policy Documents")).toBeVisible();
    const data = await loaded;
    await expect(main(page).locator('[data-slot="label"]')).toHaveText(["All sources", "Staff uploads", "Drafts pending validation", "Ready for assistant"]);
    await expect(main(page).locator("[data-status-tone]").first()).toBeVisible();
    for (const item of data.items) {
      const card = main(page).locator("h3", { hasText: item.title }).locator("xpath=ancestor::*[contains(@class,'card')][1]");
      await expect(card.locator("[data-status-tone]").first()).toContainText(/Active|Draft|Archived/);
    }
    const placeholder = await page.getByLabel("Question to test").getAttribute("placeholder");
    expect(placeholder).not.toMatch(/library|tablet/i);
    expect(placeholder).toMatch(/leave of absence/i);

    await page.getByRole("button", { name: "Add document" }).click();
    const add = page.getByRole("dialog", { name: "Add policy document" });
    await expect(add.locator("[data-modal-header]")).toHaveCount(1);
    await expect(add.locator("[data-modal-footer]")).toContainText("Upload and index");
    await page.keyboard.press("Escape");
    await expect(add).toHaveCount(0);
  });
});
