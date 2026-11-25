// e2e-writes: none
// UX audit Phase 2 (2026-11-20, issues UX-11..UX-17). Written before the change. Reads only.
// Owner 2026-11-20: "lessen the amount of text"; say a thing once (title, subtitle and a third line said the same thing).
//   UX-11 the homes: no header line or section subtitle that repeats the heading; no Refresh data / Reports buttons
//   UX-12 a row not opened yet has a small dot (no "New" badge, no green row); the row's link is an arrow
//   UX-13 a row says "Overdue" once (no Overdue chip beside "Overdue, was due ...")
//   UX-14 process pages: one "Help" button; the rules, form numbers, How this works and Recent activity are inside it
//   UX-15 the colour legend is a small "Colour key" button, not a full-width bar
//   UX-16 Export CSV / Print sit inside the filter box, not on a row of their own
//   UX-17 Research Gate: no second heading and count sentence repeating the page title
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD, loadState } from "./support/accounts.js";

async function signedIn(browser, email, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const main = (page) => page.locator("main");
const sectionOf = (page, name) => main(page).locator("section", { has: page.getByRole("heading", { name, exact: true }) });

const HOMES = [
  ["staff", "staff@usls.edu.ph", "/"],
  ["dean", "dean@usls.edu.ph", "/dean"],
  ["faculty", () => loadState().facultyEmail, "/faculty-portal"],
  ["student", "student@usls.edu.ph", "/student"],
];

test.describe("UX Phase 2: homes", () => {
  for (const [role, email, path] of HOMES) {
    test(`UX-11/12 ${role}: no repeated subtitles, no New badge, arrow links`, async ({ browser }) => {
      const context = await signedIn(browser, typeof email === "function" ? email() : email);
      const page = await context.newPage();
      try {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const actions = sectionOf(page, "Needs your action");
        await expect(actions).toHaveCount(1);
        // no subtitle under the section heading
        await expect(actions.locator("h2 + p")).toHaveCount(0);
        const waiting = main(page).locator("section", { has: page.getByRole("heading", { name: /^Waiting on/ }) });
        if (await waiting.count()) await expect(waiting.locator("h2 + p")).toHaveCount(0);
        // no "New" badge text; an unread row carries a labelled dot
        await expect(main(page).getByText("New", { exact: true })).toHaveCount(0);
        const fresh = actions.locator('li[data-fresh="true"]');
        if (await fresh.count()) {
          await expect(fresh.first().getByRole("img", { name: "Not opened yet" })).toHaveCount(1);
          const bg = await fresh.first().evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(bg, "an unread row is not a green row").toBe("rgb(255, 255, 255)");
        }
        // every row link is an arrow with a name, no visible words
        const links = actions.locator("li a");
        for (let i = 0; i < (await links.count()); i++) {
          await expect(links.nth(i)).toHaveAttribute("aria-label", /^(Open|Review|Answer|Reply|View|Go|Sign|Decide|Request|Upload|File) \S/);
          expect(((await links.nth(i).innerText()) || "").trim(), "no words on the arrow").toBe("");
        }
      } finally { await context.close(); }
    });
  }

  test("UX-11 staff: no header line under Welcome, no Refresh data or Reports button", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const header = main(page).locator("header").first();
      await expect(header.getByRole("heading", { level: 1 })).toHaveText(/^Welcome, /);
      await expect(header.locator('[data-slot="description"]')).toHaveCount(0);
      await expect(main(page).getByRole("button", { name: "Refresh data" })).toHaveCount(0);
      await expect(header.getByRole("link", { name: "Reports" })).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("UX-13 staff: an overdue row says Overdue once", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    await context.route("**/api/tasks?*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (data.items?.length) {
        data.items[0] = { ...data.items[0], overdue: true, status: "Overdue", due_at: "2026-11-10T00:00:00" };
      }
      await route.fulfill({ response, json: data });
    });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const row = sectionOf(page, "Needs your action").locator("li").first();
      const text = (await row.innerText()).replace(/\s+/g, " ");
      expect(text.match(/overdue/gi) || [], `"${text}"`).toHaveLength(1);
    } finally { await context.close(); }
  });
});

const PROCESS_PAGES = [
  ["staff", "staff@usls.edu.ph", "/workflow/leave-of-absence"],
  ["staff", "staff@usls.edu.ph", "/workflow/graduation"],
  ["staff", "staff@usls.edu.ph", "/workflow/research-gate"],
  ["dean", "dean@usls.edu.ph", "/dean/approvals/practicum"],
];

test.describe("UX Phase 2: process pages", () => {
  for (const [role, email, path] of PROCESS_PAGES) {
    test(`UX-14 ${path}: one Help button holds the rules, forms, guide and activity`, async ({ browser }) => {
      const context = await signedIn(browser, email);
      const page = await context.newPage();
      try {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const header = main(page).locator("header").first();
        await expect(header.getByRole("button")).toHaveText(["Help"]);
        await expect(header.locator('[data-slot="forms"]')).toHaveCount(0);
        await expect(main(page).getByRole("region", { name: "Rules applied on this screen" })).toHaveCount(0);
        await header.getByRole("button", { name: "Help" }).click();
        const help = page.getByRole("dialog");
        await expect(help).toBeVisible();
        await expect(help.getByRole("region", { name: "Rules applied on this screen" })).toHaveCount(0); // CHANGED BY owner feedback 2026-11-23 (IM58)
        await expect(help).toContainText(/Forms? GS-F-/);
        await expect(help.getByRole("button", { name: "How this works" })).toBeVisible();
        await expect(help.getByRole("button", { name: "Recent activity" })).toBeVisible();
        await help.getByRole("button", { name: "How this works" }).click();
        await expect(page.getByRole("dialog").getByRole("heading").first()).toContainText(/How .* works/);
      } finally { await context.close(); }
    });
  }

  test("UX-15 the colour key is a small button, not a full-width bar", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      const legend = main(page).locator("[data-status-legend]");
      await expect(legend).toHaveCount(1);
      const box = await legend.boundingBox();
      expect(box.width, "legend width").toBeLessThan(260);
      await expect(main(page).getByText("What the colours mean")).toHaveCount(0);
      await legend.getByRole("button", { name: "Colour key" }).click();
      await expect(legend.locator("[data-legend-tone]").first()).toBeVisible();
    } finally { await context.close(); }
  });

  test("UX-16 Export CSV and Print are inside the filter box", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/leave-of-absence");
      const box = main(page).locator("[data-filter-box]");
      await expect(box).toHaveCount(1);
      await expect(box.getByRole("button", { name: "Export CSV" })).toBeVisible();
      await expect(box.getByRole("button", { name: "Print" })).toBeVisible();
    } finally { await context.close(); }
  });

  test("UX-17 Research Gate: the board is not introduced a second time", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/workflow/research-gate");
      await page.waitForLoadState("networkidle");
      // CHANGED BY UX phase 7 (UX-34): the heading is back for screen readers only (heading order), never shown on screen
      const heading = main(page).getByRole("heading", { name: "Who is at the Research Gate" });
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveClass(/\bsr-only\b/);
      await expect(main(page).getByText(/^\d+ students: \d+ in Title Defense/)).toHaveCount(0);
    } finally { await context.close(); }
  });
});
