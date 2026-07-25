import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
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
import HistoryDisclosure from "../components/HistoryDisclosure";
import { formatDate } from "../lib/format";

export default function Enrollment() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const [sourceReference, setSourceReference] = useState("Graduate School enrollment review");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [statusEdit, setStatusEdit] = useState(null);
  const [classListPreview, setClassListPreview] = useState(null);

  const programId = searchParams.get("program_id") || "";
  const termId = searchParams.get("term_id") || "";
  const studentId = searchParams.get("student_id") || "";

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
      setStatusEdit(null);
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
  const selectedCourses = useMemo(
    () =>
      (data?.curriculum_subjects || [])
        .filter((course) => selected.has(course.id))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [data?.curriculum_subjects, selected]
  );
  const filteredStudents = (data?.students || []).filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return true;
    return `${student.name} ${student.student_number}`.toLowerCase().includes(query);
  });
  const dirty =
    selected.size !== currentIds.size ||
    [...selected].some((courseId) => !currentIds.has(courseId));

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
    setResult(null);
  }

  async function confirmEnrollment() {
    if (!data?.selected_student) return;
    setBusy("save");
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const review = await api.previewEnrollment({
        student_id: data.selected_student.id,
        term_id: data.term.id,
        course_ids: [...selected],
      });
      if (review.has_blocking_conflicts) {
        setPreview(review);
        return;
      }
      const automaticResolutions = Object.fromEntries(
        (review.conflicts || [])
          .filter((conflict) => conflict.options?.length)
          .map((conflict) => [conflict.id, conflict.options[0].value])
      );
      const response = await api.saveEnrollment({
        student_id: data.selected_student.id,
        term_id: data.term.id,
        course_ids: [...selected],
        resolutions: automaticResolutions,
        source_reference: sourceReference,
        confirmed: true,
      });
      await load();
      setResult({ ...response, automatic_conflicts: review.conflicts || [] });
    } catch (err) {
      setError(err.message || "Could not confirm enrollment.");
    } finally {
      setBusy("");
    }
  }

  async function previewClassList(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("classlist-preview");
    setError("");
    try {
      const response = await api.previewClassList(
        file,
        data?.term?.id || termId || undefined
      );
      setClassListPreview({ file, ...response });
    } catch (err) {
      setError(err.message || "Could not preview the class list.");
    } finally {
      setBusy("");
    }
  }

  async function importClassList() {
    if (!classListPreview?.file) return;
    setBusy("classlist-import");
    setError("");
    try {
      const res = await api.importClassList(
        classListPreview.file,
        data?.term?.id || termId || undefined
      );
      setClassListPreview(null);
      await confirm({
        title: "Class list imported",
        message:
          `${res.message}\n\n` +
          (res.sample_not_found?.length ? `Not found: ${res.sample_not_found.join(", ")}\n` : "") +
          (res.sample_not_offered?.length ? `Not offered/unknown: ${res.sample_not_offered.join(", ")}\n` : "") +
          (res.sample_invalid_faculty?.length ? `Faculty issues: ${res.sample_invalid_faculty.join(", ")}\n` : "") +
          (res.sample_faculty_conflicts?.length ? `Faculty conflicts: ${res.sample_faculty_conflicts.join(", ")}\n` : "") +
          (res.sample_completed_subjects?.length ? `Already completed: ${res.sample_completed_subjects.join(", ")}` : ""),
        confirmLabel: "Done",
        cancelLabel: "Close",
      });
      await load();
    } catch (err) {
      setError(err.message || "Could not import the class list.");
    } finally {
      setBusy("");
    }
  }

  function beginStatusEdit(course) {
    if (!course.current_enrollment_id) return;
    setStatusEdit({
      courseId: course.course_id,
      enrollmentId: course.current_enrollment_id,
      courseCode: course.course_code,
      courseTitle: course.course_title,
      studentName: data?.selected_student?.name || "Student",
      termLabel: data?.term?.label || "",
      status: "",
      effectiveDate: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setError("");
    setResult(null);
  }

  async function saveStatusEdit() {
    if (!statusEdit?.status) {
      setError("Choose Dropped.");
      return;
    }
    if (!statusEdit?.note.trim()) {
      setError("Add a coordinator note before saving the subject status.");
      return;
    }

    setBusy("subject-status");
    setError("");
    try {
      const response = await api.updateEnrollmentSubjectStatus({
        subject_enrollment_id: statusEdit.enrollmentId,
        status: statusEdit.status,
        effective_date: statusEdit.effectiveDate,
        note: statusEdit.note.trim(),
      });
      await load();
      setResult(response);
    } catch (err) {
      setError(err.message || "Could not update the subject status.");
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
            Assign official semester offerings to an individual student. Confirming runs all checks and synchronizes the class list, monitoring sheet, student profile, and portal in one action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`btn-ghost cursor-pointer ${busy === "classlist" ? "pointer-events-none opacity-60" : ""}`}>
            {busy === "classlist-preview"
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              : <ClipboardCheck className="h-4 w-4" />}
            {busy === "classlist-preview" ? "Reading class list..." : "Upload class list"}
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm"
              className="hidden"
              onChange={previewClassList}
              disabled={Boolean(busy)}
            />
          </label>
          <Link to="/course-adjustments?view=offerings" className="btn-ghost">
            <BookOpenCheck className="h-4 w-4" /> Offering list
          </Link>
        </div>
      </div>

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
                                {alreadyEnrolled ? (
                                  <button
                                    type="button"
                                    onClick={() => beginStatusEdit(course)}
                                    className="inline-flex cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                    aria-label={`Change ${course.course_code} student status`}
                                    title="Change student status"
                                  >
                                    <StatusBadge value="Enrolled" dot={false} />
                                  </button>
                                ) : (
                                  <StatusBadge value={course.status_label || "Not taken"} dot={false} />
                                )}
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
                    hint="Publish subjects under Course Adjustments → Offering setup for this program and semester before enrollment."
                  />
                )}
              </Card>

              {preview && <ConflictNotice preview={preview} />}
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
                    placeholder="Official class list, email, or review reference"
                  />
                </label>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={confirmEnrollment}
                    disabled={!dirty || busy}
                    className="btn-primary w-full"
                  >
                    {busy === "save" ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {busy === "save" ? "Checking and saving…" : "Confirm enrollment"}
                  </button>
                </div>
                {!dirty && (
                  <p className="mt-3 text-xs text-slate-500">
                    The draft already matches the saved enrollment.
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">Conflict checks run automatically. Safe warnings follow the authoritative record; blocking conflicts are reported without changing enrollment.</p>
              </Card>

              <IntegrityPanel integrity={data.integrity} />
              <HistoryPanel rows={data.history || []} />
            </div>
          </div>
        </>
      )}
      {statusEdit && (
        <SubjectStatusDialog
          edit={statusEdit}
          setEdit={setStatusEdit}
          error={error}
          busy={busy === "subject-status"}
          onClose={() => {
            if (busy !== "subject-status") {
              setStatusEdit(null);
              setError("");
            }
          }}
          onSave={saveStatusEdit}
        />
      )}
      {classListPreview && (
        <ClassListPreviewDialog
          preview={classListPreview}
          busy={busy === "classlist-import"}
          onClose={() => {
            if (busy !== "classlist-import") setClassListPreview(null);
          }}
          onImport={importClassList}
        />
      )}
    </div>
  );
}

function ClassListPreviewDialog({ preview, busy, onClose, onImport }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-3 backdrop-blur-[1px] sm:p-5"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-list-preview-title"
        aria-describedby="class-list-preview-description"
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-fade-up"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Table2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="class-list-preview-title" className="font-display text-lg font-semibold text-ink">
              Preview class list
            </h2>
            <p id="class-list-preview-description" className="mt-1 truncate text-sm text-slate-500">
              {preview.filename} · {preview.term}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close class list preview"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3" aria-live="polite">
          <PreviewCount label="Rows detected" value={preview.total_rows} tone="neutral" />
          <PreviewCount label="Ready" value={preview.ready_count} tone="ready" />
          <PreviewCount label="Already enrolled" value={preview.warning_count} tone="warning" />
          <PreviewCount label="Needs review" value={preview.error_count} tone="error" />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="w-14 px-4 py-3 text-center">Row</th>
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Program</th>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">Faculty</th>
                <th className="min-w-[260px] px-4 py-3">Import result</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={`${row.row}-${row.student_id}-${row.subject_code}`} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-center text-xs font-semibold text-slate-400">{row.row}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink">
                      {[row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown student"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.student_id || "No student ID"}</p>
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-600">{row.program || "—"}</td>
                  <td className="px-3 py-3 font-semibold text-slate-700">{row.subject_code || "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{row.faculty || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {row.status === "ready" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      ) : (
                        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${row.status === "warning" ? "text-amber-600" : "text-red-600"}`} />
                      )}
                      <p className={`text-xs font-medium leading-relaxed ${
                        row.status === "ready"
                          ? "text-brand-700"
                          : row.status === "warning"
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}>
                        {row.message}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.truncated && (
            <p className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs font-medium text-amber-800">
              Showing the first 300 rows. All detected rows will still be processed.
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-500">
            Rows that need review are skipped. Valid rows and faculty assignments are saved when you confirm.
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-ghost cursor-pointer">
              Choose another file
            </button>
            <button
              type="button"
              onClick={onImport}
              disabled={!preview.total_rows || busy}
              className="btn-primary cursor-pointer"
            >
              {busy ? "Importing..." : "Confirm import"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function PreviewCount({ label, value, tone }) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-700",
    ready: "border-brand-200 bg-brand-50 text-brand-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {label}: {value}
    </span>
  );
}

function SubjectStatusDialog({ edit, setEdit, error, busy, onClose, onSave }) {
  const statusRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    statusRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-status-dialog-title"
        aria-describedby="subject-status-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-fade-up"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="subject-status-dialog-title" className="font-display text-lg font-semibold text-ink">
              Record dropped subject
            </h2>
            <p id="subject-status-dialog-description" className="mt-1 text-sm text-slate-500">
              {edit.studentName} · {edit.courseCode} · {edit.termLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close status dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{edit.courseTitle}</p>
              <p className="mt-0.5 text-xs text-slate-500">Current status</p>
            </div>
            <StatusBadge value="Enrolled" dot={false} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">New status</span>
              <select
                ref={statusRef}
                value={edit.status}
                onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))}
                className="field-input cursor-pointer"
                required
              >
                <option value="">Choose status</option>
                <option value="Dropped">Dropped</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">Effective date</span>
              <input
                type="date"
                value={edit.effectiveDate}
                onChange={(event) => setEdit((current) => ({ ...current, effectiveDate: event.target.value }))}
                className="field-input"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Coordinator note</span>
            <textarea
              value={edit.note}
              onChange={(event) => setEdit((current) => ({ ...current, note: event.target.value }))}
              className="field-input min-h-24 resize-y"
              placeholder="Briefly explain this status change."
              maxLength={2000}
              required
            />
          </label>

          <ErrorNote message={error} />
          <p className="text-xs leading-relaxed text-slate-500">
            Dropping is recorded here by the Academic Coordinator. Penalty-free withdrawal before classes or during the first week must be initiated by the student in the Withdrawal workflow.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!edit.status || !edit.effectiveDate || !edit.note.trim() || busy}
            className="btn-primary cursor-pointer"
          >
            {busy ? "Saving..." : `Save ${edit.status || "status"}`}
          </button>
        </footer>
      </section>
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

function ConflictNotice({ preview }) {
  return (
    <Card className="border-red-200 bg-red-50/50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Enrollment was not changed</h2>
          <p className="mt-1 text-sm text-slate-500">
            The system found {preview.conflict_count} blocking conflict{preview.conflict_count === 1 ? "" : "s"}. Correct the source record, then confirm again.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
          {preview.conflicts.filter((conflict) => conflict.severity === "blocking").map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-xl border border-red-200 bg-white p-4"
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
              <p className="mt-3 text-xs font-semibold text-red-700">No partial enrollment was saved.</p>
            </div>
          ))}
        </div>
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
        <HistoryDisclosure className="mt-4" label="View enrollment history" hideLabel="Hide enrollment history" count={visible.length}>
          <div className="space-y-2">
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
        </HistoryDisclosure>
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
          {result.automatic_conflicts?.length > 0 && (
            <p className="mt-2 text-sm text-brand-800">
              The system automatically resolved {result.automatic_conflicts.length} warning{result.automatic_conflicts.length === 1 ? "" : "s"} by keeping the authoritative enrollment record.
            </p>
          )}
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
