// e2e-writes: derive5-dara
// derive5 (I-170, I-174, I-273, I-277, I-284, I-285, I-313, I-326, I-327): the screens stop asking for what the system knows.
//   1 Defense Scheduling shows the manuscript date read-only (adviser's signed Form 4); no lead-time override wording
//   2 Add student has no Enrollment status select          3 a Dropped subject has no free-text exception field
//   4 the Turnitin upload sends similarity_percent          5 the AWOL forward sends both returnee checks
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const PDF = { name: "spec.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };

test.describe("derive5 staff screens", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180_000 });

  test("1: Defense Scheduling shows the Form 4 date read-only and has no lead-time override", async ({ page }) => {
    await page.route(/\/api\/transactions\/defense-scheduling\/context/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.manuscript_received_on = "2026-10-01";
      json.defense_type = "Proposal Defense";
      json.schedulable_types = ["Proposal Defense"];
      await route.fulfill({ response, json });
    });
    await page.goto("/workflow/defense-scheduling?student_id=146");
    const field = page.getByLabel("Date the panel received the manuscript");
    await expect(field).toBeVisible({ timeout: 30_000 });
    expect(await field.evaluate((el) => el.tagName)).not.toBe("INPUT");
    await expect(field).toContainText("Oct");
    await expect(page.getByText("From the adviser's signed Form 4.")).toBeVisible();
    await expect(page.getByText(/before the lead time/)).toHaveCount(0);
    await expect(page.getByText(/a panelist has not entered available dates/)).toBeVisible();
  });

  test("2 and 3: Add student has no Enrollment status select; a Dropped subject has only the absence percentage", async ({ page }) => {
    const bodies = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/monitoring/students")) bodies.push(r.postDataJSON()); });
    await page.goto("/monitoring-sheet");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Add student", exact: true }).first().click();
    const add = page.getByRole("dialog", { name: "Add student" });
    await expect(add.getByLabel("Enrollment status").locator("xpath=self::select")).toHaveCount(0);
    await expect(add.getByText("Set from the subjects. Not Enrolled until subjects are added.")).toBeVisible();
    const program = add.locator("select").first();
    if (!(await program.inputValue())) await program.selectOption({ index: 1 });
    await add.getByLabel("Student ID").fill("7700555");
    await add.getByLabel("First name").fill("Dara");
    await add.getByLabel("Last name").fill("Derive");
    await add.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(add.getByText("Student portal login:")).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0])).not.toContain("enrollment_tag");

    await add.getByRole("button", { name: "Add subjects now" }).click();
    const panel = page.getByRole("dialog", { name: /Derive, Dara/ });
    await panel.getByRole("tab", { name: /Subjects/ }).click();
    const addRow = panel.locator('button[aria-label^="Add "]').first();
    const code = ((await addRow.getAttribute("aria-label")) || "").replace(/^Add /, "");
    await addRow.click();
    const editor = panel.locator(`form[aria-label="Add ${code}"]`);
    await editor.getByLabel("Status").selectOption("Dropped");
    await expect(editor.getByLabel(/Unexcused absences/)).toBeVisible();
    await expect(editor.getByText("More than 20 % unexcused absences (Handbook p.52); excused absences do not count")).toBeVisible();
    await expect(editor.getByText(/documented exception/i)).toHaveCount(0);
    await expect(editor.getByLabel(/exception/i)).toHaveCount(0);
  });

  test("5: the AWOL forward shows both returnee checks and sends them", async ({ page }) => {
    const posts = [];
    await page.route(/\/api\/process-cases\/awol\/[^/]+\/transition/, async (route) => {
      posts.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, message: "Spec: moved." } });
    });
    await page.goto("/workflow/awol");
    const cards = page.locator("[data-card-id]").filter({ has: page.getByRole("button", { name: "Move to" }) });
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    let opened = false;
    for (let i = 0; i < await cards.count() && !opened; i++) {
      await cards.nth(i).getByRole("button", { name: "Move to" }).click();
      const item = page.getByRole("menuitem", { name: "With the Dean" });
      if (await item.count()) { await item.click(); opened = true; } else await page.keyboard.press("Escape");
    }
    expect(opened, "an AWOL card that can go to the Dean").toBeTruthy();
    const dialog = page.getByRole("dialog");
    const boxes = dialog.getByRole("checkbox");
    await expect(boxes).toHaveCount(2);
    await expect(dialog.getByText("Clearance from Business Office")).toBeVisible();
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await dialog.getByRole("button", { name: "Forward to Dean", exact: true }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].confirmed_items).toEqual(["Clearance from Business Office", "Interview (reason for delay, residency requirements)"]);
  });
});

test.describe("derive5 student Turnitin upload", () => {
  test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 900 } });

  test("4: Similarity (%) is sent with the Turnitin certificate and the server refusal shows", async ({ page }) => {
    const posts = [];
    await page.route("**/api/student-portal/research-evidence/upload", async (route) => {
      const raw = route.request().postDataBuffer()?.toString("latin1") || "";
      posts.push(raw);
      if (/name="similarity_percent"\r\n\r\n20/.test(raw)) return route.fulfill({ status: 400, json: { error: "The similarity index is 20%. It must be 15% or less." } });
      return route.fulfill({ json: { document: {} } });
    });
    await page.route("**/api/student-portal/context", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      const req = { item_name: "Turnitin Certificate with SIR not more than 15%", label: "Turnitin certificate", description: "Spec.", student_upload: true, required_file_count: 1, file_count: 0, files: [], status: "Missing", status_label: "Missing", adviser_signature_required: false, outcome: null, source_type: "student_upload", template_url: null };
      data.research_case = { ...(data.research_case || {}), id: 1, title: "Spec", status: "Pending" };
      data.research_progress = { gate: "Completion Evidence", stage: "Completion", stage_index: 3, status: "Pending", stages: [{ name: "Completion", gate: "Completion Evidence", complete: false, status: "Pending" }],
        milestone: { value: "Completion Evidence", label: "Completion", short_label: "Completion", description: "Spec.", student_uploads_ready: false, student_missing_count: 1, overall_complete: false, requirements: [req] } };
      await route.fulfill({ response, json: data });
    });
    await page.goto("/student/research");
    const card = page.locator("div.rounded-xl.py-3", { hasText: "Turnitin" }).filter({ has: page.locator('input[type="file"]') }).first();
    await expect(card, "the Turnitin card is on the student's research page").toBeVisible({ timeout: 30_000 });
    const similarity = card.getByLabel("Similarity (%)");
    await expect(similarity).toBeVisible();
    await similarity.fill("20");
    await card.locator('input[type="file"]').setInputFiles(PDF);
    await expect(card.getByText("The similarity index is 20%. It must be 15% or less.")).toBeVisible();
    await similarity.fill("8");
    await card.locator('input[type="file"]').setInputFiles(PDF);
    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1]).toMatch(/name="similarity_percent"\r\n\r\n8\r\n/);
  });
});
