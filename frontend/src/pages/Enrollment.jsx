import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpenCheck, Check, CheckCircle2, ClipboardCheck, Lock, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { api } from "../api";
import { useConfirm } from "../components/confirm";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  InlineNotice,
  Input,
  PageHeader,
  SearchInput,
  SectionCard,
  Select,
  Spinner,
  StatusChip,
} from "../components/ui/index.js";
import PolicyRules from "../components/PolicyRules";
import { StudyPlanPanel } from "../components/ProcessGates";
import { PAGE } from "../lib/labels.js";
import { toneOf } from "../lib/tone";
import ClassListPreviewDialog from "./enrollment/ClassListPreviewDialog.jsx";
import SubjectStatusDialog from "./enrollment/SubjectStatusDialog.jsx";
import { integrityNotes } from "./enrollment/integrity.js";
import {
  ConflictNotice,
  EnrollmentHistory,
  RuleFlagPanel,
  StudentSummary,
  SubjectStatusSummary,
  SuccessPanel,
} from "./enrollment/panels.jsx";

// Conflicts that come from a business rule (add/change window, academic load): the
// coordinator decides each one; they are never resolved automatically.
const RULE_FLAG_KINDS = new Set(["add_window_closed", "change_window_closed", "over_load"]);

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
  const [ruleReview, setRuleReview] = useState(null);
  const [ruleDecisions, setRuleDecisions] = useState({});

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
  // Problems the server's consistency check found about this student (I-081): shown beside the subject, not as a widget.
  const notes = useMemo(
    () => integrityNotes(data?.integrity, data?.selected_student, data?.offered_subjects),
    [data?.integrity, data?.selected_student, data?.offered_subjects]
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

  async function confirmEnrollment(decisions = null) {
    if (!data?.selected_student) return;
    setBusy("save");
    setError("");
    setPreview(null);
    setResult(null);
    if (!decisions) setRuleReview(null);
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
      const ruleFlags = (review.conflicts || []).filter((conflict) => RULE_FLAG_KINDS.has(conflict.kind));
      if (ruleFlags.length && !decisions) {
        // A business rule is involved: show it and let the coordinator decide.
        setRuleReview({ flags: ruleFlags, load: review.load });
        setRuleDecisions(Object.fromEntries(ruleFlags.map((flag) => [flag.id, flag.options.some((option) => option.value === "exclude") ? "exclude" : ""])));
        return;
      }
      const automaticResolutions = Object.fromEntries(
        (review.conflicts || [])
          .filter((conflict) => conflict.options?.length)
          .map((conflict) => [conflict.id, (decisions && decisions[conflict.id]) || conflict.options[0].value])
      );
      const response = await api.saveEnrollment({
        student_id: data.selected_student.id,
        term_id: data.term.id,
        course_ids: [...selected],
        resolutions: automaticResolutions,
        source_reference: sourceReference,
        confirmed: true,
      });
      setRuleReview(null);
      await load();
      setResult({ ...response, automatic_conflicts: (review.conflicts || []).filter((conflict) => !RULE_FLAG_KINDS.has(conflict.kind)) });
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
      unexcusedAbsencePercent: "",
    });
    setError("");
    setResult(null);
  }

  // The dialog has already checked that every field is filled in (validateDrop); this only sends it.
  async function saveStatusEdit() {
    setBusy("subject-status");
    setError("");
    try {
      const response = await api.updateEnrollmentSubjectStatus({
        subject_enrollment_id: statusEdit.enrollmentId,
        status: statusEdit.status,
        effective_date: statusEdit.effectiveDate,
        unexcused_absence_percent: Number(statusEdit.unexcusedAbsencePercent),
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

  const programOptions = (data?.programs || []).map((program) => ({ value: String(program.id), label: `${program.code} — ${program.name}` }));
  const termOptions = (data?.terms || []).map((term) => ({
    value: String(term.id),
    label: `${term.label}${term.relative_label ? ` (${term.relative_label})` : ""}`,
  }));
  const studentOptions = filteredStudents.map((student) => ({
    value: String(student.id),
    label: `${student.last_name}, ${student.first_name} — ${student.student_number}`,
  }));

  // The Add / Selected / locked button of one subject. Below `sm` the table scrolls sideways and its last column is out of
  // sight, so the same button is also shown under the subject name there (the column is hidden then).
  function renderAction(course) {
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
    const Icon = !canToggle ? (completed ? CheckCircle2 : Lock) : active ? Check : Plus;
    return (
      <Button
        variant={active && canToggle ? "primary" : "secondary"}
        size="sm"
        icon={Icon}
        onClick={() => toggleCourse(course.course_id)}
        aria-pressed={active}
        disabled={!canToggle}
        title={course.status_reason}
      >
        {actionLabel}
      </Button>
    );
  }

  const offeredColumns = [
    {
      key: "subject",
      header: "Subject",
      cell: (course) => (
        <>
          <p className="font-semibold text-ink">{course.course_code}</p>
          <p className="meta">{course.course_title}</p>
          <p className="meta">
            {[course.course_category, course.course_units != null ? `${course.course_units} unit${Number(course.course_units) === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 sm:hidden">{renderAction(course)}</div>
        </>
      ),
    },
    {
      key: "status",
      header: "Student status",
      cell: (course) => (
        <div className="max-w-xs space-y-1.5">
          {course.enrollment_state === "enrolled_current" ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status="Enrolled" dot={false} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => beginStatusEdit(course)}
                aria-label={`Change ${course.course_code} student status`}
                title="Change student status"
              >
                Change
              </Button>
            </div>
          ) : (
            <StatusChip status={course.status_label || "Not taken"} dot={false} />
          )}
          <p className="meta leading-relaxed">{course.status_reason}</p>
          {(notes.byCode[course.course_code] || []).map((note) => (
            <p key={note} role="status" className={`rounded-lg border px-2.5 py-1.5 text-xs ${toneOf("warning").notice}`}>{note}</p>
          ))}
        </div>
      ),
    },
    {
      key: "demand",
      header: "Demand",
      cell: (course) => `${course.demand_count} student${course.demand_count === 1 ? "" : "s"}`,
    },
    {
      key: "action",
      header: "Enrollment",
      align: "right",
      hideBelow: "sm",
      cell: (course) => renderAction(course),
    },
  ];

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={ClipboardCheck}
        title={PAGE.enrollment}
        description={
          <>
            Assign official semester offerings to an individual student. Confirming runs all checks and synchronizes the class list, monitoring sheet, student profile, and portal in one action.
            <span className="meta mt-1 block">
              A class list row marked Dropped is accepted only with an "Unexcused Absence Percent" column above the handbook limit (20%), or a "Drop Exception Reason" that explains the approved exception.
            </span>
          </>
        }
        actions={
          <>
            <Button
              as="label"
              variant="secondary"
              icon={ClipboardCheck}
              loading={busy === "classlist-preview"}
              disabled={Boolean(busy) && busy !== "classlist-preview"}
              className="cursor-pointer focus-within:ring-2 focus-within:ring-brand-500"
            >
              {busy === "classlist-preview" ? "Reading class list..." : "Upload class list"}
              <input type="file" accept=".csv,.xlsx,.xlsm" className="sr-only" onChange={previewClassList} disabled={Boolean(busy)} />
            </Button>
            <Button as={Link} to="/course-adjustments?view=offerings" variant="secondary" icon={BookOpenCheck}>Offering list</Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <PolicyRules process="enrollment" title="Enrollment and academic load: rules applied" />
        <PolicyRules process="course_adjustment" title="Adding or changing a subject: rules applied" />
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Program">
            <Select
              placeholder=""
              options={programOptions}
              value={String(data?.program?.id || programId)}
              onChange={(event) => updateFilters({ program_id: event.target.value, student_id: "" })}
            />
          </Field>
          <Field label="Academic semester">
            <Select
              placeholder=""
              options={termOptions}
              value={String(data?.term?.id || termId)}
              onChange={(event) => updateFilters({ term_id: event.target.value })}
            />
          </Field>
          <Field label="Student">
            <Select
              placeholder=""
              options={studentOptions}
              value={String(data?.selected_student?.id || studentId)}
              onChange={(event) => updateFilters({ student_id: event.target.value })}
            />
          </Field>
        </div>
        {(data?.students || []).length > 12 && (
          <SearchInput
            className="mt-3 max-w-md"
            value={studentSearch}
            onChange={setStudentSearch}
            placeholder="Filter the student picker..."
            label="Filter students"
          />
        )}
      </Card>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
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

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              <SectionCard
                title="Official offered subjects"
                subtitle="Status comes from the monitoring sheet. Completed and already-enrolled subjects are shown but locked; only Not taken subjects can be added."
                action={<StatusChip status={`${data.offered_subjects.length} offered`} tone="neutral" dot={false} />}
              >
                {notes.general.map((note) => (
                  <InlineNotice key={note} tone="warning">{note}</InlineNotice>
                ))}
                <DataTable
                  caption="Official offered subjects for this semester"
                  columns={offeredColumns}
                  rows={data.offered_subjects}
                  rowKey="id"
                  minWidth="sm"
                  pageSize={0}
                  empty={{
                    icon: BookOpenCheck,
                    title: "No official subjects offered",
                    hint: "Publish subjects under Course Adjustments → Offering setup for this program and semester before enrollment.",
                  }}
                />
              </SectionCard>

              {preview && <ConflictNotice preview={preview} />}
              {ruleReview && (
                <RuleFlagPanel
                  review={ruleReview}
                  decisions={ruleDecisions}
                  setDecisions={setRuleDecisions}
                  busy={busy === "save"}
                  onCancel={() => setRuleReview(null)}
                  onSave={() => confirmEnrollment(ruleDecisions)}
                />
              )}
            </div>

            <div className="space-y-5">
              <SectionCard
                title="Enrollment draft"
                subtitle={`${selectedCourses.length} subject${selectedCourses.length === 1 ? "" : "s"} · ${selectedCourses.reduce((sum, course) => sum + (course.units || 0), 0)} units`}
              >
                <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {selectedCourses.length ? (
                    selectedCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{course.code}</p>
                          <p className="meta line-clamp-2">{course.title}</p>
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
                            <Lock className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : (
                          <Button
                            variant="icon"
                            icon={X}
                            onClick={() => toggleCourse(course.id)}
                            aria-label={`Remove ${course.code}`}
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      size="sm"
                      icon={ClipboardCheck}
                      title="No subjects selected yet"
                      hint="Choose Add on a subject in the list to start this semester's draft."
                    />
                  )}
                </div>
                <Field label="Source / reference">
                  <Input
                    value={sourceReference}
                    onChange={(event) => setSourceReference(event.target.value)}
                    placeholder="Official class list, email, or review reference"
                  />
                </Field>
                <Button
                  className="w-full"
                  icon={ShieldCheck}
                  onClick={() => confirmEnrollment()}
                  disabled={!dirty || Boolean(busy)}
                  loading={busy === "save"}
                >
                  {busy === "save" ? "Checking and saving…" : "Confirm enrollment"}
                </Button>
                {!dirty && <p className="meta">The draft already matches the saved enrollment. Add or remove a subject to change it.</p>}
                <p className="meta">Conflict checks run automatically. Safe warnings follow the authoritative record; blocking conflicts are reported without changing enrollment.</p>
              </SectionCard>

              <EnrollmentHistory rows={data.history || []} />
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

      {/* BPMN 2 Enrollment: curriculum version tagging and the derived study plan draft sent to the
          Academic Coordinator. One student drives it: the one chosen at the top of this page (I-082). */}
      <StudyPlanPanel
        students={data?.students || []}
        studentId={data?.selected_student ? String(data.selected_student.id) : undefined}
        studentName={data?.selected_student?.name}
      />
    </div>
  );
}
