// e2e-writes: none
// Night 5, items 1 and 2: the student's own next step is visible, and the Research Progress page does not contradict it.
// State under test, on top of the REAL portal response (page.route, no write reaches the database): Miguel Yu at Final Defense,
// panel in place, both final-defense files Verified, no defense booked.
//   - Home: "Needs your action" lists "Request your Final Defense date" and opens Defense Schedule (which shows its request form);
//   - Research Progress: "Submit Final Defense for review" is off with a reason, the schedule line points at Defense Schedule,
//     a Verified file has no remove button, the "Adviser and panel" card does not say "Assigned after Panel Matching";
//   - a file still only Submitted keeps its remove button, named after the file (confirmation: p42-student-forms).
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const EMAIL = "student@usls.edu.ph";
const STAGES = ["Title Defense", "Proposal Defense", "Final Defense", "Completed"].map((name, i) => ({ name, complete: i < 2 }));
const upload = (item_name, label, fileName, status) => ({
  item_name, label, description: "Spec upload", source_type: "student_upload", student_upload: true, required_file_count: 1,
  file_count: 1, status, status_label: status === "Complete" ? "Verified" : "Submitted for review",
  files: [{ id: item_name.length + 700, name: fileName, url: `/spec/${fileName}` }],
});

function atFinalDefense(data, { verified = true, panel = true } = {}) {
  const status = verified ? "Complete" : "Submitted";
  data.student.adviser_name = "Dr. Spec Adviser";
  data.research_case = { id: 1, title: "Spec Title", status: "Active", adviser_name: "Dr. Spec Adviser" };
  data.panel = panel ? [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }] : [];
  data.schedules = [];
  data.tasks = [];
  data.workflow_messages = [];
  data.research_progress = {
    gate: "Final Defense", stage: "Final Defense", stage_index: 2, status: "Pending", stages: STAGES,
    milestone: {
      value: "Final Defense", label: "Final Defense Readiness", short_label: "Final Defense", description: "Spec milestone.",
      student_uploads_ready: true, student_missing_count: 0, overall_complete: false,
      requirements: [
        upload("Form 4 - Endorsement for Final Defense", "Final defense endorsement", "endorsement-spec.pdf", status),
        upload("Final manuscript", "Final defense manuscript", "manuscript-spec.pdf", status),
        {
          item_name: "Agreed final defense schedule", label: "Confirmed final defense schedule", source_type: "system_final_schedule", student_upload: false,
          description: "Added automatically after staff confirms a shared final defense schedule.", status: "Pending", status_label: "Pending", files: [],
        },
      ],
    },
  };
}

async function open(browser, path, scenario) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), `sign in as ${EMAIL}`).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe(EMAIL);
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    scenario(data);
    await route.fulfill({ response, json: data });
  });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return { context, page };
}

test.describe("night 5: the student's next step", () => {
  test("home lists the defense date request and opens Defense Schedule, which shows its form", async ({ browser }) => {
    const { context, page } = await open(browser, "/student", (d) => atFinalDefense(d));
    try {
      const mine = page.locator("main section", { has: page.getByRole("heading", { name: "Needs your action", exact: true }) });
      await expect(mine.getByText("Nothing is waiting on you")).toHaveCount(0);
      await expect(mine.getByText("Request your Final Defense date")).toBeVisible();
      await mine.locator('a[href$="/student/defense-schedule"]').first().click();
      await expect(page).toHaveURL(/\/student\/defense-schedule$/);
      await expect(page.getByRole("button", { name: "Submit schedule request" })).toBeEnabled();
    } finally {
      await context.close();
    }
  });

  test("Research Progress: nothing left to submit, schedule line points at Defense Schedule, Verified files stay", async ({ browser }) => {
    const { context, page } = await open(browser, "/student/research", (d) => atFinalDefense(d));
    try {
      const main = page.locator("main");
      await expect(main.getByRole("button", { name: "Submit Final Defense for review" })).toBeDisabled();
      await expect(main).toContainText("Every file for this milestone is already verified. Nothing is left to submit.");
      await expect(main).not.toContainText("Added automatically after staff confirms");
      await expect(main.getByText(/Request your defense date on/)).toBeVisible();
      await expect(main.getByRole("link", { name: "Defense Schedule", exact: true }).first()).toHaveAttribute("href", "/student/defense-schedule");
      await expect(main.getByRole("button", { name: /^Remove / }), "a Verified file cannot be removed").toHaveCount(0);
      await expect(main, "adviser and panel are assigned").not.toContainText("Assigned after Panel Matching");
    } finally {
      await context.close();
    }
  });

  test("Research Progress: a file only Submitted keeps a named remove button; with no panel the card explains", async ({ browser }) => {
    const { context, page } = await open(browser, "/student/research", (d) => atFinalDefense(d, { verified: false, panel: false }));
    try {
      const main = page.locator("main");
      await expect(main.getByRole("button", { name: "Remove manuscript-spec.pdf" })).toBeVisible();
      await expect(main.getByRole("button", { name: "Submit Final Defense for review" })).toBeEnabled();
      await expect(main).toContainText("Assigned after Panel Matching");
      await expect(main, "no panel: the schedule line keeps the staff wording").toContainText("Added automatically after staff confirms");
    } finally {
      await context.close();
    }
  });
});
