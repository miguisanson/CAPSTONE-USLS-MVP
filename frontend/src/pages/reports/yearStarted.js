// "By year started" (I-357): for each school year students started, how many are on coursework, on thesis / dissertation,
// graduated. Derived from the stage counts of the cohorts report (GET /api/reports/cohorts), so no new server call is needed
// for the numbers. Plain JavaScript on purpose: Node can import it (scripts/year-started.test.mjs).

export const COURSEWORK_STAGES = ["Admission", "Coursework", "Comprehensive Exam"];
export const THESIS_STAGES = ["Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense"];
export const GRADUATED_STAGES = ["Completed"];
export const OTHER_STAGES = ["LOA", "AWOL", "Withdrawal In Progress", "Withdrawn"];

/** The states in the order they are shown. `other` keeps the total honest: leave, AWOL and withdrawn are none of the three. */
export const STATES = [
  { key: "coursework", label: "On coursework", stages: COURSEWORK_STAGES, color: "#2563eb", text: "#fff" },
  { key: "thesis", label: "On thesis / dissertation", stages: THESIS_STAGES, color: "#f59e0b", text: "#0f172a" },
  { key: "graduated", label: "Graduated", stages: GRADUATED_STAGES, color: "#0f766e", text: "#fff" },
  { key: "other", label: "On leave, AWOL or withdrawn", stages: OTHER_STAGES, color: "#94a3b8", text: "#0f172a" },
];

export function stateOfStage(stage) {
  return STATES.find((state) => state.key !== "other" && state.stages.includes(stage))?.key || "other";
}

/** The server's column key for a stage (app.py _stage_key). */
export const stageColumn = (stage) => `s_${stage.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;

/** "24-25" -> "2024-2025"; anything else as it is. */
export function yearLabel(entry) {
  const short = /^(\d{2})-(\d{2})$/.exec(entry);
  return short ? `20${short[1]}-20${short[2]}` : entry;
}

/** "2024-2025" and "24-25" are the same year started. */
export function normalYear(entry) {
  const full = /^(\d{4})\s*-\s*(\d{4})$/.exec(String(entry || "").trim());
  return full ? `${full[1].slice(2)}-${full[2].slice(2)}` : String(entry || "").trim();
}

/** Rows of the cohorts report (one per program and year) -> one row per year with the three counts, oldest year first. */
export function summarizeYears(rows) {
  const years = new Map();
  for (const row of rows) {
    const year = years.get(row.entry) || { entry: row.entry, label: yearLabel(row.entry), coursework: 0, thesis: 0, graduated: 0, other: 0, total: 0 };
    for (const state of STATES.filter((item) => item.key !== "other")) {
      for (const stage of state.stages) year[state.key] += Number(row[stageColumn(stage)]) || 0;
    }
    year.total += Number(row.total) || 0;
    years.set(row.entry, year);
  }
  for (const year of years.values()) year.other = year.total - year.coursework - year.thesis - year.graduated; // leave, AWOL, withdrawn and any stage not listed
  return [...years.values()].sort((a, b) => String(a.entry).localeCompare(String(b.entry)));
}
