import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FileCheck2,
  Lock,
  Save,
  Send,
  Users,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Card, EmptyState, ErrorNote, Spinner } from "../components/ui";

const STEPS = ["Draft", "Submitted", "Approved", "Published"];
const LOCKED_STATUSES = new Set(["Submitted", "Approved", "Published"]);
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "high", label: "High demand" },
  { value: "meets_minimum", label: "Meets minimum" },
  { value: "below_minimum", label: "Below minimum" },
];

export default function CourseAdjustments() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("subjects");
  const [openCourseId, setOpenCourseId] = useState(null);
  const [selections, setSelections] = useState({});
  const [lastSaved, setLastSaved] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .courseAdjustments()
      .then((res) => {
        if (!alive) return;
        setData(res);
        setProgramFilter(String(res.program?.id || "all"));
        setSelections(seedSelections(res));
        setLastSaved(res.latest_plan?.updated_at || "");
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") setOpenCourseId(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const selectedProgram = useMemo(() => {
    if (!data || programFilter === "all") return null;
    return data.programs.find((program) => String(program.id) === programFilter) || null;
  }, [data, programFilter]);

  const selectedPlan = useMemo(() => {
    if (!data || programFilter === "all") return null;
    return data.latest_plans?.[programFilter] || null;
  }, [data, programFilter]);

  const planStatus = selectedPlan?.status || "Draft";
  const activeTermLabel = data?.active_term?.label || "No active planning term";
  const planningOpen = !!data?.planning_window_open;
  const staffCanEdit = user?.role === "staff";
  const statusLocked = LOCKED_STATUSES.has(planStatus);
  const canEdit = staffCanEdit && planningOpen && !statusLocked && programFilter !== "all";
  const submitBlocked = !canEdit || !(planStatus === "Draft" || planStatus === "Returned");
  const submitTooltip = submitBlocked ? submitBlockReason({ staffCanEdit, planningOpen, statusLocked, programFilter, planStatus }) : "";

  const programRows = useMemo(() => {
    const rows = data?.demand || [];
    if (programFilter === "all") return rows;
    return rows.filter((row) => String(row.program?.id) === programFilter);
  }, [data, programFilter]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return programRows;
    return programRows.filter((row) => row.demand_status === statusFilter);
  }, [programRows, statusFilter]);

  const stats = useMemo(() => {
    const demandRows = data?.demand || [];
    const studentIds = new Set();
    demandRows.forEach((row) => row.students?.forEach((student) => studentIds.add(student.student_id)));
    return {
      programs: new Set(demandRows.filter((row) => row.demand_count > 0).map((row) => row.program?.id)).size,
      students: studentIds.size,
      subjects: demandRows.filter((row) => row.demand_count > 0).length,
      high: demandRows.filter((row) => row.demand_status === "high").length,
    };
  }, [data]);

  const maxDemand = Math.max(1, ...programRows.map((row) => row.demand_count || 0));

  async function planAction(action) {
    if (!data || programFilter === "all") return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const payload = {
        program_id: Number(programFilter),
        term_label: data.active_term?.label || selectedPlan?.term_label || "Current Term",
        action,
      };
      if (action === "draft") {
        payload.selections = programRows.map((row) => {
          const current = selections[row.course.id] || defaultSelection(row);
          return {
            course_id: row.course.id,
            offer: current.offer,
            section_count: current.sections || row.suggested_sections || 0,
          };
        });
      }
      const res = await api.saveCourseAdjustmentPlan(payload);
      setData(res.data);
      setSelections(seedSelections(res.data));
      setMessage(res.message);
      setLastSaved(new Date().toISOString());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function toggleOffer(row) {
    if (!canEdit) return;
    setSelections((current) => {
      const existing = current[row.course.id] || defaultSelection(row);
      return {
        ...current,
        [row.course.id]: { ...existing, offer: !existing.offer },
      };
    });
  }

  if (loading) return <Spinner label="Loading course demand..." />;

  if (error && !data) {
    return <EmptyState icon={AlertTriangle} title="Could not load course demand" hint={error} />;
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Course demand</h1>
          <p className="mt-1 text-sm text-slate-500">Upcoming term - {activeTermLabel}</p>
          <span className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${planningOpen ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
            <span className={`h-2 w-2 rounded-full ${planningOpen ? "bg-brand-600" : "bg-slate-400"}`} />
            {planningOpen ? "Planning window open" : "Planning window closed"}
          </span>
        </div>
        <ActionCluster
          canEdit={canEdit}
          submitBlocked={submitBlocked}
          submitTooltip={submitTooltip}
          busy={busy}
          onSave={() => planAction("draft")}
          onSubmit={() => planAction("submit")}
        />
      </header>

      <ErrorNote message={error} />
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}
      {!planningOpen && <LockBanner message="Planning window is closed. Course demand is available for review only." />}
      {statusLocked && <LockBanner message={`This plan is ${planStatus}. Editing is locked while the Dean approval workflow owns the next step.`} />}
      {!staffCanEdit && <LockBanner message="Only Graduate School staff can edit course demand selections." />}

      <WorkflowIndicator status={planStatus} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Programs with demand" value={stats.programs} icon={FileCheck2} />
        <StatCard label="Enrolled students" value={stats.students} icon={Users} />
        <StatCard label="Subjects with demand" value={stats.subjects} icon={ChevronDown} />
        <StatCard label="High priority subjects" value={stats.high} icon={AlertTriangle} />
      </section>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Filter label="Program">
            <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="field-input min-w-48 cursor-pointer">
              <option value="all">All</option>
              {(data?.programs || []).map((program) => (
                <option key={program.id} value={program.id}>{program.code}</option>
              ))}
            </select>
          </Filter>
          <Filter label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="field-input min-w-48 cursor-pointer">
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Filter>
          <div className="ml-auto flex rounded-xl bg-slate-100 p-1">
            <TabButton active={tab === "subjects"} onClick={() => setTab("subjects")}>Subject demand</TabButton>
            <TabButton active={tab === "students"} onClick={() => setTab("students")}>By student</TabButton>
          </div>
        </div>
      </Card>

      {tab === "subjects" ? (
        <DemandTable
          rows={filteredRows}
          maxDemand={maxDemand}
          openCourseId={openCourseId}
          setOpenCourseId={setOpenCourseId}
          selections={selections}
          canEdit={canEdit}
          onToggleOffer={toggleOffer}
        />
      ) : (
        <ByStudent rows={programRows} selectedProgram={selectedProgram} />
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm font-semibold text-slate-600">
          Draft auto-saved <span className="font-normal text-slate-400">{formatTimestamp(lastSaved || selectedPlan?.updated_at)}</span>
        </p>
        <ActionCluster
          canEdit={canEdit}
          submitBlocked={submitBlocked}
          submitTooltip={submitTooltip}
          busy={busy}
          onSave={() => planAction("draft")}
          onSubmit={() => planAction("submit")}
        />
      </Card>
    </div>
  );
}

function ActionCluster({ canEdit, submitBlocked, submitTooltip, busy, onSave, onSubmit }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onSave} disabled={!canEdit || busy === "draft"} className="btn-ghost" title={!canEdit ? "Editing is locked." : "Save draft"}>
        {busy === "draft" ? <SpinnerDot /> : <Save className="h-4 w-4" />}
        Save draft
      </button>
      <button type="button" onClick={onSubmit} disabled={submitBlocked || busy === "submit"} className="btn-primary" title={submitTooltip}>
        {busy === "submit" ? <SpinnerDot light /> : <Send className="h-4 w-4" />}
        Submit to Dean
      </button>
    </div>
  );
}

function WorkflowIndicator({ status }) {
  const stepIndex = Math.max(0, STEPS.indexOf(status));
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <div key={step} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${current ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${current ? "bg-white/20" : "bg-white"}`}>{index + 1}</span>}
                {step}
              </span>
              {index < STEPS.length - 1 && <span className="text-slate-300">-</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DemandTable({ rows, maxDemand, openCourseId, setOpenCourseId, selections, canEdit, onToggleOffer }) {
  if (!rows.length) {
    return <EmptyState icon={FileCheck2} title="No subjects match these filters" hint="Try a different program or demand status." />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Subject</th>
              <th className="px-3 py-3">Demand</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Faculty availability</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = selections[row.course.id] || defaultSelection(row);
              const expanded = openCourseId === row.course.id;
              return (
                <Fragment key={row.course.id}>
                  <tr className="border-b border-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{row.course.code}</p>
                      <p className="text-xs text-slate-500">{row.course.title}</p>
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setOpenCourseId(expanded ? null : row.course.id)} className="group flex w-full min-w-40 items-center gap-3 text-left cursor-pointer">
                        <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (row.demand_count / maxDemand) * 100)}%` }} />
                        </span>
                        <span className="font-bold text-brand-700 underline-offset-2 group-hover:underline">{row.demand_count} students</span>
                      </button>
                    </td>
                    <td className="px-3 py-3"><DemandStatus status={row.demand_status} /></td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{row.availability_count}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => onToggleOffer(row)} disabled={!canEdit} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${selected.offer ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:cursor-not-allowed disabled:opacity-50`}>
                        {selected.offer ? "Offer" : "Hold"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan="5" className="px-5 py-4">
                        <StudentPanel row={row} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StudentPanel({ row }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{row.course.code} student demand</p>
          <p className="text-xs text-slate-500">{row.students.length} student(s) need this subject.</p>
        </div>
        <button type="button" onClick={() => exportStudents(row)} className="btn-ghost px-3 py-2">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>
      {row.students.length === 0 ? (
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">No student demand for this subject.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">ID number</th>
                <th className="px-3 py-2">Track</th>
                <th className="px-3 py-2">AY entry</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {row.students.map((student) => (
                <tr key={student.student_id} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-semibold text-ink">{student.full_name}</td>
                  <td className="px-3 py-2 text-slate-600">{student.id_number}</td>
                  <td className="px-3 py-2 text-slate-600">{student.track || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{student.ay_entry || "-"}</td>
                  <td className="px-3 py-2">
                    {student.conditional_issues?.length ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">{student.conditional_issues.join(", ")}</span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ByStudent({ rows, selectedProgram }) {
  const students = byStudentRows(rows);
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Next-eligible subjects by student</h2>
        <p className="text-sm text-slate-500">{selectedProgram ? selectedProgram.code : "All programs"} - read-only demand reference.</p>
      </div>
      {students.length === 0 ? (
        <EmptyState icon={Users} title="No student demand found" hint="No active student has a next subject in this filter." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {students.map((student) => (
            <div key={student.student_id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{student.full_name}</p>
                  <p className="text-xs text-slate-500">{student.id_number} - {student.track || "No track"} - AY {student.ay_entry || "-"}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">{student.subjects.length}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {student.subjects.map((subject) => (
                  <span key={subject.course_id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{subject.code}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function seedSelections(payload) {
  const rows = payload?.demand || [];
  const plans = payload?.latest_plans || {};
  const next = {};
  rows.forEach((row) => {
    const plan = plans[String(row.program?.id)] || null;
    const offering = plan?.offerings?.find((item) => item.course_id === row.course.id);
    next[row.course.id] = offering
      ? { offer: offering.status !== "Not Offered", sections: offering.section_count }
      : defaultSelection(row);
  });
  return next;
}

function defaultSelection(row) {
  return { offer: row.demand_count > 0, sections: row.suggested_sections || 0 };
}

function byStudentRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.demand_count <= 0) return;
    row.students?.forEach((student) => {
      if (!map.has(student.student_id)) map.set(student.student_id, { ...student, subjects: [] });
      map.get(student.student_id).subjects.push({
        course_id: row.course.id,
        code: row.course.code,
        title: row.course.title,
        demand_status: row.demand_status,
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function exportStudents(row) {
  const headers = ["full_name", "id_number", "track", "ay_entry", "conditional_issues"];
  const lines = [
    headers.join(","),
    ...row.students.map((student) =>
      headers.map((key) => csvCell(key === "conditional_issues" ? (student[key] || []).join("; ") : student[key] || "")).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${row.course.code}-demand-students.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function submitBlockReason({ staffCanEdit, planningOpen, statusLocked, programFilter, planStatus }) {
  if (!staffCanEdit) return "Only Graduate School staff can submit course demand.";
  if (programFilter === "all") return "Choose one program before submitting to Dean.";
  if (!planningOpen) return "Planning window is closed.";
  if (statusLocked) return `Plan is already ${planStatus}.`;
  return "Save a draft before submitting.";
}

function DemandStatus({ status }) {
  const labels = {
    high: "High demand",
    meets_minimum: "Meets minimum",
    below_minimum: "Below minimum",
    no_demand: "No demand",
  };
  const styles = {
    high: "bg-brand-50 text-brand-700 ring-brand-200",
    meets_minimum: "bg-amber-50 text-amber-700 ring-amber-200",
    below_minimum: "bg-slate-100 text-slate-700 ring-slate-200",
    no_demand: "bg-red-50 text-red-700 ring-red-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${styles[status] || styles.no_demand}`}>{labels[status] || status}</span>;
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function Filter({ label, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors cursor-pointer ${active ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function LockBanner({ message }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      <Lock className="h-4 w-4" />
      {message}
    </div>
  );
}

function SpinnerDot({ light = false }) {
  return <span className={`h-4 w-4 animate-spin rounded-full border-2 ${light ? "border-white/40 border-t-white" : "border-slate-300 border-t-brand-600"}`} />;
}

function formatTimestamp(value) {
  if (!value) return "not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
