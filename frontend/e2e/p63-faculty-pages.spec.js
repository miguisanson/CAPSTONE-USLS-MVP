// Behaviour pin for packet P6.3 (Phase 5 migration of pages/Faculty.jsx, pages/AdviserAppointments.jsx,
// pages/Form1Endorsements.jsx). Written BEFORE the migration and green on the old code, so it proves the migrated pages keep
// the same list, search and filters, the same profile / add / edit dialogs, the same API payloads for the Dean's decisions
// and the same Form 1 signature rule. It reaches everything through the real UI. Setup that is not the screen under test
// (students applying for an adviser, uploading Form 1, the Coordinator's note, the staff forward) goes through the JSON API
// with each role's own login.
//
// Students: it uses demo students that no other spec touches (Elena Mendoza for Form 1; Gian Reyes, Daniel Bernardo, Rafael
// Pang and Marielle Navarro for adviser applications). Data left behind: those applications and one endorsement. The
// expertise record it adds to a faculty member is removed again in the same test.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_DIR lets a before/after comparison write to two folders; the default is "p63" next to the sweep screens.
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p63");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p63", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ helpers
async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}
async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}
/** A one-page PDF with real text, so the server can read it ("Research Title:" line). */
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  const stream = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td", ...lines.map((l) => `(${esc(l)}) Tj T*`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
const pdfFile = (name, lines) => ({ name, mimeType: "application/pdf", buffer: makePdf(lines) });

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Screenshot at 1366 and at 390, then back to 1366. Full page by default; `full: false` for a dialog (viewport only). */
async function shotBoth(page, name, { full = true } = {}) {
  await page.waitForTimeout(500); // the page's own fade-in
  for (const [width, height] of [[1366, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: full });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

/** Draw a short stroke on the first signature canvas. */
async function drawSignature(page) {
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 80 + Math.sin(i / 2) * 30);
  await page.mouse.up();
}

// ================================================================================================ Faculty
test.describe("Faculty profiles (GS staff)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("list: columns, rows, search, department and availability filters, empty state", async ({ page }) => {
    const all = (await okJson(await page.request.get("/api/faculty"), "faculty list")).items;
    expect(all.length).toBeGreaterThan(5);
    const business = all.filter((item) => item.college === "Business").length;

    await page.goto("/faculty");
    await expect(page.getByRole("heading", { level: 1, name: "Faculty" })).toBeVisible();
    await expect(page.getByText(/Search the faculty directory, then open a profile/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add faculty" })).toBeVisible();

    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(all.length);
    const heads = await page.locator("main table thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(heads).toEqual(["Faculty", "Department / specialization", "Status", "Availability", "Panel load", "Actions"]);
    await expect(page.getByText(new RegExp(`Showing\\s+${all.length}\\s+of\\s+${all.length}\\s+faculty`))).toBeVisible();
    await expect(page.getByText("Select a faculty member to open their profile")).toBeVisible();

    // One row, by content.
    const bautista = rows.filter({ hasText: "Dr. Liwayway Bautista" });
    await expect(bautista).toHaveCount(1);
    await expect(bautista.getByRole("button", { name: "Dr. Liwayway Bautista" })).toBeVisible();
    await expect(bautista).toContainText("liwayway.bautista@usls.edu.ph");
    await expect(bautista).toContainText("Education");
    await expect(bautista).toContainText("Active");
    await expect(bautista).toContainText("Active login");
    await expect(bautista).toContainText("Available");
    await expect(bautista.getByRole("button", { name: /Edit/ })).toBeVisible();
    await shotBoth(page, "faculty-list");

    // Search (name, then a miss).
    const search = page.getByRole("searchbox", { name: "Search faculty" });
    await search.fill("bautista");
    await expect(rows).toHaveCount(1);
    await expect(page.getByText(new RegExp(`Showing\\s+1\\s+of\\s+${all.length}\\s+faculty`))).toBeVisible();
    await search.fill("zzzz-no-such-faculty");
    await expect(page.getByText("No faculty match your filters")).toBeVisible();
    await expect(page.getByText("Try a broader search or change a filter.")).toBeVisible();
    await expect(rows).toHaveCount(0);
    await shotBoth(page, "faculty-empty");
    await search.fill("");
    await expect(rows).toHaveCount(all.length);

    // Department filter.
    const department = page.getByLabel("Filter by department");
    await department.selectOption({ label: "Business" });
    await expect(rows).toHaveCount(business);
    for (const text of await rows.allInnerTexts()) expect(text).toContain("Business");
    // Availability filter: every seeded faculty member is "Available"; nobody is "Not entered".
    const availability = page.getByLabel("Filter by availability");
    await availability.selectOption({ label: "Not entered" });
    await expect(page.getByText("No faculty match your filters")).toBeVisible();
    await availability.selectOption({ label: "Available" });
    await expect(rows).toHaveCount(business);
    await department.selectOption({ label: "All departments" });
    await expect(rows).toHaveCount(all.length);
    await availability.selectOption({ label: "All availability" });
    // The availability options are the same five words.
    const options = await availability.locator("option").allInnerTexts();
    expect(options).toEqual(["All availability", "Available", "Unavailable", "Not entered", "Google Calendar connected"]);

    // Text search also looks at the department.
    await search.fill("education");
    await expect(rows).toHaveCount(all.filter((item) => /education/i.test(`${item.name} ${item.college} ${item.role} ${item.specialization} ${item.email} ${item.account?.email || ""} ${(item.matching_keywords || []).join(" ")}`)).length);

    expect(await noOverflow(page), "no sideways scroll at 1366").toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Faculty" })).toBeVisible();
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
  });

  test("a profile opens from the name or a row click and from a link; Escape and the close button shut it", async ({ page }) => {
    await page.goto("/faculty");
    const rows = page.locator("main table tbody tr");
    await rows.filter({ hasText: "Dr. Liwayway Bautista" }).getByRole("button", { name: "Dr. Liwayway Bautista" }).click();
    const dialog = page.getByRole("dialog", { name: "Dr. Liwayway Bautista" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/[?&]faculty=1(&|$)/);
    for (const heading of ["Specialization", "Preferred teaching subjects", "Contact", "Current assignments", "Calendar connection", "Expertise records", "Weekly availability & schedule"]) {
      await expect(dialog.getByRole("heading", { name: heading }), heading).toBeVisible();
    }
    await expect(dialog).toContainText("Education");
    await expect(dialog).toContainText(/\d+ panel assignments/);
    await expect(dialog).toContainText("Faculty login");
    await expect(dialog.getByRole("link", { name: "liwayway.bautista@usls.edu.ph" })).toHaveAttribute("href", "mailto:liwayway.bautista@usls.edu.ph");
    await expect(dialog.getByRole("link", { name: /View availability feed/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save preferences" })).toBeVisible();
    await shotBoth(page, "faculty-profile-top", { full: false });
    // The weekly calendar: week buttons move the week range.
    const range = dialog.getByText(/^[A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+, \d{4}$/);
    await expect(range).toBeVisible();
    for (const legend of ["Weekly hours entered", "Available slot", "Blocked / busy"]) await expect(dialog.getByText(legend)).toBeVisible();
    const before = await range.innerText();
    await dialog.getByRole("button", { name: "Next week" }).click();
    await expect(range).not.toHaveText(before);
    await dialog.getByRole("button", { name: "Previous week" }).click();
    await expect(range).toHaveText(before);
    await shotBoth(page, "faculty-profile-calendar", { full: false });

    await dialog.getByRole("button", { name: "Close faculty profile" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/faculty=/);

    // A row click (not the name) opens it too; Escape closes it.
    await rows.filter({ hasText: "Dr. Teodoro Ramos" }).locator("td").nth(2).click();
    const ramos = page.getByRole("dialog", { name: "Dr. Teodoro Ramos" });
    await expect(ramos).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ramos).toBeHidden();
    await expect(page).not.toHaveURL(/faculty=/);

    // A link with ?faculty= opens the profile straight away.
    await page.goto("/faculty?faculty=4");
    await expect(page.getByRole("dialog", { name: "Dr. Teodoro Ramos" })).toBeVisible();

    // The CV assistant opens ON TOP; Escape closes only the top one.
    await page.getByRole("button", { name: "Open CV reference assistant" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await shotBoth(page, "faculty-cv-assistant", { full: false });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(page).toHaveURL(/faculty=4/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("expertise records can be added, edited and removed inside the profile", async ({ page }) => {
    await page.goto("/faculty?faculty=9");
    const dialog = page.getByRole("dialog", { name: "Dr. Angela Cruz" });
    await expect(dialog).toBeVisible();
    const section = dialog.locator("section", { has: page.getByRole("heading", { name: "Expertise records" }) });
    await expect(section.getByLabel("Text of new record")).toBeVisible();
    const add = section.getByRole("button", { name: "Add record" });
    await expect(add).toBeDisabled(); // needs at least 5 characters
    await section.getByLabel("Text of new record").fill("P63 temporary expertise record");
    await section.getByLabel("Year of new record").fill("2024");
    await expect(add).toBeEnabled();
    await add.click();
    await expect(section.getByText("Expertise record added. Panel Matching uses it immediately.")).toBeVisible();
    await expect(section.getByText("P63 temporary expertise record")).toBeVisible();
    await expect(section.getByText("Manual entry").first()).toBeVisible();

    await section.getByRole("button", { name: /Edit record: P63 temporary/ }).click();
    await section.getByLabel("Record text").fill("P63 temporary expertise record (edited)");
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByText("Expertise record updated.")).toBeVisible();
    await expect(section.getByText("P63 temporary expertise record (edited)")).toBeVisible();
    await shotBoth(page, "faculty-expertise", { full: false });

    await section.getByRole("button", { name: /Remove record: P63 temporary/ }).click();
    const confirm = page.getByRole("dialog", { name: "Remove this expertise record?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(section.getByText("P63 temporary expertise record (edited)")).toBeVisible();
    await section.getByRole("button", { name: /Remove record: P63 temporary/ }).click();
    await page.getByRole("dialog", { name: "Remove this expertise record?" }).getByRole("button", { name: "Remove record" }).click();
    await expect(section.getByText("Expertise record removed.")).toBeVisible();
    await expect(section.getByText("P63 temporary expertise record (edited)")).toHaveCount(0);
  });

  test("Add faculty and Edit dialogs: fields, validation messages, Cancel and Escape", async ({ page }) => {
    await page.goto("/faculty");
    await page.getByRole("button", { name: "Add faculty" }).first().click();
    const add = page.getByRole("dialog", { name: "Add faculty" });
    await expect(add).toBeVisible();
    for (const label of ["Full name", "Department", "Specialization", "Email (also the login)", "Status", "Temporary password (at least 8 characters)"]) {
      await expect(add.getByLabel(label), label).toBeVisible();
    }
    await expect(add.getByText("Roles this person can take")).toBeVisible();
    for (const role of ["Faculty Adviser", "Panel Member", "Panel Chair", "Academic Coordinator", "Research Coordinator"]) {
      await expect(add.getByLabel(role, { exact: true })).toBeVisible();
    }
    // The three default roles are ticked.
    await expect(add.getByLabel("Faculty Adviser", { exact: true })).toBeChecked();
    await expect(add.getByLabel("Academic Coordinator", { exact: true })).not.toBeChecked();
    await shotBoth(page, "faculty-add-dialog", { full: false });

    const submit = add.getByRole("button", { name: "Add faculty" });
    await submit.click();
    await expect(add.getByText("Enter the name, department, specialization, and email.")).toBeVisible();
    await add.getByLabel("Full name").fill("Dr. Test Person");
    await add.getByLabel("Department").fill("Education");
    await add.getByLabel("Specialization").fill("Testing");
    await add.getByLabel("Email (also the login)").fill("test.person@usls.edu.ph");
    for (const role of ["Faculty Adviser", "Panel Member", "Panel Chair"]) await add.getByLabel(role, { exact: true }).uncheck();
    await submit.click();
    await expect(add.getByText("Choose at least one role this faculty member can take.")).toBeVisible();
    await add.getByLabel("Panel Member", { exact: true }).check();
    await add.getByLabel("Temporary password (at least 8 characters)").fill("short");
    await submit.click();
    await expect(add.getByText("The temporary password must be at least 8 characters.")).toBeVisible();
    await shotBoth(page, "faculty-add-dialog-error", { full: false });
    await add.getByRole("button", { name: "Cancel" }).click();
    await expect(add).toBeHidden();

    // Escape also closes it; nothing was created.
    await page.getByRole("button", { name: "Add faculty" }).first().click();
    await expect(page.getByRole("dialog", { name: "Add faculty" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Edit: prefilled, new-password rule, Cancel.
    await page.locator("main table tbody tr").filter({ hasText: "Dr. Paolo Navarro" }).getByRole("button", { name: /Edit/ }).click();
    const edit = page.getByRole("dialog", { name: "Edit Dr. Paolo Navarro" });
    await expect(edit).toBeVisible();
    await expect(edit.getByLabel("Full name")).toHaveValue("Dr. Paolo Navarro");
    await expect(edit.getByLabel("Department")).toHaveValue("Business");
    await expect(edit.getByLabel("Email (also the login)")).toHaveValue("paolo.navarro@usls.edu.ph");
    await expect(edit.getByLabel("Status")).toHaveValue("Active");
    await edit.getByLabel("New password (leave blank to keep the current one)").fill("short");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit.getByText("The new password must be at least 8 characters.")).toBeVisible();
    await edit.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).toBeHidden();
    expect((await okJson(await page.request.get("/api/faculty"), "faculty list")).items.some((item) => item.name === "Dr. Test Person")).toBe(false);
  });
});

// ================================================================================================ Adviser appointments
const STUDENTS = {
  gian: { email: "gian.reyes@student.usls.edu.ph", name: "Gian Reyes", faculty: 6, facultyName: "Dr. Benjamin Reyes" }, // the Dean returns it
  daniel: { email: "daniel.bernardo@student.usls.edu.ph", name: "Daniel Bernardo", faculty: 9, facultyName: "Dr. Angela Cruz" }, // the Dean appoints it
  rafael: { email: "rafael.pang@student.usls.edu.ph", name: "Rafael Pang", faculty: 1, facultyName: "Dr. Liwayway Bautista" }, // adviser at the limit: exception
  marielle: { email: "marielle.navarro@student.usls.edu.ph", name: "Marielle Navarro", faculty: 11, facultyName: "Dr. Teresa Lim" }, // the Coordinator notes, staff forwards
};

test.describe("Adviser appointments", () => {
  test.describe.configure({ mode: "serial" });
  const ids = {};

  test.beforeAll(async ({ playwright }) => {
    const academic = await apiAs(playwright, "academic@usls.edu.ph");
    const staff = await apiAs(playwright, "staff@usls.edu.ph");
    for (const key of ["gian", "daniel", "rafael", "marielle"]) {
      const s = STUDENTS[key];
      const student = await apiAs(playwright, s.email);
      const applied = await okJson(
        await student.post("/api/student-portal/adviser/apply", { data: { faculty_id: s.faculty, note: `P63 application of ${s.name}.` } }),
        `${s.name} applies`,
      );
      ids[key] = applied.appointment.id;
      await student.dispose();
      if (key !== "marielle") {
        await okJson(await academic.post(`/api/adviser-appointments/${ids[key]}/note`, { data: { note: "P63 noted." } }), `note ${s.name}`);
        await okJson(await staff.post(`/api/adviser-appointments/${ids[key]}/forward`, { data: {} }), `forward ${s.name}`);
      }
    }
    await academic.dispose();
    await staff.dispose();
  });

  const card = (page, name) => page.locator(".card").filter({ hasText: name }).last();
  const tab = (page, label) => page.getByRole("tab", { name: new RegExp(`^${label}`) });
  async function statusOf(page, name) {
    const list = (await okJson(await page.request.get("/api/adviser-appointments?scope=all"), "appointments")).appointments;
    return list.filter((row) => row.student_name === name).map((row) => row.status);
  }

  test.describe("as the Academic Coordinator", () => {
    test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

    test("the card, the tabs and the note form", async ({ page }) => {
      await page.goto("/workflow/research-gate?view=adviser");
      await expect(page.getByText(/Form 3 → Academic Coordinator notes/)).toBeVisible();
      // Tabs.
      const tablist = page.getByRole("tablist", { name: "Appointment lists" });
      await expect(tablist).toBeVisible();
      for (const label of ["Needs my action", "In progress", "Accepted - contract", "All"]) await expect(tab(page, label), label).toBeVisible();
      await expect(tab(page, "Needs my action")).toHaveAttribute("aria-selected", "true");

      const marielle = card(page, "Marielle Navarro");
      await expect(marielle).toBeVisible();
      await expect(marielle).toContainText("2360061");
      await expect(marielle).toContainText("New");
      await expect(marielle).toContainText("Applied");
      await expect(marielle).toContainText("Nominated adviser");
      await expect(marielle).toContainText("Dr. Teresa Lim");
      await expect(marielle).toContainText(/\d+ of 5 advisees/);
      await expect(marielle).toContainText("P63 application of Marielle Navarro.");
      // The progress tracker lists every step of the application.
      const steps = (await okJson(await page.request.get("/api/adviser-appointments?scope=open"), "open")).appointments.find((row) => row.student_name === "Marielle Navarro").steps;
      expect(steps.length).toBeGreaterThan(2);
      await expect(marielle.locator("ol li")).toHaveCount(steps.length);
      for (const step of steps) await expect(marielle.locator("ol")).toContainText(step.label);
      // Only the Coordinator's action is offered.
      await expect(marielle.getByRole("button", { name: "Note application" })).toBeVisible();
      await expect(marielle.getByRole("button", { name: "Send to the Dean" })).toHaveCount(0);
      await expect(marielle.getByRole("button", { name: "Appoint adviser" })).toHaveCount(0);
      await shotBoth(page, "adviser-ac-list");

      // The note form: Cancel closes it, the second try sends the note.
      await marielle.getByRole("button", { name: "Note application" }).click();
      await expect(marielle.getByLabel("Note for the Research Coordinator (optional)")).toBeVisible();
      await shotBoth(page, "adviser-ac-note-form");
      await marielle.getByRole("button", { name: "Cancel" }).click();
      await expect(marielle.getByLabel("Note for the Research Coordinator (optional)")).toHaveCount(0);
      await marielle.getByRole("button", { name: "Note application" }).click();
      await marielle.getByLabel("Note for the Research Coordinator (optional)").fill("Fits the program; please send to the Dean.");
      const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/api/adviser-appointments/${ids.marielle}/note`));
      await marielle.getByRole("button", { name: "Note this application" }).click();
      expect((await request).postDataJSON()).toEqual({ note: "Fits the program; please send to the Dean." });

      // It leaves "Needs my action" and shows up under "In progress" with its new status and the Coordinator's note.
      await expect(page.locator(".card").filter({ hasText: "Marielle Navarro" })).toHaveCount(0);
      await tab(page, "In progress").click();
      const noted = card(page, "Marielle Navarro");
      await expect(noted).toBeVisible();
      await expect(noted).toContainText("Noted by AC");
      await expect(noted).toContainText("Academic Coordinator note");
      await expect(noted).toContainText("Fits the program; please send to the Dean.");
      await expect(noted.getByRole("button")).toHaveCount(0);
      await tab(page, "All").click();
      await expect(page.getByText(/\d+ appointments?, newest first\./)).toBeVisible();
      await expect(card(page, "Isabel Flores")).toContainText("Recorded");
      expect(await noOverflow(page)).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
    });
  });

  test.describe("as GS staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    test("Send to the Dean asks first; the record card is offered", async ({ page }) => {
      await page.goto("/workflow/research-gate?view=adviser");
      const marielle = card(page, "Marielle Navarro");
      await expect(marielle).toContainText("Noted by AC");
      await expect(marielle.getByRole("button", { name: "Send to the Dean" })).toBeVisible();
      await expect(marielle.getByRole("button", { name: "Note application" })).toHaveCount(0);
      // Staff can also record an appointment made outside the portal.
      await expect(page.getByText(/Record an adviser appointment|appointed outside the portal|Record/i).first()).toBeVisible();
      await shotBoth(page, "adviser-staff-list");

      let posts = 0;
      page.on("request", (r) => r.method() === "POST" && r.url().endsWith(`/api/adviser-appointments/${ids.marielle}/forward`) && posts++);
      await marielle.getByRole("button", { name: "Send to the Dean" }).click();
      const confirm = page.getByRole("dialog", { name: "Send to the Dean?" });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText("goes to the Dean for deliberation");
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await expect(confirm).toBeHidden();
      expect(posts, "Cancel sends nothing").toBe(0);
      await marielle.getByRole("button", { name: "Send to the Dean" }).click();
      await page.getByRole("dialog", { name: "Send to the Dean?" }).getByRole("button", { name: "Send to the Dean" }).click();
      await expect(page.locator(".card").filter({ hasText: "Marielle Navarro" })).toHaveCount(0);
      expect(posts).toBe(1);
      expect(await statusOf(page, "Marielle Navarro")).toEqual(["Under deliberation"]);
    });
  });

  test.describe("as the Dean", () => {
    test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

    test("the Approvals Queue lists the open applications with the Dean's two actions", async ({ page }) => {
      await page.goto("/dean/approvals");
      await expect(page.getByRole("heading", { level: 2, name: /^Adviser Designation\s*\d+$/ })).toBeVisible();
      for (const key of ["gian", "daniel", "rafael", "marielle"]) await expect(card(page, STUDENTS[key].name)).toBeVisible();
      const gian = card(page, "Gian Reyes");
      await expect(gian).toContainText("Under deliberation");
      await expect(gian).toContainText("Dr. Benjamin Reyes");
      await expect(gian.getByRole("button", { name: "Appoint adviser" })).toBeVisible();
      await expect(gian.getByRole("button", { name: "Return application" })).toBeVisible();
      await expect(gian.getByRole("button", { name: "Note application" })).toHaveCount(0);
      await expect(gian.getByRole("button", { name: "Send to the Dean" })).toHaveCount(0);
      await shotBoth(page, "adviser-dean-list");
    });

    test("Return application: a reason is required, then the confirmation, then the payload", async ({ page }) => {
      await page.goto("/dean/approvals");
      const gian = card(page, "Gian Reyes");
      const decisions = [];
      page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/decision") && decisions.push(r.url()));

      await gian.getByRole("button", { name: "Return application" }).first().click();
      await expect(gian.getByLabel("Reason for returning")).toBeVisible();
      await shotBoth(page, "adviser-dean-return-form");
      const submit = gian.getByRole("button", { name: "Return application" }).last();
      await submit.click(); // no reason yet
      await expect(gian.getByText("Give the reason this application is not approved. The student will see it.")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(decisions, "nothing is sent without a reason").toEqual([]);
      await shotBoth(page, "adviser-dean-return-error");

      await gian.getByLabel("Reason for returning").fill("The nominee's expertise does not fit this topic.");
      await submit.click();
      const confirm = page.getByRole("dialog", { name: "Return this application?" });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText("the application is not approved and the student sees your reason");
      await confirm.getByRole("button", { name: "Cancel" }).click();
      expect(decisions, "Cancel sends nothing").toEqual([]);
      await submit.click();
      const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/api/adviser-appointments/${ids.gian}/decision`));
      await page.getByRole("dialog", { name: "Return this application?" }).getByRole("button", { name: "Return application" }).click();
      expect((await request).postDataJSON()).toEqual({ decision: "return", note: "The nominee's expertise does not fit this topic." });
      await expect(page.locator(".card").filter({ hasText: "Gian Reyes" })).toHaveCount(0);
      expect(await statusOf(page, "Gian Reyes")).toEqual(["Not approved"]);
    });

    test("Appoint adviser: optional note and Associate Dean name, no exception box under the limit", async ({ page }) => {
      await page.goto("/dean/approvals");
      const daniel = card(page, "Daniel Bernardo");
      await expect(daniel).toContainText(/2 of 5 advisees/);
      await daniel.getByRole("button", { name: "Appoint adviser" }).first().click();
      await expect(daniel.getByLabel("Dean's note (optional)")).toBeVisible();
      await expect(daniel.getByLabel("Associate Dean name (optional)")).toBeVisible();
      await expect(daniel.getByText("Fill in only if an Associate Dean is approving on the Dean's behalf.")).toBeVisible();
      await expect(daniel.getByRole("checkbox")).toHaveCount(0);
      const submit = daniel.getByRole("button", { name: "Appoint adviser" }).last();
      await expect(submit).toBeEnabled();
      await shotBoth(page, "adviser-dean-appoint-form");
      await daniel.getByLabel("Dean's note (optional)").fill("Welcome aboard.");
      await daniel.getByLabel("Associate Dean name (optional)").fill("Dr. Associate Dean");
      await submit.click();
      const confirm = page.getByRole("dialog", { name: "Appoint this adviser?" });
      await expect(confirm).toContainText("Dr. Angela Cruz is appointed research adviser of Daniel Bernardo. Form 3.1 is issued");
      const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/api/adviser-appointments/${ids.daniel}/decision`));
      await confirm.getByRole("button", { name: "Appoint adviser" }).click();
      expect((await request).postDataJSON()).toEqual({ decision: "appoint", note: "Welcome aboard.", associate_dean: "Dr. Associate Dean" });
      await expect(page.locator(".card").filter({ hasText: "Daniel Bernardo" })).toHaveCount(0);
      expect(await statusOf(page, "Daniel Bernardo")).toEqual(["Appointed"]);
      // It now shows in "All" with the Dean's decision and the Associate Dean.
      await tab(page, "All").click();
      const done = card(page, "Daniel Bernardo");
      await expect(done).toContainText("Dean's decision");
      await expect(done).toContainText("Welcome aboard.");
      await expect(done).toContainText("Dr. Associate Dean");
    });

    test("Appoint beyond the limit: the exception must be ticked and needs a note", async ({ page }) => {
      await page.goto("/dean/approvals");
      const rafael = card(page, "Rafael Pang");
      await expect(rafael).toContainText(/\d+ of 5 advisees/);
      await expect(rafael).toContainText("at the limit");
      await rafael.getByRole("button", { name: "Appoint adviser" }).first().click();
      await expect(rafael.getByLabel("Note for the exception")).toBeVisible();
      const exception = rafael.getByRole("checkbox", { name: /Dean's exception/ });
      await expect(exception).toBeVisible();
      await expect(exception).not.toBeChecked();
      await expect(rafael).toContainText("Dr. Liwayway Bautista already has");
      const submit = rafael.getByRole("button", { name: "Appoint adviser" }).last();
      await expect(submit, "Appoint stays off until the exception is ticked").toBeDisabled();
      await shotBoth(page, "adviser-dean-exception-form");
      await exception.check();
      await expect(submit).toBeEnabled();
      await submit.click(); // ticked, but no note
      await expect(rafael.getByText("A Dean's exception needs a short note.")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await shotBoth(page, "adviser-dean-exception-error");
      await rafael.getByLabel("Note for the exception").fill("Exception approved by the Dean.");
      await submit.click();
      const confirm = page.getByRole("dialog", { name: "Appoint this adviser?" });
      const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/api/adviser-appointments/${ids.rafael}/decision`));
      await confirm.getByRole("button", { name: "Appoint adviser" }).click();
      expect((await request).postDataJSON()).toEqual({ decision: "appoint", note: "Exception approved by the Dean.", cap_exception: true });
      await expect(page.locator(".card").filter({ hasText: "Rafael Pang" })).toHaveCount(0);
      expect(await statusOf(page, "Rafael Pang")).toEqual(["Appointed"]);
      await tab(page, "All").click();
      await expect(card(page, "Rafael Pang")).toContainText("Appointed beyond the 5-advisee limit.");
    });
  });
});

// ================================================================================================ Form 1 endorsement
test.describe("Form 1 endorsement queue (Academic Coordinator)", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

  test("endorse stays off until a signature is finalized, then signs and the queue shows Endorsed", async ({ page, playwright }) => {
    const title = "Peer Feedback Rubrics and the Writing Confidence of Graduate Education Students";
    // Setup: Elena Mendoza (comprehensive exam passed) uploads Form 1 and three concept papers.
    const student = await apiAs(playwright, "elena.mendoza@student.usls.edu.ph");
    const upload = async (itemName, file) =>
      okJson(await student.post("/api/student-portal/research-evidence/upload", { multipart: { gate: "Form 1 - Title Defense", item_name: itemName, file } }), `upload ${file.name}`);
    await upload(
      "Form 1 - Application for Title Defense",
      pdfFile("Mendoza_Elena_Form1.pdf", [
        "UNIVERSITY OF ST. LA SALLE - GRADUATE SCHOOL",
        "FORM 1: APPLICATION FOR TITLE DEFENSE",
        "Student: Elena Mendoza   Student Number: 2260011",
        `Research Title: ${title}`,
        "Research Keywords: peer feedback, writing confidence",
      ]),
    );
    for (const n of [1, 2, 3]) {
      await upload("Three concept papers", pdfFile(`Mendoza_Elena_Concept_Paper_${n}.pdf`, ["CONCEPT PAPER", `Title: Concept paper ${n} on peer feedback rubrics`, "Introduction: rubrics help graduate writers."]));
    }
    await student.dispose();

    await page.goto("/form1-endorsements");
    await expect(page.getByText("Form 1 Endorsements").first()).toBeVisible();
    await expect(page.getByText("Academic Coordinator review and in-system signature queue")).toBeVisible();
    await expect(page.getByText(/The endorsement immediately updates Research Gate progress/)).toBeVisible();
    await expect(page.getByText("Waiting and endorsed")).toBeVisible();
    await expect(page.getByText(/\d+ waiting/)).toBeVisible();
    await shotBoth(page, "form1-queue");

    // Pick Elena (the page opens on the first waiting student; that is Elena, the only one waiting).
    await page.getByRole("button", { name: /Elena Mendoza.*Waiting/s }).click();
    await expect(page.getByRole("heading", { name: "Elena Mendoza" })).toBeVisible();
    await expect(page.getByText("2260011 · Master of Arts in Education")).toBeVisible();
    for (const label of ["Research title", "Adviser", "Current stage", "Uploaded"]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText("Uploaded Form 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mendoza_Elena_Form1.pdf" })).toBeVisible();
    await expect(page.getByText("Draw signature")).toBeVisible();

    const endorse = page.getByRole("button", { name: /Endorse and sign Form 1/ });
    await expect(endorse, "no signature yet").toBeDisabled();
    await shotBoth(page, "form1-before-signature");
    await drawSignature(page);
    await expect(endorse, "drawn but not finalized").toBeDisabled();
    await page.getByRole("button", { name: /Finalize signature/ }).click();
    await expect(page.getByText("Signature finalized and ready to submit.")).toBeVisible();
    await expect(endorse).toBeEnabled();
    await shotBoth(page, "form1-signature-finalized");
    // Clearing the drawing switches the endorse button off again.
    await page.getByRole("button", { name: /Clear drawing/ }).click();
    await expect(endorse).toBeDisabled();
    await drawSignature(page);
    await page.getByRole("button", { name: /Finalize signature/ }).click();
    await expect(endorse).toBeEnabled();

    const request = page.waitForRequest((r) => r.method() === "POST" && /\/api\/research-gate\/form1-endorsements\/\d+$/.test(r.url()));
    await endorse.click();
    const body = (await request).postDataJSON();
    expect(Object.keys(body)).toEqual(["signature_data"]);
    expect(body.signature_data.startsWith("data:image/png;base64,")).toBe(true);
    await expect(page.getByText("Form 1 endorsed successfully.")).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByText(/getContext|Cannot read properties/i)).toHaveCount(0);
    await expect(page.getByText(/Endorsed by/).first()).toBeVisible();
    await expect(page.getByAltText("Academic Coordinator signature")).toBeVisible();
    await expect(page.getByRole("button", { name: /Elena Mendoza.*Endorsed/s })).toBeVisible();
    await expect(page.getByRole("button", { name: /Endorse and sign Form 1/ })).toHaveCount(0);
    await shotBoth(page, "form1-endorsed");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
  });

  test("the queue also sits inside Research Gate for the Academic Coordinator", async ({ page }) => {
    await page.goto("/workflow/research-gate?student_id=2");
    const section = page.locator("#form1-endorsement-queue");
    await expect(section).toBeVisible();
    await expect(section.getByText("Form 1 Endorsements")).toBeVisible();
    await expect(section.getByText("Waiting and endorsed")).toBeVisible();
    await shotBoth(page, "form1-embedded");
  });
});
