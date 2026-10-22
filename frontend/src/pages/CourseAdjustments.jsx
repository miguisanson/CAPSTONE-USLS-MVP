import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Circle, ClipboardList, Download, Eye, Send, Settings2, Users } from "lucide-react";
import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  InlineNotice,
  Input,
  SearchInput,
  Select,
  SectionCard,
  Spinner,
  StatCard,
  StatusChip,
  Stepper,
} from "../components/ui/index.js";
import FacultyAssignmentProfile from "../components/FacultyAssignmentProfile";
import {
  NeedsMeaning,
  SubjectNeedsSummary,
  courseMatches,
  downloadSubjectNeedsCsv,
  formatGeneratedAt,
  mergeSubjectNeeds,
  needGroup,
  studentMatches,
} from "../components/SubjectNeedsReport";
import DetailsDrawer from "./courseAdjustments/DetailsDrawer";

const STEPS = ["Draft", "Submitted", "Approved", "Published"];

// The page's title, tabs and rules block belong to CoursePlanning; this is the "Demand & adjustments" screen.
export default function CourseAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedTermId = searchParams.get("term_id") || "";
  const [programId, setProgramId] = useState(selectedProgramId);
  const [termId, setTermId] = useState(selectedTermId);
  const [termLabel, setTermLabel] = useState("Current Semester");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sel, setSel] = useState({});
  const [autosave, setAutosave] = useState("idle");
  const [subjectNeedsReport, setSubjectNeedsReport] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const dirtyRef = useRef(false);

  function load(pid, tid) {
    setLoading(true);
    setError("");
    Promise.all([
      api.courseAdjustments({ program_id: pid || undefined, term_id: tid || undefined }),
      api.subjectNeedsReport({ program_id: pid || undefined, term_id: tid || undefined }),
    ])
      .then(([res, report]) => {
        setData(res);
        setProgramId(String(res.program.id));
        setTermId(res.term ? String(res.term.id) : "");
        setTermLabel(res.latest_plan?.term_label || res.term?.label || "Current Semester");
        setSel(seedSelections(res.demand));
        setSubjectNeedsReport(report);
        dirtyRef.current = false;
        setAutosave("idle");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId, selectedTermId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedTermId]);

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    setSearchParams(params, { replace: true });
  }

  const status = data?.latest_plan?.status || null;
  const stepIndex = status ? STEPS.indexOf(status) : -1;
  const canManage = data?.permissions?.can_manage === true;
  const canEdit = canManage
    && (status === null || status === "Draft" || status === "Returned")
    && data?.planning_window_open !== false;

  async function saveDraft(showMessage = true) {
    if (!programId) return;
    setBusy("draft");
    setError("");
    if (showMessage) setMessage("");
    try {
      const payload = {
        program_id: programId,
        term_id: termId,
        term_label: termLabel,
        action: "draft",
        selections: (data?.demand || []).map((row) => ({
          course_id: row.course.id,
          offer: !!sel[row.course.id]?.offer,
          section_count: Number(sel[row.course.id]?.sections) || row.suggested_sections,
          assigned_faculty_id: Number(sel[row.course.id]?.facultyId) || null,
          notes: sel[row.course.id]?.notes || "",
        })),
      };
      const res = await api.saveCourseAdjustmentPlan(payload);
      setData(res.data);
      setSel(seedSelections(res.data.demand));
      dirtyRef.current = false;
      setAutosave("saved");
      if (showMessage) setMessage(res.message);
    } catch (err) {
      setError(err.message);
      setAutosave("idle");
    } finally {
      setBusy("");
    }
  }

  async function planAction(action) {
    if (!programId) return;
    if (action === "draft") {
      await saveDraft(true);
      return;
    }
    setBusy(action);
    setError("");
    setMessage("");
    try {
      if (action === "submit" && dirtyRef.current && canEdit) {
        await saveDraft(false);
      }
      const res = await api.saveCourseAdjustmentPlan({
        program_id: programId,
        term_id: termId,
        term_label: termLabel,
        action,
      });
      setMessage(res.message);
      setData(res.data);
      setSel(seedSelections(res.data.demand));
      dirtyRef.current = false;
      setAutosave("idle");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function markDirty() {
    dirtyRef.current = true;
    setAutosave("pending");
  }

  useEffect(() => {
    if (autosave !== "pending" || !canEdit) return undefined;
    const timer = window.setTimeout(async () => {
      setAutosave("saving");
      await saveDraft(false);
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave, sel, canEdit]);

  function toggleOffer(row) {
    if (!canEdit) return;
    setSel((current) => {
      const existing = current[row.course.id] || defaultSelection(row);
      const offer = !existing.offer;
      return {
        ...current,
        [row.course.id]: { ...existing, offer, status: offer ? "Offered" : "Not Offered" },
      };
    });
    markDirty();
  }

  function updateSections(row, value) {
    if (!canEdit) return;
    setSel((current) => ({
      ...current,
      [row.course.id]: { ...(current[row.course.id] || defaultSelection(row)), sections: value },
    }));
    markDirty();
  }

  function updateFaculty(row, value) {
    if (!canEdit) return;
    setSel((current) => ({
      ...current,
      [row.course.id]: { ...(current[row.course.id] || defaultSelection(row)), facultyId: value },
    }));
    markDirty();
  }

  const offeredCount = useMemo(() => Object.values(sel).filter((s) => s.offer).length, [sel]);

  // I-069: a suggestion is only worth printing on a row when it tells subjects apart. When every subject has the same
  // suggested faculty member it is said once above the table instead of on every row.
  // I-117: the plan's demand rows and the subject-needs report are ONE list of subjects.
  const demandRows = useMemo(() => mergeSubjectNeeds(data?.demand || [], subjectNeedsReport), [data, subjectNeedsReport]);
  const suggestionNames = [...new Set(demandRows.map((row) => row.faculty_candidates?.[0]?.name).filter(Boolean))];
  const sameSuggestion = suggestionNames.length === 1 ? suggestionNames[0] : "";
  const showRowSuggestions = suggestionNames.length > 1;
  const detailRow = demandRows.find((row) => row.course.id === detailId) || null;
  const reviewed = subjectNeedsReport?.summary?.students_reviewed || 0;
  const needle = query.trim().toLowerCase();
  const groupCounts = {
    all: demandRows.length,
    due: demandRows.filter((row) => needGroup(row) === "due").length,
    later: demandRows.filter((row) => needGroup(row) === "later").length,
  };
  const shownRows = demandRows.filter((row) => (group === "all" || needGroup(row) === group)
    && (!needle || courseMatches(row, needle) || row.needs.students.some((student) => studentMatches(student, needle))));

  const facultyProfiles = data?.faculty_profiles || [];
  const openProfile = (facultyId) => setSelectedFaculty(facultyProfiles.find((faculty) => faculty.id === Number(facultyId)) || null);

  const columns = [
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      sortValue: (row) => row.course.code,
      cell: (row) => {
        const matched = needle && !courseMatches(row, needle) ? row.needs.students.find((student) => studentMatches(student, needle)) : null;
        return (
          <div className="min-w-0 max-w-[14rem]" title={subjectTitle(row)}>
            <p className="truncate font-semibold text-ink">{row.course.code}</p>
            {row.course.title && row.course.title !== row.course.code && <p className="meta truncate">{row.course.title}</p>}
            {matched && <p className="meta truncate text-brand-700">Student match: {matched.name}</p>}
          </div>
        );
      },
    },
    {
      key: "need",
      header: "Needing next term",
      align: "right",
      sortable: true,
      sortValue: (row) => row.needs.need,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2" title={`${row.needs.need} of ${reviewed} reviewed students need it next term`}>
          <span className="font-semibold text-brand-700">{row.needs.need}</span>
          {row.needs.retakes > 0 && <span className="meta">{row.needs.retakes} retake{row.needs.retakes === 1 ? "" : "s"}</span>}
        </div>
      ),
    },
    {
      key: "not_taken",
      header: "Not taken yet",
      align: "right",
      sortable: true,
      sortValue: (row) => row.needs.notTaken,
      cell: (row) => <span className="font-semibold text-slate-700">{row.needs.notTaken}</span>,
    },
    {
      key: "decision",
      header: "Decision",
      cell: (row) => {
        const s = sel[row.course.id] || defaultSelection(row);
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="icon"
              icon={s.offer ? Check : Circle}
              onClick={() => toggleOffer(row)}
              disabled={!canEdit}
              aria-pressed={s.offer}
              aria-label={`${s.offer ? "Hold" : "Offer"} ${row.course.code}`}
              title={s.offer ? "Offered - click to hold" : "Not offered - click to offer"}
              className={s.offer ? "!border-brand-200 !bg-brand-50 !text-brand-700" : ""}
            />
            <StatusChip status={s.status || "No decision"} dot={false} />
          </div>
        );
      },
    },
    {
      key: "sections",
      header: "Sections",
      cell: (row) => {
        const s = sel[row.course.id] || defaultSelection(row);
        return (
          <div className="w-16">
            <Input
              type="number"
              min="0"
              value={s.sections}
              onChange={(e) => updateSections(row, e.target.value)}
              disabled={!canEdit}
              className="px-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              aria-label={`Sections for ${row.course.code}`}
            />
          </div>
        );
      },
    },
    {
      key: "faculty",
      header: "Faculty",
      cell: (row) => {
        const s = sel[row.course.id] || defaultSelection(row);
        const suggested = row.faculty_candidates?.[0];
        return (
          <div className="min-w-40">
            <Select
              value={s.facultyId}
              onChange={(event) => updateFaculty(row, event.target.value)}
              disabled={!canEdit || !s.offer}
              className="min-w-0 disabled:cursor-not-allowed disabled:bg-slate-100"
              aria-label={`Faculty assignment for ${row.course.code}`}
              placeholder="Unassigned"
              options={facultyProfiles.map((faculty) => {
                const candidate = (row.faculty_candidates || []).find((item) => item.id === faculty.id);
                return {
                  value: faculty.id,
                  label: `${faculty.name}${candidate?.preferred ? " · preferred" : ""} · ${candidate ? `${candidate.projected_load}/24u` : faculty.specialization}`,
                };
              })}
            />
            {((showRowSuggestions && suggested) || s.facultyId) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {showRowSuggestions && suggested && (
                  <span className="min-w-0 truncate text-brand-700" title="Recommended from preferences, availability, specialization and teaching load. You can change it.">Suggested: {suggested.name}</span>
                )}
                {s.facultyId && (
                  <button type="button" onClick={() => openProfile(s.facultyId)} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-600 hover:text-brand-700 max-sm:min-h-11">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View profile
                  </button>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "details",
      header: <span className="sr-only">Details</span>,
      align: "right",
      cell: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setDetailId(row.course.id)} aria-label={`Details for ${row.course.code}`}>
          Details
        </Button>
      ),
    },
  ];

  const planSteps = STEPS.map((label, i) => ({
    label,
    state: status === "Returned" && i === 0 ? "returned" : i < stepIndex ? "complete" : i === stepIndex ? "current" : "upcoming",
  }));

  return (
    <div className="page-stack">
      {loading ? (
        <Spinner label="Loading course adjustments..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load course adjustments" hint={error} />
      ) : (
        <>
          <SectionCard
            title="Adjustments and subject demand"
            subtitle="Demand is recalculated automatically from the current student records. The coordinator remains responsible for every offering and faculty decision."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Program">
                <Select
                  value={programId}
                  onChange={(e) => updateFilters({ program_id: e.target.value })}
                  aria-label="Program"
                  placeholder={null}
                  options={(data?.programs || []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                />
              </Field>
              <Field label="Academic year and semester">
                <Select
                  value={termId}
                  onChange={(e) => updateFilters({ term_id: e.target.value })}
                  aria-label="Academic year and semester"
                  placeholder={null}
                  options={(data?.terms || []).map((term) => ({ value: term.id, label: `${formatTermLabel(term.label)}${term.relative_label ? ` (${term.relative_label})` : ""}` }))}
                />
              </Field>
            </div>
            <InlineNotice tone="info" title="Subject needs are calculated automatically">
              Counts below update with the selected program and semester. They support the decision; they do not publish an offering or assign a faculty member by themselves.
            </InlineNotice>
          </SectionCard>

          <Card className="space-y-4">
            <Stepper steps={planSteps} title="Offering plan progress" />
            <p className="text-sm text-slate-600">{planStatusNote(data.latest_plan)}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Demand numbers are guidance. Every curriculum subject remains available for a manual offering decision.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" loading={busy === "draft"} onClick={() => planAction("draft")} icon={Settings2} disabled={!canEdit}>
                  {status === "Draft" || status === "Returned" ? "Update draft" : "Save draft"} ({offeredCount} offered)
                </Button>
                <Button variant={canEdit ? "primary" : "secondary"} loading={busy === "submit"} onClick={() => planAction("submit")} icon={Send} disabled={!canEdit}>
                  Submit for approval
                </Button>
                <Button variant={canManage && status === "Approved" ? "primary" : "secondary"} loading={busy === "publish"} onClick={() => planAction("publish")} icon={CheckCircle2} disabled={!canManage || status !== "Approved"}>
                  Publish
                </Button>
                {canManage && (status === "Submitted" || status === "Approved" || status === "Published") && (
                  <Button variant="secondary" loading={busy === "reopen"} onClick={() => planAction("reopen")} icon={Settings2}>
                    Start new draft
                  </Button>
                )}
              </div>
            </div>
            {!canManage && (
              <InlineNotice tone="neutral">
                Graduate School Staff have read-only access. An Academic Coordinator can change, submit, and publish the offering plan.
              </InlineNotice>
            )}
            {message && <InlineNotice tone="success" onDismiss={() => setMessage("")}>{message}</InlineNotice>}
            {autosave !== "idle" && <p className="meta font-semibold" role="status">{autosave === "pending" ? "Draft changes pending..." : autosave === "saving" ? "Saving..." : "Saved"}</p>}
            {data.latest_plan && (
              <div className="meta flex flex-wrap items-center justify-between gap-2">
                <span>{data.latest_plan.program_code} - {data.latest_plan.term_label} - {data.latest_plan.offerings.length} offering row(s)</span>
                <StatusChip status={data.latest_plan.status} dot={false} />
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={ClipboardList} label="Curriculum subjects" value={data.summary.curriculum_subjects ?? data.demand.length} tone="success" />
            <StatCard icon={Users} label="Affected students" value={data.summary.affected_students ?? 0} tone="info" />
            <StatCard icon={AlertTriangle} label="Delayed if withheld" value={data.summary.students_delayed_if_not_offered ?? 0} tone="warning" />
            <StatCard icon={Settings2} label="Selected to offer" value={offeredCount} tone="success" />
          </div>

          <Card className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="section-title">Course offering decisions</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  <span className="font-semibold text-ink">{subjectNeedsReport.program?.code}</span>
                  {subjectNeedsReport.program?.name ? ` · ${subjectNeedsReport.program.name}` : ""}
                  {subjectNeedsReport.term?.label ? ` · planning for ${formatTermLabel(subjectNeedsReport.term.label)}` : ""}
                  {` · generated ${formatGeneratedAt(subjectNeedsReport.generated_at)}`}
                </p>
              </div>
              <Button variant="secondary" icon={Download} onClick={() => downloadSubjectNeedsCsv(subjectNeedsReport)} className="shrink-0 self-start">
                Download CSV
              </Button>
            </div>
            <SubjectNeedsSummary summary={subjectNeedsReport.summary} />
            <NeedsMeaning />
            {sameSuggestion && (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-brand-700">{sameSuggestion}</span> is the same suggested faculty member for every subject (from preferences, availability, specialization and teaching load), so it is not repeated on each row. Choose the faculty member for each subject below.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search a subject or a student"
                label="Search subjects or students"
                className="min-w-0 sm:w-72"
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Show subjects">
                <FilterPill active={group === "all"} onClick={() => setGroup("all")}>All subjects ({groupCounts.all})</FilterPill>
                <FilterPill active={group === "due"} onClick={() => setGroup("due")}>Needed next term ({groupCounts.due})</FilterPill>
                <FilterPill active={group === "later"} onClick={() => setGroup("later")}>Later in the curriculum ({groupCounts.later})</FilterPill>
              </div>
            </div>
            <DataTable
              caption="Course offering decisions: one row per curriculum subject with students needing it, decision, sections and faculty"
              columns={columns}
              rows={shownRows}
              rowKey={(row) => row.course.id}
              minWidth="lg"
              dense
              pageSize={0}
              empty={
                demandRows.length === 0
                  ? {
                      icon: CheckCircle2,
                      title: "No curriculum subjects found",
                      hint: "This program has no curriculum subjects yet. Import the program's monitoring sheet in Student Handoff first.",
                    }
                  : {
                      icon: CheckCircle2,
                      title: needle ? "Nothing matches that search" : "No subject in this group",
                      hint: needle ? "Try a subject code, a title or a student name." : "Choose All subjects to see every curriculum subject.",
                    }
              }
            />
          </Card>
        </>
      )}
      {detailRow && (
        <DetailsDrawer
          row={detailRow}
          selection={sel[detailRow.course.id] || defaultSelection(detailRow)}
          onClose={() => setDetailId(null)}
        />
      )}
      {selectedFaculty && <FacultyAssignmentProfile faculty={selectedFaculty} onClose={() => setSelectedFaculty(null)} />}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 max-sm:min-h-11 ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function subjectTitle(row) {
  return row.course.title && row.course.title !== row.course.code ? `${row.course.code} · ${row.course.title}` : row.course.code;
}

function seedSelections(rows = []) {
  const next = {};
  rows.forEach((row) => {
    next[row.course.id] = defaultSelection(row);
  });
  return next;
}

function defaultSelection(row) {
  const status = row.offering_status || (row.demand_count > 0 ? "Suggested" : null);
  return {
    offer: status === "Offered" || status === "Suggested",
    sections: row.section_count ?? row.suggested_sections,
    facultyId: row.assigned_faculty_id || "",
    status,
    notes: row.offering_notes || "",
  };
}

function planStatusNote(plan) {
  if (!plan || plan.status === "Draft") return "Draft saved. Review the demand list and submit when ready.";
  if (plan.status === "Submitted") return `Submitted to Dean on ${formatDate(plan.submitted_at)}. Awaiting decision.`;
  if (plan.status === "Returned") return `Returned by Dean on ${formatDate(plan.updated_at)}. Revise and resubmit.`;
  if (plan.status === "Approved") return `Approved by ${plan.approved_by || "Dean"} on ${formatDate(plan.approved_at)}.`;
  if (plan.status === "Published") return `Published on ${formatDate(plan.published_at)}.`;
  return "Review the demand list and submit when ready.";
}

function formatDate(value) {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTermLabel(label) {
  if (!label) return "Academic year and semester";
  const ay = label.match(/AY\s*\d{4}\s*-\s*\d{4}/i)?.[0]?.replace(/\s+/g, " ");
  const semester = label.match(/(?:\d+(?:st|nd|rd|th)\s+Semester|Term\s*\d+)/i)?.[0]?.replace(/\s+/g, " ");
  if (ay && semester) return `${ay.toUpperCase()} ${semester.replace(/^Term\s*1$/i, "1st Semester").replace(/^Term\s*2$/i, "2nd Semester")}`;
  return label;
}
