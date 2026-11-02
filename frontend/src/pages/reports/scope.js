// What every Reports page is about (I-141): program, entry cohort and period. They live in the address (?program_id=3&cohort=24-25&period=all),
// so a filtered page can be shared and a reload keeps it. The period starts on the last 12 months because the active term
// is new: this term alone would show almost no decisions or defenses.

export const DEFAULT_PERIOD = "last-12-months";
export const PERIODS = [
  { value: "last-12-months", label: "Last 12 months" },
  { value: "term", label: "This term" },
  { value: "previous", label: "Previous term" },
  { value: "all", label: "All time" },
];
/** The keys the frame owns; a tab change keeps them. */
export const FRAME_KEYS = ["program_id", "cohort", "period"];

/** The URL's filters as the API takes them (`term` is its name for the period; "This term" is the API default). */
export function apiScope(params) {
  const period = params.get("period") || DEFAULT_PERIOD;
  return { program_id: params.get("program_id") || "", cohort: params.get("cohort") || "", term: period === "term" ? "" : period };
}

/** Key for useApi dependencies. */
export const scopeKey = (scope) => `${scope.program_id}|${scope.cohort}|${scope.term}`;
