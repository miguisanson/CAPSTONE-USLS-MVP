// Packet P6.6 + I-116 (pkt/p66): pins the student record, the Policy Assistant, Change password and the sign-in page,
// and the three small staff-home / Work Queue fixes of I-116.
// Part 1 ("pins") was written BEFORE the migration and is green on the old pages: it proves the move onto the component
// library changes nothing a user relies on. Part 2 ("I-116", "sign-in page") was written red first.
// Everything is read-only or mocked: no spec here changes the database. The sign-in page signs in as a demo account
// (a session in this test's own browser context only); the demo reset call is answered by a mock (the real one clears a
// demo student's case, and specs share one database - e2e/README.md).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.P88_SHOTS || "E:/Temp/claude/shots-p66/after";

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "p88 records and sign-in", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

const main = (page) => page.locator("main");
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
const STAFF = { storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } };
const SIGNED_OUT = { storageState: { cookies: [], origins: [] }, viewport: { width: 1366, height: 768 } };

// The sign-in checks make real login calls that fail on purpose (a wrong password): those are not findings.
const allowFailedLogin = () => {
  tracker.problems = tracker.problems.filter((p) => !/API 401: POST \/api\/auth\/login/.test(p.problem) && !/Failed to load resource/.test(p.problem));
};

// ------------------------------------------------------------------------------------------------ student record
test.describe("student record (staff)", () => {
  test.use(STAFF);

  async function openFirstRecord(page, context) {
    const list = await (await context.request.get("/api/students?page=1&page_size=25")).json();
    expect(list.items.length, "the demo data has students").toBeGreaterThan(0);
    await page.goto("/students");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const first = list.items[0];
    await main(page).locator("tbody tr", { hasText: first.student_number }).locator("td").first().click();
    await page.waitForURL(/\/students\/\d+$/);
    const id = Number(page.url().split("/").pop());
    const record = await (await context.request.get(`/api/students/${id}`)).json();
    return record;
  }

  test("pin: the record opens from the Students list with its name as the one h1, the sections and a way back", async ({ page, context }) => {
    const record = await openFirstRecord(page, context);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main h1")).toHaveText(record.student.name);
    await expect(main(page)).toContainText(record.student.student_number);
    await expect(main(page)).toContainText(record.student.program_name);
    for (const section of ["Course audit", "Research case & evidence", "Activity timeline", "Workflow status", "Recommended actions", "Open tasks", "Panel", "Defense schedule"]) {
      await expect(main(page).getByText(section, { exact: true }).first(), section).toBeVisible();
    }
    await expect(main(page).getByRole("link", { name: /Manage enrollment/ })).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Ask eligibility/ })).toBeVisible();
    await shot(page, "student-record-1366.png");
    // the way back
    await main(page).getByRole("link", { name: /Back to students/ }).click();
    await page.waitForURL(/\/students$/);
  });

  test("pin: 'View stage history' opens the lifecycle stages in order, 'Hide stage history' closes them", async ({ page, context }) => {
    const record = await openFirstRecord(page, context);
    await page.waitForLoadState("networkidle");
    const toggle = main(page).getByRole("button", { name: /stage history/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toContainText("View stage history");
    await expect(toggle).toContainText(String(record.stages.length));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toContainText("Hide stage history");
    const panel = page.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    const text = (await panel.innerText()).replace(/\s+/g, " ");
    let at = -1;
    for (const stage of record.stages) {
      const next = text.indexOf(stage, at + 1);
      expect(next, `stage "${stage}" listed after the one before it in: ${text}`).toBeGreaterThan(at);
      at = next;
    }
    await shot(page, "student-record-stages-1366.png");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveCount(0);
  });

  test("pin: the enrollment history and the activity logs stay behind their own toggles", async ({ page, context }) => {
    const record = await openFirstRecord(page, context);
    await page.waitForLoadState("networkidle");
    if ((record.subject_enrollments || []).length) {
      await main(page).getByRole("button", { name: /enrollment history/i }).click();
      await expect(main(page).locator("table")).toBeVisible();
    }
    if ((record.logs || []).length) {
      await main(page).getByRole("button", { name: /View logs/i }).click();
      await expect(main(page).getByText(record.logs[0].result).first()).toBeVisible();
    }
  });

  test("pin: the record fits a phone without sideways scrolling", async ({ page, context }) => {
    await openFirstRecord(page, context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForLoadState("networkidle");
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "student-record-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ Policy Assistant
test.describe("Policy Assistant (staff)", () => {
  test.use(STAFF);

  test("pin: title, the student focus card, the how-it-works card and the question box", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.locator("main h1")).toHaveText("Policy Assistant");
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(main(page).getByText("Focus on a student", { exact: true })).toBeVisible();
    await expect(main(page).getByText("How this works", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your question" })).toBeVisible();
    await shot(page, "assistant-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "assistant-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ Change password
test.describe("Change password (staff, voluntary)", () => {
  test.use(STAFF);

  test("pin: three labelled fields, a mismatch is explained, nothing is sent, Sign out is there", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page.locator("h1")).toHaveText("Change password");
    await expect(page.locator("h1")).toHaveCount(1);
    const current = page.getByLabel("Current password", { exact: true });
    const next = page.getByLabel(/^New password/);
    const confirm = page.getByLabel("Confirm new password", { exact: true });
    await expect(current).toBeVisible();
    await expect(next).toBeVisible();
    await expect(confirm).toBeVisible();
    await expect(page.getByText("At least 10 characters.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();
    await current.fill("not-the-real-one-1");
    await next.fill("a-new-password-1");
    await confirm.fill("another-password-2");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("The new password and its confirmation do not match.")).toBeVisible();
    expect(tracker.writes, "a mismatch never reaches the server").toEqual([]);
    await shot(page, "change-password-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "change-password-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ sign-in page
test.describe("sign-in page", () => {
  test.use(SIGNED_OUT);

  test("pin: the title, the labelled fields, the password toggle and a wrong password", async ({ page, context }) => {
    const wrong = await context.request.post("/api/auth/login", { data: { email: "staff@usls.edu.ph", password: "definitely-wrong-1" } });
    expect(wrong.status()).toBe(401);
    const message = (await wrong.json()).error;
    allowFailedLogin();
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Graduate School Lifecycle Portal" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();
    const email = page.getByLabel("Email", { exact: true });
    const password = page.getByLabel("Password", { exact: true });
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await shot(page, "login-1366.png");

    await email.fill("staff@usls.edu.ph");
    await password.fill("definitely-wrong-1");
    await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    allowFailedLogin();
    await shot(page, "login-error-1366.png");
  });

  test("pin: the Demo accounts panel lists the ready-made accounts; Fill form fills the form; Sign in goes to the home", async ({ page, context }) => {
    const accounts = (await (await context.request.get("/api/auth/demo-accounts")).json()).items;
    expect(accounts.length).toBeGreaterThan(3);
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: /Demo accounts/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#demo-accounts-panel");
    await expect(panel).toBeVisible();
    const rows = panel.locator("ul").first().locator("li");
    await expect(rows).toHaveCount(accounts.length);
    await shot(page, "login-demo-1366.png");

    const staff = accounts.find((a) => a.email === "staff@usls.edu.ph");
    expect(staff, "the demo staff account is listed").toBeTruthy();
    await rows.filter({ hasText: staff.email }).getByRole("button", { name: "Fill form" }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(staff.email);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(staff.password);
    await expect(page.getByLabel("Password", { exact: true }), "the password is shown after Fill form").toHaveAttribute("type", "text");

    await page.getByRole("button", { name: `Sign in as ${staff.label} (demo)` }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    await expect(page.locator("aside nav a").first()).toBeVisible();
  });

  test("pin: resetting a demo student signs in first, resets, then signs out (I-055); the call is mocked", async ({ page, context }) => {
    const students = (await (await context.request.get("/api/auth/demo-students")).json()).items;
    const target = students.find((s) => s.workflow === "withdrawal") || students[0];
    expect(target, "a demo student exists").toBeTruthy();
    const calls = [];
    await page.route("**/api/auth/demo-students/*/reset", (route) => {
      calls.push("reset");
      return route.fulfill({ json: { ok: true, item: target, message: `Spec: reset ${target.name}.` } });
    });
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && path === "/api/auth/login") calls.push("login");
      if (request.method() === "POST" && path === "/api/auth/logout") calls.push("logout");
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/login");
    await page.getByRole("button", { name: /Demo accounts/ }).click();
    await expect(page.locator("#demo-accounts-panel")).toBeVisible();
    // open the group that holds the demo student (the group titles are lifecycle steps and process names)
    const resetButton = page.getByRole("button", { name: new RegExp(`^Reset ${escapeRe(target.name)}'s .* demo data$`) });
    const groups = page.locator('section[aria-label$="demo students"] > button');
    await expect(groups.first()).toBeVisible();
    for (let i = 0; i < (await groups.count()) && !(await resetButton.count()); i += 1) await groups.nth(i).click();
    await expect(resetButton).toHaveCount(1);
    await resetButton.first().click();
    await expect(page.getByText(`Spec: reset ${target.name}.`)).toBeVisible();
    expect(calls, "sign in, then reset, then sign out").toEqual(["login", "reset", "logout"]);
    await expect(page).toHaveURL(/\/login$/);
    await shot(page, "login-reset-1366.png");
  });

  test("pin: the sign-in page fits a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /Demo accounts/ }).click();
    await expect(page.locator("#demo-accounts-panel")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "login-demo-390.png");
  });
});

// ================================================================================================ part 2: written red first
// ------------------------------------------------------------------------------------------------ student record: Stepper
test.describe("student record: stage Stepper and PageHeader (X-02)", () => {
  test.use(STAFF);

  test("the stage history is an ordered list that marks done, current and coming stages; the name is a PageHeader title", async ({ page, context }) => {
    const list = await (await context.request.get("/api/students?page=1&page_size=25")).json();
    // a student past the first stage shows "complete" steps; fall back to the first one
    let pick = list.items[0];
    for (const s of list.items.slice(0, 12)) {
      const r = await (await context.request.get(`/api/students/${s.id}`)).json();
      if (r.stage_index > 0) { pick = s; break; }
    }
    const record = await (await context.request.get(`/api/students/${pick.id}`)).json();
    await page.goto(`/students/${pick.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main h1")).toHaveClass(/page-title/);
    await expect(main(page).locator("h1")).toHaveText(record.student.name);
    await main(page).getByRole("button", { name: /stage history/i }).click();
    const steps = main(page).locator("ol > li[data-state]");
    await expect(steps).toHaveCount(record.stages.length);
    await expect(main(page).locator('li[aria-current="step"]')).toHaveCount(1);
    await expect(main(page).locator('li[aria-current="step"]')).toContainText(record.stages[record.stage_index]);
    await expect(main(page).locator('ol > li[data-state="complete"]')).toHaveCount(record.stage_index);
    await expect(main(page).locator('ol > li[data-state="upcoming"]')).toHaveCount(record.stages.length - record.stage_index - 1);
    await shot(page, "student-record-stepper-1366.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, "student-record-stepper-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ I-116
const stamp = "2099-01-01T08:00:00";
test.describe("I-116: staff home, Work Queue", () => {
  test.use(STAFF);

  async function patchJson(page, pattern, patch) {
    await page.route(pattern, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      patch(json, new URL(route.request().url()));
      await route.fulfill({ response, json });
    });
  }
  const homeReady = async (page) => {
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
  };
  const activityCard = (page) => main(page).locator("section", { has: page.getByRole("heading", { name: "Recent activity", exact: true }) });

  test("(a) a monitoring flag in Recent activity has a human title, never 'Other resolved' / 'Other flagged for'", async ({ page }) => {
    await patchJson(page, "**/api/dashboard", (json) => {
      const log = (id, result, source) => ({ id, transaction_slug: "aims-discrepancy", student_id: 1, student_name: "Ana Reyes", source_reference: source, result, next_owner: "Academic Coordinator", created_at: stamp });
      json.recent_logs = [
        log(990001, "Other resolved", "Other"),
        { ...log(990002, "Other flagged for Ana Reyes (2260001) on the whole record.", "Other"), created_at: "2099-01-01T07:00:00" },
        { ...log(990003, "Missing record resolved", "Missing record"), created_at: "2099-01-01T06:00:00" },
        ...(json.recent_logs || []),
      ];
    });
    await homeReady(page);
    const card = activityCard(page);
    await expect(card).toContainText("Monitoring flag resolved");
    await expect(card).toContainText("Monitoring flag raised for Ana Reyes (2260001) on the whole record.");
    await expect(card, "another category's title is left as the server wrote it").toContainText("Missing record resolved");
    await expect(card).not.toContainText(/\bOther (resolved|flagged)/);
    await shot(page, "staff-home-activity-1366.png");
  });

  // (b) one name per page
  const withdrawalTask = { id: 990010, student_id: null, student_name: "Spec Student", title: "Record and forward withdrawal request", owner_role: "Graduate School Staff", due_at: "2026-10-30", status: "Pending", priority: 50, overdue: false, action_url: "/workflow/withdrawal", action_label: "Open Withdrawal" };
  const awolTask = { id: 990011, student_id: null, student_name: "Spec Two", title: "Review automatic AWOL policy alert", owner_role: "Graduate School Staff", due_at: "2026-10-31", status: "Pending", priority: 50, overdue: false, action_url: "/workflow/awol", action_label: "Open AWOL & Residency" };
  const addTasks = (json, url) => {
    const want = url.searchParams.get("owner");
    for (const t of [awolTask, withdrawalTask]) if (!want || want === t.owner_role) json.items.unshift(t);
    json.total = (json.total || 0) + 2;
  };

  test("(b) the staff home button says 'Open Subject Withdrawal' (the page's name), not the server's 'Open Withdrawal'", async ({ page }) => {
    await patchJson(page, "**/api/tasks**", addTasks);
    await homeReady(page);
    const row = main(page).locator("li", { hasText: "Record and forward withdrawal request" });
    await expect(row.getByRole("link", { name: "Open Subject Withdrawal" })).toHaveAttribute("href", "/workflow/withdrawal");
    await expect(main(page)).not.toContainText("Open Withdrawal");
    const awol = main(page).locator("li", { hasText: "Review automatic AWOL policy alert" }).first();
    await expect(awol.getByRole("link", { name: "Open AWOL & Residency" })).toBeVisible();
    // one spelling for every button of this kind: "Open <page name>"
    for (const link of await main(page).locator("li a", { hasText: /^Open / }).allTextContents()) {
      expect(link.trim(), "every task button names a page in the sidebar's words").toMatch(/^Open (AWOL & Residency|Readmission|Leave of Absence|Practicum|Subject Withdrawal|Graduation Endorsement|Research Gate|Panel Matching|Defense Scheduling|Student Handoff|Course Adjustments|Student Record|Work Queue)$/);
    }
  });

  test("(b) the Work Queue's Action column uses the same words", async ({ page }) => {
    await patchJson(page, "**/api/tasks**", addTasks);
    await page.goto("/work-queue?owner=Graduate%20School%20Staff");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(main(page).getByRole("link", { name: "Open Subject Withdrawal" }).first()).toBeVisible();
    await expect(main(page)).not.toContainText("Open Withdrawal");
  });

  // (c) ?q= on the Work Queue
  test("(c) the Work Queue takes ?q= and fills its search box with it, filtering the list", async ({ page, context }) => {
    const all = await (await context.request.get("/api/tasks?page_size=50")).json();
    expect(all.items.length, "the demo data has open tasks").toBeGreaterThan(0);
    const word = all.items[0].title.split(/\s+/).find((w) => w.length > 4) || all.items[0].title;
    await page.goto(`/work-queue?q=${encodeURIComponent(word)}`);
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(main(page).getByLabel("Search work queue")).toHaveValue(word);
    const expected = all.items.filter((t) => `${t.title} ${t.student_name || ""} ${t.owner_role}`.toLowerCase().includes(word.toLowerCase()));
    expect(expected.length).toBeGreaterThan(0);
    await expect(main(page).locator("tbody tr")).toHaveCount(expected.length);
  });

  test("(c) the grouped '3 automatic AWOL policy alerts' row opens that owner's queue already searching for the alert", async ({ page }) => {
    const alert = (id, name) => ({
      id, student_id: id, student_name: name, title: "Review automatic AWOL policy alert", owner_role: "Dean",
      due_at: "2026-10-01", status: "Pending", priority: "High", overdue: true, action_url: null, action_label: null,
    });
    const tasks = [alert(901, "Ana Reyes"), alert(902, "Ben Cruz"), alert(903, "Cara Lim"), { ...alert(904, "Dee Uy"), title: "Sign the practicum letter", owner_role: "Dean" }];
    await page.route("**/api/tasks**", (route) => {
      const want = new URL(route.request().url()).searchParams.get("owner");
      const items = tasks.filter((t) => !want || t.owner_role === want);
      return route.fulfill({ json: { items, total: items.length, page: 1, pages: 1, page_size: 50 } });
    });
    await homeReady(page);
    const row = main(page).locator("li", { hasText: "3 automatic AWOL policy alerts" });
    const link = row.locator("a");
    await expect(link).toHaveAttribute("href", "/work-queue?owner=Dean&q=Review%20automatic%20AWOL%20policy%20alert");
    await link.click();
    await page.waitForURL(/\/work-queue\?/);
    await expect(main(page).getByLabel("Search work queue")).toHaveValue("Review automatic AWOL policy alert");
    await expect(main(page).locator("tbody tr")).toHaveCount(3);
    await expect(main(page)).not.toContainText("Sign the practicum letter");
    await shot(page, "work-queue-q-1366.png");
  });
});

// ------------------------------------------------------------------------------------------------ sign-in page against the UX research
test.describe("sign-in page: UX research sections 3 and 7", () => {
  test.use(SIGNED_OUT);

  test("a wrong password: what was typed stays, the message is an alert tied to both fields, nothing moves", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("staff@usls.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-1");
    const button = page.getByRole("button", { name: /^\s*Sign in\s*$/ });
    const topBefore = (await button.boundingBox()).y;
    await button.click();
    const alert = page.getByRole("alert").filter({ hasText: /./ });
    await expect(alert).toBeVisible();
    allowFailedLogin();
    const email = page.getByLabel("Email", { exact: true });
    const password = page.getByLabel("Password", { exact: true });
    await expect(email, "the e-mail the person typed is kept (UX research 3.3)").toHaveValue("staff@usls.edu.ph");
    await expect(password).toHaveValue("definitely-wrong-1");
    const alertId = await alert.getAttribute("id");
    expect(alertId, "the error element has an id").toBeTruthy();
    for (const field of [email, password]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      expect(await field.getAttribute("aria-describedby")).toContain(alertId);
    }
    expect((await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).boundingBox()).y, "the Sign in button does not jump when the error appears").toBe(topBefore);
    await shot(page, "login-error-tied-1366.png");
  });

  test("a failed sign-in keeps the Demo accounts panel open", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Demo accounts/ }).click();
    await expect(page.locator("#demo-accounts-panel")).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("staff@usls.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-1");
    await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
    allowFailedLogin();
    await expect(page.locator("#demo-accounts-panel"), "the panel the presenter opened stays open").toBeVisible();
  });

  test("opening the Demo accounts panel does not move the sign-in form (it stays at the top beside the title)", async ({ page }) => {
    await page.goto("/login");
    const form = page.getByRole("heading", { level: 2, name: "Sign in" });
    await expect(form).toBeVisible();
    const top = () => form.evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
    const before = await top();
    await page.getByRole("button", { name: /Demo accounts/ }).click();
    await expect(page.locator("#demo-accounts-panel li").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await top(), "the form does not slide down when the panel opens").toBe(before);
  });

  test("keyboard: Tab reaches the email, password and reveal toggle, each with a visible focus indicator", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).focus();
    const seen = [];
    for (let i = 0; i < 3; i += 1) {
      seen.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          const cs = getComputedStyle(el);
          return {
            name: el.getAttribute("aria-label") || el.getAttribute("name") || el.textContent.trim(),
            ring: cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0),
          };
        }),
      );
      await page.keyboard.press("Tab");
    }
    expect(seen.map((s) => s.name).join(" | ")).toMatch(/email.*password.*Show password/i);
    for (const s of seen) expect(s.ring, `${s.name} shows a focus indicator`).toBe(true);
  });

  test("the reveal toggle is a real button with a name and a target of at least 24 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const box = await page.getByRole("button", { name: "Show password" }).boundingBox();
    expect(box.width, "WCAG 2.5.8").toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });
});
