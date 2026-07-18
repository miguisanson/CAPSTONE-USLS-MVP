import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check, Pencil, Lock, Trash2, Inbox } from "lucide-react";
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
  Current: { cls: "bg-blue-100 text-blue-700", mark: "R" },
  Enrolled: { cls: "bg-blue-100 text-blue-700", mark: "R" },
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
  "Admission",
  "Coursework",
  "Comprehensive Exam",
  "Proposal Development",
  "Proposal Defense",
  "Data Collection",
  "Final Defense",
  "Graduation",
];

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
  // View-only by default so a stray click can't change a student's status.
  const [editMode, setEditMode] = useState(false);
  // "grid" is the class monitoring sheet; "drops" is the drop-request queue.
  const [view, setView] = useState("grid");

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
    if (!editMode) return; // sheet is locked; enable Edit mode to make changes
    const index = STATUS_CYCLE.indexOf(current);
    const nextStatus = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
    // Confirm changes that pull a subject backwards (e.g. Completed → Incomplete)
    // or mark it Failed/Dropped, so an accidental click can't quietly downgrade.
    const isDowngrade = current === "Completed" && nextStatus !== "Completed";
    const isNegative = nextStatus === "Failed" || nextStatus === "Dropped";
    if (isDowngrade || isNegative) {
      const ok = window.confirm(
        `Change ${course.code} from "${current}" to "${nextStatus}"?\n\nThis affects the student's progress and comprehensive-exam eligibility.`
      );
      if (!ok) return;
    }
    // optimistic update
    setGrid((g) => {
      if (!g) return g;
      const students = g.students.map((s) => {
        if (s.id !== studentId) return s;
        const cells = { ...s.cells, [course.id]: nextStatus };
        const completed = flatCourses.reduce((n, c) => n + (cells[c.id] === "Completed" ? 1 : 0), 0);
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

  async function toggleCompreExam(student) {
    if (!editMode) return; // locked unless Edit mode is on
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

  async function removeStudent(student) {
    if (!editMode) return;
    const ok = window.confirm(
      `Remove ${displayStudentName(student)} from active monitoring?\n\nThe student is marked Withdrawn (kept in records with full history), not deleted.`
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      await api.removeStudent(student.id, { reason: "Removed via the monitoring sheet." });
      load(programId);
    } catch (e) {
      setError(e.message);
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
            {view === "drops"
              ? "Course drop requests submitted by students. Approve to mark the subject Dropped, or reject to leave it unchanged."
              : "The full class view — students by row, subjects by column. Locked by default; turn on Editing to change a status."}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-7">
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
          <select value={selectedTermId || String(grid?.selected_term?.id || "")} onChange={(e) => updateFilters({ term_id: e.target.value })} className="field-input cursor-pointer" aria-label="Semester">
            {(grid?.terms || meta?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}{term.is_active_planning_term ? " (Current)" : ""}</option>)}
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
            <option value="units-complete">Eligible for compre</option>
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
          <select
            value={enrollment}
            onChange={(e) => updateFilters({ enrollment: e.target.value })}
            className="field-input cursor-pointer"
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
            className="field-input cursor-pointer"
            aria-label="Sort monitoring sheet"
          >
            <option value="name">Sort: Last name</option>
            <option value="entry-newest">Sort: Entry year newest</option>
            <option value="entry-oldest">Sort: Entry year oldest</option>
            <option value="completed-desc">Sort: Completed subjects most</option>
            <option value="completed-asc">Sort: Completed subjects least</option>
            <option value="units-desc">Sort: Completed units most</option>
            <option value="risk">Sort: Highest risk</option>
          </select>
          <button
            type="button"
            onClick={() => setView((v) => (v === "drops" ? "grid" : "drops"))}
            className={view === "drops" ? "btn-primary" : "btn-ghost"}
          >
            <Inbox className="h-4 w-4" /> {view === "drops" ? "Back to sheet" : "Drop Requests"}
          </button>
          <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!grid || view === "drops"}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {view === "grid" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
          <button
            type="button"
            onClick={() => {
              if (editMode) {
                setEditMode(false);
                return;
              }
              const ok = window.confirm(
                "Turn on editing?\n\nYou will be able to change student statuses, comprehensive-exam results, and remove students. Are you sure?"
              );
              if (ok) setEditMode(true);
            }}
            className={editMode ? "btn-primary" : "btn-ghost"}
          >
            {editMode ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {editMode ? "Editing on" : "View only"}
          </button>
          <span className="text-slate-500">
            {editMode
              ? "Cells are editable. Click a subject to cycle its status; downgrades and removals ask to confirm."
              : "The sheet is locked to prevent accidental edits. Turn on editing to make changes."}
          </span>
          {saving && <span className="text-brand-600">Saving…</span>}
        </div>
      )}

      {/* Legend */}
      {view === "grid" && (
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-500" /> Completed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Current</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-300" /> Incomplete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200" /> Failed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 ring-1 ring-slate-300" /> Dropped</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-50 ring-1 ring-slate-200" /> Not taken</span>
        <span className="text-slate-400">Cycle: Not taken - Current - Completed - Incomplete - Failed - Dropped</span>
      </div>
      )}

      {view === "drops" ? (
        <DropRequestsPanel programName={grid?.program ? `${grid.program.code} — ${grid.program.name}` : ""} />
      ) : loading ? (
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
                      <div className="flex items-center gap-1.5">
                        {editMode && s.enrollment_tag !== "Withdrawn" && (
                          <button
                            type="button"
                            onClick={() => removeStudent(s)}
                            title={`Remove ${displayStudentName(s)} (mark Withdrawn)`}
                            aria-label={`Remove ${displayStudentName(s)}`}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${s.id}`)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink sm:text-sm">{displayStudentName(s)}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-400">{s.student_number} · Y{s.entry_year}</span>
                              {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                                <StatusBadge value={s.enrollment_tag} dot={false} />
                              )}
                            </span>
                          </span>
                          <StatusBadge value={s.risk} dot={false} />
                        </button>
                      </div>
                    </td>
                    {flatCourses.map((c) => {
                      const status = s.cells[c.id] || "Missing";
                      const sty = CELL_VIEW[status] || CELL_VIEW.Missing;
                      return (
                        <td key={c.id} className="border-b border-r border-slate-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => cycleCell(s.id, c, status)}
                            disabled={!editMode}
                            title={`${c.code} — ${status}${s.grades?.[c.id] ? ` · Grade ${s.grades[c.id]}` : ""}${s.grade_remarks?.[c.id] ? ` · ${s.grade_remarks[c.id]}` : ""}.${editMode ? " Click to cycle to the next status." : " Turn on Editing to change."}`}
                            className={`flex h-9 w-full min-w-10 flex-col items-center justify-center text-[10px] font-bold transition-colors sm:h-10 sm:text-[11px] ${sty.cls} ${editMode ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                          >
                            {sty.mark}
                            {s.grades?.[c.id] && <span className="text-[9px] font-semibold leading-none opacity-90">{s.grades[c.id]}</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center">
                      <CompreExamBadge student={s} onToggle={() => toggleCompreExam(s)} saving={saving} editMode={editMode} />
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

const DROP_STATUSES = ["Submitted", "Approved", "Rejected"];

function DropRequestsPanel({ programName }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("All");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load(nextStatus = status) {
    setLoading(true);
    setError("");
    api
      .courseDropRequests(nextStatus === "All" ? "" : nextStatus)
      .then((res) => setItems(res.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(item, decision) {
    const verb = decision === "approve" ? "Approve" : "Reject";
    if (!window.confirm(`${verb} the drop request for ${item.course_code}?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await api.decideCourseDrop(item.id, { decision });
      load(status);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {["All", "Submitted", "Approved", "Rejected"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s}
          </button>
        ))}
        {programName && <span className="ml-auto text-xs text-slate-400">Across all programs</span>}
      </div>

      {loading ? (
        <Spinner label="Loading drop requests…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load drop requests" hint={error} />
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox} title={`No ${status === "All" ? "" : status.toLowerCase() + " "}drop requests`} hint="Student course drop requests will appear here." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Semester</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-brand-50/30">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => item.student_id && navigate(`/students/${item.student_id}`)}
                        className="text-left font-semibold text-ink hover:text-brand-700 cursor-pointer"
                      >
                        {item.student?.name || item.student?.last_name || `Student #${item.student_id}`}
                      </button>
                      <div className="text-[11px] text-slate-400">{item.student?.student_number || ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">{item.course_code}</div>
                      <div className="text-[11px] text-slate-400">{item.course_title}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.term_label || "—"}</td>
                    <td className="max-w-[280px] px-3 py-2 text-slate-600">{item.reason || "—"}</td>
                    <td className="px-3 py-2"><StatusBadge value={item.status} dot={false} /></td>
                    <td className="px-3 py-2 text-right">
                      {item.status === "Submitted" ? (
                        <span className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => decide(item, "approve")}
                            disabled={busyId === item.id}
                            className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(item, "reject")}
                            disabled={busyId === item.id}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                          >
                            Reject
                          </button>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">{item.decided_by ? `by ${item.decided_by}` : "Reviewed"}</span>
                      )}
                    </td>
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

function CompreExamBadge({ student, onToggle, saving, editMode }) {
  const label = compreExamLabel(student);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving || !editMode || !student.compre_eligibility?.eligible}
      title={editMode ? compreTitle(student) : `${compreTitle(student)} · Turn on Editing to change.`}
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
      cells[course.id] === "Completed" ? sum + (course.units || 3) : sum
    ), 0);
    return { category, completed, required, complete: completed >= required };
  });
  const completedUnits = categoryRows.reduce((sum, item) => sum + item.completed, 0);
  const totalCompletedUnits = categories.reduce((sum, group) => (
    sum + (group.courses || []).reduce((courseSum, course) => (
      cells[course.id] === "Completed" ? courseSum + (course.units || 3) : courseSum
    ), 0)
  ), 0);
  const allCourses = categories.flatMap((group) => group.courses || []);
  const missingSubjects = allCourses.filter((course) => cells[course.id] !== "Completed").length;
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
