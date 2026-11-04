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
