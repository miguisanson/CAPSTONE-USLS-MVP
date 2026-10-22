// Packet conA (I-122, I-127 and part of I-128; .planning/research/CONSISTENCY-2026-10-22.md findings 1, 7 and 10).
// Owner rule IM24: pages of the same kind behave the same. Written BEFORE the change; red on the old code.
// Through the real UI, as the Dean. Read only: every answer that needs a fixed scenario is edited in the browser with
// page.route (the Dean's /api/approvals list), and the decision calls are answered by the test, so no other spec's
// data matters and nothing is changed.
//   - finding 1 / I-122  the Dean's Practicum Reports page is the same board as the other Dean boards: the
//                        search box, the Board/Table toggle, "How this works" and "View recent activity", the
//                        "Rules applied on this screen" panel, a card that cannot move shows a lock and why, "Move to..."
//                        on a card that can, the same words, and it fits 390 px with no sideways scroll;
//   - finding 7 / I-127  a Course Adjustments plan is decided with the same decision panel as every other Dean decision:
//                        a return without a comment is refused on the page (nothing is sent), both buttons ask first;
//   - finding 10         the four standalone boards speak to the Dean ("your decision", not "Record an application"),
//                        the summary line keeps "AWOL" written as a name, and every Dean board has its "N waiting" chip.
// Screenshots go to E2E_SHOTS_DIR (default e2e-artifacts/p90) at 1366 and 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p90");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

const main = (page) => page.locator("main");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
};

// The four standalone boards, with the Dean's own words for each (processConfig.jsx `deanDescription`).
const STANDALONE = [
  {
    slug: "leave-of-absence", title: "Leave of Absence", types: ["leave-of-absence"],
    description: "Leave of absence requests that Graduate School staff forwarded for your decision. Approve, return or deny each one.",
  },
  {
    slug: "readmission", title: "Readmission", types: ["readmission"],
    description: "Requests to return from a leave that Graduate School staff forwarded for your decision. Approve, return or deny each one.",
  },
  {
    slug: "awol", title: "AWOL & Residency", types: ["awol-return"],
    description: "AWOL return declarations that Graduate School staff forwarded for your decision, and the residency records on file.",
  },
  {
    slug: "withdrawal", title: "Subject Withdrawal", types: ["withdrawal"],
    description: "Requests to withdraw from one subject that Graduate School staff forwarded for your decision. Approve, return or deny each one.",
  },
];
const STAFF_VOICE = [
  "Record an LOA application",
  "Record a return request",
  "Automatically flag policy-backed",
  "Withdraw a student from one subject until",
];

const TOGGLE = { name: "Choose how to show the requests" };
const SEARCH = { name: "Search requests by name, student number or program" };

/** What the page loaded from /api/approvals (read at test time, so the expected "N waiting" is whatever the data is now). */
async function openAs(page, path, edit) {
  if (edit) {
    await page.route(/\/api\/approvals$/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({ response, json: edit(json) });
    });
  }
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/approvals");
  await page.goto(path);
  return (await loaded).json();
}

const waitingOf = (approvals, types) =>
  (approvals.workflow_pending || []).filter((item) => types.includes(item.type) && (item.type !== "graduation" || item.eligibility?.eligible === true)).length;

const chip = (page) => page.locator('main [data-slot="badge"]').first();

/** The same parts on a Dean board: header buttons, rules panel, search box, Board/Table toggle (Board pressed). */
async function expectSharedParts(page, label) {
  await expect(page.getByRole("button", { name: "How this works" }), `${label}: How this works`).toBeVisible();
  await expect(page.getByRole("button", { name: "View recent activity" }), `${label}: View recent activity`).toBeVisible();
  await expect(page.getByRole("region", { name: "Rules applied on this screen" }), `${label}: rules panel`).toBeVisible();
  await expect(page.getByRole("searchbox", SEARCH), `${label}: search box`).toBeVisible();
  const toggle = page.getByRole("group", TOGGLE);
  await expect(toggle, `${label}: Board/Table toggle`).toBeVisible();
  await expect(toggle.getByRole("button", { name: "Board" }), `${label}: Board is the first view`).toHaveAttribute("aria-pressed", "true");
  await expect(toggle.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "false");
}

// --------------------------------------------------------------------------------------- scenario for the Practicum page
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
const practicumItem = (id, status, name, number, owner, daysAgo) => ({
  id,
  type: "practicum",
  title: `Practicum status report · ${name}`,
  subtitle: `MSGC · 200/200 hours · ${status}`,
  status,
  student: { id: 9300 + id, name, student_number: number, program_code: "MSGC" },
  submitted_at: iso(daysAgo),
  details: "Practicum hours and certificates were accepted by the Academic Coordinator.",
  timeline: [],
  record: { practicum_site: "Test Counselling Center", completed_hours: 200, required_hours: 200, attachments: [] },
  has_submitted_documents: true,
  request_id: id,
  next_action_owner: owner,
  last_activity_at: iso(daysAgo),
  unresolved_messages: 0,
  messages: [],
  history: [],
});
const WAITING = practicumItem(9101, "Report Sent to Dean", "Tess Waitingdean", "2299101", "Dean", 3);
const RETURNED = practicumItem(9102, "Additional Certificates Requested", "Rhea Returned", "2299102", "Academic Coordinator", 5);
const REVIEWED = practicumItem(9103, "Dean Reviewed", "Rina Reviewed", "2299103", null, 8);
const withPracticum = (json) => {
  const others = (list) => (list || []).filter((item) => item.type !== "practicum");
  return {
    ...json,
    workflow_pending: [...others(json.workflow_pending), WAITING],
    workflow_overview: [...others(json.workflow_overview), WAITING, RETURNED, REVIEWED],
  };
};

const boardOf = (page) => page.getByRole("region", { name: "Practicum workflow board" });
const cardOf = (board, name) => board.getByRole("article").filter({ hasText: name });
const wrapperOf = (card) => card.locator("xpath=..");

test.describe("conA Dean boards share one set of parts (finding 1 and 10)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  for (const board of STANDALONE) {
    test(`${board.title}: Dean words, the "N waiting" chip, header buttons, rules panel, toolbar and toggle`, async ({ page }) => {
      const approvals = await openAs(page, `/dean/approvals/${board.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: board.title })).toBeVisible();
      await expect(page.getByRole("button", { name: "How this works" })).toBeVisible();

      // finding 10: the description is written for the Dean, the chip counts what waits on the Dean
      await expect(page.locator('main [data-slot="description"]').first()).toHaveText(board.description);
      for (const staffText of STAFF_VOICE) await expect(main(page).getByText(staffText)).toHaveCount(0);
      await expect(chip(page), `${board.title}: the waiting chip`).toHaveText(`${waitingOf(approvals, board.types)} waiting`);

      await expectSharedParts(page, board.title);

      // the summary line writes stage names as they are written (AWOL, not awol)
      const summary = await page.locator('p[aria-live="polite"]').first().innerText();
      expect(summary, `${board.title}: summary line "${summary}"`).not.toMatch(/\bawol\b/);
      if (board.slug === "awol") expect(summary).toMatch(/AWOL/);
    });
  }

  test("Graduation Endorsement and Course Adjustments carry the same waiting chip", async ({ page }) => {
    let approvals = await openAs(page, "/dean/approvals/graduation");
    await expect(page.getByRole("heading", { level: 1, name: "Graduation Endorsement" })).toBeVisible();
    await expect(chip(page)).toHaveText(`${waitingOf(approvals, ["graduation"])} waiting`);

    approvals = await openAs(page, "/dean/approvals/course-adjustments");
    await expect(page.getByRole("heading", { level: 1, name: "Course Adjustments" })).toBeVisible();
    await expect(chip(page)).toHaveText(`${(approvals.pending || []).length} waiting`);
  });
});

test.describe("conA Dean Practicum Reports is the shared board (finding 1 / I-122)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("same header, rules panel, toolbar and toggle; the old private board is gone", async ({ page }) => {
    const approvals = await openAs(page, "/dean/approvals/practicum", withPracticum);
    await expect(page.getByRole("heading", { level: 1, name: "Practicum Reports" })).toBeVisible();
    await expect(page.locator('main [data-slot="description"]').first()).toHaveText("Practicum completion reports sent to the Dean for final review.");
    await expect(chip(page)).toHaveText(`${waitingOf(approvals, ["practicum"])} waiting`);
    await expect(chip(page)).toHaveText("1 waiting");
    await expectSharedParts(page, "Practicum Reports");
    await expect(main(page).getByText("Grouped workflow board")).toHaveCount(0);
    await expect(main(page).getByRole("searchbox", { name: "Search Dean review lists" })).toHaveCount(0);
    await expect(main(page).getByText("Updated from")).toHaveCount(0);
    await expect(main(page).getByRole("heading", { name: "Waiting for your decision" })).toHaveCount(0);

    // the header buttons open the same windows as the other boards
    await page.getByRole("button", { name: "How this works" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "View recent activity" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await shot(page, "practicum-1366.png");
  });

  test("columns with a description; a card that cannot move shows a lock and why; one that can offers Move to", async ({ page }) => {
    await openAs(page, "/dean/approvals/practicum", withPracticum);
    const board = boardOf(page);
    await expect(board).toBeVisible();
    for (const [label, description] of [
      ["With the Dean", "Reports the Academic Coordinator sent to you."],
      ["Returned", "Sent back to the Academic Coordinator."],
      ["Reviewed", "Marked reviewed by the Dean."],
    ]) {
      const column = board.getByRole("region", { name: label });
      await expect(column.getByRole("heading", { name: label }), `${label} column`).toBeVisible();
      await expect(column.getByText(description), `${label} description`).toBeVisible();
    }

    const waiting = cardOf(board, "Tess Waitingdean");
    await expect(waiting).toHaveCount(1);
    await expect(wrapperOf(waiting)).toHaveAttribute("draggable", "true");
    await expect(waiting).toContainText("2299101 · MSGC");
    await expect(waiting).toContainText("Report Sent to Dean");
    await expect(waiting.getByText("Next: Dean")).toBeVisible();
    await expect(wrapperOf(waiting).getByRole("button", { name: /Move to/ })).toBeVisible();
    await expect(waiting.getByRole("link", { name: "View details for Tess Waitingdean" })).toHaveAttribute("href", "/dean/case/practicum/9101");

    const returned = cardOf(board, "Rhea Returned");
    await expect(wrapperOf(returned)).toHaveAttribute("draggable", "false");
    await expect(wrapperOf(returned).getByText("Waiting for: Academic Coordinator")).toBeVisible();
    await expect(wrapperOf(returned).getByRole("button", { name: /Move to/ })).toHaveCount(0);

    const reviewed = cardOf(board, "Rina Reviewed");
    await expect(wrapperOf(reviewed)).toHaveAttribute("draggable", "false");
    await expect(wrapperOf(reviewed).getByText("Finished - nothing more to do")).toBeVisible();
    await expect(wrapperOf(reviewed).getByRole("button", { name: /Move to/ })).toHaveCount(0);
  });

  test("Move to... Reviewed asks in one window; Return needs a comment; nothing is sent until the Dean confirms", async ({ page }) => {
    const calls = [];
    await page.route(/\/api\/approvals\/workflow\/practicum\/9101\/decide$/, async (route) => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, message: "Practicum status reviewed by Dean (test)." } });
    });
    await openAs(page, "/dean/approvals/practicum", withPracticum);
    const board = boardOf(page);
    const wrapper = wrapperOf(cardOf(board, "Tess Waitingdean"));

    // Return for revision: a window that needs a comment
    await wrapper.getByRole("button", { name: /Move to/ }).click();
    await page.getByRole("menuitem", { name: "Returned" }).click();
    let dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Return for revision");
    await dialog.getByRole("button", { name: "Return for revision" }).click();
    await expect(dialog.getByText("Choose a reason or enter a comment before returning or denying the request.")).toBeVisible();
    expect(calls, "a return without a comment sends nothing").toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Mark reviewed: the comment is optional; closing the window decides nothing; the button sends it
    await wrapper.getByRole("button", { name: /Move to/ }).click();
    await page.getByRole("menuitem", { name: "Reviewed" }).click();
    dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Mark reviewed");
    await expect(dialog).toContainText("Tess Waitingdean");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls, "closing the window decides nothing").toEqual([]);

    await wrapper.getByRole("button", { name: /Move to/ }).click();
    await page.getByRole("menuitem", { name: "Reviewed" }).click();
    dialog = page.getByRole("dialog").last();
    await dialog.getByLabel(/Review comment/).fill("All 200 hours documented.");
    await dialog.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ decision: "review", note: "All 200 hours documented." });
  });

  test("Table view lists the same reports; the filters narrow both views", async ({ page }) => {
    await openAs(page, "/dean/approvals/practicum", withPracticum);
    await page.getByRole("group", TOGGLE).getByRole("button", { name: "Table" }).click();
    const rows = main(page).getByRole("row");
    for (const name of ["Tess Waitingdean", "Rhea Returned", "Rina Reviewed"]) {
      await expect(rows.filter({ hasText: name }), `${name} in the table`).toHaveCount(1);
    }
    await expect(rows.filter({ hasText: "Tess Waitingdean" }).getByRole("link", { name: /View details/ })).toHaveAttribute("href", "/dean/case/practicum/9101");
    await page.getByRole("searchbox", SEARCH).fill("Rhea");
    await expect(rows.filter({ hasText: "Rhea Returned" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Tess Waitingdean" })).toHaveCount(0);
    await page.getByRole("group", TOGGLE).getByRole("button", { name: "Board" }).click();
    await expect(cardOf(boardOf(page), "Rhea Returned")).toHaveCount(1);
    await expect(cardOf(boardOf(page), "Tess Waitingdean")).toHaveCount(0);
  });

  test("390 px: the page fits, the locks are readable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAs(page, "/dean/approvals/practicum", withPracticum);
    await expect(page.getByRole("heading", { level: 1, name: "Practicum Reports" })).toBeVisible();
    await expect(boardOf(page)).toBeVisible();
    await expect(page.getByRole("group", TOGGLE)).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    const lock = wrapperOf(cardOf(boardOf(page), "Rhea Returned")).getByText("Waiting for: Academic Coordinator");
    await lock.scrollIntoViewIfNeeded();
    await expect(lock).toBeVisible();
    await shot(page, "practicum-390.png");
    await page.getByRole("group", TOGGLE).getByRole("button", { name: "Table" }).click();
    expect(await noOverflow(page), "the table view fits too").toBe(true);
  });
});

// --------------------------------------------------------------------------------------- Course Adjustments
const PLAN = {
  id: 9201,
  program_code: "MSCS",
  term_label: "AY 2099-2100 1st Semester",
  status: "Submitted",
  submitted_at: iso(2),
  notes: "",
  offerings: [
    { id: 1, code: "CS-701", title: "Advanced Algorithms", demand_count: 12, section_count: 1, status: "Offered" },
    { id: 2, code: "CS-702", title: "Machine Learning", demand_count: 9, section_count: 1, status: "Suggested" },
  ],
};
const withPlan = (json) => ({ ...json, pending: [PLAN] });

test.describe("conA Dean Course Adjustments decides like every other Dean decision (finding 7 / I-127)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("Return without a comment is refused on the page; both buttons ask first; the answer carries the comment", async ({ page }) => {
    const calls = [];
    await page.route(/\/api\/approvals\/9201\/decide$/, async (route) => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, message: "Offering plan decided (test)." } });
    });
    await openAs(page, "/dean/approvals/course-adjustments", withPlan);
    const card = page.getByRole("heading", { level: 2, name: /^Course offerings · MSCS/ }).locator("xpath=ancestor::*[contains(@class,'card')][1]");
    await expect(card).toBeVisible();
    await expect(chip(page)).toHaveText("1 waiting");
    await expect(card.getByRole("group", { name: "Decision" })).toBeVisible();
    await expect(card.getByLabel("Note to the Academic Coordinator")).toBeVisible();
    await shot(page, "course-adjustments-1366.png");

    // 1. Return with no comment: refused on the page, nothing sent, no window
    await card.getByRole("button", { name: "Return for revision" }).click();
    await expect(card.getByText("Enter a comment explaining what to revise before returning the plan.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls, "no request was sent").toEqual([]);

    // 2. With a comment the Dean is asked first; Escape decides nothing
    const comment = "Please add a second section for the high-demand subjects.";
    await card.getByLabel("Note to the Academic Coordinator").fill(comment);
    await card.getByRole("button", { name: "Return for revision" }).click();
    let dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Return for revision");
    await expect(dialog).toContainText("MSCS");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls, "Escape decided nothing").toEqual([]);

    // 3. Confirm: the server gets the decision and the comment
    await card.getByRole("button", { name: "Return for revision" }).click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Return for revision" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Offering plan decided (test)." })).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ decision: "return", note: comment });

    // 4. Approve asks first too (the comment is optional)
    await card.getByRole("button", { name: "Approve" }).click();
    dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading").first()).toHaveText("Confirm: Approve");
    await dialog.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ decision: "approve" });
  });
});
