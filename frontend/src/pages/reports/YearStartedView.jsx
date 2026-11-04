// "By year started" (I-357): one report for the three questions the Graduate School asked together - for each school year
// students started, how many are on coursework, on thesis / dissertation, and graduated. A stacked bar and a table with the
// same numbers; every count opens the students behind it. Under it, the older views that go deeper (every stage, graduation
// candidates, defenses) so nothing is lost but nothing is repeated as a separate tab (IM24).
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { EmptyState, Modal, SectionCard, Spinner } from "../../components/ui/index.js";
import { BarsChart, ChartCard } from "./ChartParts.jsx";
import ListDialog, { CountButton } from "./ListDialog.jsx";
import ReportPanel from "./ReportPanel.jsx";
import { REPORTS } from "./reportConfig.js";
import { STATES, normalYear, stateOfStage, summarizeYears, yearLabel } from "./yearStarted.js";

const DETAIL_VIEWS = [
  { key: "stages", report: "cohorts", label: "Every stage" },
  { key: "graduation", report: "graduation", label: "Graduation candidates" },
  { key: "defenses", report: "defenses", label: "Defenses" },
];
const STUDENT_COLUMNS = [
  { key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "stage", label: "Stage" }, { key: "detail", label: "Year started" },
];

// shortcut: the lists behind the counts are built here from /api/students (all pages, 100 at a time) because the cohorts report
// sends counts only. Upgrade to one server call that lists the students of a year and a state (see the packet report).
async function loadStudents(programId) {
  const rows = [];
  for (let page = 1; page <= 50; page += 1) {
    const res = await api.students({ page, page_size: 100, program_id: programId || undefined });
    rows.push(...res.items);
    if (page >= res.pages) break;
  }
  return rows;
}

function StudentsOf({ pick, programId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadStudents(programId)
      .then((all) => live && setRows(all))
      .catch((err) => live && setError(err.message || "Could not load the students."));
    return () => { live = false; };
  }, [programId]);
  const title = `${pick.state.label}, started ${pick.year.label}`;
  if (!rows) {
    return (
      <Modal title={title} size="xl" onClose={onClose} closeLabel={`Close ${title}`}>
        {error ? <EmptyState icon={AlertTriangle} title="Could not load this list" hint={error} /> : <Spinner label="Loading the students…" />}
      </Modal>
    );
  }
  const list = rows
    .filter((s) => normalYear(s.academic_year_entry) === pick.year.entry && stateOfStage(s.current_stage) === pick.state.key)
    .map((s) => ({ student_id: s.id, student: s.name, student_number: s.student_number, program: s.program_code, stage: s.current_stage, detail: yearLabel(normalYear(s.academic_year_entry)) }));
  return <ListDialog title={title} subtitle="Students of the program and year you picked, in this state." columns={STUDENT_COLUMNS} rows={list} onClose={onClose} />;
}

export default function YearStartedView({ params, setParam, clearFilters }) {
  const programId = params.get("program_id") || "";
  const cohort = params.get("cohort") || "";
  const query = useMemo(() => ({ ...(programId ? { program_id: programId } : {}), ...(cohort ? { entry: cohort } : {}) }), [programId, cohort]);
  const { data, error } = useApi(() => api.report("cohorts", query), [JSON.stringify(query)]);
  const [pick, setPick] = useState(null);
  const requested = params.get("report");
  const view = params.get("view") || (DETAIL_VIEWS.some((v) => v.key === requested) ? requested : "stages");
  const detail = DETAIL_VIEWS.find((v) => v.key === view) || DETAIL_VIEWS[0];

  const years = useMemo(() => (data ? summarizeYears(data.rows) : []), [data]);
  const shown = STATES.filter((state) => state.key !== "other" || years.some((y) => y.other > 0));
  const ask = (year, state) => `Show ${year[state.key]} students who started ${year.label}: ${state.label}`;
  const open = (year, state) => setPick({ year, state });

  const table = {
    caption: "Students by year started and state",
    rowKey: "entry",
    minWidth: "md",
    columns: [
      { key: "label", header: "Year started" },
      ...shown.map((state) => ({
        key: state.key,
        header: state.label,
        align: "right",
        cell: (y) => <CountButton count={y[state.key]} label={ask(y, state)} onClick={() => open(y, state)} />,
      })),
      { key: "total", header: "All students", align: "right" },
    ],
    rows: years,
  };

  function selectBar(row, key) {
    const state = STATES.find((s) => s.key === key);
    const year = years.find((y) => y.label === row.label);
    if (year && state && year[key]) open(year, state);
  }

  return (
    <div className="page-stack">
      {error ? (
        <EmptyState icon={AlertTriangle} title="Could not load this report" hint={error} />
      ) : !data ? (
        <Spinner label="Loading students by year started…" />
      ) : (
        <ChartCard
          question="Where are the students of each year started?"
          hint="Each bar is one school year students started. Select a number to see those students."
          empty={years.length ? null : { title: "No students for these filters", hint: "Change the program or year started at the top of the page." }}
          chart={
            <>
              <BarsChart
                data={years}
                categoryKey="label"
                series={shown.map((s) => ({ key: s.key, name: s.label, color: s.color, text: s.text }))}
                onSelect={selectBar}
                ariaLabel="Students per year started, split into coursework, thesis or dissertation, and graduated"
              />
              <p className="meta">
                On coursework: Admission, Coursework and Comprehensive Exam. On thesis / dissertation: Proposal Development up to Final Defense.
                Graduated: Completed. Students on leave, AWOL or withdrawn are counted apart.
              </p>
            </>
          }
          table={table}
          tableBelow
        />
      )}

      <SectionCard title="More detail" subtitle="The same students, looked at another way.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="More detail">
          {DETAIL_VIEWS.map((item) => {
            const on = item.key === detail.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={on}
                onClick={() => setParam("view", item.key === "stages" ? "" : item.key)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 max-sm:min-h-11 ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-brand-50 hover:text-brand-700"}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <ReportPanel key={detail.report} report={REPORTS.find((r) => r.id === detail.report)} params={params} setParam={setParam} clearFilters={clearFilters} />
      </SectionCard>

      {pick && <StudentsOf pick={pick} programId={programId} onClose={() => setPick(null)} />}
    </div>
  );
}
