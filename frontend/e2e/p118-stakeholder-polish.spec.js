// e2e-writes: none
// Stakeholder comments of 2026-11-04 (ISSUES I-355..I-358; owner rule IM24: the same kind of page looks and behaves alike).
// Written BEFORE the change and red on the old UI. Through the real UI, read only (nothing is saved: pages that need a
// particular state are answered with page.route).
//   I-358  Approved and Passed are different colours WITH different icons; seven colour families, each with an icon; a
//          "What the colours mean" legend on every board and on Reports.
//   I-356  the Leave of Absence card shows the reason right under the student's name (and the other boards show their key
//          fact the same way); the details window opens with the reason and the period, before the timeline.
//   I-355  every page that adds or changes a subject says "Enrollment is OPEN until <date>" / "Enrollment is CLOSED since
//          <date>" at the top and, while closed, turns its add/change controls off with that reason.
//   I-357  Reports "By year started": for each year, On coursework / On thesis-dissertation / Graduated, as a bar and a
//          table, with the students behind every number; graduation candidates and defenses live under it.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p118");
const auth = (key) => join(AUTH_DIR, `${key}.json`);
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
// Today in Philippine time, moved by whole days, as YYYY-MM-DD; and the way the app writes a date.
function day(offset) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}
const pretty = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const linesOf = async (locator) =>
  (await locator.innerText()).split("\n").map((line) => line.trim()).filter((line) => line && line !== "Extension");

// ------------------------------------------------------------------------------------------------ I-358
const DEFENSES = {
  title: "Defenses held and upcoming",
  count: 5,
  columns: [{ key: "student", label: "Student" }, { key: "when", label: "Status" }, { key: "verdict", label: "Verdict" }],
  rows: [
    ["Approved", "Passed"], ["Returned", "Failed"], ["Under Review", "Passed"], ["Closed", "Passed"], ["Submitted", "Failed"],
  ].map(([when, verdict], i) => ({ student_id: 9000 + i, student: `Colour Check ${i + 1}`, student_number: `X-${i}`, program: "XX", when, verdict })),
  filters: {},
  options: { programs: [], terms: [], whens: [], types: [], stages: [] },
  empty: "None",
};

test.describe("I-358 one colour vocabulary", () => {
  test.use({ storageState: auth("staff"), viewport: DESKTOP });

  test("Approved and Passed differ in colour and icon; seven families; a legend on Reports", async ({ page }) => {
    await page.route("**/api/reports/defenses**", (route) => route.fulfill({ json: DEFENSES }));
    await page.goto("/reports?report=defenses");
    const chip = (text) => page.locator("[data-status-tone]").filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) }).first();
    await expect(chip("Approved")).toBeVisible();
    const look = (name) =>
      chip(name).evaluate((el) => ({ tone: el.dataset.statusTone, bg: getComputedStyle(el).backgroundColor, icon: el.querySelector("svg")?.innerHTML || "" }));
    const seen = {};
    for (const name of ["Approved", "Passed", "Under Review", "Returned", "Failed", "Closed", "Submitted"]) seen[name] = await look(name);
    expect(seen.Approved.tone, "Approved is a decision").not.toBe(seen.Passed.tone);
    expect(seen.Approved.bg, "Approved and Passed must not share a background colour").not.toBe(seen.Passed.bg);
    expect(seen.Approved.icon, "Approved and Passed must not share an icon").not.toBe(seen.Passed.icon);
    for (const [name, value] of Object.entries(seen)) expect(value.icon, `${name} has an icon: colour is never the only cue`).not.toBe("");
    const distinct = (key) => new Set(Object.values(seen).map((v) => v[key])).size;
    expect(distinct("bg"), "seven statuses, seven colours").toBe(7);
    expect(distinct("icon"), "seven statuses, seven icons").toBe(7);

    const legend = page.locator("[data-status-legend]");
    await expect(legend.getByText("What the colours mean")).toBeVisible();
    await legend.getByText("What the colours mean").click();
    await expect(legend.locator("[data-legend-tone]")).toHaveCount(7);
    await expect(legend).toContainText("Approved or on track");
    await expect(legend).toContainText("Passed or completed");
    await shot(page, "legend-reports-1366.png");
  });

  for (const viewport of [DESKTOP, PHONE]) {
    test(`every board has the legend (${viewport.width} px)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const slug of ["leave-of-absence", "readmission", "awol", "withdrawal"]) {
        await page.goto(`/workflow/${slug}`);
        const legend = page.locator('[data-testid="stage-board"] [data-status-legend]');
        await expect(legend.getByText("What the colours mean"), `${slug} board`).toBeVisible();
        expect(await noOverflow(page), `${slug}: no sideways scroll`).toBeLessThanOrEqual(1);
      }
      await page.goto("/workflow/leave-of-absence");
      await page.locator("[data-status-legend] summary").click();
      await expect(page.locator("[data-status-legend] [data-legend-tone]")).toHaveCount(7);
      await shot(page, `legend-board-${viewport.width}.png`);
    });
  }
});

// ------------------------------------------------------------------------------------------------ I-356
test.describe("I-356 the reason is on the card", () => {
  test.use({ storageState: auth("staff"), viewport: DESKTOP });

  test("Leave of Absence: the reason is the line under the student's name; the details open with reason and period", async ({ page }) => {
    const board = await (await page.request.get("/api/process-cases?slug=leave-of-absence")).json();
    const reasons = new Set(board.cases.map((c) => c.reason_category).filter(Boolean));
    reasons.add("Reason not given"); // a case filed without one still has the line, saying so
    expect(reasons.size, "premise: the demo leave cases have reasons (plus the not-given line)").toBeGreaterThan(1);
    await page.goto("/workflow/leave-of-absence");
    const cards = page.locator('[data-testid="stage-board"] article');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // CHANGED BY kstand (I-360): the reason is the first fact of the card's facts grid (it was line 3 of the card text; a
      // "Ready for Dean review" mark can now sit between the number and the grid).
      const lines = await linesOf(card);
      const fact = ((await card.getByTestId("case-key-fact").innerText()) || "").trim();
      expect(reasons.has(fact), `card ${i} (${lines[0]}): the key fact is the reason, got "${fact}"`).toBe(true);
      await expect(card.getByTestId("case-facts").locator("li").first()).toHaveText(fact);
    }
    await shot(page, "loa-board-1366.png");

    const first = cards.first();
    const reason = ((await first.getByTestId("case-key-fact").innerText()) || "").trim();
    await first.getByRole("button", { name: /^View details for / }).click();
    const dialog = page.getByRole("dialog");
    const top = dialog.getByTestId("case-summary-top");
    await expect(top).toBeVisible();
    await expect(top).toContainText(reason);
    await expect(top).toContainText(/AY \d{4}-\d{4}|Period not set/);
    const timeline = dialog.getByRole("region", { name: "Where this request is" });
    await expect(timeline).toBeVisible();
    const [a, b] = [await top.boundingBox(), await timeline.boundingBox()];
    expect(a.y, "reason and period come before the timeline").toBeLessThan(b.y);
    await shot(page, "loa-details-1366.png");
  });

  test("Readmission, AWOL and Withdrawal cards show their key fact in the same place", async ({ page }) => {
    for (const slug of ["readmission", "awol", "withdrawal"]) {
      await page.goto(`/workflow/${slug}`);
      const cards = page.locator('[data-testid="stage-board"] article');
      await expect(cards.first(), `${slug} has cards`).toBeVisible();
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        // CHANGED BY kstand (I-360): the key fact is the first fact of the grid, not "line 3" of the card text.
        const fact = await cards.nth(i).getByTestId("case-key-fact").innerText();
        expect(fact.trim(), `${slug} card ${i}: a key fact`).not.toBe("");
        await expect(cards.nth(i).getByTestId("case-facts").locator("li").first(), `${slug} card ${i}: the key fact opens the grid`).toHaveText(fact.trim());
      }
    }
  });

  test("390 px: the card keeps the reason line and the page does not scroll sideways", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/workflow/leave-of-absence");
    const card = page.locator('[data-testid="stage-board"] article').first();
    await expect(card.getByTestId("case-key-fact")).toBeVisible();
    expect(await noOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, "loa-board-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ I-355
async function withWindow(page, urlPattern, open, close, where) {
  await page.route(urlPattern, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    if (body[where]) body[where] = { ...body[where], planning_window_open: open, planning_window_close: close };
    return route.fulfill({ response: res, json: body });
  });
}
const banner = (page) => page.locator("[data-enrollment-banner]");

test.describe("I-355 enrollment period banner: student My Courses", () => {
  test.use({ storageState: auth("student"), viewport: DESKTOP });

  test("OPEN until the date; saving is possible", async ({ page }) => {
    const close = day(20);
    await withWindow(page, "**/api/student-portal/context", day(-10), close, "current_term");
    await page.goto("/student/enrollment");
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toHaveAttribute("data-state", "open");
    await expect(banner(page)).toContainText(`Enrollment is OPEN until ${pretty(close)}`);
    await expect(page.getByRole("button", { name: "Save current subjects" })).toBeEnabled();
    await shot(page, "enrollment-banner-student-open-1366.png");
  });

  for (const viewport of [DESKTOP, PHONE]) {
    test(`CLOSED since the date; the controls are off and say why (${viewport.width} px)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const close = day(-3);
      await withWindow(page, "**/api/student-portal/context", day(-60), close, "current_term");
      await page.goto("/student/enrollment");
      await expect(banner(page)).toHaveAttribute("data-state", "closed");
      await expect(banner(page)).toContainText(`Enrollment is CLOSED since ${pretty(close)}`);
      await expect(banner(page)).toContainText(/changes can only be made during the enrollment period/i);
      const save = page.getByRole("button", { name: "Save current subjects" });
      await expect(save).toBeDisabled();
      await expect(save).toHaveAttribute("title", /enrollment period/i);
      const boxes = page.locator('input[type="checkbox"]');
      const n = await boxes.count();
      expect(n, "premise: the student has subjects listed").toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await expect(boxes.nth(i), `subject ${i} is locked while closed`).toBeDisabled();
      expect(await noOverflow(page)).toBeLessThanOrEqual(1);
      await shot(page, `enrollment-banner-student-closed-${viewport.width}.png`);
    });
  }
});

test.describe("I-355 enrollment period banner: Academic Coordinator pages", () => {
  test.use({ storageState: auth("academic-coordinator"), viewport: DESKTOP });

  async function pickStudent(page) {
    const first = await (await page.request.get("/api/enrollment")).json();
    for (const program of first.programs) {
      const list = await (await page.request.get(`/api/enrollment?program_id=${program.id}`)).json();
      for (const student of list.students.slice(0, 12)) {
        const data = await (await page.request.get(`/api/enrollment?program_id=${program.id}&student_id=${student.id}`)).json();
        if (data.offered_subjects.some((s) => s.selectable && s.enrollment_state === "available")) return `/enrollment?program_id=${program.id}&student_id=${student.id}`;
      }
    }
    return "/enrollment";
  }

  test("Enrollment: OPEN keeps Add working", async ({ page }) => {
    const url = await pickStudent(page);
    const close = day(14);
    await withWindow(page, /\/api\/enrollment(\?|$)/, day(-5), close, "term");
    await page.goto(url);
    await expect(banner(page)).toHaveAttribute("data-state", "open");
    await expect(banner(page)).toContainText(`Enrollment is OPEN until ${pretty(close)}`);
    await shot(page, "enrollment-banner-ac-open-1366.png");
  });

  test("Enrollment: CLOSED turns Add, Confirm, Remove and the class-list upload off", async ({ page }) => {
    const url = await pickStudent(page);
    const close = day(-1);
    await withWindow(page, /\/api\/enrollment(\?|$)/, day(-60), close, "term");
    await page.goto(url);
    await expect(banner(page)).toHaveAttribute("data-state", "closed");
    await expect(banner(page)).toContainText(`Enrollment is CLOSED since ${pretty(close)}`);
    await expect(page.getByRole("button", { name: "Confirm enrollment" })).toBeDisabled();
    const adds = page.getByRole("button", { name: /^(Add|Selected)$/ });
    const n = await adds.count();
    for (let i = 0; i < n; i++) await expect(adds.nth(i), `subject button ${i}`).toBeDisabled();
    await expect(page.locator('input[type="file"]').first()).toBeDisabled();
    expect(await noOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, "enrollment-banner-ac-closed-1366.png");
  });

  test("Course adjustments: the same banner; CLOSED turns the plan buttons off", async ({ page }) => {
    const close = day(-2);
    await withWindow(page, /\/api\/course-adjustments(\?|$)/, day(-60), close, "term");
    await page.goto("/course-adjustments");
    await expect(banner(page)).toHaveAttribute("data-state", "closed");
    await expect(banner(page)).toContainText(`Enrollment is CLOSED since ${pretty(close)}`);
    await expect(page.getByRole("button", { name: /draft/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    await shot(page, "enrollment-banner-adjustments-closed-1366.png");
  });
});

// ------------------------------------------------------------------------------------------------ I-357
// Independent of the page's own code: the stage groups are written out here from the lifecycle (app.py STAGES).
const GROUPS = {
  coursework: ["s_admission", "s_coursework", "s_comprehensive_exam"],
  thesis: ["s_proposal_development", "s_proposal_defense", "s_data_collection", "s_writing", "s_final_defense"],
  graduated: ["s_completed"],
};
const fullYear = (entry) => `20${entry.slice(0, 2)}-20${entry.slice(3)}`;

test.describe("I-357 Reports: By year started", () => {
  test.use({ storageState: auth("staff"), viewport: DESKTOP });

  test("each year shows On coursework, On thesis / dissertation and Graduated, with the students behind every number", async ({ page }) => {
    const cohorts = await (await page.request.get("/api/reports/cohorts")).json();
    const expected = {};
    for (const row of cohorts.rows) {
      const year = (expected[row.entry] ||= { coursework: 0, thesis: 0, graduated: 0 });
      for (const [state, keys] of Object.entries(GROUPS)) for (const key of keys) year[state] += row[key] || 0;
    }
    const entries = Object.keys(expected).sort();
    expect(entries.length, "premise: the demo data has several years started").toBeGreaterThan(1);

    await page.goto("/reports?report=cohorts");
    const table = page.getByRole("table", { name: "Students by year started and state" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "On coursework" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "On thesis / dissertation" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Graduated" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Students per year started/ })).toBeVisible();
    for (const entry of entries) {
      const row = table.getByRole("row").filter({ hasText: fullYear(entry) });
      await expect(row, `a row for ${fullYear(entry)}`).toHaveCount(1);
      const cells = await row.getByRole("cell").allInnerTexts();
      expect([Number(cells[1]), Number(cells[2]), Number(cells[3])], `${fullYear(entry)}: coursework, thesis, graduated`).toEqual([
        expected[entry].coursework, expected[entry].thesis, expected[entry].graduated,
      ]);
    }
    await shot(page, "by-year-started-1366.png");

    // Every count opens the students behind it.
    const target = entries.find((e) => expected[e].coursework > 0);
    const open = table.getByRole("button", { name: new RegExp(`started ${fullYear(target)}: On coursework`) });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: `On coursework, started ${fullYear(target)}` })).toBeVisible();
    await expect(dialog).toContainText(new RegExp(`${expected[target].coursework} rows?`));
    await shot(page, "by-year-started-students-1366.png");
    await page.keyboard.press("Escape");
  });

  test("Graduation candidates and Defenses are under it, not tabs of their own; the old addresses still work", async ({ page }) => {
    await page.goto("/reports?report=cohorts");
    await expect(page.getByRole("tab", { name: "By year started", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Graduation candidates", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Defenses", exact: true })).toHaveCount(0);
    const detail = page.getByRole("group", { name: "More detail" });
    await expect(detail.getByRole("button", { name: "Every stage" })).toHaveAttribute("aria-pressed", "true");
    await detail.getByRole("button", { name: "Graduation candidates" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Graduation candidates", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/view=graduation/);
    await page.goto("/reports?report=defenses");
    await expect(page.getByRole("tab", { name: "By year started", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(detail.getByRole("button", { name: "Defenses" })).toHaveAttribute("aria-pressed", "true");
  });

  test("390 px: the report fits and keeps all three states", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/reports?report=cohorts");
    await expect(page.getByRole("table", { name: "Students by year started and state" })).toBeVisible();
    expect(await noOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, "by-year-started-390.png");
  });
});
