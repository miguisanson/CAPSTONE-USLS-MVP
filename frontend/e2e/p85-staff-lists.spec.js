// Packet "lists" (I-075, I-083, I-098, I-104 part, I-109): pins five small list fixes on the back-office pages.
// Written BEFORE the change and red on the old pages. Read-only (nothing but navigation and filters is touched).
//   - I-075  Students "Compre exam" column shows what the API says (Passed / Eligible / "N subjects left"), never a
//            hard-coded "/21 units";
//   - I-083  the staff home groups identical "Waiting on others" system alerts into one row with a count;
//   - I-098  the Program select on the Monitoring Sheet and the Class list is wide enough for the longest program
//            name at 1366;
//   - I-104  at 390 px every advisee shows its "Needs signature" state without scrolling sideways;
//   - I-109  the Academic Coordinator's home never links to a page that role cannot open.
// Every expected value is read from the API at test time (specs share one database, e2e/README.md).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.LISTS_SHOTS || "E:/Temp/claude/shots-lists/after";

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "p85 staff lists", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
const STAFF = "Graduate School Staff";
const owner = (value) => (["gs staff", "staff"].includes(String(value || "").trim().toLowerCase()) ? STAFF : String(value || "").trim());

// ------------------------------------------------------------------------------------------------ I-075
test.describe("Students directory", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("I-075: the Compre exam column says what the API says, never a hard-coded 21", async ({ page, context }) => {
    const api = await (await context.request.get("/api/students?page=1&page_size=25")).json();
    expect(api.items.length, "the demo data has students").toBeGreaterThan(0);
    await page.goto("/students");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const table = main(page).locator("table");
    const headers = await table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    const col = headers.indexOf("Compre exam");
    expect(col, `a "Compre exam" column in ${headers.join(", ")}`).toBeGreaterThan(-1);

    await expect(table, 'no cell prints a "n/21 units" fraction').not.toContainText(/\/\s*21\b/);
    await expect(table, "no cell prints a raw units fraction at all").not.toContainText(/\d+\s*\/\s*\d+\s*units/i);

    let sawLeft = 0;
    for (const s of api.items) {
      const cell = table.locator("tbody tr", { hasText: s.student_number }).locator("td").nth(col);
      const c = s.compre_eligibility || {};
      if (c.passed) await expect(cell, `${s.name}: passed`).toContainText("Passed");
      else if (c.eligible) await expect(cell, `${s.name}: eligible`).toContainText("Eligible to take");
      else if (c.missing_subjects > 0) {
        sawLeft += 1;
        await expect(cell, `${s.name}: ${c.missing_subjects} subjects left`).toContainText(new RegExp(`^\\s*${c.missing_subjects} subjects? left\\s*$`));
      } else await expect(cell, `${s.name}: not eligible (a failed or in-progress subject)`).toContainText(/Not eligible/);
    }
    expect(sawLeft, "the demo page has students who are not yet eligible").toBeGreaterThan(0);
    await shot(page, "students-1366.png");
  });
});

// ------------------------------------------------------------------------------------------------ I-083
test.describe("staff home: Waiting on others", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  const waitingSection = (page) => main(page).locator("section", { has: page.getByRole("heading", { name: "Waiting on others", exact: true }) });

  test("I-083: identical system alerts held by one owner are ONE row with a count (real data)", async ({ page, context }) => {
    const all = await (await context.request.get("/api/tasks?page_size=200")).json();
    const waiting = all.items.filter((t) => owner(t.owner_role) !== STAFF);
    const byKey = new Map();
    for (const t of waiting) byKey.set(`${owner(t.owner_role)}|${t.title}`, (byKey.get(`${owner(t.owner_role)}|${t.title}`) || 0) + 1);
    const dupes = [...byKey.entries()].filter(([, n]) => n > 1);
    expect(dupes.length, "the demo data holds repeated alerts for other offices (the finding in I-083)").toBeGreaterThan(0);
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const rows = waitingSection(page).locator("li");
    const texts = await rows.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    // no title is printed twice
    for (const [key, n] of dupes) {
      const title = key.split("|")[1];
      const same = texts.filter((t) => t.includes(title));
      expect(same.length, `"${title}" (${n} tasks) is shown at most once`).toBeLessThanOrEqual(1);
    }
    // a visible grouped row carries its count
    const grouped = texts.filter((t) => /^\s*\d+ /.test(t));
    expect(grouped.length, "at least one grouped row with a count in front").toBeGreaterThan(0);
    await shot(page, "staff-home-1366.png");
  });

  test("I-083: three identical AWOL alerts become one row '3 automatic AWOL policy alerts' (mocked)", async ({ page }) => {
    const alert = (id, name) => ({
      id, student_id: id, student_name: name, title: "Review automatic AWOL policy alert", owner_role: "Dean",
      due_at: "2026-10-01", status: "Pending", priority: "High", overdue: true, action_url: null, action_label: null,
    });
    const tasks = [alert(901, "Ana Reyes"), alert(902, "Ben Cruz"), alert(903, "Cara Lim"),
      { id: 904, student_id: 9, student_name: "Dee Uy", title: "Sign the practicum letter", owner_role: "Student", due_at: "2026-10-30", status: "Pending", priority: "Normal", overdue: false, action_url: null, action_label: null }];
    await page.route("**/api/tasks**", (route) => {
      const want = new URL(route.request().url()).searchParams.get("owner");
      const items = tasks.filter((t) => !want || t.owner_role === want);
      return route.fulfill({ json: { items, total: items.length, page: 1, pages: 1 } });
    });
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const rows = waitingSection(page).locator("li");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("3 automatic AWOL policy alerts");
    await expect(waitingSection(page).getByText("Review automatic AWOL policy alert", { exact: true })).toHaveCount(0);
    await expect(rows.first().locator("a")).toHaveAttribute("href", /\/work-queue\?owner=Dean/);
    await expect(rows.nth(1)).toContainText("Sign the practicum letter");
  });
});

// ------------------------------------------------------------------------------------------------ I-098
test.describe("program selects", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  for (const [path, name] of [["/monitoring-sheet", "Monitoring Sheet"], ["/enrollment-class-list", "Class list"]]) {
    test(`I-098: the Program and Semester selects on the ${name} fit their longest option at 1366`, async ({ page, context }) => {
      const meta = await (await context.request.get("/api/meta")).json();
      const longest = [...meta.programs].sort((a, b) => `${b.code} — ${b.name}`.length - `${a.code} — ${a.name}`.length)[0];
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const select = page.getByLabel("Program", { exact: true });
      // the closed select shows the chosen option, so the longest option must fit as well as the current one
      await select.selectOption(String(longest.id));
      await expect(select).toHaveValue(String(longest.id));
      for (const label of ["Program", "Semester"]) {
        const fit = await page.getByLabel(label, { exact: true }).evaluate((sel) => {
          const cs = getComputedStyle(sel);
          const ctx = document.createElement("canvas").getContext("2d");
          ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const text = Math.max(...[...sel.options].map((o) => ctx.measureText(o.textContent).width));
          const arrow = 24; // the native drop-down arrow
          return { text, room: sel.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - arrow };
        });
        expect(fit.text, `${label}: the longest option needs ${Math.round(fit.text)}px, the select has ${Math.round(fit.room)}px (longest program: "${longest.code} — ${longest.name}")`).toBeLessThanOrEqual(fit.room);
      }
      await shot(page, `${path.slice(1)}-1366.png`);
    });
  }
});

// ------------------------------------------------------------------------------------------------ I-104
test.describe("faculty advisees on a phone", () => {
  test.use({ storageState: join(AUTH_DIR, "faculty.json"), viewport: { width: 390, height: 844 } });

  test("I-104: at 390 px every advisee shows 'Needs signature' on screen, with no sideways scrolling", async ({ page, context }) => {
    tracker.where = { role: "faculty", page: "advisees 390", viewport: 390 };
    const portal = await (await context.request.get("/api/faculty-portal/context")).json();
    expect(portal.advisees.length, "the faculty login has advisees").toBeGreaterThan(0);
    await page.goto("/faculty-portal/advisees");
    await expect(page.getByRole("heading", { name: "Your advisees" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    for (const entry of portal.advisees) {
      const card = main(page).locator("li", { hasText: entry.student.student_number }).filter({ hasText: "Needs signature" });
      await expect(card, `${entry.student.name} has a card with a Needs signature line`).toHaveCount(1);
      const box = await card.boundingBox();
      expect(box.x, `${entry.student.name}: card starts on screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${entry.student.name}: card ends on screen`).toBeLessThanOrEqual(391);
      await expect(card).toContainText(entry.student.name);
      await expect(card).toContainText(entry.student.program_code);
      await expect(card).toContainText(entry.student.current_stage || "Not set");
      await expect(card).toContainText(entry.pending_count ? `${entry.pending_count} pending` : "None");
      const signText = card.getByText("Needs signature");
      const sb = await signText.boundingBox();
      expect(sb.x + sb.width, `${entry.student.name}: the Needs signature label is on screen`).toBeLessThanOrEqual(391);
    }
    await shot(page, "advisees-390.png");
  });
});

// ------------------------------------------------------------------------------------------------ I-109
test.describe("Academic Coordinator home links", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("I-109: every task link on the home opens a page this role can open", async ({ page, context }) => {
    tracker.where = { role: "academic-coordinator", page: "coordinator home", viewport: 1366 };
    const own = await (await context.request.get("/api/tasks?owner=Academic%20Coordinator&page_size=200")).json();
    expect(own.items.length, "the Academic Coordinator has open tasks in the demo data").toBeGreaterThan(0);
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const sidebar = await page.locator("aside nav a").evaluateAll((els) => els.map((a) => new URL(a.href).pathname));
    const links = await main(page).locator("li a").evaluateAll((els) => els.map((a) => new URL(a.href).pathname));
    expect(links.length, "task rows with links").toBeGreaterThan(0);
    for (const path of links) {
      const ok = sidebar.includes(path) || path.startsWith("/students/");
      expect(ok, `${path} is reachable from this role's own sidebar (${sidebar.join(", ")})`).toBe(true);
    }
    await shot(page, "coordinator-home-1366.png");
  });

  test("I-109: a defense task owned by the Academic Coordinator does not link to Defense Scheduling (mocked)", async ({ page }) => {
    const task = (id, title) => ({ id, student_id: 5, student_name: "Ana Reyes", title, owner_role: "Academic Coordinator", due_at: "2026-10-30", status: "Pending", priority: "Normal", overdue: false, action_url: null, action_label: null });
    const tasks = [task(1, "Schedule the proposal defense"), task(2, "Confirm defense panel availability")];
    await page.route("**/api/tasks**", (route) => route.fulfill({ json: { items: tasks, total: tasks.length, page: 1, pages: 1 } }));
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    // the two task rows only: the coordinator home also has a "Recent activity" card whose rows link to student records (I-066)
    const mine = main(page).locator("section", { has: page.getByRole("heading", { name: "Needs your action", exact: true }) });
    const hrefs = await mine.locator("li a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs.length, "both tasks still have a way in").toBe(2);
    for (const href of hrefs) expect(href, "Defense Scheduling is the Research Coordinator's page").not.toContain("/workflow/defense-scheduling");
  });
});
