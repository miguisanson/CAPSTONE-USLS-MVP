// e2e-writes: none
// UX audit Phase 4 (2026-11-21, issues UX-23..UX-25). Written before the change. Reads only.
//   UX-23 the Work Queue's tasks are split into Mine / Waiting on others / All; Mine is the default; a row another office
//         holds is greyed (data-not-yours) and the row's link is an arrow (owner 2026-11-20, IM50)
//   UX-24 the home's "Needs your action" is a preview of the Mine tab: the same tasks in the same order, and "View all"
//         opens the Mine tab
//   UX-25 the Dean's Approvals Queue is one table, oldest wait first, with process chips and their counts; ?process=
//         opens it filtered. The Dean's sidebar and the per-process boards stay as they are (owner 2026-11-21).
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

async function signedIn(browser, email) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const main = (page) => page.locator("main");
const norm = (text) => String(text || "").replace(/\s+/g, " ").trim();
const OFFICE = "Graduate School Staff";

async function taskRows(page) {
  const table = main(page).getByRole("table", { name: "Open and recent tasks" });
  await expect(table).toBeVisible();
  await page.waitForLoadState("networkidle");
  return table.locator("tbody tr").filter({ hasNot: page.getByText("No tasks match") });
}
const ownerOf = async (row) => norm(await row.locator("td").nth(1).innerText());

test.describe("UX Phase 4: the staff Work Queue", () => {
  test("UX-23 Mine opens first; Waiting on others and All are one click away; others' rows are grey", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/work-queue");
      const tabs = main(page).getByRole("tablist", { name: "Whose tasks" });
      await expect(tabs.getByRole("tab")).toHaveText([/^Mine/, /^Waiting on others/, /^All/]);
      await expect(tabs.getByRole("tab", { name: /^Mine/ })).toHaveAttribute("aria-selected", "true");

      let rows = await taskRows(page);
      expect(await rows.count(), "the demo office has tasks").toBeGreaterThan(0);
      // IM50: every Mine row is this office's, so there is no Owner column to say so on each row
      await expect(main(page).getByRole("columnheader", { name: "Owner" })).toHaveCount(0);
      for (let i = 0; i < (await rows.count()); i++) await expect(rows.nth(i)).not.toHaveAttribute("data-not-yours", "true");
      // the link is an arrow with a name, not a sentence ("Open Leave of Absence")
      const arrow = rows.first().getByRole("link").last();
      await expect(arrow).toHaveAttribute("aria-label", /\S/);
      expect(norm(await arrow.innerText())).toBe("");

      await tabs.getByRole("tab", { name: /^Waiting on others/ }).click();
      await expect(page).toHaveURL(/view=others/);
      rows = await taskRows(page);
      expect(await rows.count(), "other offices hold tasks").toBeGreaterThan(0);
      for (let i = 0; i < (await rows.count()); i++) {
        expect(await ownerOf(rows.nth(i)), `Waiting row ${i}`).not.toBe(OFFICE);
        await expect(rows.nth(i)).toHaveAttribute("data-not-yours", "true");
      }

      await tabs.getByRole("tab", { name: /^All/ }).click();
      rows = await taskRows(page);
      const owners = new Set();
      for (let i = 0; i < (await rows.count()); i++) owners.add(await ownerOf(rows.nth(i)));
      expect(owners.has(OFFICE) && owners.size > 1, [...owners].join(", ")).toBeTruthy();
    } finally { await context.close(); }
  });

  test("UX-23 old links still work: ?owner= is All, ?owner=Dean is Waiting on others for the Dean", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/work-queue?owner=");
      await expect(main(page).getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
      await page.goto(`/work-queue?owner=${encodeURIComponent(OFFICE)}`);
      await expect(main(page).getByRole("tab", { name: /^Mine/ })).toHaveAttribute("aria-selected", "true");
      await page.goto("/work-queue?owner=Dean");
      await expect(main(page).getByRole("tab", { name: /^Waiting on others/ })).toHaveAttribute("aria-selected", "true");
      const rows = await taskRows(page);
      for (let i = 0; i < (await rows.count()); i++) expect(await ownerOf(rows.nth(i))).toBe("Dean");
    } finally { await context.close(); }
  });

  test("UX-24 the home's Needs your action lists the first tasks of Mine, in the same order", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/");
      const section = main(page).locator("section").filter({ has: page.getByRole("heading", { name: "Needs your action" }) });
      await expect(section).toBeVisible();
      const home = (await section.locator("li p.text-sm").allInnerTexts()).map(norm);
      expect(home.length).toBeGreaterThan(0);
      const viewAll = section.getByRole("link", { name: /^View all/ });
      await expect(viewAll).toHaveAttribute("href", "/work-queue");

      await viewAll.click();
      await expect(main(page).getByRole("tab", { name: /^Mine/ })).toHaveAttribute("aria-selected", "true");
      const rows = await taskRows(page);
      const queue = [];
      for (let i = 0; i < Math.min(home.length, await rows.count()); i++) queue.push(norm(await rows.nth(i).locator("td").first().innerText()));
      expect(queue).toEqual(home);
    } finally { await context.close(); }
  });
});

test.describe("UX Phase 4: the Dean's Approvals Queue", () => {
  const daysOf = (text) => {
    const t = norm(text);
    if (/today/.test(t)) return 0;
    const m = t.match(/(\d+)\s+days?/);
    return m ? Number(m[1]) : null;
  };

  test("UX-25 one table, oldest wait first, process chips with counts", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/dean/approvals");
      const queue = main(page).getByTestId("dean-queue");
      await expect(queue.getByRole("table")).toHaveCount(1);
      const chips = queue.getByRole("group", { name: "Process" }).getByRole("button");
      await expect(chips.first()).toHaveText(/^All\s*\d+$/);
      await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
      const all = Number(norm(await chips.first().innerText()).match(/\d+$/)[0]);
      const rows = queue.getByRole("table").locator("tbody tr");
      await expect(rows).toHaveCount(Math.min(all, 25));

      const waits = [];
      for (let i = 0; i < (await rows.count()); i++) waits.push(daysOf(await rows.nth(i).locator("td").nth(4).innerText()));
      expect(waits.every((d) => d !== null), waits.join(",")).toBeTruthy();
      expect(waits, "oldest wait first").toEqual([...waits].sort((a, b) => b - a));

      // a process chip filters the table and its count is the rows it leaves
      const second = chips.nth(1);
      const [label, count] = norm(await second.innerText()).match(/^(.*?)\s*(\d+)$/).slice(1);
      await second.click();
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await expect(rows).toHaveCount(Math.min(Number(count), 25));
      for (let i = 0; i < (await rows.count()); i++) await expect(rows.nth(i).locator("td").nth(2)).toHaveText(label);
      await expect(page).toHaveURL(/process=/);
    } finally { await context.close(); }
  });

  test("UX-25 ?process= opens the queue filtered; the sidebar still opens the boards", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/dean/approvals?process=leave-of-absence");
      const queue = main(page).getByTestId("dean-queue");
      await expect(queue.getByRole("group", { name: "Process" }).getByRole("button", { name: /^Leave of Absence/ })).toHaveAttribute("aria-pressed", "true");
      const rows = queue.getByRole("table").locator("tbody tr");
      for (let i = 0; i < (await rows.count()); i++) {
        const cell = rows.nth(i).locator("td").nth(2);
        if (await cell.count()) await expect(cell).toHaveText("Leave of Absence");
      }
      // owner 2026-11-21: the per-process pages stay the boards
      await page.goto("/dean/approvals/leave-of-absence");
      await expect(main(page).getByTestId("stage-board")).toBeVisible();
      await expect(page.locator('nav a[href="/dean/approvals/leave-of-absence"]').first()).toBeVisible();
    } finally { await context.close(); }
  });
});
