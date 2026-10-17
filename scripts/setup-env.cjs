#!/usr/bin/env node
// Prepares the local .env for v5.2 (owner decisions IM3, IM22). Run it yourself: `npm run setup:env`.
//  - removes a DATABASE_URL line that points at MySQL (the app is SQLite only now and refuses it);
//  - adds an empty GOOGLE_API_KEY= line if there is none, ready for you to paste your Gemini key after the "=".
// It never prints the file's contents or any value - only what it changed. `--file <path>` targets another file.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const fileArg = args.indexOf("--file");
const envPath = fileArg >= 0 ? path.resolve(args[fileArg + 1]) : path.join(__dirname, "..", ".env");

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

if (!changes.length) {
  console.log(`${envPath}: nothing to change (no MySQL line; a Gemini key line is already there).`);
  process.exit(0);
}
fs.writeFileSync(envPath, lines.join(newline));
console.log(`${existed ? "Updated" : "Created"} ${envPath}:`);
for (const change of changes) console.log(`  - ${change}`);
console.log("Then run `npm run seed` once so your database matches everyone else's.");
