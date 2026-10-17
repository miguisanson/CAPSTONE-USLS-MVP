// Behaviour pin for packet P6.1 (Phase 5 migration of pages/Students.jsx, pages/Dashboard.jsx, pages/WorkQueue.jsx).
// Written BEFORE the migration and green on the old code, so it proves the migrated pages keep the same data, the same
// API query parameters, the same filters, the same links and the same actions. It reaches everything through the real
// UI as Graduate School staff and never changes data (no merge, no conflict resolution). It avoids text that the
// migration is allowed to change (headings, "Showing a-b of n" dash style, tile layouts) and pins what must not change:
// the requests the pages send, the URL they keep, where links go, what a click does.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "staff.json") });

let tracker;
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P6.1 pages", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

/** Wait for the next GET of `pathname` whose query string satisfies `ok(searchParams)`; resolves to { params, json }. */
function apiGet(page, pathname, ok = () => true) {
  return page
    .waitForResponse((r) => {
      const u = new URL(r.url());
      return r.request().method() === "GET" && u.pathname === pathname && ok(u.searchParams);
    })
    .then(async (r) => ({ params: new URL(r.url()).searchParams, json: await r.json() }));
}
const q = (params, key) => params.get(key) || "";
const rows = (page) => page.locator("tbody tr");

test.describe("Students page", () => {
  test("search, filters, clear, paging and opening a record keep their API calls and URL", async ({ page }) => {
    const first = apiGet(page, "/api/students");
    await page.goto("/students");
    const { params: p0, json: list } = await first;
    expect(p0.get("page_size"), "the list asks for 25 per page").toBe("25");
    expect(q(p0, "q")).toBe("");
    expect(list.total, "the demo data has more than one page of students, so paging can be pinned").toBeGreaterThan(25);
    expect(list.pages).toBeGreaterThan(1);
    await expect(rows(page)).toHaveCount(Math.min(25, list.items.length));
    // the columns the old table showed
    for (const h of ["Student", "Program", "Stage", "Enrollment", "Standing", "Risk", "Compre exam", "Adviser"]) {
      await expect(page.getByRole("columnheader", { name: h }), `column ${h}`).toBeVisible();
    }
    // first row shows the first student's name and number
    await expect(rows(page).first()).toContainText(list.items[0].name);
    await expect(rows(page).first()).toContainText(list.items[0].student_number);

    // ---- paging: Next -> page 2, URL keeps ?page=2; Previous -> page 1, ?page= leaves the URL
    const next = apiGet(page, "/api/students", (p) => p.get("page") === "2");
    await page.getByRole("button", { name: /Next/ }).click();
    const { params: p2, json: list2 } = await next;
    expect(p2.get("page_size")).toBe("25");
    await expect(page).toHaveURL(/[?&]page=2(&|$)/);
    expect(list2.page).toBe(2);
    await expect(rows(page).first()).toContainText(list2.items[0].name);
    await expect(rows(page)).toHaveCount(list2.items.length);
    const prev = apiGet(page, "/api/students", (p) => (p.get("page") || "1") === "1");
    await page.getByRole("button", { name: /Previous/ }).click();
    await prev;
    await expect(page).not.toHaveURL(/page=/);
    await expect(rows(page).first()).toContainText(list.items[0].name);

    // ---- search: debounced, sends q, URL keeps q, results match the response
    const word = list.items[1].name.split(/\s+/)[0];
    const searched = apiGet(page, "/api/students", (p) => p.get("q") === word);
    await page.getByRole("searchbox", { name: "Search students" }).fill(word);
    const { params: ps, json: found } = await searched;
    expect(ps.get("page_size")).toBe("25");
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(word)}(&|$)`));
    expect(found.items.length).toBeGreaterThan(0);
    await expect(rows(page)).toHaveCount(found.items.length);
    await expect(rows(page).first()).toContainText(found.items[0].name);

    // ---- a filter: Stage. The option list comes from /api/meta; pick the second option
    const stageSelect = page.getByRole("combobox", { name: "Stage", exact: true });
    const stageValue = await stageSelect.locator("option").nth(1).getAttribute("value");
    const staged = apiGet(page, "/api/students", (p) => p.get("stage") === stageValue && p.get("q") === word);
    await stageSelect.selectOption(stageValue);
    const { params: pst, json: stageList } = await staged;
    expect(q(pst, "page"), "a filter change goes back to page 1").toMatch(/^(1)?$/);
    await expect(page).toHaveURL(/[?&]stage=/);
    if (stageList.items.length) {
      await expect(rows(page)).toHaveCount(stageList.items.length);
      for (const item of stageList.items) expect(item.current_stage).toBe(stageValue);
    } else {
      await expect(page.getByText("No students match your filters")).toBeVisible();
    }

    // ---- Risk filter as a third filter, then "Clear 3 filters" resets every control and the URL
    const riskSelect = page.getByRole("combobox", { name: "Risk", exact: true });
    const risked = apiGet(page, "/api/students", (p) => p.get("risk") === "On Track");
    await riskSelect.selectOption("On Track");
    await risked;
    const clear = page.getByRole("button", { name: /Clear 3 filters/ });
    await expect(clear).toBeVisible();
    const cleared = apiGet(page, "/api/students", (p) => !p.get("q") && !p.get("stage") && !p.get("risk"));
    await clear.click();
    const { json: all } = await cleared;
    expect(all.total).toBe(list.total);
    await expect(page.getByRole("searchbox", { name: "Search students" })).toHaveValue("");
    await expect(stageSelect).toHaveValue("");
    await expect(riskSelect).toHaveValue("");
    await expect(page.getByRole("button", { name: /Clear \d+ filter/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&](q|stage|risk)=/);

    // ---- the other filter controls exist with their "All ..." first option
    for (const [name, label] of [["Student status", "All student status"], ["Standing", "All standing"], ["Program", "All program"]]) {
      const sel = page.getByRole("combobox", { name, exact: true });
      await expect(sel, name).toBeVisible();
      await expect(sel.locator("option").first(), name).toHaveText(label);
    }

    // ---- the Standing filter sends standing=
    const standing = apiGet(page, "/api/students", (p) => p.get("standing") === "Active");
    await page.getByRole("combobox", { name: "Standing", exact: true }).selectOption("Active");
    await standing;
    const unset = apiGet(page, "/api/students", (p) => !p.get("standing"));
    await page.getByRole("button", { name: /Clear 1 filter/ }).click();
    await unset;

    // ---- opening a record: a click on the row goes to /students/:id
    const id = list.items[0].id;
    await rows(page).first().locator("td").nth(2).click();
    await expect(page).toHaveURL(new RegExp(`/students/${id}$`));
    await page.goBack();
    await expect(rows(page).first()).toBeVisible();
  });

  test("the enrollment-sync notice offers 'Review enrollment' and it opens /enrollment", async ({ page }) => {
    const first = apiGet(page, "/api/students");
    await page.goto("/students");
    const { json } = await first;
    test.skip(!json.integrity, "this build of the list carries no integrity block");
    const note = json.integrity.issue_count
      ? `${json.integrity.issue_count} enrollment/profile inconsistency item(s) require review.`
      : "Students, enrollment, and monitoring records are synchronized.";
    await expect(page.getByText(note)).toBeVisible();
    await page.getByRole("button", { name: "Review enrollment" }).click();
    await expect(page).toHaveURL(/\/enrollment(\?|$)/);
  });
});

test.describe("Dashboard page", () => {
  test("filters keep their API calls and URL; every tile link and the Reports button go where they did", async ({ page }) => {
    const first = apiGet(page, "/api/dashboard");
    await page.goto("/");
    const { json } = await first;
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Overview" })).toBeVisible();
    const k = json.kpis;

    // tile links (by href: the tiles change layout in the migration, not where they lead)
    const link = (href) => page.locator(`main a[href="${href}"]`);
    await expect(link("/students").first()).toContainText(String(k.total_students));
    await expect(link("/students?risk=At Risk of Delay/Delayed").or(link("/students?risk=At%20Risk%20of%20Delay/Delayed")).first()).toBeVisible();
    await expect(link("/work-queue").first()).toBeVisible();
    await expect(link("/students?standing=Active")).toBeVisible();
    await expect(link("/students?standing=On+Leave")).toBeVisible();
    await expect(link("/reports?workflow_type=graduation_candidates")).toBeVisible();
    await expect(link("/work-queue?status=Overdue")).toBeVisible();
    await expect(link("/reports").first()).toBeVisible();
    // the KPI labels and sublines are still on the page
    for (const t of ["Students monitored", "At risk or delayed", "Open tasks", "Confirmed defenses", "Active", "On leave", "Completed", "Overdue tasks"]) {
      await expect(page.locator("main a", { hasText: t }).first(), t).toBeVisible();
    }
    await expect(page.getByText(`${k.active_students} active`)).toBeVisible();

    // a tile navigates
    await link("/students?standing=Active").click();
    await expect(page).toHaveURL(/\/students\?standing=Active/);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Overview" })).toBeVisible();
    // the Reports button navigates
    await page.getByRole("link", { name: "Reports", exact: true }).first().click();
    await expect(page).toHaveURL(/\/reports$/);
    await page.goBack();

    // ---- filters: Program, then Standing, then clear
    const field = (label) => page.locator("label", { has: page.locator(`span:text-is("${label}")`) }).locator("select");
    const program = field("Program");
    const programValue = await program.locator("option").nth(1).getAttribute("value");
    const byProgram = apiGet(page, "/api/dashboard", (p) => p.get("program_id") === programValue);
    await program.selectOption(programValue);
    await byProgram;
    await expect(page).toHaveURL(new RegExp(`[?&]program_id=${programValue}(&|$)`));
    const byStanding = apiGet(page, "/api/dashboard", (p) => p.get("standing") === "Active" && p.get("program_id") === programValue);
    await field("Standing").selectOption("Active");
    await byStanding;
    await expect(page).toHaveURL(/standing=Active/);
    for (const label of ["Progress", "Risk", "Owner"]) await expect(field(label), label).toBeVisible();
    const clear = page.getByRole("button", { name: "Clear dashboard filters" });
    await expect(clear).toBeVisible();
    const cleared = apiGet(page, "/api/dashboard", (p) => !p.get("program_id") && !p.get("standing"));
    await clear.click();
    await cleared;
    await expect(page).not.toHaveURL(/program_id|standing/);
    await expect(clear).toHaveCount(0);
  });

  test("a chart category opens the details dialog: loads its rows from the drill-down API and closes with its X button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Overview" })).toBeVisible();
    const chip = page.locator('button[aria-label^="Show "]').first();
    await expect(chip).toBeVisible();
    const label = (await chip.getAttribute("aria-label")).replace(/^Show /, "").replace(/: \d+ records?$/, "");
    const drill = apiGet(page, "/api/dashboard/drilldown");
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const { params, json } = await drill;
    expect(params.get("type")).toBeTruthy();
    expect(params.get("value")).toBe(label);
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(json.title);
    await expect(dialog.getByText("Loading filtered details…")).toBeHidden();
    if (json.rows?.length) {
      // schedule + student drill-downs are tables; the owner drill-down is a list. Either way the first row's name shows.
      await expect(dialog).toContainText(json.rows[0].name || json.rows[0].student?.name || json.rows[0].title);
    } else {
      await expect(dialog.getByText("No records in this category")).toBeVisible();
    }
    // the page behind is still there
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Overview" })).toBeVisible();
    await page.getByRole("button", { name: "Close dashboard details" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("the two work lists link to the work queue and the activity log; student rows in the dialog link to records", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the work queue/ })).toHaveAttribute("href", "/work-queue");
    // recent activity is behind a disclosure
    const toggle = page.getByRole("button", { name: /View logs/ });
    if (await toggle.count()) {
      await toggle.click();
      await expect(page.getByRole("link", { name: /Open full activity log/ })).toHaveAttribute("href", "/activity");
    }
    // stage drill-down lists students that link to their record
    const chip = page.locator('button[aria-label^="Show "]').first();
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Loading filtered details…")).toBeHidden();
    const student = dialog.locator('a[href^="/students/"]').first();
    if (await student.count()) {
      const href = await student.getAttribute("href");
      await student.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    }
  });
});

test.describe("Work Queue page", () => {
  test("Tasks: owner and Overdue chips send owner/status, the URL follows, the search narrows the page, the count line matches", async ({ page }) => {
    const first = apiGet(page, "/api/tasks");
    await page.goto("/work-queue");
    const { params: p0, json: tasks } = await first;
    expect(p0.get("page_size")).toBe("50");
    expect(q(p0, "page")).toBe("1");
    expect(tasks.total).toBeGreaterThan(0);
    await expect(rows(page)).toHaveCount(tasks.items.length);
    for (const h of ["Task", "Owner", "Student", "Due", "Status", "Action"]) {
      await expect(page.getByRole("columnheader", { name: h }), `column ${h}`).toBeVisible();
    }
    await expect(page.getByText(new RegExp(`Showing\\s+1\\s*[-–]\\s*${tasks.items.length}\\s+of\\s+${tasks.total}\\b`))).toBeVisible();
    await expect(rows(page).first()).toContainText(tasks.items[0].title);

    // ---- owner chip
    const owned = apiGet(page, "/api/tasks", (p) => p.get("owner") === "Dean");
    await page.getByRole("button", { name: "Dean", exact: true }).click();
    const { params: po, json: byOwner } = await owned;
    expect(q(po, "status")).toBe("");
    expect(q(po, "page")).toBe("1");
    await expect(page).toHaveURL(/[?&]owner=Dean(&|$)/);
    if (byOwner.items.length) {
      await expect(rows(page)).toHaveCount(byOwner.items.length);
      for (const t of byOwner.items) expect(t.owner_role).toBe("Dean");
    } else {
      await expect(page.getByText("No tasks match the selected filters")).toBeVisible();
    }

    // ---- Overdue only, on top of the owner
    const overdue = apiGet(page, "/api/tasks", (p) => p.get("status") === "Overdue" && p.get("owner") === "Dean");
    await page.getByRole("button", { name: "Overdue only" }).click();
    await overdue;
    await expect(page).toHaveURL(/owner=Dean/);
    await expect(page).toHaveURL(/status=Overdue/);
    // a second click lifts the Overdue filter again
    const lifted = apiGet(page, "/api/tasks", (p) => !p.get("status") && p.get("owner") === "Dean");
    await page.getByRole("button", { name: "Overdue only" }).click();
    await lifted;
    await expect(page).not.toHaveURL(/status=/);

    // ---- All owners resets the owner
    const allOwners = apiGet(page, "/api/tasks", (p) => !p.get("owner") && !p.get("status"));
    await page.getByRole("button", { name: "All owners" }).click();
    const { json: everything } = await allOwners;
    expect(everything.total).toBe(tasks.total);
    await expect(page).not.toHaveURL(/owner=|status=/);

    // ---- search narrows the rows already loaded (no new request) and finds nothing for nonsense
    const title = tasks.items[0].title;
    const search = page.getByLabel("Search work queue");
    await search.fill(title);
    const expected = tasks.items.filter((t) => `${t.title} ${t.student_name || ""} ${t.owner_role}`.toLowerCase().includes(title.toLowerCase())).length;
    await expect(rows(page)).toHaveCount(expected);
    await search.fill("zzzz-no-such-task");
    await expect(page.getByText("No tasks match the selected filters")).toBeVisible();
    await search.fill("");
    await expect(rows(page)).toHaveCount(tasks.items.length);
  });

  test("Tasks: the Overdue shortcut from the URL (?status=Overdue) is sent to the API", async ({ page }) => {
    const first = apiGet(page, "/api/tasks");
    await page.goto("/work-queue?status=Overdue");
    const { params } = await first;
    expect(params.get("status")).toBe("Overdue");
    await expect(page.getByRole("button", { name: "Overdue only" })).toBeVisible();
  });

  test("At-risk students: ?tab=at-risk opens it, priority chips narrow the rows, Open goes to the record", async ({ page }) => {
    const support = apiGet(page, "/api/decision-support");
    await page.goto("/work-queue?tab=at-risk");
    const { json } = await support;
    const byStudent = new Map();
    for (const item of json.items) if (!byStudent.has(item.student_id)) byStudent.set(item.student_id, item);
    const flagged = byStudent.size;
    await expect(page.getByRole("button", { name: new RegExp(`All flagged \\(${flagged}\\)`) })).toBeVisible();
    if (flagged === 0) {
      await expect(page.getByText("No students flagged")).toBeVisible();
      return;
    }
    for (const h of ["Student", "Priority", "Suggested next step", "Owner"]) {
      await expect(page.getByRole("columnheader", { name: h }), `column ${h}`).toBeVisible();
    }
    await expect(rows(page)).toHaveCount(flagged);
    const counts = { high: 0, medium: 0, low: 0 };
    for (const item of byStudent.values()) counts[item.severity] = (counts[item.severity] || 0) + 1;
    const label = { high: "High", medium: "Medium", low: "Low" };
    for (const key of ["high", "medium", "low"]) {
      if (!counts[key]) continue;
      await page.getByRole("button", { name: new RegExp(`${label[key]} priority \\(${counts[key]}\\)`) }).click();
      await expect(rows(page)).toHaveCount(counts[key]);
      await expect(rows(page).first().locator("td").nth(1)).toContainText(label[key]);
    }
    await page.getByRole("button", { name: new RegExp(`All flagged \\(${flagged}\\)`) }).click();
    await expect(rows(page)).toHaveCount(flagged);
    // the first row shows its student, recommendation and an Open link to the record
    const top = [...byStudent.values()].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    await expect(rows(page).first()).toContainText(top.student_name);
    await expect(rows(page).first()).toContainText(top.recommendation);
    const open = rows(page).first().getByRole("link", { name: /Open/ });
    await expect(open).toHaveAttribute("href", `/students/${top.student_id}`);
    await open.click();
    await expect(page).toHaveURL(new RegExp(`/students/${top.student_id}$`));
  });

  test("tabs switch the panel; Conflicts shows its three counters, Refresh reloads, and Resolve opens its form without saving", async ({ page }) => {
    const first = apiGet(page, "/api/tasks");
    await page.goto("/work-queue");
    await first;
    const tabs = page.getByRole("button", { name: /^(Tasks|At-risk students|Conflicts)/ });
    await expect(tabs).toHaveCount(3);
    const support = apiGet(page, "/api/decision-support");
    await page.getByRole("button", { name: /^At-risk students/ }).click();
    await support;
    await expect(page.getByText("Students who are delayed, stalled, overdue or missing documents.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: /^Conflicts/ }).click();
    for (const t of ["Open conflicts", "Auto-resolve on re-import", "Need coordinator action"]) {
      await expect(page.getByText(t, { exact: true }).first(), t).toBeVisible();
    }
    const reload = apiGet(page, "/api/monitoring/conflicts", (p) => p.get("status") === "Open");
    await page.getByRole("button", { name: "Refresh" }).click();
    const { json } = await reload;
    if (!json.items.length) {
      await expect(page.getByText("No open conflicts")).toBeVisible();
      return;
    }
    const item = json.items[0];
    await expect(page.getByText(item.category, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(item.student_name).first()).toBeVisible();
    await page.getByRole("button", { name: "Resolve", exact: true }).first().click();
    const note = page.getByRole("textbox", { name: "How was this resolved?" });
    await expect(note).toBeVisible();
    const save = page.getByRole("button", { name: /Resolve conflict/ });
    await expect(save).toBeDisabled();
    await note.fill("Checked against the corrected sheet.");
    await expect(save).toBeEnabled();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(note).toHaveCount(0);
    expect(tracker.writes, "no data was changed").toEqual([]);
  });
});
