// Packet P2.2 (Phase 5 design system, shared components): pins what the Monitoring Sheet dialogs and the calendar
// views DO, so moving them onto Modal / Drawer / StatusChip / Field / Button cannot change it. It was written against
// the old code and must pass on both. Through the real UI, as GS staff (and a faculty member for the calendar):
//   - "Add student": the required fields keep the Add button off until all five are filled; Cancel, the X and Escape
//     close it and send nothing; a valid student is created and the success note shows the login;
//   - the new student's record panel (opened with "Add subjects now"): its header and its student-details tab show a
//     "Manual entry" badge; "Correct details" asks for a reason (3+ characters) in a second window that Escape and
//     Cancel close without saving or closing the panel;
//   - adding a curriculum row stamps it "Manual entry"; Escape in the inline editor cancels the editor but keeps the
//     panel open; removing a row needs a reason (3+ characters), and the row goes back to "not taken";
//   - on an imported student the row badge reads "Imported" (a different word and tooltip from "Manual entry") and
//     editing that imported value needs a reason before Save is allowed;
//   - the calendar (staff: Defense Scheduling > Calendar, faculty: My Calendar) switches Month / Week / Agenda, moves
//     with Previous / Next / Today, and prints its legend and the time-zone line.
// Everything it writes goes to a student this spec creates itself (the throwaway harness database), so it does not
// touch the demo students other specs use. It also saves screenshots to e2e-artifacts/p22/ for the before/after review.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", "p22");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

async function shotBothWidths(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(SHOTS, `${name}-1366.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `${name}-390.png`) });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
}

test.describe("P2.2 Monitoring Sheet dialogs", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

  test("add student, record panel, reasons and provenance", async ({ page }) => {
    test.setTimeout(240_000);
    const writes = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/api/monitoring/")) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });

    await page.goto("/monitoring-sheet");
    await expect(page.getByRole("heading", { level: 1, name: "Monitoring Sheet" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible({ timeout: 30_000 });
    const openAdd = () => page.getByRole("button", { name: "Add student", exact: true }).first().click();

    // ---- Add student: required fields -------------------------------------------------------------------------
    await openAdd();
    const add = page.getByRole("dialog", { name: "Add student" });
    await expect(add).toBeVisible();
    await expect(add.locator("input[required], select[required]")).toHaveCount(5);
    const addButton = add.getByRole("button", { name: "Add student", exact: true });
    await expect(addButton).toBeDisabled();
    const program = add.locator("select").first();
    if (!(await program.inputValue())) await program.selectOption({ index: 1 });
    await add.getByLabel("Student ID").fill("7700123");
    await add.getByLabel("First name").fill("Pia");
    await add.getByLabel("Last name").fill("Testwell");
    await expect(addButton, "school-year still empty").toBeDisabled();
    await add.getByLabel("School year / AY entry").fill("26-27");
    await expect(addButton).toBeEnabled();
    await add.getByLabel("First name").fill("");
    await expect(addButton, "first name cleared").toBeDisabled();
    await shotBothWidths(page, "p22-add-student-form");

    // Cancel, the X and Escape all close it and nothing is sent.
    await add.getByRole("button", { name: "Cancel" }).click();
    await expect(add).toBeHidden();
    await openAdd();
    await expect(add).toBeVisible();
    await page.getByRole("button", { name: "Close add student form" }).click();
    await expect(add).toBeHidden();
    await openAdd();
    await expect(add).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    expect(writes, "closing the form sends nothing").toEqual([]);

    // ---- Add student: create one ----------------------------------------------------------------------------------
    await openAdd();
    await expect(add).toBeVisible();
    if (!(await program.inputValue())) await program.selectOption({ index: 1 });
    await add.getByLabel("Student ID").fill("7700123");
    await add.getByLabel("First name").fill("Pia");
    await add.getByLabel("Last name").fill("Testwell");
    await add.getByLabel("School year / AY entry").fill("26-27");
    await addButton.click();
    await expect(add.getByText("Student portal login:")).toBeVisible();
    await expect(add.getByText(/Initial password|first-login password/)).toBeVisible();
    expect(writes).toEqual(["POST /api/monitoring/students"]);
    await shotBothWidths(page, "p22-add-student-done");
    await add.getByRole("button", { name: "Add subjects now" }).click();

    // ---- Record panel of the new (manual) student --------------------------------------------------------------
    const panel = page.getByRole("dialog", { name: /Testwell, Pia/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("IDNO 7700123")).toBeVisible();
    const headerBadge = panel.locator('[aria-label^="Manual entry"]').first();
    await expect(headerBadge).toHaveText("Manual entry");
    await expect(headerBadge).toHaveAttribute("title", /^Manual entry by .+ on .+/);
    await expect(panel.getByRole("tab", { name: /Subjects/ })).toHaveAttribute("aria-selected", "true");
    await shotBothWidths(page, "p22-record-panel-subjects");

    // details tab + correction needs a reason in a second window
    await panel.getByRole("tab", { name: /Student details/ }).click();
    await expect(panel.getByText("Student ID", { exact: true })).toBeVisible();
    await expect(panel.locator('[aria-label^="Manual entry"]').first()).toHaveText("Manual entry");
    await panel.getByRole("button", { name: "Correct details" }).click();
    await panel.getByLabel("Adviser").fill("Dr. Reason Check");
    await panel.getByRole("button", { name: "Review correction" }).click();
    const reason = page.getByRole("dialog", { name: "Save this correction?" });
    await expect(reason).toBeVisible();
    await expect(reason.getByText(/adviser name: \(blank\) → Dr\. Reason Check/)).toBeVisible();
    const saveCorrection = reason.getByRole("button", { name: "Save correction" });
    await expect(saveCorrection, "no reason yet").toBeDisabled();
    const reasonBox = reason.getByLabel(/Reason/);
    await expect(reasonBox).toBeFocused();
    await reasonBox.fill("ab");
    await expect(saveCorrection, "2 characters is not enough").toBeDisabled();
    await reasonBox.fill("abc");
    await expect(saveCorrection).toBeEnabled();
    await shotBothWidths(page, "p22-reason-dialog");
    await page.keyboard.press("Escape");
    await expect(reason).toBeHidden();
    await expect(panel, "Escape closed only the reason window").toBeVisible();
    await panel.getByRole("button", { name: "Review correction" }).click();
    await expect(reason).toBeVisible();
    await reason.getByRole("button", { name: "Cancel" }).click();
    await expect(reason).toBeHidden();
    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(panel.getByRole("button", { name: "Correct details" })).toBeVisible();
    expect(writes.filter((w) => w.startsWith("PATCH")), "nothing was corrected").toEqual([]);

    // subjects: add a curriculum row = manual entry
    await panel.getByRole("tab", { name: /Subjects/ }).click();
    const addRowButton = panel.locator('button[aria-label^="Add "]').first();
    await expect(addRowButton).toBeVisible();
    const code = ((await addRowButton.getAttribute("aria-label")) || "").replace(/^Add /, "");
    await addRowButton.click();
    const editor = panel.locator(`form[aria-label="Add ${code}"]`);
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("Status")).toHaveValue("Planned");
    await editor.getByRole("button", { name: "Add row" }).click();
    const manualRow = panel.getByRole("row").filter({ hasText: code }).filter({ hasText: "Planned" });
    await expect(manualRow).toHaveCount(1);
    const rowBadge = manualRow.locator('[aria-label^="Manual entry"]');
    await expect(rowBadge).toHaveText("Manual entry");
    await expect(rowBadge).toHaveAttribute("title", /Manual entry by/);

    // Escape in the inline editor cancels the editor, not the panel
    await manualRow.getByRole("button", { name: `Edit ${code}` }).click();
    const editRow = panel.locator(`form[aria-label="Edit ${code}"]`);
    await expect(editRow).toBeVisible();
    await expect(editRow.getByLabel(/Reason for changing/), "a manual row needs no reason").toHaveCount(0);
    await shotBothWidths(page, "p22-record-panel-editing");
    await page.keyboard.press("Escape");
    await expect(editRow).toBeHidden();
    await expect(panel, "Escape in the editor leaves the panel open").toBeVisible();

    // remove needs a reason
    await manualRow.getByRole("button", { name: `Remove ${code}` }).click();
    const remove = page.getByRole("dialog", { name: `Remove ${code}?` });
    await expect(remove).toBeVisible();
    const removeButton = remove.getByRole("button", { name: "Remove row" });
    await expect(removeButton).toBeDisabled();
    await remove.getByLabel(/Reason/).fill("x");
    await expect(removeButton).toBeDisabled();
    await remove.getByRole("button", { name: "Cancel" }).click();
    await expect(remove).toBeHidden();
    await expect(manualRow).toHaveCount(1);
    await manualRow.getByRole("button", { name: `Remove ${code}` }).click();
    await remove.getByLabel(/Reason/).fill("added by mistake");
    await removeButton.click();
    await expect(remove).toBeHidden();
    await expect(panel.getByRole("row").filter({ hasText: code }).filter({ hasText: "Planned" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /Show removed rows \(1\)/ })).toBeVisible();
    expect(writes.some((w) => w.startsWith("DELETE /api/monitoring/students/")), "the remove call was sent").toBeTruthy();

    // the history tab lists the portal changes with their reason
    await panel.getByRole("tab", { name: /Change history/ }).click();
    await expect(panel.getByText("Subject row removed")).toBeVisible();
    await expect(panel.getByText("Reason: added by mistake")).toBeVisible();

    // ---- an imported student -----------------------------------------------------------------------------------
    await panel.getByRole("button", { name: "Close record panel" }).click();
    await expect(panel).toBeHidden();
    const others = page.locator('button[aria-label^="Edit monitoring record of"]:not([aria-label*="Testwell"])');
    await expect(others.first()).toBeVisible();
    const total = Math.min(await others.count(), 8);
    let found = false;
    for (let i = 0; i < total && !found; i += 1) {
      await others.nth(i).click();
      const imported = page.getByRole("dialog").first();
      await expect(imported.getByRole("tab", { name: /Subjects/ })).toBeVisible();
      await expect(imported.getByRole("table")).toBeVisible({ timeout: 15_000 });
      const row = imported.getByRole("row").filter({ has: page.locator('[aria-label^="Imported"]') }).first();
      if ((await row.count()) === 0) {
        await page.getByRole("button", { name: "Close record panel" }).click();
        continue;
      }
      found = true;
      const badge = row.locator('[aria-label^="Imported"]');
      await expect(badge).toHaveText("Imported");
      await expect(badge).toHaveAttribute("title", /^Imported from a monitoring sheet or source file/);
      await row.getByRole("button", { name: /^Edit / }).click();
      const form = imported.locator('form[aria-label^="Edit "]');
      await expect(form).toBeVisible();
      const reasonField = form.getByLabel(/Reason for changing this imported value/);
      await expect(reasonField).toBeVisible();
      const save = form.getByRole("button", { name: "Save changes" });
      await expect(save, "nothing changed yet").toBeDisabled();
      await form.getByLabel("Remarks").fill("check");
      await expect(save, "changed but no reason").toBeDisabled();
      await reasonField.fill("ab");
      await expect(save).toBeDisabled();
      await reasonField.fill("abc");
      await expect(save).toBeEnabled();
      await shotBothWidths(page, "p22-record-panel-imported-edit");
      await page.keyboard.press("Escape");
      await expect(form).toBeHidden();
      await expect(imported).toBeVisible();
      await page.getByRole("button", { name: "Close record panel" }).click();
    }
    expect(found, "an imported subject row on one of the first students").toBeTruthy();
    expect(writes.filter((w) => w.startsWith("PATCH")), "the imported value was not saved").toEqual([]);
  });
});

async function calendarTour(page, { first, name }) {
  const views = page.getByRole("group", { name: "Calendar view" });
  await expect(views).toBeVisible({ timeout: 30_000 });
  const pressed = (label) => views.getByRole("button", { name: label, exact: true });
  const title = page.locator("h2[aria-live='polite']");
  await expect(pressed(first)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("list", { name: "Legend" })).toBeVisible();
  await expect(page.getByText(/All times are Philippine time/)).toBeVisible();

  await pressed("Month").click();
  await expect(pressed("Month")).toHaveAttribute("aria-pressed", "true");
  await expect(pressed("Week")).toHaveAttribute("aria-pressed", "false");
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
  const monthTitle = (await title.textContent()) || "";
  await shotBothWidths(page, `${name}-month`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(title).not.toHaveText(monthTitle);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(title).toHaveText(monthTitle);

  await pressed("Week").click();
  await expect(pressed("Week")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Today", exact: true }).click(); // the month tour moved the anchor
  await expect(page.getByText("Due", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("07:00", { exact: true })).toBeVisible();
  const weekTitle = (await title.textContent()) || "";
  expect(weekTitle).toContain("–");
  await shotBothWidths(page, `${name}-week`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(title).not.toHaveText(weekTitle);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(title).toHaveText(weekTitle);

  await pressed("Agenda").click();
  await expect(pressed("Agenda")).toHaveAttribute("aria-pressed", "true");
  await expect(title).toContainText("From ");
  await expect(page.getByText(/Nothing on the calendar in this period\.|Your role|on the panel|Defense/).first()).toBeVisible();
  await shotBothWidths(page, `${name}-agenda`);
}

test.describe("P2.2 calendar views", () => {
  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
    test("month, week and agenda", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/workflow/defense-scheduling?view=calendar");
      await calendarTour(page, { first: "Month", name: "p22-calendar-staff" });
    });
  });
  test.describe("faculty", () => {
    test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });
    test("week first, then month and agenda", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/faculty-portal/calendar");
      await calendarTour(page, { first: "Week", name: "p22-calendar-faculty" });
    });
  });
});
