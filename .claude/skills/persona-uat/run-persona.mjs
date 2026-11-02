// Persona UAT helper. One call = one batch of actions (newline-delimited JSON on stdin), then it exits.
// The first call signs in through the real login form and saves the session to <out>/state.json; later calls
// reuse it and reopen the last page, so a persona can work across many short calls.
//   node run-persona.mjs --base http://127.0.0.1:5440 --email <e> [--password <p>] [--viewport 390x844] --out <dir>
// Password: --password, else env PERSONA_PASSWORD, else the shared demo password in frontend/e2e/support/accounts.js.
// Actions (fill also takes role+name, as shown by a11y): {"goto":"/path"} {"click":{"role":"button","name":"Save","nth":0}} {"click":{"text":"..."}}
//   {"fill":{"label":"Email","value":"x"}} {"press":"Tab"} {"wait":5} {"shot":"name"} {"text":true} {"a11y":true}
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = process.env.PERSONA_FRONTEND || resolve(here, "..", "..", "..", "frontend"); // override inside a worktree without node_modules
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg("base"), email = arg("email"), out = arg("out");
if (!base || !email || !out) { console.error("need --base, --email, --out"); process.exit(2); }
const [width, height] = arg("viewport", "1366x768").split("x").map(Number);
let password = arg("password", process.env.PERSONA_PASSWORD);
if (!password) password = (await import(pathToFileURL(join(frontend, "e2e", "support", "accounts.js")).href)).PASSWORD;
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("E:/DevCache/ms-playwright")) process.env.PLAYWRIGHT_BROWSERS_PATH = "E:/DevCache/ms-playwright";

mkdirSync(out, { recursive: true });
const { chromium } = createRequire(join(frontend, "package.json"))("playwright");
const stateFile = join(out, "state.json"), urlFile = join(out, "last-url.txt"), errFile = join(out, "errors.json");
const errors = existsSync(errFile) ? JSON.parse(readFileSync(errFile, "utf8")) : [];
const origin = new URL(base).origin;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, ...(existsSync(stateFile) ? { storageState: stateFile } : {}) });
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" })); // run needs no internet
const page = await context.newPage();
page.setDefaultTimeout(8000); // a human gives up on a missing control; the agent should too
const note = (kind, detail) => errors.push({ kind, page: new URL(page.url() || base).pathname, detail });
page.on("console", (m) => { if (m.type() === "error") note("console", m.text()); });
page.on("pageerror", (e) => note("pageerror", String(e)));
page.on("requestfailed", (r) => note("requestfailed", `${r.method()} ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(origin)) note("http", `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });

const settle = async () => { await page.waitForLoadState("domcontentloaded"); await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {}); };

if (!existsSync(stateFile)) {
  await page.goto(`${base}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await settle();
  console.log(JSON.stringify({ ok: true, action: "sign-in", email, url: page.url() }));
} else {
  await page.goto(existsSync(urlFile) ? readFileSync(urlFile, "utf8") : base);
  await settle();
}

const locate = (c) => (c.role ? page.getByRole(c.role, { name: c.name, exact: c.exact }) : page.getByText(c.text, { exact: c.exact })).nth(c.nth || 0);
const run = {
  goto: async (v) => { const u = new URL(v, base); if (u.origin !== origin) throw new Error(`refused: ${u.origin} is not the app`); await page.goto(u.href); },
  click: async (c) => { await locate(c).click(); },
  fill: async (c) => { await (c.role ? locate(c) : c.label ? page.getByLabel(c.label, { exact: c.exact }).nth(c.nth || 0) : page.getByPlaceholder(c.placeholder).nth(c.nth || 0)).fill(c.value); },
  press: async (k) => { await page.keyboard.press(k); },
  wait: async (s) => { await page.waitForTimeout(Math.min(Number(s) || 1, 15) * 1000); },
  shot: async (name) => { await page.screenshot({ path: join(out, `${String(name).replace(/[^\w-]+/g, "_")}.png`) }); },
  text: async () => (await page.locator("main").first().innerText().catch(() => page.locator("body").innerText())).slice(0, 6000),
  a11y: async () => (await page.locator("body").ariaSnapshot()).slice(0, 6000),
};
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const result = { action: line.trim().slice(0, 120) };
  try {
    const cmd = JSON.parse(line);
    const key = Object.keys(cmd).find((k) => k in run);
    if (!key) throw new Error(`unknown action; use one of ${Object.keys(run).join(", ")}`);
    const value = await run[key](cmd[key]);
    if (key !== "text" && key !== "a11y" && key !== "shot") await settle();
    result.ok = true;
    if (value) result.output = value;
  } catch (e) { result.ok = false; result.error = String(e.message).split("\n")[0]; }
  result.url = page.url().replace(origin, "");
  result.title = await page.title().catch(() => "");
  console.log(JSON.stringify(result));
}
writeFileSync(urlFile, page.url());
writeFileSync(errFile, JSON.stringify(errors, null, 1));
await context.storageState({ path: stateFile });
await browser.close();
