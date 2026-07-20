import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  GraduationCap,
  Inbox,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../api";
import { useConfirm } from "../components/confirm";
import { Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";

export default function Enrollment() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const [resolutions, setResolutions] = useState({});
  const [manualCourseId, setManualCourseId] = useState("");
  const [sourceReference, setSourceReference] = useState("Graduate School enrollment review");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const programId = searchParams.get("program_id") || "";
  const termId = searchParams.get("term_id") || "";
  const studentId = searchParams.get("student_id") || "";
  const showDropRequests = searchParams.get("view") === "drop-requests";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.enrollment({
        program_id: programId || undefined,
        term_id: termId || undefined,
        student_id: studentId || undefined,
      });
      setData(response);
      setSelected(new Set(response.current_course_ids || []));
      setPreview(null);
      setResolutions({});
      setManualCourseId("");
      const canonical = {
        program_id: String(response.program.id),
        term_id: String(response.term.id),
      };
      if (response.selected_student) canonical.student_id = String(response.selected_student.id);
      const changed =
        canonical.program_id !== programId ||
        canonical.term_id !== termId ||
        (canonical.student_id || "") !== studentId;
      if (changed) setSearchParams(canonical, { replace: true });
    } catch (err) {
      setError(err.message || "Could not load enrollment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // load is intentionally keyed to the URL filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, termId, studentId]);

  const currentIds = useMemo(
    () => new Set(data?.current_course_ids || []),
    [data?.current_course_ids]
  );
  const offeredIds = useMemo(
    () => new Set((data?.offered_subjects || []).map((course) => course.course_id)),
    [data?.offered_subjects]
  );
  const selectedCourses = useMemo(
    () =>
      (data?.curriculum_subjects || [])
        .filter((course) => selected.has(course.id))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [data?.curriculum_subjects, selected]
  );
  const manualOptions = (data?.curriculum_subjects || []).filter(
    (course) => course.selectable && !offeredIds.has(course.id) && !selected.has(course.id)
  );
  const filteredStudents = (data?.students || []).filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return true;
    return `${student.name} ${student.student_number}`.toLowerCase().includes(query);
  });
  const dirty =
    selected.size !== currentIds.size ||
    [...selected].some((courseId) => !currentIds.has(courseId));
  const unresolved = (preview?.conflicts || []).filter(
    (conflict) => !resolutions[conflict.id]
  );

  function updateFilters(next) {
    const params = {
      program_id: next.program_id ?? programId,
      term_id: next.term_id ?? termId,
      student_id: next.student_id ?? studentId,
    };
    if (next.program_id && next.program_id !== programId) params.student_id = "";
    setResult(null);
    setSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
      { replace: true }
    );
  }

  function toggleDropRequests() {
    const params = new URLSearchParams(searchParams);
    if (showDropRequests) params.delete("view");
    else params.set("view", "drop-requests");
    setSearchParams(params);
  }

  function toggleCourse(courseId) {
    const course = (data?.curriculum_subjects || []).find((item) => item.id === courseId);
    if (currentIds.has(courseId) || (course && !course.selectable && !selected.has(courseId))) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
    setPreview(null);
    setResolutions({});
    setResult(null);
  }

  function addManualCourse() {
    if (!manualCourseId) return;
    toggleCourse(Number(manualCourseId));
    setManualCourseId("");
  }

  async function runPreview() {
    if (!data?.selected_student) return;
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      const response = await api.previewEnrollment({
        student_id: data.selected_student.id,
        term_id: data.term.id,
        course_ids: [...selected],
      });
      setPreview(response);
      setResolutions({});
    } catch (err) {
      setError(err.message || "Could not check enrollment conflicts.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!preview || unresolved.length || preview.has_blocking_conflicts) return;
    const changeCount = preview.additions.length + preview.removals.length;
    const ok = await confirm({
      title: "Save this enrollment?",
      message:
        `${data.selected_student.name} · ${data.term.label}\n\n` +
        `${preview.additions.length} subject(s) will be added and ${preview.removals.length} removed. ` +
        "The monitoring sheet, student profile, portal, and semester record will update together.",
      confirmLabel: changeCount ? "Save enrollment" : "Confirm enrollment",
    });
    if (!ok) return;
    setBusy("save");
    setError("");
    try {
      const response = await api.saveEnrollment({
        student_id: data.selected_student.id,
        term_id: data.term.id,
        course_ids: [...selected],
        resolutions,
        source_reference: sourceReference,
        confirmed: true,
      });
      setResult(response);
      await load();
      setResult(response);
    } catch (err) {
      setError(err.message || "Could not save enrollment.");
    } finally {
      setBusy("");
    }
  }

  if (loading && !data) return <Spinner label="Loading enrollment workspace..." />;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Enrollment</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Assign the official semester offerings to an individual student. Every save checks
            conflicts first and synchronizes the monitoring sheet, student profile, and portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleDropRequests}
            className={showDropRequests ? "btn-primary" : "btn-ghost"}
          >
            <Inbox className="h-4 w-4" />
            {showDropRequests ? "Back to enrollment" : "Drop requests"}
          </button>
          <Link to="/course-adjustments" className="btn-ghost">
            <BookOpenCheck className="h-4 w-4" /> Offering list
          </Link>
        </div>
      </div>

      {showDropRequests ? (
        <DropRequestsPanel
          program={data?.program}
          onEnrollmentChanged={load}
        />
      ) : (
        <>
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Program">
            <select
              value={data?.program?.id || programId}
              onChange={(event) =>
                updateFilters({ program_id: event.target.value, student_id: "" })
              }
              className="field-input cursor-pointer"
            >
              {(data?.programs || []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} — {program.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Academic semester">
            <select
              value={data?.term?.id || termId}
              onChange={(event) => updateFilters({ term_id: event.target.value })}
              className="field-input cursor-pointer"
            >
              {(data?.terms || []).map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}{term.relative_label ? ` (${term.relative_label})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Student">
            <select
              value={data?.selected_student?.id || studentId}
              onChange={(event) => updateFilters({ student_id: event.target.value })}
              className="field-input cursor-pointer"
            >
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.last_name}, {student.first_name} — {student.student_number}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(data?.students || []).length > 12 && (
          <div className="relative mt-3 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              className="field-input pl-9"
              placeholder="Filter the student picker..."
              aria-label="Filter students"
            />
          </div>
        )}
      </Card>

      <ErrorNote message={error} />
      {result && <SuccessPanel result={result} />}

      {!data?.selected_student ? (
        <Card>
          <EmptyState
            icon={UserRound}
            title="No students in this program"
            hint="Import or add the student through Student Handoff first."
          />
        </Card>
      ) : (
        <>
          <StudentSummary data={data} selectedCount={selected.size} dirty={dirty} />
          <SubjectStatusSummary summary={data.subject_status_summary} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Official offered subjects
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Status comes from the monitoring sheet. Completed and already-enrolled
                      subjects are shown but locked; only Not taken subjects can be added.
                    </p>
                  </div>
                  <StatusBadge
                    value={`${data.offered_subjects.length} offered`}
                    dot={false}
                  />
                </div>
                {data.offered_subjects.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          <th className="px-5 py-3">Subject</th>
                          <th className="px-3 py-3">Category</th>
                          <th className="px-3 py-3">Units</th>
                          <th className="px-3 py-3">Student status</th>
                          <th className="px-3 py-3">Demand</th>
                          <th className="px-5 py-3 text-right">Enrollment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.offered_subjects.map((course) => {
                          const active = selected.has(course.course_id);
                          const alreadyEnrolled = course.enrollment_state === "enrolled_current";
                          const completed = course.enrollment_state === "completed";
                          const canToggle = course.selectable && !alreadyEnrolled;
                          const actionLabel = completed
                            ? "Completed"
                            : alreadyEnrolled
                            ? "Enrolled"
                            : course.enrollment_state === "enrolled_other_term"
                            ? course.status_label || "Other term"
                            : course.enrollment_state === "requires_resolution"
                            ? course.status_label || "Review"
                            : active
                            ? "Selected"
                            : "Add";
                          return (
                            <tr
                              key={course.id}
                              className={`border-b border-slate-50 transition-colors ${
                                canToggle ? "hover:bg-brand-50/40" : "bg-slate-50/40"
                              }`}
                            >
                              <td className="px-5 py-3">
                                <p className="font-semibold text-ink">{course.course_code}</p>
                                <p className="text-xs text-slate-500">{course.course_title}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-600">{course.course_category}</td>
                              <td className="px-3 py-3 text-slate-600">{course.course_units}</td>
                              <td className="px-3 py-3">
                                <StatusBadge value={course.status_label || "Not taken"} dot={false} />
                                <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-500">
                                  {course.status_reason}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {course.demand_count} student{course.demand_count === 1 ? "" : "s"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleCourse(course.course_id)}
                                  aria-pressed={active}
                                  disabled={!canToggle}
                                  title={course.status_reason}
                                  className={
                                    !canToggle
                                      ? "inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500"
                                      : active
                                      ? "inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                                      : "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                                  }
                                >
                                  {!canToggle ? (
                                    completed ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />
                                  ) : active ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                  {actionLabel}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={BookOpenCheck}
                    title="No official subjects offered"
                    hint="Publish subjects in Course Adjustments for this program and semester before normal enrollment."
                  />
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Manual curriculum exception
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a Not taken curriculum subject that is not on the official offering
                      list. Completed, enrolled, and unresolved statuses cannot be selected here.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={manualCourseId}
                        onChange={(event) => setManualCourseId(event.target.value)}
                        className="field-input cursor-pointer"
                        aria-label="Manual subject exception"
                      >
                        <option value="">Choose a non-offered subject</option>
                        {manualOptions.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.code} — {course.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addManualCourse}
                        disabled={!manualCourseId}
                        className="btn-ghost shrink-0"
                      >
                        <Plus className="h-4 w-4" /> Add exception
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              {preview && (
                <ConflictPreview
                  preview={preview}
                  resolutions={resolutions}
                  onResolve={(conflictId, value) =>
                    setResolutions((current) => ({ ...current, [conflictId]: value }))
                  }
                />
              )}
            </div>

            <div className="space-y-5">
              <Card className="p-5">
                <h2 className="font-display text-lg font-semibold text-ink">Enrollment draft</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCourses.length} subject{selectedCourses.length === 1 ? "" : "s"} ·{" "}
                  {selectedCourses.reduce((sum, course) => sum + (course.units || 0), 0)} units
                </p>
                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {selectedCourses.length ? (
                    selectedCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-ink">{course.code}</p>
                          <p className="line-clamp-2 text-xs text-slate-500">{course.title}</p>
                          {currentIds.has(course.id) ? (
                            <p className="mt-1 text-xs font-semibold text-brand-700">
                              Already enrolled · monitoring sheet
                            </p>
                          ) : !course.is_offered ? (
                            <p className="mt-1 text-xs font-semibold text-amber-700">
                              Manual exception
                            </p>
                          ) : null}
                        </div>
                        {currentIds.has(course.id) ? (
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"
                            title={`${course.code} is already enrolled according to the monitoring sheet`}
                          >
                            <Lock className="h-4 w-4" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCourse(course.id)}
                            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${course.code}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      No subjects selected for this semester.
                    </p>
                  )}
                </div>
                <label className="mt-4 block">
                  <span className="field-label">Source / reference</span>
                  <input
                    value={sourceReference}
                    onChange={(event) => setSourceReference(event.target.value)}
                    className="field-input"
                    placeholder="Registrar list, email, or review reference"
                  />
                </label>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={runPreview}
                    disabled={!dirty || busy}
                    className="btn-primary w-full"
                  >
                    {busy === "preview" ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <FileSearch className="h-4 w-4" />
                    )}
                    Check conflicts
                  </button>
                  {preview && (
                    <button
                      type="button"
                      onClick={save}
                      disabled={
                        busy ||
                        unresolved.length > 0 ||
                        preview.has_blocking_conflicts
                      }
                      className="btn-ghost w-full border-brand-200 text-brand-700"
                    >
                      {busy === "save" ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Save synchronized enrollment
                    </button>
                  )}
                </div>
                {!dirty && (
                  <p className="mt-3 text-xs text-slate-500">
                    The draft already matches the saved enrollment.
                  </p>
                )}
                {preview && unresolved.length > 0 && (
                  <p className="mt-3 text-xs font-semibold text-amber-700">
                    Resolve {unresolved.length} conflict{unresolved.length === 1 ? "" : "s"} below
                    before saving.
                  </p>
                )}
              </Card>

              <IntegrityPanel integrity={data.integrity} />
              <HistoryPanel rows={data.history || []} />
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function DropRequestsPanel({ program, onEnrollmentChanged }) {
  const confirm = useConfirm();
  const [status, setStatus] = useState("Submitted");
  const [items, setItems] = useState([]);
  const [permissions, setPermissions] = useState({ can_decide: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load(nextStatus = status) {
    setLoading(true);
    setError("");
    return api
      .courseDropRequests(nextStatus, program?.id)
      .then((res) => {
        setItems(res.items || []);
        setPermissions(res.permissions || { can_decide: false });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, program?.id]);

  async function decide(item) {
    const ok = await confirm({
      title: "Record drop request?",
      message:
        `Record the drop of ${item.course_code} for ${item.student?.name || `student #${item.student_id}`}?\n\n` +
        "Dropping is not a discretionary decision — this registers the student's request. The subject is marked Dropped here and follows in the next AIMS sync.",
      confirmLabel: "Record drop",
    });
    if (!ok) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await api.decideCourseDrop(item.id, { decision: "record" });
      setNotice(response.message);
      await load(status);
      onEnrollmentChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Course drop requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dropping has no deny option — the app records the student's request. Recorded drops
              mark the subject Dropped here and follow in the next AIMS sync.
            </p>
          </div>
          <StatusBadge value={program?.code || "All programs"} dot={false} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Submitted", "Recorded", "All"].map((itemStatus) => (
            <button
              key={itemStatus}
              type="button"
              onClick={() => setStatus(itemStatus)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === itemStatus
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {itemStatus}
            </button>
          ))}
        </div>
        {!permissions.can_decide && !loading && (
          <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Graduate School Staff have read-only access. An Academic Coordinator records a drop request.
          </p>
        )}
      </Card>

      <ErrorNote message={error} />
      {notice && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {notice}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading drop requests..." />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={`No ${status === "All" ? "" : `${status.toLowerCase()} `}drop requests`}
            hint={`Student drop requests for ${program?.code || "the selected program"} will appear here.`}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Semester</th>
                  <th className="px-3 py-3">Reason</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-brand-50/30">
                    <td className="px-5 py-3">
                      <Link
                        to={`/students/${item.student_id}`}
                        className="font-semibold text-ink hover:text-brand-700"
                      >
                        {item.student?.name || `Student #${item.student_id}`}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {item.student?.student_number || ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-ink">{item.course_code}</p>
                      <p className="text-xs text-slate-400">{item.course_title}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.term_label || "—"}</td>
                    <td className="max-w-[280px] px-3 py-3 text-slate-600">
                      {item.reason || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge value={item.status} dot={false} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {item.status === "Submitted" && permissions.can_decide ? (
                        <button
                          type="button"
                          onClick={() => decide(item)}
                          disabled={busyId === item.id}
                          className="btn-primary px-3 py-2"
                        >
                          Record drop
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {item.decided_by ? `Recorded by ${item.decided_by}` : "Awaiting coordinator"}
                        </span>
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

function StudentSummary({ data, selectedCount, dirty }) {
  const student = data.selected_student;
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 font-bold text-brand-700">
            {student.first_name?.[0]}{student.last_name?.[0]}
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{student.name}</h2>
            <p className="text-sm text-slate-500">
              {student.student_number} · {student.program_code} · {data.term.label}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={student.enrollment_tag} dot={false} />
          <StatusBadge value={student.standing} dot={false} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {selectedCount} selected
          </span>
          {dirty && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function SubjectStatusSummary({ summary }) {
  if (!summary) return null;
  const items = [
    ["Completed", summary.completed || 0, "Already finished; cannot be added again."],
    ["Enrolled", summary.enrolled || 0, "Already active in the selected semester."],
    ["Not taken", summary.available || 0, "Can be added when offered."],
    [
      "Needs review",
      (summary.enrolled_other_term || 0) + (summary.requires_resolution || 0),
      "Active in another term or has an unresolved monitoring status.",
    ],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monitoring sheet subject status summary">
      {items.map(([label, value, helper]) => (
        <Card key={label} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">
              {value}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p>
        </Card>
      ))}
    </div>
  );
}

function ConflictPreview({ preview, resolutions, onResolve }) {
  const clean = preview.conflicts.length === 0;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            clean ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {clean ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            {clean ? "No conflicts found" : `${preview.conflict_count} conflict(s) found`}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add {preview.additions.length} · remove {preview.removals.length} · keep{" "}
            {preview.unchanged_count}
          </p>
        </div>
      </div>
      {!clean && (
        <div className="mt-4 space-y-3">
          {preview.conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`rounded-xl border p-4 ${
                conflict.severity === "blocking"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50/60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Conflict line: {conflict.line}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{conflict.message}</p>
                </div>
                <StatusBadge value={conflict.severity} dot={false} />
              </div>
              {conflict.options?.length ? (
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">
                    Which record should the system follow?
                  </span>
                  <select
                    value={resolutions[conflict.id] || ""}
                    onChange={(event) => onResolve(conflict.id, event.target.value)}
                    className="field-input cursor-pointer"
                  >
                    <option value="">Choose a resolution</option>
                    {conflict.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mt-3 text-xs font-semibold text-red-700">
                  Remove this subject from the draft or correct its monitoring status before saving.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function IntegrityPanel({ integrity }) {
  if (!integrity) return null;
  const clean = integrity.issue_count === 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Cross-screen consistency</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enrollment, monitoring, profile, and portal are checked together.
          </p>
        </div>
        <StatusBadge value={integrity.status} dot={false} />
      </div>
      <div
        className={`mt-4 rounded-xl border p-3 text-sm ${
          clean
            ? "border-brand-200 bg-brand-50 text-brand-800"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {clean
          ? `${integrity.checked_enrollments} enrollment row(s) checked with no inconsistencies.`
          : `${integrity.issue_count} inconsistency item(s) need review.`}
      </div>
      {!clean && (
        <div className="mt-3 space-y-2">
          {integrity.issues.slice(0, 5).map((issue) => (
            <div key={issue.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-bold uppercase text-slate-400">{issue.type}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{issue.line}</p>
              <p className="mt-1 text-xs text-slate-500">{issue.message}</p>
              {issue.student_id && (
                <Link
                  to={`/students/${issue.student_id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                >
                  Open profile <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function HistoryPanel({ rows }) {
  const visible = rows.filter((row) => row.status !== "Cancelled").slice(0, 8);
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Enrollment history</h2>
      <p className="mt-1 text-sm text-slate-500">Durable semester records for this student.</p>
      {visible.length ? (
        <div className="mt-4 space-y-2">
          {visible.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{row.course_code}</p>
                  <p className="text-xs text-slate-500">{row.term_label}</p>
                </div>
                <StatusBadge value={row.status} dot={false} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Updated {formatDate(row.updated_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No semester enrollment has been saved yet.
        </p>
      )}
    </Card>
  );
}

function SuccessPanel({ result }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div>
          <p className="font-semibold text-brand-900">{result.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={result.links.monitoring} className="btn-ghost px-3 py-2">
              <Table2 className="h-4 w-4" /> Monitoring sheet
            </Link>
            <Link to={result.links.student_profile} className="btn-ghost px-3 py-2">
              <UserRound className="h-4 w-4" /> Student profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
