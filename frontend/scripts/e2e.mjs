// Cross-platform wrapper: runs `playwright <args>` with PLAYWRIGHT_BROWSERS_PATH set
// (browsers on E:, never C:). Usage: node scripts/e2e.mjs [install chromium | test ...]
// With no arguments it runs `playwright test`. E2E_NEGATIVE=1 selects the negative control.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { FRONTEND_DIR, playwrightEnv } from "../e2e/support/paths.mjs";

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("@playwright/test/package.json")), "cli.js");
const args = process.argv.slice(2);
if (args.includes("--negative")) {
  process.env.E2E_NEGATIVE = "1";
  args.splice(args.indexOf("--negative"), 1);
}
const finalArgs = args.length ? args : ["test"];
if (finalArgs[0] !== "install" && finalArgs[0] !== "test" && finalArgs[0] !== "show-report") finalArgs.unshift("test");
const result = spawnSync(process.execPath, [cli, ...finalArgs], { cwd: FRONTEND_DIR, stdio: "inherit", env: playwrightEnv() });
process.exit(result.status ?? 1);
