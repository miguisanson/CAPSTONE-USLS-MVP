// Every role that can sign in. Source: ensure_demo_accounts() and ensure_faculty_account_schema() in
// app.py, and the HOME map in src/pages/Login.jsx. The registrar has no login (external office).
// The Academic Coordinator and Research Coordinator have their own role in the database; the login
// page offers them like any other account.
import { existsSync, readFileSync } from "node:fs";
import { STATE_FILE } from "./paths.mjs";

export const PASSWORD = "DemoPass123!";

export function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
}

// `home` is where Login.jsx sends the role after sign-in.
export const ROLES = [
  { key: "student", role: "student", email: "student@usls.edu.ph", home: "/student" },
  { key: "faculty", role: "faculty", email: () => loadState().facultyEmail, home: "/faculty-portal" },
  { key: "dean", role: "dean", email: "dean@usls.edu.ph", home: "/dean" },
  { key: "staff", role: "staff", email: "staff@usls.edu.ph", home: "/" },
  { key: "academic-coordinator", role: "academic_coordinator", email: "academic@usls.edu.ph", home: "/monitoring-sheet" },
  { key: "research-coordinator", role: "research_coordinator", email: "research@usls.edu.ph", home: "/workflow/graduation" },
  { key: "admin", role: "admin", email: "admin@usls.edu.ph", home: "/" },
];

export const emailOf = (entry) => (typeof entry.email === "function" ? entry.email() : entry.email);
