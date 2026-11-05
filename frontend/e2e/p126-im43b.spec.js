// e2e-writes: none
// IM43 part b (owner 2026-11-05). Every write is answered by the browser (page.route), so nothing is saved; the exact request
// bodies are asserted. The server side is tested in tests/test_im43b.py.
//   I-248  The title-defense verdict offers the student's three concept-paper titles and "A new title set by the panel"
//          (free text only for that last choice). Checked in the Research Gate "Record for the panel" window (VerdictFields).
//   I-252  The Academic Coordinator enters the verified practicum hours on the case window; the student's hours are labelled
//          as reported by the student.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const TITLES = ["Peer feedback rubrics in graduate writing", "Mentoring and thesis completion", "Digital portfolios for research"];
const NEW_TITLE = "A new title set by the panel";

test.describe("I-248: the verdict picks one of the three concept-paper titles", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test.afterEach(async ({ page }) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.unrouteAll({ behavior: "ignoreErrors" }); });

  async function openDialog(page, bodies) {
    let student = "";
    await page.route("**/api/research-gate/overview", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const row = body.items.find((item) => item.column === "1") || body.items[0];
      student = row.student.name;
      Object.assign(row, {
        verdict: null, can_record_verdict: true, can_correct_verdict: false, can_confirm_revisions: false,
        next_defense: { id: 7701, defense_type: "Title Defense", date: "2026-11-01", start_time: "09:00", status: "Scheduled", panel_chair: "Dr. Spec Chair" },
        verdict_options: [{ value: "Passed", label: "Passed", summary: "Spec pass." }, { value: "Failed", label: "Failed", summary: "Spec fail." }],
        concept_titles: TITLES,
      });
      await route.fulfill({ response, json: body });
    });
    await page.route("**/api/research-gate/7701/verdict", async (route) => {
      bodies.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({ json: { message: "Spec: verdict recorded." } });
    });
    await page.goto("/workflow/research-gate");
    await expect(page.getByRole("region", { name: "Research Gate board" })).toBeVisible();
    const button = page.getByRole("button", { name: /^Record the verdict for the panel for / }).first();
    await expect(button).toBeVisible();
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Record the verdict for the panel" });
    await expect(dialog).toBeVisible();
    expect(student).toBeTruthy();
    return dialog;
  }

  test("a picked title is sent as the title; the free-text box shows only for a new title", async ({ page }) => {
    const bodies = [];
    const dialog = await openDialog(page, bodies);
    await dialog.getByLabel(/^Verdict/).selectOption("Passed");
    const pick = dialog.getByLabel(/^Title selected by the panel/);
    await expect(pick.locator("option")).toHaveText(["Choose the title", ...TITLES, NEW_TITLE]);
    await expect(dialog.getByLabel(/^New title set by the panel/)).toHaveCount(0);
    await pick.selectOption(TITLES[1]);
    await expect(dialog.getByLabel(/^New title set by the panel/)).toHaveCount(0);
    await dialog.getByLabel(/^Why are you recording/).fill("The panel chair is away; signed result received.");
    await dialog.getByRole("button", { name: "Record for the panel" }).click();
    await expect(page.getByText("Spec: verdict recorded.")).toBeVisible();
    expect(bodies[0]).toMatchObject({ result: "Passed", selected_title: TITLES[1] });
  });

  test("choosing a new title opens the text box and sends what the panel typed", async ({ page }) => {
    const bodies = [];
    const dialog = await openDialog(page, bodies);
    await dialog.getByLabel(/^Verdict/).selectOption("Passed");
    await dialog.getByLabel(/^Title selected by the panel/).selectOption(NEW_TITLE);
    const typed = dialog.getByLabel(/^New title set by the panel/);
    await expect(typed).toBeVisible();
    await typed.fill("A title the panel wrote");
    await dialog.getByLabel(/^Why are you recording/).fill("The panel chair is away; signed result received.");
    await dialog.getByRole("button", { name: "Record for the panel" }).click();
    await expect(page.getByText("Spec: verdict recorded.")).toBeVisible();
    expect(bodies[0]).toMatchObject({ result: "Passed", selected_title: "A title the panel wrote" });
  });
});

test.describe("I-252: the Academic Coordinator enters the verified practicum hours", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });
  test.afterEach(async ({ page }) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.unrouteAll({ behavior: "ignoreErrors" }); });

  test("the student's hours are labelled as reported; the verified total needs a note when it differs", async ({ page }) => {
    const writes = [];
    await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const row = body.roster.find((item) => item.student.student_number === "2690201");
      row.record = {
        id: 9100, student_id: row.student.id, status: "Documents Under Review", moa_status: "Verified", moa_uploaded: true,
        practicum_site: "Community Counselling Center", supervisor_name: "Ms. Rina Lopez", required_hours: 200,
        completed_hours: 0, reported_hours: 120, verified_hours: null,
        document_status: "Pending Review", certificate_count: 1, remarks: "", completion_status: "Pending",
        coordinator_review_status: "Under Review", dean_report_status: "Not Sent", moa_attachment: null, certificate_attachment: null,
        completion_attachments: [], attachments: [], timeline: row.timeline, created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
      };
      row.hours_status = "Incomplete";
      row.documents_status = "Pending Review";
      row.has_submitted_documents = true;
      row.last_activity_at = "2026-10-20T08:00:00Z";
      row.next_action_owner = "Academic Coordinator";
      row.messages = [];
      row.history = [];
      await route.fulfill({ response, json: body });
    });
    await page.route("**/api/transactions/practicum", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      writes.push(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({ json: { ok: true, message: "Spec: hours verified." } });
    });
    await page.goto("/workflow/practicum");
    const card = page.getByRole("region", { name: "Practicum workflow board" }).getByRole("article").filter({ hasText: "Andrea Villanueva" });
    await expect(card).toContainText("120 hrs reported, not verified");
    await card.getByRole("button", { name: "View details for Andrea Villanueva" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Reported by the student:")).toBeVisible();
    const hours = dialog.getByLabel(/^Verified hours/);
    const save = dialog.getByRole("button", { name: "Save verified hours" });
    await expect(save, "nothing entered").toBeDisabled();
    await hours.fill("150");
    await expect(save, "differs from the 120 reported: a note is needed").toBeDisabled();
    await dialog.getByLabel(/^Note/).fill("The certificates add up to 150 hours.");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText("Spec: hours verified.")).toBeVisible();
    expect(writes[0]).toEqual({ student_id: expect.any(Number), status: "Record Verified Hours", verified_hours: "150", verified_note: "The certificates add up to 150 hours." });
  });
});
