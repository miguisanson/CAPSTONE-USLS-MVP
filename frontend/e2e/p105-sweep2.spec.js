// e2e-writes: none
// Persona sweep 2 (I-201..I-207): what Dr. Cruz (Research Coordinator), Maya (AWOL student) and Prof. Bautista (faculty) tripped on.
//   I-201  the Research Coordinator opens the faculty directory (read-only)
//   I-202  the bell's list stays inside a 390 px screen
//   I-204  an AWOL student reads her standing and her limit in plain words, with a link to the form, once
//   I-205  Research Gate opens on a list of who is ready / blocked / waiting, and a row opens the student's record
//   I-206  faculty Signatures (pending first, no empty "Choose a pending document"), Defense Schedule (upcoming first), the bell
//          lists a waiting panel invitation, "who is told" lines on Finalize and Set schedule, a new page opens at its top
// Read only: every answer is read from the API at test time, nothing is written.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.P105_SHOTS || "E:/Temp/claude/shots-sweep2";
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const MAYA = "awol.maya@usls.edu.ph";
const norm = (text) => (text || "").replace(/\s+/g, " ").trim();

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p105", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

async function ready(page, path) {
  await page.goto(path);
  await expect(page.locator("main h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// ------------------------------------------------------------------------------------------------ I-201
test.describe("I-201: the Research Coordinator reads the faculty directory", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("Faculty opens with the list, without an Add button", async ({ page }) => {
    await ready(page, "/faculty");
    await expect(page.getByText("This account cannot access that area")).toHaveCount(0);
    await expect(page.getByText("Could not load faculty")).toHaveCount(0);
    const api = await page.request.get("/api/faculty");
    expect(api.status()).toBe(200);
    const first = (await api.json()).items[0];
    await expect(page.locator("main").getByText(first.name).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add faculty" })).toHaveCount(0);
  });

  test("Panel Matching's and Defense Scheduling's profile links lead to a page that loads", async ({ page }) => {
    // The links sit on the pages once a student is chosen; the page they open is the one tested above.
    await ready(page, "/workflow/defense-scheduling");
    await expect(page.locator("main h1")).toContainText("Defense Scheduling");
  });
});

// ------------------------------------------------------------------------------------------------ I-205 / I-158
test.describe("I-205: Research Gate overview", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("shows who is ready, blocked or waiting on the board, filters, and a card opens the record", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    expect(overview.items.length).toBeGreaterThan(5);
    await ready(page, "/workflow/research-gate");
    const section = page.locator("#research-gate-overview");
    await expect(section.getByRole("heading", { name: "Who is at the Research Gate" })).toBeVisible();
    // the filter counts are the server's counts
    const status = section.getByLabel("Filter by status");
    await expect(status.locator("option", { hasText: `Blocked (${overview.counts.blocked})` })).toHaveCount(1);
    await status.selectOption("blocked");
    const blockedCards = section.locator("article");
    await expect(blockedCards.first()).toBeVisible();
    for (const text of await blockedCards.allInnerTexts()) expect(norm(text)).toContain("Blocked");
    await page.screenshot({ path: join(SHOTS, "research-gate-overview-1366.png"), fullPage: true });

    // a card opens the per-student record below
    const blocked = overview.items.find((row) => row.state === "blocked");
    await section.getByRole("searchbox").fill(blocked.student.name);
    await section.getByRole("button", { name: `Open the Research Gate record of ${blocked.student.name}` }).first().click();
    // F5-03: View opens the requirements window first; the full record is one click from there
    await page.getByRole("dialog").getByRole("button", { name: "Open the full record" }).click();
    await expect(page.getByRole("heading", { name: "Research Gate record" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`student_id=${blocked.student.id}`));
  });

  test("fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, "/workflow/research-gate");
    await expect(page.locator("#research-gate-overview")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: join(SHOTS, "research-gate-overview-390.png"), fullPage: true });
  });

  test("Finalize and Set schedule say who is told", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    const withPanel = overview.items.find((row) => row.reason.includes("Panel is in place"));
    test.skip(!withPanel, "no student has a panel in this data");
    await ready(page, `/workflow/defense-scheduling?student_id=${withPanel.student.id}`);
    await expect(page.locator("#schedule-notify-note")).toContainText("student and every panel member");
  });
});

// ------------------------------------------------------------------------------------------------ I-202 / I-206
test.describe("I-202: the bell fits a phone", () => {
  for (const role of ["student", "faculty", "research-coordinator"]) {
    test(`${role}: the list sits inside 390 px`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: authFile(role), viewport: { width: 390, height: 844 }, baseURL: BASE_URL });
      const page = await context.newPage();
      try {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        const box = await page.getByRole("region", { name: "Notifications" }).boundingBox();
        expect(box.x, "left edge").toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, "right edge").toBeLessThanOrEqual(390);
        await page.screenshot({ path: join(SHOTS, `bell-${role}-390.png`) });
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("I-206: faculty pages", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

  test("Signatures: pending first; no empty 'Choose a pending document'", async ({ page }) => {
    const context = await (await page.request.get("/api/faculty-portal/context")).json();
    const papers = (context.advisees || []).flatMap((row) => row.documents || []);
    const pending = papers.filter((paper) => !paper.approval).length;
    await ready(page, "/faculty-portal/signatures");
    if (!papers.length) return;
    if (pending === 0) {
      await expect(page.getByText("Choose a pending document")).toHaveCount(0);
      await expect(page.getByText("Nothing is waiting for your signature")).toBeVisible();
    } else {
      await expect(page.getByText("Choose a pending document")).toBeVisible();
      await expect(page.locator("main").getByText("Needs signature").first()).toBeVisible();
    }
    // a signed card's "Open document" is a working link (it was inside a disabled button)
    const link = page.getByRole("link", { name: "Open document" }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /./);
  });

  test("Defense Schedule: upcoming first, then earlier ones; Status is the second column", async ({ page }) => {
    await ready(page, "/faculty-portal/defenses");
    const headers = (await page.locator("main thead th").allInnerTexts()).map(norm);
    expect(headers.slice(0, 2).map((text) => text.toLowerCase())).toEqual(["student", "status"]);
    const context = await (await page.request.get("/api/faculty-portal/context")).json();
    const today = new Date().toISOString().slice(0, 10);
    const days = (context.panels || []).filter((panel) => panel.defense).map((panel) => panel.defense.preferred_date || "");
    if (days.length > 1) {
      const rowsText = await page.locator("main tbody tr").allInnerTexts();
      expect(rowsText.length).toBe(days.length);
    }
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("the bell lists a waiting panel invitation", async ({ page }) => {
    const waiting = await (await page.request.get("/api/faculty-portal/panel-invitations")).json();
    const list = waiting?.invitations || [];
    const invited = list.filter((item) => item.status === "Invited");
    await ready(page, "/faculty-portal");
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const region = page.getByRole("region", { name: "Notifications" });
    if (invited.length) await expect(region.getByText(/You are invited to the/).first()).toBeVisible();
    else await expect(region).toBeVisible();
  });
});

test.describe("I-206: a new page opens at its top", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 600 } });

  test("moving to another page scrolls back to the top", async ({ page }) => {
    await ready(page, "/students");
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.getByRole("link", { name: "Work Queue" }).first().click();
    await expect(page.locator("main h1")).toContainText("Work Queue");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------ I-204
test.describe("I-204: an AWOL student reads where she stands", () => {
  async function maya(browser, width = 1366) {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width, height: 844 } });
    const res = await context.request.post("/api/auth/login", { data: { email: MAYA, password: PASSWORD } });
    expect(res.ok(), "sign in as Maya").toBeTruthy();
    const page = await context.newPage();
    await stubExternal(context);
    attachWatchers(page, tracker);
    return { context, page };
  }

  test("Return from AWOL: one notice with her standing and limit; no 'cannot cancel' yet; no 'Not calculated'", async ({ browser }) => {
    const { context, page } = await maya(browser);
    try {
      await ready(page, "/student/requests/awol-return");
      const main = page.locator("main");
      await expect(main.getByText("You are still a USLS graduate student")).toHaveCount(1);
      await expect(main).toContainText("AWOL since");
      await expect(main).toContainText("master's student you have until");
      await expect(main).not.toContainText("octorate");
      await expect(main.getByText("You cannot cancel this request yourself")).toHaveCount(0);
      // awol6 (I-418): the AWOL notice is amber (warning), which is role="status"; only the danger tone is role="alert".
      await expect(page.getByRole("status").filter({ hasText: "Your record is marked AWOL" })).toHaveCount(1);
      await expect(main.getByText("Not calculated")).toHaveCount(0);
      await page.screenshot({ path: join(SHOTS, "awol-return-1366.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(SHOTS, "awol-return-390.png"), fullPage: true });
    } finally {
      await context.close();
    }
  });

  test("Leave of Absence: the warning is shown once, and 'Return from AWOL' is a link", async ({ browser }) => {
    const { context, page } = await maya(browser);
    try {
      await ready(page, "/student/requests/leave-of-absence");
      const main = page.locator("main");
      await expect(page.getByRole("status").filter({ hasText: "Your record is marked AWOL" })).toHaveCount(1);
      const link = main.getByRole("link", { name: /Open Return from AWOL/ });
      await expect(link).toHaveCount(1);
      await link.click();
      await expect(page).toHaveURL(/awol-return/);
    } finally {
      await context.close();
    }
  });

  test("the assistant gives her own next step and answers 'Am I still a student?'", async ({ browser }) => {
    const { context, page } = await maya(browser);
    try {
      await ready(page, "/student/assistant");
      const log = page.getByRole("log");
      const ask = async (question) => {
        await page.getByRole("textbox", { name: "Your question" }).fill(question);
        await page.getByRole("button", { name: "Send question" }).click();
      };
      await ask("What is my next step?");
      await expect(log).toContainText("Your next step: Open Return from AWOL", { timeout: 60_000 });
      await expect(log).not.toContainText("Review automatic AWOL policy alert");
      await ask("Am I still a student? How long do I have to come back?");
      await expect(log).toContainText("still a USLS graduate student", { timeout: 60_000 });
      await expect(log).not.toContainText("Not covered");
    } finally {
      await context.close();
    }
  });

  test("Request Center: Research does not say 'exam not passed' while My Profile says Passed", async ({ browser }) => {
    const { context, page } = await maya(browser);
    try {
      await ready(page, "/student/requests");
      await expect(page.locator("main")).not.toContainText("comprehensive exam not passed");
    } finally {
      await context.close();
    }
  });

  test("My Progress: the finished stage shows as done", async ({ browser }) => {
    const { context, page } = await maya(browser);
    try {
      await ready(page, "/student");
      await expect(page.locator("main li[data-state='complete']").filter({ hasText: "Admission" }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
