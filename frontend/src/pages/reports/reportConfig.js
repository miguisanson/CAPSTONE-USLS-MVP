// The Reports page (IM20): which reports exist, what each one can be filtered by, and where its filter choices come from.
// The columns come from the API (the same ones the Excel and PDF downloads have), so a report added on the server needs
// a line here for its tab and its filters only.

/** Filter definitions. `options` is the name of the list in the report's own `options` block. */
const PROGRAM = { key: "program_id", label: "Program", options: "programs" };
const STAGE = { key: "stage", label: "Stage", options: "stages" };
const TERM = { key: "term", label: "Term", options: "terms" };

export const REPORTS = [
  {
    id: "at-risk",
    tab: "Students at risk",
    about: "Who is behind, what is late, since when, and who has to act next.",
    filters: [PROGRAM, STAGE, { key: "risk", label: "Risk", options: "risks" }],
  },
  {
    id: "cohorts",
    tab: "Cohorts by stage",
    about: "How many students of each program and entry year are at each lifecycle stage.",
    filters: [PROGRAM, STAGE, { key: "entry", label: "AY entry", options: "entries", any: "Any entry year" }],
  },
  {
    id: "overdue",
    tab: "Overdue and pending",
    about: "Overdue tasks and requests still waiting for an answer, by office, longest wait first.",
    filters: [PROGRAM, STAGE, TERM, { key: "office", label: "Office", options: "offices" }, { key: "kind", label: "Type", options: "kinds" }],
  },
  {
    id: "defenses",
    tab: "Defenses",
    about: "Defenses held and coming up, with the panel and the verdict.",
    filters: [PROGRAM, TERM, { key: "when", label: "Status", options: "whens" }, { key: "type", label: "Defense", options: "types" }],
  },
  {
    id: "graduation",
    tab: "Graduation candidates",
    about: "Who can graduate, what is still missing, and where each student stands in a batch.",
    filters: [
      PROGRAM,
      STAGE,
      { key: "eligibility", label: "Eligibility", options: "eligibilities" },
      { key: "batch_status", label: "Batch status", options: "batch_statuses" },
    ],
  },
];

export const DAILY_TAB = { id: "daily-changes", tab: "Registrar changes" };
export const ANALYTICS_TAB = { id: "analytics", tab: "Analytics" };

// The charts use the dashboard API, which is the Graduate School's (staff and administrator).
export const ANALYTICS_ROLES = new Set(["staff", "admin"]);
export const ANALYTICS_FILTERS = [
  { key: "program_id", label: "Program", options: "programs" },
  { key: "stage", label: "Stage", options: "stages" },
  { key: "risk", label: "Risk", options: "risks" },
];
export const RISK_CHOICES = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed"];

/** Every filter key any tab uses, so a tab change can drop the ones the next tab does not have. */
export const FILTER_KEYS = Array.from(new Set([...REPORTS.flatMap((r) => r.filters), ...ANALYTICS_FILTERS].map((f) => f.key)));

/** A filter list as [{ value, label }]: programs show their code, everything else its own words. */
export function choicesFor(spec, options = {}) {
  const list = options[spec.options] || [];
  return list.map((item) => (typeof item === "string" ? { value: item, label: item } : { value: String(item.id), label: item.code }));
}
