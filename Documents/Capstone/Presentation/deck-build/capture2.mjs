import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/Users/miguelsanson/Projects/CAPSTONE-USLS-MVP/frontend/package.json");
const { chromium } = require("@playwright/test");
const SP = process.argv[2], OUT = SP + "/shots";
const acc = JSON.parse(readFileSync(SP + "/app/accounts.json", "utf8"));
const BASE = "http://localhost:5055";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 854 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', acc.staff);
await page.fill('input[name="password"]', "DemoPass123!");
await page.click('button[type="submit"]');
await page.waitForSelector("aside nav a", { timeout: 20000 });
const snap = async (name) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
// scheduling with a student chosen
await page.goto(BASE + "/workflow/defense-scheduling", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Choose/ }).first().click();
await snap("sched-1");
const heads = await page.locator("h2, h3, .card-title").allInnerTexts();
console.log("headings:", heads.map((h) => h.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 30).join(" | "));
for (const [i, y] of [[2, 520], [3, 1040], [4, 1560]]) { await page.evaluate((yy) => { const m = document.querySelector("main") || document.scrollingElement; (m.scrollTo ? m : window).scrollTo(0, yy); window.scrollTo(0, yy); }, y); await snap("sched-" + i); }
// reports: by year started, table in view
await page.goto(BASE + "/reports?report=cohorts", { waitUntil: "networkidle" });
const h = page.getByText("Where are the students of each year started?").first();
if (await h.count()) { await h.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 0)); }
await h.evaluate((el) => el.scrollIntoView({ block: "start" })).catch(() => {});
await snap("reports-year2");
await browser.close();
