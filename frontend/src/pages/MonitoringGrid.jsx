import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";

// Cell styling per course status.
const CELL = {
  Completed: { cls: "bg-brand-500 text-white", mark: "✓" },
  Current: { cls: "bg-amber-100 text-amber-700", mark: "·" },
  Enrolled: { cls: "bg-amber-100 text-amber-700", mark: "·" },
  Incomplete: { cls: "bg-amber-200 text-amber-800", mark: "!" },
  Dropped: { cls: "bg-slate-200 text-slate-500", mark: "×" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};

const STATUS_CYCLE = ["Missing", "Enrolled", "Completed", "Incomplete", "Failed", "Dropped"];
const STAGE_ORDER = [
  "Admission",
  "Coursework",
  "Proposal Development",
  "Proposal Defense",
  "Data Collection",
  "Writing",
  "Final Defense",
  "LOA",
  "Withdrawal In Progress",
  "Withdrawn",
  "Completed",
];
const CELL_VIEW = {
  Completed: { cls: "bg-brand-500 text-white", mark: "C" },
  Current: { cls: "bg-blue-100 text-blue-700", mark: "E" },
  Enrolled: { cls: "bg-blue-100 text-blue-700", mark: "E" },
  Incomplete: { cls: "bg-amber-200 text-amber-800", mark: "I" },
  Dropped: { cls: "bg-slate-200 text-slate-500", mark: "D" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};

// Research milestones are not read directly from ResearchCase or DocumentCheck.
// The backend returns `s.milestones` from the `/api/monitoring/grid` endpoint,
// computed by that route's `milestones()` helper. Each milestone is a stage gate
// locked behind a passed comprehensive exam:
// - title: comprehensive_status == "P" and current_stage >= Proposal Development
// - proposal: comprehensive_status == "P" and current_stage >= Proposal Defense
// - ethics: comprehensive_status == "P" and current_stage >= Data Collection
// - final: comprehensive_status == "P" and current_stage >= Final Defense
// So these checkmarks are inferred from `current_stage`, not research documents.
const MILES = [
  ["title", "Title"],
  ["proposal", "Proposal"],
  ["ethics", "Ethics"],
  ["final", "Final"],
];

export function MonitoringGridContent({
  title = "Monitoring Sheet",
  description = "The full class view - students by row, subjects by column. Click a subject cell to cycle its status.",
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedProgress = searchParams.get("progress") || "";
  const selectedRisk = searchParams.get("risk") || "";
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [progress, setProgress] = useState(selectedProgress);
  const [risk, setRisk] = useState(selectedRisk);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load(pid, nextProgress = progress, nextRisk = risk) {
    setLoading(true);
    setError("");
    api
      .monitoringGrid({ program_id: pid || undefined, progress: nextProgress, risk: nextRisk })
      .then((g) => {
        setGrid(g);
        setProgramId(String(g.program.id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setProgress(selectedProgress);
    setRisk(selectedRisk);
    load(selectedProgramId, selectedProgress, selectedRisk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedProgress, selectedRisk]);

  const flatCourses = useMemo(
    () => (grid ? grid.categories.flatMap((c) => c.courses) : []),
    [grid]
  );
  const hasCoreCategory = useMemo(
    () => !!grid?.categories?.some((category) => category.name === "Core"),
    [grid]
  );

  async function cycleCell(studentId, course, current) {
    const normalizedCurrent = current === "Current" ? "Enrolled" : current;
    const index = STATUS_CYCLE.indexOf(normalizedCurrent);
    const nextStatus = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
    // optimistic update
    setGrid((g) => {
      if (!g) return g;
      const students = g.students.map((s) => {
        if (s.id !== studentId) return s;
        const cells = { ...s.cells, [course.id]: nextStatus };
        const completed = flatCourses.reduce((n, c) => n + (cells[c.id] === "Completed" ? 1 : 0), 0);
        const completedUnits = flatCourses.reduce((n, c) => n + (cells[c.id] === "Completed" ? (c.units || 3) : 0), 0);
        const eligible = g.total_units > 0 && completedUnits >= g.total_units;
        return {
          ...s,
          cells,
          completed,
          completed_units: completedUnits,
          eligible,
          rate: g.course_count ? Math.round((completed / g.course_count) * 1000) / 10 : 0,
        };
      });
      return { ...g, students };
    });
    setSaving(true);
    try {
      await api.saveCourseAudit({ course_id: course.id, statuses: { [studentId]: nextStatus } });
    } catch (e) {
      setError(e.message);
      load(programId); // revert by reloading on failure
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!grid) return;
    const header = ["Student", "ID", "Year", ...flatCourses.map((c) => c.code), "Completed", "Total", "% Complete"];
    const lines = [header.join(",")];
    grid.students.forEach((s) => {
      const row = [
        `"${s.name}"`, s.student_number, s.entry_year,
        ...flatCourses.map((c) => (s.cells[c.id] === "Current" ? "Enrolled" : s.cells[c.id] || "Missing")),
        s.completed, s.total, s.rate,
      ];
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-${grid.program.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateFilters(next) {
    const merged = {
      program_id: next.program_id ?? programId,
      progress: next.progress ?? progress,
      risk: next.risk ?? risk,
    };
    const params = {};
    if (merged.program_id) params.program_id = merged.program_id;
    if (merged.progress) params.progress = merged.progress;
    if (merged.risk) params.risk = merged.risk;
    setSearchParams(params, { replace: true });
  }

  async function saveCompreStatus(studentId, nextStatus) {
    setGrid((g) => {
      if (!g) return g;
      return {
        ...g,
        students: g.students.map((s) => (
          s.id === studentId
            ? { ...s, comprehensive_status: nextStatus, milestones: nextMilestones(s.stage, nextStatus === "P") }
            : s
        )),
      };
    });
    setSaving(true);
    try {
      await api.saveCompreStatus(studentId, nextStatus);
    } catch (e) {
      setError(e.message);
      load(programId);
    } finally {
      setSaving(false);
    }
  }

  function compreCell(student) {
    if (!student.eligible) {
      return (
        <td className="border-b border-r border-slate-100 p-0 text-center">
          <span className="flex h-8 w-full items-center justify-center text-slate-300">-</span>
        </td>
      );
    }
    const current = student.comprehensive_status || "";
    const nextStatus = current === "" ? "P" : current === "P" ? "F" : "";
    const cls = current === "P"
      ? "bg-brand-500 text-white"
      : current === "F"
        ? "bg-red-100 text-red-700"
        : "bg-slate-50 text-slate-300";
    return (
      <td className="border-b border-r border-slate-100 p-0 text-center">
        <button
          type="button"
          onClick={() => saveCompreStatus(student.id, nextStatus)}
          title="Click to cycle comprehensive exam status."
          className={`flex h-8 w-full items-center justify-center text-[9px] font-bold transition-colors hover:opacity-80 cursor-pointer ${cls}`}
        >
          {current}
        </button>
      </td>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            value={programId}
            onChange={(e) => updateFilters({ program_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(meta?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <select
            value={progress}
            onChange={(e) => updateFilters({ progress: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Progress"
          >
            <option value="">All progress</option>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="complete">All subjects complete</option>
            <option value="units-complete">Units complete</option>
          </select>
          <select
            value={risk}
            onChange={(e) => updateFilters({ risk: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Risk"
          >
            <option value="">All risk</option>
            {["Low", "Medium", "High", "Critical", "Medium/High/Critical"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!grid}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-500" /> Completed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Enrolled</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-300" /> Incomplete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200" /> Failed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 ring-1 ring-slate-300" /> Dropped</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-50 ring-1 ring-slate-200" /> Not taken</span>
        <span className="text-slate-400">Cycle: Not taken - Enrolled - Completed - Incomplete - Failed - Dropped</span>
        {saving && <span className="text-brand-600">Saving…</span>}
      </div>

      {loading ? (
        <Spinner label="Loading monitoring sheet…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load the sheet" hint={error} />
      ) : !grid || grid.students.length === 0 ? (
        <EmptyState icon={Table2} title="No students in this program yet" hint="Import a monitoring sheet under Student Handoff to populate it." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto" style={{ maxHeight: "72vh", overflowX: "auto" }}>
            <table className="border-collapse text-xs" style={{ width: "100%" }}>
              <thead>
                {/* group header row */}
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left"
                    rowSpan={2}
                    style={{ minWidth: 220 }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Student</span>
                  </th>
                  {grid.categories.map((cat) => (
                    <Fragment key={cat.name}>
                      <th
                        colSpan={cat.courses.length}
                        className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                        style={{ height: 32 }}
                      >
                        {cat.name}
                      </th>
                      {cat.name === "Core" && (
                        <th
                          rowSpan={2}
                          className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                          style={{ minWidth: 72, height: 32 }}
                        >
                          Compre Exam
                        </th>
                      )}
                    </Fragment>
                  ))}
                  {!hasCoreCategory && (
                    <th
                      rowSpan={2}
                      className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                      style={{ minWidth: 72, height: 32 }}
                    >
                      Compre Exam
                    </th>
                  )}
                  <th
                    colSpan={MILES.length}
                    className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                    style={{ height: 32 }}
                  >
                    Research
                  </th>
                </tr>
                {/* column header row */}
                <tr>
                  {flatCourses.map((c) => (
                    <th
                      key={c.id}
                      title={c.title}
                      className="sticky z-20 border-b border-r border-slate-100 bg-white px-1.5 py-2 text-center align-bottom font-semibold text-slate-500"
                      style={{ top: 32, minWidth: 46, height: 96 }}
                    >
                      <span style={{ writingMode: "vertical-rl" }} className="inline-block rotate-180 whitespace-nowrap">
                        {c.code}
                      </span>
                    </th>
                  ))}
                  {MILES.map(([key, label]) => (
                    <th
                      key={key}
                      className="sticky z-20 border-b border-r border-slate-100 bg-white px-1.5 py-2 text-center align-bottom font-semibold text-slate-500"
                      style={{ top: 32, minWidth: 46, height: 96 }}
                    >
                      <span style={{ writingMode: "vertical-rl" }} className="inline-block rotate-180">{label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.students.map((s) => (
                  <tr key={s.id} className="hover:bg-brand-50/30">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">{s.student_number} · Y{s.entry_year}</span>
                            {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                              <StatusBadge value={s.enrollment_tag} dot={false} />
                            )}
                          </span>
                        </span>
                        <StatusBadge value={s.risk} dot={false} />
                      </button>
                    </td>
                    {grid.categories.map((cat) => (
                      <Fragment key={`${s.id}-${cat.name}`}>
                        {cat.courses.map((c) => {
                          const status = s.cells[c.id] === "Current" ? "Enrolled" : s.cells[c.id] || "Missing";
                          const sty = CELL_VIEW[status] || CELL_VIEW.Missing;
                          return (
                            <td key={c.id} className="border-b border-r border-slate-100 p-0 text-center">
                              <button
                                type="button"
                                onClick={() => cycleCell(s.id, c, status)}
                                title={`${c.code} - ${status}. Click to cycle to the next status.`}
                                className={`flex h-8 w-full items-center justify-center text-[9px] font-bold transition-colors hover:opacity-80 cursor-pointer ${sty.cls}`}
                              >
                                {sty.mark}
                              </button>
                            </td>
                          );
                        })}
                        {cat.name === "Core" && compreCell(s)}
                      </Fragment>
                    ))}
                    {!hasCoreCategory && compreCell(s)}
                    {/* Milestone checkmarks render the backend-provided `s.milestones`
                        booleans. Those booleans are stage-progression gates behind a
                        passed compre, not ResearchCase/DocumentCheck completion rows. */}
                    {MILES.map(([key]) => (
                      <td key={key} className="border-b border-r border-slate-100 text-center">
                        {s.milestones[key] ? (
                          <Check className="mx-auto h-4 w-4 text-brand-600" strokeWidth={3} />
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function MonitoringGrid() {
  return <MonitoringGridContent />;
}

function nextMilestones(stage, comprehensivePassed) {
  const idx = STAGE_ORDER.includes(stage) ? STAGE_ORDER.indexOf(stage) : 0;
  return {
    title: comprehensivePassed && stage !== "LOA" && idx >= STAGE_ORDER.indexOf("Proposal Development"),
    proposal: comprehensivePassed && idx >= STAGE_ORDER.indexOf("Proposal Defense"),
    ethics: comprehensivePassed && idx >= STAGE_ORDER.indexOf("Data Collection"),
    final: comprehensivePassed && idx >= STAGE_ORDER.indexOf("Final Defense"),
  };
}
