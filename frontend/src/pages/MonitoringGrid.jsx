import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check, Lock, Flag, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";
import { useConfirm } from "../components/confirm";

const CELL_VIEW = {
  Completed: { cls: "bg-brand-500 text-white", mark: "C" },
  Taken: { cls: "bg-brand-100 text-brand-800", mark: "T" },
  Current: { cls: "bg-blue-100 text-blue-700", mark: "R" },
  Enrolled: { cls: "bg-blue-100 text-blue-700", mark: "R" },
  Incomplete: { cls: "bg-amber-200 text-amber-800", mark: "I" },
  "Retake Required": { cls: "bg-orange-200 text-orange-800", mark: "R" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Dropped: { cls: "bg-violet-100 text-violet-700", mark: "D" },
  Withdrawn: { cls: "bg-rose-100 text-rose-700", mark: "W" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};
const MILES = [
  ["title", "Title"],
  ["proposal", "Proposal"],
  ["ethics", "Ethics"],
  ["final", "Final"],
];

export default function MonitoringGrid() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedProgress = searchParams.get("progress") || "";
  const selectedRisk = searchParams.get("risk") || "";
  const selectedEnrollment = searchParams.get("enrollment") || "";
  const selectedTermId = searchParams.get("term_id") || "";
  const selectedSort = searchParams.get("sort") || "name";
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [progress, setProgress] = useState(selectedProgress);
  const [risk, setRisk] = useState(selectedRisk);
  const [enrollment, setEnrollment] = useState(selectedEnrollment);
  const [sortBy, setSortBy] = useState(selectedSort);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  function load(pid, nextProgress = progress, nextRisk = risk, nextEnrollment = enrollment) {
    setLoading(true);
    setError("");
    api.monitoringGrid({ program_id: pid || undefined, term_id: selectedTermId || undefined, progress: nextProgress, risk: nextRisk, enrollment: nextEnrollment })
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
    setEnrollment(selectedEnrollment);
    setSortBy(selectedSort);
    load(selectedProgramId, selectedProgress, selectedRisk, selectedEnrollment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedProgress, selectedRisk, selectedEnrollment, selectedTermId]);

  const flatCourses = useMemo(
    () => (grid ? grid.categories.flatMap((c) => c.courses) : []),
    [grid]
  );
  const sortedStudents = useMemo(() => {
    const rows = [...(grid?.students || [])];
    const riskRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const nameKey = (student) => `${student.last_name || ""}, ${student.first_name || ""}`.toLowerCase();
    rows.sort((a, b) => {
      if (sortBy === "entry-newest") return (b.entry_year || 0) - (a.entry_year || 0) || nameKey(a).localeCompare(nameKey(b));
      if (sortBy === "entry-oldest") return (a.entry_year || 0) - (b.entry_year || 0) || nameKey(a).localeCompare(nameKey(b));
      if (sortBy === "completed-desc") return (b.completed || 0) - (a.completed || 0) || nameKey(a).localeCompare(nameKey(b));
      if (sortBy === "completed-asc") return (a.completed || 0) - (b.completed || 0) || nameKey(a).localeCompare(nameKey(b));
      if (sortBy === "units-desc") return (b.completed_units || 0) - (a.completed_units || 0) || nameKey(a).localeCompare(nameKey(b));
      if (sortBy === "risk") return (riskRank[a.risk] ?? 4) - (riskRank[b.risk] ?? 4) || nameKey(a).localeCompare(nameKey(b));
      return nameKey(a).localeCompare(nameKey(b));
    });
    return rows;
  }, [grid?.students, sortBy]);

  async function flagIssue(student) {
    // Exception reporting (checklist item 72): official AIMS values are never edited
    // here. Staff report a discrepancy that is recorded for the proper office to
    // correct in AIMS; the official value stays unchanged.
    const ok = await confirm({
      title: "Flag a data discrepancy?",
      message: `Record a discrepancy for ${displayStudentName(student)} (${student.student_number}).\n\nThis logs an issue for the proper office to correct in AIMS. The official value is not changed here.`,
      confirmLabel: "Flag issue",
    });
    if (!ok) return;
    try {
      await api.flagMonitoringIssue(student.id, {
        note: `Discrepancy flagged from the monitoring sheet for ${student.student_number}.`,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  function exportCsv() {
    if (!grid) return;
    const header = ["Student", "IDNO", "AY Entry", "YR", ...flatCourses.map((c) => c.code), "Completed", "Total", "% Complete"];
    const lines = [header.join(",")];
    sortedStudents.forEach((s) => {
      const row = [
        `"${displayStudentName(s)}"`, s.student_number, s.academic_year_entry, s.year_level,
        ...flatCourses.map((c) => s.cells[c.id] || "Missing"),
        s.completed, s.total, s.rate,
      ];
      lines.push(row.join(","));
    });
    const filename = `monitoring-${grid.program.code}.csv`;
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateFilters(next) {
    const merged = {
      program_id: next.program_id ?? programId,
      progress: next.progress ?? progress,
      risk: next.risk ?? risk,
      enrollment: next.enrollment ?? enrollment,
      sort: next.sort ?? sortBy,
      term_id: next.term_id ?? selectedTermId,
    };
    const params = {};
    if (merged.program_id) params.program_id = merged.program_id;
    if (merged.progress) params.progress = merged.progress;
    if (merged.risk) params.risk = merged.risk;
    if (merged.enrollment) params.enrollment = merged.enrollment;
    if (merged.sort && merged.sort !== "name") params.sort = merged.sort;
    if (merged.term_id) params.term_id = merged.term_id;
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Monitoring Sheet</h1>
        <p className="mt-1 text-sm text-slate-500">Read-only curriculum progress synchronized from enrollment and approved workflows.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
          <select value={programId} onChange={(e) => updateFilters({ program_id: e.target.value })} className="field-input cursor-pointer" aria-label="Program">
            {(meta?.programs || []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <select value={selectedTermId || String(grid?.selected_term?.id || "")} onChange={(e) => updateFilters({ term_id: e.target.value })} className="field-input cursor-pointer" aria-label="Semester">
            {(grid?.terms || meta?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}{term.relative_label ? ` (${term.relative_label})` : ""}</option>)}
          </select>
          <select value={progress} onChange={(e) => updateFilters({ progress: e.target.value })} className="field-input cursor-pointer" aria-label="Progress"><option value="">All progress</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">All subjects complete</option><option value="units-complete">Eligible for compre</option></select>
          <select value={risk} onChange={(e) => updateFilters({ risk: e.target.value })} className="field-input cursor-pointer" aria-label="Risk"><option value="">All risk</option>{["Low", "Medium", "High", "Critical", "Medium/High/Critical"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={enrollment} onChange={(e) => updateFilters({ enrollment: e.target.value })} className="field-input cursor-pointer" aria-label="Enrollment status"><option value="">All enrollment</option><option value="LOA">LOA</option><option value="AWOL">AWOL</option><option value="LOA/AWOL">LOA or AWOL</option><option value="Enrolled">Enrolled</option><option value="Withdrawn">Withdrawn</option></select>
          <select value={sortBy} onChange={(e) => updateFilters({ sort: e.target.value })} className="field-input cursor-pointer" aria-label="Sort monitoring sheet"><option value="name">Sort: Last name</option><option value="entry-newest">Sort: AY Entry newest</option><option value="entry-oldest">Sort: AY Entry oldest</option><option value="completed-desc">Sort: Completed subjects most</option><option value="completed-asc">Sort: Completed subjects least</option><option value="units-desc">Sort: Completed units most</option><option value="risk">Sort: Highest risk</option></select>
          <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!grid}><Download className="h-4 w-4" /> Export CSV</button>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p><span className="font-semibold text-ink">Read-only view.</span> Enrollment, approved withdrawal, and verified source imports update this page automatically. Use Flag issue only to record a discrepancy without changing the source value.</p>
      </div>

      {grid?.integrity && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            grid.integrity.issue_count
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-brand-200 bg-brand-50 text-brand-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {grid.integrity.issue_count ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            )}
            <span className="font-semibold">
              {grid.integrity.issue_count
                ? `${grid.integrity.issue_count} enrollment/profile inconsistency item(s) found`
                : `Enrollment and student profiles are synchronized (${grid.integrity.checked_enrollments} rows checked)`}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-500" /> Officially completed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-100 ring-1 ring-brand-200" /> Taken</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Enrolled</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-300" /> Incomplete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200" /> Failed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-100 ring-1 ring-violet-200" /> Dropped</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-50 ring-1 ring-slate-200" /> Not taken</span>
      </div>

      {loading ? (
        <Spinner label="Loading monitoring sheet…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load the sheet" hint={error} />
      ) : !grid || grid.students.length === 0 ? (
        <EmptyState icon={Table2} title="No students in this program yet" hint="Import a monitoring sheet under Student Handoff to populate it." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:hidden">
            Swipe sideways to review all subject columns.
          </div>
          <div className="overflow-auto overscroll-x-contain" style={{ maxHeight: "min(72vh, 760px)" }}>
            <table className="min-w-max border-collapse text-[11px] sm:text-xs">
              <thead>
                {/* group header row */}
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 min-w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left sm:min-w-[220px] sm:px-3"
                    rowSpan={2}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Student</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[170px] top-0 z-30 min-w-[72px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center sm:left-[220px]"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">AY Entry</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[242px] top-0 z-30 min-w-[48px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center sm:left-[292px]"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">YR</span>
                  </th>
                  {grid.categories.map((cat) => (
                    <th
                      key={cat.name}
                      colSpan={cat.courses.length}
                      className="sticky top-0 z-20 h-8 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      <span>{cat.name}</span>
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                    style={{ width: 96, minWidth: 96 }}
                  >
                    Compre Exam
                  </th>
                  <th
                    colSpan={MILES.length}
                    className="sticky top-0 z-20 h-8 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
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
                      style={{ top: 32, minWidth: 34, height: 84 }}
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
                      style={{ top: 32, minWidth: 34, height: 84 }}
                    >
                      <span style={{ writingMode: "vertical-rl" }} className="inline-block rotate-180">{label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-brand-50/30">
                    <td className="sticky left-0 z-10 max-w-[170px] border-b border-r border-slate-200 bg-white px-2 py-1.5 sm:max-w-[240px] sm:px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => flagIssue(s)}
                          title={`Flag a data discrepancy for ${displayStudentName(s)}`}
                          aria-label={`Flag issue for ${displayStudentName(s)}`}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${s.id}`)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink sm:text-sm">{displayStudentName(s)}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-500">IDNO {s.student_number}</span>
                              {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                                <StatusBadge value={s.enrollment_tag} dot={false} />
                              )}
                            </span>
                          </span>
                          <StatusBadge value={s.risk} dot={false} />
                        </button>
                      </div>
                    </td>
                    <td className="sticky left-[170px] z-10 min-w-[72px] border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center font-semibold text-slate-600 sm:left-[220px]">
                      {s.academic_year_entry || "—"}
                    </td>
                    <td className="sticky left-[242px] z-10 min-w-[48px] border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center font-semibold text-slate-600 sm:left-[292px]">
                      {s.year_level || "—"}
                    </td>
                    {flatCourses.map((c) => {
                      const status = s.cells[c.id] || "Missing";
                      const sty = CELL_VIEW[status] || CELL_VIEW.Missing;
                      const officialStatus = s.official_cells?.[c.id] || "Missing";
                      const statusSource = s.operational_sources?.[c.id] || "";
                      return (
                        <td key={c.id} className="border-b border-r border-slate-100 p-0 text-center">
                          <span
                            aria-label={`${c.code} for ${displayStudentName(s)}: ${status}`}
                            title={`${c.code} — ${status}. Official/imported status: ${officialStatus}. Official grade: ${s.grades?.[c.id] || "No grade"}.${statusSource ? ` Source: ${statusSource}.` : ""} Read-only; changes are synchronized from the source workflow.`}
                            className={`flex h-9 w-full min-w-10 cursor-default flex-col items-center justify-center text-[10px] font-bold sm:h-10 sm:text-[11px] ${sty.cls}`}
                          >
                            {sty.mark}
                            {s.grades?.[c.id] && <span className="text-[9px] font-semibold leading-none opacity-90">{s.grades[c.id]}</span>}
                          </span>
                        </td>
                      );
                    })}
                    <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center">
                      <CompreExamBadge student={s} />
                    </td>
                    {MILES.map(([key]) => (
                      <td key={key} className="border-b border-r border-slate-100 text-center">
                        {s.milestones[key] ? (
                          <Check className="mx-auto h-4 w-4 text-brand-600" strokeWidth={3} />
                        ) : (
                          <span className="text-slate-300">-</span>
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

function compreTitle(student) {
  if (student.compre_eligibility?.passed) return "Comprehensive exam passed";
  if (student.compre_eligibility?.eligible) return "Eligible to take the comprehensive exam";
  const missing = student.compre_eligibility?.missing_subjects;
  if (Number.isFinite(missing)) return `Not eligible: ${missing} subject(s) still not completed`;
  return `Not eligible: ${student.compre_eligibility?.completed_units || 0}/21 units completed`;
}

function CompreExamBadge({ student }) {
  const label = compreExamLabel(student);
  return (
    <span title={`${compreTitle(student)} · Read-only on the Monitoring Sheet.`} className="inline-flex">
      <StatusBadge value={label} dot={false} className="min-w-[76px] justify-center" />
    </span>
  );
}

function compreExamLabel(student) {
  const examStatus = (student.compre_eligibility?.exam_status || "").toLowerCase();
  if (examStatus === "passed") return "Passed";
  if (examStatus === "failed") return "Failed";
  if (student.compre_eligibility?.eligible) return "Eligible";
  return "Not eligible";
}

function displayStudentName(student) {
  if (student.last_name || student.first_name) {
    return `${student.last_name || ""}, ${student.first_name || ""}`.replace(/^, /, "").trim();
  }
  return student.name || "Unnamed student";
}
