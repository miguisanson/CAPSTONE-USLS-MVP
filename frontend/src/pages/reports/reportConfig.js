// The older reports of the Reports page (IM20) that the redesign keeps (I-141): what each one can be filtered by, and where
// its filter choices come from. The program is chosen in the frame at the top of the page (pages/reports/ReportsFrame.jsx),
// so it is not repeated here. The columns come from the API (the same ones the Excel and PDF downloads have).

/** Filter definitions. `options` is the name of the list in the report's own `options` block. */
const STAGE = { key: "stage", label: "Stage", options: "stages" };
const TERM = { key: "term", label: "Term", options: "terms" };

export const REPORTS = [
  {
    id: "cohorts",
    tab: "Cohorts by stage",
    about: "How many students of each program and entry year are at each lifecycle stage.",
    filters: [STAGE, { key: "entry", label: "AY entry", options: "entries", any: "Any entry year" }],
  },
  {
    id: "graduation",
    tab: "Graduation candidates",
    about: "Who can graduate, what is still missing, and where each student stands in a batch.",
    filters: [
      STAGE,
      { key: "eligibility", label: "Eligibility", options: "eligibilities" },
      { key: "batch_status", label: "Batch status", options: "batch_statuses" },
    ],
  },
  {
    id: "overdue",
    tab: "Overdue and pending",
    about: "Overdue tasks and requests still waiting for an answer, by office, longest wait first.",
    filters: [STAGE, TERM, { key: "office", label: "Office", options: "offices" }, { key: "kind", label: "Type", options: "kinds" }],
  },
  {
    id: "defenses",
    tab: "Defenses",
    about: "Defenses held and coming up, with the panel and the verdict.",
    filters: [TERM, { key: "when", label: "Status", options: "whens" }, { key: "type", label: "Defense", options: "types" }],
  },
];

/** A filter list as [{ value, label }]: programs show their code, everything else its own words. */
export function choicesFor(spec, options = {}) {
  const list = options[spec.options] || [];
  return list.map((item) => (typeof item === "string" ? { value: item, label: item } : { value: String(item.id), label: item.code }));
}
