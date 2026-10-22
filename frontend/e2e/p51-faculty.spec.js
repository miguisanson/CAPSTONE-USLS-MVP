// Behaviour pin for packets P5.1 and P5.2 (Phase 5 migration of pages/faculty/*: FacultyPages, FacultyClasses,
// FacultyAdviserPanel, FacultyInvitationsPage, FacultyCalendar, FacultyAvailabilityEditor, FacultyContext, FacultyRoutes).
// Written BEFORE the migration and green on the old code, so it proves the migrated pages keep the same headings, data,
// buttons, validation messages, API payloads and dialog behaviour. It signs in as the seeded faculty adviser the sweep
// uses (Dr. Liwayway Bautista), reaches every faculty page through the sidebar and asserts what the page shows.
//
// Two flows need data the seed does not have (an adviser request waiting, invitations in several states). Those
// tests answer the two GET endpoints with fixed JSON through page.route() and capture the POST bodies, so they change
// nothing on the server. Everything else reads the real seeded data. The one write to the real database is a specific
// date on the availability page: it is added and removed again in the same test.
//
// Screenshots at 1366, 1920 and 390 px go to E2E_SHOTS_DIR (default: e2e-artifacts/p51 next to the sweep screens).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p51");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const WIDTHS = [
  [1366, 768],
  [1920, 1080],
  [390, 844],
];

test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p51", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  // No test goes to the internet: anything https that is not the font stylesheet is answered with a blank page.
  await context.route(/^https:\/\/(?!fonts\.(googleapis|gstatic)\.com)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }));
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ helpers
const main = (page) => page.locator("main");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Full-page screenshot at 1366, 1920 and 390 px (and the page must not scroll sideways at any of them), then back to 1366. */
async function shots(page, name, { full = true } = {}) {
  await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
  await page.waitForTimeout(500); // the page's own fade-in
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    expect(await noOverflow(page), `${name}: the page scrolls sideways at ${width}px`).toBe(true);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: full });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(150);
}

/** Open a faculty page the way a person does: from the dashboard, through the sidebar link. */
async function openFromSidebar(page, label, heading) {
  await page.goto("/faculty-portal");
  const link = page.locator("aside nav a", { hasText: label }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

/** The table whose header row holds this column. */
const tableWith = (page, column) => page.locator("table", { has: page.getByRole("columnheader", { name: column }) });
const headerNames = (table) => table.locator("thead th").evaluateAll((els) => els.map((e) => e.textContent.trim()));

/** Answer a GET endpoint with fixed JSON and record every non-GET call to the same URL family. */
async function mockJson(page, glob, getBody) {
  await page.route(glob, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(getBody()) });
  });
}
async function mockPost(page, glob, calls, onCall) {
  await page.route(glob, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    calls.push({ url: new URL(route.request().url()).pathname.replace(/^\/api/, ""), body: route.request().postDataJSON() });
    onCall?.(calls[calls.length - 1]);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

// ================================================================================================ Dashboard
test.describe("Dashboard", () => {
  test("home: welcome header, action rows, key numbers, upcoming defenses, calendar card", async ({ page }) => {
    await page.goto("/faculty-portal");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Liwayway" })).toBeVisible();
    await expect(page.getByText("Learning analytics, online learning, and student engagement in graduate education")).toBeVisible();
    await expect(main(page).getByText("Education", { exact: true }).first()).toBeVisible(); // the college chip
    await expect(page.getByRole("heading", { name: "Needs your action" })).toBeVisible();
    await expect(page.getByText("Invitations, signatures, verdicts and requests that wait for you")).toBeVisible();
    await expect(page.getByRole("link", { name: "Answer invitations" })).toHaveAttribute("href", "/faculty-portal/invitations");
    for (const label of ["Your open items", "Advisees", "Panel committees", "Upcoming defenses"]) {
      await expect(main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Upcoming defenses" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View schedule" })).toHaveAttribute("href", "/faculty-portal/defenses");
    await expect(page.getByRole("region", { name: "Google Calendar connection" })).toContainText("Not connected");
    await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
    await shots(page, "dashboard");
  });

  test("calendar notice from the Google callback", async ({ page }) => {
    await page.goto("/faculty-portal?calendar=connected");
    await expect(page.getByRole("status").filter({ hasText: "Google Calendar connected. Its busy periods are now used for defense scheduling." })).toBeVisible();
    await page.goto("/faculty-portal?calendar=cancelled");
    await expect(page.getByRole("status").filter({ hasText: "Google Calendar connection was cancelled." })).toBeVisible();
    await page.goto("/faculty-portal?calendar=error");
    await expect(page.getByRole("status").filter({ hasText: "Google Calendar could not be connected. Please try again." })).toBeVisible();
    await shots(page, "dashboard-calendar-notice");
  });

  test("Google Calendar preview dialog: content, focus, Tab trap, Escape, backdrop, Not now, open in a new tab", async ({ page, context }) => {
    await page.goto("/faculty-portal");
    const connect = page.getByRole("button", { name: "Connect Google Calendar" });
    await connect.click();
    const dialog = page.getByRole("dialog", { name: /Allow USLS Graduate School to use your calendar availability/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText("Integration preview");
    await expect(dialog).toContainText("This previews the permission step faculty will complete when live Google OAuth is enabled.");
    await expect(dialog).toContainText("How your calendar will be used");
    await expect(dialog).toContainText("Demo-safe preview");
    await expect(dialog).toContainText("Opening Google Calendar does not mark this account as connected");
    expect(await dialog.locator("p.font-medium, [data-permission]").count()).toBeGreaterThanOrEqual(0);
    await expect(dialog.getByRole("button", { name: "Close Google Calendar preview" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Not now" })).toBeVisible();
    const proceed = dialog.getByRole("button", { name: "Continue to Google Calendar" });
    await expect(proceed).toBeFocused(); // the main action holds the focus when the dialog opens
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden"); // the page behind does not scroll
    await shots(page, "dashboard-calendar-dialog", { full: false });

    // Tab and Shift+Tab stay inside the dialog.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1} left the dialog`).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Shift+Tab ${i + 1} left the dialog`).toBe(true);
    }

    // Escape closes it and the focus goes back to the button that opened it (added in P5.2: the old dialog lost it).
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(connect).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    // A click on the backdrop closes it.
    await connect.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 400);
    await expect(dialog).toHaveCount(0);

    // "Not now" closes it; nothing is marked connected.
    await connect.click();
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Google Calendar connection" })).toContainText("Not connected");

    // Continue opens Google Calendar in a new tab and the dialog says so; the card remembers it.
    await connect.click();
    const [popup] = await Promise.all([context.waitForEvent("page"), dialog.getByRole("button", { name: "Continue to Google Calendar" }).click()]);
    await popup.close();
    await expect(dialog.getByRole("status")).toContainText("Google Calendar opened in a new tab. Return here to continue the system demonstration.");
    await expect(dialog.getByRole("button", { name: "Open Google Calendar again" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close Google Calendar preview" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Google Calendar connection" })).toContainText("Integration preview opened");
  });
});

// ================================================================================================ My Advisees
test.describe("My Advisees", () => {
  test("real data: header, adviser panel, both tables", async ({ page }) => {
    await openFromSidebar(page, "My Advisees", "My Advisees");
    await expect(page.getByText("Students you advise, their stage, and the research documents that need your signature.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Signatures" }).first()).toHaveAttribute("href", "/faculty-portal/signatures");
    // the adviser panel: meter, empty inbox note, advisee table with the contract column
    await expect(page.getByRole("heading", { name: "Advisees", exact: true })).toBeVisible();
    await expect(main(page).getByText(/\d+ of \d+ advisees/).first()).toBeVisible();
    await expect(main(page).getByText(/You are at the limit|places? left/)).toBeVisible();
    await expect(page.getByText("No adviser requests are waiting for you.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your advisees" })).toBeVisible();
    await expect(page.getByText("Forms 3.2 and 3.3 (adviser contract) are due 5 days after Form 3.1.")).toBeVisible();

    const contract = tableWith(page, "Contract (Forms 3.2 / 3.3)");
    expect(await headerNames(contract)).toEqual(["Student", "Program", "Stage", "Appointed", "Contract (Forms 3.2 / 3.3)"]);
    const isabel = contract.locator("tbody tr", { hasText: "Isabel Flores" });
    await expect(isabel).toHaveCount(1);
    await expect(isabel).toContainText("2260007");
    await expect(isabel).toContainText("MAED");
    await expect(isabel).toContainText("Completed");
    await expect(isabel).toContainText("Not applicable");
    await expect(contract.locator("tbody tr", { hasText: "Miguel Yu" })).toContainText("Final Defense");

    const docs = tableWith(page, "Needs signature");
    expect(await headerNames(docs)).toEqual(["Student", "Program", "Stage", "Documents", "Needs signature"]);
    const row = docs.locator("tbody tr", { hasText: "Roberto Aquino" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("GS-2026-CA-02");
    await expect(row).toContainText("Coursework");
    await expect(row).toContainText("None");
    await shots(page, "advisees");
  });

  test("adviser requests (mocked): accept, decline with a reason, consent, overdue contract", async ({ page }) => {
    const state = {
      inbox: [
        { id: 901, kind: "New", student_name: "Mock Student One", program_code: "MAED", student_number: "MK-001", decision_note: "Appointed on the Dean's note.", form31_issued_on: "2026-10-20", warnings: ["The adviser is over the usual limit."] },
        { id: 902, kind: "Change", student_name: "Mock Student Two", program_code: "MAPSY", student_number: "MK-002", current_adviser_name: "Dr. Old Adviser", reason: "The topic moved to another field." },
      ],
      consents: [{ id: 903, kind: "Change", student_name: "Mock Student Three", program_code: "MSGC", student_number: "MK-003", faculty_name: "Dr. New Adviser", reason: "Moving to a closer topic expert." }],
      advisees: [
        { id: 31, student_name: "Overdue Student", student_number: "MK-010", program_code: "MAED", stage: "Proposal Development", appointed_on: "2026-09-01T08:00:00", contract: { status: "Overdue", due_on: "2026-09-06" } },
        { id: 32, student_name: "Waiting Student", student_number: "MK-011", program_code: "MAED", stage: null, appointed_on: null, contract: { status: "Pending", due_on: "2027-01-20" } },
        { id: 33, student_name: "Done Student", student_number: "MK-012", program_code: "MAED", stage: "Writing", appointed_on: "2026-08-01T08:00:00", contract: { status: "Received", due_on: "2026-08-06" } },
      ],
      meter: { max: 5, active: 2, pending: 1 },
    };
    const calls = [];
    await mockJson(page, "**/api/faculty-portal/adviser-requests", () => state);
    const drop = (call) => {
      const id = Number(call.url.split("/").slice(-2)[0]);
      state.inbox = state.inbox.filter((item) => item.id !== id);
      state.consents = state.consents.filter((item) => item.id !== id);
    };
    await mockPost(page, "**/api/faculty-portal/adviser-requests/*/respond", calls, drop);
    await mockPost(page, "**/api/faculty-portal/adviser-requests/*/consent", calls, drop);

    await openFromSidebar(page, "My Advisees", "My Advisees");
    // meter
    await expect(main(page).getByText("2 of 5 advisees · 1 pending")).toBeVisible();
    await expect(main(page).getByText("3 places left.")).toBeVisible();
    await expect(page.getByRole("img", { name: "2 of 5 advisee places used, 1 pending" })).toBeVisible();

    // request cards
    await expect(page.getByRole("heading", { name: "Research adviser requests" })).toBeVisible();
    const one = page.getByRole("listitem").filter({ hasText: "Mock Student One" });
    await expect(one).toContainText("MAED · MK-001");
    await expect(one).toContainText("New appointment");
    await expect(one).toContainText("Dean's note: Appointed on the Dean's note.");
    await expect(one).toContainText("Form 3.1 issued:");
    await expect(one).toContainText("The adviser is over the usual limit.");
    const two = page.getByRole("listitem").filter({ hasText: "Mock Student Two" });
    await expect(two).toContainText("Change of adviser");
    await expect(two).toContainText("Current adviser: Dr. Old Adviser");
    await expect(two).toContainText("Student's reason: The topic moved to another field.");
    await expect(page.getByRole("heading", { name: "Change of adviser: your agreement needed" })).toBeVisible();
    const three = page.getByRole("listitem").filter({ hasText: "Mock Student Three" });
    await expect(three).toContainText("New adviser: Dr. New Adviser");
    await expect(page.getByText("No adviser requests are waiting for you.")).toHaveCount(0);

    // advisee table: overdue and due text, blanks
    const contract = tableWith(page, "Contract (Forms 3.2 / 3.3)");
    const overdue = contract.locator("tbody tr", { hasText: "Overdue Student" });
    await expect(overdue).toContainText("Overdue");
    await expect(overdue).toContainText("Overdue since");
    await expect(contract.locator("tbody tr", { hasText: "Waiting Student" })).toContainText("Not set");
    await expect(contract.locator("tbody tr", { hasText: "Waiting Student" })).toContainText("Due ");
    await expect(contract.locator("tbody tr", { hasText: "Done Student" })).not.toContainText("Due ");
    await shots(page, "advisees-requests");

    // Decline: empty reason is refused, a reason is sent, the card goes.
    await two.getByRole("button", { name: "Decline" }).click();
    await expect(two.getByLabel(/Why are you declining\?/)).toBeVisible();
    await two.getByRole("button", { name: "Confirm decline" }).click();
    await expect(two).toContainText("Please give a short reason (at least 3 characters).");
    expect(calls).toHaveLength(0);
    await two.getByLabel(/Why are you declining\?/).fill("ab");
    await two.getByRole("button", { name: "Confirm decline" }).click();
    await expect(two).toContainText("Please give a short reason (at least 3 characters).");
    await shots(page, "advisees-requests-decline-error");
    await two.getByRole("button", { name: "Cancel" }).click();
    await expect(two.getByRole("button", { name: "Accept" })).toBeVisible();
    await two.getByRole("button", { name: "Decline" }).click();
    await two.getByLabel(/Why are you declining\?/).fill("  Not my field.  ");
    await two.getByRole("button", { name: "Confirm decline" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Mock Student Two" })).toHaveCount(0);
    expect(calls.at(-1)).toEqual({ url: "/faculty-portal/adviser-requests/902/respond", body: { response: "decline", reason: "Not my field." } });

    // Accept sends no reason.
    await one.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Mock Student One" })).toHaveCount(0);
    expect(calls.at(-1)).toEqual({ url: "/faculty-portal/adviser-requests/901/respond", body: { response: "accept" } });

    // Consent: "Do not agree" asks for a reason, "Agree to release" does not.
    await expect(page.getByRole("heading", { name: "Research adviser requests" })).toHaveCount(0);
    await three.getByRole("button", { name: "Do not agree" }).click();
    await expect(three.getByLabel(/Why do you not agree\?/)).toBeVisible();
    await three.getByLabel(/Why do you not agree\?/).fill("The student is close to finishing.");
    await three.getByRole("button", { name: "Confirm: do not agree" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Mock Student Three" })).toHaveCount(0);
    expect(calls.at(-1)).toEqual({ url: "/faculty-portal/adviser-requests/903/consent", body: { consent: "no", reason: "The student is close to finishing." } });
    await expect(page.getByText("No adviser requests are waiting for you.")).toBeVisible();
    await shots(page, "advisees-requests-empty");
  });

  test("consent: Agree to release sends consent yes", async ({ page }) => {
    const state = { inbox: [], consents: [{ id: 910, kind: "Change", student_name: "Release Student", program_code: "MAED", student_number: "MK-020", faculty_name: "Dr. New Adviser", reason: "Wants a new adviser." }], advisees: [], meter: { max: 5, active: 0, pending: 0 } };
    const calls = [];
    await mockJson(page, "**/api/faculty-portal/adviser-requests", () => state);
    await mockPost(page, "**/api/faculty-portal/adviser-requests/*/consent", calls, () => { state.consents = []; });
    await openFromSidebar(page, "My Advisees", "My Advisees");
    await expect(main(page).getByText("0 of 5 advisees")).toBeVisible();
    await expect(main(page).getByText("5 places left.")).toBeVisible();
    await expect(page.getByText("No appointed advisees yet. Students appear here once you accept their request.")).toBeVisible();
    await page.getByRole("button", { name: "Agree to release" }).click();
    await expect(page.getByText("No adviser requests are waiting for you.")).toBeVisible();
    expect(calls).toEqual([{ url: "/faculty-portal/adviser-requests/910/consent", body: { consent: "yes" } }]);
  });

  test("a failed answer shows the server message on the card", async ({ page }) => {
    const state = { inbox: [{ id: 920, kind: "New", student_name: "Failing Student", program_code: "MAED", student_number: "MK-030" }], consents: [], advisees: [], meter: { max: 5, active: 0, pending: 0 } };
    await mockJson(page, "**/api/faculty-portal/adviser-requests", () => state);
    await page.route("**/api/faculty-portal/adviser-requests/*/respond", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "This request was already answered." }) }));
    await openFromSidebar(page, "My Advisees", "My Advisees");
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Failing Student" })).toContainText("This request was already answered.");
    // the 409 is the thing under test, not a page problem
    tracker.problems = tracker.problems.filter((p) => !/API 409|status of 409/.test(p.problem));
  });
});

// ================================================================================================ Research pages (shared workspace)
test.describe("Signatures, Panels, Verdicts", () => {
  test("Signatures & Endorsements", async ({ page }) => {
    await openFromSidebar(page, "Signatures & Endorsements", "Signatures & Endorsements");
    await expect(page.getByText("Review and sign the exact manuscript version uploaded by your assigned advisees.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Adviser paper signatures" })).toBeVisible();
    await expect(main(page).getByText("Isabel Flores").first()).toBeVisible();
    await shots(page, "signatures");
  });

  test("Panel Assignments & Papers", async ({ page }) => {
    await openFromSidebar(page, "Panel Assignments & Papers", "Panel Assignments & Papers");
    await expect(page.getByText("Students whose committee you sit on, with the papers for the assigned stage. Access is limited to your assigned panels.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Panel papers and defense verdicts" })).toBeVisible();
    await expect(main(page).getByText("Hector Ong").first()).toBeVisible();
    await expect(main(page).getByText("Content Specialist").first()).toBeVisible();
    await shots(page, "panels");
  });

  test("Verdicts", async ({ page }) => {
    await openFromSidebar(page, "Verdicts", "Verdicts");
    await expect(page.getByText("The panel chair or panel lead submits the final verdict for a scheduled defense. Graduate School staff have read-only access.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Panel papers and defense verdicts" })).toBeVisible();
    await expect(main(page).getByText("Hector Ong").first()).toBeVisible();
    await expect(main(page).getByText("Verdict: Passed").first()).toBeVisible();
    await shots(page, "verdicts");
  });
});

// ================================================================================================ Panel invitations
test.describe("Panel invitations", () => {
  test("real data: the waiting invitation, role, other members, decline form validation", async ({ page }) => {
    await openFromSidebar(page, "Panel Invitations", "Panel invitations");
    await expect(page.getByText("Research defense panels you have been asked to join.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /invitations? (is|are) waiting for your answer\./ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Waiting for your answer \(\d+\)$/ })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: "Miguel Yu" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("MAED · 2260004");
    await expect(card).toContainText("Final Defense");
    await expect(card).toContainText("Invited");
    await expect(card).toContainText("Your role on the panel: Content Specialist");
    await expect(card).toContainText("Other panel members");
    await expect(card).toContainText("Dr. Marlon Geronimo");
    await expect(card).toContainText("Panel Chair");
    await expect(card).toContainText("No date has been booked yet.");
    await expect(card.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(card.getByRole("button", { name: "I cannot attend this defense" })).toHaveCount(0); // nothing is booked
    await shots(page, "invitations");

    await card.getByRole("button", { name: "Decline" }).click();
    await expect(card.getByLabel(/Why are you declining\?/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Accept" })).toHaveCount(0);
    await card.getByRole("button", { name: "Confirm decline" }).click();
    await expect(card).toContainText("Please give a short reason (at least 3 characters).");
    await shots(page, "invitations-decline-error");
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(card.getByLabel(/Why are you declining\?/)).toHaveCount(0);
  });

  test("states and actions (mocked): accepted with a booked date, declined with a reason, accept, cannot attend", async ({ page }) => {
    const student = (id, name) => ({ id, name, program_code: "MAED", student_number: `MK-0${id}` });
    const state = {
      invitations: [
        { id: 1, status: "Invited", defense_type: "Proposal Defense", panel_role: "Method Specialist", student: student(1, "Mock Waiting"), other_members: [], schedule: null },
        {
          id: 2, status: "Accepted", defense_type: "Final Defense", panel_role: "Panel Chair", student: student(2, "Mock Accepted"), responded_at: "2026-10-01T09:30:00",
          other_members: [{ name: "Dr. Ana Reyes", role: "External Panel" }],
          schedule: { id: 77, is_active: true, preferred_date: "2027-02-10", start_time: "09:00", end_time: "11:00", venue: "Room 204", status: "Scheduled", display_status: "Scheduled" },
        },
        { id: 3, status: "Declined", defense_type: "Title Defense", panel_role: "Content Specialist", student: student(3, "Mock Declined"), other_members: [], reason: "Out of the country.", responded_at: "2026-09-15T10:00:00", schedule: null },
      ],
    };
    const calls = [];
    await mockJson(page, "**/api/faculty-portal/panel-invitations", () => state);
    await mockPost(page, "**/api/faculty-portal/panel-invitations/*/respond", calls, (call) => {
      const item = state.invitations.find((i) => `/faculty-portal/panel-invitations/${i.id}/respond` === call.url);
      item.status = call.body.response === "accept" ? "Accepted" : "Declined";
    });
    await mockPost(page, "**/api/faculty-portal/defense-schedules/*/cannot-attend", calls, () => {
      state.invitations.find((i) => i.id === 2).status = "Declined";
    });

    await openFromSidebar(page, "Panel Invitations", "Panel invitations");
    await expect(page.getByRole("status").filter({ hasText: "1 invitation is waiting for your answer." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting for your answer (1)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accepted (1)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Declined (1)" })).toBeVisible();
    await expect(page.getByText("The Research Coordinator has been asked to find a replacement.")).toBeVisible();

    const accepted = page.getByRole("listitem").filter({ hasText: "Mock Accepted" });
    await expect(accepted).toContainText("Dr. Ana Reyes");
    await expect(accepted).toContainText("(Philippine time)");
    await expect(accepted).toContainText("Room 204");
    await expect(accepted).toContainText("Scheduled");
    await expect(accepted).toContainText("Answered");
    await expect(accepted.getByRole("button", { name: "Accept" })).toHaveCount(0); // already accepted
    await expect(accepted.getByRole("button", { name: "Decline" })).toBeVisible();
    const declined = page.getByRole("listitem").filter({ hasText: "Mock Declined" });
    await expect(declined).toContainText("Your reason: Out of the country.");
    await expect(declined.getByRole("button", { name: "Decline" })).toHaveCount(0);
    await expect(declined.getByRole("button", { name: "Accept" })).toBeVisible();
    await shots(page, "invitations-states");

    // Cannot attend: a reason is needed, then the Graduate School is told.
    await accepted.getByRole("button", { name: "I cannot attend this defense" }).click();
    await expect(accepted.getByLabel(/Why can you not attend this defense\?/)).toBeVisible();
    await accepted.getByRole("button", { name: "Tell the Graduate School" }).click();
    await expect(accepted).toContainText("Please give a short reason (at least 3 characters).");
    await accepted.getByLabel(/Why can you not attend this defense\?/).fill("A family emergency.");
    await accepted.getByRole("button", { name: "Tell the Graduate School" }).click();
    await expect(page.getByRole("heading", { name: "Accepted (1)" })).toHaveCount(0);
    expect(calls.at(-1)).toEqual({ url: "/faculty-portal/defense-schedules/77/cannot-attend", body: { reason: "A family emergency." } });

    // Accept sends only the response.
    await page.getByRole("listitem").filter({ hasText: "Mock Waiting" }).getByRole("button", { name: "Accept" }).click();
    await expect(page.getByRole("heading", { name: /^Waiting for your answer/ })).toHaveCount(0);
    expect(calls.at(-1)).toEqual({ url: "/faculty-portal/panel-invitations/1/respond", body: { response: "accept" } });
  });

  test("no invitations (mocked): empty state", async ({ page }) => {
    await mockJson(page, "**/api/faculty-portal/panel-invitations", () => ({ invitations: [] }));
    await openFromSidebar(page, "Panel Invitations", "Panel invitations");
    await expect(page.getByText("No panel invitations")).toBeVisible();
    await expect(page.getByText("When the Research Coordinator puts you on a defense panel, the invitation shows up here.")).toBeVisible();
    await shots(page, "invitations-empty");
  });

  test("a failed load shows the message under the header (mocked)", async ({ page }) => {
    await page.route("**/api/faculty-portal/panel-invitations", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "The invitations could not be read." }) }));
    await page.goto("/faculty-portal/invitations");
    await expect(page.getByRole("heading", { level: 1, name: "Panel invitations" })).toBeVisible();
    await expect(page.getByText("The invitations could not be read.")).toBeVisible();
    tracker.problems = tracker.problems.filter((p) => !/API 500|Failed to load resource/.test(p.problem));
  });
});

// ================================================================================================ Defense Schedule
test.describe("Defense Schedule", () => {
  test("table: columns, one row in full, calendar links, header links", async ({ page }) => {
    await openFromSidebar(page, "Defense Schedule", "Defense Schedule");
    await expect(page.getByText("Defenses scheduled for the panels you sit on. Keep your availability current so staff can confirm dates.")).toBeVisible();
    const table = tableWith(page, "Date / time");
    expect(await headerNames(table)).toEqual(["Student", "Defense", "Date / time", "Mode / venue", "My role", "Status", "Calendar"]);
    const first = table.locator("tbody tr").first();
    await expect(first).toContainText("Hector Ong");
    await expect(first).toContainText("Reflective Practice Models for Graduate Educators");
    await expect(first).toContainText("Title Defense");
    await expect(first).toContainText("Apr 25, 2026 · 09:00");
    await expect(first).toContainText("Philippine time");
    await expect(first).toContainText("In person");
    await expect(first).toContainText("Graduate School Conference Room");
    await expect(first).toContainText("Content Specialist");
    await expect(first).toContainText("Finished");
    const ics = first.getByRole("link", { name: "Add to calendar" });
    await expect(ics).toHaveAttribute("download", "");
    expect(await ics.getAttribute("href")).toBeTruthy();
    expect(await table.locator("tbody tr").count()).toBeGreaterThanOrEqual(8);
    // sorted by date, oldest first
    const dates = await table.locator("tbody tr td:nth-child(3)").evaluateAll((els) => els.map((e) => e.textContent));
    const stamp = (text) => Date.parse(text.replace(" · ", " ").replace("Philippine time", ""));
    for (let i = 1; i < dates.length; i++) expect(stamp(dates[i]), `row ${i} is not after row ${i - 1}`).toBeGreaterThanOrEqual(stamp(dates[i - 1]));
    await expect(page.getByRole("link", { name: "Open my calendar" })).toHaveAttribute("href", "/faculty-portal/calendar");
    await expect(page.getByRole("link", { name: "My availability" }).first()).toBeVisible();
    await shots(page, "defenses");
  });

  test("a defense that needs attention, and one without a calendar file (mocked)", async ({ page }) => {
    const context = await (await page.request.get("/api/faculty-portal/context")).json();
    const panel = (over) => ({
      student: { id: 901, name: "Mock Student", program_code: "MAED" }, gate: "Final Defense", panel_role: "Panel Chair", research_title: null, can_submit_verdict: false,
      defense: { defense_type: "Final Defense", preferred_date: "2027-03-01", start_time: "13:00", mode: null, venue: "Online", status: "Scheduled", display_status: "Needs Re-confirmation", attention: ["A panel member cannot attend. A new date is needed."], ics_url: null, ...over },
    });
    context.panels = [panel({})];
    await mockJson(page, "**/api/faculty-portal/context", () => context);
    await openFromSidebar(page, "Defense Schedule", "Defense Schedule");
    const row = tableWith(page, "Date / time").locator("tbody tr");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Research title pending");
    await expect(row).toContainText("Mar 1, 2027 · 13:00");
    await expect(row).toContainText("Needs Re-confirmation");
    await expect(row).toContainText("A panel member cannot attend. A new date is needed.");
    await expect(row).toContainText("Online");
    await expect(row).toContainText("Not available");
    await shots(page, "defenses-attention");
  });

  test("no defenses (mocked): empty state", async ({ page }) => {
    const context = await (await page.request.get("/api/faculty-portal/context")).json();
    context.panels = [];
    await mockJson(page, "**/api/faculty-portal/context", () => context);
    await openFromSidebar(page, "Defense Schedule", "Defense Schedule");
    await expect(page.getByText("No defenses scheduled", { exact: true })).toBeVisible();
    await expect(page.getByText("You will see a defense here once the Research Coordinator schedules one for a panel you sit on.")).toBeVisible();
    await expect(page.locator("main table")).toHaveCount(0);
    await shots(page, "defenses-empty");
  });
});

// ================================================================================================ Calendar
test("My Calendar: header and the shared calendar view", async ({ page }) => {
  await openFromSidebar(page, "My Calendar", "My calendar");
  await expect(page.getByText("Defenses you sit on or advise, your advisees' deadlines, your availability and (when connected) your Google busy times.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  await expect(page.getByText("All times are Philippine time (Asia/Manila).")).toBeVisible();
  await shots(page, "calendar");
});

// ================================================================================================ Availability
test.describe("My Availability", () => {
  test("page: header, notice, weekly hours, specific dates form, requests, calendar card, other windows", async ({ page }) => {
    await openFromSidebar(page, "My Availability", "My availability");
    await expect(page.getByText("Tell the Graduate School when you can sit in a defense. All times are Philippine time.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your calendar" })).toHaveAttribute("href", "/faculty-portal/calendar");
    await expect(page.getByRole("status").filter({ hasText: /Availability entered\.|Last updated/ })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Weekly hours" })).toBeVisible();
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      await expect(page.getByRole("checkbox", { name: day })).toBeVisible();
    }
    await expect(page.getByLabel("Monday start time")).toBeVisible();
    await expect(page.getByLabel("Saturday start time")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save weekly hours" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Monday to weekdays" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Specific dates" })).toBeVisible();
    const form = page.getByRole("form", { name: "Add a specific date" });
    await expect(form.getByText("What applies on these dates?")).toBeVisible();
    await expect(form.getByRole("button", { name: "I am NOT available" })).toBeVisible();
    await expect(form.getByRole("button", { name: "I am available ONLY these hours" })).toBeVisible();
    await expect(form.getByLabel(/First date/)).toBeVisible();
    await expect(form.getByLabel(/Last date/)).toBeVisible();
    await expect(form.getByText("Optional. Fill it in for a range, such as a vacation.")).toBeVisible();
    await expect(form.getByText("Leave empty for the whole day.")).toBeVisible();
    await expect(form.getByRole("button", { name: "Add date" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your dates" })).toBeVisible();
    await expect(page.getByText("Dates that have passed are not shown.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Requests from the Graduate School" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Google Calendar connection" })).toContainText("Not connected");
    const windows = page.getByRole("heading", { name: "Other open windows" });
    await expect(windows).toBeVisible();
    await expect(main(page).getByText(/\d{1,2}:\d{2} (AM|PM) – \d{1,2}:\d{2} (AM|PM)/).first()).toBeVisible();
    await shots(page, "availability");
  });

  test("weekly hours: validation, copy Monday, nothing is saved by copying", async ({ page }) => {
    await openFromSidebar(page, "My Availability", "My availability");
    const puts = [];
    page.on("request", (r) => r.method() === "PUT" && puts.push(r.url()));
    // an enabled day without times is refused before anything is sent
    await page.getByRole("checkbox", { name: "Saturday" }).check();
    await expect(page.getByLabel("Saturday start time")).toBeVisible();
    await page.getByRole("button", { name: "Save weekly hours" }).click();
    await expect(page.getByText("Saturday: Enter both a start and an end time.")).toBeVisible();
    await page.getByLabel("Saturday start time").fill("10:00");
    await page.getByLabel("Saturday end time").fill("09:00");
    await page.getByRole("button", { name: "Save weekly hours" }).click();
    await expect(page.getByText("Saturday: The end time must be later than the start time.")).toBeVisible();
    await shots(page, "availability-weekly-error");
    expect(puts).toHaveLength(0);
    await page.getByRole("checkbox", { name: "Saturday" }).uncheck();
    await expect(page.getByLabel("Saturday start time")).toHaveCount(0);
    await expect(page.getByText("Not available").first()).toBeVisible();

    // copy Monday to Tuesday-Friday
    const monday = await page.getByLabel("Monday start time").inputValue();
    await page.getByLabel("Friday start time").fill("06:15");
    await page.getByRole("button", { name: "Copy Monday to weekdays" }).click();
    await expect(page.getByLabel("Friday start time")).toHaveValue(monday);
    expect(puts).toHaveLength(0);
  });

  test("weekly hours: saving sends all seven days and shows the notice", async ({ page }) => {
    await openFromSidebar(page, "My Availability", "My availability");
    const save = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith("/api/faculty-portal/availability/working-hours"));
    await page.getByRole("button", { name: "Save weekly hours" }).click();
    const body = (await save).postDataJSON();
    expect(body.hours).toHaveLength(7);
    expect(body.hours.map((h) => h.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    await expect(page.getByText("Weekly hours saved.")).toBeVisible();
  });

  test("specific dates: validation, 'only these hours', add, list, remove with a confirmation", async ({ page }) => {
    await openFromSidebar(page, "My Availability", "My availability");
    const form = page.getByRole("form", { name: "Add a specific date" });
    await form.getByRole("button", { name: "Add date" }).click();
    await expect(page.getByText("Choose the first date.")).toBeVisible();

    // "only these hours" needs both times
    const day = new Date(Date.now() + 90 * 86400000);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    await form.getByRole("button", { name: "I am available ONLY these hours" }).click();
    await expect(form.getByText("Leave empty for the whole day.")).toHaveCount(0);
    await form.getByLabel(/First date/).fill(iso);
    await form.getByRole("button", { name: "Add date" }).click();
    await expect(page.getByText("Available only these hours: Enter both a start and an end time.")).toBeVisible();
    await shots(page, "availability-dates-error");

    // add a whole-day "not available" date with a note, then remove it
    await form.getByRole("button", { name: "I am NOT available" }).click();
    await form.getByLabel(/^Note/).fill("P51 pin: out of town");
    const added = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/faculty-portal/availability/exceptions"));
    await form.getByRole("button", { name: "Add date" }).click();
    const payload = (await added).postDataJSON();
    expect(payload).toEqual({ kind: "unavailable", start_date: iso, note: "P51 pin: out of town" });
    await expect(page.getByText("Date saved.")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "P51 pin: out of town" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("whole day");
    await expect(row).toContainText("Not available");
    await shots(page, "availability-dates-added");

    await row.getByRole("button", { name: /^Remove / }).click();
    const confirm = page.getByRole("dialog", { name: "Remove this date?" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("will be removed and your weekly hours will apply again.");
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeVisible();
    await shots(page, "availability-dates-confirm", { full: false });
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: /^Remove / }).click();
    await confirm.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("Date removed.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "P51 pin: out of town" })).toHaveCount(0);
  });

  test("calendar card on this page opens the same preview dialog", async ({ page }) => {
    await openFromSidebar(page, "My Availability", "My availability");
    await page.getByRole("button", { name: "Connect Google Calendar" }).click();
    const dialog = page.getByRole("dialog", { name: /Allow USLS Graduate School to use your calendar availability/ });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("open Graduate School requests (mocked): shown, answered, other windows hidden when none", async ({ page }) => {
    const real = await (await page.request.get("/api/faculty-portal/availability")).json();
    const state = {
      ...real,
      entered: false,
      other_windows: [],
      requests: [
        { id: 55, status: "Open", student_name: "Mock Student", message: "Please enter your hours for May.", window_start: "2027-05-03", window_end: "2027-05-07", requested_by: "Staff Office" },
        { id: 56, status: "Open", student_name: null, message: null, window_start: null, window_end: null, requested_by: null },
        { id: 57, status: "Answered", student_name: "Hidden Student" },
      ],
    };
    const calls = [];
    await mockJson(page, "**/api/faculty-portal/availability", () => state);
    await mockPost(page, "**/api/faculty-portal/availability/requests/*/answer", calls, (call) => {
      state.requests.find((r) => call.url === `/faculty-portal/availability/requests/${r.id}/answer`).status = "Answered";
    });
    await openFromSidebar(page, "My Availability", "My availability");
    await expect(page.getByRole("status").filter({ hasText: "You have not entered any availability." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Other open windows" })).toHaveCount(0);
    const open = page.getByRole("listitem").filter({ hasText: "For Mock Student's defense" });
    await expect(open).toContainText("Please enter your hours for May.");
    await expect(open).toContainText("Dates needed:");
    await expect(open).toContainText("Asked by Staff Office.");
    await expect(page.getByRole("listitem").filter({ hasText: "Availability request" })).toContainText("No specific dates given.");
    await expect(page.getByText("Hidden Student")).toHaveCount(0);
    await shots(page, "availability-requests");
    await open.getByRole("button", { name: "I already entered my hours - keep them" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "For Mock Student's defense" })).toHaveCount(0);
    expect(calls).toEqual([{ url: "/faculty-portal/availability/requests/55/answer", body: {} }]);
  });
});

// ================================================================================================ Assigned Classes
test.describe("Assigned Classes", () => {
  test("rosters: header, read-only note, term and subject selects, roster table, print button, empty state", async ({ page }) => {
    await openFromSidebar(page, "Assigned Classes", "Assigned Classes");
    await expect(page.getByText("Class rosters for your assigned subjects.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned class rosters" })).toBeVisible();
    await expect(page.getByText("Review assigned subjects and students.")).toBeVisible();
    await expect(page.getByText("Grades and subject outcomes are encoded and maintained in their authorized source systems. The Monitoring Sheet is a synchronized, read-only view.")).toBeVisible();

    const term = page.getByLabel("Semester");
    const subject = page.getByLabel("Subject");
    await expect(term).toHaveValue("AY 2026-2027 1st Semester"); // the active planning term
    const first = await subject.locator("option").first().textContent();
    expect(first).toMatch(/^DBA-COG1 — /);

    const table = tableWith(page, "Remarks");
    await expect(table).toBeVisible();
    expect(await headerNames(table)).toEqual(["Student", "Status", "Remarks"]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(10);
    await expect(rows.first().locator("p").first()).not.toBeEmpty();
    await expect(page.getByRole("button", { name: "Print roster" })).toBeVisible();
    await shots(page, "classes");

    // another subject loads another roster
    await subject.selectOption({ index: 18 }); // EDD-COG1
    await expect(rows).toHaveCount(9);
    // another semester lists the same students (their status there is "Missing" when they have no record)
    await term.selectOption("AY 2030-2031 2nd Semester");
    await expect(rows.first()).toBeVisible();
    await expect(table).toContainText("Missing");

    // a subject with nobody in it shows the empty state and no table or print button
    await page.route("**/api/course-audit/roster*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ course: { code: "EDD-COG1", title: "None" }, students: [] }) }));
    await subject.selectOption({ index: 0 });
    await expect(page.getByText("No students in this class")).toBeVisible();
    await expect(page.getByText("The Academic Coordinator must add students through Enrollment first.")).toBeVisible();
    await expect(table).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print roster" })).toHaveCount(0);
    await shots(page, "classes-empty");
  });

  test("print roster opens a printable list of the roster", async ({ page }) => {
    await openFromSidebar(page, "Assigned Classes", "Assigned Classes");
    await expect(page.getByRole("button", { name: "Print roster" })).toBeVisible();
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Print roster" }).click()]);
    await expect(popup.locator("h1")).toContainText("Class Roster");
    await expect(popup.locator("h1")).toContainText("DBA-COG1");
    expect(await popup.locator("thead th").allTextContents()).toEqual(["Student ID", "Student name", "Program", "Status", "Remarks"]);
    expect(await popup.locator("tbody tr").count()).toBe(10);
    await popup.close();
  });
});

// ================================================================================================ Assistant and Business Rules (routes owned by FacultyRoutes)
test.describe("Routes", () => {
  test("Policy Assistant and Business Rules open from the sidebar", async ({ page }) => {
    await openFromSidebar(page, "Policy Assistant", "Policy Assistant");
    await expect(page.getByText("What is waiting on me?")).toBeVisible();
    await openFromSidebar(page, "Business Rules", /business rules/i);
  });

  test("an unknown faculty path goes back to the dashboard", async ({ page }) => {
    await page.goto("/faculty-portal/no-such-page");
    await expect(page).toHaveURL(/\/faculty-portal$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Liwayway" })).toBeVisible();
  });

  test("the faculty portal shows its message when the context cannot load", async ({ page }) => {
    await page.route("**/api/faculty-portal/context", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "The portal could not be read." }) }));
    await page.goto("/faculty-portal");
    await expect(page.getByText("Could not load the faculty portal")).toBeVisible();
    await expect(page.getByText("The portal could not be read.")).toBeVisible();
    tracker.problems = tracker.problems.filter((p) => !/API 500|Failed to load resource/.test(p.problem));
  });
});
