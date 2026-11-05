// Runs the page specs in REVERSE order, to find a spec that only passes because another spec ran before it (or after it).
// Playwright always sorts files by name, so this copies the specs to e2e-artifacts/reverse/ with the numbers of the p<NN>
// files mirrored (p90 first ... p21 last; section-j and sweep after the pages, the other way round to the normal run) and
// runs them with a generated config that reuses playwright.config.js. Nothing in e2e/ is changed.
//
//   node e2e/support/reverse-run.mjs                      (from frontend/; same arguments as `node scripts/e2e.mjs test`)
//   node e2e/support/reverse-run.mjs --workers=1          one at a time: the order is then exact
//   node e2e/support/reverse-run.mjs --list               only print the order
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRONTEND_DIR, ARTIFACTS_DIR, playwrightEnv } from "./paths.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const e2eDir = join(here, "..");
const outDir = join(ARTIFACTS_DIR, "reverse");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const rewrite = (text) => text.replaceAll('from "./support/', 'from "../../e2e/support/').replaceAll("from './support/", "from '../../e2e/support/");
const specs = readdirSync(e2eDir).filter((name) => /^(p\d+-[\w-]+|section-j|sweep)\.spec\.js$/.test(name));
for (const name of specs) {
  const numbered = name.match(/^p(\d+)-(.*)$/);
  const target = numbered ? `p${String(100 - Number(numbered[1])).padStart(2, "0")}-${numbered[2]}` : name;
  writeFileSync(join(outDir, target), rewrite(readFileSync(join(e2eDir, name), "utf8")));
}
writeFileSync(join(outDir, "auth.setup.js"), rewrite(readFileSync(join(e2eDir, "auth.setup.js"), "utf8")));

const configFile = join(outDir, "playwright.reverse.config.mjs");
writeFileSync(
  configFile,
  `import base from ${JSON.stringify(join(FRONTEND_DIR, "playwright.config.js").replaceAll("\\", "/"))};
const byName = (name) => base.projects.find((project) => project.name === name);
export default {
  ...base,
  testDir: ".",
  globalTeardown: ${JSON.stringify(join(e2eDir, "support", "teardown.mjs").replaceAll("\\", "/"))},
  webServer: { ...base.webServer, cwd: ${JSON.stringify(FRONTEND_DIR.replaceAll("\\", "/"))} },
  // pages first, then section-j, then the sweep: the opposite of the normal run
  projects: ["setup", "pages", "section-j", "sweep"].map(byName),
};
`,
);

const cli = join(FRONTEND_DIR, "scripts", "e2e.mjs");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [cli, "test", "-c", configFile, ...args], { cwd: FRONTEND_DIR, stdio: "inherit", env: playwrightEnv() });
process.exit(result.status ?? 1);
