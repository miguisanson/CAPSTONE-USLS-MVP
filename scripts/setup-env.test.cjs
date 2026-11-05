// node --test scripts/setup-env.test.cjs — checks the .env helper on throwaway files (never the real .env).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const script = path.join(__dirname, "setup-env.cjs");
const run = (file, ...extra) => execFileSync(process.execPath, [script, "--file", file, ...extra], { encoding: "utf8" });
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
  run(file); // the first run may add the empty Google Calendar lines
  const afterFirst = fs.readFileSync(file, "utf8");
  assert.match(afterFirst, /^GOOGLE_API_KEY=existing-value$/m);
  const out = run(file);
  assert.match(out, /nothing to change/);
  assert.strictEqual(fs.readFileSync(file, "utf8"), afterFirst);
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

const CALENDAR_KEYS = [
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CALENDAR_TIMEZONE",
];
const UAT_REDIRECT = "https://miguisanson.dev/api/integrations/google-calendar/callback";
const redirectLine = new RegExp(`^GOOGLE_CALENDAR_REDIRECT_URI=${UAT_REDIRECT.replace(/\./g, "\.")}$`, "m");

test("adds the five empty Google Calendar lines when they are missing", () => {
  const file = tmp();
  fs.writeFileSync(file, "GOOGLE_API_KEY=k\n");
  run(file);
  const text = fs.readFileSync(file, "utf8");
  for (const key of CALENDAR_KEYS.filter((k) => k !== "GOOGLE_CALENDAR_TIMEZONE")) assert.match(text, new RegExp(`^${key}=$`, "m"), key);
  // An EMPTY timezone would be sent to Google as "", so that one line carries the real default.
  assert.match(text, /^GOOGLE_CALENDAR_TIMEZONE=Asia\/Manila$/m);
});

test("never overwrites or prints existing Google Calendar values, adds only the missing ones", () => {
  const file = tmp();
  fs.writeFileSync(file, "GOOGLE_API_KEY=k\nGOOGLE_CALENDAR_CLIENT_ID=my-client-id\nGOOGLE_CALENDAR_CLIENT_SECRET=my-secret\n");
  const out = run(file);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^GOOGLE_CALENDAR_CLIENT_ID=my-client-id$/m);
  assert.match(text, /^GOOGLE_CALENDAR_CLIENT_SECRET=my-secret$/m);
  assert.strictEqual((text.match(/GOOGLE_CALENDAR_CLIENT_ID=/g) || []).length, 1);
  assert.match(text, /^GOOGLE_CALENDAR_TIMEZONE=Asia\/Manila$/m);
  assert.doesNotMatch(out, /my-client-id|my-secret/);
});

test("--uat adds the secure cookie and the public redirect URI, once", () => {
  const file = tmp();
  fs.writeFileSync(file, "GOOGLE_API_KEY=k\n");
  run(file, "--uat");
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^SESSION_COOKIE_SECURE=1$/m);
  assert.match(text, redirectLine);
  assert.strictEqual((text.match(/^GOOGLE_CALENDAR_REDIRECT_URI=/gm) || []).length, 1, "no empty duplicate");
  assert.match(run(file, "--uat"), /nothing to change/);
});

test("--uat fills an empty redirect line but never replaces a value that is already there", () => {
  const file = tmp();
  fs.writeFileSync(file, "GOOGLE_API_KEY=k\nGOOGLE_CALENDAR_REDIRECT_URI=\nSESSION_COOKIE_SECURE=0\n");
  const out = run(file, "--uat");
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, redirectLine);
  assert.match(text, /^SESSION_COOKIE_SECURE=0$/m, "an existing value is left alone");
  assert.match(out, /SESSION_COOKIE_SECURE/, "but the owner is told it differs from what UAT needs");

  const file2 = tmp();
  fs.writeFileSync(file2, "GOOGLE_API_KEY=k\nGOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/cb\n");
  run(file2, "--uat");
  assert.match(fs.readFileSync(file2, "utf8"), /^GOOGLE_CALENDAR_REDIRECT_URI=http:\/\/localhost:5000\/cb$/m);
});
