import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check, Lock, Flag, ShieldCheck, CheckCircle2, UserPlus, FileSpreadsheet, PencilLine, SquarePen } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, EmptyState, Field, InlineNotice, Modal, PageHeader, Select, Spinner, StatusChip, Textarea } from "../components/ui/index.js";
import { csvCell, downloadBlob } from "../lib/format";
import { toneOf } from "../lib/tone";
import AddStudentDialog from "../components/monitoring/AddStudentDialog";
import StudentRecordPanel from "../components/monitoring/StudentRecordPanel";

// One colour per subject status in the matrix. The colours follow the semantic tones (UI-SPEC section 3): brand
// green = done, blue = in progress or ahead, red = failed or gone, amber = needs a person, grey = nothing yet.
const CELL_VIEW = {
  Completed: { cls: "bg-brand-500 text-white", mark: "C" },
  Taken: { cls: "bg-brand-100 text-brand-800", mark: "T" },
  Current: { cls: "bg-blue-100 text-blue-700", mark: "R" },
  Enrolled: { cls: "bg-blue-100 text-blue-700", mark: "R" },
  Failed: { cls: "bg-red-100 text-red-700", mark: "F" },
  Dropped: { cls: "bg-slate-200 text-slate-700", mark: "D" },
  Planned: { cls: "bg-blue-50 text-blue-700", mark: "P" },
  INC: { cls: "bg-amber-100 text-amber-800", mark: "I" },
  Withdrawn: { cls: "bg-red-50 text-red-700", mark: "W" },
  Missing: { cls: "bg-slate-50 text-slate-300", mark: "" },
};
// The legend is read from the same table, so a swatch can never disagree with its cells.
const LEGEND = [
  ["Officially completed", "Completed"],
  ["Taken", "Taken"],
  ["Enrolled", "Enrolled"],
  ["Failed", "Failed"],
  ["Dropped", "Dropped"],
  ["Planned", "Planned"],
  ["INC", "INC"],
  ["Withdrawn", "Withdrawn"],
  ["Not taken", "Missing"],
];
const MILES = [
  ["title", "Title"],
  ["proposal", "Proposal"],
  ["ethics", "Ethics"],
  ["final", "Final"],
];
const PROGRESS_OPTIONS = [
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "complete", label: "All subjects complete" },
  { value: "units-complete", label: "Eligible for compre" },
];
const RISK_OPTIONS = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"];
const ENROLLMENT_OPTIONS = [
  { value: "LOA", label: "LOA" },
  { value: "AWOL", label: "AWOL" },
  { value: "LOA/AWOL", label: "LOA or AWOL" },
  { value: "Enrolled", label: "Enrolled" },
  { value: "Withdrawn", label: "Withdrawn" },
];
const SORT_OPTIONS = [
  { value: "name", label: "Sort: Last name" },
  { value: "entry-newest", label: "Sort: AY Entry newest" },
  { value: "entry-oldest", label: "Sort: AY Entry oldest" },
  { value: "completed-desc", label: "Sort: Completed subjects most" },
  { value: "completed-asc", label: "Sort: Completed subjects least" },
  { value: "units-desc", label: "Sort: Completed units most" },
  { value: "risk", label: "Sort: Highest risk" },
];
// Column header text of the matrix (group row and vertical subject row).
const HEAD = "micro font-semibold uppercase tracking-wide";

export default function MonitoringGrid() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedProgress = searchParams.get("progress") || "";
  const selectedRisk = searchParams.get("risk") || "";
  const selectedEnrollment = searchParams.get("enrollment") || "";
  const selectedTermId = searchParams.get("term_id") || "";
  const sortBy = searchParams.get("sort") || "name";
  const filtered = Boolean(selectedProgress || selectedRisk || selectedEnrollment);
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flagStudent, setFlagStudent] = useState(null);
  const [flagForm, setFlagForm] = useState({ category: "", note: "", target_label: "" });
  const flagFormId = useId();
  const [flagBusy, setFlagBusy] = useState(false);
  const [flagError, setFlagError] = useState("");
  const [resolvingFlagId, setResolvingFlagId] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [recordPanel, setRecordPanel] = useState(null); // { studentId, courseId }
  const [savedNotice, setSavedNotice] = useState("");

  // Filters and sort live in the URL. Several quick changes send several requests: only the newest answer may fill
  // the page, so a slow old answer cannot overwrite a newer one.
  const latestLoad = useRef(0);
  function load(pid, nextProgress = selectedProgress, nextRisk = selectedRisk, nextEnrollment = selectedEnrollment) {
    const ticket = ++latestLoad.current;
    const newest = () => ticket === latestLoad.current;
    setLoading(true);
    setError("");
    api.monitoringGrid({ program_id: pid || undefined, term_id: selectedTermId || undefined, progress: nextProgress, risk: nextRisk, enrollment: nextEnrollment })
      .then((g) => {
        if (!newest()) return;
        setGrid(g);
        setProgramId(String(g.program.id));
      })
      .catch((e) => newest() && setError(e.message))
      .finally(() => newest() && setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId, selectedProgress, selectedRisk, selectedEnrollment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedProgress, selectedRisk, selectedEnrollment, selectedTermId]);

  const canEdit = Boolean(grid?.permissions?.can_edit);
  const flatCourses = useMemo(
    () => (grid ? grid.categories.flatMap((c) => c.courses) : []),
    [grid]
  );
  const sortedStudents = useMemo(() => {
    const rows = [...(grid?.students || [])];
    const riskRank = { Delayed: 0, "At Risk of Delay": 1, "On Track": 2, "Not Yet Assessed": 3 };
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

  function openFlagDialog(student) {
    setFlagStudent(student);
    setFlagForm({ category: "", note: "", target_label: "" });
    setFlagError("");
    setResolvingFlagId(null);
    setResolutionNote("");
  }

  async function flagIssue(event) {
    event.preventDefault();
    if (!flagStudent) return;
    setFlagBusy(true);
    setFlagError("");
    try {
      await api.flagMonitoringIssue(flagStudent.id, {
        category: flagForm.category,
        note: flagForm.note,
        target_kind: flagForm.target_label ? "Subject" : "Whole record",
        target_label: flagForm.target_label,
      });
      load(programId);
      setFlagStudent(null);
    } catch (e) {
      setFlagError(e.message);
    } finally {
      setFlagBusy(false);
    }
  }

  async function resolveFlag(item) {
    if (!flagStudent) return;
    setFlagBusy(true);
    setFlagError("");
    try {
      await api.resolveMonitoringFlag(flagStudent.id, item.id, {
        resolution_note: resolutionNote,
      });
      load(programId);
      setFlagStudent((current) => current ? {
        ...current,
        flags: (current.flags || []).map((flag) => flag.id === item.id ? {
          ...flag,
          status: "Resolved",
          resolution_note: resolutionNote,
        } : flag),
        open_flag_count: Math.max(0, (current.open_flag_count || 1) - 1),
      } : current);
      setResolvingFlagId(null);
      setResolutionNote("");
    } catch (e) {
      setFlagError(e.message);
    } finally {
      setFlagBusy(false);
    }
  }

  function exportCsv() {
    if (!grid) return;
    const header = ["Student", "IDNO", "AY Entry", "YR", ...flatCourses.map((c) => c.code), "Completed", "Total", "% Complete"];
    const lines = [header.map(csvCell).join(",")];
    sortedStudents.forEach((s) => {
      lines.push([
        displayStudentName(s), s.student_number, s.academic_year_entry, s.year_level,
        ...flatCourses.map((c) => s.cells[c.id] || "Missing"),
        s.completed, s.total, s.rate,
      ].map(csvCell).join(","));
    });
    // The byte-order mark makes Excel read names such as "Niño" as UTF-8.
    downloadBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `monitoring-${grid.program.code}.csv`);
  }

  function updateFilters(next) {
    const merged = {
      program_id: next.program_id ?? programId,
      progress: next.progress ?? selectedProgress,
      risk: next.risk ?? selectedRisk,
      enrollment: next.enrollment ?? selectedEnrollment,
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

  const openFlags = (flagStudent?.flags || []).filter((item) => item.status === "Open");
  const programOptions = (meta?.programs || []).map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` }));
  const termOptions = (grid?.terms || meta?.terms || []).map((term) => ({ value: String(term.id), label: `${term.label}${term.relative_label ? ` (${term.relative_label})` : ""}` }));

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={Table2}
        title="Monitoring Sheet"
        description={canEdit
          ? "Curriculum progress for each student. Add students and edit subject rows here, or upload a workbook under Student Handoff."
          : "Curriculum progress for each student (view only)."}
        actions={(
          <>
            {grid && <Button as="a" variant="secondary" icon={FileSpreadsheet} href={api.monitoringExportUrl(programId)} download>Export workbook</Button>}
            {canEdit && <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add student</Button>}
          </>
        )}
      />
      {savedNotice && <InlineNotice tone="success" onDismiss={() => setSavedNotice("")}>{savedNotice}</InlineNotice>}

      <Card pad="sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
          <Select aria-label="Program" placeholder="" value={programId} options={programOptions} onChange={(e) => updateFilters({ program_id: e.target.value })} />
          <Select aria-label="Semester" placeholder="" value={selectedTermId || String(grid?.selected_term?.id || "")} options={termOptions} onChange={(e) => updateFilters({ term_id: e.target.value })} />
          <Select aria-label="Progress" placeholder="All progress" value={selectedProgress} options={PROGRESS_OPTIONS} onChange={(e) => updateFilters({ progress: e.target.value })} />
          <Select aria-label="Risk" placeholder="All risk" value={selectedRisk} options={RISK_OPTIONS} onChange={(e) => updateFilters({ risk: e.target.value })} />
          <Select aria-label="Enrollment status" placeholder="All enrollment" value={selectedEnrollment} options={ENROLLMENT_OPTIONS} onChange={(e) => updateFilters({ enrollment: e.target.value })} />
          <Select aria-label="Sort monitoring sheet" placeholder="" value={sortBy} options={SORT_OPTIONS} onChange={(e) => updateFilters({ sort: e.target.value })} />
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!grid}>Export CSV</Button>
        </div>
      </Card>

      {canEdit ? (
        <InlineNotice tone="neutral" icon={PencilLine} title="Select a subject cell or the pencil beside a name to add or edit a row.">
          Everything you type is marked Manual entry with your name and the time, and is kept in the change history. Imported values are never overwritten silently: a later upload that disagrees with a portal entry is held for review. Grades are not entered here.
        </InlineNotice>
      ) : (
        <InlineNotice tone="neutral" icon={Lock} title="View only.">
          Select a cell to see where a value came from and its change history. Only Graduate School staff and the Academic Coordinator can edit.
        </InlineNotice>
      )}

      {grid?.integrity && (
        <InlineNotice tone={grid.integrity.issue_count ? "warning" : "success"} icon={grid.integrity.issue_count ? AlertTriangle : ShieldCheck}>
          {grid.integrity.issue_count
            ? `${grid.integrity.issue_count} enrollment/profile inconsistency item(s) found`
            : `Enrollment and student profiles are synchronized (${grid.integrity.checked_enrollments} rows checked)`}
        </InlineNotice>
      )}

      <ul aria-label="Colour legend" className="meta flex flex-wrap items-center gap-x-3 gap-y-2">
        {LEGEND.map(([label, status]) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ring-1 ring-black/10 ${CELL_VIEW[status].cls}`} aria-hidden="true" /> {label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="relative h-3 w-3 rounded bg-slate-100 ring-1 ring-black/10" aria-hidden="true"><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" /></span> Manual entry
        </li>
      </ul>

      {loading ? (
        <Spinner label="Loading monitoring sheet…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load the sheet" hint={error} />
      ) : !grid || grid.students.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={Table2}
              title="No students match these filters"
              hint="Clear a filter to see the other students of this program."
              action={<Button variant="secondary" onClick={() => updateFilters({ progress: "", risk: "", enrollment: "" })}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Table2}
              title="No students in this program yet"
              hint={canEdit ? "Add a student here, or import a monitoring workbook under Student Handoff." : "Staff can add students here or import a monitoring workbook."}
              action={canEdit ? <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add student</Button> : null}
            />
          )}
        </Card>
      ) : (
        <Card pad="none" className="overflow-hidden">
          <div className="meta border-b border-slate-100 bg-slate-50 px-3 py-2 font-medium sm:hidden">
            Swipe sideways to review all subject columns.
          </div>
          <div className="overflow-auto overscroll-x-contain" style={{ maxHeight: "min(72vh, 760px)" }}>
            {/* A bespoke grid, not a DataTable: two header rows (category group + vertical subject codes), three
                sticky columns and about forty narrow status cells do not fit DataTable's one-row header. */}
            <table className="min-w-max border-collapse text-2xs sm:text-xs">
              <caption className="sr-only">Curriculum progress of each student, one column per subject</caption>
              <thead>
                {/* group header row */}
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 min-w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left sm:min-w-[220px] sm:px-3"
                    rowSpan={2}
                  >
                    <span className="eyebrow">Student</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[170px] top-0 z-30 min-w-[72px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center sm:left-[220px]"
                  >
                    <span className={HEAD}>AY Entry</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[242px] top-0 z-30 min-w-[48px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center sm:left-[292px]"
                  >
                    <span className={HEAD}>YR</span>
                  </th>
                  {grid.categories.map((cat) => (
                    <th
                      key={cat.name}
                      colSpan={cat.courses.length}
                      className={`${HEAD} sticky top-0 z-20 h-8 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center`}
                    >
                      <span>{cat.name}</span>
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className={`${HEAD} sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center`}
                    style={{ width: 96, minWidth: 96 }}
                  >
                    Compre Exam
                  </th>
                  <th
                    colSpan={MILES.length}
                    className={`${HEAD} sticky top-0 z-20 h-8 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center`}
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
                          onClick={() => openFlagDialog(s)}
                          title={`${s.open_flag_count || 0} open flag(s) for ${displayStudentName(s)}`}
                          aria-label={`Open flags for ${displayStudentName(s)}`}
                          className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-md cursor-pointer transition-colors ${s.open_flag_count ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"}`}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {s.open_flag_count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-600 px-1 text-2xs font-semibold text-white">{s.open_flag_count}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordPanel({ studentId: s.id, courseId: null })}
                          title={`${canEdit ? "Edit" : "View"} the monitoring record of ${displayStudentName(s)}`}
                          aria-label={`${canEdit ? "Edit" : "View"} monitoring record of ${displayStudentName(s)}`}
                          className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                        >
                          <SquarePen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${s.id}`)}
                          className="flex min-w-0 flex-1 items-center text-left cursor-pointer"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-ink sm:text-sm">{displayStudentName(s)}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="micro">IDNO {s.student_number}</span>
                              {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                                <StatusChip status={s.enrollment_tag} size="sm" dot={false} />
                              )}
                              {s.entry_source === "Manual entry" && (
                                <StatusChip tone="warn" label="Manual" size="sm" dot={false} title="This student was added in the portal rather than imported from a sheet." />
                              )}
                              <StatusChip status={s.risk} size="sm" dot={false} />
                            </span>
                          </span>
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
                      const manual = (s.manual_cells || []).includes(c.id);
                      return (
                        <td key={c.id} className="border-b border-r border-slate-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => setRecordPanel({ studentId: s.id, courseId: c.id })}
                            aria-label={`${c.code} for ${displayStudentName(s)}: ${status === "Missing" ? "not taken" : status}${manual ? ", manual entry" : ""}. ${canEdit ? "Select to edit" : "Select to view"}.`}
                            title={`${c.code} — ${status === "Missing" ? "Not taken" : status}. ${manual ? "Manual entry (hover the record for who and when)." : `Imported/system status: ${officialStatus}.`}${statusSource ? ` Source: ${statusSource}.` : ""}`}
                            className={`relative flex h-9 w-full min-w-10 cursor-pointer items-center justify-center text-2xs font-semibold transition-shadow hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-brand-400 sm:h-10 ${sty.cls}`}
                          >
                            {sty.mark}
                            {manual && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                          </button>
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

      {addOpen && (
        <AddStudentDialog
          programs={meta?.programs || grid?.programs || []}
          defaultProgramId={programId}
          onClose={() => setAddOpen(false)}
          onCreated={(result, openNow) => {
            load(programId);
            if (openNow) setRecordPanel({ studentId: result.student.id, courseId: null });
            else setSavedNotice(result.message);
          }}
        />
      )}

      {recordPanel && (
        <StudentRecordPanel
          studentId={recordPanel.studentId}
          focusCourseId={recordPanel.courseId}
          termLabels={(grid?.terms || meta?.terms || []).map((term) => term.label)}
          onClose={() => setRecordPanel(null)}
          onChanged={() => load(programId)}
          onOpenProfile={(id) => navigate(`/students/${id}`)}
        />
      )}

      {flagStudent && (
        <Modal
          title={`Flags for ${displayStudentName(flagStudent)}`}
          subtitle={`${flagStudent.student_number} · monitoring remains read-only`}
          icon={Flag}
          size="md"
          onClose={() => setFlagStudent(null)}
          closeLabel="Close flag dialog"
          dismissible={!flagBusy}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setFlagStudent(null)}>Cancel</Button>
              <Button type="submit" form={flagFormId} loading={flagBusy} disabled={!flagForm.category || !flagForm.note.trim()}>{flagBusy ? "Saving…" : "Save flag"}</Button>
            </>
          )}
        >
          <div className="space-y-5">
            {openFlags.length > 0 && (
              <div className="space-y-3">
                <p className="field-label">Open flags</p>
                {openFlags.map((item) => (
                  <div key={item.id} className={`rounded-xl border p-4 ${toneOf("warning").notice}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.category}</p>
                        <p className="mt-0.5 text-xs font-medium">On: {item.target_label || "Whole record"}</p>
                        <p className="mt-1 text-sm">{item.note}</p>
                        <p className="mt-2 text-xs opacity-80">{item.source} · {item.created_by}</p>
                      </div>
                      <StatusChip tone="warn" label="Open flag" dot={false} />
                    </div>
                    {resolvingFlagId === item.id ? (
                      <div className="mt-4 space-y-2 border-t border-amber-200 pt-4">
                        <Field label="How was this resolved?">
                          <Textarea rows={3} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Describe the corrected source, advising outcome, or verified resolution." />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button icon={CheckCircle2} disabled={flagBusy || !resolutionNote.trim()} onClick={() => resolveFlag(item)}>Resolve flag</Button>
                          <Button variant="secondary" onClick={() => { setResolvingFlagId(null); setResolutionNote(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setResolvingFlagId(item.id)}>Resolve</Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form id={flagFormId} onSubmit={flagIssue} className={`space-y-4 ${openFlags.length > 0 ? "border-t border-slate-200 pt-5" : ""}`}>
              <div>
                <h3 className="card-title">Add a manual flag</h3>
                <p className="meta mt-1 leading-relaxed">Choose what is being flagged and record the observation. Source-correctable flags can close automatically after a clean monitoring upload.</p>
              </div>
              <Field label="What is this flag about?">
                <Select
                  value={flagForm.target_label}
                  placeholder="Whole record"
                  options={flatCourses.map((course) => ({ value: `${course.code} — ${course.title}`, label: `${course.code} — ${course.title}` }))}
                  onChange={(event) => setFlagForm((current) => ({ ...current, target_label: event.target.value }))}
                />
              </Field>
              <Field label="Flag category" required>
                <Select
                  value={flagForm.category}
                  placeholder="Choose category"
                  options={grid?.flag_categories || []}
                  required
                  onChange={(event) => setFlagForm((current) => ({ ...current, category: event.target.value }))}
                />
              </Field>
              <Field label="Note / reason" required>
                <Textarea
                  rows={4}
                  value={flagForm.note}
                  placeholder="Describe what appears incorrect or what follow-up is needed."
                  required
                  onChange={(event) => setFlagForm((current) => ({ ...current, note: event.target.value }))}
                />
              </Field>
              {flagError && <InlineNotice tone="danger">{flagError}</InlineNotice>}
            </form>
          </div>
        </Modal>
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
      <StatusChip status={label} size="sm" dot={false} className="min-w-20 justify-center" />
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
