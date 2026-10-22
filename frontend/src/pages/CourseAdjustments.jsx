import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Circle, ClipboardList, Eye, Send, Settings2, Users, X } from "lucide-react";
import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  InlineNotice,
  Input,
  Select,
  SectionCard,
  Spinner,
  StatCard,
  StatusChip,
  Stepper,
} from "../components/ui/index.js";
import FacultyAssignmentProfile from "../components/FacultyAssignmentProfile";
import SubjectNeedsReport from "../components/SubjectNeedsReport";

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
  const demandRows = data?.demand || [];
  const suggestionNames = [...new Set(demandRows.map((row) => row.faculty_candidates?.[0]?.name).filter(Boolean))];
  const sameSuggestion = suggestionNames.length === 1 ? suggestionNames[0] : "";
  const showRowSuggestions = suggestionNames.length > 1;
  const detailRow = demandRows.find((row) => row.course.id === detailId) || null;

  const facultyProfiles = data?.faculty_profiles || [];
  const openProfile = (facultyId) => setSelectedFaculty(facultyProfiles.find((faculty) => faculty.id === Number(facultyId)) || null);

  const columns = [
    {
      key: "subject",
      header: "Subject",
      cell: (row) => (
        <div className="min-w-0 max-w-[16rem]" title={subjectTitle(row)}>
          <p className="truncate font-semibold text-ink">{row.course.code}</p>
          {row.course.title && row.course.title !== row.course.code && <p className="meta truncate">{row.course.title}</p>}
        </div>
      ),
    },
    {
      key: "demand",
      header: "Demand",
      cell: (row) => (
        <div className="min-w-44">
          <div className="flex items-center gap-3">
            <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${demandBarClass(row.demand_status)}`} style={{ width: `${demandWidth(row)}%` }} />
            </span>
            <span className="font-semibold text-ink">{row.demand_count}</span>
          </div>
          <p className="meta mt-0.5">
            {row.demand_count === 1 ? "student affected" : "students affected"}
            {row.delayed_count ? ` · ${row.delayed_count} delayed if withheld` : ""}
          </p>
        </div>
      ),
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
          <div className="w-20">
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
          <div className="min-w-52">
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

          {subjectNeedsReport && (
            <SubjectNeedsReport report={subjectNeedsReport} termLabel={subjectNeedsReport.term?.label ? formatTermLabel(subjectNeedsReport.term.label) : ""} />
          )}

          <Card className="space-y-4">
            <div>
              <h2 className="section-title">Course offering decisions</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                One affected student is sufficient demand. Open Details on a row to see every student who would be affected and whether withholding the subject would delay progress.
              </p>
            </div>
            {sameSuggestion && (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-brand-700">{sameSuggestion}</span> is the same suggested faculty member for every subject (from preferences, availability, specialization and teaching load), so it is not repeated on each row. Choose the faculty member for each subject below.
              </p>
            )}
            <DataTable
              caption="Course offering decisions: one row per curriculum subject with demand, decision, sections and faculty"
              columns={columns}
              rows={demandRows}
              rowKey={(row) => row.course.id}
              minWidth="lg"
              pageSize={0}
              empty={{
                icon: CheckCircle2,
                title: "No curriculum subjects found",
                hint: "This program has no curriculum subjects yet. Import the program's monitoring sheet in Student Handoff first.",
              }}
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

/** Everything about one subject that does not fit a table row: who is affected, and who could teach it. */
function DetailsDrawer({ row, selection, onClose }) {
  const affected = row.affected_students || [];
  const candidates = (row.faculty_candidates || []).slice(0, 3);
  return (
    <Drawer side="right" label={`${row.course.code} details`} onClose={onClose}>
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="section-title break-words">{row.course.code}</h2>
          {row.course.title && row.course.title !== row.course.code && <p className="mt-0.5 text-sm text-slate-500">{row.course.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={selection.status || "No decision"} dot={false} />
            <span className="meta">{row.selection_source || (row.demand_count > 0 ? "Demand" : "Manual")}</span>
          </div>
        </div>
        <Button variant="icon" icon={X} onClick={onClose} aria-label="Close details" />
      </div>
      <div className="space-y-5 px-4 py-4 sm:px-6">
        <section aria-labelledby="detail-affected">
          <h3 id="detail-affected" className="card-title">
            {affected.length === 1 ? "1 student affected" : `${affected.length} students affected`}
            {row.delayed_count ? <span className="meta ml-2 font-normal">{row.delayed_count} delayed if withheld</span> : null}
          </h3>
          {affected.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No student needs this subject right now. It stays available for a manual offering decision.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-1.5">
              {affected.map((student) => (
                <li key={student.id} className={`min-w-0 rounded-lg border px-3 py-2 text-xs ${student.will_be_delayed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <p className="truncate font-semibold text-ink" title={`${student.name} (${student.student_number})`}>{student.name} <span className="font-normal text-slate-500">({student.student_number})</span></p>
                  <p className={`truncate ${student.will_be_delayed ? "text-amber-800" : "text-slate-600"}`}>{student.impact_basis} · {student.will_be_delayed ? "delayed if not offered" : "no confirmed delay"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="detail-faculty">
          <h3 id="detail-faculty" className="card-title">Who could teach it</h3>
          {candidates.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No faculty member has the availability and teaching load for this subject yet.</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {candidates.map((candidate) => (
                  <li key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-ink">{candidate.name}{candidate.preferred ? <span className="meta ml-2 font-normal">preferred</span> : null}</span>
                    <span className="meta shrink-0">{candidate.projected_load}/24u</span>
                  </li>
                ))}
              </ul>
              <p className="meta mt-2">Recommended from preferences, availability, specialization and teaching load. The coordinator can choose anyone.</p>
            </>
          )}
        </section>
      </div>
    </Drawer>
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

function demandBarClass(status) {
  if (status === "high") return "bg-brand-500";
  if (status === "meets_minimum") return "bg-amber-500";
  if (status === "below_minimum") return "bg-slate-400";
  return "bg-red-200";
}

function demandWidth(row) {
  if (!row.demand_count) return 4;
  return Math.max(8, Math.min(100, (row.demand_count / 15) * 100));
}
