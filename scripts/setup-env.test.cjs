// node --test scripts/setup-env.test.cjs — checks the .env helper on throwaway files (never the real .env).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const script = path.join(__dirname, "setup-env.cjs");
const run = (file) => execFileSync(process.execPath, [script, "--file", file], { encoding: "utf8" });
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "setup-env-")), "sample-env.txt");

test("removes a MySQL DATABASE_URL, keeps other lines, adds an empty Gemini key line", () => {
  const file = tmp();
  fs.writeFileSync(file, "SECRET_KEY=abc\r\nDATABASE_URL=mysql+pymysql://u:p@localhost/x\r\nFLASK_PORT=5050\r\n");
  const out = run(file);
  const text = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(text, /mysql/i);
  assert.match(text, /SECRET_KEY=abc/);
  assert.match(text, /FLASK_PORT=5050/);
  assert.match(text, /^GOOGLE_API_KEY=$/m);
  assert.doesNotMatch(out, /abc|5050|mysql\+pymysql/, "the output must not print values");
});

test("a second run changes nothing and keeps an existing key untouched", () => {
  const file = tmp();
  fs.writeFileSync(file, "GOOGLE_API_KEY=existing-value\n");
  const out = run(file);
  assert.match(out, /nothing to change/);
  assert.strictEqual(fs.readFileSync(file, "utf8"), "GOOGLE_API_KEY=existing-value\n");
  assert.doesNotMatch(out, /existing-value/);
});

test("creates the file when there is none", () => {
  const file = tmp();
  run(file);
  assert.match(fs.readFileSync(file, "utf8"), /^GOOGLE_API_KEY=$/m);
});

test("leaves a SQLite DATABASE_URL alone", () => {
  const file = tmp();
  fs.writeFileSync(file, "DATABASE_URL=sqlite:///x.sqlite3\nGOOGLE_API_KEY=k\n");
  run(file);
  assert.match(fs.readFileSync(file, "utf8"), /DATABASE_URL=sqlite/);
});
