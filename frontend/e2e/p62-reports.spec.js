// Behaviour pin for packet P6.2 (Phase 5 migration of pages/Reports.jsx, pages/ActivityLog.jsx, pages/BusinessRules.jsx).
// Written BEFORE the migration and green on the old code, so it proves the migrated pages keep the same data, the same
// API query parameters, the same filters, the same exports (file names and header rows) and the same rule dialog.
// It reaches everything through the real UI as Graduate School staff (the Business Rules read-only view as the Research
// Coordinator) and changes nothing that stays changed: the only write is "Mark as sent" on a daily change, switched on
// and straight back off. It avoids text the migration may change (heading style, "Showing a-b of n" dash, tile layout).
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_TAG lets a before/after comparison write to two folders; the default is "p62".
const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p62");
test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P6.2 pages", viewport: 1366 } };
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
    }, { timeout: 60_000 }) // the full run keeps the one dev server busy; 20 s flaked once
    .then(async (r) => ({ params: new URL(r.url()).searchParams, json: await r.json() }));
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(page, name) {
  await page.waitForTimeout(600); // the page's own fade-in
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
/** Column headers of the (first) table in <main>, as text (not innerText: CSS upper-casing must not matter). */
const headers = (page) => page.locator("main table thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
const bodyRows = (page) => page.locator("main table tbody tr");
/** Downloads whatever `click` triggers and returns { name, lines }. */
async function download(page, click) {
  const [file] = await Promise.all([page.waitForEvent("download"), click()]);
  const text = readFileSync(await file.path(), "utf8");
  return { name: file.suggestedFilename(), text, lines: text.split(/\r?\n/).filter((l) => l !== "") };
}
const button = (page, name) => page.getByRole("button", { name, exact: true });

// ---------------------------------------------------------------------------------------------------- Reports

const REPORT_TABS = [
  { id: "graduation_candidates", label: "Graduation candidates", heads: ["Student", "Window", "Coursework", "Research", "Practicum", "Status"] },
  { id: "missing_requirements", label: "Missing requirements", heads: ["Student", "Coursework", "Research", "Practicum", "Next owner"] },
  { id: "practicum_monitoring", label: "Practicum monitoring", heads: ["Student", "Site", "Hours", "Documents", "Certificates", "Status"] },
  { id: "withdrawal_requests", label: "Withdrawal requests", heads: ["Student", "Subject / semester", "Window", "Dean", "Sent to Registrar", "Academic record", "Status"] },
  { id: "loa_readmission", label: "LOA/readmission", heads: ["Student", "Request", "Status", "Period / return semester", "Next owner", "Registrar list"] },
  { id: "at_risk", label: "At-risk", heads: ["Student", "Risk", "Recommendation", "Owner"] },
  { id: "open_overdue_tasks", label: "Open/overdue tasks", heads: ["Task", "Student", "Owner", "Due", "Status"] },
  { id: "research_completion", label: "Research completion", heads: ["Student", "Case", "Gate", "Status"] },
];
const ANALYTICS_TABS = [
  { id: "queue_aging", label: "Queue aging & backlog" },
  { id: "stage_bottlenecks", label: "Stage bottlenecks" },
  { id: "owner_workload", label: "Workload & turnaround" },
  { id: "residency_watchlist", label: "Residency watchlist" },
  { id: "completion_attrition", label: "Completion & attrition" },
  { id: "scheduling_cycle_time", label: "Scheduling cycle time" },
  { id: "followup_closure", label: "Follow-up closure" },
];
const tabButton = (page, label) => page.getByRole("button", { name: new RegExp(`^${label.replace(/[/&]/g, (c) => `\\${c}`)}( ·|$)`) });
/** The <select> inside the label whose caption is exactly `name` (the label's own text also holds the options). */
const filterSelect = (page) => (name) => page.locator("label", { has: page.locator(`span:text-is("${name}")`) }).locator("select");
const analyticsCell = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));

test.describe("Reports", () => {
  test("the summary: header, the eight figures, the Back to dashboard link", async ({ page }) => {
    const first = apiGet(page, "/api/reports", (p) => !p.get("tab"));
    await page.goto("/reports");
    const { params, json } = await first;
    expect([...params.keys()].filter((k) => params.get(k)), "the first request carries no filter").toEqual([]);
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(page.getByText("Filterable monitoring reports generated from student records, tasks, and workflow cases.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("heading", { level: 2, name: "Dashboard summary" })).toBeVisible();
    const s = json.summary;
    const figures = [
      ["Students monitored", s.total_students], ["Needing attention", s.at_risk], ["Open tasks", s.pending_tasks],
      ["Overdue tasks", s.overdue_tasks], ["Practicum records", s.practicum_records], ["Withdrawal requests", s.withdrawal_requests],
      ["Graduation candidates", s.graduation_candidates], ["Confirmed defenses", s.confirmed_schedules],
    ];
    const card = page.locator("main");
    for (const [label, value] of figures) {
      // the label's own tile also holds its figure, whatever the tile's markup is
      const tile = card.locator("div").filter({ hasText: new RegExp(`^\\s*(${value}\\s*${label}|${label}\\s*${value})\\s*$`) });
      await expect(tile.last(), `${label} shows ${value}`).toBeVisible();
    }
    // every report button and the analytics group exist, with the counts the API gave
    for (const tab of REPORT_TABS) await expect(tabButton(page, tab.label), tab.label).toContainText(`${json[tab.id].count}`);
    await expect(tabButton(page, "Dashboard summary")).toBeVisible();
    await expect(tabButton(page, "Daily changes")).toBeVisible();
    await expect(page.getByText("Analytics & decision support")).toBeVisible();
    for (const tab of ANALYTICS_TABS) await expect(tabButton(page, tab.label), tab.label).toBeVisible();
    // no export on the summary
    await expect(button(page, "Export CSV")).toHaveCount(0);
    await shot(page, "reports-summary-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "reports-summary-390.png");
  });

  test("the five filters change the API query and the URL; Clear report filters resets them", async ({ page }) => {
    const first = apiGet(page, "/api/reports");
    await page.goto("/reports");
    const { json } = await first;
    const field = filterSelect(page);
    // the controls and their first option
    for (const [name, all] of [["Program", "All programs"], ["Progress", "All progress"], ["Risk", "All risk"], ["Standing", "All standings"], ["Workflow", "All workflows"]]) {
      await expect(field(name), name).toBeVisible();
      await expect(field(name).locator("option").first(), name).toHaveText(all);
    }
    await expect(field("Program").locator("option")).toHaveCount(1 + json.programs.length);
    await expect(field("Progress").locator("option")).toHaveCount(1 + json.stages.length);
    await expect(field("Workflow").locator("option")).toHaveCount(1 + 9); // the nine non-summary report tabs
    await expect(page.getByRole("button", { name: "Clear report filters" })).toHaveCount(0);

    const programValue = String(json.programs[0].id);
    let next = apiGet(page, "/api/reports", (p) => p.get("program_id") === programValue);
    await field("Program").selectOption(programValue);
    let got = await next;
    expect(got.params.get("page") || "").toBe("");
    await expect(page).toHaveURL(new RegExp(`[?&]program_id=${programValue}(&|$)`));

    next = apiGet(page, "/api/reports", (p) => p.get("risk") === "On Track" && p.get("program_id") === programValue);
    await field("Risk").selectOption("On Track");
    await next;
    await expect(page).toHaveURL(/risk=On(%20|\+)Track/);

    next = apiGet(page, "/api/reports", (p) => p.get("standing") === "Active" && p.get("risk") === "On Track");
    await field("Standing").selectOption("Active");
    await next;

    const stage = json.stages[1];
    next = apiGet(page, "/api/reports", (p) => p.get("stage") === stage && p.get("standing") === "Active");
    await field("Progress").selectOption(stage);
    await next;
    await expect(page).toHaveURL(/[?&]stage=/);

    // Workflow picks the matching report
    next = apiGet(page, "/api/reports", (p) => p.get("workflow_type") === "at_risk" && p.get("tab") === "at_risk");
    await field("Workflow").selectOption("at_risk");
    await next;
    await expect(page.getByRole("heading", { level: 2, name: "At-risk" })).toBeVisible();
    await expect(page).toHaveURL(/workflow_type=at_risk/);
    await shot(page, "reports-filtered-1366.png");

    const clear = page.getByRole("button", { name: "Clear report filters" });
    await expect(clear).toBeVisible();
    next = apiGet(page, "/api/reports", (p) => !p.get("program_id") && !p.get("risk") && !p.get("standing") && !p.get("stage") && !p.get("workflow_type"));
    await clear.click();
    await next;
    for (const name of ["Program", "Progress", "Risk", "Standing", "Workflow"]) await expect(field(name), name).toHaveValue("");
    await expect(page.getByRole("button", { name: "Clear report filters" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&](program_id|risk|standing|stage|workflow_type)=/);
  });

  test("each operational report loads its tab, columns, rows and export (file name and header row)", async ({ page }) => {
    const first = apiGet(page, "/api/reports");
    await page.goto("/reports");
    await first;
    for (const tab of REPORT_TABS) {
      const next = apiGet(page, "/api/reports", (p) => p.get("tab") === tab.id && !p.get("page"));
      await tabButton(page, tab.label).click();
      const { json } = await next;
      const report = json[tab.id];
      await expect(page.getByRole("heading", { level: 2, name: tab.label }), tab.label).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`workflow_type=${tab.id}`));
      if (report.count === 0) {
        await expect(page.getByText("No rows match the filters"), `${tab.label}: empty`).toBeVisible();
        await expect(bodyRows(page)).toHaveCount(0);
        await expect(button(page, "Export CSV")).toHaveCount(0);
        continue;
      }
      expect(await headers(page), `${tab.label}: columns`).toEqual(tab.heads);
      await expect(bodyRows(page), `${tab.label}: rows`).toHaveCount(report.rows.length);
      await expect(page.getByText(new RegExp(`Showing\\s+1\\s*[-–]\\s*${report.rows.length}\\s+of\\s+${report.count}\\b`)), `${tab.label}: range`).toBeVisible();
      const firstRow = report.rows[0];
      if (firstRow.student) {
        const link = bodyRows(page).first().getByRole("link", { name: firstRow.student.name });
        await expect(link, `${tab.label}: student link`).toHaveAttribute("href", `/students/${firstRow.student.id}`);
        await expect(bodyRows(page).first()).toContainText(firstRow.student.student_number);
      } else {
        await expect(bodyRows(page).first()).toContainText(firstRow.title);
      }
      // export: <tab>.csv, flat header row, one line per row on this page
      const file = await download(page, () => button(page, "Export CSV").click());
      expect(file.name, `${tab.label}: file name`).toBe(`${tab.id}.csv`);
      const wantHead = tab.id === "open_overdue_tasks" ? "student,program,status,detail" : "student,student_number,program,status,detail";
      expect(file.lines[0], `${tab.label}: header row`).toBe(wantHead);
      expect(file.lines.length, `${tab.label}: lines`).toBe(report.rows.length + 1);
      if (firstRow.student) expect(file.lines[1].startsWith(`"${firstRow.student.name}"`), `${tab.label}: first data line`).toBe(true);
    }
    await shot(page, "reports-report-1366.png");
  });

  test("a report longer than a page: Next and Previous send page=, the range and the export follow the page", async ({ page }) => {
    const first = apiGet(page, "/api/reports", (p) => p.get("tab") === "missing_requirements");
    await page.goto("/reports?workflow_type=missing_requirements");
    const { json } = await first;
    const total = json.missing_requirements.count;
    const size = json.missing_requirements.page_size;
    expect(json.missing_requirements.pages, "the demo data has more than one page of missing requirements").toBeGreaterThan(1);
    await expect(page.getByRole("heading", { level: 2, name: "Missing requirements" })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(size);
    await expect(page.getByText(new RegExp(`Showing\\s+1\\s*[-–]\\s*${size}\\s+of\\s+${total}\\b`))).toBeVisible();
    await expect(page.getByRole("button", { name: /Previous/ })).toBeDisabled();

    const next = apiGet(page, "/api/reports", (p) => p.get("tab") === "missing_requirements" && p.get("page") === "2");
    await page.getByRole("button", { name: /Next/ }).click();
    const { json: p2 } = await next;
    const on2 = p2.missing_requirements.rows.length;
    await expect(bodyRows(page)).toHaveCount(on2);
    await expect(page.getByText(new RegExp(`Showing\\s+${size + 1}\\s*[-–]\\s*${total}\\s+of\\s+${total}\\b`))).toBeVisible();
    await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
    await expect(bodyRows(page).first()).toContainText(p2.missing_requirements.rows[0].student.name);
    const file = await download(page, () => button(page, "Export CSV").click());
    expect(file.name).toBe("missing_requirements.csv");
    expect(file.lines.length, "the export holds the rows of the page on screen").toBe(on2 + 1);
    await shot(page, "reports-page2-1366.png");

    const prev = apiGet(page, "/api/reports", (p) => p.get("tab") === "missing_requirements" && !p.get("page"));
    await page.getByRole("button", { name: /Previous/ }).click();
    await prev;
    await expect(bodyRows(page)).toHaveCount(size);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 2, name: "Missing requirements" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "reports-report-390.png");
  });

  test("each analytics report: KPI strip, totals, columns, rows, export; the filters reload it", async ({ page }) => {
    const first = apiGet(page, "/api/reports");
    await page.goto("/reports");
    await first;
    const asked = apiGet(page, "/api/reports/analytics");
    await tabButton(page, ANALYTICS_TABS[0].label).click();
    const { params: p0, json } = await asked;
    expect([...p0.keys()].filter((k) => p0.get(k)), "no filters on the first analytics request").toEqual([]);
    // once loaded, every analytics button shows its count
    for (const tab of ANALYTICS_TABS) await expect(tabButton(page, tab.label), tab.label).toContainText(`${json[tab.id].count}`);
    for (const [index, tab] of ANALYTICS_TABS.entries()) {
      if (index > 0) await tabButton(page, tab.label).click();
      const report = json[tab.id];
      await expect(page.getByRole("heading", { level: 2, name: tab.label }), tab.label).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Module KPI measurements" })).toBeVisible();
      await expect(page.getByText(/^Target /)).toHaveCount(json.kpis.length);
      await expect(page.getByText(`${json.kpis[0].value}${json.kpis[0].unit}`).first()).toBeVisible();
      await expect(page.getByText(json.kpis[0].kpi, { exact: true })).toBeVisible();
      await expect(page.getByText(`Computed from recorded event history for ${json.student_count} student(s) matching the filters.`)).toBeVisible();
      for (const [key, value] of Object.entries(report.totals || {})) {
        await expect(page.getByText(`${key.replace(/_/g, " ")}: ${analyticsCell(value)}`, { exact: true }), `${tab.label}: total ${key}`).toBeVisible();
      }
      if (!report.rows.length) {
        await expect(page.getByText("Nothing to report")).toBeVisible();
        await expect(page.getByText("No records match the current filters.")).toBeVisible();
        await expect(button(page, "Export CSV")).toHaveCount(0);
        continue;
      }
      expect(await headers(page), `${tab.label}: columns`).toEqual(report.columns.map((c) => c.label));
      await expect(bodyRows(page), `${tab.label}: rows`).toHaveCount(report.rows.length);
      await expect(bodyRows(page).first()).toContainText(analyticsCell(report.rows[0][report.columns[0].key]));
      const file = await download(page, () => button(page, "Export CSV").click());
      expect(file.name, `${tab.label}: file name`).toBe(`${tab.id}.csv`);
      expect(file.lines[0], `${tab.label}: header row`).toBe(report.columns.map((c) => `"${c.label}"`).join(","));
      expect(file.lines.length, `${tab.label}: lines`).toBe(report.rows.length + 1);
    }
    await tabButton(page, "Queue aging & backlog").click();
    await expect(page.getByRole("heading", { level: 2, name: "Queue aging & backlog" })).toBeVisible();
    await shot(page, "reports-analytics-1366.png");

    // a student filter reloads the analytics with that filter
    const programValue = String(json.programs[0].id);
    const again = apiGet(page, "/api/reports/analytics", (p) => p.get("program_id") === programValue);
    await filterSelect(page)("Program").selectOption(programValue);
    const filtered = await again;
    expect(filtered.json.student_count).toBeLessThan(json.student_count);
    await expect(page.getByText(`Computed from recorded event history for ${filtered.json.student_count} student(s) matching the filters.`)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "reports-analytics-390.png");
  });

  test("daily changes: date, the three figures, the table, CSV, Print, and Mark as sent on and off again", async ({ page }) => {
    const first = apiGet(page, "/api/reports");
    await page.goto("/reports");
    await first;
    const loaded = apiGet(page, "/api/reports/daily-changes");
    await tabButton(page, "Daily changes").click();
    const { json } = await loaded;
    expect(json.items.length, "the demo data has changes recorded today").toBeGreaterThan(0);
    await expect(page.getByRole("heading", { level: 2, name: "Daily changes" })).toBeVisible();
    await expect(page.getByText("Every change made in this system on the selected date. Export or print the list for the Registrar, then mark each change as sent.")).toBeVisible();
    const date = page.getByLabel("Change report date");
    await expect(date).toHaveValue(json.date);
    expect(await headers(page)).toEqual(["Time", "Change type", "Student", "Change", "By", "Sent to Registrar"]);
    await expect(bodyRows(page)).toHaveCount(json.items.length);
    const item = json.items[0];
    const firstRow = bodyRows(page).filter({ hasText: item.student_name }).first();
    await expect(firstRow.getByRole("link", { name: item.student_name })).toBeVisible(); // (its href is /students/undefined: I-0xx, the list carries no student_id)
    await expect(firstRow).toContainText(`${item.student_number} · ${item.program_code}`);
    await expect(firstRow).toContainText(item.detail);
    await expect(page.getByRole("button", { name: "Print" })).toBeEnabled();

    // the figures (read through the tile that holds label + number)
    const figure = async (label) => {
      const tile = page.locator("main div").filter({ hasText: new RegExp(`^\\s*(\\d+\\s*${label}|${label}\\s*\\d+)\\s*$`) }).last();
      return Number((await tile.innerText()).match(/\d+/)[0]);
    };
    expect(await figure("Changes today")).toBe(json.summary.total);
    expect(await figure("Sent to Registrar")).toBe(json.summary.reflected);
    expect(await figure("Not yet sent")).toBe(json.summary.pending);

    // CSV
    const file = await download(page, () => button(page, "CSV").click());
    expect(file.name).toBe(`daily-changes-${json.date}.csv`);
    expect(file.lines[0]).toBe("Time,Change type,Student,Student No,Program,Change,By,Sent to Registrar");
    expect(file.lines.length).toBe(json.items.length + 1);
    expect(file.lines[1]).toContain(`"${json.items[0].student_name}"`);
    await shot(page, "reports-daily-1366.png");

    // Mark as sent: the row flips to "Sent", the figures move, the server is told; then back.
    const row = bodyRows(page).first();
    const target = json.items[0];
    const markOn = page.waitForResponse((r) => r.request().method() !== "GET" && new URL(r.url()).pathname === `/api/reports/daily-changes/${target.id}/reflected`);
    await row.getByRole("button", { name: "Mark as sent" }).click();
    const on = await markOn;
    expect(on.request().postDataJSON()).toEqual({ reflected: true });
    await expect(row.getByRole("button", { name: "Sent", exact: true })).toBeVisible();
    await expect.poll(() => figure("Sent to Registrar")).toBe(json.summary.reflected + 1);
    await expect.poll(() => figure("Not yet sent")).toBe(json.summary.pending - 1);
    const markOff = page.waitForResponse((r) => r.request().method() !== "GET" && new URL(r.url()).pathname === `/api/reports/daily-changes/${target.id}/reflected`);
    await row.getByRole("button", { name: "Sent", exact: true }).click();
    expect((await markOff).request().postDataJSON()).toEqual({ reflected: false });
    await expect(row.getByRole("button", { name: "Mark as sent" })).toBeVisible();
    await expect.poll(() => figure("Not yet sent")).toBe(json.summary.pending);

    // another date: nothing recorded, so the empty note shows and CSV / Print are off
    const other = apiGet(page, "/api/reports/daily-changes", (p) => p.get("date") === "2020-01-02");
    await date.fill("2020-01-02");
    await other;
    await expect(page.getByText("No changes on this date")).toBeVisible();
    await expect(page.getByText("Pick another date, or make changes in Enrollment, Withdrawal, or the standing-change workflows.")).toBeVisible();
    await expect(button(page, "CSV")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Print" })).toBeDisabled();
    expect(await figure("Changes today")).toBe(0);

    await date.fill(json.date);
    await expect(bodyRows(page)).toHaveCount(json.items.length);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "reports-daily-390.png");
  });
});

// ---------------------------------------------------------------------------------------------------- Activity Log

test.describe("Activity Log", () => {
  test("loads once; search, workflow and next-owner filters work on the loaded list; Clear filters; the log is open", async ({ page }) => {
    let calls = 0;
    page.on("request", (r) => {
      if (r.method() === "GET" && new URL(r.url()).pathname === "/api/activity") calls += 1;
    });
    const first = apiGet(page, "/api/activity");
    await page.goto("/activity");
    const { json } = await first;
    const items = json.items;
    expect(items.length).toBeGreaterThan(5);
    await expect(page.getByRole("heading", { level: 1, name: "Activity Log" })).toBeVisible();
    await expect(page.getByText("An append-style trail of recorded transactions — the audit basis for accountability and monitoring.")).toBeVisible();
    const shown = (n) => expect(page.getByText(`Showing ${n} of ${items.length} activities`)).toBeVisible();
    await shown(items.length);
    await expect(page.getByRole("button", { name: /Clear filters/ })).toHaveCount(0);

    // the controls
    const search = page.getByLabel("Search activity", { exact: true });
    const workflow = page.getByLabel("Filter activity by workflow");
    const owner = page.getByLabel("Filter activity by next owner");
    await expect(search).toHaveAttribute("placeholder", "Search activity or student…");
    await expect(workflow.locator("option").first()).toHaveText("All workflows");
    await expect(owner.locator("option").first()).toHaveText("All next owners");
    const slugs = [...new Set(items.map((i) => i.transaction_slug).filter(Boolean))];
    const owners = [...new Set(items.map((i) => i.next_owner).filter(Boolean))];
    await expect(workflow.locator("option")).toHaveCount(1 + slugs.length);
    await expect(owner.locator("option")).toHaveCount(1 + owners.length);

    // the log is open from the start (I-080: it used to be folded away behind a "View logs" button)
    await expect(page.getByRole("button", { name: /View logs|Hide logs/ })).toHaveCount(0);
    await expect(page.locator("main ol > li")).toHaveCount(items.length);
    await shot(page, "activity-open-1366.png");
    const withStudent = items.find((i) => i.student_id);
    const entry = page.locator("main ol > li").filter({ hasText: withStudent.result }).first();
    await expect(entry.getByRole("link", { name: withStudent.student_name })).toHaveAttribute("href", `/students/${withStudent.student_id}`);
    await expect(entry).toContainText(`next owner: ${withStudent.next_owner || "—"}`);
    await expect(entry).toContainText(withStudent.actor_role);

    // workflow filter
    const slug = slugs[0];
    const bySlug = items.filter((i) => i.transaction_slug === slug).length;
    await workflow.selectOption(slug);
    await shown(bySlug);
    await expect(page.locator("main ol > li")).toHaveCount(bySlug);
    await expect(page.getByRole("button", { name: /Clear filters/ })).toBeVisible();
    // owner filter on top
    const who = owners[0];
    const both = items.filter((i) => i.transaction_slug === slug && i.next_owner === who).length;
    await owner.selectOption(who);
    await shown(both);
    // search on top: a word that matches nothing
    await search.fill("zzzz-no-such-activity");
    await expect(page.getByText("No activity matches the selected filters")).toBeVisible();
    await expect(page.getByText("Clear a filter or use a broader search.")).toBeVisible();
    await shown(0);
    await page.getByRole("button", { name: /Clear filters/ }).click();
    await shown(items.length);
    await expect(search).toHaveValue("");
    await expect(workflow).toHaveValue("");
    await expect(owner).toHaveValue("");

    // search by a student name
    const word = withStudent.student_name.split(/\s+/)[0].toLowerCase();
    const expected = items.filter((i) => `${i.result || ""} ${i.student_name || ""} ${i.actor_role || ""} ${i.notes || ""}`.toLowerCase().includes(word)).length;
    await search.fill(word);
    await shown(expected);

    expect(calls, "the filters never call the API again").toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Activity Log" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "activity-filtered-390.png");
  });
});

// ---------------------------------------------------------------------------------------------------- Business Rules

const writes = (page) => {
  const seen = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    // the notification bell's own refresh (I-071) is sent on every page; it is not something this page's form sent
    if (r.method() !== "GET" && path.startsWith("/api/") && path !== "/api/notifications/refresh") seen.push(`${r.method()} ${path}`);
  });
  return seen;
};

test.describe("Business Rules", () => {
  test("the register loads; the summary, the six filters, the search; a rule opens its dialog, validates, and cancels", async ({ page }) => {
    const sent = writes(page);
    const first = apiGet(page, "/api/business-rules");
    await page.goto("/business-rules");
    const { json } = await first;
    expect(json.can_edit).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: "Business rules" })).toBeVisible();
    await expect(page.getByText("Prototype rules awaiting Graduate School validation can be adjusted; every change is recorded with your reason.")).toBeVisible();
    const main = page.locator("main");
    for (const [label, value] of [
      ["Rules in the register", json.summary.total], ["Enforced by the system", json.summary.enforced],
      ["Documented only", json.summary.documented_only], ["Need review", json.summary.needs_review],
    ]) {
      const tile = main.locator("div").filter({ hasText: new RegExp(`^\\s*(${value}\\s*${label}|${label}\\s*${value})\\s*$`) });
      await expect(tile.last(), `${label} shows ${value}`).toBeVisible();
    }

    // one block per process, a row per rule ("Source:" line)
    const ruleRows = () => main.getByText(/^Source: /);
    await expect(ruleRows()).toHaveCount(json.items.length);
    for (const p of json.processes) await expect(main.getByRole("heading", { level: 2, name: p.label }), p.label).toBeVisible();

    // the six filters
    const FILTERS = {
      "All rules": () => true,
      "Enforced by the system": (r) => r.enforced,
      "Documented only": (r) => !r.enforced,
      "Needs review": (r) => r.status === "needs_review",
      "Official (locked)": (r) => r.locked,
      "Pending validation": (r) => !r.locked,
    };
    for (const [label, test_] of Object.entries(FILTERS)) {
      const pill = main.getByRole("group", { name: "Filter rules" }).getByRole("button", { name: label, exact: true });
      await pill.click();
      await expect(pill).toHaveAttribute("aria-pressed", "true");
      await expect(ruleRows(), label).toHaveCount(json.items.filter(test_).length);
    }
    // adjust buttons exist only for the unlocked rules
    const adjust = main.getByRole("button", { name: /^(Adjust value|Confirm or adjust)$/ });
    await expect(adjust).toHaveCount(json.items.filter((r) => !r.locked).length);
    // search
    await main.getByRole("group", { name: "Filter rules" }).getByRole("button", { name: "All rules", exact: true }).click();
    const search = page.getByLabel("Search rules", { exact: true });
    await expect(search).toHaveAttribute("placeholder", "Search rules or pages");
    const rule = json.items.find((r) => !r.locked && r.status === "needs_review");
    await search.fill(rule.title.slice(0, 30));
    const term = rule.title.slice(0, 30).toLowerCase();
    const matching = json.items.filter((r) => [r.title, r.description, r.key, r.source_title, r.source_section, r.citation].some((v) => String(v || "").toLowerCase().includes(term)));
    await expect(ruleRows()).toHaveCount(matching.length);
    await search.fill("zzzz-no-such-rule");
    await expect(page.getByText("No rules match")).toBeVisible();
    await expect(page.getByText("Try another filter or search.")).toBeVisible();
    await search.fill(rule.title.slice(0, 30));

    // the rule's row: description, source, value, history
    const row = main.locator("div").filter({ has: page.getByText(rule.title, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Confirm or adjust" }) }).filter({ has: page.getByRole("button", { name: /change history/i }) }).last();
    await expect(row).toContainText(rule.description.slice(0, 40));
    await expect(row).toContainText(`Source: ${rule.citation}`);
    await expect(row).toContainText("Check this value against the policy, then confirm or adjust it to clear the flag.");
    await expect(row).toContainText(rule.key);
    await row.getByRole("button", { name: /change history/i }).click();
    await expect(row.getByText(rule.history.length ? "Reason:" : "No changes yet. This is the value from the policy document.").first()).toBeVisible();
    await shot(page, "rules-1366.png");

    // ---- the dialog
    await row.getByRole("button", { name: "Confirm or adjust" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2, name: rule.title })).toBeVisible();
    await expect(dialog).toContainText(`Current source: ${rule.citation}. The workflows use the new value as soon as you save.`);
    const value = dialog.getByLabel(/^New value/);
    await expect(value).toHaveValue(String(rule.value));
    const reason = dialog.getByLabel(/^Reason for the change/);
    const save = dialog.getByRole("button", { name: "Save and record the change" });
    await expect(dialog.getByLabel("Source document")).toHaveValue(rule.source_title || "");
    await expect(dialog.getByLabel("Page")).toHaveValue(rule.source_page || "");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeEnabled();
    await shot(page, "rule-dialog-1366.png");
    // validation: a reason of fewer than 3 characters keeps Save off
    await expect(save).toBeDisabled();
    await reason.fill("ab");
    await expect(save).toBeDisabled();
    await reason.fill("abc");
    await expect(save).toBeEnabled();
    // an empty value stops the form (native validation): nothing is sent, the dialog stays
    await value.fill("");
    await save.click();
    await expect(dialog).toBeVisible();
    expect(sent, "nothing was sent").toEqual([]);
    expect(await value.evaluate((el) => el.validity.valueMissing)).toBe(true);
    await value.fill(String(rule.value));

    // 390 px: the dialog fits
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390 with the dialog open").toBe(true);
    const box = await dialog.getByRole("button", { name: "Cancel" }).boundingBox();
    expect(box.x + box.width, "Cancel is inside the screen").toBeLessThanOrEqual(390);
    await shot(page, "rule-dialog-390.png");
    await page.setViewportSize({ width: 1366, height: 768 });

    // Cancel closes it and sends nothing
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(sent, "cancel sent nothing").toEqual([]);
    await row.getByRole("button", { name: "Confirm or adjust" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(sent).toEqual([]);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Business rules" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Business rules" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    await shot(page, "rules-390.png");
  });
});

test.describe("Business Rules (read-only role)", () => {
  test.use({ storageState: join(AUTH_DIR, "research-coordinator.json") });
  test("the Research Coordinator sees the register but no adjust buttons", async ({ page }) => {
    tracker.where.role = "research-coordinator";
    const first = apiGet(page, "/api/business-rules");
    await page.goto("/business-rules");
    const { json } = await first;
    expect(json.can_edit).toBe(false);
    await expect(page.getByRole("heading", { level: 1, name: "Business rules" })).toBeVisible();
    await expect(page.getByText("Only Graduate School staff and the administrator can adjust the prototype rules.")).toBeVisible();
    await expect(page.locator("main").getByText(/^Source: /)).toHaveCount(json.items.length);
    await expect(page.getByRole("button", { name: /Adjust value|Confirm or adjust/ })).toHaveCount(0);
  });
});
