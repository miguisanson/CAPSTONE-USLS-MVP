// Packet wf4 (Phase 5 P7.5, I-063 / I-089 / I-102): pins what the Practicum board, Defense scheduling and the availability
// workspace show and do BEFORE they are moved onto the component library. Written first and green on the old markup; it
// must stay green after the restyle, except the lines marked CHANGED BY WF4 (listed in the commit that changes them).
// Read-only: nothing is saved (the afterEach fails on any non-GET API call). The practicum roster of the seed has no
// record yet, so one case (Andrea Villanueva, "MOA Submitted", 0/200 hours) is added to the roster answer with page.route.
// Demo data read only: Nico Barrientos (id 146, proposal defense booked, panel assigned), Miko Almario (id 125, no panel).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p78");
const WIDTHS = [
  [1366, 768],
  [1920, 1080],
  [390, 844],
];
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "wf4 practicum and scheduling", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Screenshots of the page as it stands at the three widths, and a check that nothing makes the page scroll sideways. */
async function shotsAt(page, name) {
  const original = page.viewportSize();
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    expect(await overflow(page), `${name} at ${width}px scrolls sideways`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize(original);
}

/**
 * The practicum roster as the seed leaves it: nobody has a record, a message, a date or an activity line. Other specs in a
 * full run file practicum cases against the same database first, so the tests that read "nothing has happened yet" (cards
 * that wait for documents, no "Updated" line, "No activity yet") say so to the page instead of trusting the shared data.
 */
async function withPristineRoster(page) {
  await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const row of body.roster) {
      row.record = null;
      row.has_submitted_documents = false;
      row.last_activity_at = null;
      row.messages = [];
      row.history = [];
    }
    body.recent_logs = [];
    await route.fulfill({ response, json: body });
  });
}

/** The practicum roster of the seed plus one case with a record, so the card, the table and the case window have data. */
async function withOneCase(page) {
  await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const row = body.roster.find((item) => item.student.student_number === "GS-2026-PRAC-01");
    row.record = {
      id: 9100,
      student_id: row.student.id,
      status: "MOA Submitted",
      moa_status: "Uploaded",
      moa_uploaded: true,
      practicum_site: "Community Counselling Center",
      supervisor_name: "Ms. Rina Lopez",
      required_hours: 200,
      completed_hours: 0,
      document_status: "Missing",
      certificate_count: 0,
      remarks: "MOA for review.",
      completion_status: "Pending",
      coordinator_review_status: "Pending",
      dean_report_status: "Not Sent",
      moa_attachment: null,
      certificate_attachment: null,
      completion_attachments: [],
      attachments: [],
      timeline: row.timeline,
      created_at: "2026-10-19T08:00:00Z",
      updated_at: "2026-10-20T08:00:00Z",
    };
    row.moa_status = "Uploaded";
    row.documents_status = "Missing";
    row.has_submitted_documents = true;
    row.last_activity_at = "2026-10-20T08:00:00Z";
    row.next_action_owner = "Graduate School Staff";
    row.messages = [];
    row.history = [];
    await route.fulfill({ response, json: body });
  });
}

test.describe("Practicum (staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("header, scope note, filters and the board columns", async ({ page }) => {
    await withPristineRoster(page);
    await page.goto("/workflow/practicum");
    await expect(main(page).getByRole("heading", { level: 1, name: "Practicum" })).toBeVisible();
    await expect(main(page).getByText("Track practicum MOA receipt, hours, certificates, completion report, and Dean review")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "How this works" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "View recent activity" })).toBeVisible();
    await expect(main(page).getByText(/Psychology and MSGC/).first()).toBeVisible();
    await expect(main(page).getByText(/5 rules from the Graduate School policies/)).toBeVisible();
    await expect(main(page).getByPlaceholder(/Search students/)).toBeVisible();
    await expect(main(page).getByRole("combobox", { name: "Filter by program" })).toBeVisible();
    await expect(main(page).getByText(/Showing 2 of 2/)).toBeVisible();
    const board = main(page).getByRole("region", { name: "Practicum workflow board" });
    await expect(board).toBeVisible();
    for (const column of ["Awaiting Submission", "Submitted", "Eligibility Review", "Documents Review", "In Progress", "Completion Review", "Completed", "Returned"]) {
      await expect(board.getByRole("heading", { name: column }), column).toBeVisible();
    }
    for (const card of ["Andrea Villanueva", "Paolo Ramirez"]) {
      await expect(board.getByText(card, { exact: true }), card).toBeVisible();
    }
    await expect(board.getByText("GS-2026-PRAC-01 · MAPSY")).toBeVisible();
    await expect(board.getByText("Waiting for documents").first()).toBeVisible();
    await expect(board.getByText("Waiting for: Student").first()).toBeVisible();
    await shotsAt(page, "practicum-board");
  });

  test("a search narrows the board and can be cleared", async ({ page }) => {
    await page.goto("/workflow/practicum");
    const board = main(page).getByRole("region", { name: "Practicum workflow board" });
    await expect(board.getByText("Paolo Ramirez", { exact: true })).toBeVisible();
    await main(page).getByPlaceholder(/Search students/).fill("Andrea");
    await expect(main(page).getByText(/Showing 1 of 2/)).toBeVisible();
    await expect(board.getByText("Paolo Ramirez", { exact: true })).toHaveCount(0);
    await main(page).getByPlaceholder(/Search students/).fill("zzzz-nobody");
    await expect(main(page).getByText("No recent practicum submissions match the filters.")).toBeVisible();
    await main(page).getByRole("button", { name: /Clear 1 filter/ }).click();
    await expect(board.getByText("Paolo Ramirez", { exact: true })).toBeVisible();
  });

  test("a case with a record: the card, the table and the case window", async ({ page }) => {
    await withOneCase(page);
    await page.goto("/workflow/practicum");
    const board = main(page).getByRole("region", { name: "Practicum workflow board" });
    const card = board.getByRole("article").filter({ hasText: "Andrea Villanueva" });
    await expect(card).toContainText("Community Counselling Center");
    await expect(card).toContainText("0/200 hrs");
    await expect(card).toContainText("Next: Graduate School Staff");
    await expect(card.getByRole("button", { name: /Message/ })).toBeVisible();
    await shotsAt(page, "practicum-card");

    await main(page).getByRole("button", { name: "Table" }).click();
    const table = main(page).getByRole("table");
    for (const header of ["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]) {
      await expect(table.getByRole("columnheader", { name: header }), header).toBeVisible();
    }
    const row = table.getByRole("row", { name: /Andrea Villanueva/ });
    await expect(row).toContainText("GS-2026-PRAC-01");
    await expect(row).toContainText("0/200");
    await shotsAt(page, "practicum-table");

    await row.getByRole("button", { name: /Open case/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Andrea Villanueva" })).toBeVisible();
    await expect(dialog).toContainText("Practicum case");
    await expect(dialog).toContainText("MOA Submitted");
    for (const label of ["Eligibility", "MOA", "Documents", "Hours", "Supervisor", "Completion"]) {
      await expect(dialog.getByText(label, { exact: true }).first(), label).toBeVisible();
    }
    await expect(dialog.getByText("Ms. Rina Lopez").first()).toBeVisible();
    await expect(dialog.getByText("Automatic eligibility")).toBeVisible();
    await expect(dialog.getByText("Student submission", { exact: true })).toBeVisible();
    await expect(dialog.getByText("MOA for review.")).toBeVisible();
    await expect(dialog.getByText("No uploaded files for this request")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Forward to Academic Coordinator" })).toBeEnabled(); // not clicked
    await expect(dialog.getByRole("button", { name: /Message \/ Return/ })).toBeVisible();
    await shotsAt(page, "practicum-case");
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // "Forward ..." asks for a confirmation first; the window shows the move and closes without saving.
    await main(page).getByRole("button", { name: "Board" }).click();
    await card.getByRole("button", { name: /View/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Forward to Academic Coordinator" }).click();
    const confirm = page.getByRole("dialog").last();
    await expect(confirm.getByRole("heading", { name: "Confirm: Forward to Academic Coordinator" })).toBeVisible();
    await expect(confirm).toContainText("Workflow movement");
    await expect(confirm).toContainText("MOA Submitted");
    await expect(confirm).toContainText("MOA Under Review");
    await page.keyboard.press("Escape");
  });

  test("the two header buttons open the guide and the activity window", async ({ page }) => {
    await withPristineRoster(page);
    await page.goto("/workflow/practicum");
    await main(page).getByRole("button", { name: "How this works" }).click();
    const guide = page.getByRole("dialog");
    await expect(guide.getByRole("heading", { name: "How practicum works" })).toBeVisible();
    for (const label of ["Purpose", "Who submits", "Who reviews", "When something is incomplete", "Main stages"]) {
      await expect(guide.getByText(label, { exact: true }), label).toBeVisible();
    }
    await expect(guide.getByText("What completion means")).toBeVisible();
    await shotsAt(page, "practicum-guide");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await main(page).getByRole("button", { name: "View recent activity" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Recent workflow activity" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("No activity yet")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Defense scheduling and the availability workspace", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("availability workspace: window, overlap grid, panel table, shared options, a chosen option", async ({ page }) => {
    await page.goto("/workflow/defense-scheduling?student_id=146");
    await expect(main(page).getByRole("heading", { level: 1, name: "Defense Scheduling" })).toBeVisible();
    await expect(main(page).getByText("Preferred date window")).toBeVisible();
    await expect(main(page).getByText(/The system searches for a 120-minute overlap/)).toBeVisible();
    await expect(main(page).getByText(/14-day lead time applied/)).toBeVisible();
    await expect(main(page).getByLabel("From", { exact: true })).toBeVisible();
    await expect(main(page).getByLabel("To", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Availability overlap", { exact: true })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Thu, Nov 5, 2026 08:00: 5 of 5 available, selectable/ })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /17:00: 0 of 5 available/ }).first()).toBeDisabled();
    await expect(main(page).getByText("Panel availability", { exact: true })).toBeVisible();
    await expect(main(page).getByText("5 participants")).toBeVisible();
    await expect(main(page).getByText("Overlap found").first()).toBeVisible();
    await expect(main(page).getByText("Best shared options")).toBeVisible();
    await expect(main(page).getByText("639 conflict-free found")).toBeVisible();
    await expect(main(page).getByText(/Earliest option/)).toBeVisible();
    await shotsAt(page, "availability");

    await expect(main(page).getByText("Selected proposed schedule")).toHaveCount(0);
    await main(page).getByRole("button", { name: /Earliest option/ }).click();
    await expect(main(page).getByText("Selected proposed schedule")).toBeVisible();
    await expect(main(page).getByLabel(/Selected date/)).toHaveValue("2026-11-05");
    await expect(main(page).getByLabel(/Start time/)).toHaveValue("08:00");
    await expect(main(page).getByLabel(/End time/)).toHaveValue("10:00");
    // a cell of the grid picks a slot too
    await main(page).getByRole("button", { name: /Fri, Nov 6, 2026 09:00: 5 of 5 available, selectable/ }).click();
    await expect(main(page).getByLabel(/Selected date/)).toHaveValue("2026-11-06");
    await expect(main(page).getByLabel(/Start time/)).toHaveValue("09:00");
  });

  test("a student with no panel: the notice, no options, the book button stays disabled", async ({ page }) => {
    await page.goto("/workflow/defense-scheduling?student_id=125");
    await expect(main(page).getByText("No final panel is available. Complete Panel Matching before scheduling.")).toBeVisible();
    await expect(main(page).getByText("0 conflict-free found")).toBeVisible();
    await expect(main(page).getByText(/No conflict-free overlap appears in this window/)).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Set defense schedule" })).toBeDisabled();
    await expect(main(page).getByText("0/4 selected")).toBeVisible();
    await expect(main(page).getByLabel(/Staff override/)).toBeVisible();
    await shotsAt(page, "scheduling-no-panel");
  });

  test("change panel opens the picker; the final-schedule form and the history", async ({ page }) => {
    await page.goto("/workflow/defense-scheduling?student_id=146");
    await main(page).getByRole("button", { name: "Change panel" }).click();
    await expect(main(page).getByText(/Reassign the defense panel/)).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Update panel" })).toBeEnabled(); // not clicked: the four current members are already chosen
    await expect(main(page).getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await main(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(main(page).getByText(/Reassign the defense panel/)).toHaveCount(0);
    for (const label of [/Selected date/, /Start time/, /End time/, /Defense type/, /Mode/, /Venue/, /Scheduling constraints/, /Reason for rescheduling/, /Requested by/, /Source reference/]) {
      await expect(main(page).getByLabel(label).first(), String(label)).toBeVisible();
    }
    await expect(main(page).getByRole("button", { name: "Reschedule defense" })).toBeDisabled();
    await expect(main(page).getByRole("link", { name: /Open the defense calendar/ })).toHaveAttribute("href", "/workflow/defense-scheduling?view=calendar");
    await expect(main(page).getByRole("link", { name: /View faculty profiles/ })).toHaveAttribute("href", "/faculty");
    await main(page).getByRole("button", { name: /View schedule history/ }).click();
    await expect(main(page).getByRole("button", { name: /Hide schedule history/ })).toBeVisible();
    await expect(main(page).getByText(/Proposal Defense ·/).first()).toBeVisible();
  });
});

test.describe("Defense scheduling and the Research Gate header (research coordinator)", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("the research coordinator sees the same scheduling page", async ({ page }) => {
    await page.goto("/workflow/defense-scheduling?student_id=146");
    await expect(main(page).getByRole("heading", { level: 1, name: "Defense Scheduling" })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: "Scheduling" })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: "Calendar" })).toBeVisible();
    await expect(main(page).getByText("Panel members", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Availability overlap", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Best shared options")).toBeVisible();
    await shotsAt(page, "scheduling-rc");
  });

  test("Research Gate header at the three widths", async ({ page }) => {
    await page.goto("/workflow/research-gate?student_id=146");
    await expect(main(page).getByRole("heading", { level: 1, name: "Research Gate" })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Research Gate record" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await shotsAt(page, "research-gate-header");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// I-063: the lifecycle workflow pages open with the shared PageHeader, not a white card with "WHO USES IT / DATA CAPTURED".
// I-089: Practicum's scope is a one-line note, its columns are as wide as the other boards', a card with no date says nothing.
// Written after the pins above and red on the old code.
// ---------------------------------------------------------------------------------------------------------------
const LIFECYCLE_PAGES = [
  ["student-handoff", "Student Handoff"],
  ["course-audit", "Course Audit"],
  ["research-gate", "Research Gate"],
  ["panel-matching", "Panel Matching"],
  ["defense-scheduling", "Defense Scheduling"],
  ["practicum", "Practicum"],
  ["graduation", "Graduation"],
];

test.describe("Lifecycle workflow pages open with the shared header (I-063)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  for (const [slug, title] of LIFECYCLE_PAGES) {
    test(`${slug}: PageHeader title, no who-uses/data-captured boilerplate, header not boxed in a card`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      const heading = main(page).getByRole("heading", { level: 1, name: title });
      await expect(heading).toBeVisible();
      await expect(main(page).locator("h1")).toHaveCount(1);
      await page.waitForLoadState("networkidle");
      await expect(main(page).getByText(/who uses it/i)).toHaveCount(0);
      await expect(main(page).getByText(/data captured/i)).toHaveCount(0);
      // PageHeader renders a bare <header>; the old block was a .card around it.
      const boxed = await heading.evaluate((node) => Boolean(node.closest("header")?.closest(".card")));
      expect(boxed, "the header sits inside a card").toBe(false);
      const headerBox = await heading.evaluate((node) => {
        const header = node.closest("header");
        return header ? header.getBoundingClientRect().height : 0;
      });
      expect(headerBox, "there is a header element").toBeGreaterThan(0);
    });
  }

  test("the who-uses / data-captured text is kept in the How this works guide", async ({ page }) => {
    await page.goto("/workflow/practicum");
    await main(page).getByRole("button", { name: "How this works" }).click();
    const guide = page.getByRole("dialog");
    await expect(guide.getByText("Used by", { exact: true })).toBeVisible();
    await expect(guide).toContainText("Student / GS Staff / Academic Coordinator / Dean");
    await expect(guide.getByText("What it records", { exact: true })).toBeVisible();
    await expect(guide).toContainText("MOA status, practicum site, required/completed hours");
    await page.keyboard.press("Escape");

    await page.goto("/workflow/research-gate?student_id=146");
    const rail = main(page).locator(".card").filter({ has: page.getByRole("heading", { level: 2, name: "How this works" }) });
    await expect(rail).toContainText("Used by");
    await expect(rail).toContainText("What it records");
  });

  test("header buttons exist on the pages that have no side guide", async ({ page }) => {
    for (const slug of ["practicum", "graduation", "course-audit"]) {
      await page.goto(`/workflow/${slug}`);
      await expect(main(page).getByRole("button", { name: "How this works" }), slug).toBeVisible();
      await expect(main(page).getByRole("button", { name: "View recent activity" }), slug).toBeVisible();
    }
  });
});

test.describe("Practicum board matches the other boards (I-089)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("scope is a one-line note under the header, not a green banner", async ({ page }) => {
    await page.goto("/workflow/practicum");
    await expect(main(page).getByRole("heading", { level: 1, name: "Practicum" })).toBeVisible();
    await expect(main(page).getByText("Program scope:")).toHaveCount(0);
    const note = main(page).getByText(/Practicum applies to Psychology and MSGC students only/);
    await expect(note).toBeVisible();
    const box = await note.boundingBox();
    expect(box.height, "the note is one line").toBeLessThan(28);
    const banner = await note.evaluate((node) => getComputedStyle(node.closest("div,p")).backgroundColor);
    expect(banner, "no green banner behind the note").not.toMatch(/rgb\((2[0-4]\d|[0-9]{1,2}), 2[0-5]\d, /);
  });

  test("columns are as wide as on the Withdrawal board", async ({ page }) => {
    const widthOf = async (slug, label) => {
      await page.goto(`/workflow/${slug}`);
      const board = page.getByRole("region", { name: label });
      await expect(board).toBeVisible();
      return board.locator(":scope section[aria-label]").first().evaluate((node) => Math.round(node.getBoundingClientRect().width));
    };
    const practicum = await widthOf("practicum", "Practicum workflow board");
    const withdrawal = await widthOf("withdrawal", "Subject withdrawal board");
    expect(practicum).toBe(withdrawal);
  });

  test("a card with no date does not say Updated", async ({ page }) => {
    await withPristineRoster(page);
    await page.goto("/workflow/practicum");
    const board = main(page).getByRole("region", { name: "Practicum workflow board" });
    await expect(board.getByText("Andrea Villanueva", { exact: true })).toBeVisible();
    await expect(board.getByText(/Updated\s*[—-]/)).toHaveCount(0);
    await expect(board.getByText(/Updated/)).toHaveCount(0);
  });

  test("a card with a date still shows it", async ({ page }) => {
    await withOneCase(page);
    await page.goto("/workflow/practicum");
    const card = main(page).getByRole("region", { name: "Practicum workflow board" }).getByRole("article").filter({ hasText: "Andrea Villanueva" });
    await expect(card).toContainText(/Updated .*2026/);
  });
});
