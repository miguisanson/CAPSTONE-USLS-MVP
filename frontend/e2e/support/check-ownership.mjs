// Data-ownership guard for the Playwright specs (I-100, I-113, I-121: three times a spec passed alone and failed in the
// combined run because another spec changed the shared seeded database first).
//
// Rule: every spec file under e2e/ (p<NN>-*.spec.js, section-j.spec.js, sweep.spec.js, ...) carries one header line
//
//     // e2e-writes: martin, maureen          <- the demo students / records this spec CHANGES
//     // e2e-writes: none                     <- it only reads (or answers every write with page.route)
//
// The guard fails when
//   - a spec has no such line (a new spec must say what it writes),
//   - two specs declare the same key (two writers on one record: whichever runs second sees the first one's data), or
//   - a spec that says "none" still calls a data-changing API directly (`.post(` / `.put(` / `.patch(` / `.delete(` on an
//     API request context other than the sign-in call).
//
// Keys are lower-case words: a demo student key from WORKFLOW_DEMO_STUDENTS in app.py without its workflow prefix
// ("maureen", "martin"), or a short name for another record ("plan-mscs-2026-2", "monitoring-created").
// The matrix of who writes and who reads what is in e2e/DATA-OWNERSHIP.md.
//
// Run:  node e2e/support/check-ownership.mjs      (playwright.config.js also runs it at the start of every run)
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEADER = /^\s*\/\/\s*e2e-writes:\s*(.+?)\s*$/m;
// A direct write through an API request context. The sign-in call is not a data change.
const DIRECT_WRITE = /\.(post|put|patch|delete)\(\s*[`"'](?!\/api\/auth\/login)/g;

export function checkOwnership(dir = E2E_DIR) {
  const problems = [];
  const owners = new Map(); // key -> [spec, ...]
  const specs = readdirSync(dir).filter((name) => name.endsWith(".spec.js")).sort();
  for (const spec of specs) {
    const text = readFileSync(join(dir, spec), "utf8");
    const header = text.match(HEADER);
    if (!header) {
      problems.push(`${spec}: no "// e2e-writes: <keys>" header line (use "none" when the spec changes nothing)`);
      continue;
    }
    const keys = header[1].split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (keys.length === 1 && keys[0] === "none") {
      const calls = [...text.matchAll(DIRECT_WRITE)].length;
      if (calls) problems.push(`${spec}: declares "none" but calls a data-changing API ${calls} time(s) directly - declare the records it writes`);
      continue;
    }
    for (const key of new Set(keys)) {
      if (key === "none") problems.push(`${spec}: "none" cannot be combined with other keys`);
      else owners.set(key, [...(owners.get(key) || []), spec]);
    }
  }
  for (const [key, list] of owners) {
    if (list.length > 1) problems.push(`"${key}" is written by ${list.join(" and ")} - give one of them its own demo student`);
  }
  return problems;
}

export function assertOwnership(dir = E2E_DIR) {
  const problems = checkOwnership(dir);
  if (problems.length) {
    throw new Error(`e2e data ownership check failed (see e2e/DATA-OWNERSHIP.md):\n  - ${problems.join("\n  - ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkOwnership();
  if (problems.length) {
    console.error(`e2e data ownership check failed (see e2e/DATA-OWNERSHIP.md):\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("e2e data ownership: ok");
}
