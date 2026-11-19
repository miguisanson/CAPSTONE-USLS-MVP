// usage: node capture.mjs <scratchpad>   (private app copy must be running on localhost:5055)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire("/Users/miguelsanson/Projects/CAPSTONE-USLS-MVP/frontend/package.json");
const { chromium } = require("@playwright/test");
const SP = process.argv[2];
const OUT = SP + "/shots";
mkdirSync(OUT, { recursive: true });
const acc = JSON.parse(readFileSync(SP + "/app/accounts.json", "utf8"));
const BASE = "http://localhost:5055";
const PW = "DemoPass123!";
const browser = await chromium.launch();

async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 854 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForSelector("aside nav a", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}
async function shot(page, name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name, page.url().replace(BASE, ""));
}
async function nav(page, label) {
  const link = page.locator("aside nav a", { hasText: label }).first();
  await link.click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

// ---- faculty: My Calendar with the Google Calendar card
{
  const { ctx, page } = await session(acc.faculty);
  await page.goto(BASE + "/faculty-portal/calendar", { waitUntil: "networkidle" });
  await shot(page, "calendar");
  const card = page.locator('section[aria-label="Google Calendar connection"]').first();
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await card.screenshot({ path: `${OUT}/calendar-card.png` });
    await shot(page, "calendar-scrolled");
    console.log("card text:", (await card.innerText()).replace(/\s+/g, " ").slice(0, 300));
  } else console.log("NO GOOGLE CARD");
  await page.goto(BASE + "/faculty-portal/availability", { waitUntil: "networkidle" });
  await shot(page, "availability");
  await ctx.close();
}
// ---- staff: scheduling, leave board, reports, research gate, policy documents
{
  const { ctx, page } = await session(acc.staff);
  await page.goto(BASE + "/workflow/defense-scheduling", { waitUntil: "networkidle" });
  await shot(page, "scheduling");
  await page.goto(BASE + "/workflow/defense-scheduling?view=calendar", { waitUntil: "networkidle" });
  await shot(page, "scheduling-calendar");
  await nav(page, "Leave of Absence");
  await shot(page, "leave");
  await page.goto(BASE + "/workflow/research-gate", { waitUntil: "networkidle" });
  await shot(page, "gate");
  await page.goto(BASE + "/reports", { waitUntil: "networkidle" });
  await shot(page, "reports");
  const tab = page.getByRole("tab", { name: /year started/i }).or(page.getByRole("button", { name: /year started/i })).first();
  if (await tab.count()) { await tab.click(); await shot(page, "reports-year"); } else console.log("NO year-started tab");
  await page.goto(BASE + "/policy-documents", { waitUntil: "networkidle" });
  await shot(page, "policydocs");
  await ctx.close();
}
await browser.close();
