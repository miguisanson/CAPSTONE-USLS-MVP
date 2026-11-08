import { useCallback, useState } from "react";

// What one signed-in person has already opened, kept in this browser (owner 2026-11-08):
// - "Needs your action" rows stay green with a "New" mark until the person opens them;
// - a board card that moved by itself stays green in its new column until someone opens it.
// Storage can be missing (private window, blocked site data); then nothing is remembered and nothing breaks.

const PREFIX = "usls-seen:";
const MAX_KEYS = 800; // oldest marks are dropped first so the stored list stays small

export function readMarks(scope) {
  try {
    const raw = window.localStorage.getItem(PREFIX + scope);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeMarks(scope, marks) {
  try {
    const entries = Object.entries(marks);
    const kept = entries.length > MAX_KEYS ? Object.fromEntries(entries.slice(entries.length - MAX_KEYS)) : marks;
    window.localStorage.setItem(PREFIX + scope, JSON.stringify(kept));
  } catch {
    // storage blocked: the marks live only for this page view
  }
}

/**
 * `marks` maps an item key to what was seen (any string, e.g. the column a card was in).
 * `scope` should include the account id so two people on one computer do not share marks.
 */
export function useSeenMarks(scope) {
  const [state, setState] = useState(() => ({ scope, marks: readMarks(scope) }));
  // A new scope (another account signed in) reads its own marks.
  const marks = state.scope === scope ? state.marks : readMarks(scope);
  if (state.scope !== scope) setState({ scope, marks });

  const mark = useCallback(
    (key, value = "1") => {
      setState((current) => {
        const base = current.scope === scope ? current.marks : readMarks(scope);
        if (base[key] === value) return current;
        const next = { ...base };
        delete next[key]; // re-insert so it counts as the newest
        next[key] = value;
        writeMarks(scope, next);
        return { scope, marks: next };
      });
    },
    [scope],
  );

  const markMany = useCallback(
    (pairs) => {
      setState((current) => {
        const base = current.scope === scope ? current.marks : readMarks(scope);
        let changed = false;
        const next = { ...base };
        for (const [key, value] of pairs) {
          if (next[key] !== value) {
            delete next[key];
            next[key] = value;
            changed = true;
          }
        }
        if (!changed) return current;
        writeMarks(scope, next);
        return { scope, marks: next };
      });
    },
    [scope],
  );

  return { marks, mark, markMany };
}
