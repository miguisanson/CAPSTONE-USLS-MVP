// e2e-writes: none
// Owner 2026-11-04: "make things automatic, drop down, or make sure people can't make a mistake." Typed fields that have a
// finite or checkable answer become a pick or get an inline check. Every write is answered by page.route, so nothing is saved.
//   B-01 School year / AY entry is a pick ("AY 2026-2027", value 26-27)   B-02 Student ID 7 digits (soft)   B-04 email shape
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const norm = (raw) => { const m = /^\s*(\d{2}|\d{4})\s*-\s*(\d{2}|\d{4})\s*$/.exec(raw || ""); return m ? `${m[1].slice(-2)}-${m[2].slice(-2)}` : ""; };
const ayOf = (label) => { const m = /(\d{4})\s*-\s*(\d{4})/.exec(label); return `${m[1].slice(2)}-${m[2].slice(2)}`; };
const okJson = async (res, what) => { const b = await res.json().catch(() => ({})); expect(res.ok(), `${what}: ${res.status()}`).toBeTruthy(); return b; };

test.describe("Monitoring Sheet: no typed school year, checked ID and email", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180_000 });

  async function facts(page) {
    const grid = await okJson(await page.request.get("/api/monitoring/grid"), "grid");
    const current = grid.terms.find((t) => t.relative_label === "Current");
    const years = grid.students.map((s) => norm(s.academic_year_entry)).filter(Boolean).map((v) => 2000 + Number(v.slice(0, 2)));
    return { grid, current, oldest: Math.min(...years), salonga: grid.students.find((s) => s.last_name === "Salonga" && s.first_name === "Bea") };
  }
  async function capture(page, pattern, method, json, writes) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      if (request.method() !== method) return route.fallback();
      writes.push({ body: request.postDataJSON() });
      return route.fulfill({ json });
    });
  }

  test("B-01 / B-02 / B-04: Add student", async ({ page }) => {
    const { current, oldest } = await facts(page);
    const writes = [];
    await capture(page, "**/api/monitoring/students", "POST", { message: "Spec: added.", student: { id: 1 }, account: { email: "spec@usls.edu.ph", must_change_password: false } }, writes);
    await page.goto("/monitoring-sheet");
    await page.getByRole("button", { name: "Add student", exact: true }).first().click();
    const add = page.getByRole("dialog", { name: "Add student" });
    await expect(add).toBeVisible();

    // B-01: a pick, current school year chosen, labels read "AY 2026-2027", reaches back to the oldest student on record
    const year = add.getByLabel("School year / AY entry");
    expect(await year.evaluate((el) => el.tagName)).toBe("SELECT");
    await expect(year).toHaveValue(ayOf(current.label));
    const labels = await year.locator("option").allTextContents();
    const cur = 2000 + Number(ayOf(current.label).slice(0, 2));
    expect(labels).toContain(`AY ${cur}-${cur + 1}`);
    expect(labels).toContain(`AY ${oldest}-${oldest + 1}`);

    const program = add.locator("select").first();
    if (!(await program.inputValue())) await program.selectOption({ index: 1 });
    await add.getByLabel("First name").fill("Sp3c");
    await expect(add.getByText("Use letters only")).toBeVisible(); // B-03
    await expect(add.getByRole("button", { name: "Add student", exact: true })).toBeDisabled();
    await add.getByLabel("First name").fill("Spec");
    await expect(add.getByText("Use letters only")).toHaveCount(0);
    await add.getByLabel("Last name").fill("Picker");
    await year.selectOption(`${String(oldest).slice(2)}-${String(oldest + 1).slice(2)}`);

    // B-02: ID must be 7 digits; a different ID warns and needs a second click to go on
    const id = add.getByLabel("Student ID");
    await id.fill("12ab");
    await expect(add.getByText("Student IDs are 7 digits")).toBeVisible();
    await id.fill("1860101");
    await expect(add.getByText("Student IDs are 7 digits")).toHaveCount(0);
    await id.fill("GS-2026-XX-01");
    // B-04: email shape
    const email = add.getByLabel("Email");
    await email.fill("not-an-email");
    await expect(add.getByText("Enter an email like name@usls.edu.ph.")).toBeVisible();
    await expect(add.getByRole("button", { name: "Add student", exact: true })).toBeDisabled();
    await email.fill("spec.picker@usls.edu.ph");
    await expect(add.getByText("Enter an email like")).toHaveCount(0);
    await add.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(add.getByRole("button", { name: "Use this ID anyway" })).toBeVisible();
    expect(writes).toHaveLength(0);
    await add.getByRole("button", { name: "Use this ID anyway" }).click();
    await expect(add.getByText("Spec: added.")).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0].body.academic_year_entry).toBe(`${String(oldest).slice(2)}-${String(oldest + 1).slice(2)}`);
    expect(writes[0].body.student_number).toBe("GS-2026-XX-01");
  });

  test("B-01 / B-02 / B-04: Correct details preselects the normalised school year and sends it only when changed", async ({ page }) => {
    const { salonga, current } = await facts(page);
    const real = await okJson(await page.request.get(`/api/monitoring/students/${salonga.id}`), "record");
    const writes = [];
    await capture(page, new RegExp(`/api/monitoring/students/${salonga.id}$`), "PATCH", { message: "Spec: corrected." }, writes);
    await page.route(new RegExp(`/api/monitoring/students/${salonga.id}$`), async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const data = { ...real, permissions: { ...(real.permissions || {}), can_edit: true }, student: { ...real.student, academic_year_entry: "2024-2025" } };
      return route.fulfill({ json: data });
    });
    await page.goto("/monitoring-sheet");
    await page.locator("main table tbody tr").filter({ hasText: "Salonga, Bea" }).getByRole("button", { name: "Edit monitoring record of Salonga, Bea" }).click();
    const panel = page.getByRole("dialog", { name: /Salonga, Bea/ });
    await panel.getByRole("tab", { name: /Student details/ }).click();
    await panel.getByRole("button", { name: "Correct details" }).click();
    const year = panel.getByLabel("School year / AY entry");
    expect(await year.evaluate((el) => el.tagName)).toBe("SELECT");
    await expect(year).toHaveValue("24-25");
    await expect(panel.getByRole("button", { name: "Review correction" })).toBeDisabled(); // no false change
    await panel.getByLabel("Student ID").fill("12ab");
    await expect(panel.getByText("Student IDs are 7 digits")).toBeVisible();
    await panel.getByLabel(/^Email/).fill("bad");
    await expect(panel.getByText("Enter an email like")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Review correction" })).toBeDisabled();
    await panel.getByLabel(/^Email/).fill(real.student.email);
    await panel.getByLabel("Student ID").fill(real.student.student_number);
    await panel.getByLabel("First name").fill("Beatrice");
    await panel.getByRole("button", { name: "Review correction" }).click();
    const reason = page.getByRole("dialog", { name: "Save this correction?" });
    await reason.getByLabel(/Reason/).fill("Spec reason");
    await reason.getByRole("button", { name: "Save correction" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body).not.toHaveProperty("academic_year_entry");
    void current;
  });

  test("B-01 / B-02: Handoff 'Edit uploaded values' picks the school year and warns on an ID that is not 7 digits", async ({ page }) => {
    const upload = {
      id: 9001, original_name: "spec.xlsx", program: "MSCS", rows: 1, uploaded_at: new Date().toISOString(), unresolved_count: 1, download_url: "/spec.xlsx",
      issues: [{
        id: 9101, status: "Unresolved", row_number: 2, issue: "Conflict", summary: "Spec", incoming_name: "Spec Student", incoming_student_number: "1860101",
        uploaded: { student_number: "1860101", first_name: "Spec", last_name: "Student", academic_year_entry: "2025-2026", subjects: {} },
        existing: { name: "Spec Student", student_number: "1860101", academic_year_entry: "25-26" },
        subject_comparison: [], discrepancies: [],
      }],
    };
    await page.route("**/api/monitoring/uploads", (route) => route.fulfill({ json: { items: [upload] } }));
    const resolves = [];
    await page.route("**/api/monitoring/issues/9101/resolve", (route) => { resolves.push(route.request().postDataJSON()); return route.fulfill({ json: { message: "Spec: resolved.", issue: { ...upload.issues[0], status: "Resolved" } } }); });
    await page.goto("/workflow/student-handoff");
    await page.getByRole("button", { name: /View upload history/ }).click();
    await page.locator("details summary").first().click();
    await page.getByRole("button", { name: "Compare" }).first().click();
    const modal = page.getByRole("dialog").last();
    await modal.getByRole("button", { name: /Edit/ }).first().click();
    const year = modal.getByLabel("School Year / AY Entry");
    expect(await year.evaluate((el) => el.tagName)).toBe("SELECT");
    await expect(year).toHaveValue("25-26");
    await modal.getByLabel("Student ID").fill("12ab");
    await expect(modal.getByText("Student IDs are 7 digits")).toBeVisible();
    await year.selectOption("24-25");
    await modal.getByRole("button", { name: "Save Edited Record" }).click();
    await expect.poll(() => resolves.length).toBe(1);
    expect(resolves[0].edited.academic_year_entry).toBe("24-25");
  });
});

test.describe("Defense scheduling: venue pick, time slots, mode", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180_000 });

  test("B-40 / B-41 / B-42: times are 30-minute slots, venue offers the rooms already used, mode is three choices", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const calendar = await okJson(await page.request.get(`/api/calendar?start=${today}&end=${today}`), "calendar");
    const rooms = (calendar.filters?.venues || []).filter((v) => !/^https?:/i.test(v));
    await page.goto("/workflow/defense-scheduling?student_id=146");
    const main = page.locator("main");
    const start = main.getByLabel(/Start time/);
    const end = main.getByLabel(/End time/);
    expect(await start.evaluate((el) => el.tagName)).toBe("SELECT");
    expect(await end.evaluate((el) => el.tagName)).toBe("SELECT");
    const startValues = await start.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    expect(startValues[0]).toBe("08:00");
    expect(startValues).toContain("08:30");
    expect(startValues.at(-1)).toBe("16:30");
    await start.selectOption("09:00");
    const endValues = await end.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    expect(endValues[0]).toBe("09:30");
    expect(endValues.at(-1)).toBe("17:00");
    await end.selectOption("11:00");
    await start.selectOption("11:30"); // a start later than the chosen end clears the end
    await expect(end).toHaveValue("");
    // mode: three choices only
    const mode = main.getByLabel(/^Mode/);
    expect(await mode.locator("option").allTextContents()).toEqual(["On-site", "Online", "Hybrid"]);
    // venue: free text still allowed, but the rooms already used are offered
    const venue = main.getByLabel(/Venue/);
    const listId = await venue.getAttribute("list");
    expect(listId, "venue input has a datalist").toBeTruthy();
    const offered = await page.locator(`datalist#${listId} option`).evaluateAll((os) => os.map((o) => o.value));
    expect(offered).toEqual(rooms);
    await venue.fill("A brand new room");
    await expect(venue).toHaveValue("A brand new room");
  });
});

test.describe("Dates and numbers that cannot be wrong", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("B-47: the adviser's appointment date cannot be in the future", async ({ page }) => {
    await page.goto("/adviser-appointments");
    await page.getByRole("button", { name: /Record an adviser appointed outside the portal/ }).click();
    const date = page.getByLabel("Appointment date");
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    await expect(date).toHaveAttribute("max", today);
    await date.fill("2999-01-01");
    await expect(page.getByText("The appointment date cannot be in the future.")).toBeVisible();
    await date.fill(today);
    await expect(page.getByText("The appointment date cannot be in the future.")).toHaveCount(0);
  });
});

test.describe("Student practicum hours", () => {
  test("B-23: completed hours are a whole number, 0 up to twice the required hours", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
    const res = await context.request.post("/api/auth/login", { data: { email: "student@usls.edu.ph", password: PASSWORD } });
    expect(res.ok()).toBeTruthy();
    const writes = [];
    await context.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const d = await response.json();
      d.student.program_has_practicum = true; d.student.program_code = "MAPSY"; d.student.program_name = "Master of Arts in Psychology";
      d.practicum_eligibility = { eligible: true, status: "Verified", checklist: [], program_scope: {} };
      d.practicum_program_scope = { description: "Spec practicum scope text." };
      d.practicum_record = { id: 21, status: "Practicum In Progress", updated_at: "2026-10-02T09:00:00", practicum_site: "Spec Clinic", supervisor_name: "Dr. Spec", required_hours: 200, completed_hours: 50, certificate_count: 1, moa_attachment: { id: 6001, name: "moa-spec.pdf", url: "/spec/moa.pdf", file_exists: true, uploaded_by: "Spec", uploaded_at: "2026-09-01T09:00:00" }, certificate_attachment: null, completion_attachments: [], attachments: [] };
      d.workflow_messages = [];
      await route.fulfill({ response, json: d });
    });
    await context.route("**/api/student-portal/requests/practicum", (route) => { writes.push(route.request().method()); return route.fulfill({ json: { message: "Spec: request saved." } }); });
    await context.route("**/api/student-portal/request-attachments/upload", (route) => route.fulfill({ json: { attachment: { id: 7001, name: "spec.pdf", url: "/spec/spec.pdf", file_exists: true } } }));
    const page = await context.newPage();
    await page.goto("/student/practicum");
    const main = page.locator("main");
    await main.locator('input[type="file"]').setInputFiles({ name: "spec.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 spec") });
    const hours = main.locator("#practicum-hours");
    await expect(hours).toHaveAttribute("max", "400");
    await expect(hours).toHaveAttribute("step", "1");
    await hours.fill("401");
    await main.getByRole("button", { name: "Submit completion stage" }).click();
    await expect(main.getByText(/more than 400 hours/).first()).toBeVisible();
    expect(writes).toHaveLength(0);
    await hours.fill("12.5");
    await main.getByRole("button", { name: "Submit completion stage" }).click();
    await expect(main.getByText(/whole number/).first()).toBeVisible();
    expect(writes).toHaveLength(0);
    await hours.fill("200");
    await main.getByRole("button", { name: "Submit completion stage" }).click();
    await expect(page.getByRole("dialog", { name: "Send this request?" })).toBeVisible();
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });
});

async function studentFormPage(browser, mutate) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "student@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch();
    const d = await response.json();
    mutate(d);
    await route.fulfill({ response, json: d });
  });
  const page = await context.newPage();
  return { context, page };
}

test.describe("Student forms: no wrong date, no over-long title", () => {
  test("B-18: the preferred defense date cannot be today or earlier", async ({ browser }) => {
    const { context, page } = await studentFormPage(browser, (d) => {
      d.research_case = { ...(d.research_case || {}), id: 1, title: "Spec Saved Title", status: "Pending" };
      d.panel = [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }];
      const stages = [{ name: "Title Defense", gate: "Form 1 - Title Defense", complete: true, status: "Passed" }, { name: "Proposal Defense", gate: "Form 4", complete: false, status: "Pending" }];
      d.research_progress = { gate: "Form 4", stage: "Proposal Defense", stage_index: 1, status: "Pending", stages, milestone: { value: "Form 4", label: "Spec", short_label: "Spec", description: "Spec.", student_uploads_ready: true, student_missing_count: 0, overall_complete: false, requirements: [] } };
      d.schedules = [];
      d.defense_follow_up = null;
    });
    await page.goto("/student/defense-schedule");
    const date = page.locator("#schedule-date");
    const tomorrow = await page.evaluate(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    await expect(date).toHaveAttribute("min", tomorrow);
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });

  test("B-15: the research title box stops at 220 characters (the length the record keeps)", async ({ browser }) => {
    const { context, page } = await studentFormPage(browser, (d) => {
      d.research_case = { ...(d.research_case || {}), id: 1, title: "Research title pending Form 1 submission", status: "Pending" };
      d.panel = [];
      const stages = [{ name: "Title Defense", gate: "Form 1 - Title Defense", complete: false, status: "Pending" }];
      d.research_progress = { gate: "Form 1 - Title Defense", stage: "Title Defense", stage_index: 0, status: "Pending", stages, milestone: { value: "Form 1 - Title Defense", label: "Spec", short_label: "Spec", description: "Spec.", student_uploads_ready: true, student_missing_count: 0, overall_complete: false, requirements: [] } };
    });
    await page.goto("/student/research");
    await expect(page.locator("#research-title")).toHaveAttribute("maxlength", "220");
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });
});

test.describe("Staff pages: sections, years, colleges", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180_000 });

  test("B-38: an offering's section is a pick, A to Z", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("academic-coordinator"), baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.goto("/course-offerings");
    const section = page.locator('[aria-label^="Section for "]').first();
    await expect(section).toBeVisible();
    expect(await section.evaluate((el) => el.tagName)).toBe("SELECT");
    const values = await section.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    expect(values.slice(0, 3)).toEqual(["A", "B", "C"]);
    expect(values.at(-1)).toBe("Z");
    await context.close();
  });

  test("B-39: sections per course are whole numbers with an upper limit", async ({ page }) => {
    await page.goto("/course-adjustments");
    const sections = page.locator('input[aria-label^="Sections for "]').first();
    await expect(sections).toBeVisible();
    await expect(sections).toHaveAttribute("max", /^\d+$/);
    await expect(sections).toHaveAttribute("step", "1");
  });

  test("B-50: the panel-matching department filter is a pick of the colleges listed", async ({ page }) => {
    await page.goto("/workflow/panel-matching?student_id=146");
    const college = page.locator("main").getByLabel("Department / program");
    await expect(college).toBeVisible();
    expect(await college.evaluate((el) => el.tagName)).toBe("SELECT");
  });

  test("B-68: an expertise record's year cannot be after this year", async ({ page }) => {
    await page.goto("/faculty");
    await page.locator("main table tbody tr").first().getByRole("button").first().click();
    const year = page.getByLabel("Year of new record");
    await expect(year).toHaveAttribute("max", String(new Date().getFullYear()));
  });
});
