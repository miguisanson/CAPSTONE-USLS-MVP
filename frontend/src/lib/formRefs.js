// One map from each workflow / process page to the Graduate School forms it uses and the Operations Manual section it
// follows (.planning/forms-ops/CONTRACT.md, folder table; FO7). PageHeader shows it as a small line under the description:
//   Forms GS-F-07 · Operations Manual 4.6
// A page opts in with <PageHeader forms="leave-of-absence" />, so every page of the same kind says the same thing (IM24).
// Plain JavaScript on purpose (no JSX): Node tests can import it.

/** key -> { forms: [GS-F codes], sections: [manual chapters] }. A kind that has no form is simply not listed. */
export const FORM_REFS = Object.freeze({
  "student-handoff": { forms: ["GS-F-01"], sections: ["4.1"] },
  enrollment: { forms: ["GS-F-02"], sections: ["4.2"] },
  "course-adjustments": { forms: ["GS-F-03", "GS-F-04"], sections: ["4.3"] },
  withdrawal: { forms: ["GS-F-05"], sections: ["4.4"] },
  "leave-of-absence": { forms: ["GS-F-07"], sections: ["4.6"] },
  readmission: { forms: ["GS-F-08"], sections: ["4.7"] },
  awol: { forms: ["GS-F-09", "GS-F-10"], sections: ["4.8", "4.9"] },
  "title-defense": { forms: ["GS-F-16", "GS-F-17", "GS-F-18"], sections: ["4.11"] },
  "adviser-designation": { forms: ["GS-F-19", "GS-F-20", "GS-F-21"], sections: ["4.12"] },
  "research-gate": { forms: ["GS-F-16", "GS-F-18", "GS-F-27"], sections: ["4.11", "4.13"] },
  "panel-matching": { forms: ["GS-F-17"], sections: ["4.11"] },
  "defense-scheduling": { forms: ["GS-F-28"], sections: ["4.16"] },
  practicum: { forms: ["GS-F-11", "GS-F-12", "GS-F-13"], sections: ["4.17"] },
  graduation: { forms: ["GS-F-42", "GS-F-43"], sections: ["4.18"] },
  "teaching-schedule": { forms: ["GS-F-47", "GS-F-48"], sections: ["4.20"] },
});

/** The muted line for a page, or "" when the page has no entry. */
export function formRefLine(key) {
  const ref = FORM_REFS[key];
  if (!ref) return "";
  return `Forms ${ref.forms.join(", ")} · Operations Manual ${ref.sections.join(", ")}`;
}

/** The one sentence under every approve / decide / endorse control (GS-P-03, Operations Manual 4.22). */
export const E_APPROVAL_NOTE = "Your decision is recorded as your electronic approval (GS-P-03).";
