import { useEffect, useState } from "react";
import { api } from "../../api";

// Things the Monitoring Sheet already knows, so its forms pick or pre-fill them instead of asking the user to type them.

/** "AY 2026-2027 1st Semester" -> "26-27", the form of the sheet's "School year / AY entry". "" when the label has no year. */
export function ayEntryOf(label) {
  const match = /(\d{4})\s*-\s*(\d{4})/.exec(label || "");
  return match ? `${match[1].slice(2)}-${match[2].slice(2)}` : "";
}

/** The active faculty records an adviser can be picked from. `loaded` is false until the list has arrived (or failed). */
export function useActiveFaculty() {
  const [state, setState] = useState({ faculty: [], loaded: false });
  useEffect(() => {
    let active = true;
    api.faculty()
      .then((res) => active && setState({ faculty: (res.items || []).filter((f) => f.active !== false).map((f) => ({ id: f.id, name: f.name })), loaded: true }))
      .catch(() => active && setState({ faculty: [], loaded: true }));
    return () => { active = false; };
  }, []);
  return state;
}

export const facultyOptions = (faculty) => faculty.map((f) => ({ value: String(f.id), label: f.name }));

/** "26-27", "2026-27" or "2026-2027" -> "26-27"; "" when the text is not a school year. */
export function normalizeAyEntry(raw) {
  const match = /^\s*(\d{2}|\d{4})\s*-\s*(\d{2}|\d{4})\s*$/.exec(raw || "");
  return match ? `${match[1].slice(-2)}-${match[2].slice(-2)}` : "";
}

const startYearOf = (ay) => 2000 + Number(ay.slice(0, 2));
const ayValueOf = (start) => `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;

/**
 * Choices for "School year / AY entry", newest first. Value stays the sheet form ("26-27"), label reads "AY 2026-2027".
 * Years come from the configured terms plus every earlier year back to the oldest student on record; with no student
 * years to go by, back 8 years before the oldest term. `keep` (a value already stored) is always offered so nothing is lost.
 */
export function ayEntryOptions(termLabels = [], studentValues = [], keep = "") {
  const fromTerms = termLabels.map((label) => ayEntryOf(label)).filter(Boolean).map(startYearOf);
  const fromStudents = studentValues.map(normalizeAyEntry).filter(Boolean).map(startYearOf);
  if (!fromTerms.length && !fromStudents.length) return [];
  const newest = Math.max(...fromTerms, ...fromStudents);
  const oldest = fromStudents.length ? Math.min(...fromTerms, ...fromStudents) : Math.min(...fromTerms) - 8;
  const options = [];
  for (let start = newest; start >= oldest; start -= 1) options.push({ value: ayValueOf(start), label: `AY ${start}-${start + 1}` });
  const kept = normalizeAyEntry(keep) || (keep || "").trim();
  if (kept && !options.some((o) => o.value === kept)) options.push({ value: kept, label: `AY ${kept}` });
  return options;
}

/** Student IDs are exactly 7 digits everywhere (the server refuses anything else). "" = fine or blank. */
export function studentIdWarning(value) {
  const text = (value || "").trim();
  return !text || /^\d{7}$/.test(text) ? "" : "Student IDs are 7 digits, for example 1860101.";
}

/** "" when blank or only letters, spaces, hyphens, apostrophes and full stops, else a message. */
export function nameProblem(value) {
  const text = (value || "").trim();
  return !text || /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(text) ? "" : "Use letters only (spaces, hyphens and apostrophes are fine).";
}

/** "" when blank or shaped like name@domain.tld, else a message. Stricter than the old "@" check. */
export function emailProblem(value) {
  const text = (value || "").trim();
  return !text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? "" : "Enter an email like name@usls.edu.ph.";
}
