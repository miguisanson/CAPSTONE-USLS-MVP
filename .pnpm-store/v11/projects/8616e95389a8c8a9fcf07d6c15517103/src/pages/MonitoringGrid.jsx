import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";

// Cell styling per course status.
const CELL = {
  Completed: { cls: "bg-brand-500 text-white", mark: "✓" },
  Current: { cls: "bg-amber-100 text-amber-700", mark: "·" },
  Enrolled: { cls: "bg-amber-100 text-amber-700", mark: "·" },
  Incomplete: { cls: "bg-amber-200 text-amber-800", mark: "!" },
  "Retake Required": { cls: "bg-orange-200 text-orange-800", mark: "R" },
  Dropped: { cls: "bg-slate-200 text-slate-500", mark: "×" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};

const STATUS_CYCLE = ["Missing", "Current", "Completed", "Incomplete", "Failed", "Dropped"];
const CELL_VIEW = {
  Completed: { cls: "bg-brand-500 text-white", mark: "C" },
  CompletedBefore: { cls: "bg-emerald-100 text-emerald-700", mark: "C" },
  CompletedThisTerm: { cls: "bg-brand-500 text-white", mark: "C" },
  Current: { cls: "bg-blue-100 text-blue-700", mark: "E" },
  Enrolled: { cls: "bg-blue-100 text-blue-700", mark: "E" },
  Recommended: { cls: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300", mark: "R" },
  Incomplete: { cls: "bg-amber-200 text-amber-800", mark: "I" },
  "Retake Required": { cls: "bg-orange-200 text-orange-800", mark: "R" },
  Dropped: { cls: "bg-slate-200 text-slate-500", mark: "D" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};

const MILES = [
  ["title", "Title"],
  ["proposal", "Proposal"],
  ["ethics", "Ethics"],
  ["final", "Final"],
];
const COMPRE_UNIT_REQUIREMENTS = { Basic: 6, Major: 9, Cognate: 6 };
const COMPRE_TOTAL_UNITS_REQUIRED = 21;
const RESEARCH_STAGE_ORDER = [
  "Onboarding",
  "Coursework",
  "Comprehensive Exam",
  "Proposal Development",
  "Proposal Defense",
  "Data Collection",
  "Final Defense",
  "Graduation",
];
const isCompletedStatus = (value) => ["Completed", "CompletedBefore", "CompletedThisTerm"].includes(value);

export default function MonitoringGrid() {
  const navigate = useNavigate();
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
  const [saving, setSaving] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [plannerStudent, setPlannerStudent] = useState(null);
  const [planCourseIds, setPlanCourseIds] = useState([]);
  const [planNote, setPlanNote] = useState("");

  function load(pid, nextProgress = progress, nextRisk = risk, nextEnrollment = enrollment) {
    setLoading(true);
    setError("");
    api
      .monitoringGrid({ program_id: pid || undefined, term_id: selectedTermId || undefined, progress: nextProgress, risk: nextRisk, enrollment: nextEnrollment })
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

  async function cycleCell(studentId, course, current) {
    if (!grid?.selected_term_editable || current === "CompletedBefore") return;
    const canonicalCurrent = current === "CompletedThisTerm" ? "Completed" : current;
    const index = STATUS_CYCLE.indexOf(canonicalCurrent);
    const nextStatus = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
    const displayNextStatus = nextStatus === "Completed" ? "CompletedThisTerm" : nextStatus;
    // optimistic update
    setGrid((g) => {
      if (!g) return g;
      const students = g.students.map((s) => {
        if (s.id !== studentId) return s;
        const cells = { ...s.cells, [course.id]: displayNextStatus };
        const completed = flatCourses.reduce((n, c) => n + (["Completed", "CompletedBefore", "CompletedThisTerm"].includes(cells[c.id]) ? 1 : 0), 0);
        return refreshStudentProgress(
          { ...s, cells, completed, rate: g.course_count ? Math.round((completed / g.course_count) * 1000) / 10 : 0 },
          g.categories
        );
      });
      return { ...g, students };
    });
    setSaving(true);
    try {
      await api.saveCourseAudit({ course_id: course.id, term: grid?.selected_term?.label || "", statuses: { [studentId]: nextStatus } });
    } catch (e) {
      setError(e.message);
      load(programId); // revert by reloading on failure
    } finally {
      setSaving(false);
    }
  }

  const orderedTerms = useMemo(
    () => [...(grid?.terms || [])].sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || ""))),
    [grid?.terms]
  );
  const selectedTermIndex = orderedTerms.findIndex((term) => String(term.id) === String(grid?.selected_term?.id));

  function moveSemester(offset) {
    const target = orderedTerms[selectedTermIndex + offset];
    if (target) updateFilters({ term_id: String(target.id) });
  }

  function openPlanner(student) {
    setPlannerStudent(student);
    setPlanCourseIds((student.recommended_course_ids || []).map(Number));
    setPlanNote(student.recommendation_source === "Manual" ? student.recommendation_note || "" : "");
  }

  async function savePlan() {
    if (!plannerStudent || !grid?.selected_term?.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.saveMonitoringRecommendations({
        student_id: plannerStudent.id,
        source_term_id: grid.selected_term.id,
        course_ids: planCourseIds,
        note: planNote,
      });
      setGrid((current) => ({
        ...current,
        students: current.students.map((student) => student.id === plannerStudent.id ? {
          ...student,
          recommended_course_ids: res.course_ids,
          recommendation_source: res.source,
          recommendation_note: res.note,
          recommendation_target_term: res.target_term,
        } : student),
      }));
      setPlannerStudent(null);
    } catch (err) {
      setError(err.message || "Could not save the next-term plan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompreExam(student) {
    const nextStatus = nextCompreExamStatus(student);
    if (!nextStatus) {
      setError("The student must complete all curriculum subjects before the comprehensive exam can be marked Passed or Failed.");
      return;
    }
    setError("");
    setSaving(true);
    setGrid((g) => {
      if (!g) return g;
      return {
        ...g,
        students: g.students.map((s) => {
          if (s.id !== student.id) return s;
          const updated = {
            ...s,
            compre_eligibility: {
              ...s.compre_eligibility,
              exam_status: nextStatus,
              passed: nextStatus === "Passed",
              research_allowed: !!s.compre_eligibility?.eligible && nextStatus === "Passed",
            },
          };
          return refreshStudentProgress(updated, g.categories);
        }),
      };
    });
    try {
      const res = await api.saveCompreExam({ student_id: student.id, status: nextStatus });
      setGrid((g) => {
        if (!g) return g;
        return {
          ...g,
          students: g.students.map((s) => (
            s.id === student.id
              ? { ...s, stage: res.stage, risk: res.risk, eligible: res.eligible, compre_eligibility: res.compre_eligibility, milestones: res.milestones }
              : s
          )),
        };
      });
    } catch (e) {
      setError(e.message);
      load(programId);
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!grid) return;
    const header = ["Student", "ID", "Year", ...flatCourses.map((c) => c.code), "Completed", "Total", "% Complete"];
    const lines = [header.join(",")];
    sortedStudents.forEach((s) => {
      const row = [
        `"${displayStudentName(s)}"`, s.student_number, s.entry_year,
        ...flatCourses.map((c) => s.cells[c.id] || "Missing"),
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Monitoring Sheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            The full class view — students by row, subjects by column. Click a subject cell to cycle its status.
          </p>
        </div>
        <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!grid}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={programId}
            onChange={(e) => updateFilters({ program_id: e.target.value })}
            className="field-input w-full cursor-pointer sm:w-52"
            aria-label="Program"
          >
            {(meta?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <select value={selectedTermId || String(grid?.selected_term?.id || "")} onChange={(e) => updateFilters({ term_id: e.target.value })} className="field-input w-full cursor-pointer sm:w-52" aria-label="Academic semester">
            {(grid?.terms || meta?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}{term.is_active_planning_term ? " (Current)" : ""}</option>)}
          </select>
          <select
            value={progress}
            onChange={(e) => updateFilters({ progress: e.target.value })}
            className="field-input w-full cursor-pointer sm:w-52"
            aria-label="Progress"
          >
            <option value="">All progress</option>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="complete">All subjects complete</option>
            <option value="units-complete">Eligible for compre</option>
          </select>
          <select
            value={risk}
            onChange={(e) => updateFilters({ risk: e.target.value })}
            className="field-input w-full cursor-pointer sm:w-52"
            aria-label="Risk"
          >
            <option value="">All risk</option>
            {["Low", "Medium", "High", "Critical", "Medium/High/Critical"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={enrollment}
            onChange={(e) => updateFilters({ enrollment: e.target.value })}
            className="field-input w-full cursor-pointer sm:w-52"
            aria-label="Enrollment status"
          >
            <option value="">All enrollment</option>
            <option value="LOA">LOA</option>
            <option value="AWOL">AWOL</option>
            <option value="LOA/AWOL">LOA or AWOL</option>
            <option value="Enrolled">Enrolled</option>
            <option value="Withdrawn">Withdrawn</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            className="field-input w-full cursor-pointer sm:w-52"
            aria-label="Sort monitoring sheet"
          >
            <option value="name">Last name</option>
            <option value="entry-newest">Entry year: newest</option>
            <option value="entry-oldest">Entry year: oldest</option>
            <option value="completed-desc">Completed subjects: most</option>
            <option value="completed-asc">Completed subjects: least</option>
            <option value="units-desc">Completed units: most</option>
            <option value="risk">Highest risk</option>
          </select>
        </div>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => moveSemester(-1)} disabled={selectedTermIndex <= 0} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Previous semester"><ChevronLeft className="h-4 w-4" /></button>
          <div className="min-w-0 text-center sm:min-w-64">
            <p className="text-sm font-semibold text-ink">{grid?.selected_term?.label || "Academic semester"}</p>
            <p className="text-xs text-slate-500">{grid?.selected_term_editable ? "Current semester - editable" : "Historical semester - read only"}</p>
          </div>
          <button type="button" onClick={() => moveSemester(1)} disabled={selectedTermIndex < 0 || selectedTermIndex >= orderedTerms.length - 1} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Next semester"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={() => setShowRecommendations((current) => !current)} disabled={!grid?.next_term} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${showRecommendations ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-600"}`}>
          <Sparkles className="h-4 w-4" /> {showRecommendations ? "Hide" : "Show"} next-term recommendations
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Completed earlier</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-500" /> Completed this semester</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Enrolled</span>
        {showRecommendations && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-100 ring-1 ring-violet-300" /> Recommended for {grid?.next_term?.label || "next semester"}</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-300" /> Incomplete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200" /> Failed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 ring-1 ring-slate-300" /> Dropped</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-50 ring-1 ring-slate-200" /> Not taken</span>
        <span className="text-slate-400">Cycle: Not taken - Current - Completed - Incomplete - Failed - Dropped</span>
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
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/students/${s.id}`)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/students/${s.id}`); }}
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-ink sm:text-sm">{displayStudentName(s)}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">{s.student_number} · Y{s.entry_year}</span>
                            {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                              <StatusBadge value={s.enrollment_tag} dot={false} />
                            )}
                            {showRecommendations && grid?.next_term && grid?.selected_term_editable && (
                              <button type="button" onClick={(event) => { event.stopPropagation(); openPlanner(s); }} className="text-[10px] font-bold text-violet-700 hover:text-violet-900">
                                Edit {s.recommended_course_ids?.length || 0} next subjects
                              </button>
                            )}
                          </span>
                        </span>
                        <StatusBadge value={s.risk} dot={false} />
                      </div>
                    </td>
                    {flatCourses.map((c) => {
                      const status = s.cells[c.id] || "Missing";
                      const isRecommended = showRecommendations && (s.recommended_course_ids || []).includes(c.id) && !["Completed", "CompletedBefore", "CompletedThisTerm", "Enrolled", "Current"].includes(status);
                      const visibleStatus = isRecommended ? "Recommended" : status;
                      const sty = CELL_VIEW[visibleStatus] || CELL_VIEW.Missing;
                      const readOnly = !grid?.selected_term_editable || status === "CompletedBefore";
                      return (
                        <td key={c.id} className="border-b border-r border-slate-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => cycleCell(s.id, c, status)}
                            disabled={readOnly}
                            title={`${c.code} — ${status}${s.grades?.[c.id] ? ` · Grade ${s.grades[c.id]}` : ""}${s.grade_remarks?.[c.id] ? ` · ${s.grade_remarks[c.id]}` : ""}. Click to cycle to the next status.`}
                            className={`flex h-9 w-full min-w-10 flex-col items-center justify-center text-[10px] font-bold transition-colors disabled:cursor-default sm:h-10 sm:text-[11px] ${!readOnly ? "cursor-pointer hover:opacity-80" : ""} ${sty.cls}`}
                          >
                            {sty.mark}
                            {s.grades?.[c.id] && <span className="text-[9px] font-semibold leading-none opacity-90">{s.grades[c.id]}</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center">
                      <CompreExamBadge student={s} onToggle={() => toggleCompreExam(s)} saving={saving} />
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
      {plannerStudent && (
        <RecommendationDrawer
          student={plannerStudent}
          courses={flatCourses}
          selectedIds={planCourseIds}
          setSelectedIds={setPlanCourseIds}
          note={planNote}
          setNote={setPlanNote}
          targetTerm={grid?.next_term}
          saving={saving}
          onSave={savePlan}
          onClose={() => setPlannerStudent(null)}
        />
      )}
    </div>
  );
}

function RecommendationDrawer({ student, courses, selectedIds, setSelectedIds, note, setNote, targetTerm, saving, onSave, onClose }) {
  const available = courses.filter((course) => !["Completed", "CompletedBefore", "CompletedThisTerm", "Enrolled", "Current"].includes(student.cells?.[course.id] || "Missing"));

  function toggle(courseId) {
    setSelectedIds((current) => {
      if (current.includes(courseId)) return current.filter((id) => id !== courseId);
      if (current.length >= 3) return current;
      return [...current, courseId];
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-label={`Next-term plan for ${displayStudentName(student)}`}>
      <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="Close next-term planner" />
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Next-term plan</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{displayStudentName(student)}</h2>
            <p className="mt-1 text-sm text-slate-500">Choose up to three subjects for {targetTerm?.label || "the next semester"}.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">
            <span>{student.recommendation_source || "System"} recommendation</span>
            <strong>{selectedIds.length}/3 selected</strong>
          </div>
          <div className="space-y-2">
            {available.map((course) => {
              const checked = selectedIds.includes(course.id);
              const disabled = !checked && selectedIds.length >= 3;
              return (
                <label key={course.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? "border-violet-300 bg-violet-50" : "border-slate-200"} ${disabled ? "opacity-50" : "cursor-pointer hover:border-violet-200"}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(course.id)} className="mt-0.5 h-4 w-4 accent-violet-600" />
                  <span><span className="block text-sm font-semibold text-ink">{course.code}</span><span className="mt-0.5 block text-xs text-slate-500">{course.title}</span></span>
                </label>
              );
            })}
          </div>
          <label className="mt-5 block">
            <span className="field-label">Planning note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="field-input min-h-24" placeholder="Why were these subjects selected or changed?" />
          </label>
        </div>
        <div className="border-t border-slate-200 p-5">
          <button type="button" onClick={onSave} disabled={saving || !selectedIds.length || !note.trim()} className="btn-primary w-full justify-center disabled:opacity-50">
            <Check className="h-4 w-4" /> {saving ? "Saving plan..." : "Save next-term plan"}
          </button>
        </div>
      </aside>
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

function CompreExamBadge({ student, onToggle, saving }) {
  const label = compreExamLabel(student);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving || !student.compre_eligibility?.eligible}
      title={compreTitle(student)}
      className="inline-flex cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
    >
      <StatusBadge value={label} dot={false} className="min-w-[76px] justify-center" />
    </button>
  );
}

function compreExamLabel(student) {
  const examStatus = (student.compre_eligibility?.exam_status || "").toLowerCase();
  if (examStatus === "passed") return "Passed";
  if (examStatus === "failed") return "Failed";
  if (student.compre_eligibility?.eligible) return "Eligible";
  return "Not eligible";
}

function nextCompreExamStatus(student) {
  if (!student.compre_eligibility?.eligible) return null;
  const examStatus = (student.compre_eligibility?.exam_status || "Not Taken").toLowerCase();
  if (examStatus === "passed") return "Failed";
  if (examStatus === "failed") return "Not Taken";
  return "Passed";
}

function refreshStudentProgress(student, categories = []) {
  const eligibility = computeCompreEligibility(student, categories);
  const examStatus = student.compre_eligibility?.exam_status || "Not Taken";
  const updated = {
    ...student,
    completed_units: eligibility.total_completed_units,
    eligible: eligibility.eligible,
    compre_eligibility: {
      ...(student.compre_eligibility || {}),
      eligible: eligibility.eligible,
      status: eligibility.eligible ? "Eligible for Comprehensive Exam" : "Not Eligible",
      passed: examStatus.toLowerCase() === "passed",
      research_allowed: eligibility.eligible && examStatus.toLowerCase() === "passed",
      categories: eligibility.categories,
      completed_units: eligibility.completed_units,
      required_units: COMPRE_TOTAL_UNITS_REQUIRED,
      missing_subjects: eligibility.missing_subjects,
      failed_subjects: eligibility.failed_subjects,
      required_subjects: eligibility.required_subjects,
    },
  };
  return { ...updated, milestones: computeResearchMilestones(updated) };
}

function computeCompreEligibility(student, categories = []) {
  const cells = student.cells || {};
  const categoryRows = Object.entries(COMPRE_UNIT_REQUIREMENTS).map(([category, required]) => {
    const courseGroup = categories.find((item) => item.name === category);
    const completed = (courseGroup?.courses || []).reduce((sum, course) => (
      isCompletedStatus(cells[course.id]) ? sum + (course.units || 3) : sum
    ), 0);
    return { category, completed, required, complete: completed >= required };
  });
  const completedUnits = categoryRows.reduce((sum, item) => sum + item.completed, 0);
  const totalCompletedUnits = categories.reduce((sum, group) => (
    sum + (group.courses || []).reduce((courseSum, course) => (
      isCompletedStatus(cells[course.id]) ? courseSum + (course.units || 3) : courseSum
    ), 0)
  ), 0);
  const allCourses = categories.flatMap((group) => group.courses || []);
  const missingSubjects = allCourses.filter((course) => !isCompletedStatus(cells[course.id])).length;
  const failedSubjects = allCourses.filter((course) => cells[course.id] === "Failed").length;
  return {
    categories: categoryRows,
    completed_units: completedUnits,
    total_completed_units: totalCompletedUnits,
    missing_subjects: missingSubjects,
    failed_subjects: failedSubjects,
    required_subjects: allCourses.length,
    eligible: allCourses.length > 0 && missingSubjects === 0 && failedSubjects === 0,
  };
}

function displayStudentName(student) {
  if (student.last_name || student.first_name) {
    return `${student.last_name || ""}, ${student.first_name || ""}`.replace(/^, /, "").trim();
  }
  return student.name || "Unnamed student";
}

function computeResearchMilestones(student) {
  const stage = student.stage || "";
  const idx = RESEARCH_STAGE_ORDER.indexOf(stage);
  const stageIndex = idx >= 0 ? idx : 0;
  const researchAllowed = !!student.compre_eligibility?.research_allowed;
  return {
    title: researchAllowed && stage !== "LOA" && stageIndex >= RESEARCH_STAGE_ORDER.indexOf("Proposal Development"),
    proposal: researchAllowed && stageIndex >= RESEARCH_STAGE_ORDER.indexOf("Proposal Defense"),
    ethics: researchAllowed && stageIndex >= RESEARCH_STAGE_ORDER.indexOf("Data Collection"),
    final: researchAllowed && stageIndex >= RESEARCH_STAGE_ORDER.indexOf("Final Defense"),
  };
}
