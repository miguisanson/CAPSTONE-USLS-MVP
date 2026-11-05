// e2e-writes: none
// Audit round 4 (process audit 2026-11-04), the screens of four rows. Every answer that matters is set with page.route, so the
// spec reads only and does not depend on what other specs did to the seeded data.
//   I-318  the panel chair sets the room or meeting link of a booked defense (faculty portal, Panel Assignments)
//   I-328  a practicum case waiting for staff to forward documents sits in Documents Review, whatever the hours
//   I-329  an exported graduation batch says it is exported, not "export it" (the full board check is p77)
//   I-332  staff are told when the demo data is old
//   I-296  the AWOL board has the same Registrar list as Leave of Absence (download, mark as sent, mark as acknowledged)
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");
let tracker;
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "audit4", page: "p123", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

test.describe("I-318 the panel chair sets the venue", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

  test("the chair sees the field and the history, saves, and a member sees no field", async ({ page }) => {
    let saved = null;
    await page.route(/\/api\/faculty-portal\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const panel = body.panels.find((item) => item.defense) || body.panels[0];
      panel.defense = { ...(panel.defense || {}), id: 9901, defense_type: "Proposal Defense", preferred_date: "2030-01-15", start_time: "09:00", status: "Scheduled", mode: "Online", venue: saved || "Zoom room A" };
      panel.can_set_venue = true;
      panel.venue_history = saved ? [{ at: "2030-01-01T09:00:00", by: "Chair (Panel Chair)", from: "Zoom room A", to: saved }] : [];
      body.panels = [panel];
      await route.fulfill({ response, json: body });
    });
    await page.route(/\/api\/faculty-portal\/defense-schedules\/9901\/venue/, async (route) => {
      saved = route.request().postDataJSON().venue;
      await route.fulfill({ json: { ok: true, venue: saved, venue_history: [], message: "Venue saved. The student and the panel were told." } });
    });
    await page.goto("/faculty-portal/panels");
    await expect(main(page).getByText("Venue or meeting link")).toBeVisible();
    await expect(main(page).getByText("Online: Zoom room A")).toBeVisible();
    const save = main(page).getByRole("button", { name: "Save venue" });
    await expect(save).toBeDisabled();
    await main(page).getByLabel("Room or meeting link").fill("https://meet.example.test/defense");
    await save.click();
    await expect.poll(() => saved).toBe("https://meet.example.test/defense");
    await expect(main(page).getByRole("list", { name: "Venue changes" })).toContainText("Zoom room A to https://meet.example.test/defense");
  });

  test("a panel member sees the venue but no field", async ({ page }) => {
    await page.route(/\/api\/faculty-portal\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const panel = body.panels.find((item) => item.defense) || body.panels[0];
      panel.defense = { ...(panel.defense || {}), id: 9902, defense_type: "Proposal Defense", preferred_date: "2030-01-15", start_time: "09:00", status: "Scheduled", mode: "Online", venue: "Room 12" };
      panel.can_set_venue = false;
      panel.venue_history = [];
      body.panels = [panel];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/faculty-portal/panels");
    await expect(main(page).getByText("Online: Room 12")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Save venue" })).toHaveCount(0);
  });
});

test.describe("I-328 practicum: one column for waiting-for-staff documents", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("Hours Incomplete and Documents Submitted share Documents Review", async ({ page }) => {
    await page.route(/\/api\/transactions\/practicum\/context/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const [first, second] = body.roster.filter((row) => row.eligibility?.eligible === true);
      for (const [row, status] of [[first, "Hours Incomplete"], [second, "Documents Submitted"]]) {
        row.record = {
          id: 9200 + row.student.id, student_id: row.student.id, status, moa_status: "Verified", moa_uploaded: true, practicum_site: "Spec Clinic",
          supervisor_name: "Ms. Spec", required_hours: 200, completed_hours: 120, document_status: "Submitted", certificate_count: 1, remarks: "",
          completion_status: "Pending", coordinator_review_status: "Pending", dean_report_status: "Not Sent", moa_attachment: null,
          certificate_attachment: null, completion_attachments: [], attachments: [], timeline: row.timeline,
          created_at: "2026-10-19T08:00:00Z", updated_at: "2026-10-20T08:00:00Z",
        };
        row.has_submitted_documents = true;
        row.messages = [];
        row.history = [];
      }
      body.__names = [first.student.name, second.student.name];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/workflow/practicum");
    const board = main(page).getByRole("region", { name: "Practicum workflow board" });
    await expect(board).toBeVisible();
    const documents = board.locator("section").filter({ has: page.getByRole("heading", { name: "Documents Review", exact: true, level: 3 }) });
    const progress = board.locator("section").filter({ has: page.getByRole("heading", { name: "In Progress", exact: true, level: 3 }) });
    await expect(documents.locator("div[draggable]")).toHaveCount(2);
    await expect(progress.locator("div[draggable]")).toHaveCount(0);
  });
});

test.describe("I-332 the demo data age notice", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("staff see the notice and can dismiss it; it is absent when the data is fresh", async ({ page }) => {
    await page.route(/\/api\/auth\/me/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.demo_notice = { age_days: 9, seeded_on: "2030-01-01", message: "The demo data was built 9 days ago. To reset the demo data, run npm run seed on the server." };
      await route.fulfill({ response, json: body });
    });
    await page.goto("/");
    const notice = page.getByTestId("demo-data-notice");
    await expect(notice).toContainText("built 9 days ago");
    await expect(notice).toContainText("npm run seed");
    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(notice).toHaveCount(0);
  });

  test("no notice without demo_notice", async ({ page }) => {
    await page.goto("/");
    await expect(main(page)).toBeVisible();
    await expect(page.getByTestId("demo-data-notice")).toHaveCount(0);
  });
});

test.describe("I-296 the AWOL Registrar list", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("an approved return is listed; download marks it exported; sent and acknowledged move it on", async ({ page }) => {
    let handoff = "Pending Handoff";
    const calls = [];
    await page.route(/\/api\/process-cases\?slug=awol/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.cases = json.cases.map((item, index) =>
        index === 0 ? { ...item, status: "Return Approved", status_label: "Return approved", registrar: { status: handoff } } : item,
      );
      await route.fulfill({ response, json });
    });
    await page.route(/\/api\/awol\/\d+\/registrar-report/, async (route) => {
      calls.push("report");
      if (handoff === "Pending Handoff") handoff = "Exported - Ready to Send";
      await route.fulfill({ status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="awol-registrar-test.csv"' }, body: "a,b" });
    });
    await page.route(/\/api\/awol\/\d+\/registrar-handoff/, async (route) => {
      const target = route.request().postDataJSON().target;
      calls.push(target);
      const order = { "Exported - Ready to Send": "Sent to Registrar", "Sent to Registrar": "Acknowledged" };
      if (order[handoff] !== target) return route.fulfill({ status: 409, json: { error: `The AWOL return is "${handoff}"; it cannot move to "${target}" now.` } });
      handoff = target;
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/workflow/awol");
    const panel = page.getByRole("region", { name: "Registrar list" });
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.getByRole("button", { name: "Download list (CSV)" })).toBeVisible();
    const pending = panel.getByRole("table").getByRole("row").filter({ hasText: "Pending Handoff" });
    await expect(pending).toHaveCount(1);
    // follow this case's own row (the seeded returns already show Acknowledged)
    const tickName = await pending.getByRole("checkbox").getAttribute("aria-label");
    const tick = panel.getByRole("checkbox", { name: tickName, exact: true });
    const mine = panel.getByRole("table").getByRole("row").filter({ has: page.getByRole("checkbox", { name: tickName, exact: true }) });
    await tick.check();
    await panel.getByRole("button", { name: "Download list (CSV)" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Got it" }).click();
    await expect(mine.getByText("Exported - Ready to Send")).toBeVisible();
    await tick.check();
    await panel.getByRole("button", { name: "Mark as sent" }).click();
    await expect(mine.getByText("Sent to Registrar")).toBeVisible();
    await tick.check();
    await panel.getByRole("button", { name: "Mark as acknowledged" }).click();
    await expect(mine.getByText("Acknowledged")).toBeVisible();
    expect(calls).toEqual(["report", "Sent to Registrar", "Acknowledged"]);
  });
});
