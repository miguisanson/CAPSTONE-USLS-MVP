// UX research check 15 / issue I-092 (review F-38): an automated accessibility scan with axe-core
// (@axe-core/playwright, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) on the pages a thesis panel will open:
// every role's home, one board (Leave of Absence, staff), one list (Students), one record (a student), one form with its
// error summary showing (the student's Leave of Absence form after pressing Submit empty), one open dialog (a case
// window on the Leave of Absence board) and the Policy Assistant.
//
// The spec FAILS on any `serious` or `critical` violation, except the entries in ALLOWED below. Each allowed entry names
// the page, the axe rule, why it is allowed and the issue that owns the fix. `moderate` and `minor` findings are listed
// in the report but do not fail the run. Read-only: the form is only submitted empty (the page refuses it before any
// request, and a request that did go out would be answered by the browser). Order-independent: every test starts from the
// saved role session and reads the live API for what it needs.
//
// Set A11Y_OUT=<folder> to also write each scan as JSON (page, rule id, impact, count, example selector) for a report.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { ROLES } from "./support/accounts.js";
import { stubExternal } from "./support/checker.js";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const OUT = process.env.A11Y_OUT || "";
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

/**
 * Violations that live in a page file (src/pages/**) and so are not fixed by the shared library. One entry per
 * [page name, axe rule id]. Keep it short and each entry owned: when the owner issue closes, delete the entry.
 */
const ALLOWED = [
  // { page: "student: home", rule: "example-rule", reason: "why it is not fixed here", owner: "I-000", file: "src/pages/..." },
];

const isAllowed = (name, rule) => ALLOWED.some((a) => a.page === name && a.rule === rule);

/** Run axe on the current page and return a compact list of violations. */
async function scan(page, name) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(400); // let the last render settle
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations.map((v) => ({
    page: name,
    rule: v.id,
    impact: v.impact,
    count: v.nodes.length,
    help: v.help,
    example: v.nodes[0]?.target?.join(" ") || "",
    html: (v.nodes[0]?.html || "").slice(0, 200),
    summary: (v.nodes[0]?.failureSummary || "").split("\n").slice(0, 3).join(" | "),
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 12),
  }));
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`), JSON.stringify(violations, null, 2));
  }
  return violations;
}

/** Fail on serious/critical violations that are not on the allow-list; print the rest as notes. */
function judge(name, violations) {
  const blocking = violations.filter((v) => (v.impact === "serious" || v.impact === "critical") && !isAllowed(name, v.rule));
  const lines = blocking.map((v) => `${v.impact} ${v.rule} x${v.count}: ${v.help} - e.g. ${v.example}\n    ${v.html}`);
  expect(lines, `${name}: serious or critical accessibility violations\n${lines.join("\n")}`).toEqual([]);
  const notes = violations.filter((v) => !blocking.includes(v));
  if (notes.length) console.log(`[a11y] ${name}: not blocking: ${notes.map((v) => `${v.rule}(${v.impact}) x${v.count}`).join(", ")}`);
}

test.beforeEach(async ({ context }) => {
  await stubExternal(context);
});

// ---- every role's home -------------------------------------------------------------------------------------------------
for (const entry of ROLES) {
  test.describe(`home: ${entry.key}`, () => {
    test.use({ storageState: authFile(entry.key), viewport: { width: 1366, height: 768 } });
    test(`${entry.key} home ${entry.home}`, async ({ page }) => {
      await page.goto(entry.home);
      await expect(page.locator("aside nav a").first()).toBeVisible();
      judge(`${entry.key}: home`, await scan(page, `${entry.key}: home`));
    });
  });
}

// ---- staff: a board, a list, a record, a dialog, the assistant -----------------------------------------------------------
test.describe("staff pages", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("board: Leave of Absence", async ({ page }) => {
    await page.goto("/workflow/leave-of-absence");
    await expect(page.getByRole("region", { name: "Leave of absence board" })).toBeVisible();
    judge("staff: board", await scan(page, "staff: board"));
  });

  test("list: Students", async ({ page }) => {
    await page.goto("/students");
    await expect(page.getByRole("table").first()).toBeVisible();
    judge("staff: list", await scan(page, "staff: list"));
  });

  test("record: one student", async ({ page }) => {
    const listed = await page.request.get("/api/students");
    expect(listed.ok()).toBeTruthy();
    const id = (await listed.json()).items[0].id;
    await page.goto(`/students/${id}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    judge("staff: record", await scan(page, "staff: record"));
  });

  test("dialog: a case window on the Leave of Absence board", async ({ page }) => {
    await page.goto("/workflow/leave-of-absence");
    await page.getByRole("button", { name: /^View details for / }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole("heading", { name: "The request", exact: true })).toBeVisible();
    judge("staff: dialog", await scan(page, "staff: dialog"));
  });

  test("Policy Assistant", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("textbox", { name: "Your question" })).toBeVisible();
    judge("staff: assistant", await scan(page, "staff: assistant"));
  });
});

// ---- a phone: tables scroll sideways inside their own box, which must be reachable by keyboard ----------------------------
test.describe("phone width", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("staff Enrollment table at 390 px", async ({ page }) => {
    await page.goto("/enrollment");
    await expect(page.getByRole("table").first()).toBeVisible();
    judge("staff: table at 390", await scan(page, "staff: table at 390"));
  });

  test("staff Students list at 390 px", async ({ page }) => {
    await page.goto("/students");
    await expect(page.getByRole("table").first()).toBeVisible();
    judge("staff: list at 390", await scan(page, "staff: list at 390"));
  });
});

// ---- student: a form with its error summary showing -------------------------------------------------------------------
test.describe("student form with errors", () => {
  test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 768 } });

  test("Leave of Absence form after Submit with nothing filled in", async ({ page }) => {
    // The seeded student may not be allowed to file today, so the page's GET is answered with the real response plus an
    // open leave form (the same approach as e2e/p82-student-pages.spec.js). Nothing is written.
    const SEM = (label, extra = {}) => ({ label, start_date: "2027-01-10", end_date: "2027-05-10", state: "Upcoming", filing_status: "Pass", filing_detail: "Spec.", ...extra });
    await page.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.student.standing = "Active";
      data.student.enrollment_tag = "";
      const o = data.leave_overview;
      o.cases = [];
      o.banner = null;
      o.rules = { max_period_semesters: 2, max_total_semesters: 4 };
      o.loa_semester_options = [SEM("AY 2026-2027 2nd Semester"), SEM("AY 2027-2028 1st Semester", { start_date: "2027-08-01", end_date: "2027-11-29" })];
      o.can_file = { extension: { allowed: false, reason: "" }, loa: { allowed: true, reason: "" }, readmission: { allowed: false, reason: "" } };
      data.loa_allowed_reasons = ["Medical / health", "Family emergency"];
      await route.fulfill({ response, json: data });
    });
    await page.route("**/api/student-portal/requests/*", (route) => route.fulfill({ status: 400, json: { error: "Spec: no request is ever sent." } }));
    await page.goto("/student/requests/leave-of-absence");
    await page.getByRole("button", { name: "Submit leave request", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toBeVisible();
    judge("student: form with errors", await scan(page, "student: form with errors"));
  });
});
