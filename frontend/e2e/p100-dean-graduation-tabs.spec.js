// e2e-writes: none
// Packets D and G (I-146, I-147, I-157; spec .planning/research/CONSISTENCY-PROCESSES-2026-11-02.md).
// Written BEFORE the change; red on the old code. The roster answer is edited in the browser and every write is answered by
// page.route, so nothing reaches the server and no other spec's data matters.
//   Packet D, the Dean's Graduation page:
//     - "Endorsement batches" is the shared stage board (Board/Table toggle, a lock reason on a card that cannot move, "Move to…",
//       View details), not the private list + "Grouped workflow board" it had; the loading look is the shared skeleton;
//     - the Dean's decision is ONE dialog on both tabs: two buttons (Approve / Return), no select, a reason required to return;
//     - the page description says who does what;
//     - the Dean Practicum decision window is the shared step dialog (heading, reason box, refusal in words, focus back).
//   Packet G, the sweep:
//     - one Tabs component (tablist, tab, aria-selected, arrow keys) with one look at every page-level tab site;
//     - "…" (one character) in visible text, not "...".
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", "p100");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const BATCH = "Batch 1 October 2026";
const OTHER = "Batch 2 October 2026";
const BOARD = "Graduation workflow Kanban board";
const TOGGLE = "Choose how to show the requests";

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

/** Isabel's batch waits for the Dean; Hector's batch is with the Research Coordinator (so the Dean sees a locked card). */
async function mockGraduation(page) {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const isabel = body.roster.find((row) => row.student.name === "Isabel Flores");
    isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: "Ready for Dean Review", display_status: "Ready for Dean Review", registrar_status: "Pending" };
    isabel.next_action_owner = "Dean";
    const hector = body.roster.find((row) => row.student.name === "Hector Ong");
    hector.endorsement = { ...isabel.endorsement, id: 987001, batch_name: OTHER, endorsement_status: "Research Review", display_status: "Research Review", registrar_status: "Pending" };
    hector.has_submitted_documents = true;
    hector.next_action_owner = "Research Coordinator";
    await route.fulfill({ response, json: body });
  });
}

const noDots = async (page) => {
  const text = await page.getByRole("main").innerText();
  expect(text.match(/.{0,30}\.\.\..{0,10}/g) || [], 'no "..." in what the page shows').toEqual([]);
};

test.describe("Dean Graduation page", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("Endorsement batches is the shared board, with the description saying who does what", async ({ page }) => {
    await mockGraduation(page);
    await page.goto("/dean/approvals/graduation?tab=batches");
    const board = page.getByRole("region", { name: BOARD });
    await expect(board).toBeVisible();
    await expect(page.getByTestId("stage-board")).toBeVisible();
    // the private parts of the old tab are gone
    for (const gone of ["Grouped workflow board", "Ready graduation batches", "Approved graduation batches", "Apply Dean group action"]) {
      await expect(page.getByText(gone), gone).toHaveCount(0);
    }
    await expect(page.getByRole("searchbox", { name: "Search Dean review lists" })).toHaveCount(0);
    // the same toggle as every board
    const toggle = page.getByRole("group", { name: TOGGLE });
    await expect(toggle.getByRole("button", { name: "Board" })).toBeVisible();
    await expect(toggle.getByRole("button", { name: "Table" })).toBeVisible();
    // a card the Dean can act on: View details and "Move to…"
    const mine = board.locator("div[draggable]").filter({ hasText: BATCH });
    await expect(mine).toHaveCount(1);
    await expect(mine.getByRole("button", { name: `View details for ${BATCH}` })).toBeVisible();
    await expect(mine.getByRole("button", { name: /Move to/ })).toBeVisible();
    // a card that waits for somebody else: the lock reason is text on the card, and there is no "Move to…"
    const theirs = board.getByRole("article").filter({ hasText: OTHER }).locator(".."); // the card and its lock note
    await expect(theirs).toHaveCount(1);
    await expect(theirs.getByText(/^Waiting for: /)).toBeVisible();
    await expect(theirs.getByRole("button", { name: /Move to/ })).toHaveCount(0);
    // same empty-column wording as the other boards
    await expect(board.getByText("No candidates here").first()).toBeVisible();
    // the table lists the same batches
    await toggle.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("table").getByRole("row", { name: /Isabel Flores/ })).toHaveCount(1);
    await toggle.getByRole("button", { name: "Board" }).click();
    await expect(board).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "dean-batches-1366.png"), fullPage: true });
    // the description says who does what
    await expect(page.locator('[data-slot="description"]')).toContainText(/Academic Coordinator checks coursework.*Research Coordinator.*staff prepare.*You approve or return it/);
  });

  test("a skeleton board shows on Endorsement batches while the board request is held", async ({ page }) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route(/\/api\/transactions\/graduation\/context/, async (route) => { await held; await route.continue(); });
    await page.goto("/dean/approvals/graduation?tab=batches");
    await expect(page.getByTestId("skeleton-board")).toBeVisible();
    release();
    await expect(page.getByTestId("skeleton-board")).toHaveCount(0);
    await expect(page.getByTestId("stage-board")).toBeVisible();
  });

  for (const [label, path] of [["Roster & workflow", "/dean/approvals/graduation"], ["Endorsement batches", "/dean/approvals/graduation?tab=batches"]]) {
    test(`${label}: the Dean's decision is one dialog, two buttons, a reason to return`, async ({ page }) => {
      const sent = [];
      await mockGraduation(page);
      await page.route("**/api/graduation/batch-actions", (route) => { sent.push(route.request().postDataJSON()); return json(route, { message: "Graduation return sent." }); });
      await page.goto(path);
      const board = page.getByRole("region", { name: BOARD });
      await expect(board).toBeVisible();
      await board.getByRole("button", { name: `View details for ${BATCH}` }).click();
      const opener = page.getByRole("dialog").getByRole("button", { name: "Approve endorsement list" });
      await opener.click();
      const step = page.getByRole("dialog").last();
      await expect(step.getByRole("heading", { level: 2, name: "Dean decision" })).toBeVisible();
      await expect(step.getByLabel("Dean decision"), "no select: the decision is two buttons").toHaveCount(0);
      await expect(step.getByRole("button", { name: "Approve endorsement list", exact: true })).toBeVisible();
      await step.getByRole("button", { name: "Return endorsement list for revision", exact: true }).click();
      await expect(step.getByRole("alert").filter({ hasText: /required/i }), "the refusal is said in words").toBeVisible();
      await expect(step.getByRole("textbox")).toBeFocused();
      await step.getByRole("textbox").fill("Two names are missing.");
      await step.getByRole("button", { name: "Return endorsement list for revision", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("board-notice")).toContainText("Graduation return sent.");
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ action: "return", comment: "Two names are missing." });
    });
  }

  test("Tabs: arrow keys move the selection, aria-selected follows, the address follows", async ({ page }) => {
    await mockGraduation(page);
    await page.goto("/dean/approvals/graduation");
    const tabs = page.getByRole("tablist", { name: "Graduation views" });
    const roster = tabs.getByRole("tab", { name: "Roster & workflow" });
    const batches = tabs.getByRole("tab", { name: "Endorsement batches" });
    await expect(roster).toHaveAttribute("aria-selected", "true");
    await roster.focus();
    await page.keyboard.press("ArrowRight");
    await expect(batches).toHaveAttribute("aria-selected", "true");
    await expect(roster).toHaveAttribute("aria-selected", "false");
    await expect(batches).toBeFocused();
    await expect(page).toHaveURL(/tab=batches/);
    await page.keyboard.press("ArrowRight"); // wraps to the first
    await expect(roster).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(batches).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(roster).toHaveAttribute("aria-selected", "true");
    // only the selected tab is in the tab order
    await expect(roster).toHaveAttribute("tabindex", "0");
    await expect(batches).toHaveAttribute("tabindex", "-1");
  });

  test('no "..." in what the Dean pages show', async ({ page }) => {
    await mockGraduation(page);
    for (const path of ["/dean/approvals/graduation", "/dean/approvals/graduation?tab=batches", "/dean/approvals/practicum"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("stage-board")).toBeVisible();
      await noDots(page);
    }
  });
});

test.describe("Dean Practicum decision window", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("is the shared step dialog: heading, reason refused in words, focus back on the opener", async ({ page }) => {
    const calls = [];
    await page.route(/\/api\/approvals\/workflow\/practicum\/9101\/decide$/, async (route) => { calls.push(route.request().postDataJSON()); await json(route, { ok: true, message: "Practicum status reviewed by Dean (test)." }); });
    await page.route(/\/api\/approvals(\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const base = body.workflow_overview.find((item) => item.type === "practicum") || {};
      body.workflow_overview = [
        ...body.workflow_overview.filter((item) => item.type !== "practicum"),
        {
          ...base, type: "practicum", id: 9101, request_id: 9101, status: "Report Sent to Dean", workflow_status: "Report Sent to Dean",
          next_action_owner: "Dean", title: "Practicum report", subtitle: "Practicum",
          student: { id: 99101, name: "Tess Waitingdean", student_number: "GS-9101", program_code: "MAPSY" },
          record: { completed_hours: 200, required_hours: 200, practicum_site: "Counselling Center" }, messages: [], history: [],
        },
      ];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/dean/approvals/practicum");
    const board = page.getByRole("region", { name: "Practicum workflow board" });
    await expect(board).toBeVisible();
    const move = board.locator("div[draggable]").filter({ hasText: "Tess Waitingdean" }).getByRole("button", { name: /Move to/ });
    await move.click();
    await page.getByRole("menuitem", { name: "Returned" }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByRole("heading", { level: 2 }).first()).toHaveText("Confirm: Return for revision");
    await expect(dialog.getByRole("button", { name: "Cancel this step" }), "the shared step dialog's close button").toBeVisible();
    const box = dialog.getByRole("textbox");
    await expect(box, "the cursor starts in the reason box").toBeFocused();
    await dialog.getByRole("button", { name: "Return for revision", exact: true }).last().click();
    await expect(dialog.getByRole("alert").filter({ hasText: /Choose a reason or enter a comment/ })).toBeVisible();
    await expect(box).toHaveAttribute("aria-invalid", "true");
    expect(calls).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(move, "Escape gives the focus back to the button that opened it").toBeFocused();
  });
});

/** Every page-level tab site, as a role that can see it. The selected tab looks the same everywhere. */
const SITES = [
  { name: "Research Gate views (WorkflowPage)", role: "staff", path: "/workflow/research-gate", list: "Views", second: "Adviser designation" },
  { name: "Course Adjustments screens", role: "academic-coordinator", path: "/course-adjustments", list: "Course adjustment screens", second: "Offering setup" },
  { name: "Adviser Appointments lists", role: "staff", path: "/workflow/research-gate?view=adviser", list: "Appointment lists", second: null },
  { name: "Dean Graduation views", role: "dean", path: "/dean/approvals/graduation", list: "Graduation views", second: "Endorsement batches" },
];

test.describe("one Tabs component, one look", () => {
  test.use({ viewport: { width: 1366, height: 800 } });

  for (const site of SITES) {
    test.describe(site.name, () => {
      test.use({ storageState: authFile(site.role) });
      test(`a tablist with a selected tab, arrow keys, one look`, async ({ page }) => {
        await page.goto(site.path);
        const list = page.getByRole("tablist", { name: site.list });
        await expect(list).toBeVisible();
        const tabs = list.getByRole("tab");
        expect(await tabs.count()).toBeGreaterThanOrEqual(2);
        await expect(list.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
        const selected = list.locator('[role="tab"][aria-selected="true"]');
        await selected.focus();
        await page.keyboard.press("ArrowRight");
        const focused = list.locator('[role="tab"]:focus');
        await expect(focused).toHaveCount(1);
        await expect(focused).toHaveAttribute("aria-selected", "true");
        if (site.second) await expect(list.getByRole("tab", { name: site.second })).toHaveAttribute("aria-selected", "true");
        // the unselected tabs are out of the tab order
        const stops = await list.locator('[role="tab"][tabindex="0"]').count();
        expect(stops, "one tab stop in the list").toBe(1);
      });
    });
  }

  test("the selected tab looks the same at every site", async ({ browser }) => {
    const seen = [];
    for (const site of SITES) {
      const context = await browser.newContext({ storageState: authFile(site.role), viewport: { width: 1366, height: 800 } });
      const page = await context.newPage();
      await page.goto(site.path);
      const selected = page.getByRole("tablist", { name: site.list }).locator('[role="tab"][aria-selected="true"]');
      await expect(selected).toBeVisible();
      seen.push({ site: site.name, ...(await selected.evaluate((el) => { const css = getComputedStyle(el); return { background: css.backgroundColor, color: css.color, radius: css.borderTopLeftRadius, weight: css.fontWeight, size: css.fontSize }; })) });
      await context.close();
    }
    const [first, ...rest] = seen;
    for (const item of rest) {
      const { site, ...look } = item;
      const { site: _s, ...base } = first;
      expect(look, `${site} looks like ${first.site}`).toEqual(base);
    }
  });
});

test.describe('"…" is one character on the pages people wait on', () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 800 } });

  test('no "..." on the process boards or the graduation board', async ({ page }) => {
    for (const path of ["/workflow/leave-of-absence", "/workflow/graduation", "/workflow/practicum", "/course-adjustments", "/enrollment"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await noDots(page);
    }
  });
});
