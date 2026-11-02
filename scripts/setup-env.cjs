#!/usr/bin/env node
// Prepares the local .env for v5.2 (owner decisions IM3, IM22). Run it yourself: `npm run setup:env`.
//  - removes a DATABASE_URL line that points at MySQL (the app is SQLite only now and refuses it);
//  - adds an empty GOOGLE_API_KEY= line if there is none, ready for you to paste your Gemini key after the "=";
//  - adds the five empty GOOGLE_CALENDAR_* lines if they are missing;
//  - with --uat (User Acceptance Testing at https://miguisanson.dev): SESSION_COOKIE_SECURE=1 and the public
//    Google Calendar redirect URI - added when missing, an empty redirect line is filled, a value that is
//    already there is never replaced (a differing SESSION_COOKIE_SECURE is only reported).
// It never prints the file's contents or any value - only what it changed. `--file <path>` targets another file.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const fileArg = args.indexOf("--file");
const envPath = fileArg >= 0 ? path.resolve(args[fileArg + 1]) : path.join(__dirname, "..", ".env");

const uat = args.includes("--uat");
const UAT_REDIRECT = "https://miguisanson.dev/api/integrations/google-calendar/callback";
const CALENDAR_KEYS = [
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CALENDAR_TIMEZONE",
];

const existed = fs.existsSync(envPath);
const original = existed ? fs.readFileSync(envPath, "utf8") : "";
const newline = original.includes("\r\n") ? "\r\n" : "\n";
let lines = original.length ? original.split(/\r?\n/) : [];
const changes = [];

const isMysqlUrl = (line) => /^\s*DATABASE_URL\s*=/.test(line) && /mysql/i.test(line);
if (lines.some(isMysqlUrl)) {
  lines = lines.filter((line) => !isMysqlUrl(line));
  changes.push("removed the MySQL DATABASE_URL line (the app now uses its own SQLite file)");
}

const hasKeyLine = lines.some((line) => /^\s*(GOOGLE_API_KEY|GOOGLE_AI_STUDIO_API_KEY)\s*=/.test(line));
if (!hasKeyLine) {
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  lines.push("", "# Gemini key for the Policy Assistant (free at https://aistudio.google.com/apikey). Paste it after the =", "GOOGLE_API_KEY=", "");
  changes.push("added an empty GOOGLE_API_KEY= line - open .env and paste your Gemini key after the =");
}

const keyLineIndex = (key) => lines.findIndex((line) => new RegExp(`^\s*${key}\s*=`).test(line));
const keyValue = (key) => {
  const index = keyLineIndex(key);
  return index < 0 ? null : lines[index].replace(/^[^=]*=/, "").trim();
};
const appendLines = (...added) => {
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  lines.push("", ...added, "");
};

const missingCalendar = CALENDAR_KEYS.filter((key) => keyLineIndex(key) < 0);
if (missingCalendar.length) {
  const wanted = missingCalendar.map((key) => (uat && key === "GOOGLE_CALENDAR_REDIRECT_URI" ? `${key}=${UAT_REDIRECT}` : key === "GOOGLE_CALENDAR_TIMEZONE" ? `${key}=Asia/Manila` : `${key}=`));
  appendLines("# Google Calendar for faculty availability (see README, 'Google Calendar availability'). Fill in after the =", ...wanted);
  changes.push(`added the missing Google Calendar lines (${missingCalendar.join(", ")})`);
}

if (uat) {
  if (keyValue("GOOGLE_CALENDAR_REDIRECT_URI") === "") {
    lines[keyLineIndex("GOOGLE_CALENDAR_REDIRECT_URI")] = `GOOGLE_CALENDAR_REDIRECT_URI=${UAT_REDIRECT}`;
    changes.push("filled the empty GOOGLE_CALENDAR_REDIRECT_URI with the miguisanson.dev address");
  } else if (!missingCalendar.includes("GOOGLE_CALENDAR_REDIRECT_URI") && keyValue("GOOGLE_CALENDAR_REDIRECT_URI") !== UAT_REDIRECT) {
    console.log("Note: GOOGLE_CALENDAR_REDIRECT_URI already has a value that is not the miguisanson.dev address - left as it is; change it yourself if UAT needs it.");
  }
  if (keyLineIndex("SESSION_COOKIE_SECURE") < 0) {
    appendLines("# UAT is served over https through the Cloudflare Tunnel", "SESSION_COOKIE_SECURE=1");
    changes.push("added SESSION_COOKIE_SECURE=1");
  } else if (keyValue("SESSION_COOKIE_SECURE") !== "1") {
    console.log("Note: SESSION_COOKIE_SECURE is set to something other than 1 - UAT over https needs 1. Left as it is; change it yourself.");
  }
}

if (!changes.length) {
  console.log(`${envPath}: nothing to change (nothing missing, no MySQL line).`);
  process.exit(0);
}
fs.writeFileSync(envPath, lines.join(newline));
console.log(`${existed ? "Updated" : "Created"} ${envPath}:`);
for (const change of changes) console.log(`  - ${change}`);
console.log("Then run `npm run seed` once so your database matches everyone else's.");
