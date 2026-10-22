// Packet P7.5 (Phase 5, UI-SPEC section 8, WorkflowPage restyle): pins what the Student Handoff, Course Audit, Research Gate,
// Panel Matching and Defense Scheduling workflow pages show and do BEFORE they are moved onto the component library.
// Written first and green on the old markup; it must stay green after the restyle. Read-only: the sidebar and links are
// used to arrive, the monitoring-upload list is answered from a fixture (so the validation table and the Compare dialog
// can be opened without importing a workbook), and nothing is saved.
//   - Student Handoff (staff): heading, "Import from monitoring sheet", "Full sheet" link, Browse files, Import students
//     disabled until a file is chosen, Upload history, the Onboarding report; with one fixture upload that has an unresolved
//     discrepancy: the history opens, the issue row has a checkbox, a status, and Compare opens a dialog (existing and
//     uploaded record, subject comparison, three actions) that closes with Escape and the Edit button shows the four fields;
//   - Course Audit (staff, by address: no sidebar entry): read-only notice with links to Monitoring Sheet and Enrollment;
//   - Research Gate (research coordinator): record, progress stages, requirement rows with statuses, the coordinator-only
//     buttons, the link to Panel Matching;
//   - Panel Matching (research coordinator): ranked table with the suggested seats, the expandable "Why this score",
//     the four seat selectors preselected, the excluded-adviser note, Finalize enabled;
//   - Defense Scheduling (staff): tabs, readiness, the matched panel, Reschedule / Cancel for a booked defense.
// Demo data read only: Nico Barrientos (id 146, proposal defense booked, panel assigned), Miko Almario (id 125, panel ready).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_DIR lets a before/after comparison write to two folders; the default is artifacts/p75.
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p75");
const WIDTHS = [
  [1366, 768],
  [1920, 1080],
  [390, 844],
];
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P7.5 workflow pages", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");
const sidebar = (page) => page.locator("aside nav");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Screenshots of the page as it stands at the three widths, and a check that nothing makes the page scroll sideways. */
async function shotsAt(page, name) {
  const original = page.viewportSize();
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
    await page.waitForTimeout(600);
    expect(await overflow(page), `${name} at ${width}px scrolls sideways`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize(original);
}

async function openFromSidebar(page, label, url) {
  await page.goto("/");
  await expect(sidebar(page).first()).toBeVisible();
  await sidebar(page).getByRole("link", { name: label }).click();
  await expect(main(page).locator("h1")).toBeVisible();
  if (url) {
    await page.goto(url);
    await expect(main(page).locator("h1")).toBeVisible();
  }
  await page.waitForLoadState("networkidle");
}

// One upload with one unresolved discrepancy, in the shape of GET /api/monitoring/uploads (monitoring_upload_dict).
const ISSUE = {
  id: 9001,
  upload_id: 9000,
  row_number: 4,
  student_id: null,
  student: null,
  incoming_student_number: "GS-FIX-001",
  incoming_name: "Testa Fixture",
  issue: "Conflict with existing record",
  summary: "Completed subjects differ",
  details: [],
  discrepancies: [{ type: "Completed subjects regressed", messages: ["MIT 201 was Completed and is now Missing"] }],
  discrepancy_count: 1,
  existing: { name: "Testa Fixture", student_number: "GS-FIX-001", academic_year_entry: "22-23", completed_count: 2 },
  uploaded: { first_name: "Testa", last_name: "Fixture", student_number: "GS-FIX-001", academic_year_entry: "22-23", subjects: { "MIT 201": false, "MIT 202": true } },
  edited: null,
  subject_comparison: [
    { code: "MIT 201", existing: "Completed", uploaded: "Missing", different: true, regression: true },
    { code: "MIT 202", existing: "Completed", uploaded: "Completed", different: false, regression: false },
  ],
  status: "Unresolved",
  resolution_action: null,
  resolution_upload: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-10-20T08:00:00Z",
};
const UPLOADS = {
  items: [
    {
      id: 9000,
      original_name: "MIT_Monitoring_Fixture.xlsx",
      program: "MIT",
      rows: 12,
      subjects: 20,
      uploaded_at: "2026-10-20T08:00:00Z",
      created: 0,
      updated: 12,
      skipped: 0,
      conflict_count: 1,
      unresolved_count: 1,
      resolved_count: 0,
      conflicts: [],
      issues: [ISSUE],
      download_url: "/api/monitoring/uploads/9000/download",
    },
  ],
};

test.describe("Student Handoff (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("import page: heading, dropzone, disabled import, history, onboarding report", async ({ page }) => {
    await openFromSidebar(page, /1 · Student Handoff/);
    await expect(page).toHaveURL(/\/workflow\/student-handoff/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Student Handoff" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Import from monitoring sheet" })).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Full sheet/ })).toHaveAttribute("href", "/monitoring-sheet");
    await expect(main(page).getByText("Drag & drop your .xlsx here")).toBeVisible();
    await expect(main(page).getByText("Browse files")).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Import students/ })).toBeDisabled();
    await expect(main(page).getByRole("heading", { level: 3, name: "Upload history" })).toBeVisible();
    await expect(main(page).getByText("0 backups")).toBeVisible();
    await expect(main(page).getByText("No monitoring-sheet backups yet.")).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: /Onboarding report/ })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "How this works" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Recent in this workflow" })).toBeVisible();
    await shotsAt(page, "handoff");
  });

  test("a wrong file type is refused in words, a workbook enables Import", async ({ page }) => {
    await openFromSidebar(page, /1 · Student Handoff/);
    const input = main(page).locator('input[type="file"]').first();
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(main(page).getByText("Please choose an Excel .xlsx file in the AC Student Monitoring format.")).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Import students/ })).toBeDisabled();
    await input.setInputFiles({ name: "sheet.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("x") });
    await expect(main(page).getByText("sheet.xlsx")).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Import students/ })).toBeEnabled(); // not clicked: nothing is saved
    await main(page).getByRole("button", { name: "Remove file" }).click();
    await expect(main(page).getByRole("button", { name: /Import students/ })).toBeDisabled();
  });

  test("an upload with an unresolved discrepancy: the table, Compare, the dialog", async ({ page }) => {
    await page.route(/\/api\/monitoring\/uploads$/, (route) => route.fulfill({ json: UPLOADS }));
    await openFromSidebar(page, /1 · Student Handoff/);
    await expect(main(page).getByText("1 backup", { exact: true })).toBeVisible();
    await main(page).getByRole("button", { name: /View upload history/ }).click();
    await expect(main(page).getByText("MIT_Monitoring_Fixture.xlsx")).toBeVisible();
    await expect(main(page).getByText("1 unresolved").first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Download MIT_Monitoring_Fixture.xlsx" })).toBeVisible();
    await main(page).getByText("MIT_Monitoring_Fixture.xlsx").click(); // opens the <details>
    const row = main(page).getByRole("row", { name: /Testa Fixture/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("GS-FIX-001");
    await expect(row).toContainText("Completed subjects regressed");
    await expect(row).toContainText("Unresolved");
    await expect(row.getByRole("checkbox", { name: "Select Testa Fixture" })).toBeEnabled();
    await expect(main(page).getByRole("columnheader", { name: "Discrepancies" })).toBeVisible();
    await shotsAt(page, "handoff-issues");

    await row.getByRole("button", { name: "Compare" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Testa Fixture" })).toBeVisible();
    await expect(dialog).toContainText("Row 4");
    await expect(dialog.getByText("Detected discrepancies")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Existing record" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Uploaded record" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Subject comparison" })).toBeVisible();
    await expect(dialog.getByRole("row", { name: /MIT 201/ })).toContainText(/needs review/i);
    await expect(dialog.getByRole("button", { name: /Keep Existing/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Use Uploaded/ })).toBeVisible();
    await dialog.getByRole("button", { name: /^Edit$/ }).click();
    for (const label of ["Student ID", "First name", "Last name", "School Year / AY Entry"]) {
      await expect(dialog.getByLabel(label), label).toBeVisible();
    }
    await expect(dialog.getByRole("button", { name: "Save Edited Record" })).toBeVisible();
    await shotsAt(page, "handoff-compare");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });
});

test.describe("Course Audit (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("read-only notice with links to the coursework pages", async ({ page }) => {
    // There is no sidebar entry for this page (see the packet report); it is reached by its address.
    await page.goto("/workflow/course-audit");
    await expect(main(page).getByRole("heading", { level: 1, name: "Course Audit" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Course records are read-only" })).toBeVisible();
    await expect(main(page).getByText("USLS grades remain in AIMS and are not encoded again in this portal.")).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Open Monitoring Sheet/ })).toHaveAttribute("href", "/monitoring-sheet");
    await expect(main(page).getByRole("link", { name: /Open Enrollment/ })).toHaveAttribute("href", "/enrollment");
    await shotsAt(page, "course-audit");
  });
});

test.describe("Research Gate (research coordinator)", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("record, progress, requirement rows and the coordinator's own buttons", async ({ page }) => {
    await openFromSidebar(page, /4 · Research Gate/, "/workflow/research-gate?student_id=146");
    await expect(main(page).getByRole("heading", { level: 1, name: "Research Gate Readiness" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Research Gate record" })).toBeVisible();
    for (const text of ["Nico Barrientos", "GS-2026-UD-01", "Dr. Paolo Navarro", "Reorder Point Policies and Service Levels for a Regional Hardware Distributor"]) {
      await expect(main(page).getByText(text).first(), text).toBeVisible();
    }
    await expect(main(page).getByText("Automatic research progress")).toBeVisible();
    const stages = main(page).getByRole("list", { name: "Automatic research progress" });
    for (const stage of ["Title Defense", "Proposal Defense", "Final Defense", "Completion"]) {
      await expect(stages.getByRole("listitem").filter({ hasText: stage }), stage).toBeVisible();
    }
    await expect(main(page).getByText("Completed requirements")).toBeVisible();
    await expect(main(page).getByText("Pending requirements")).toBeVisible();
    await expect(main(page).getByText("Proposal Defense requirements")).toBeVisible();
    await expect(main(page).getByText("Pending adviser signature")).toBeVisible();
    await expect(main(page).getByText("Student upload · 1/1 files").first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Proposal manuscript\.pdf/ })).toBeVisible();
    await expect(main(page).getByText("Panel assignment", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Upload required").first()).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Record clearance/ })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Record ethics clearance/ })).toBeVisible();
    await expect(main(page).locator("#ethics-clearance-record").getByText("Research Protocol Form 5.2 ethics clearance")).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Open matching/ })).toHaveAttribute("href", /\/workflow\/panel-matching\?student_id=146/);
    await expect(main(page).getByRole("heading", { level: 3, name: "Proposal defense result" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Verify submitted requirements" })).toBeEnabled(); // not clicked
    await shotsAt(page, "research-gate");
  });

  test("with no student chosen it asks for one", async ({ page }) => {
    await openFromSidebar(page, /4 · Research Gate/);
    await page.evaluate(() => window.localStorage.removeItem("workflowStudentId"));
    await page.goto("/workflow/research-gate");
    await expect(main(page).getByRole("heading", { level: 2, name: "Choose a student" })).toBeVisible();
    await expect(main(page).getByText("Select a student to begin")).toBeVisible();
  });
});

test.describe("Panel Matching (research coordinator)", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("ranked candidates, suggested seats, the evidence row, the seat selectors", async ({ page }) => {
    await openFromSidebar(page, /5 · Panel Matching/, "/workflow/panel-matching?student_id=125");
    await expect(main(page).getByRole("heading", { level: 1, name: "Panel Matching" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Panel recommendation workspace" })).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Faculty profiles/ })).toHaveAttribute("href", "/faculty");
    await expect(main(page).getByText("Proposal manuscript content ready")).toBeVisible();
    await expect(main(page).getByText("Ready", { exact: true })).toBeVisible();
    await expect(main(page).getByText("60 pts")).toBeVisible();
    await expect(main(page).getByText("25 pts")).toBeVisible();
    await expect(main(page).getByText("15 pts")).toBeVisible();
    await expect(main(page).getByText("Not eligible for this student's panel")).toBeVisible();
    await expect(main(page).getByText(/Dr\. Paolo Navarro.*adviser of this student/i)).toBeVisible();

    const table = main(page).getByRole("table", { name: "Ranked panel candidates" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    const rows = table.getByRole("row");
    expect(await rows.count()).toBeGreaterThanOrEqual(12); // header + 11 ranked faculty
    const first = rows.filter({ hasText: "Dr. Marco Villanueva" });
    await expect(first).toContainText("Suggested: Method Specialist");
    await expect(first).toContainText("/100");
    await expect(table.getByRole("link", { name: "Dr. Marco Villanueva" })).toHaveAttribute("href", /\/faculty\?faculty=\d+/);
    await expect(table.getByText("Suggested: Panel Chair")).toBeVisible();
    await expect(table.getByText("Overloaded").first()).toBeVisible();

    await first.getByRole("button", { name: "Why this score" }).click();
    await expect(first.getByRole("button", { name: "Hide why" })).toHaveAttribute("aria-expanded", "true");
    await expect(main(page).getByText("How the score was built")).toBeVisible();
    await expect(main(page).getByText("Why this faculty matches")).toBeVisible();
    await expect(main(page).getByText("Expertise records used")).toBeVisible();
    await first.getByRole("button", { name: "Hide why" }).click();
    await expect(main(page).getByText("How the score was built")).toHaveCount(0);

    await expect(main(page).getByText("Review and adjust the panel set")).toBeVisible();
    for (const role of ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]) {
      await expect(main(page).locator("label", { hasText: role }).locator("select"), role).toHaveValue(/\d+/);
    }
    await expect(main(page).locator("label", { hasText: "Panel Chair" }).locator("select option:checked")).toContainText("Dr. Daniel Uy");
    await expect(main(page).getByText("Panel composition rules")).toBeVisible();
    await expect(main(page).getByText("Suggested panel satisfies the protocol")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Finalize selected panel" })).toBeEnabled(); // not clicked

    await main(page).getByLabel("Search faculty").fill("zzzz-nobody");
    await expect(main(page).getByText(/No faculty match the current search/)).toBeVisible();
    await main(page).getByLabel("Search faculty").fill("");
    await expect(main(page).getByText(/Showing the top 11 ranked candidates/)).toBeVisible();
    await shotsAt(page, "panel-matching");
  });

  test("a panel already recorded is shown as final", async ({ page }) => {
    await openFromSidebar(page, /5 · Panel Matching/, "/workflow/panel-matching?student_id=146");
    await expect(main(page).getByText("Final panel selected")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Update final panel" })).toBeEnabled();
  });
});

test.describe("Defense Scheduling (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("tabs, readiness, matched panel, and the controls for a booked defense", async ({ page }) => {
    await openFromSidebar(page, /6 · Defense Scheduling/, "/workflow/defense-scheduling?student_id=146");
    await expect(main(page).getByRole("heading", { level: 1, name: "Defense Scheduling" })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: "Scheduling" })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: "Calendar" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Coordinate the defense schedule" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 3, name: "Proposal Defense" })).toBeVisible();
    await expect(main(page).getByText("Student readiness", { exact: false }).first()).toBeVisible();
    await expect(main(page).getByText("Missing Requirements").first()).toBeVisible();
    await expect(main(page).getByText("Panel members", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Dr. Marco Villanueva").first()).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Change panel" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Ask for availability" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Reschedule defense" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Cancel this booking instead/ })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /View schedule history/ })).toBeVisible();
    await shotsAt(page, "defense-scheduling");
  });
});
