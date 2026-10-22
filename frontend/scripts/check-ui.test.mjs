// Test for scripts/check-ui.mjs (Phase 5 UI-SPEC section 9). Run: node --test scripts/check-ui.test.mjs
// Written before the script exists. Fixture strings stand in for source files; the CLI is run against a
// throwaway src/ folder so the real baseline is never touched.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { METRICS, countMetrics, isExcluded, ratchet } from "./check-ui.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-ui.mjs");
const file = (path, text) => ({ path, text });
const count = (files, allow = {}) => countMetrics(files, allow);

test("the six metrics are exactly the ones the spec names", () => {
  assert.deepEqual(METRICS, ["arbitraryText", "offScaleText", "rawTable", "rawModal", "rawH1", "localStatusStyle"]);
});

test("arbitraryText: counts text-[13px], text-[0.8rem], text-[1.1em]; ignores text-xs and text-[#fff]", () => {
  const hit = file("pages/A.jsx", `<p className="text-[13px] sm:text-[0.8rem] text-[1.1em]">x</p>`);
  const miss = file("pages/B.jsx", `<p className="text-xs text-[#fff] text-2xs">x</p>`);
  assert.equal(count([hit]).arbitraryText, 3);
  assert.equal(count([miss]).arbitraryText, 0);
});

test("offScaleText: counts text-xl/3xl/4xl/5xl/6xl but not text-2xl, text-lg or text-xlarge", () => {
  const hit = file("pages/A.jsx", `<h2 className="text-xl md:text-3xl text-4xl text-5xl text-6xl">x</h2>`);
  const miss = file("pages/B.jsx", `<h2 className="text-2xl text-lg text-base text-xlarge">x</h2>`);
  assert.equal(count([hit]).offScaleText, 5);
  assert.equal(count([miss]).offScaleText, 0);
});

test("offScaleText: the allowlist lets pages/Login.jsx use text-3xl, and nothing else", () => {
  const allow = { offScaleText: { "pages/Login.jsx": ["text-3xl"] } };
  const login = file("pages/Login.jsx", `<h1 className="text-3xl">x</h1><p className="text-xl">y</p>`);
  const other = file("pages/Other.jsx", `<h1 className="text-3xl">x</h1>`);
  assert.equal(count([login], allow).offScaleText, 1, "text-3xl allowed in Login, text-xl still counted");
  assert.equal(count([other], allow).offScaleText, 1, "text-3xl is not allowed anywhere else");
  assert.equal(count([login]).offScaleText, 2, "without the allowlist both count");
});

test("the allowlist works for every metric, with a reason, and only for the named file and hit", () => {
  const allow = {
    rawTable: { "lib/print.js": { hits: ["<table"], reason: "print window" } },
    rawH1: { "lib/print.js": { hits: ["<h1"], reason: "print window" } },
  };
  const text = `<h1>x</h1><table></table>`;
  const c = count([file("lib/print.js", text), file("pages/A.jsx", text)], allow);
  assert.equal(c.rawTable, 1, "only the other file counts");
  assert.equal(c.rawH1, 1);
  assert.equal(count([file("lib/print.js", text)]).rawTable, 1, "without the allowlist it counts");
});

test("rawTable and rawH1: count <table and <h1 tags, not <tbody or <h10", () => {
  const hit = file("pages/A.jsx", `<table className="w-full"><tbody/></table><h1>Title</h1><h1 className="x">T</h1>`);
  const miss = file("pages/B.jsx", `<tablet/><h10/><thead/>`);
  const c = count([hit]);
  assert.equal(c.rawTable, 1);
  assert.equal(c.rawH1, 2);
  assert.equal(count([miss]).rawTable, 0);
  assert.equal(count([miss]).rawH1, 0);
});

test("rawModal: one class string holding both `fixed` and `inset-0` is a hit; either alone, or inset-0.5, is not", () => {
  const hit = file(
    "pages/A.jsx",
    `<div className="fixed inset-0 z-50 bg-black/40"/><div className={\`fixed inset-0 \${open ? "flex" : "hidden"}\`}/>`,
  );
  const miss = file(
    "pages/B.jsx",
    `<div className="fixed bottom-4 right-4"/><div className="absolute inset-0"/><div className="fixed inset-0.5"/>`,
  );
  const split = file("pages/C.jsx", `<div className="fixed top-0"/>\n<div className="inset-0"/>`);
  assert.equal(count([hit]).rawModal, 2);
  assert.equal(count([miss]).rawModal, 0);
  assert.equal(count([split]).rawModal, 0, "the two words are in different class strings");
});

test("localStatusStyle: ring-inset, statusClass and the four local tone-map names", () => {
  const hit = file(
    "pages/A.jsx",
    `const TONE_CLASSES = {}; const STATUS_STYLES = {}; const STATUS_CLASSES = {}; const CHECK_TONES = {};
     <span className={\`ring-1 ring-inset \${statusClass(v)}\`}/>`,
  );
  const miss = file("pages/B.jsx", `const MY_TONE_CLASSES_X = 1; const statusClassName = 2; <span className="ring-1 ring-brand-200"/>`);
  assert.equal(count([hit]).localStatusStyle, 6);
  assert.equal(count([miss]).localStatusStyle, 0);
});

test("excluded paths: components/ui/ and lib/status.js are never counted", () => {
  const dirty = `<table/><h1>x</h1><div className="fixed inset-0 text-[13px] text-xl ring-inset"/>`;
  assert.equal(isExcluded("components/ui/Modal.jsx"), true);
  assert.equal(isExcluded("components/ui/index.js"), true);
  assert.equal(isExcluded("lib/status.js"), true);
  assert.equal(isExcluded("components/ui.jsx"), false, "the old single file is still counted");
  assert.equal(isExcluded("components/uiKit/X.jsx"), false);
  assert.equal(isExcluded("pages/ui/X.jsx"), false);
  const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  assert.equal(total(count([file("components/ui/Modal.jsx", dirty), file("lib/status.js", dirty)])), 0);
  assert.ok(total(count([file("components/ui.jsx", dirty)])) >= 6);
});

test("ratchet: a rise fails, equal passes, a drop passes and is reported as lower", () => {
  const baseline = { arbitraryText: 10, offScaleText: 5, rawTable: 3, rawModal: 2, rawH1: 1, localStatusStyle: 4 };
  const same = ratchet({ ...baseline }, baseline);
  assert.equal(same.ok, true);
  assert.deepEqual(same.rose, []);
  const rise = ratchet({ ...baseline, rawTable: 4 }, baseline);
  assert.equal(rise.ok, false);
  assert.deepEqual(rise.rose, ["rawTable"]);
  const drop = ratchet({ ...baseline, rawH1: 0 }, baseline);
  assert.equal(drop.ok, true);
  assert.deepEqual(drop.lower, ["rawH1"]);
});

// ---- CLI against a throwaway src folder -------------------------------------------------------------------
function sandbox(files, baseline, allow = {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-ui-"));
  const src = join(dir, "src");
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(src, rel)), { recursive: true });
    writeFileSync(join(src, rel), text);
  }
  writeFileSync(join(dir, "baseline.json"), JSON.stringify(baseline));
  writeFileSync(join(dir, "allow.json"), JSON.stringify(allow));
  const run = (...args) =>
    spawnSync(process.execPath, [SCRIPT, "--src", src, "--baseline", join(dir, "baseline.json"), "--allow", join(dir, "allow.json"), ...args], {
      encoding: "utf8",
    });
  return { dir, run, baselineText: () => readFileSync(join(dir, "baseline.json"), "utf8") };
}
const ZERO = { arbitraryText: 0, offScaleText: 0, rawTable: 0, rawModal: 0, rawH1: 0, localStatusStyle: 0 };

test("CLI default: exit 0 when counts equal the baseline, exit 1 when one rises, table is printed", () => {
  const s = sandbox({ "pages/A.jsx": `<h1>x</h1><p className="text-[13px]"/>` }, { ...ZERO, rawH1: 1, arbitraryText: 1 });
  try {
    const ok = s.run();
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /rawH1\s+1\s+1/);
    const rise = sandbox({ "pages/A.jsx": `<h1>x</h1><p className="text-[13px] text-[14px]"/>` }, { ...ZERO, rawH1: 1, arbitraryText: 1 });
    try {
      const bad = rise.run();
      assert.equal(bad.status, 1, bad.stdout + bad.stderr);
      assert.match(bad.stdout + bad.stderr, /arbitraryText/);
    } finally {
      rmSync(rise.dir, { recursive: true, force: true });
    }
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("CLI default: a lower count passes and suggests --update", () => {
  const s = sandbox({ "pages/A.jsx": `<p/>` }, { ...ZERO, rawH1: 2 });
  try {
    const r = s.run();
    assert.equal(r.status, 0);
    assert.match(r.stdout, /--update/);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("CLI --update: lowers the baseline, but refuses (exit 1, file untouched) when a metric rose", () => {
  const down = sandbox({ "pages/A.jsx": `<h1>x</h1>` }, { ...ZERO, rawH1: 3 });
  const up = sandbox({ "pages/A.jsx": `<h1>x</h1><h1>y</h1>` }, { ...ZERO, rawH1: 1 });
  try {
    assert.equal(down.run("--update").status, 0);
    assert.equal(JSON.parse(down.baselineText()).rawH1, 1);
    const before = up.baselineText();
    assert.equal(up.run("--update").status, 1);
    assert.equal(up.baselineText(), before);
  } finally {
    rmSync(down.dir, { recursive: true, force: true });
    rmSync(up.dir, { recursive: true, force: true });
  }
});

test("CLI --strict: exit 1 while any metric is above 0, exit 0 when all are 0", () => {
  const dirty = sandbox({ "pages/A.jsx": `<h1>x</h1>` }, { ...ZERO, rawH1: 1 });
  const clean = sandbox({ "pages/A.jsx": `<p/>` }, ZERO);
  try {
    assert.equal(dirty.run("--strict").status, 1);
    assert.equal(clean.run("--strict").status, 0);
  } finally {
    rmSync(dirty.dir, { recursive: true, force: true });
    rmSync(clean.dir, { recursive: true, force: true });
  }
});

test("CLI --json prints machine output; --by-file lists file:count per metric", () => {
  const s = sandbox({ "pages/A.jsx": `<h1>x</h1><h1>y</h1>`, "pages/B.jsx": `<h1>z</h1>` }, { ...ZERO, rawH1: 3 });
  try {
    const j = JSON.parse(s.run("--json").stdout);
    assert.equal(j.metrics.rawH1.count, 3);
    assert.equal(j.metrics.rawH1.baseline, 3);
    assert.equal(j.ok, true);
    const b = s.run("--by-file").stdout;
    assert.match(b, /pages\/A\.jsx:2/);
    assert.match(b, /pages\/B\.jsx:1/);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("CLI: the ui/ folder and lib/status.js inside the src folder are skipped", () => {
  const s = sandbox(
    { "components/ui/Modal.jsx": `<div className="fixed inset-0"/><table/>`, "lib/status.js": `const STATUS_STYLES = 1`, "pages/A.jsx": `<p/>` },
    ZERO,
  );
  try {
    assert.equal(s.run("--strict").status, 0);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
