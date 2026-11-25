import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table2, Download, AlertTriangle, Check, Flag, CheckCircle2, UserPlus, FileSpreadsheet, SquarePen } from "lucide-react";
import { api } from "../api";
import { useApi, useIsPhone } from "../hooks";
import { Button, Card, EmptyState, Field, FilterBar, FilterSelect, InlineNotice, Modal, PageHeader, Select, Spinner, StatusChip, Textarea } from "../components/ui/index.js";
import { csvCell, downloadBlob } from "../lib/format";
import { toneOf } from "../lib/tone";
import AddStudentDialog from "../components/monitoring/AddStudentDialog";
import StudentRecordPanel from "../components/monitoring/StudentRecordPanel";
import { ayEntryOf } from "../components/monitoring/knownData";
import { PAGE } from "../lib/labels.js";

// One colour per subject status in the matrix. UX-30 (2026-11-21): five colours you can tell apart, and a letter in
// every cell so the colour is never the only sign (WCAG 1.4.1): green = done, blue = enrolled or planned, amber = INC,
// red = failed or withdrawn, grey = dropped or not taken. The letter tells the statuses of one colour apart.
const DONE = "bg-brand-600 text-white";
const NOW = "bg-blue-100 text-blue-800";
const WAIT = "bg-amber-200 text-amber-900";
const BAD = "bg-red-200 text-red-800";
const NONE = "bg-slate-100 text-slate-500";
const CELL_VIEW = {
  Completed: { cls: DONE, mark: "C" },
  Taken: { cls: DONE, mark: "T" },
  Current: { cls: NOW, mark: "E" },
  Enrolled: { cls: NOW, mark: "E" },
  Planned: { cls: NOW, mark: "P" },
  INC: { cls: WAIT, mark: "I" },
  Failed: { cls: BAD, mark: "F" },
  Withdrawn: { cls: BAD, mark: "W" },
  Dropped: { cls: NONE, mark: "D" },
  Missing: { cls: NONE, mark: "–" },
};
// The legend is read from the same table, so a swatch can never disagree with its cells. Ordered by colour.
const LEGEND = [
  ["Officially completed", "Completed"],
  ["Taken", "Taken"],
  ["Enrolled", "Enrolled"],
  ["Planned", "Planned"],
  ["INC", "INC"],
  ["Failed", "Failed"],
  ["Withdrawn", "Withdrawn"],
  ["Dropped", "Dropped"],
  ["Not taken", "Missing"],
];
const DONE_STATUSES = new Set(["Completed", "Taken"]); // what the server counts as done (monitoring_grid)
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
  const phone = useIsPhone(); // UX-31: a card per student below 640 px instead of the grid
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedProgress = searchParams.get("progress") || "";
  const selectedRisk = searchParams.get("risk") || "";
  const selectedEnrollment = searchParams.get("enrollment") || "";
  const selectedTermId = searchParams.get("term_id") || "";
  const sortBy = searchParams.get("sort") || "name";
  // Stakeholder UAT (B14): look at one cohort - the students admitted in one academic year - of the program.
  const selectedEntry = searchParams.get("entry") || "";
  const activeFilters = [selectedProgress, selectedRisk, selectedEnrollment, selectedEntry].filter(Boolean).length;
  const [studentSearch, setStudentSearch] = useState("");
  const searchTerms = studentSearch.toLowerCase().split(/[\s,]+/).filter(Boolean);
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
  const entryOptions = useMemo(() => {
    const years = [...new Set((grid?.students || []).map((s) => s.academic_year_entry).filter(Boolean))];
    years.sort((a, b) => String(b).localeCompare(String(a)));
    return years.map((year) => ({ value: year, label: `Admitted AY ${year}` }));
  }, [grid?.students]);
  const sortedStudents = useMemo(() => {
    const rows = (grid?.students || []).filter((s) => !selectedEntry || s.academic_year_entry === selectedEntry);
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
  }, [grid?.students, sortBy, selectedEntry]);

  const visibleStudents = sortedStudents.filter((student) => {
    const identity = `${displayStudentName(student)} ${student.student_number || ""}`.toLowerCase();
    return searchTerms.every((term) => identity.includes(term));
  });

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
    const header = ["Student", "Student ID", "AY Entry", "YR", "Lifecycle stage", ...flatCourses.map((c) => c.code), "Completed", "Total", "% Complete"];
    const lines = [header.map(csvCell).join(",")];
    visibleStudents.forEach((s) => {
      lines.push([
        displayStudentName(s), s.student_number, s.academic_year_entry, s.year_level, s.stage || "",
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
      // another program has other admission years, so a program change clears the year
      entry: next.entry ?? (next.program_id !== undefined && next.program_id !== programId ? "" : selectedEntry),
    };
    const params = {};
    if (merged.program_id) params.program_id = merged.program_id;
    if (merged.progress) params.progress = merged.progress;
    if (merged.risk) params.risk = merged.risk;
    if (merged.enrollment) params.enrollment = merged.enrollment;
    if (merged.sort && merged.sort !== "name") params.sort = merged.sort;
    if (merged.term_id) params.term_id = merged.term_id;
    if (merged.entry) params.entry = merged.entry;
    setSearchParams(params, { replace: true });
  }

  const openFlags = (flagStudent?.flags || []).filter((item) => item.status === "Open");
  const programOptions = (meta?.programs || []).map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` }));
  const currentTermLabel = (grid?.terms || meta?.terms || []).find((term) => term.relative_label === "Current")?.label || "";
  const termOptions = (grid?.terms || meta?.terms || []).map((term) => ({ value: String(term.id), label: `${term.label}${term.relative_label ? ` (${term.relative_label})` : ""}` }));

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={Table2}
        title={PAGE.monitoringSheet}
        description={grid && !canEdit ? "View only" : undefined}
        actions={canEdit && <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add student</Button>}
      />
      {savedNotice && <InlineNotice tone="success" onDismiss={() => setSavedNotice("")}>{savedNotice}</InlineNotice>}

      {/* Owner feedback 2026-11-23 (stage 4): the one filter row. The old "Filters" and "Export" disclosures sat in a
          wrapping row, so opening Filters pushed Sort and Export aside and squeezed the selects into a column. */}
      <FilterBar
        search={{ value: studentSearch, onChange: setStudentSearch, placeholder: "Name or student ID", label: "Student", shownLabel: "Student" }}
        active={activeFilters + (searchTerms.length ? 1 : 0)}
        onClear={() => { setStudentSearch(""); updateFilters({ progress: "", risk: "", enrollment: "", entry: "" }); }}
        summary={grid ? `Showing ${visibleStudents.length} of ${grid.students?.length || 0} students` : null}
        actions={grid && (
          <>
            <Button as="a" variant="secondary" size="sm" icon={FileSpreadsheet} href={api.monitoringExportUrl(programId)} download>Export workbook</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={loading || Boolean(error)}>Export CSV</Button>
          </>
        )}
      >
        <FilterSelect label="Program" aria-label="Program" placeholder="" value={programId} options={programOptions} onChange={(e) => updateFilters({ program_id: e.target.value })} />
        <FilterSelect label="Semester" aria-label="Semester" placeholder="" value={selectedTermId || String(grid?.selected_term?.id || "")} options={termOptions} onChange={(e) => updateFilters({ term_id: e.target.value })} />
        <FilterSelect label="Sort" aria-label="Sort monitoring sheet" placeholder="" value={sortBy} options={SORT_OPTIONS} onChange={(e) => updateFilters({ sort: e.target.value })} />
        <FilterSelect label="Year admitted" aria-label="Year admitted" placeholder="All years admitted" value={selectedEntry} options={entryOptions} onChange={(e) => updateFilters({ entry: e.target.value })} />
        <FilterSelect label="Progress" aria-label="Progress" placeholder="All progress" value={selectedProgress} options={PROGRESS_OPTIONS} onChange={(e) => updateFilters({ progress: e.target.value })} />
        <FilterSelect label="Risk" aria-label="Risk" placeholder="All risk" value={selectedRisk} options={RISK_OPTIONS} onChange={(e) => updateFilters({ risk: e.target.value })} />
        <FilterSelect label="Enrollment status" aria-label="Enrollment status" placeholder="All enrollment" value={selectedEnrollment} options={ENROLLMENT_OPTIONS} onChange={(e) => updateFilters({ enrollment: e.target.value })} />
      </FilterBar>

      {grid?.integrity?.issue_count > 0 && (
        <InlineNotice tone="warning" icon={AlertTriangle}>
          {`${grid.integrity.issue_count} record(s) do not match`}
        </InlineNotice>
      )}

      <ul aria-label="Colour legend" className="meta flex flex-wrap items-center gap-x-3 gap-y-2">
        {LEGEND.map(([label, status]) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span data-swatch="" className={`grid h-5 w-5 place-items-center rounded text-2xs font-bold ring-1 ring-black/10 ${CELL_VIEW[status].cls}`} aria-hidden="true">{CELL_VIEW[status].mark}</span>
            <span>{label}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="relative h-5 w-5 rounded bg-white ring-1 ring-black/10" aria-hidden="true"><span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" /></span> <span>Manual entry</span>
        </li>
      </ul>

      {loading ? (
        <Spinner label="Loading monitoring sheet…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load the sheet" hint={error} />
      ) : !grid || visibleStudents.length === 0 ? (
        <Card>
          {searchTerms.length > 0 ? (
            <EmptyState
              icon={Table2}
              title="No students match this search"
              hint="Search covers the selected program and filters."
              action={<Button variant="secondary" onClick={() => setStudentSearch("")}>Clear search</Button>}
            />
          ) : activeFilters > 0 ? (
            <EmptyState
              icon={Table2}
              title="No students match these filters"
              hint="Clear a filter to see the other students of this program."
              action={<Button variant="secondary" onClick={() => updateFilters({ progress: "", risk: "", enrollment: "", entry: "" })}>Clear filters</Button>}
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
      ) : phone ? (
        <ul aria-label="Students" className="space-y-3">
          {visibleStudents.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              categories={grid.categories}
              canEdit={canEdit}
              onFlag={() => openFlagDialog(s)}
              onEdit={() => setRecordPanel({ studentId: s.id, courseId: null })}
              onOpen={() => navigate(`/students/${s.id}`)}
            />
          ))}
        </ul>
      ) : (
        <Card pad="none" className="overflow-hidden">
          <div data-testid="monitoring-scroll" className="overflow-auto overscroll-x-contain" style={{ maxHeight: "min(72vh, 760px)" }}>
            {/* A bespoke grid, not a DataTable: two header rows (category group + vertical subject codes), three
                sticky columns and about forty narrow status cells do not fit DataTable's one-row header. */}
            <table className="min-w-max border-collapse text-2xs sm:text-xs">
              <caption className="sr-only">Curriculum progress of each student, one column per subject</caption>
              <thead>
                {/* group header row */}
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 w-[240px] min-w-[240px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left"
                    rowSpan={2}
                  >
                    <span className="eyebrow">Student</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[240px] top-0 z-30 min-w-[72px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center"
                  >
                    <span className={HEAD}>AY Entry</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[312px] top-0 z-30 min-w-[48px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center"
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
                {visibleStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-brand-50/30">
                    <td className="sticky left-0 z-10 w-[240px] min-w-[240px] max-w-[240px] border-b border-r border-slate-200 bg-white px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="block w-full min-w-0 cursor-pointer text-left"
                      >
                        <span className="block truncate text-sm font-semibold text-ink">{displayStudentName(s)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="micro">Student ID {s.student_number}</span>
                          {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && (
                            <StatusChip status={s.enrollment_tag} size="sm" dot={false} />
                          )}
                          {s.entry_source === "Manual entry" && (
                            <StatusChip tone="warning" label="Manual" size="sm" dot={false} title="This student was added in the portal rather than imported from a sheet." />
                          )}
                          <StatusChip status={s.risk} size="sm" dot={false} />
                        </span>
                        {/* Stakeholder UAT: the cohort's research milestone sits beside its coursework, in one sheet. */}
                        {s.stage && <span className="mt-0.5 block truncate text-2xs font-semibold text-brand-800" title={`Lifecycle stage: ${s.stage}`}>Stage: {s.stage}</span>}
                      </button>
                      {/* UX-30: the row actions say what they do */}
                      <span className="mt-1 flex items-center gap-1">
                        <FlagButton student={s} onClick={() => openFlagDialog(s)} />
                        <RecordButton student={s} canEdit={canEdit} onClick={() => setRecordPanel({ studentId: s.id, courseId: null })} />
                      </span>
                    </td>
                    <td className="sticky left-[240px] z-10 min-w-[72px] border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center font-semibold text-slate-600">
                      {s.academic_year_entry || "—"}
                    </td>
                    <td className="sticky left-[312px] z-10 min-w-[48px] border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center font-semibold text-slate-600">
                      {s.year_level || "—"}
                    </td>
                    {flatCourses.map((c) => {
                      const status = s.cells[c.id] || "Missing";
                      const sty = CELL_VIEW[status] || CELL_VIEW.Missing;
                      const officialStatus = s.official_cells?.[c.id] || "Missing";
                      const statusSource = s.operational_sources?.[c.id] || "";
                      const manual = (s.manual_cells || []).includes(c.id);
                      return (
                        <td key={c.id} className="h-px border-b border-r border-slate-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => setRecordPanel({ studentId: s.id, courseId: c.id })}
                            aria-label={`${c.code} for ${displayStudentName(s)}: ${status === "Missing" ? "not taken" : status}${manual ? ", manual entry" : ""}. ${canEdit ? "Select to edit" : "Select to view"}.`}
                            title={`${c.code} — ${status === "Missing" ? "Not taken" : status}. ${manual ? "Manual entry (hover the record for who and when)." : `Imported/system status: ${officialStatus}.`}${statusSource ? ` Source: ${statusSource}.` : ""}`}
                            className={`relative flex h-full min-h-10 w-full min-w-10 cursor-pointer items-center justify-center text-xs font-bold transition-shadow hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-brand-400 ${sty.cls}`}
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
          defaultAyEntry={ayEntryOf(currentTermLabel)}
          termLabels={(grid?.terms || meta?.terms || []).map((term) => term.label)}
          studentValues={(grid?.students || []).map((s) => s.academic_year_entry)}
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
          studentValues={(grid?.students || []).map((s) => s.academic_year_entry)}
          currentTermLabel={currentTermLabel}
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
                      <StatusChip tone="warning" label="Open flag" dot={false} />
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

// UX-30: the flag and record buttons carry words; on a phone card they are full tap targets (UX-31).
function FlagButton({ student, onClick, large = false }) {
  const count = student.open_flag_count || 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} open flag(s) for ${displayStudentName(student)}`}
      aria-label={`Open flags for ${displayStudentName(student)}`}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md font-semibold transition-colors ${large ? "min-h-11 px-3 text-sm" : "h-7 px-1.5 text-xs"} ${count ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "text-slate-600 hover:bg-amber-50 hover:text-amber-700"}`}
    >
      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
      {count ? `Flags ${count}` : "Flag"}
    </button>
  );
}

function RecordButton({ student, canEdit, onClick, large = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${canEdit ? "Edit" : "View"} the monitoring record of ${displayStudentName(student)}`}
      aria-label={`${canEdit ? "Edit" : "View"} monitoring record of ${displayStudentName(student)}`}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700 ${large ? "min-h-11 px-3 text-sm" : "h-7 px-1.5 text-xs"}`}
    >
      <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
      {canEdit ? "Edit" : "View"}
    </button>
  );
}

// UX-31: on a phone one card per student - the name, the risk and stage, a bar per subject group, the comprehensive
// exam and the research milestones - instead of a grid that has to be swiped sideways.
function StudentCard({ student: s, categories, canEdit, onFlag, onEdit, onOpen }) {
  return (
    <li data-testid="monitoring-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button type="button" onClick={onOpen} className="block min-h-11 w-full cursor-pointer text-left">
        <span className="block text-base font-semibold text-ink">{displayStudentName(s)}</span>
        <span className="meta block">Student ID {s.student_number} · AY {s.academic_year_entry || "—"} · Year {s.year_level || "—"}</span>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusChip status={s.risk} size="sm" dot={false} />
        {s.enrollment_tag && s.enrollment_tag !== "Enrolled" && <StatusChip status={s.enrollment_tag} size="sm" dot={false} />}
        {s.entry_source === "Manual entry" && <StatusChip tone="warning" label="Manual" size="sm" dot={false} />}
      </div>
      {s.stage && <p className="mt-1 text-sm font-semibold text-brand-800">Stage: {s.stage}</p>}
      <div className="mt-3 space-y-2">
        {categories.map((cat) => {
          const total = cat.courses.length;
          const done = cat.courses.filter((course) => DONE_STATUSES.has(s.cells[course.id])).length;
          const name = cat.name.charAt(0) + cat.name.slice(1).toLowerCase();
          return (
            <div key={cat.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{name}</span>
                <span className="meta">{done} of {total}</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${name} ${done} of ${total} done`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
              >
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5"><span className="meta">Compre</span> <CompreExamBadge student={s} /></span>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="meta">Research</span>
          {MILES.map(([key, label]) => (
            <span key={key} className={`inline-flex items-center gap-0.5 text-xs font-medium ${s.milestones[key] ? "text-brand-700" : "text-slate-400"}`}>
              {s.milestones[key] ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
              {label}
              <span className="sr-only">{s.milestones[key] ? " done" : " not yet"}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <FlagButton student={s} onClick={onFlag} large />
        <RecordButton student={s} canEdit={canEdit} onClick={onEdit} large />
      </div>
    </li>
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
