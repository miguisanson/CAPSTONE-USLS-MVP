// e2e-writes: none
// Packet fable2 (I-211, I-212 ui, I-214, I-217; Fable's full review F-04, F-05, F-11, F-18, F-19, F-24). Written BEFORE the
// change; red on the old code. Through the real UI at 390 and 1366 px. Reads only: every write, the 401 and the 502 are
// answered by page.route, so no other spec's data matters.
//   I-211  an expired session (401 on a signed-in call) lands on /login?expired=1 with a note; a dead network or a 502/503/504
//          says the site is not reachable; a 4xx keeps the server's own words; the phone drawer shows the signed-in name,
//          the role and a "Sign out" item; the header sign-out button has a name.
//   I-212  the server flag `demo_account` on /api/auth/me hides the voluntary Change password page.
//   I-214  Dean dialogs name the process in words, the history never says "User #12", no "Prototype rule" / "Needs review"
//          wording for the Dean and the student, no "AC" jargon, no "(Student) (Student)", the "Open" chip is not Approved-green.
//   I-217  Escape or a backdrop click on a dialog with a typed reason asks "Discard your changes?"; "Move to..." is at least
//          40 px tall on a phone; the Dean decision footer is one compact row on a phone.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const VIEWS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 768 },
];
const SRC = join(import.meta.dirname, "..", "src");
const source = (file) => readFileSync(join(SRC, file), "utf8");

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

// every /api call except the sign-in ones is answered by `answer`; /api/auth/me is real once (the page loads signed in), then 401
async function failSignedInCalls(page, answer) {
  let meCalls = 0;
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/auth/me")) {
      meCalls += 1;
      if (meCalls === 1) return route.continue();
      return route.fulfill({ status: 401, json: { error: "Sign in required." } });
    }
    if (url.includes("/api/auth/")) return route.continue();
    return answer(route);
  });
}

// ------------------------------------------------------------------ I-211 (F-04)
for (const view of VIEWS) {
  test.describe(`session and network at ${view.width}`, () => {
    test.use({ storageState: authFile("dean"), viewport: { width: view.width, height: view.height } });

    test("a 401 on a signed-in call goes to /login?expired=1 with a note", async ({ page }) => {
      await failSignedInCalls(page, (route) => route.fulfill({ status: 401, json: { error: "Sign in required." } }));
      await page.goto("/dean");
      await expect(page).toHaveURL(/\/login\?expired=1/);
      await expect(page.getByText("Your session ended — please sign in again", { exact: false })).toBeVisible();
    });

    test("a dead network says the site is not reachable", async ({ page }) => {
      await failSignedInCalls(page, (route) => route.abort("connectionrefused"));
      await page.goto("/dean");
      await expect(page.getByText("The site is not reachable right now. Check your connection and try again.").first()).toBeVisible();
    });

    test("a 502 says the site is not reachable (no raw status text)", async ({ page }) => {
      await failSignedInCalls(page, (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" }));
      await page.goto("/dean");
      await expect(page.getByText("The site is not reachable right now. Check your connection and try again.").first()).toBeVisible();
      await expect(page.getByText("Request failed (502)")).toHaveCount(0);
    });
  });

  test.describe(`sign-in page at ${view.width}`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: view.width, height: view.height } });

    test("a wrong password keeps the server's words and does not redirect", async ({ page }) => {
      await page.route("**/api/auth/login", (route) => route.fulfill({ status: 401, json: { error: "Email or password is not right." } }));
      await page.goto("/login");
      await expect(page.getByText("Your session ended")).toHaveCount(0);
      await page.getByLabel(/email/i).fill("someone@usls.edu.ph");
      await page.getByLabel(/^password/i).fill("not-the-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Email or password is not right.")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });
  });
}

// ------------------------------------------------------------------ I-211 (F-05) phone drawer
test.describe("phone drawer (F-05)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  test("the drawer shows who is signed in and has a labelled Sign out", async ({ page }) => {
    await page.route("**/api/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
    await page.goto("/dean");
    await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    const who = drawer.getByTestId("drawer-identity");
    await expect(who).toContainText(/\S+/);
    await expect(who).toContainText("Dean");
    await drawer.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ------------------------------------------------------------------ I-212 (ui)
test.describe("demo accounts keep their password (I-212)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  async function meWith(page, flag) {
    await page.route("**/api/auth/me", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      if (flag !== undefined) body.user.demo_account = flag;
      await route.fulfill({ response: res, json: body });
    });
  }

  test("a seeded demo account cannot reach Change password", async ({ page }) => {
    await meWith(page, true);
    await page.goto("/change-password");
    await expect(page.getByRole("heading", { name: "Change password" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/change-password/);
  });

  test("an ordinary account still can", async ({ page }) => {
    // The e2e logins are seeded demo accounts (the server says demo_account: true), so pretend an ordinary one.
    await meWith(page, false);
    await page.goto("/change-password");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  });
});

// ------------------------------------------------------------------ I-214 / I-217 on the Dean case page
async function leaveCaseOf(page) {
  const res = await page.request.get("/api/approvals");
  expect(res.status()).toBe(200);
  const data = await res.json();
  const item = data.workflow_pending.find((x) => x.type === "leave-of-absence");
  expect(item, "a Leave of Absence case waits for the Dean").toBeTruthy();
  return item;
}

// the same /api/approvals, with the first leave case given a history (no actor name / with one) and two messages
async function patchApprovals(page) {
  await page.route("**/api/approvals", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const item = body.workflow_pending.find((x) => x.type === "leave-of-absence");
    item.history = [
      { id: 990001, result: "Forwarded to Dean", created_at: "2026-10-20T09:00:00", actor_user_id: 12, actor_role: "staff", action_type: "forward", previous_status: "Staff Review", new_status: "Dean Review", notes: "" },
      { id: 990002, result: "Noted", created_at: "2026-10-21T09:00:00", actor_user_id: 13, actor_name: "Ana Cruz", actor_role: "staff", action_type: "note", previous_status: "Dean Review", new_status: "Dean Review", notes: "" },
    ];
    item.messages = [
      { id: 880001, sender_name: "Maria Santos (Student)", sender_role: "Student", recipient_role: "Dean", comment: "Please read my reason.", status: "Open", action_type: "submission", created_at: "2026-10-19T09:00:00" },
    ];
    await route.fulfill({ response: res, json: body });
  });
}

for (const view of VIEWS) {
  test.describe(`Dean case page at ${view.width}`, () => {
    test.use({ storageState: authFile("dean"), viewport: { width: view.width, height: view.height } });

    test("dialogs and history use words, not slugs or user numbers (F-11, F-19)", async ({ page }) => {
      const item = await leaveCaseOf(page);
      await patchApprovals(page);
      await page.goto(`/dean/case/${item.type}/${item.id}`);
      await page.getByRole("button", { name: /^Approve/ }).click();
      const confirm = page.getByRole("dialog", { name: /^Confirm: / });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText("Leave of Absence");
      await expect(confirm).not.toContainText("leave-of-absence");
      await confirm.getByRole("button", { name: "Cancel" }).click();

      await page.getByRole("button", { name: /View logs/ }).click();
      const main = page.getByRole("main");
      await expect(main).not.toContainText(/User #\d+/);
      await expect(main).toContainText("Graduate School staff");
      await expect(main).toContainText("Ana Cruz");
      await expect(main).toContainText("Maria Santos (Student)");
      await expect(main).not.toContainText("(Student) (Student)");
    });
  });
}

for (const view of VIEWS) {
  test.describe(`step dialog at ${view.width}`, () => {
    test.use({ storageState: authFile("staff"), viewport: { width: view.width, height: view.height } });

    test("Escape or the backdrop on a typed reason asks before it throws the reason away (F-18)", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      await page.getByRole("button", { name: "View details for Benjamin Santos", exact: true }).click();
      const caseWindow = page.getByRole("dialog");
      await caseWindow.getByRole("button", { name: "Return to student", exact: true }).last().click();
      await expect(page.getByRole("dialog")).toHaveCount(2);
      const box = page.getByRole("dialog").last().getByRole("textbox");
      await box.fill("My reason, half written");
      await page.keyboard.press("Escape");
      const ask = page.getByRole("dialog", { name: "Discard your changes?" });
      await expect(ask).toBeVisible();
      await ask.getByRole("button", { name: "Keep editing" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(2);
      await expect(box).toHaveValue("My reason, half written");
      await page.mouse.click(3, 3); // the backdrop
      await expect(page.getByRole("dialog", { name: "Discard your changes?" })).toBeVisible();
      await page.getByRole("dialog", { name: "Discard your changes?" }).getByRole("button", { name: "Discard" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("an empty reason box closes without asking", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      await page.getByRole("button", { name: "View details for Benjamin Santos", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Return to student", exact: true }).last().click();
      await expect(page.getByRole("dialog")).toHaveCount(2);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });
  });
}

test.describe("Dean decision footer on a phone (F-18)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  // I-220: pinned to the seeded case of Lorenzo Reyes, a Leave of Absence waiting for the Dean that no other spec files,
  // moves or decides (the old "first leave case" was Martin's or Clarissa's in a full run: p72 / p79 add theirs).
  test("the pinned footer is one compact row and the focused box is in view", async ({ page }) => {
    const res = await page.request.get("/api/approvals");
    const item = (await res.json()).workflow_pending.find((x) => x.type === "leave-of-absence" && x.student?.name === "Lorenzo Reyes");
    expect(item, "the seeded Leave of Absence case of Lorenzo Reyes waits for the Dean").toBeTruthy();
    await page.goto(`/dean/case/${item.type}/${item.id}`);
    const footer = page.getByTestId("decision-footer");
    await expect(footer).toBeVisible();
    // the page fades in: read every button's place at the same instant, once the entrance animations are over
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
    const rects = await footer.getByRole("button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ y: Math.round(r.y), height: Math.round(r.height) })));
    const box = await footer.boundingBox();
    expect(box.height, "the footer takes at most a quarter of the phone screen (it was over a third)").toBeLessThanOrEqual(844 / 4);
    expect(rects.length, "Approve, Return and Deny").toBe(3);
    expect(new Set(rects.map((r) => r.y)).size, "Approve, Return and Deny sit on one row").toBe(1);
    expect(Math.max(...rects.map((r) => r.height)), "no button word wraps to a third line").toBeLessThanOrEqual(56);
    const area = footer.getByRole("textbox").first();
    await area.focus();
    await expect(area).toBeInViewport();
  });
});

test.describe("Move to... on a phone (F-18)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

  test("the button is at least 40 px tall", async ({ page }) => {
    await page.goto("/workflow/leave-of-absence");
    const move = page.getByRole("button", { name: /Move to/ }).first();
    await expect(move).toBeVisible();
    expect((await move.boundingBox()).height).toBeGreaterThanOrEqual(40);
  });
});

// ------------------------------------------------------------------ I-214: rule badges
const PROTOTYPE_RULES = {
  items: [
    { key: "x1", title: "Leave length", description: "How long a leave may last.", value: 1, value_type: "int", unit: "semesters", citation: "Proposed rule (agreed with the Graduate School, awaiting sign-off)", enforced: true, status: "needs_review" },
  ],
};

test.describe("rule badges for the Dean and the student (F-11)", () => {
  test.describe("student", () => {
    test.use({ storageState: authFile("student"), viewport: { width: 390, height: 844 } });
    test("no Prototype rule or Needs review wording", async ({ page }) => {
      await page.route("**/api/business-rules*", (route) => route.fulfill({ json: PROTOTYPE_RULES }));
      await page.goto("/student/requests/leave-of-absence");
      const rules = page.getByRole("region", { name: "Rules applied on this screen" });
      await expect(rules).toBeVisible();
      await rules.getByRole("button").first().click();
      await expect(rules).toContainText("Leave length");
      await expect(rules).not.toContainText(/Prototype rule|Proposed rule|awaiting sign-off|pending Graduate School validation|Needs review|need review/i);
    });
  });
  test.describe("dean", () => {
    test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });
    test("no Prototype rule or Needs review wording", async ({ page }) => {
      await page.route("**/api/business-rules*", (route) => route.fulfill({ json: PROTOTYPE_RULES }));
      await page.goto("/dean/approvals/practicum");
      const rules = page.getByRole("region", { name: "Rules applied on this screen" });
      await expect(rules).toBeVisible();
      await rules.getByRole("button").first().click();
      await expect(rules).toContainText("Leave length");
      await expect(rules).not.toContainText(/Prototype rule|Proposed rule|awaiting sign-off|pending Graduate School validation|Needs review|need review/i);
    });
  });
  test.describe("staff keeps them", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
    test("Prototype rule and Needs review stay on staff screens", async ({ page }) => {
      await page.route("**/api/business-rules*", (route) => route.fulfill({ json: PROTOTYPE_RULES }));
      await page.goto("/workflow/leave-of-absence");
      const rules = page.getByRole("region", { name: "Rules applied on this screen" });
      await rules.getByRole("button").first().click();
      await expect(rules).toContainText(/Proposed rule \(agreed with the Graduate School, awaiting sign-off\)/);
      await expect(rules).toContainText(/Awaiting sign-off/);
      await expect(rules).not.toContainText(/Prototype rule|pending Graduate School validation/);
    });
  });
});

// ------------------------------------------------------------------ I-214: words
test.describe("words (F-19, F-24)", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("the Student Handoff page says Academic Coordinator, not AC", async ({ page }) => {
    await page.goto("/workflow/student-handoff");
    await expect(page.getByRole("main")).toContainText("Student Handoff");
    expect(await page.getByRole("main").innerText()).not.toMatch(/\bAC\b/);
  });

  test("no raw toLocaleString() dates and no AC wording in the files the review lists", async () => {
    for (const file of ["components/SubjectNeedsReport.jsx", "pages/Form1Endorsements.jsx", "components/calendar/CalendarFeedCard.jsx"]) {
      expect(source(file), file).not.toMatch(/\.toLocaleString\(\)/);
    }
    for (const file of ["components/ProcessGates.jsx", "pages/workflow/HandoffImport.jsx"]) {
      expect(source(file), file).not.toMatch(/\bAC\b/);
    }
  });
});
