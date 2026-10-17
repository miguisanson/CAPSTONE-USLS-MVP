// Section J bugs from the defense walkthrough (DEFENSE_REVISIONS.md J1, J4, J8; ISSUES.md I-001, I-004, I-008).
// One test per bug. Each walks the real UI as the role that met the bug. Unlike the read-only sweep these
// tests CHANGE data (they save a dropped subject, endorse a Form 1, mark a practicum report reviewed) - the
// harness database is a throwaway, so that is fine. They touch only demo students the sweep does not read:
// Joshua Lim (withdrawal-joshua), Miguel Yu (research-miguel, reset first) and Paolo Ramirez (practicum-paolo).
// Setup that is not part of the bug (a student's uploads, the staff and coordinator hand-offs) goes through the
// JSON API with each role's own login; the screen under test is always driven through the browser.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = join(SCREENS_DIR, "..", "section-j");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

// ---------------------------------------------------------------------------------------------------------
// API helpers (setup only)
// ---------------------------------------------------------------------------------------------------------
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

async function resetDemoStudent(playwright, key) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await okJson(await ctx.post(`/api/auth/demo-students/${key}/reset`, { data: {} }), `reset ${key}`);
  await ctx.dispose();
}

/** A one-page PDF with real text, so the server can read it ("Research Title:" line and so on). */
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

// ---------------------------------------------------------------------------------------------------------
// I-001 (J1): the "Record dropped subject" dialog must fit the screen at 1366x768
// ---------------------------------------------------------------------------------------------------------
test.describe("I-001 Enrollment: Record dropped subject dialog", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 768 } });

  test("fits 1366x768, scrolls inside itself and its Save button can be reached", async ({ page, playwright }) => {
    mkdirSync(SHOTS, { recursive: true });
    await resetDemoStudent(playwright, "withdrawal-joshua");
    await page.goto("/enrollment");

    // MAED, the current semester, Joshua Lim (three enrolled subjects).
    const selects = page.locator("select.field-input");
    const pickByText = async (select, text) => {
      const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
      expect(value, `an option containing ${text}`).toBeTruthy();
      await select.selectOption(value);
    };
    await expect(selects.nth(0).locator("option", { hasText: "MAED" }).first()).toBeAttached();
    await pickByText(selects.nth(0), "MAED");
    await expect(selects.nth(1).locator("option", { hasText: "(Current)" }).first()).toBeAttached();
    await pickByText(selects.nth(1), "(Current)");
    await expect(selects.nth(2).locator("option", { hasText: "GS-2026-WD-02" }).first()).toBeAttached();
    await pickByText(selects.nth(2), "GS-2026-WD-02");

    await page.getByRole("button", { name: "Change MAED-MAJ2 student status" }).click();
    const dialog = page.getByRole("dialog", { name: "Record dropped subject" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(600); // let the fade-up animation finish before measuring
    await page.screenshot({ path: join(SHOTS, "i-001-dropped-subject-dialog-1366.png") });

    // 1. The dialog never extends beyond the viewport.
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box.y, "dialog top is on screen").toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `dialog bottom (${box.y + box.height}) is within the ${viewport.height}px viewport`).toBeLessThanOrEqual(viewport.height + 0.5);

    // 2. When the content is taller than the dialog, the dialog scrolls inside itself.
    const scrollInfo = await dialog.evaluate((root) => {
      const scrollers = [root, ...root.querySelectorAll("*")].filter((el) => {
        const overflowY = getComputedStyle(el).overflowY;
        return (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1;
      });
      return scrollers.map((el) => ({ tag: el.tagName, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    });
    expect(scrollInfo.length, "the dialog has its own scrolling area").toBeGreaterThan(0);

    // 3. Fill the form, then the Save button can be scrolled into view, is inside the viewport and works.
    await dialog.getByLabel("New status").selectOption("Dropped");
    await dialog.getByLabel("Unexcused absences (% of class hours)").fill("25");
    await dialog.getByLabel("Coordinator note").fill("Registrar advice received: unexcused absences above the handbook limit.");
    const save = dialog.getByRole("button", { name: /^Save Dropped$/ });
    await expect(save).toBeEnabled();
    await save.scrollIntoViewIfNeeded();
    const saveBox = await save.boundingBox();
    expect(saveBox.y, "Save button top is on screen").toBeGreaterThanOrEqual(0);
    expect(saveBox.y + saveBox.height, "Save button bottom is on screen").toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: join(SHOTS, "i-001-dropped-subject-dialog-save-reachable-1366.png") });
    await save.click({ timeout: 5_000 });
    await expect(page.getByText(/MAED-MAJ2 is now marked Dropped/i)).toBeVisible();
    await expect(dialog).toBeHidden();
  });
});
