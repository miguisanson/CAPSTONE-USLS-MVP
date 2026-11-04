// e2e-writes: none
// Owner 2026-11-04: "make things automatic, drop down, or make sure people can't make a mistake." Typed fields that have a
// finite or checkable answer become a pick or get an inline check. Every write is answered by page.route, so nothing is saved.
//   B-01 School year / AY entry is a pick ("AY 2026-2027", value 26-27)   B-02 Student ID 7 digits (soft)   B-04 email shape
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

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
    await add.getByLabel("First name").fill("Spec");
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
