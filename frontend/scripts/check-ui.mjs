// The Phase 5 machine check (.planning/phases/05-design-system/05-UI-SPEC.md section 9). No dependencies.
//
// Counts six "bad habits" in frontend/src/**/*.{js,jsx} and holds them to a ratchet: a count may fall, never rise.
//   node scripts/check-ui.mjs            table of count / baseline; exit 1 if any count is above the baseline
//   node scripts/check-ui.mjs --update   rewrite check-ui.baseline.json (refused if any metric rose)
//   node scripts/check-ui.mjs --strict   exit 1 unless every metric is 0 (the end state of Phase 5)
//   node scripts/check-ui.mjs --by-file  top offenders per metric as file:count
//   node scripts/check-ui.mjs --json     machine output
// Test-only overrides: --src <dir> --baseline <file> --allow <file>.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const METRICS = ["arbitraryText", "offScaleText", "rawTable", "rawModal", "rawH1", "localStatusStyle"];

const DESCRIPTIONS = {
  arbitraryText: "text-[13px] style sizes",
  offScaleText: "text-xl/3xl/4xl/5xl/6xl",
  rawTable: "<table> outside DataTable",
  rawModal: "fixed inset-0 overlays",
  rawH1: "<h1> outside PageHeader",
  localStatusStyle: "local status colour maps",
};

const ARBITRARY_TEXT = /\btext-\[[0-9.]+(?:px|rem|em)\]/g;
const OFF_SCALE_TEXT = /\btext-(?:xl|3xl|4xl|5xl|6xl)(?![\w-])/g;
const RAW_TABLE = /<table\b/g;
const RAW_H1 = /<h1\b/g;
const LOCAL_STATUS = /ring-inset|\bstatusClass\b|\b(?:TONE_CLASSES|STATUS_STYLES|STATUS_CLASSES|CHECK_TONES)\b/g;
// A string literal (double, single or backtick quoted). Template literals may hold ${...}; that is fine for a word test.
const STRING_LITERAL = /"[^"\n]*"|'[^'\n]*'|`[^`]*`/g;
const HAS_FIXED = /(?:^|[\s"'`:])fixed(?![\w.\/-])/;
const HAS_INSET_0 = /(?:^|[\s"'`:])inset-0(?![\w.\/-])/;

/** Files the check does not look at: the new component folder and the status map (they own these patterns). */
export function isExcluded(path) {
  const p = path.replace(/\\/g, "/").replace(/^\.?\//, "");
  return p.startsWith("components/ui/") || p === "lib/status.js";
}

const matches = (text, re) => text.match(re) || [];

/**
 * The allow-list entry for one file and metric: `{ metric: { "path": ["hit", ...] } }` or, with a reason,
 * `{ metric: { "path": { "hits": ["hit", ...], "reason": "why" } } }`. Returns the set of matched strings that do not count.
 */
function allowedHits(allow, metric, path) {
  const entry = allow?.[metric]?.[path];
  if (!entry) return new Set();
  return new Set(Array.isArray(entry) ? entry : entry.hits || []);
}

/** Per-file counts for one file (not excluded). `allow` is { metric: { "pages/Login.jsx": ["text-3xl"] } }. */
function countFile({ path, text }, allow) {
  const out = Object.fromEntries(METRICS.map((m) => [m, 0]));
  const counted = (metric, re) => {
    const allowed = allowedHits(allow, metric, path);
    return matches(text, re).filter((hit) => !allowed.has(hit)).length;
  };
  out.arbitraryText = counted("arbitraryText", ARBITRARY_TEXT);
  out.offScaleText = counted("offScaleText", OFF_SCALE_TEXT);
  out.rawTable = counted("rawTable", RAW_TABLE);
  out.rawH1 = counted("rawH1", RAW_H1);
  out.localStatusStyle = counted("localStatusStyle", LOCAL_STATUS);
  out.rawModal = matches(text, STRING_LITERAL).filter((s) => HAS_FIXED.test(s) && HAS_INSET_0.test(s)).length;
  return out;
}

/** files: [{ path, text }] with `path` relative to src/ and forward slashes. Returns { metric: total }. */
export function countMetrics(files, allow = {}) {
  const totals = Object.fromEntries(METRICS.map((m) => [m, 0]));
  for (const file of files) {
    if (isExcluded(file.path)) continue;
    const c = countFile(file, allow);
    for (const m of METRICS) totals[m] += c[m];
  }
  return totals;
}

/** Same walk, but per file: { metric: [[path, n], ...] } sorted by n descending. */
export function countByFile(files, allow = {}) {
  const out = Object.fromEntries(METRICS.map((m) => [m, []]));
  for (const file of files) {
    if (isExcluded(file.path)) continue;
    const c = countFile(file, allow);
    for (const m of METRICS) if (c[m] > 0) out[m].push([file.path, c[m]]);
  }
  for (const m of METRICS) out[m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return out;
}

/** The ratchet: `rose` metrics fail, `lower` metrics are good news. A metric missing from the baseline counts as 0. */
export function ratchet(counts, baseline) {
  const rose = [];
  const lower = [];
  for (const m of METRICS) {
    const base = baseline?.[m] ?? 0;
    if (counts[m] > base) rose.push(m);
    else if (counts[m] < base) lower.push(m);
  }
  return { ok: rose.length === 0, rose, lower };
}

function readSources(srcDir) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(name)) {
        files.push({ path: relative(srcDir, full).replace(/\\/g, "/"), text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(srcDir);
  return files;
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function flagValue(args, flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : fallback;
}

function table(counts, baseline) {
  const rows = [["metric", "count", "baseline", "what"]];
  for (const m of METRICS) rows.push([m, String(counts[m]), String(baseline[m] ?? 0), DESCRIPTIONS[m]]);
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows
    .map((r) => r.map((cell, i) => (i === 1 || i === 2 ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join("  ").trimEnd())
    .join("\n");
}

function main(args) {
  const srcDir = flagValue(args, "--src", resolve(HERE, "..", "src"));
  const baselinePath = flagValue(args, "--baseline", join(HERE, "check-ui.baseline.json"));
  const allowPath = flagValue(args, "--allow", join(HERE, "check-ui.allow.json"));
  const baseline = readJson(baselinePath, {});
  const allow = readJson(allowPath, {});
  const files = readSources(srcDir);
  const counts = countMetrics(files, allow);
  const { ok, rose, lower } = ratchet(counts, baseline);
  const strictOk = METRICS.every((m) => counts[m] === 0);

  if (args.includes("--json")) {
    const metrics = Object.fromEntries(METRICS.map((m) => [m, { count: counts[m], baseline: baseline[m] ?? 0 }]));
    console.log(JSON.stringify({ ok, strictOk, rose, lower, metrics }, null, 2));
    return args.includes("--strict") ? (strictOk ? 0 : 1) : ok ? 0 : 1;
  }

  if (args.includes("--by-file")) {
    const byFile = countByFile(files, allow);
    for (const m of METRICS) {
      console.log(`${m} (${counts[m]}) - ${DESCRIPTIONS[m]}`);
      const top = byFile[m].slice(0, 15);
      if (!top.length) console.log("  none");
      for (const [path, n] of top) console.log(`  ${path}:${n}`);
    }
    return 0;
  }

  if (args.includes("--update")) {
    if (!ok) {
      console.error(`check:ui --update refused: ${rose.join(", ")} rose above the baseline. Fix the code, not the baseline.`);
      console.error(table(counts, baseline));
      return 1;
    }
    writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(METRICS.map((m) => [m, counts[m]])), null, 2) + "\n");
    console.log(`check:ui baseline updated${lower.length ? ` (lowered: ${lower.join(", ")})` : " (no change)"}.`);
    return 0;
  }

  console.log(table(counts, baseline));
  if (args.includes("--strict")) {
    if (strictOk) {
      console.log("\ncheck:ui --strict: every metric is 0.");
      return 0;
    }
    const left = METRICS.filter((m) => counts[m] > 0);
    console.error(`\ncheck:ui --strict FAILED: ${left.map((m) => `${m}=${counts[m]}`).join(", ")} (target 0).`);
    return 1;
  }
  if (!ok) {
    console.error(`\ncheck:ui FAILED: ${rose.map((m) => `${m} ${baseline[m] ?? 0} -> ${counts[m]}`).join(", ")}. Counts may fall, never rise.`);
    return 1;
  }
  console.log(
    lower.length
      ? `\ncheck:ui ok. ${lower.join(", ")} fell below the baseline: run with --update to lock it in.`
      : "\ncheck:ui ok (counts equal the baseline).",
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
