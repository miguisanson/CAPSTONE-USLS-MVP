import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  UserPlus,
  CalendarOff,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  Users,
  CalendarCheck,
  Briefcase,
  GraduationCap,
  LogOut,
  CheckCircle2,
  Info,
  Sparkles,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  GitMerge,
  X,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserRoundCheck,
  Trash2,
  Inbox,
  Eye,
  Search,
  MoreVertical,
  SlidersHorizontal,
  History,
  Download,
  HelpCircle,
  MessageSquare,
  Columns3,
  List,
  Send,
  CheckSquare,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { Field, Input, Textarea, Select, CheckList, RadioRow } from "../components/forms";
import StudentPicker from "../components/StudentPicker";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../components/WorkflowTimeline";
import { formatDate } from "../lib/format";
import { useAuth } from "../auth";
import { Form1EndorsementQueue } from "./Form1Endorsements";

const WORKFLOW_ROLE_LABELS = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  registrar: "Registrar",
};

const ICONS = {
  "student-handoff": UserPlus,
  "leave-of-absence": CalendarOff,
  readmission: UserCheck,
  "course-audit": ClipboardCheck,
  "research-gate": FileCheck,
  "panel-matching": Users,
  "defense-scheduling": CalendarCheck,
  practicum: Briefcase,
  withdrawal: LogOut,
  graduation: GraduationCap,
};

// Student-initiated workflows: staff pick from the submitted-request queue,
// not the full student list (students file these from their own portal).
const USES_REQUEST_QUEUE = {
  "leave-of-absence": true,
  readmission: true,
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "leave-of-absence": true,
  readmission: true,
  "course-audit": false,
  "research-gate": true,
  "panel-matching": true,
  "defense-scheduling": true,
  practicum: false,
  withdrawal: false,
  graduation: false,
};

const OVERVIEW_WORKFLOWS = new Set(["practicum", "withdrawal", "graduation"]);

export default function WorkflowPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(() => {
    const value = searchParams.get("student_id") || window.localStorage.getItem("workflowStudentId");
    return value ? Number(value) : null;
  });
  const [studentLabel, setStudentLabel] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [supportModal, setSupportModal] = useState("");

  // Keep the same student while staff move through research gate, panel
  // matching, and scheduling. The query string also makes the view shareable.
  useEffect(() => {
    setSpecialization("");
    setResult(null);
    setSubmitError("");
    if (USES_REQUEST_QUEUE[slug]) {
      window.localStorage.removeItem("workflowStudentId");
      if (!searchParams.get("student_id")) {
        setStudentId(null);
        setStudentLabel("");
      }
    }
  }, [slug]);

  useEffect(() => {
    if (studentId) {
      if (USES_REQUEST_QUEUE[slug]) {
        window.localStorage.removeItem("workflowStudentId");
      } else {
        window.localStorage.setItem("workflowStudentId", String(studentId));
      }
      if (searchParams.get("student_id") !== String(studentId)) {
        const next = new URLSearchParams(searchParams);
        next.set("student_id", String(studentId));
        setSearchParams(next, { replace: true });
      }
    }
  }, [slug, studentId, searchParams, setSearchParams]);

  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext(slug, { student_id: studentId, specialization }),
    [slug, studentId, specialization]
  );

  const tx = context?.transaction || meta?.transactions?.find((t) => t.slug === slug);
  const Icon = ICONS[slug] || FileCheck;
  const needsStudent = NEEDS_STUDENT[slug];
  const usesQueue = USES_REQUEST_QUEUE[slug];
  const overviewWorkflow = OVERVIEW_WORKFLOWS.has(slug);
  const hideSideRail = overviewWorkflow || slug === "course-audit";

  useEffect(() => {
    if (!usesQueue || loading || !studentId || !context?.submitted_requests) return;
    if (context.submitted_requests.some((request) => request.id === studentId)) return;
    setStudentId(null);
    setStudentLabel("");
    const next = new URLSearchParams(searchParams);
    next.delete("student_id");
    setSearchParams(next, { replace: true });
  }, [usesQueue, loading, studentId, context?.submitted_requests, searchParams, setSearchParams]);

  useEffect(() => {
    if (!studentLabel && context?.selected_student?.search_label) {
      setStudentLabel(context.selected_student.search_label);
    }
  }, [context, studentLabel]);

  async function submit(payload) {
    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const res = await api.submitTransaction(slug, payload);
      setResult(res);
      refetch();
    } catch (err) {
      setSubmitError(err.message || "Could not save. Please review the form.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tx) return <Spinner label="Loading workflow…" />;

  const formProps = {
    meta,
    context,
    studentId,
    specialization,
    setSpecialization,
    submit,
    submitting,
    refreshing: loading,
    result,
    submitError,
    clearSubmitFeedback: () => {
      setResult(null);
      setSubmitError("");
    },
    refetch,
    accountRole: user?.role,
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{tx.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{tx.short}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>
                {tx.actor}
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>
                {tx.data}
              </p>
            </div>
          </div>
          {overviewWorkflow && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto sm:justify-end">
              <button type="button" onClick={() => setSupportModal("guide")} className="btn-ghost cursor-pointer px-3 py-2">
                <HelpCircle className="h-4 w-4" /> How this works
              </button>
              <button type="button" onClick={() => setSupportModal("activity")} className="btn-ghost cursor-pointer px-3 py-2">
                <History className="h-4 w-4" /> View recent activity
              </button>
            </div>
          )}
        </div>
      </Card>

      {result && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 animate-fade-up">
          <CheckCircle2 className="h-5 w-5" /> {result.message}
        </div>
      )}
      <ErrorNote message={submitError} />

      <div className={hideSideRail ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 gap-5 lg:grid-cols-3"}>
        <div className={hideSideRail ? "space-y-5" : "space-y-5 lg:col-span-2"}>
          {needsStudent && !usesQueue && (
            <Card className="p-6">
              <SectionTitle title="Choose a student" subtitle="Pick the record this action applies to" icon={Users} />
              <StudentPicker
                value={studentId}
                selectedLabel={studentLabel}
                meta={meta}
                onChange={(id, label) => {
                  setStudentId(id);
                  setStudentLabel(label || "");
                  setResult(null);
                  if (!id) {
                    window.localStorage.removeItem("workflowStudentId");
                    const next = new URLSearchParams(searchParams);
                    next.delete("student_id");
                    setSearchParams(next, { replace: true });
                  }
                }}
              />
            </Card>
          )}

          {usesQueue && (
            <RequestQueue
              requests={context?.submitted_requests}
              selectedId={studentId}
              onPick={(r) => {
                setStudentId(r.id);
                setStudentLabel(r.search_label || r.name);
                setResult(null);
              }}
              onClear={() => {
                setStudentId(null);
                setStudentLabel("");
                setResult(null);
                const next = new URLSearchParams(searchParams);
                next.delete("student_id");
                setSearchParams(next, { replace: true });
              }}
            />
          )}

          {needsStudent && !studentId ? (
            usesQueue ? null : (
              <Card className="p-6">
                <EmptyState icon={Info} title="Select a student to begin" hint="Search above to load this student's current monitoring data." />
              </Card>
            )
          ) : loading && !context ? (
            <Card className="p-6">
              <Spinner label="Loading workflow data…" />
            </Card>
          ) : error && !context ? (
            <Card className="p-6">
              <EmptyState icon={AlertTriangle} title="Could not load workflow" hint={error} />
            </Card>
          ) : usesQueue && !context?.selected_request ? (
            null
          ) : slug === "research-gate" ? (
            <ResearchGateForm {...formProps} />
          ) : (
            <Card className="p-6">
              {slug === "student-handoff" && <HandoffPanel {...formProps} />}
              {slug === "course-audit" && <CourseAuditPanel meta={meta} />}
              {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
              {slug === "defense-scheduling" && <DefenseSchedulingForm {...formProps} />}
              {slug === "practicum" && <PracticumRoster {...formProps} />}
              {slug === "withdrawal" && <WithdrawalRoster {...formProps} />}
              {slug === "graduation" && <GraduationRoster {...formProps} />}
              {slug === "leave-of-absence" && <LeaveOfAbsenceForm {...formProps} />}
              {slug === "readmission" && <ReadmissionForm {...formProps} />}
            </Card>
          )}
        </div>

        {/* Side rail */}
        {!hideSideRail && <div className="space-y-5">
          <Card className="p-6">
            <SectionTitle title="How this works" icon={Sparkles} />
            <p className="text-sm leading-relaxed text-slate-600">{workflowGuidance(slug)}</p>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Recent in this workflow" icon={Info} />
            {context?.recent_logs?.length ? (
              <ul className="space-y-3">
                {context.recent_logs.map((log) => (
                  <li key={log.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-ink">{log.result}</p>
                    <p className="text-xs text-slate-500">
                      {log.student_name || log.source_reference || "Workflow"} · {formatDate(log.created_at)}
                    </p>
                    {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No recent actions" />
            )}
          </Card>
        </div>}
      </div>
      {supportModal && (
        <WorkflowSupportModal
          slug={slug}
          mode={supportModal}
          logs={context?.recent_logs || []}
          policyQuestions={context?.deployment_policy_questions || []}
          onClose={() => setSupportModal("")}
        />
      )}
    </div>
  );
}

// Submitted-request queue for student-initiated workflows (LOA / Readmission).
function RequestQueue({ requests, selectedId, onPick, onClear }) {
  const list = requests || [];
  const selected = list.find((r) => r.id === selectedId);
  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          title="Submitted requests"
          subtitle="Student-submitted applications waiting for staff review"
          icon={Inbox}
        />
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Users className="h-4 w-4" /> {list.length} pending
        </div>
      </div>
      {selected ? (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{selected.name}</p>
              <p className="text-xs text-slate-500">
                {selected.student_number} · {selected.program_code} · submitted {formatDate(selected.submitted_at)}
              </p>
            </div>
            <button type="button" onClick={onClear} className="btn-ghost shrink-0">
              <ArrowUpRight className="h-4 w-4 rotate-180" /> Back to requests
            </button>
          </div>
          <RequestSummary request={selected} compact />
        </div>
      ) : list.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <div className="col-span-12 sm:col-span-5">Student</div>
            <div className="col-span-12 sm:col-span-5">Request</div>
            <div className="col-span-12 text-right sm:col-span-2">Action</div>
          </div>
          {list.map((r) => (
            <div key={r.request_log_id || r.id} className="grid grid-cols-12 items-center gap-3 border-t border-slate-100 px-4 py-3">
              <div className="col-span-12 min-w-0 sm:col-span-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <StatusBadge value="Pending Review" dot={false} />
                </div>
                <p className="truncate text-xs text-slate-500">
                  {r.student_number} · {r.program_code} · submitted {formatDate(r.submitted_at)}
                </p>
              </div>
              <div className="col-span-12 min-w-0 text-sm text-slate-600 sm:col-span-5">
                <p className="truncate font-semibold text-ink">{r.request_label || "Student request"}</p>
                <p className="truncate text-xs text-slate-500">{r.attachment || "Application PDF uploaded"}</p>
              </div>
              <div className="col-span-12 flex justify-start sm:col-span-2 sm:justify-end">
                <button type="button" onClick={() => onPick(r)} className="btn-primary px-3 py-2">
                  <Eye className="h-4 w-4" /> Review
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No submitted requests yet"
          hint="When a student files this from their portal, they'll appear here for you to act on."
        />
      )}
    </Card>
  );
}

function RequestSummary({ request, compact = false }) {
  if (!request) return null;
  return (
    <div className={`grid gap-3 text-sm ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <Detail label="Request" value={request.request_label || "Submitted application"} />
      <Detail label="Application file" value={request.attachment || "Uploaded PDF"} />
      <Detail label="Submitted" value={formatDate(request.submitted_at)} />
      {request.attachment_detail?.file_exists && request.attachment_detail?.url && (
        <a href={request.attachment_detail.url} target="_blank" rel="noreferrer" className="btn-ghost w-fit px-3 py-2">
          View PDF <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function SubmitButton({ submitting, children }) {
  return (
    <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
      {submitting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — file upload (primary) with a manual fallback
// ---------------------------------------------------------------------------
function HandoffPanel(props) {
  return (
    <div className="space-y-6">
      <HandoffImport />
      <div className="border-t border-slate-200 pt-6">
        <HandoffForm {...props} />
      </div>
    </div>
  );
}

function HandoffImport({ context }) {
  const isAudit = context === "audit";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const { data: uploadHistory, refetch: refetchUploadHistory } = useApi(() => api.monitoringUploads(), []);

  async function resetUploaded() {
    if (!window.confirm("Remove all students/subjects that were brought in by sheet uploads? Seeded demo students are kept.")) return;
    setResetting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.resetUploadedData();
      setResult({ ...res, sample: [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  }

  function pick(f) {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      setError("Please choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.importHandoff(file);
      setResult(res);
      setFile(null);
      refetchUploadHistory();
    } catch (err) {
      setError(err.message || "Could not import the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={isAudit ? "Update audits from monitoring sheet" : "Import from monitoring sheet"}
        subtitle={
          isAudit
            ? "Upload the latest AC Student Monitoring sheet — each student's completed subjects are updated from it"
            : "Upload the AC Student Monitoring Excel file — students, programs, and course audits are created automatically"
        }
        icon={FileSpreadsheet}
        action={
          <Link to="/monitoring-sheet" className="btn-ghost shrink-0">
            <Table2 className="h-4 w-4" /> Full sheet
          </Link>
        }
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <UploadCloud className="h-6 w-6" />
        </span>
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-brand-600" />
            <span className="font-semibold text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600 cursor-pointer"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Drag &amp; drop your .xlsx here</p>
            <p className="text-xs text-slate-500">or</p>
          </>
        )}
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <span className="btn-ghost cursor-pointer">{file ? "Choose a different file" : "Browse files"}</span>
        </label>
        <p className="mt-3 text-xs text-slate-400">
          Expected format: AC Student Monitoring template — program in cell A1, one student per row.
        </p>
      </div>

      <ErrorNote message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={runImport} disabled={!file || busy} className="btn-primary w-full sm:w-auto">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Importing…
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" /> {isAudit ? "Update audits" : "Import students"}
            </>
          )}
        </button>
        <button type="button" onClick={resetUploaded} disabled={resetting || busy} className="btn-ghost text-red-600">
          {resetting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Reset uploaded data
        </button>
      </div>
      <p className="text-xs text-slate-400">
        “Reset uploaded data” removes students/subjects added by sheet uploads so you can re-test the import. Seeded demo students are kept.
      </p>

      {result && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 animate-fade-up">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {result.message}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <ResultStat label="New" value={result.created} />
            <ResultStat label="Skipped" value={result.skipped ?? result.updated ?? 0} />
            <ResultStat label="Cell changes" value={result.subject_changes ?? 0} />
            <ResultStat label="Conflicts" value={result.conflict_count ?? 0} />
            <ResultStat label="Subjects" value={result.subjects} />
            <ResultStat label="Program" value={result.program} />
          </div>
          {result.program_id && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/monitoring-sheet?program_id=${result.program_id}`} className="btn-primary">
                <Table2 className="h-4 w-4" /> Open Monitoring Sheet
              </Link>
              <Link to="/students" className="btn-ghost">
                <Users className="h-4 w-4" /> View Students
              </Link>
            </div>
          )}
          {result.duplicates?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Already in the system
              </p>
              <p className="mb-2 text-sm font-medium text-slate-600">
                These students were already added, so they were not imported again.
              </p>
              <ul className="space-y-2">
                {result.duplicates.slice(0, 8).map((d) => (
                  <li key={`${d.incoming_student_number}-${d.matched_student.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{d.incoming_name || d.matched_student.name} · {d.incoming_student_number}</p>
                    <p className="text-xs text-slate-500">
                      Student is in the system as {d.matched_student.name} · {d.matched_student.student_number}.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
              {result.conflicts?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Conflicting duplicate data
                  </p>
                  <p className="mb-2 text-sm font-medium text-amber-800">
                    These students appear to already be in the system, but the uploaded sheet has conflicting data. Please verify before changing their records.
                  </p>
                  <ul className="space-y-2">
                {result.conflicts.slice(0, 5).map((c) => (
                  <li key={`${c.incoming_student_number}-${c.matched_student.id}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{c.incoming_name || "Unnamed student"} · {c.incoming_student_number}</p>
                    <p className="text-xs text-slate-500">
                      Possible match: {c.matched_student.name} · {c.matched_student.student_number}. Verify first; existing profile values are kept unless overwrite is selected.
                    </p>
                  </li>
                ))}
              </ul>
              <Link to="/students" className="btn-ghost mt-3">
                <GitMerge className="h-4 w-4" /> Open duplicate review
              </Link>
            </div>
          )}
          {result.sample?.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {isAudit ? "Updated students (sample)" : "Imported students (sample)"}
              </p>
              <ul className="divide-y divide-slate-100">
                {result.sample.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-slate-400">
                        {s.student_number} · {s.program_code} · {s.stage} · {s.completed}/{s.total_subjects} subjects
                      </p>
                    </div>
                    <Link
                      to={`/students/${s.id}`}
                      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
                    >
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-ink"><History className="h-4 w-4 text-brand-600" /> Upload history</h3>
            <p className="mt-1 text-xs text-slate-500">Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{uploadHistory?.items?.length || 0} backups</span>
        </div>
        {uploadHistory?.items?.length ? (
          <div className="space-y-2">
            {uploadHistory.items.map((upload) => (
              <details key={upload.id} className="group rounded-xl border border-slate-200 p-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{upload.original_name}</p>
                    <p className="text-xs text-slate-500">{upload.program} · {upload.rows} students · {formatDate(upload.uploaded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={upload.conflict_count ? `${upload.conflict_count} conflicts` : "No conflicts"} dot={false} />
                    <a href={upload.download_url} onClick={(event) => event.stopPropagation()} className="btn-ghost px-2.5 py-1.5" aria-label={`Download ${upload.original_name}`}>
                      <Download className="h-3.5 w-3.5" /> Backup
                    </a>
                  </div>
                </summary>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {upload.conflicts?.length ? (
                    <div className="space-y-2">
                      {upload.conflicts.map((conflict) => (
                        <div key={`${upload.id}-${conflict.incoming_student_number}`} className="rounded-lg bg-amber-50 p-3">
                          <p className="text-sm font-semibold text-amber-900">{conflict.incoming_name} · {conflict.incoming_student_number}</p>
                          <p className="mt-0.5 text-xs text-amber-800">Changed: {(conflict.differences || []).join(", ")}</p>
                          {conflict.category_comparison?.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {conflict.category_comparison.map((item) => (
                                <div key={item.category} className="rounded-md bg-white px-2 py-1.5 text-center text-xs ring-1 ring-amber-100">
                                  <p className="font-bold text-slate-700">{item.category}</p>
                                  <p className="text-slate-500">Current {item.current}u → Uploaded {item.uploaded}u</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">This version matches existing records or added new students without conflicts.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No monitoring-sheet backups yet.</p>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-100">
      <p className="font-display text-xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — manual entry (fallback)
// ---------------------------------------------------------------------------
function HandoffForm({ meta, context, submit, submitting }) {
  const onboarding = context.onboarding_requirements || [];
  const [received, setReceived] = useState(onboarding);
  const [form, setForm] = useState({
    program_id: "",
    term_id: "",
    admission_signal: "Admission Confirmed",
    first_name: "",
    last_name: "",
    student_number: "",
    email: "",
    entry_year: new Date().getFullYear(),
    additional_missing_items: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setReceived((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, onboarding_items: received });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Or add a student manually" subtitle="One-off entry — compares received onboarding items against requirements" icon={UserPlus} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input value={form.first_name} onChange={set("first_name")} required />
        </Field>
        <Field label="Last name" required>
          <Input value={form.last_name} onChange={set("last_name")} required />
        </Field>
        <Field label="Program" required>
          <Select
            value={form.program_id}
            onChange={set("program_id")}
            required
            options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </Field>
        <Field label="Entry term" required>
          <Select value={form.term_id} onChange={set("term_id")} required options={(meta?.terms || []).map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Admission / enrollment signal" required>
          <Select
            value={form.admission_signal}
            onChange={set("admission_signal")}
            placeholder=""
            options={["Admission Confirmed", "Enrollment Confirmed", "For Completion"]}
          />
        </Field>
        <Field label="Entry year">
          <Input type="number" value={form.entry_year} onChange={set("entry_year")} />
        </Field>
        <Field label="Student number" hint="Leave blank to auto-generate">
          <Input value={form.student_number} onChange={set("student_number")} placeholder="2026-0001" />
        </Field>
        <Field label="Email" hint="Leave blank to auto-generate">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
      </div>

      <Field label="Onboarding items received" hint="Tick what arrived from the institutional handoff. Unticked items are recorded as missing.">
        <CheckList items={onboarding} selected={received} onToggle={toggle} />
      </Field>

      <Field label="Other missing items" hint="Comma- or line-separated, optional">
        <Textarea value={form.additional_missing_items} onChange={set("additional_missing_items")} />
      </Field>
      <Field label="Source reference" hint="e.g. AIMS batch, email subject">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>

      <SubmitButton submitting={submitting}>Create monitoring record</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Course Audit — roster (by subject) or sheet upload
// ---------------------------------------------------------------------------
function CourseAuditPanel({ meta }) {
  const [tab, setTab] = useState("class");
  const tabs = [
    { id: "class", label: "Course enrollment and grade audit", icon: ClipboardCheck },
    { id: "drops", label: "Drop requests", icon: LogOut },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>
      {tab === "class" && <CourseRosterGradeWorkspace meta={meta} />}
      {tab === "drops" && <CourseDropReviewPanelV2 />}
    </div>
  );
}

function CourseDropReviewPanelV2() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remarks, setRemarks] = useState({});
  const [expanded, setExpanded] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.courseDropRequests("Submitted");
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || "Could not load course drop requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(item, decision) {
    setNotice("");
    setError("");
    try {
      const res = await api.decideCourseDrop(item.id, { decision, remarks: remarks[item.id] || "" });
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(err.message || "Could not review this request.");
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle title="Student drop requests" subtitle="Review pending student requests from the Academic Coordinator queue." icon={LogOut} />
      <ErrorNote message={error} />
      {notice && <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}
      {loading ? (
        <Spinner label="Loading drop requests..." />
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const isOpen = !!expanded[item.id];
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.student?.name} - {item.course_code}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.course_title} - {item.term_label || "No term"} - submitted {formatDate(item.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !isOpen }))} className="btn-ghost cursor-pointer px-3 py-2 text-xs">
                      {isOpen ? "Hide details" : "Details"}
                    </button>
                    <button type="button" disabled={user?.role !== "academic_coordinator"} onClick={() => decide(item, "approve")} className="btn-primary cursor-pointer px-3 py-2">Approve drop</button>
                    <button type="button" disabled={user?.role !== "academic_coordinator"} onClick={() => decide(item, "reject")} className="btn-ghost cursor-pointer px-3 py-2 text-red-600">Reject</button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Student reason</p>
                      <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                    </div>
                    {item.attachment && <a href={item.attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Eye className="h-3.5 w-3.5" /> View attached PDF</a>}
                    <Input value={remarks[item.id] || ""} onChange={(e) => setRemarks((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="Reviewer remarks" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={LogOut} title="No pending course drop requests" hint="Approved drops update the student's course audit automatically." />
      )}
    </Card>
  );
}

function CourseDropReviewPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remarks, setRemarks] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.courseDropRequests("Submitted");
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || "Could not load course drop requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(item, decision) {
    setNotice("");
    setError("");
    try {
      const res = await api.decideCourseDrop(item.id, { decision, remarks: remarks[item.id] || "" });
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(err.message || "Could not review this request.");
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle title="Student drop requests" subtitle="Requests stay pending until the Academic Coordinator approves or rejects them" icon={LogOut} />
      <ErrorNote message={error} />
      {notice && <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}
      {loading ? (
        <Spinner label="Loading drop requests..." />
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.student?.name} · {item.course_code}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.course_title} · {item.term_label || "No term"} · submitted {formatDate(item.created_at)}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                  {item.attachment && <a href={item.attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Eye className="h-3.5 w-3.5" /> View attached PDF</a>}
                </div>
                <StatusBadge value={item.status} dot={false} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={remarks[item.id] || ""} onChange={(e) => setRemarks((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="Reviewer remarks" />
                <div className="flex gap-2">
                  <button type="button" disabled={user?.role !== "academic_coordinator"} onClick={() => decide(item, "approve")} className="btn-primary cursor-pointer px-3 py-2">Approve drop</button>
                  <button type="button" disabled={user?.role !== "academic_coordinator"} onClick={() => decide(item, "reject")} className="btn-ghost cursor-pointer px-3 py-2 text-red-600">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={LogOut} title="No pending course drop requests" hint="Approved drops update the student's course audit automatically." />
      )}
    </Card>
  );
}

function deriveCourseOutcome(value) {
  const grade = String(value || "").trim().toLowerCase();
  if (!grade) return { status: "Current", grade_status: "No Grade" };
  if (["inc", "incomplete"].includes(grade)) return { status: "Incomplete", grade_status: "Incomplete" };
  if (["f", "fail", "failed", "5", "5.0", "5.00"].includes(grade)) return { status: "Failed", grade_status: "Failed" };
  return { status: "Completed", grade_status: "Passed" };
}

function CourseRosterGradeWorkspace({ meta }) {
  const [programId, setProgramId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("");
  const [roster, setRoster] = useState(null);
  const [edits, setEdits] = useState({});
  const [addStudentId, setAddStudentId] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const classStatuses = new Set(["Enrolled", "Current", "Completed", "Incomplete", "Failed", "Dropped"]);
  const activeTermLabel = useMemo(() => {
    const terms = meta?.terms || [];
    return terms.find((item) => item.is_active_planning_term)?.label || terms[0]?.label || "";
  }, [meta?.terms]);
  const selectedTerm = (meta?.terms || []).find((item) => item.label === term);

  useEffect(() => {
    if (!term && activeTermLabel) setTerm(activeTermLabel);
  }, [activeTermLabel, term]);

  useEffect(() => {
    setSubjects([]);
    setCourseId("");
    setRoster(null);
    setError("");
    api.courseAuditSubjects(programId || undefined).then((res) => setSubjects(res.items || [])).catch((err) => setError(err.message));
  }, [programId]);

  function hydrate(res) {
    setRoster(res);
    setEdits(Object.fromEntries((res.students || []).map((student) => [student.student_id, {
      status: student.status,
      grade_value: student.grade_value || "",
      grade_status: student.grade_status || "No Grade",
      incomplete_deadline: student.incomplete_deadline || "",
      remarks: student.remarks || "",
    }])));
    setAddStudentId("");
    setOpenMenu(null);
  }

  useEffect(() => {
    if (!courseId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");
    api.courseAuditRoster(courseId, term).then(hydrate).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [courseId, term]);

  const allStudents = roster?.students || [];
  const classStudents = allStudents.filter((student) => classStatuses.has(edits[student.student_id]?.status || student.status));
  const availableStudents = allStudents.filter((student) => !classStatuses.has(edits[student.student_id]?.status || student.status));

  function addStudent() {
    if (!addStudentId) return;
    setEdits((current) => ({
      ...current,
      [addStudentId]: {
        ...(current[addStudentId] || {}),
        status: "Enrolled",
        grade_value: current[addStudentId]?.grade_value || "",
        grade_status: "No Grade",
      },
    }));
    setAddStudentId("");
  }

  function removeStudent(id) {
    setEdits((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), status: "Missing", grade_value: "", grade_status: "No Grade" },
    }));
    setOpenMenu(null);
  }

  function updateGrade(id, value) {
    const outcome = deriveCourseOutcome(value);
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), grade_value: value, ...outcome } }));
  }

  function updateRemarks(id, value) {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), remarks: value } }));
  }

  function updateIncompleteDeadline(id, value) {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), incomplete_deadline: value } }));
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setError("");
    try {
      const ids = allStudents.map((student) => student.student_id);
      const build = (key, fallback = "") => Object.fromEntries(ids.map((id) => [id, edits[id]?.[key] || fallback]));
      const res = await api.saveCourseAudit({
        course_id: roster.course.id,
        term: term || activeTermLabel,
        statuses: build("status", "Missing"),
        grades: build("grade_value"),
        grade_statuses: build("grade_status", "No Grade"),
        incomplete_deadlines: build("incomplete_deadline"),
        remarks: build("remarks"),
      });
      setResult(res);
      hydrate(await api.courseAuditRoster(roster.course.id, term || activeTermLabel));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="Course enrollment and grade audit" subtitle="Select the term first, add students to the class roster, then enter grades. Blank grade keeps Current; INC marks Incomplete; 5.00 or F marks Failed." icon={ClipboardCheck} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Program">
          <Select value={programId} onChange={(event) => setProgramId(event.target.value)} placeholder="All programs" options={(meta?.programs || []).map((program) => ({ value: program.id, label: `${program.code} - ${program.name}` }))} />
        </Field>
        <Field label="Subject" required>
          <Select value={courseId} onChange={(event) => setCourseId(event.target.value)} options={subjects.map((subject) => ({ value: subject.id, label: `${subject.code} - ${subject.title}` }))} />
        </Field>
        <Field label="Term">
          <Select value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Current / all terms" options={(meta?.terms || []).map((item) => item.label)} />
        </Field>
      </div>
      {selectedTerm?.grade_submission_deadline && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Grade submission deadline for {selectedTerm.label}: {formatDate(selectedTerm.grade_submission_deadline)}
        </div>
      )}
      <ErrorNote message={error} />
      {result && <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><CheckCircle2 className="h-5 w-5" /> {result.message}</div>}
      {loading ? (
        <Spinner label="Loading class roster..." />
      ) : !courseId ? (
        <EmptyState icon={ClipboardCheck} title="Choose a subject" hint="Pick a subject above to load the selected term's class list." />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <Field label="Add student to class">
              <Select value={addStudentId} onChange={(event) => setAddStudentId(event.target.value)} placeholder={availableStudents.length ? "Choose student" : "No available students"} options={availableStudents.map((student) => ({ value: student.student_id, label: `${student.name} - ${student.student_number}` }))} />
            </Field>
            <button type="button" onClick={addStudent} disabled={!addStudentId} className="btn-primary cursor-pointer px-4 py-2">Add student</button>
          </div>
          {classStudents.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <p className="text-sm font-semibold text-ink">{roster.course.code} - {roster.course.title}</p>
                <p className="text-xs text-slate-500">{term || "Current / all terms"} · {classStudents.length} student(s)</p>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5">Student</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Term</th>
                      <th className="px-3 py-2.5">Grade</th>
                      <th className="px-3 py-2.5">Incomplete deadline</th>
                      <th className="px-3 py-2.5">Remarks</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((student) => {
                      const edit = edits[student.student_id] || {};
                      const status = edit.status || student.status;
                      return (
                        <tr key={student.student_id} className="border-b border-slate-50 hover:bg-brand-50/40">
                          <td className="px-4 py-2.5"><p className="font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p>{student.drop_request && <p className="mt-1 text-xs font-semibold text-amber-700">Drop request pending</p>}</td>
                          <td className="px-3 py-2.5"><StatusBadge value={status} dot={false} /></td>
                          <td className="px-3 py-2.5 text-slate-600">{student.term_label || term || activeTermLabel || "Not recorded"}</td>
                          <td className="px-3 py-2.5"><Input value={edit.grade_value || ""} onChange={(event) => updateGrade(student.student_id, event.target.value)} placeholder="1.25, INC, 5.00" /></td>
                          <td className="px-3 py-2.5"><Input type="date" value={edit.incomplete_deadline || ""} onChange={(event) => updateIncompleteDeadline(student.student_id, event.target.value)} disabled={status !== "Incomplete"} /></td>
                          <td className="px-3 py-2.5"><Input value={edit.remarks || ""} onChange={(event) => updateRemarks(student.student_id, event.target.value)} placeholder="Optional" /></td>
                          <td className="relative px-3 py-2.5 text-right">
                            <button type="button" onClick={() => setOpenMenu(openMenu === student.student_id ? null : student.student_id)} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Open actions for ${student.name}`}><MoreVertical className="h-4 w-4" /></button>
                            {openMenu === student.student_id && (
                              <div className="absolute right-3 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lift">
                                <button type="button" onClick={() => removeStudent(student.student_id)} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Remove student</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No students in this class" hint="Use Add student to class to build the roster for this term." />
          )}
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full sm:w-auto">{saving ? "Saving..." : "Save course audit"}</button>
        </>
      )}
    </div>
  );
}

function CourseClassWorkspace({ meta, mode }) {
  const [programId, setProgramId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("");
  const [roster, setRoster] = useState(null);
  const [selected, setSelected] = useState({});
  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setSubjects([]);
    setCourseId("");
    setRoster(null);
    setError("");
    api.courseAuditSubjects(programId || undefined).then((res) => setSubjects(res.items || [])).catch((err) => setError(err.message));
  }, [programId]);

  function hydrate(res) {
    setRoster(res);
    setSelected(Object.fromEntries((res.students || []).map((student) => [student.student_id, false])));
    setEdits(Object.fromEntries((res.students || []).map((student) => [student.student_id, {
      status: student.status,
      grade_value: student.grade_value || "",
      grade_status: student.grade_status || "No Grade",
      remarks: student.remarks || "",
    }])));
  }

  useEffect(() => {
    if (!courseId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");
    api.courseAuditRoster(courseId).then(hydrate).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [courseId]);

  const classStatuses = new Set(["Enrolled", "Current", "Completed", "Incomplete", "Failed", "Dropped"]);
  const allStudents = roster?.students || [];
  const visibleStudents = allStudents.filter((student) => mode === "enrollment" || classStatuses.has(edits[student.student_id]?.status || student.status));
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = visibleStudents.length > 0 && visibleStudents.every((student) => selected[student.student_id]);
  const title = mode === "enrollment" ? "Course enrollment" : "Grade audit";
  const subtitle = mode === "enrollment"
    ? "Select a term and subject, then add students to the class roster or remove mistaken entries."
    : "Enter grades for students already in the class. Blank keeps the subject current; INC marks incomplete; 5.00 or F marks failed.";

  function toggle(id) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleAll() {
    const next = !allSelected;
    setSelected((current) => ({ ...current, ...Object.fromEntries(visibleStudents.map((student) => [student.student_id, next])) }));
  }

  function setSelectedStatus(status) {
    setEdits((current) => {
      const next = { ...current };
      visibleStudents.forEach((student) => {
        if (selected[student.student_id]) {
          next[student.student_id] = {
            ...(next[student.student_id] || {}),
            status,
            grade_value: status === "Missing" ? "" : next[student.student_id]?.grade_value || "",
            grade_status: status === "Missing" || status === "Enrolled" ? "No Grade" : next[student.student_id]?.grade_status || "No Grade",
          };
        }
      });
      return next;
    });
  }

  function updateGrade(id, value) {
    const outcome = deriveCourseOutcome(value);
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), grade_value: value, ...outcome } }));
  }

  function updateRemarks(id, value) {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), remarks: value } }));
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setError("");
    try {
      const ids = allStudents.map((student) => student.student_id);
      const build = (key, fallback = "") => Object.fromEntries(ids.map((id) => [id, edits[id]?.[key] || fallback]));
      const res = await api.saveCourseAudit({
        course_id: roster.course.id,
        term,
        statuses: build("status", "Missing"),
        grades: build("grade_value"),
        grade_statuses: build("grade_status", "No Grade"),
        remarks: build("remarks"),
      });
      setResult(res);
      hydrate(await api.courseAuditRoster(roster.course.id));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle title={title} subtitle={subtitle} icon={mode === "enrollment" ? Users : ClipboardCheck} />
        {roster && <button type="button" onClick={() => setEditing((value) => !value)} className="btn-ghost cursor-pointer px-3 py-2">{editing ? "Normal view" : "Edit view"}</button>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Program">
          <Select value={programId} onChange={(event) => setProgramId(event.target.value)} placeholder="All programs" options={(meta?.programs || []).map((program) => ({ value: program.id, label: `${program.code} - ${program.name}` }))} />
        </Field>
        <Field label="Subject" required>
          <Select value={courseId} onChange={(event) => setCourseId(event.target.value)} options={subjects.map((subject) => ({ value: subject.id, label: `${subject.code} - ${subject.title}` }))} />
        </Field>
        <Field label="Term">
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="AY 2025-2026 Term 1" />
        </Field>
      </div>
      <ErrorNote message={error} />
      {result && <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><CheckCircle2 className="h-5 w-5" /> {result.message}</div>}
      {loading ? (
        <Spinner label="Loading class roster..." />
      ) : !courseId ? (
        <EmptyState icon={ClipboardCheck} title="Choose a subject" hint="Pick a subject above to load the class list." />
      ) : visibleStudents.length ? (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">{roster.course.code} - {roster.course.title}</p>
              <p className="text-xs text-slate-500">{editing ? `${selectedCount} selected` : `${visibleStudents.length} student(s)`}</p>
            </div>
            {editing && mode === "enrollment" && (
              <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-4 py-3">
                <button type="button" onClick={() => setSelectedStatus("Enrolled")} className="btn-ghost cursor-pointer px-3 py-2">Add selected to class</button>
                <button type="button" onClick={() => setSelectedStatus("Missing")} className="btn-ghost cursor-pointer px-3 py-2 text-red-600">Remove selected</button>
              </div>
            )}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    {editing && <th className="px-3 py-2.5 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-600 cursor-pointer" aria-label="Select all students" /></th>}
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Status</th>
                    {mode === "grades" && <th className="px-3 py-2.5">Grade</th>}
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => {
                    const edit = edits[student.student_id] || {};
                    const status = edit.status || student.status;
                    return (
                      <tr key={student.student_id} className="border-b border-slate-50 hover:bg-brand-50/40">
                        {editing && <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!selected[student.student_id]} onChange={() => toggle(student.student_id)} className="h-5 w-5 accent-brand-600 cursor-pointer" aria-label={`Select ${student.name}`} /></td>}
                        <td className="px-4 py-2.5"><p className="font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p>{student.drop_request && <p className="mt-1 text-xs font-semibold text-amber-700">Drop request pending</p>}</td>
                        <td className="px-3 py-2.5"><StatusBadge value={status} dot={false} /></td>
                        {mode === "grades" && <td className="px-3 py-2.5">{editing ? <Input value={edit.grade_value || ""} onChange={(event) => updateGrade(student.student_id, event.target.value)} placeholder="1.25, INC, 5.00" /> : <p className="font-semibold text-ink">{edit.grade_value || "No grade"}</p>}</td>}
                        <td className="px-3 py-2.5">{editing ? <Input value={edit.remarks || ""} onChange={(event) => updateRemarks(student.student_id, event.target.value)} placeholder="Optional" /> : <span className="text-slate-600">{edit.remarks || "-"}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {editing && <button type="button" onClick={save} disabled={saving} className="btn-primary w-full sm:w-auto">{saving ? "Saving..." : mode === "enrollment" ? "Save enrollment" : "Save grade audit"}</button>}
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title={mode === "grades" ? "No students in this class yet" : "No students found"} hint={mode === "grades" ? "Use Course enrollment first to add students to this class." : ""} />
      )}
    </div>
  );
}

function CourseAuditRosterV2({ meta }) {
  const [programId, setProgramId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("");
  const [roster, setRoster] = useState(null);
  const [selected, setSelected] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const statuses = ["Missing", "Enrolled", "Current", "Completed", "Incomplete", "Failed", "Dropped"];

  useEffect(() => {
    setSubjects([]);
    setCourseId("");
    setRoster(null);
    api.courseAuditSubjects(programId || undefined).then((res) => setSubjects(res.items)).catch((e) => setError(e.message));
  }, [programId]);

  function hydrate(res) {
    setRoster(res);
    setSelected(Object.fromEntries(res.students.map((s) => [s.student_id, ["Enrolled", "Current"].includes(s.status)])));
    setEdits(Object.fromEntries(res.students.map((s) => [s.student_id, {
      status: s.status,
      grade_value: s.grade_value || "",
      grade_status: s.grade_status || "No Grade",
      incomplete_deadline: s.incomplete_deadline || "",
      remarks: s.remarks || "",
    }])));
  }

  useEffect(() => {
    if (!courseId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setResult(null);
    api.courseAuditRoster(courseId).then(hydrate).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [courseId]);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = roster && roster.students.length > 0 && selectedCount === roster.students.length;

  function toggle(id) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }
  function toggleAll() {
    if (!roster) return;
    const next = !allSelected;
    setSelected(Object.fromEntries(roster.students.map((s) => [s.student_id, next])));
  }
  function updateStudent(id, key, value) {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } }));
  }
  function bulkStatus(status) {
    if (!roster) return;
    setEdits((current) => {
      const next = { ...current };
      roster.students.forEach((student) => {
        if (selected[student.student_id]) {
          next[student.student_id] = {
            ...(next[student.student_id] || {}),
            status,
            grade_status: status === "Completed" ? "Passed" : status === "Incomplete" ? "Incomplete" : status === "Failed" ? "Failed" : "No Grade",
          };
        }
      });
      return next;
    });
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setError("");
    try {
      const ids = roster.students.map((s) => s.student_id);
      const build = (key, fallback = "") => Object.fromEntries(ids.map((id) => [id, edits[id]?.[key] || fallback]));
      const res = await api.saveCourseAudit({
        course_id: roster.course.id,
        term,
        statuses: build("status", "Missing"),
        grades: build("grade_value"),
        grade_statuses: build("grade_status", "No Grade"),
        incomplete_deadlines: build("incomplete_deadline"),
        remarks: build("remarks"),
      });
      setResult(res);
      hydrate(await api.courseAuditRoster(roster.course.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="Course enrollment and grade audit" subtitle="Bulk enroll a class, then record completions, incompletes, failures, drops, and grades" icon={ClipboardCheck} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Program">
          <Select value={programId} onChange={(e) => setProgramId(e.target.value)} placeholder="All programs" options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
        </Field>
        <Field label="Subject" required>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} options={subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.title} (${s.completed}/${s.enrolled})` }))} />
        </Field>
        <Field label="Audit term">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="AY 2025-2026 Term 1" />
        </Field>
      </div>
      <ErrorNote message={error} />
      {result && <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><CheckCircle2 className="h-5 w-5" /> {result.message}</div>}
      {loading ? (
        <Spinner label="Loading class roster..." />
      ) : !courseId ? (
        <EmptyState icon={ClipboardCheck} title="Choose a subject to audit" hint="Pick a subject above to see its class roster." />
      ) : roster && roster.students.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">{roster.course.code} — {roster.course.title}</p>
              <p className="text-xs text-slate-500">{selectedCount} of {roster.students.length} selected</p>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-4 py-3">
              {["Enrolled", "Current", "Completed", "Incomplete", "Failed", "Dropped"].map((status) => (
                <button key={status} type="button" onClick={() => bulkStatus(status)} className={`btn-ghost cursor-pointer px-3 py-2 ${status === "Failed" ? "text-red-600" : ""}`}>Mark {status.toLowerCase()}</button>
              ))}
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-600 cursor-pointer" aria-label="Select all students" /></th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Grade</th>
                    <th className="px-3 py-2.5">Incomplete deadline</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.students.map((s) => {
                    const edit = edits[s.student_id] || {};
                    return (
                      <tr key={s.student_id} className="border-b border-slate-50 hover:bg-brand-50/40">
                        <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!selected[s.student_id]} onChange={() => toggle(s.student_id)} className="h-5 w-5 accent-brand-600 cursor-pointer" aria-label={`Select ${s.name}`} /></td>
                        <td className="px-4 py-2.5"><p className="font-semibold text-ink">{s.name}</p><p className="text-xs text-slate-400">{s.student_number} · {s.program_code}</p>{s.drop_request && <p className="mt-1 text-xs font-semibold text-amber-700">Drop request pending</p>}</td>
                        <td className="px-3 py-2.5"><Select value={edit.status || s.status} onChange={(e) => updateStudent(s.student_id, "status", e.target.value)} options={statuses} placeholder="" /></td>
                        <td className="px-3 py-2.5"><Input value={edit.grade_value || ""} onChange={(e) => updateStudent(s.student_id, "grade_value", e.target.value)} placeholder="e.g. 1.25" /></td>
                        <td className="px-3 py-2.5"><Input type="date" value={edit.incomplete_deadline || ""} onChange={(e) => updateStudent(s.student_id, "incomplete_deadline", e.target.value)} disabled={edit.status !== "Incomplete"} /></td>
                        <td className="px-3 py-2.5"><Input value={edit.remarks || ""} onChange={(e) => updateStudent(s.student_id, "remarks", e.target.value)} placeholder="Optional" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full sm:w-auto">{saving ? "Saving..." : "Save class audit"}</button>
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No students found for this subject" />
      )}
    </div>
  );
}

function CourseAuditRoster({ meta }) {
  const [programId, setProgramId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("");
  const [roster, setRoster] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // load subjects (optionally filtered by program)
  useEffect(() => {
    setSubjects([]);
    setCourseId("");
    setRoster(null);
    api
      .courseAuditSubjects(programId || undefined)
      .then((res) => setSubjects(res.items))
      .catch((e) => setError(e.message));
  }, [programId]);

  // load roster when a subject is chosen
  useEffect(() => {
    if (!courseId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setResult(null);
    api
      .courseAuditRoster(courseId)
      .then((res) => {
        setRoster(res);
        setChecked(Object.fromEntries(res.students.map((s) => [s.student_id, s.completed])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  const completedCount = roster ? Object.values(checked).filter(Boolean).length : 0;
  const allChecked = roster && roster.students.length > 0 && completedCount === roster.students.length;

  function toggle(id) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }
  function toggleAll() {
    if (!roster) return;
    const next = !allChecked;
    setChecked(Object.fromEntries(roster.students.map((s) => [s.student_id, next])));
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.saveCourseAudit({ course_id: roster.course.id, term, completions: checked });
      setResult(res);
      // refresh roster to reflect new statuses
      const fresh = await api.courseAuditRoster(roster.course.id);
      setRoster(fresh);
      setChecked(Object.fromEntries(fresh.students.map((s) => [s.student_id, s.completed])));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="End-of-term course audit"
        subtitle="Pick a subject, then tick the students who completed it this term"
        icon={ClipboardCheck}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Program">
          <Select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="All programs"
            options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </Field>
        <Field label="Subject" required>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.title} (${s.completed}/${s.enrolled})` }))}
          />
        </Field>
        <Field label="Audit term" hint="Recorded on each updated subject">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="AY 2025-2026 Term 1" />
        </Field>
      </div>

      <ErrorNote message={error} />

      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5" /> {result.message}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading class roster…" />
      ) : !courseId ? (
        <EmptyState icon={ClipboardCheck} title="Choose a subject to audit" hint="Pick a subject above to see its enrolled students." />
      ) : roster && roster.students.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">
                {roster.course.code} — {roster.course.title}
              </p>
              <p className="text-xs text-slate-500">
                {completedCount} of {roster.students.length} marked completed
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Current</th>
                  <th className="px-3 py-2.5 text-center">
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-brand-600 cursor-pointer" />
                      <span>Completed</span>
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((s) => (
                  <tr key={s.student_id} className="border-b border-slate-50 hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.student_number} · {s.program_code}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge value={s.status} dot={false} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!checked[s.student_id]}
                        onChange={() => toggle(s.student_id)}
                        aria-label={`Mark ${s.name} completed`}
                        className="h-5 w-5 accent-brand-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full sm:w-auto">
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…
              </>
            ) : (
              "Save audit"
            )}
          </button>
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No students enrolled in this subject" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Audit (legacy single-student form — retained but unused)
// ---------------------------------------------------------------------------
function CourseAuditForm({ context, studentId, submit, submitting }) {
  const audit = context.course_audit;
  const [form, setForm] = useState({ course_id: "", status: "Completed", term_label: "", evidence_reference: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (panel.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={CalendarCheck} title="Panel matching is required" hint="The calendar stays empty until this student has an assigned panel. This prevents schedules from being created against the wrong or incomplete participant list." />
        <div className="mt-4 flex justify-center">
          <Link to={`/workflow/panel-matching?student_id=${studentId}`} className="btn-primary">
            Open Panel Matching <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Update course audit" subtitle="Map a subject's status against curriculum requirements" icon={ClipboardCheck} />
      {audit && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniBox label="Completed" value={audit.completed.length} tone="brand" />
          <MiniBox label="Current" value={audit.current.length} tone="blue" />
          <MiniBox label="Incomplete" value={audit.incomplete.length} tone="amber" />
          <MiniBox label="Missing" value={audit.missing.length} tone="red" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subject" required>
          <Select
            value={form.course_id}
            onChange={set("course_id")}
            required
            options={(context.courses || []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
          />
        </Field>
        <Field label="Status" required>
          <Select value={form.status} onChange={set("status")} placeholder="" options={["Completed", "Current", "Missing", "Incomplete", "Dropped"]} />
        </Field>
        <Field label="AY / Term taken">
          <Input value={form.term_label} onChange={set("term_label")} placeholder="AY 2025-2026 Term 1" />
        </Field>
        <Field label="Evidence reference">
          <Input value={form.evidence_reference} onChange={set("evidence_reference")} placeholder="Monitoring sheet row / grade slip" />
        </Field>
      </div>
      <SubmitButton submitting={submitting}>Save audit update</SubmitButton>

      {context.offering_demand?.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Subject demand (offerings planning)</p>
          <ul className="space-y-1.5">
            {context.offering_demand.slice(0, 6).map((row) => (
              <li key={row.code} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold">{row.code}</span> · {row.title}
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{row.count} students</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Research Gate
// ---------------------------------------------------------------------------
function ResearchGateForm({ context, studentId, submit, submitting, result, submitError }) {
  const { user } = useAuth();
  const student = context.selected_student || {};
  const researchCase = context.research_case || {};
  const progress = context.research_progress || {};
  const milestone = context.current_milestone || progress.milestone || {};
  const requirements = milestone.requirements || [];
  const completed = requirements.filter((item) => item.status === "Complete");
  const pending = requirements.filter((item) => item.status !== "Complete");
  const panel = context.panel_status || {};
  const scheduleRequirement = requirements.find((item) => item.source_type?.includes("schedule"));
  const outcomeRequirement = requirements.find((item) => item.source_type === "system_defense_result");
  const canRecordDefenseOutcome = user?.role === "staff" && outcomeRequirement && scheduleRequirement?.status === "Complete";

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Research Gate record"
        subtitle="The stage and checklist are calculated from uploads, endorsements, and workflow results"
        icon={FileCheck}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Student", student.name], ["Student ID", student.student_number], ["Program", student.program_name],
          ["Adviser", student.adviser_name || "Not assigned"], ["Research title", researchCase.title || "Pending Form 1"], ["Current stage", progress.stage || "Title Defense"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="field-label">Automatic research progress</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {(progress.stages || []).map((stage, index) => (
            <div key={stage.name} className={`rounded-xl border px-3 py-3 ${index === progress.stage_index ? "border-brand-300 bg-brand-50" : stage.complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <p className={`text-xs font-bold ${index === progress.stage_index ? "text-brand-700" : stage.complete ? "text-emerald-700" : "text-slate-500"}`}>{stage.name}</p>
              <p className="mt-1 text-[11px] text-slate-500">{stage.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniBox label="Completed requirements" value={completed.length} tone="brand" />
        <MiniBox label="Pending requirements" value={pending.length} tone={pending.length ? "amber" : "brand"} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div><p className="field-label">{progress.stage || "Current"} requirements</p><p className="text-xs text-slate-500">Uploaded and pending documents appear together. Open any file to preview it.</p></div>
          <StatusBadge value={progress.status || "Pending"} dot={false} />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {requirements.map((requirement) => (
            <div key={requirement.item_name} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{requirement.student_upload ? `Student upload · ${requirement.file_count}/${requirement.required_file_count} files` : "Staff / system managed"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <StatusBadge value={requirement.status_label} dot={false} />
                  {requirement.source_type === "coordinator_endorsement" && user?.role === "academic_coordinator" && (
                    <a href="#form1-endorsement-queue" className="btn-primary cursor-pointer justify-center whitespace-nowrap">
                      <UserRoundCheck className="h-4 w-4" /> Form 1 endorsements
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(requirement.files || []).map((file) => (
                  <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100">
                    {file.name} · PDF · {formatDate(file.uploaded_at)} <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Panel Matching</p><p className="text-xs text-slate-500">System-generated from the three concept papers.</p></div>
          <div className="flex items-center gap-2"><StatusBadge value={panel.status || "Not yet generated"} dot={false} /><Link to={`/workflow/panel-matching?student_id=${studentId}`} className="btn-ghost cursor-pointer">Open matching <ArrowUpRight className="h-4 w-4" /></Link></div>
        </div>
        {panel.recommendations?.length > 0 && <p className="mt-2 text-xs text-slate-600">{panel.recommendations.map((item) => item.faculty_name).filter(Boolean).join(" · ")}</p>}
      </div>

      <SubmitButton submitting={submitting}>Verify submitted requirements</SubmitButton>
      <WorkflowSubmitFeedback result={result} error={submitError} />

      {outcomeRequirement && (
        <section className={`rounded-2xl border p-5 ${outcomeRequirement.status === "Complete" ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Defense result gate</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">{outcomeRequirement.label}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {scheduleRequirement?.status === "Complete"
                  ? "Record whether the scheduled defense was passed before the student can move to the next Research Gate stage."
                  : "Confirm the defense schedule first. The student cannot move to the next Research Gate stage until a passing result is recorded."}
              </p>
            </div>
            <StatusBadge value={outcomeRequirement.status_label} dot={false} />
          </div>
          {user?.role === "staff" && outcomeRequirement.status !== "Complete" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!canRecordDefenseOutcome || submitting} onClick={() => submit({ student_id: studentId, defense_outcome: "Passed" })} className="btn-primary cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Mark Passed
              </button>
              <button type="button" disabled={!canRecordDefenseOutcome || submitting} onClick={() => submit({ student_id: studentId, defense_outcome: "Failed" })} className="btn-ghost cursor-pointer px-4 py-2 text-red-700 ring-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                <X className="h-4 w-4" /> Mark Failed
              </button>
              {!canRecordDefenseOutcome && <p className="self-center text-xs font-semibold text-amber-700">Schedule confirmation is required before recording the result.</p>}
            </div>
          )}
        </section>
      )}

      {user?.role === "academic_coordinator" && (
        <section id="form1-endorsement-queue" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Form1EndorsementQueue embedded />
        </section>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Panel Matching
// ---------------------------------------------------------------------------
function PanelMatchingForm({ context, studentId, submit, submitting, refetch }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const roles = context.panel_roles || [];
  const profile = context.matching_profile || {};
  const recs = profile.ready ? context.panel_recommendations || [] : [];
  const visibleRecommendations = recs.slice(0, Math.max(8, roles.length || 0));
  const finalizedPanel = context.assigned_panel || [];
  const selectionComplete = selectedIds.length === roles.length && new Set(selectedIds).size === roles.length;

  useEffect(() => {
    const finalizedIds = finalizedPanel.map((item) => item.faculty_id).filter(Boolean);
    const recommendedIds = recs.slice(0, roles.length).map((item) => item.faculty_id);
    setSelectedIds(finalizedIds.length === roles.length ? finalizedIds : recommendedIds);
  }, [studentId, roles.length, recs.map((item) => item.faculty_id).join(","), finalizedPanel.map((item) => item.faculty_id).join(",")]);

  function onSubmit(e) {
    e.preventDefault();
    if (!profile.ready || !selectionComplete) return;
    submit({ student_id: studentId, faculty_ids: selectedIds });
  }

  function runMatching() {
    refetch();
  }

  function selectFaculty(index, value) {
    setSelectedIds((current) => {
      const next = [...current];
      next[index] = Number(value);
      return next;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Panel recommendation workspace" subtitle="Review the research evidence, run the scoring model, adjust the shortlist, then finalize the panel" icon={Users} action={<Link to="/faculty" className="btn-ghost cursor-pointer"><Users className="h-4 w-4" /> Faculty profiles</Link>} />
      <div className={`rounded-xl border px-4 py-3 ${profile.ready ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${profile.ready ? "text-brand-800" : "text-amber-900"}`}>
              {profile.ready ? "Concept-paper content ready" : (profile.concept_paper_count || 0) < 3 ? "Three concept papers are required" : "Readable PDF text is required"}
            </p>
            <p className={`mt-1 text-xs ${profile.ready ? "text-brand-700" : "text-amber-800"}`}>
              {profile.concept_paper_count || 0} of 3 PDFs uploaded · {profile.readable_paper_count || 0} of 3 successfully read. Source: {profile.source || "No research evidence yet"}.
            </p>
          </div>
          <StatusBadge value={profile.ready ? "Ready" : "Blocked"} dot={false} />
        </div>
        {profile.research_title && <p className="mt-3 text-sm font-medium text-slate-700">Research title <span className="font-normal text-slate-500">(display only; excluded from matching)</span>: {profile.research_title}</p>}
        {profile.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{keyword}</span>)}
          </div>
        )}
        {profile.concept_papers?.length > 0 && (
          <div className="mt-4 grid gap-2">
            {profile.concept_papers.slice(0, 3).map((paper) => (
              <div key={paper.id} className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand-700">{paper.name}</a>
                  <StatusBadge value={paper.extracted ? "Text extracted" : "No readable text"} dot={false} />
                </div>
                {paper.keywords?.length > 0 && (
                  <p className="mt-2 text-slate-500">Analyzed terms: {paper.keywords.slice(0, 5).join(", ")}</p>
                )}
                {paper.excerpt && <p className="mt-2 leading-relaxed text-slate-500">{paper.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniBox label="Specialization / keywords" value="50%" tone="brand" />
        <MiniBox label="Availability" value="30%" tone="blue" />
        <MiniBox label="Workload / suitability" value="20%" tone="amber" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">{context.research_case_type || "Thesis"} panel needs {roles.length} members: {roles.join(", ")}.</p>
        <button type="button" disabled={!profile.ready} onClick={runMatching} className="btn-primary cursor-pointer">
          <Sparkles className="h-4 w-4" /> Analyze PDF content and match panel
        </button>
      </div>

      {profile.ready && visibleRecommendations.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No eligible faculty profiles were found. Add an active faculty profile with specialization and availability data, then run matching again.
        </div>
      )}

      {visibleRecommendations.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[920px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Rank / faculty</th>
              <th className="px-3 py-3">Expertise match</th>
              <th className="px-3 py-3">Availability</th>
              <th className="px-3 py-3">Workload</th>
              <th className="px-3 py-3 text-right">Match score</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecommendations.map((r, i) => (
              <tr key={r.faculty_id} className={`border-b border-slate-100 last:border-0 ${selectedIds.includes(r.faculty_id) ? "bg-brand-50/50" : "bg-white"}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                    <div><Link to={`/faculty?faculty=${r.faculty_id}`} className="font-semibold text-ink transition-colors hover:text-brand-700 hover:underline">{r.faculty_name}</Link><p className="text-xs text-slate-500">{r.college}</p></div>
                  </div>
                </td>
                <td className="max-w-[300px] px-3 py-2.5 text-slate-600">
                  <p>{r.specialization}</p>
                  <p className="mt-1 text-xs text-brand-700">{r.matched_keywords?.length ? `Matched: ${r.matched_keywords.slice(0, 4).join(", ")}` : "No direct keyword overlap"}</p>
                </td>
                <td className="px-3 py-2.5"><p className="font-medium text-slate-700">{r.availability_status}</p><p className="text-xs text-slate-400">{r.availability_windows} conflict-free windows</p></td>
                <td className="px-3 py-2.5"><p className="font-medium text-slate-700">{r.workload} active</p><p className="text-xs text-slate-400">panel assignments</p></td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{r.score}/100</span>
                  <p className="mt-1 whitespace-nowrap text-[10px] text-slate-400">{r.score_breakdown?.specialization}/50 · {r.score_breakdown?.availability}/30 · {r.score_breakdown?.suitability}/20</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {visibleRecommendations.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Review and adjust the panel set</p><p className="mt-0.5 text-xs text-slate-500">The top-ranked faculty are preselected. Staff may change any role before finalizing.</p></div>
          <StatusBadge value={finalizedPanel.length === roles.length ? "Final panel selected" : "Staff review"} dot={false} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role, index) => (
            <label key={role} className="block text-xs font-semibold text-slate-600">
              {role}
              <select value={selectedIds[index] || ""} onChange={(event) => selectFaculty(index, event.target.value)} className="mt-1.5 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                <option value="">Select faculty</option>
                {recs.map((item) => <option key={item.faculty_id} value={item.faculty_id}>{item.faculty_name} — {item.score}/100</option>)}
              </select>
            </label>
          ))}
        </div>
        {!selectionComplete && <p className="mt-3 text-xs font-medium text-amber-700">Choose a different eligible faculty member for every required role.</p>}
      </div>}

      <button type="submit" disabled={submitting || !profile.ready || !selectionComplete} className="btn-primary w-full cursor-pointer sm:w-auto">
        <CheckCircle2 className="h-4 w-4" /> {submitting ? "Finalizing..." : finalizedPanel.length === roles.length ? "Update final panel" : "Finalize selected panel"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Defense Scheduling
// ---------------------------------------------------------------------------
function DefenseSchedulingForm({ context, studentId, submit, submitting }) {
  const availability = context.availability || {};
  const readiness = context.schedule_readiness || {};
  const participants = availability.participants || [];
  const possibleSlots = availability.possible_slots || [];
  const schedules = context.schedules || [];
  const [form, setForm] = useState({
    preferred_date: "",
    preferred_end_date: "",
    selected_start: "",
    selected_end: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
    override_requirements: false,
    override_conflicts: false,
  });
  const [window, setWindow] = useState({ start: "", end: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const panel = context.assigned_panel || [];
  const requiredPanelCount = context.panel_roles?.length || 4;
  const panelComplete = panel.length >= requiredPanelCount;

  useEffect(() => {
    setWindow({
      start: availability.window_start || "",
      end: availability.window_end || "",
    });
    setForm((current) => ({
      ...current,
      preferred_date: "",
      preferred_end_date: availability.window_end || "",
      selected_start: "",
      selected_end: "",
      defense_type: readiness.stage === "Ethics Review" ? "Proposal Defense" : (readiness.stage || "Proposal Defense"),
      override_requirements: false,
      override_conflicts: false,
    }));
  }, [studentId, availability.window_start, availability.window_end, readiness.stage]);

  const filteredSlots = useMemo(
    () =>
      possibleSlots
        .filter(
          (slot) =>
            (!window.start || slot.date >= window.start) &&
            (!window.end || slot.date <= window.end)
        )
        .sort((left, right) => Number(right.conflict_free !== false) - Number(left.conflict_free !== false) || `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`)),
    [possibleSlots, window]
  );

  const visibleDates = useMemo(() => {
    const recordedDates = new Set();
    participants.forEach((participant) => {
      participant.slots.forEach((slot) => {
        recordedDates.add(slot.date);
      });
    });
    if (!window.start || !window.end) return [...recordedDates].sort().slice(0, 14);
    const dates = [];
    const cursor = new Date(`${window.start}T00:00:00`);
    const end = new Date(`${window.end}T00:00:00`);
    while (cursor <= end && dates.length < 14) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      if (!weekend || recordedDates.has(isoDate)) dates.push(isoDate);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [participants, window]);

  const possibleDates = useMemo(
    () => new Set(filteredSlots.map((slot) => slot.date)),
    [filteredSlots]
  );

  function chooseSlot(slot) {
    setForm((current) => ({
      ...current,
      preferred_date: slot.date,
      selected_start: slot.start,
      selected_end: slot.end,
    }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form, preferred_end_date: window.end || form.preferred_date });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Coordinate the defense schedule"
        subtitle="Review readiness and the matched panel, compare overlap, then make the final staff decision"
        icon={CalendarCheck}
      />
      <section aria-labelledby="student-readiness-heading" className={`rounded-2xl border p-5 ${readiness.ready ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p id="student-readiness-heading" className="text-xs font-bold uppercase tracking-wide text-slate-500">Student readiness</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">{readiness.stage || "Research stage unavailable"}</h3>
            <p className="mt-1 text-sm text-slate-600">{readiness.research_title || "Research title not recorded"}</p>
            <p className="mt-1 text-xs text-slate-500">Adviser: {readiness.adviser_name || "Not assigned"}</p>
          </div>
          <StatusBadge value={readiness.ready ? "Requirements complete" : readiness.status || "Pending requirements"} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(readiness.requirements || []).map((item) => (
            <div key={item.item_name} className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-black/5">
              {item.status === "Complete" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
              <div><p className="text-sm font-semibold text-slate-700">{item.label || item.item_name}</p><p className="text-xs text-slate-500">{item.status_label || item.status}</p></div>
            </div>
          ))}
        </div>
        {!readiness.ready && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white px-3.5 py-3 text-sm text-amber-900">
            <input type="checkbox" checked={form.override_requirements} onChange={(e) => setForm((current) => ({ ...current, override_requirements: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-400" />
            <span><strong>Staff override:</strong> I reviewed the pending Research Gate requirements and still want to schedule this defense.</span>
          </label>
        )}
      </section>

      <section aria-labelledby="panel-members-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p id="panel-members-heading" className="text-sm font-semibold text-ink">Panel members</p><p className="text-xs text-slate-500">Final selections from Panel Matching</p></div>
          <StatusBadge value={panelComplete ? `${panel.length} selected` : `${panel.length}/${requiredPanelCount} selected`} />
        </div>
        {panel.length ? <div className="grid gap-3 sm:grid-cols-2">
          {panel.map((member) => {
            const participant = participants.find((item) => item.faculty_id === member.faculty_id);
            return <div key={member.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{member.faculty_name}</p><p className="text-xs font-semibold text-brand-700">{member.panel_role}</p></div><StatusBadge value={participant?.calendar_status || "Profile only"} /></div>
              <p className="mt-3 text-xs text-slate-500">{member.college || "Department not recorded"}</p>
              <p className="mt-1 text-sm text-slate-700">{member.specialization || "Specialization not recorded"}</p>
            </div>;
          })}
        </div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No final panel is available. Complete Panel Matching before scheduling.</div>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Monday-Friday use faculty working hours, then Google Calendar busy times are removed for connected panelists.</span>
        <Link to="/faculty" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">View faculty profiles <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
      <AvailabilityWorkspace
        availability={availability}
        participants={participants}
        filteredSlots={filteredSlots}
        visibleDates={visibleDates}
        possibleDates={possibleDates}
        window={window}
        setWindow={setWindow}
        form={form}
        chooseSlot={chooseSlot}
      />
      <div className="border-t border-slate-200 pt-5"><p className="text-sm font-semibold text-ink">Final schedule</p><p className="text-xs text-slate-500">Only staff can finalize or reschedule this record.</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Selected date" required>
          <Input type="date" value={form.preferred_date} min={window.start} max={window.end} onChange={set("preferred_date")} required />
        </Field>
        <Field label="Start time" required>
          <Input type="time" value={form.selected_start} onChange={set("selected_start")} required />
        </Field>
        <Field label="End time" required>
          <Input type="time" value={form.selected_end} min={form.selected_start} onChange={set("selected_end")} required />
        </Field>
        <Field label="Defense type" required>
          <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={["Title Defense", "Proposal Defense", "Final Defense", "Public Final Defense"]} />
        </Field>
        <Field label="Mode" required>
          <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
        </Field>
        <Field label="Venue / meeting link">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" value={form.venue} onChange={set("venue")} placeholder="GS Conference Room / Zoom link" />
          </div>
        </Field>
      </div>
      <Field label="Scheduling constraints">
        <Textarea value={form.constraints} onChange={set("constraints")} placeholder="e.g. external panel only available afternoons" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
        <input type="checkbox" checked={form.override_conflicts} onChange={(e) => setForm((current) => ({ ...current, override_conflicts: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-slate-400" />
        <span><strong>Calendar/conflict override:</strong> finalize even if lead time, recorded availability, or another defense produces a warning. The reason will be saved.</span>
      </label>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <button type="submit" disabled={submitting || !form.preferred_date || !panelComplete || (!readiness.ready && !form.override_requirements)} className="btn-primary w-full sm:w-auto">
        {submitting ? "Saving..." : schedules.length ? "Finalize reschedule" : "Set defense schedule"}
      </button>
      {schedules.length > 0 && <ScheduleHistory schedules={schedules} />}
    </form>
  );
}

function AvailabilityWorkspace({
  availability,
  participants,
  filteredSlots,
  visibleDates,
  possibleDates,
  window,
  setWindow,
  form,
  chooseSlot,
}) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Preferred date window</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The system searches for a {availability.duration_minutes || 120}-minute overlap.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
            <Field label="From">
              <Input
                type="date"
                value={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, start: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={window.end}
                min={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, end: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </div>

      {participants.length > 0 && visibleDates.length > 0 && (
        <section aria-labelledby="availability-overlap-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="availability-overlap-heading" className="text-sm font-semibold text-ink">Availability overlap</p>
              <p className="text-xs text-slate-500">Darker green means more participants are free. Select a full-overlap cell to choose its two-hour slot.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>0/{participants.length}</span><span className="h-4 w-5 rounded bg-slate-100 ring-1 ring-slate-200" /><span className="h-4 w-5 rounded bg-emerald-200" /><span className="h-4 w-5 rounded bg-emerald-600" /><span>{participants.length}/{participants.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[720px] w-full border-collapse text-center text-xs">
              <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Time</th>{visibleDates.map((day) => <th key={day} className="border-b border-slate-200 px-2 py-3 font-semibold text-slate-700">{shortDate(day)}</th>)}</tr></thead>
              <tbody>
                {Array.from({ length: 20 }, (_, index) => 8 * 60 + index * 30).map((minutes) => {
                  const start = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
                  return <tr key={start}>
                    <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-white px-2 py-2 text-left font-medium text-slate-500">{formatTime(start)}</th>
                    {visibleDates.map((day) => {
                      const count = participants.filter((participant) => participant.slots.some((slot) => slot.date === day && !slot.blocked_by_google && slot.start <= start && slot.end > start) && !(participant.google_busy || []).some((busy) => busy.date === day && busy.start <= start && busy.end > start)).length;
                      const option = filteredSlots.find((slot) => slot.date === day && slot.start === start);
                      const selected = form.preferred_date === day && form.selected_start === start;
                      const tone = count === participants.length ? "bg-emerald-600 text-white hover:bg-emerald-700" : count >= Math.ceil(participants.length * 0.66) ? "bg-emerald-300 text-emerald-950" : count ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-slate-400";
                      return <td key={day} className="border-t border-slate-200 p-1"><button type="button" disabled={!option} onClick={() => option && chooseSlot(option)} aria-label={`${shortDate(day)} ${start}: ${count} of ${participants.length} available${option ? ", selectable" : ""}`} className={`min-h-8 w-full rounded-md px-1 py-1.5 font-bold transition-colors ${tone} ${option ? "cursor-pointer focus:ring-2 focus:ring-brand-500 focus:ring-offset-1" : "cursor-default"} ${selected ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}>{count}/{participants.length}</button></td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {participants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Panel availability</p>
              <p className="text-xs text-slate-500">Detailed source availability for each adviser and panelist.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {participants.length} participants
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  {participants.map((participant) => (
                    <th key={participant.faculty_id} className="min-w-44 border-b border-slate-200 px-3 py-3">
                      <p className="font-semibold text-ink">{participant.name}</p>
                      <p className="mt-0.5 text-xs font-normal text-slate-500">{participant.role} · {participant.college}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        participant.calendar_connected
                          ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {participant.calendar_connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {participant.calendar_status || (participant.calendar_connected ? "Google checked" : "Profile only")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDates.map((day) => {
                  const hasOverlap = possibleDates.has(day);
                  return (
                    <tr key={day} className={hasOverlap ? "bg-brand-50/55" : "bg-white"}>
                      <td className={`sticky left-0 z-10 border-r border-t border-slate-200 px-3 py-3 ${hasOverlap ? "bg-brand-50" : "bg-white"}`}>
                        <p className="font-semibold text-ink">{shortDate(day)}</p>
                        {hasOverlap && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">Overlap found</p>}
                      </td>
                      {participants.map((participant) => {
                        const slots = participant.slots.filter((slot) => slot.date === day);
                        const busy = (participant.google_busy || []).filter((slot) => slot.date === day);
                        return (
                          <td key={participant.faculty_id} className="border-t border-slate-200 px-3 py-3 align-top">
                            {slots.length || busy.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {slots.map((slot) => (
                                  <span
                                    key={`${slot.start}-${slot.end}`}
                                    className={`rounded-lg px-2 py-1 text-xs font-medium ring-1 ${
                                      slot.blocked_by_google
                                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                                        : "bg-white text-slate-700 ring-slate-200"
                                    }`}
                                  >
                                    {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                                {busy.map((slot) => (
                                  <span key={`busy-${slot.start}-${slot.end}`} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                                    Busy {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">Unavailable</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleDates.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">No availability was recorded inside this date window.</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Best shared options</p>
            <p className="text-xs text-slate-500">Select one to prepare the proposed schedule.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filteredSlots.length} found
          </span>
        </div>
        {filteredSlots.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredSlots.slice(0, 8).map((slot, index) => {
              const selected =
                form.preferred_date === slot.date &&
                form.selected_start === slot.start &&
                form.selected_end === slot.end;
              return (
                <button
                  key={`${slot.date}-${slot.start}`}
                  type="button"
                  onClick={() => chooseSlot(slot)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {index === 0 ? "Earliest option - " : ""}{shortDate(slot.date)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> {timeRange(slot.start, slot.end)} - all {slot.matched_count} available
                    </span>
                    {slot.conflicts?.length > 0 && <span className="mt-1 block text-xs font-semibold text-amber-700">Conflict: {slot.conflicts.join(" ")}</span>}
                  </span>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600 ring-2 ring-white" : "border-slate-300"}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            No complete overlap appears in this window. Revise the dates or collect updated availability from the adviser and panel.
          </div>
        )}
      </div>

      {form.preferred_date && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected proposed schedule</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-900">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" /> {shortDate(form.preferred_date)}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" /> {timeRange(form.selected_start, form.selected_end)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4" /> All participants available
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduleHistory({ schedules }) {
  return (
    <div className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-ink">Scheduling and rescheduling history</p>
      </div>
      <div className="space-y-2">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{schedule.defense_type || "Defense"} · {shortDate(schedule.preferred_date)} {schedule.start_time ? `· ${timeRange(schedule.start_time, schedule.end_time)}` : ""}</p>
              <p className="mt-0.5 text-xs text-slate-500">{schedule.mode} · {schedule.venue || "Arrangement pending"} · Forms: {schedule.required_forms_status || "Not recorded"}</p>
              {schedule.conflict_reason && <p className="mt-1 text-xs font-semibold text-amber-700">Warning/override: {schedule.conflict_reason}</p>}
              {schedule.panelists?.length > 0 && <p className="mt-1 text-xs text-slate-500">Panel: {schedule.panelists.map((item) => item.name).join(", ")}</p>}
            </div>
            <StatusBadge value={schedule.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practicum
// ---------------------------------------------------------------------------
function useDemoCaseReset(slug, refetch) {
  const [resettingId, setResettingId] = useState(null);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  async function resetCase(student) {
    const confirmed = window.confirm(
      `Reset the ${slug} demo case for ${student.name}?\n\nThis removes only this student's ${slug} records, uploaded request PDFs, related tasks, and activity entries. Academic and research source data are kept.`
    );
    if (!confirmed) return;
    setResettingId(student.id);
    setResetMessage("");
    setResetError("");
    try {
      const result = await api.resetWorkflowDemo(slug, student.id);
      setResetMessage(result.message);
      await refetch();
    } catch (error) {
      setResetError(error.message || "Could not reset this demo case.");
    } finally {
      setResettingId(null);
    }
  }

  function clearResetFeedback() {
    setResetMessage("");
    setResetError("");
  }

  return { resettingId, resetMessage, resetError, resetCase, clearResetFeedback };
}

function DemoResetButton({ student, resettingId, onReset }) {
  const busy = resettingId === student.id;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onReset(student)}
      className="btn-ghost cursor-pointer px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      <RotateCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Resetting…" : "Reset demo case"}
    </button>
  );
}

function DemoResetFeedback({ message, error }) {
  return (
    <>
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}
      {error && <ErrorNote message={error} />}
    </>
  );
}

function WorkflowSubmitFeedback({ result, error }) {
  return (
    <div aria-live="polite">
      {result?.message && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {result.message}
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </div>
  );
}

function WorkflowCaseModal({ id, title, subtitle, status, onClose, children, footer }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const modal = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = modal ? [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')] : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">{title}</h2>
              {status && <StatusBadge value={status} dot={false} />}
            </div>
            <p id={`${id}-description`} className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:ring-2 focus:ring-brand-500"
            aria-label="Close case details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="btn-ghost cursor-pointer px-4 py-2">Close details</button>
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        </footer>
      </section>
    </div>
  );
}

const WORKFLOW_GUIDES = {
  withdrawal: {
    purpose: "Records a voluntary withdrawal request without changing the official Registrar record prematurely.",
    submitter: "The student submits the request form and supporting proof.",
    reviewers: "Graduate School Staff records and routes it; the Dean decides; the Academic Coordinator and Registrar complete follow-through.",
    stages: ["Submitted", "Staff review", "Dean review", "Requirements and fee confirmation", "Registrar update"],
    incomplete: "Any reviewer can return the case with a specific clarification message. The student remains Active until every approved follow-through step is complete.",
    final: "Completed means the Registrar update is recorded and the monitoring record can safely show the student as Withdrawn.",
  },
  practicum: {
    purpose: "Tracks the practicum MOA, placement, required hours, certificates, completion review, and Dean report for programs that require practicum.",
    submitter: "The student submits the MOA first, then separately submits certificates and completion evidence.",
    reviewers: "Graduate School Staff records and forwards submissions; the Academic Coordinator reviews the MOA, hours, and certificates; the Dean reviews the status report.",
    stages: ["MOA submitted", "Eligibility and MOA review", "Practicum in progress", "Completion review", "Report sent to Dean"],
    incomplete: "Missing or unclear evidence is returned with a message. Insufficient or unaccepted hours remain incomplete and may require another placement.",
    final: "Completed means required hours and documents were accepted; Dean Reviewed closes the monitoring report.",
  },
  graduation: {
    purpose: "Prepares a Graduate School recommendation and endorsed candidate list; it does not replace the official Registrar graduation process.",
    submitter: "Students may request readiness review, while GS Staff compiles the review window and candidate list.",
    reviewers: "The Academic Coordinator checks coursework, the Research Coordinator validates completion evidence, and the Dean approves the endorsement list.",
    stages: ["Candidate review", "Requirements checks", "Batch preparation", "Dean endorsement", "Registrar handoff"],
    incomplete: "A candidate can be returned individually or as part of a batch with the unresolved requirement clearly named.",
    final: "Endorsed means the Dean-approved list was handed off to the Registrar for the official process.",
  },
};

function WorkflowSupportModal({ slug, mode, logs, policyQuestions, onClose }) {
  const guide = WORKFLOW_GUIDES[slug];
  const title = mode === "activity" ? "Recent workflow activity" : `How ${guide ? slug : "this workflow"} works`;
  return (
    <WorkflowCaseModal
      id={`${slug}-${mode}`}
      title={title}
      subtitle={mode === "activity" ? "A timestamped audit trail of recent actions and handoffs" : "A concise guide for students and reviewers"}
      onClose={onClose}
    >
      {mode === "activity" ? (
        <WorkflowActivityList logs={logs} />
      ) : guide ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Purpose" value={guide.purpose} />
            <Detail label="Who submits" value={guide.submitter} />
            <Detail label="Who reviews" value={guide.reviewers} />
            <Detail label="When something is incomplete" value={guide.incomplete} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Main stages</p>
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {guide.stages.map((stage, index) => <li key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs text-brand-700">{index + 1}</span>{stage}</li>)}
            </ol>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900"><span className="font-semibold">What completion means: </span>{guide.final}</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Admin note · confirm with Sir De Paula / GS office before production</p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-800">{policyQuestions.map((question) => <li key={question}>• {question}</li>)}</ul>
          </div>
        </div>
      ) : null}
    </WorkflowCaseModal>
  );
}

function WorkflowActivityList({ logs }) {
  if (!logs.length) return <EmptyState title="No activity yet" hint="New submissions, messages, and decisions will appear here." />;
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
      {logs.map((log) => (
        <li key={log.id} className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <span className="absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{log.result}</p>
            <time className="text-xs text-slate-400">{formatDateTime(log.created_at)}</time>
          </div>
          <p className="mt-1 text-xs text-slate-500">{log.actor_role}{log.student_name ? ` · ${log.student_name}` : ""}</p>
          {(log.previous_status || log.new_status) && <p className="mt-2 text-xs font-semibold text-slate-600">{log.previous_status || "—"} <span className="mx-1 text-slate-300">→</span> {log.new_status || "—"}</p>}
          {log.notes && <p className="mt-2 text-xs leading-relaxed text-slate-500">{log.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

function WorkflowMessageModal({ slug, row, context, onClose, onSaved }) {
  const student = row.student || row.endorsement?.student;
  const [form, setForm] = useState({
    action_type: "return",
    recipient_role: "Student",
    template: context?.message_templates?.[0] || "Missing required document",
    comment: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.sendWorkflowMessage(slug, { student_id: student.id, ...form });
      await onSaved(result.message);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save the workflow message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkflowCaseModal
      id={`${slug}-message-${student.id}`}
      title="Message / return for clarification"
      subtitle={`${student.name} · ${student.student_number}`}
      onClose={onClose}
      footer={<button type="submit" form={`${slug}-message-form-${student.id}`} disabled={busy} className="btn-primary cursor-pointer px-4 py-2"><Send className="h-4 w-4" /> {busy ? "Saving…" : "Send message"}</button>}
    >
      <form id={`${slug}-message-form-${student.id}`} onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Action">
            <select value={form.action_type} onChange={update("action_type")} className="field-input cursor-pointer">
              <option value="return">Return for clarification</option>
              <option value="note">Send note to current reviewer</option>
              <option value="forward">Forward with note</option>
            </select>
          </Field>
          <Field label="Recipient / next stage">
            <Select value={form.recipient_role} onChange={update("recipient_role")} placeholder="" options={context?.message_recipients || ["Student", "Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean", "Registrar"]} />
          </Field>
        </div>
        <Field label="Message template">
          <Select value={form.template} onChange={update("template")} placeholder="" options={context?.message_templates || []} />
        </Field>
        <Field label={form.template === "Other" ? "Custom comment" : "Optional details"} required={form.template === "Other"}>
          <Textarea value={form.comment} onChange={update("comment")} required={form.template === "Other"} placeholder="Add the exact file, record, or detail that needs attention." />
        </Field>
        <p className="text-xs leading-relaxed text-slate-500">Returning the case changes its status to Returned for Clarification and creates a visible task for the selected recipient. A note keeps the current stage unchanged.</p>
      </form>
    </WorkflowCaseModal>
  );
}

function CaseMessageHistory({ messages = [] }) {
  if (!messages.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><MessageSquare className="h-4 w-4" /> Messages and clarifications</p>
      <ul className="mt-3 space-y-3">
        {messages.map((message) => (
          <li key={message.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-ink">{message.template}</p>
              <StatusBadge value={message.status} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{message.sender_role} → {message.recipient_role} · {formatDateTime(message.created_at)}</p>
            {message.comment && <p className="mt-2 text-sm leading-relaxed text-slate-600">{message.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GraduationBatchModal({ rows, context, onClose, onSaved }) {
  const [form, setForm] = useState({
    action: "send_to_dean",
    recipient_role: "Graduate School Staff",
    template: "This request requires additional review",
    comment: "",
    review_window: rows.find((row) => row.endorsement?.review_window)?.endorsement?.review_window || "AY 2026-2027 Graduation Review",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const blocked = form.action === "send_to_dean" ? rows.filter((row) => row.eligibility.status !== "Eligible") : [];

  async function confirm(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.graduationBatchAction({ student_ids: rows.map((row) => row.student.id), ...form });
      await onSaved(result);
      onClose();
    } catch (err) {
      setError(err.message || "Could not apply the graduation group action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkflowCaseModal
      id="graduation-batch-action"
      title="Confirm graduation group action"
      subtitle={`${rows.length} selected candidate${rows.length === 1 ? "" : "s"}`}
      onClose={onClose}
      footer={<button type="submit" form="graduation-batch-form" disabled={busy} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> {busy ? "Applying…" : "Confirm group action"}</button>}
    >
      <form id="graduation-batch-form" onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Group action">
            <select value={form.action} onChange={update("action")} className="field-input cursor-pointer">
              <option value="send_to_dean">Prepare and send eligible candidates to Dean</option>
              <option value="return">Return selected candidates for clarification</option>
              <option value="assign">Assign reviewer</option>
              <option value="note">Add shared note</option>
            </select>
          </Field>
          <Field label="Recipient / reviewer">
            <Select value={form.recipient_role} onChange={update("recipient_role")} placeholder="" options={context?.message_recipients || []} />
          </Field>
        </div>
        {form.action === "send_to_dean" && <Field label="Review window"><Input value={form.review_window} onChange={update("review_window")} /></Field>}
        {form.action !== "send_to_dean" && <Field label="Message template"><Select value={form.template} onChange={update("template")} placeholder="" options={context?.message_templates || []} /></Field>}
        <Field label="Comment" required={form.template === "Other" && form.action !== "send_to_dean"}><Textarea value={form.comment} onChange={update("comment")} required={form.template === "Other" && form.action !== "send_to_dean"} /></Field>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Action summary</p>
          <p className="mt-1 text-sm text-slate-600">{rows.length} candidate(s) selected · {rows.length - blocked.length} can be included · {blocked.length} will be skipped.</p>
          {blocked.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-700">{blocked.slice(0, 8).map((row) => <li key={row.student.id}>{row.student.name}: {row.eligibility.status}</li>)}</ul>}
        </div>
      </form>
    </WorkflowCaseModal>
  );
}

const PRACTICUM_BOARD_COLUMNS = [
  { label: "Submitted", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", statuses: ["MOA Under Review"] },
  { label: "Documents Review", statuses: ["Documents Submitted", "Documents Under Review"] },
  { label: "In Progress", statuses: ["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"] },
  { label: "Completion Review", statuses: ["Completed"] },
  { label: "Completed", statuses: ["Report Sent to Dean", "Dean Reviewed"] },
  { label: "Returned", statuses: ["Returned for Clarification", "Not Accepted - New Organization Required"] },
];

const WITHDRAWAL_BOARD_COLUMNS = [
  { label: "Submitted", statuses: ["Submitted to GS Staff"] },
  { label: "Staff Review", statuses: ["Coordinator Follow-through Complete", "Requirements Pending", "Requirements Submitted", "Registrar Review", "Fee Cleared", "Withdrawal Confirmed"] },
  { label: "Dean Review", statuses: ["Dean Review"] },
  { label: "Returned for Clarification", statuses: ["Returned", "Returned for Clarification"] },
  { label: "Approved", statuses: ["Approved - Follow-through", "Withdrawn Confirmed"] },
  { label: "Rejected / Cancelled", statuses: ["Denied", "Cancelled"] },
];

function WorkflowBoard({ columns, rows, getStatus, renderCard, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="flex snap-x gap-4 overflow-x-auto pb-3">
      {columns.map((column) => {
        const items = rows.filter((row) => column.statuses.includes(getStatus(row)));
        return (
          <section key={column.label} className="w-[290px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
            </header>
            <div className="space-y-3">{items.length ? items.map(renderCard) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">No requests</p>}</div>
          </section>
        );
      })}
    </div>
  );
}

function ViewModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Choose request overview layout">
      <button type="button" onClick={() => onChange("board")} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value === "board" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Columns3 className="h-4 w-4" /> Board</button>
      <button type="button" onClick={() => onChange("table")} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value === "table" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><List className="h-4 w-4" /> Table</button>
    </div>
  );
}

function PracticumBoardCard({ row, onOpen, onMessage }) {
  return (
    <article key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{row.student.name}</p><p className="text-xs text-slate-400">{row.student.student_number} · {row.student.program_code}</p></div>{row.unresolved_messages > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Concern</span>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>{row.record.practicum_site || "Site pending"}</span><span className="text-right">{row.record.completed_hours}/{row.record.required_hours} hrs</span><span>{row.eligibility.status}</span><span className="text-right">Updated {formatDate(row.last_activity_at || row.record.updated_at)}</span><span className="col-span-2">Submitted {formatDate(row.record.created_at)}</span></div>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {row.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button><button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button></div>
    </article>
  );
}

function WithdrawalBoardCard({ item, onOpen, onMessage }) {
  return (
    <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{item.student.name}</p><p className="text-xs text-slate-400">{item.student.student_number} · {item.student.program_code}</p></div>{item.unresolved_messages > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Concern</span>}</div>
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.reason || "No reason provided"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Submitted {formatDate(item.created_at)}</span><span className="text-right">Updated {formatDate(item.updated_at)}</span><span className="col-span-2">Effective: {item.effective_term || "Pending"}</span></div>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {item.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button><button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button></div>
    </article>
  );
}

function PracticumRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const reset = useDemoCaseReset("practicum", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.secondary || row.eligibility.status === filters.secondary);
  }), [rows, filters]);

  function actionFor(row) {
    const record = row.record;
    if (!record) return null;
    const base = { student_id: row.student.id };
    if (accountRole === "staff" && ["MOA Submitted", "MOA Received"].includes(record.status)) {
      return { label: "Forward to Academic Coordinator", payload: { ...base, status: "MOA Under Review", moa_status: "Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "MOA Under Review") {
      return { label: "Mark practicum in progress", payload: { ...base, status: "Practicum In Progress", moa_status: "Verified" } };
    }
    if (accountRole === "staff" && ["Hours Incomplete", "Documents Submitted"].includes(record.status)) {
      return { label: "Forward documents to Academic Coordinator", payload: { ...base, status: "Documents Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Documents Under Review" && row.hours_status !== "Complete") {
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" } };
    }
    if (accountRole === "academic_coordinator" && ["Documents Under Review", "Practicum In Progress"].includes(record.status) && row.hours_status === "Complete") {
      return { label: "Verify completion", payload: { ...base, status: "Completed", document_status: "Verified" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Completed") {
      return { label: "Send status report to Dean", payload: { ...base, status: "Report Sent to Dean", document_status: "Verified" } };
    }
    return null;
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedAction = selectedRow ? actionFor(selectedRow) : null;

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Practicum student submissions" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · GS Staff forwards submissions; the Academic Coordinator reviews MOAs, certificates, and hours`} icon={Briefcase} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not eligible", "Needs verification"]} count={filteredRows.length} total={rows.length} />
      <div className="flex justify-end"><ViewModeToggle value={viewMode} onChange={setViewMode} /></div>
      {viewMode === "board" ? (
        <WorkflowBoard
          columns={PRACTICUM_BOARD_COLUMNS}
          rows={filteredRows.filter((row) => row.record)}
          getStatus={(row) => row.record.status}
          empty="No recent practicum submissions match the filters."
          renderCard={(row) => <PracticumBoardCard key={row.student.id} row={row} onOpen={() => openCase(row.student.id)} onMessage={() => setMessageRow(row)} />}
        />
      ) : <WorkflowTable
        headers={["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]}
        empty="No practicum-program students found."
        rows={filteredRows}
        render={(row) => {
          return (
              <tr
                key={row.student.id}
                onClick={() => openCase(row.student.id)}
                className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
              >
                <StudentCell student={row.student} />
                <td className="px-3 py-3"><StatusBadge value={row.eligibility.status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.moa_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.documents_status} dot={false} /></td>
                <td className="px-3 py-3 text-sm text-slate-600">{row.record ? `${row.record.completed_hours}/${row.record.required_hours}` : "—"}<div className="mt-1"><StatusBadge value={row.hours_status} dot={false} /></div></td>
                <td className="px-3 py-3"><StatusBadge value={row.coordinator_review_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.dean_report_status} dot={false} /></td>
                <td className="px-3 py-3">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openCase(row.student.id); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> Open case</button>
                </td>
              </tr>
          );
        }}
      />}
      {selectedRow && (
        <WorkflowCaseModal
          id={`practicum-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Practicum case`}
          status={selectedRow.record?.status || "Not Submitted"}
          onClose={() => setSelectedStudentId(null)}
          footer={(
            <>
              {accountRole === "staff" && selectedRow.record && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedRow.record && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {accountRole === "academic_coordinator" && ["Documents Under Review", "Completed"].includes(selectedRow.record?.status) && <button type="button" disabled={submitting || refreshing} onClick={() => submit({ student_id: selectedRow.student.id, status: "Not Accepted - New Organization Required" })} className="btn-ghost cursor-pointer px-4 py-2 text-red-600">Mark not accepted</button>}
              {selectedAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => submit(selectedAction.payload)} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">{selectedRow.record ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "Awaiting student submission."}</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <PracticumCaseDetails row={selectedRow} />
            <CaseMessageHistory messages={selectedRow.messages} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="practicum" row={messageRow} context={context} onClose={() => setMessageRow(null)} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
    </div>
  );
}

function PracticumCaseDetails({ row }) {
  const record = row.record;
  const timeline = (row.timeline || record?.timeline || []).map((step) => ({
    ...step,
    optional: ["Hours Incomplete", "Additional Certificates Requested"].includes(step.label),
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Detail label="Eligibility" value={row.eligibility.status} />
        <Detail label="MOA" value={row.moa_status} />
        <Detail label="Documents" value={row.documents_status} />
        <Detail label="Hours" value={record ? `${record.completed_hours}/${record.required_hours}` : "Not started"} />
        <Detail label="Supervisor" value={record?.supervisor_name || "Not provided"} />
        <Detail label="Completion" value={record?.completion_status || "Pending"} />
      </div>
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Automatic eligibility</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {row.eligibility.checklist.map((item) => (
                <div key={item.key} className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
                  <div><p className="text-sm font-semibold text-slate-700">{item.label}</p>{item.note && <p className="text-xs text-slate-400">{item.note}</p>}</div>
                  <p className="text-xs font-semibold text-slate-500">{String(item.actual_value ?? item.actual)}{item.required_value != null ? ` / ${item.required_value}` : ""}</p>
                  <StatusBadge value={item.status || (item.complete ? "Passed" : "Not met")} dot={false} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Student submission</p>
            <p className="mt-2 text-sm font-semibold text-ink">{record?.practicum_site || "No site submitted"}</p>
            <p className="mt-1 text-xs text-slate-500">Supervisor: {record?.supervisor_name || "Not provided"}</p>
            <p className="mt-1 text-xs text-slate-500">Certificates: {record?.certificate_count || 0} · {record?.remarks || "No student remarks"}</p>
            <div className="mt-2 flex flex-wrap gap-2">{record?.moa_attachment && <a className="btn-ghost px-3 py-1.5" href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA <ArrowUpRight className="h-3.5 w-3.5" /></a>}{record?.certificate_attachment && <a className="btn-ghost px-3 py-1.5" href={record.certificate_attachment.url} target="_blank" rel="noreferrer">Documents <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div>
          </div>
      </div>
      <WorkflowTimeline steps={timeline} title="Practicum workflow timeline" />
    </div>
  );
}

function WithdrawalRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const reset = useDemoCaseReset("withdrawal", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((item) => item.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((item) => item.status)), [rows]);
  const filteredRows = useMemo(() => rows.filter((item) => {
    const haystack = `${item.student.name} ${item.student.student_number} ${item.student.program_code} ${item.reason || ""} ${item.effective_term || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || item.student.program_code === filters.program)
      && (!filters.status || item.status === filters.status)
      && (!filters.secondary || item.dean_decision === filters.secondary);
  }), [rows, filters]);
  function actionFor(item) {
    const base = { student_id: item.student_id };
    if (accountRole === "staff" && item.dean_decision === "Pending" && item.status === "Submitted to GS Staff") return { label: "Record & forward to Dean", payload: { ...base, workflow_action: "forward_to_dean" } };
    if (accountRole === "academic_coordinator" && item.dean_decision === "Approved" && item.status === "Approved - Follow-through") return { label: "Record coordinator follow-through", payload: { ...base, workflow_action: "coordinator_follow_through" } };
    if (accountRole === "staff" && item.status === "Coordinator Follow-through Complete") return { label: "Inform student of approval", payload: { ...base, workflow_action: "notify_student_of_approval" } };
    if (accountRole === "staff" && item.status === "Requirements Submitted") return { label: "Verify form & proof", payload: { ...base, workflow_action: "verify_requirements" } };
    if (accountRole === "registrar" && item.status === "Registrar Review") return { label: "Confirm Registrar fee status", payload: { ...base, workflow_action: "record_fee_clearance" } };
    if (accountRole === "staff" && item.status === "Fee Cleared") return { label: "Confirm completed withdrawal", payload: { ...base, workflow_action: "confirm_withdrawal" } };
    if (accountRole === "registrar" && item.status === "Withdrawal Confirmed") return { label: "Update student record", payload: { ...base, workflow_action: "record_registrar_update" } };
    return null;
  }
  const selectedCurrent = rows.find((item) => item.id === selectedCaseId) || null;
  const selectedItem = selectedCurrent || selectedSnapshot;
  const selectedAction = selectedCurrent ? actionFor(selectedCurrent) : null;
  const withdrawalSteps = withdrawalTimelineSteps(selectedCurrent?.status || (reset.resetMessage ? undefined : selectedItem?.status));

  useEffect(() => {
    if (selectedCurrent) setSelectedSnapshot(selectedCurrent);
  }, [selectedCurrent]);

  function openCase(item) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedCaseId(item.id);
    setSelectedSnapshot(item);
  }

  function closeCase() {
    setSelectedCaseId(null);
    setSelectedSnapshot(null);
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Submitted withdrawal requests" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · Withdrawn is applied only after requirements, fees, and Registrar update are confirmed`} icon={LogOut} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Dean decision" secondaryOptions={uniqueValues(rows.map((item) => item.dean_decision))} count={filteredRows.length} total={rows.length} />
      <div className="flex justify-end"><ViewModeToggle value={viewMode} onChange={setViewMode} /></div>
      {viewMode === "board" ? (
        <WorkflowBoard
          columns={WITHDRAWAL_BOARD_COLUMNS}
          rows={filteredRows}
          getStatus={(item) => item.status}
          empty="No recent withdrawal requests match the filters."
          renderCard={(item) => <WithdrawalBoardCard key={item.id} item={item} onOpen={() => openCase(item)} onMessage={() => setMessageRow(item)} />}
        />
      ) : <WorkflowTable headers={["Student", "Request date", "Effective term", "Reason", "Status", "Next owner", "Action"]} empty="No withdrawal requests match the selected filters." rows={filteredRows} render={(item) => {
        return (
          <tr
            key={item.id}
            onClick={() => openCase(item)}
            className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
          >
            <StudentCell student={item.student} />
            <td className="px-3 py-3 text-sm text-slate-600">{formatDate(item.created_at)}</td>
            <td className="px-3 py-3 text-sm text-slate-600">{item.effective_term || "—"}</td>
            <td className="max-w-[240px] px-3 py-3 text-sm text-slate-600"><span className="line-clamp-2">{item.reason || "No reason provided"}</span></td>
            <td className="px-3 py-3"><StatusBadge value={item.status} dot={false} /></td>
            <td className="px-3 py-3 text-xs font-semibold text-slate-600">{item.next_action_owner || "—"}{item.unresolved_messages > 0 && <p className="mt-1 text-amber-700">{item.unresolved_messages} concern(s)</p>}</td>
            <td className="px-3 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); openCase(item); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> Open case</button></td>
          </tr>
        );
      }} />}
      {selectedItem && (
        <WorkflowCaseModal
          id={`withdrawal-case-${selectedItem.id}`}
          title={selectedItem.student.name}
          subtitle={`${selectedItem.student.student_number} · ${selectedItem.student.program_code} · Withdrawal case`}
          status={selectedCurrent?.status || (reset.resetMessage ? "Reset" : selectedItem.status)}
          onClose={closeCase}
          footer={(
            <>
              {accountRole === "staff" && selectedCurrent && <DemoResetButton student={selectedCurrent.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedCurrent && <button type="button" onClick={() => setMessageRow(selectedCurrent)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {accountRole === "staff" && selectedCurrent?.status === "Requirements Submitted" && (
                <button type="button" disabled={submitting || refreshing} onClick={() => submit({ student_id: selectedCurrent.student_id, workflow_action: "return_requirements" })} className="btn-ghost cursor-pointer px-4 py-2">
                  Return incomplete requirements
                </button>
              )}
              {selectedAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => submit(selectedAction.payload)} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">{selectedCurrent ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "This demo case has been reset."}</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Detail label="Dean" value={selectedCurrent?.dean_decision || selectedItem.dean_decision} />
              <Detail label="Requirements" value={selectedCurrent?.requirement_status || selectedItem.requirement_status} />
              <Detail label="Fee status" value={selectedCurrent?.fee_status || selectedItem.fee_status} />
              <Detail label="Registrar" value={selectedCurrent?.registrar_status || selectedItem.registrar_status} />
            </div>
            <WorkflowTimeline steps={withdrawalSteps} title="Withdrawal workflow timeline" />
            <CaseMessageHistory messages={selectedCurrent?.messages || selectedItem.messages} />
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Request</p>
              <p className="mt-2 text-sm font-semibold text-ink">Effective {selectedItem.effective_term || "term pending"}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{selectedItem.reason || "No reason provided"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedItem.request_attachment && <a href={selectedItem.request_attachment.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5">Request form <ArrowUpRight className="h-3.5 w-3.5" /></a>}
                {selectedItem.proof_attachment && <a href={selectedItem.proof_attachment.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5">Proof <ArrowUpRight className="h-3.5 w-3.5" /></a>}
              </div>
            </div>
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="withdrawal" row={messageRow} context={context} onClose={() => setMessageRow(null)} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
    </div>
  );
}

function GraduationRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const reset = useDemoCaseReset("graduation", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.endorsement?.endorsement_status || "Not Prepared")), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.student.program_name}`.toLowerCase();
    const eligibility = row.eligibility.status;
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.endorsement?.endorsement_status || "Not Prepared") === filters.status)
      && (!filters.secondary || eligibility === filters.secondary);
  }), [rows, filters]);
  const selectedRows = rows.filter((row) => selectedIds.has(row.student.id));
  function toggleSelected(studentId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }
  function selectRows(predicate) {
    setSelectedIds(new Set(filteredRows.filter(predicate).map((row) => row.student.id)));
  }
  function actionFor(row) {
    const status = row.endorsement?.endorsement_status;
    const base = { student_id: row.student.id, review_window: row.endorsement?.review_window || "AY 2026-2027 Graduation Review" };
    if (accountRole === "staff" && (!status || ["For Review", "Not Eligible"].includes(status))) return { label: status === "Not Eligible" ? "Restart role-based review" : "Compile & send to Academic Coordinator", payload: { ...base, endorsement_status: "Coursework Review" } };
    if (accountRole === "academic_coordinator" && status === "Coursework Review") return { label: "Record coursework review", payload: { ...base, endorsement_status: "Research Review" } };
    if (accountRole === "research_coordinator" && status === "Research Review") return { label: "Validate research requirements", payload: { ...base, endorsement_status: "Eligibility Confirmed" } };
    if (accountRole === "staff" && ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status)) return { label: "List missing requirements & mark not eligible", payload: { ...base, endorsement_status: "Not Eligible" } };
    if (accountRole === "staff" && status === "Eligibility Confirmed") return { label: "Prepare endorsement list", payload: { ...base, endorsement_status: "Endorsement Prepared" } };
    if (accountRole === "staff" && ["Endorsement Prepared", "Returned for Revision"].includes(status)) return { label: status === "Returned for Revision" ? "Resend revised list to Dean" : "Send endorsement list to Dean", payload: { ...base, endorsement_status: "Ready for Dean Review" } };
    if (accountRole === "registrar" && status === "Sent to Registrar") return { label: "Record Registrar receipt", payload: { ...base, endorsement_status: "Registrar Received", registrar_status: "Received" } };
    return null;
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedAction = selectedRow ? actionFor(selectedRow) : null;
  const selectedEndorsement = selectedRow?.endorsement || null;
  const graduationSteps = selectedRow ? graduationTimelineSteps(selectedEndorsement?.endorsement_status, selectedRow.eligibility) : [];

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Graduation endorsement candidates" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · AC checks coursework, Research validates evidence, Staff prepares, and the Dean owns Registrar export`} icon={GraduationCap} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not eligible", "Needs verification"]} count={filteredRows.length} total={rows.length} />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <span className="mr-auto text-sm font-semibold text-slate-700">{selectedIds.size} selected</span>
        <button type="button" onClick={() => selectRows((row) => row.eligibility.status === "Eligible")} className="btn-ghost cursor-pointer px-3 py-2">Select all eligible</button>
        <button type="button" onClick={() => selectRows((row) => row.unresolved_messages > 0 || row.next_action_owner === WORKFLOW_ROLE_LABELS[accountRole])} className="btn-ghost cursor-pointer px-3 py-2">Select needs action</button>
        {selectedIds.size > 0 && <button type="button" onClick={() => setSelectedIds(new Set())} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
        <button type="button" disabled={!selectedIds.size} onClick={() => setBatchOpen(true)} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> Apply group action</button>
      </div>
      <WorkflowTable headers={["Select", "Student", "Coursework", "Thesis / research", "Practicum", "Eligibility", "Endorsement", "Updated", "Action"]} empty="No candidates match the current filters." rows={filteredRows} render={(row) => {
        const endorsement = row.endorsement;
        return (
          <tr
            key={row.student.id}
            onClick={() => openCase(row.student.id)}
            className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
          >
            <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(row.student.id)} onChange={() => toggleSelected(row.student.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${row.student.name}`} /></td>
            <StudentCell student={row.student} />
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.coursework_status} dot={false} /></td>
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.research_status} dot={false} /></td>
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.practicum_status} dot={false} /></td>
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.status} dot={false} />{row.unresolved_messages > 0 && <p className="mt-1 text-xs font-semibold text-amber-700">{row.unresolved_messages} concern(s)</p>}</td>
            <td className="px-3 py-3"><StatusBadge value={endorsement?.endorsement_status || "Not Prepared"} dot={false} /></td>
            <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.last_activity_at || endorsement?.updated_at)}</td>
            <td className="px-3 py-3"><div className="flex gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); openCase(row.student.id); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> View</button>{endorsement && <button type="button" onClick={(event) => { event.stopPropagation(); setMessageRow(row); }} className="btn-ghost cursor-pointer px-3 py-2"><MessageSquare className="h-4 w-4" /> Message</button>}</div></td>
          </tr>
        );
      }} />
      {selectedRow && (
        <WorkflowCaseModal
          id={`graduation-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Graduation endorsement`}
          status={selectedEndorsement?.endorsement_status || selectedRow.eligibility.status}
          onClose={() => setSelectedStudentId(null)}
          footer={(
            <>
              {accountRole === "staff" && selectedEndorsement && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedEndorsement && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => submit(selectedAction.payload)} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>
              ) : selectedEndorsement?.endorsement_status === "Dean Approved" ? (
                <span className="self-center rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Awaiting Dean export</span>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">No {WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Detail label="Program" value={selectedRow.student.program_name} />
              <Detail label="Coursework" value={selectedRow.eligibility.coursework_status} />
              <Detail label="Research" value={selectedRow.eligibility.research_status} />
              <Detail label="Practicum" value={selectedRow.eligibility.practicum_status} />
              <Detail label="Eligibility" value={selectedRow.eligibility.status} />
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {selectedRow.eligibility.checklist?.map((item) => <div key={item.key} className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-semibold text-slate-700">{item.label}</p><p className="text-xs text-slate-400">Source: {item.source_field}</p></div><p className="text-xs font-semibold text-slate-500">{String(item.actual_value)}</p><StatusBadge value={item.status} dot={false} /></div>)}
            </div>
            {selectedEndorsement?.dean_remarks && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><span className="font-semibold text-ink">Dean remarks: </span>{selectedEndorsement.dean_remarks}</div>}
            <WorkflowTimeline steps={graduationSteps} title="Graduation endorsement timeline" />
            <CaseMessageHistory messages={selectedRow.messages} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Missing coursework</p>
                {selectedRow.eligibility.missing_coursework?.length ? <ul className="mt-2 space-y-1.5 text-sm text-slate-600">{selectedRow.eligibility.missing_coursework.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm font-semibold text-brand-700">None</p>}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Missing research requirements</p>
                {selectedRow.eligibility.missing_research_requirements?.length ? <ul className="mt-2 space-y-1.5 text-sm text-slate-600">{selectedRow.eligibility.missing_research_requirements.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm font-semibold text-brand-700">None</p>}
              </div>
            </div>
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="graduation" row={messageRow} context={context} onClose={() => setMessageRow(null)} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {batchOpen && selectedRows.length > 0 && <GraduationBatchModal rows={selectedRows} context={context} onClose={() => setBatchOpen(false)} onSaved={async (batchResult) => { setMessageNotice(batchResult.message); setSelectedIds(new Set()); await refetch(); }} />}
    </div>
  );
}

function WorkflowTable({ headers, rows, render, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

function RosterFilters({ filters, setFilters, programs, statuses, secondaryLabel, secondaryOptions, count, total }) {
  const active = Object.values(filters).filter(Boolean).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search list</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search name, ID, program…" aria-label="Search list" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter by workflow status"><option value="">All workflow statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <select value={filters.secondary} onChange={update("secondary")} className="field-input cursor-pointer" aria-label={`Filter by ${secondaryLabel}`}><option value="">All {secondaryLabel.toLowerCase()}</option>{secondaryOptions.map((option) => <option key={option}>{option}</option>)}</select>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Showing {count} of {total} records</span>
        {active > 0 && <button type="button" onClick={() => setFilters({ query: "", program: "", status: "", secondary: "" })} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button>}
      </div>
    </div>
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function StudentCell({ student }) {
  return <td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p></td>;
}

function Detail({ label, value }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value || "—"}</p></div>;
}

function PracticumForm({ context, studentId, submit, submitting }) {
  const selected = context.selected_student;
  const current = context.practicum_record;
  const [form, setForm] = useState({
    moa_status: "Uploaded",
    moa_uploaded: "true",
    practicum_site: "",
    required_hours: 200,
    completed_hours: 0,
    document_status: "Pending Review",
    certificate_count: 0,
    status: "Under Review",
    remarks: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      moa_status: current?.moa_status || "Uploaded",
      moa_uploaded: current?.moa_uploaded ? "true" : "true",
      practicum_site: current?.practicum_site || "",
      required_hours: current?.required_hours || 200,
      completed_hours: current?.completed_hours || 0,
      document_status: current?.document_status || "Pending Review",
      certificate_count: current?.certificate_count || 0,
      status: current?.status || "Under Review",
      remarks: current?.remarks || "",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (selected && !selected.program_has_practicum) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Practicum not required"
        hint={`${selected.program_code} is not marked as a practicum-required program.`}
      />
    );
  }

  const completeEnough = Number(form.completed_hours || 0) >= Number(form.required_hours || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process practicum submission" subtitle="Record MOA receipt, certificate review, hours, and Dean report status" icon={Briefcase} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{current.practicum_site || "Practicum site not set"}</p>
              <p className="text-xs text-slate-500">{current.completed_hours}/{current.required_hours} hours · {current.certificate_count} certificate(s)</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MOA status">
          <Select value={form.moa_status} onChange={set("moa_status")} placeholder="" options={["Uploaded", "Pending Review", "Verified", "Returned", "Missing"]} />
        </Field>
        <Field label="Practicum site / company" required>
          <Input value={form.practicum_site} onChange={set("practicum_site")} required />
        </Field>
        <Field label="Required hours" required>
          <Input type="number" min="1" value={form.required_hours} onChange={set("required_hours")} required />
        </Field>
        <Field label="Completed hours" required>
          <Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required />
        </Field>
        <Field label="Certificate/document status">
          <Select value={form.document_status} onChange={set("document_status")} placeholder="" options={["Missing", "Uploaded", "Pending Review", "Verified", "Returned"]} />
        </Field>
        <Field label="Number of certificates">
          <Input type="number" min="0" value={form.certificate_count} onChange={set("certificate_count")} />
        </Field>
        <Field label="Workflow status">
          <Select
            value={form.status}
            onChange={set("status")}
            placeholder=""
            options={["MOA Received", "Under Review", "Hours Incomplete", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} placeholder="Email, drive link, or staff note" />
        </Field>
      </div>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={set("remarks")} />
      </Field>
      {!completeEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Completed hours are below the requirement. Saving will keep this case incomplete and queue the student for additional certificates.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save practicum status</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------
function WithdrawalForm({ context, studentId, submit, submitting }) {
  const current = context.withdrawal_application;
  const [form, setForm] = useState({
    reason: "",
    effective_term: "",
    fee_status: "Pending",
    requirement_status: "Pending",
    dean_decision: "Pending",
    staff_remarks: "",
    academic_coordinator_remarks: "",
    registrar_status: "Pending",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      reason: current?.reason || "",
      effective_term: current?.effective_term || "",
      fee_status: current?.fee_status || "Pending",
      requirement_status: current?.requirement_status || "Pending",
      dean_decision: current?.dean_decision || "Pending",
      staff_remarks: current?.staff_remarks || "",
      academic_coordinator_remarks: current?.academic_coordinator_remarks || "",
      registrar_status: current?.registrar_status || "Pending",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process withdrawal application" subtitle="Record Dean decision, coordinator follow-through, requirements, fee status, and registrar confirmation" icon={LogOut} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Effective {current.effective_term || "term pending"}</p>
              <p className="text-xs text-slate-500">Dean: {current.dean_decision} · requirements: {current.requirement_status} · fees: {current.fee_status}</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Effective term" required>
          <Input value={form.effective_term} onChange={set("effective_term")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Dean decision">
          <Select value={form.dean_decision} onChange={set("dean_decision")} placeholder="" options={["Pending", "Approved", "Denied", "Returned"]} />
        </Field>
        <Field label="Requirement status">
          <Select value={form.requirement_status} onChange={set("requirement_status")} placeholder="" options={["Pending", "Complete", "Incomplete"]} />
        </Field>
        <Field label="Fee status">
          <Select value={form.fee_status} onChange={set("fee_status")} placeholder="" options={["Pending", "Cleared", "Not Cleared"]} />
        </Field>
        <Field label="Registrar confirmation/status">
          <Select value={form.registrar_status} onChange={set("registrar_status")} placeholder="" options={["Pending", "Confirmed", "Not Cleared", "Record Updated"]} />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Reason for withdrawal">
        <Textarea value={form.reason} onChange={set("reason")} />
      </Field>
      <Field label="Academic Coordinator remarks">
        <Textarea value={form.academic_coordinator_remarks} onChange={set("academic_coordinator_remarks")} />
      </Field>
      <Field label="Staff remarks">
        <Textarea value={form.staff_remarks} onChange={set("staff_remarks")} />
      </Field>
      <SubmitButton submitting={submitting}>Save withdrawal action</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Graduation Endorsement
// ---------------------------------------------------------------------------
function GraduationForm({ context, studentId, submit, submitting }) {
  const eligibility = context.graduation_eligibility || {};
  const current = context.graduation_endorsement;
  const [form, setForm] = useState({
    review_window: "AY 2026-2027 Graduation Review",
    endorsement_status: "For Review",
    dean_remarks: "",
    registrar_status: "Pending",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      review_window: current?.review_window || "AY 2026-2027 Graduation Review",
      endorsement_status: current?.endorsement_status || (eligibility.eligible ? "Ready for Dean Review" : "For Review"),
      dean_remarks: current?.dean_remarks || "",
      registrar_status: current?.registrar_status || "Pending",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at, eligibility.eligible]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => ({ type: "Coursework", item })),
    ...(eligibility.missing_research_requirements || []).map((item) => ({ type: "Research", item })),
    ...(eligibility.missing_practicum_requirement ? [{ type: "Practicum", item: eligibility.missing_practicum_requirement }] : []),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review graduation endorsement" subtitle="Monitor endorsement readiness before the official Registrar process" icon={GraduationCap} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MiniBox label="Coursework" value={eligibility.coursework_status || "Pending"} tone={eligibility.coursework_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Research" value={eligibility.research_status || "Pending"} tone={eligibility.research_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Practicum" value={eligibility.practicum_status || "Not Required"} tone={eligibility.practicum_status === "Not Required" || eligibility.practicum_status === "Dean Reviewed" ? "brand" : "amber"} />
        <MiniBox label="Eligible" value={eligibility.eligible ? "Yes" : "No"} tone={eligibility.eligible ? "brand" : "red"} />
      </div>
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Missing requirements</p>
          <ul className="space-y-1.5">
            {missing.slice(0, 10).map((row, index) => (
              <li key={`${row.type}-${index}`} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><span className="font-semibold">{row.type}:</span> {row.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Review window / term" required>
          <Input value={form.review_window} onChange={set("review_window")} required />
        </Field>
        <Field label="Endorsement status">
          <Select
            value={form.endorsement_status}
            onChange={set("endorsement_status")}
            placeholder=""
            options={["For Review", "Ready for Dean Review", "Not Eligible", "Returned for Revision", "Sent to Registrar"]}
          />
        </Field>
        <Field label="Registrar handoff/status">
          <Select value={form.registrar_status} onChange={set("registrar_status")} placeholder="" options={["Pending", "Sent", "Received"]} />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Dean remarks">
        <Textarea value={form.dean_remarks} onChange={set("dean_remarks")} />
      </Field>
      {!eligibility.eligible && form.endorsement_status === "Ready for Dean Review" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This candidate still has missing requirements. Saving will keep the backend status as Not Eligible and queue the listed owner.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save endorsement review</SubmitButton>
    </form>
  );
}

function shortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

function timeRange(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

// ---------------------------------------------------------------------------
// Leave of Absence
// ---------------------------------------------------------------------------
function LeaveOfAbsenceForm({ context, studentId, submit, submitting }) {
  const selectedRequest = context?.selected_request;
  const [policyReview, setPolicyReview] = useState(context?.loa_policy_review || null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10),
    application_reference: "",
    effective_start: "",
    effective_end: "",
    reason_remarks: "",
    prior_loa_count: 0,
    eligibility_status: "Eligible",
    dean_action: "Approve",
    staff_notes: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setPolicyReview(context?.loa_policy_review || null);
  }, [context?.loa_policy_review]);

  useEffect(() => {
    if (!selectedRequest) return;
    setForm((current) => ({
      ...current,
      request_date: (selectedRequest.submitted_at || "").slice(0, 10) || current.request_date,
      application_reference: selectedRequest.attachment || selectedRequest.source_reference || "",
      effective_start: selectedRequest.effective_start || "",
      effective_end: selectedRequest.effective_end || "",
      reason_remarks: selectedRequest.reason_remarks || "",
      source_reference: selectedRequest.source_reference || selectedRequest.attachment || "",
    }));
  }, [selectedRequest?.request_log_id]);

  async function runPolicyReview(applySuggestion = false) {
    if (!studentId) return;
    setReviewing(true);
    setReviewError("");
    try {
      const result = await api.loaPolicyReview({ student_id: studentId, ...form });
      setPolicyReview(result.review);
      if (applySuggestion && result.review) {
        setForm((current) => ({
          ...current,
          eligibility_status: result.review.recommendation || current.eligibility_status,
          dean_action: result.review.suggested_dean_action || current.dean_action,
          staff_notes: current.staff_notes || result.review.summary || "",
        }));
      }
    } catch (err) {
      setReviewError(err.message || "Could not run the LOA policy review.");
    } finally {
      setReviewing(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Record leave of absence" subtitle="Records the request, Dean decision, status pause, and notice trail" icon={CalendarOff} />
      <RequestSummary request={selectedRequest} />
      <LoaPolicyReviewCard
        review={policyReview}
        busy={reviewing}
        error={reviewError}
        onReview={() => runPolicyReview(false)}
        onApply={() => runPolicyReview(true)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Application attachment / file reference">
          <Input value={form.application_reference} onChange={set("application_reference")} placeholder="Email subject, uploaded PDF, or drive link" />
        </Field>
        <Field label="Request date" required>
          <Input type="date" value={form.request_date} onChange={set("request_date")} required />
        </Field>
        <Field label="Effective start term/date">
          <Input value={form.effective_start} onChange={set("effective_start")} placeholder="AY 2026-2027 Term 1 or YYYY-MM-DD" />
        </Field>
        <Field label="Effective end term/date">
          <Input value={form.effective_end} onChange={set("effective_end")} placeholder="AY 2026-2027 Term 2 or YYYY-MM-DD" />
        </Field>
        <Field label="Prior LOA count">
          <Input type="number" min="0" value={form.prior_loa_count} onChange={set("prior_loa_count")} />
        </Field>
        <Field label="Eligibility status / check result">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>

      <Field label="Dean decision">
        <RadioRow
          value={form.dean_action}
          onChange={(v) => setForm((f) => ({ ...f, dean_action: v }))}
          options={["Approve", "Deny", "Return for Revision"]}
        />
      </Field>
      <Field label="Reason / remarks">
        <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      <Field label="Source / reference number">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Record LOA Decision</SubmitButton>
    </form>
  );
}

function LoaPolicyReviewCard({ review, busy, error, onReview, onApply }) {
  return (
    <PolicyReviewCard
      title="LOA policy review"
      description="RAG-style check using the LOA/residency policy plus this student request. Staff still records the final decision."
      emptyText="Run the review after selecting a submitted LOA request."
      review={review}
      busy={busy}
      error={error}
      onReview={onReview}
      onApply={onApply}
    />
  );
}

function PolicyReviewCard({ title, description, emptyText, review, busy, error, onReview, onApply }) {
  const citations = review?.citations || [];
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {description}
            </p>
          </div>
        </div>
        {review?.recommendation && <StatusBadge value={review.recommendation} dot={false} />}
      </div>
      {review ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">{review.summary}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(review.checks || []).map((check) => (
              <div key={check.label} className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{check.label}</p>
                  <StatusBadge value={check.status} dot={false} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{check.detail}</p>
              </div>
            ))}
          </div>
          {citations.length > 0 && (
            <details className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">Policy sources</summary>
              <div className="mt-2 space-y-2">
                {citations.map((citation) => (
                  <div key={citation.id || citation.title} className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">{citation.title} · {citation.source}</p>
                    <p className="mt-0.5">{citation.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{emptyText}</p>
      )}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onReview} disabled={busy} className="btn-ghost">
          <Sparkles className="h-4 w-4" /> {busy ? "Reviewing..." : "Recheck policy"}
        </button>
        <button type="button" onClick={onApply} disabled={busy || !review} className="btn-primary">
          Apply suggestion
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readmission
// ---------------------------------------------------------------------------
function ReadmissionForm({ context, studentId, submit, submitting }) {
  const requirements = context.readmission_requirements || [];
  const selectedRequest = context?.selected_request;
  const [items, setItems] = useState(requirements);
  const [policyReview, setPolicyReview] = useState(context?.readmission_policy_review || null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [form, setForm] = useState({
    application_reference: "",
    target_return_term: "",
    previous_loa_period: "",
    eligibility_status: "Eligible to Return",
    missing_requirements: "",
    dean_action: "Approve",
    staff_notes: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setItems((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  useEffect(() => setItems(context.readmission_requirements || []), [context.readmission_requirements]);
  useEffect(() => setPolicyReview(context?.readmission_policy_review || null), [context?.readmission_policy_review]);

  useEffect(() => {
    if (!selectedRequest) return;
    setForm((current) => ({
      ...current,
      application_reference: selectedRequest.attachment || selectedRequest.source_reference || "",
      target_return_term: selectedRequest.target_return_term || "",
      previous_loa_period: selectedRequest.previous_loa_period || "",
      source_reference: selectedRequest.source_reference || selectedRequest.attachment || "",
    }));
  }, [selectedRequest?.request_log_id]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form, readmission_items: items });
  }

  async function runPolicyReview(applySuggestion = false) {
    if (!studentId) return;
    setReviewing(true);
    setReviewError("");
    try {
      const result = await api.readmissionPolicyReview({ student_id: studentId, ...form, readmission_items: items });
      setPolicyReview(result.review);
      if (applySuggestion && result.review) {
        setForm((current) => ({
          ...current,
          eligibility_status: result.review.recommendation || current.eligibility_status,
          dean_action: result.review.suggested_dean_action || current.dean_action,
          missing_requirements: (result.review.missing_requirements || []).join(", "),
          staff_notes: current.staff_notes || result.review.summary || "",
        }));
      }
    } catch (err) {
      setReviewError(err.message || "Could not run the readmission policy review.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Record readmission" subtitle="Checks return eligibility, records the Dean decision, and reactivates approved students" icon={UserCheck} />
      <RequestSummary request={selectedRequest} />
      <PolicyReviewCard
        title="Readmission policy review"
        description="RAG-style check using the readmission policy plus this student request. Staff still records the final decision."
        emptyText="Run the review after selecting a submitted readmission request."
        review={policyReview}
        busy={reviewing}
        error={reviewError}
        onReview={() => runPolicyReview(false)}
        onApply={() => runPolicyReview(true)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Application attachment / file reference">
          <Input value={form.application_reference} onChange={set("application_reference")} placeholder="Email subject, uploaded PDF, or drive link" />
        </Field>
        <Field label="Target return term" required>
          <Input value={form.target_return_term} onChange={set("target_return_term")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Previous LOA period">
          <Input value={form.previous_loa_period} onChange={set("previous_loa_period")} placeholder="AY 2025-2026 Term 2 to AY 2026-2027 Term 1" />
        </Field>
        <Field label="Eligibility to return status">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible to Return", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>
      <Field label="Eligibility to return checklist" hint="Unticked items are treated as missing requirements.">
        <CheckList items={requirements} selected={items} onToggle={toggle} />
      </Field>
      <Field label="Missing requirements / remarks">
        <Textarea value={form.missing_requirements} onChange={set("missing_requirements")} />
      </Field>
      <Field label="Dean decision">
        <RadioRow
          value={form.dean_action}
          onChange={(v) => setForm((f) => ({ ...f, dean_action: v }))}
          options={["Approve", "Deny", "Return for Revision"]}
        />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      <Field label="Source / reference number">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Record Readmission Decision</SubmitButton>
    </form>
  );
}

function MiniBox({ label, value, tone }) {
  const tones = {
    brand: "text-brand-700 bg-brand-50",
    blue: "text-blue-700 bg-blue-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="font-display text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function workflowGuidance(slug) {
  const map = {
    "student-handoff":
      "The registrar's data arrives as a file. Upload the AC Student Monitoring sheet and the platform creates each student, their program, and their enrolled subjects automatically — no manual typing.",
    "leave-of-absence":
      "Leave of Absence is a stop/pause process. Staff record the uploaded application, check prior LOA eligibility, forward the request to the Dean, record the decision, update the student's status only when approved, and send the notice.",
    readmission:
      "Readmission is a separate return/re-entry process after the approved leave period. Staff record the request, check eligibility for the target term, route the Dean decision, reactivate approved students, and send the notice.",
    "course-audit":
      "Run at the end of the term. Pick a subject to see its enrolled students, then tick who completed it. Saving updates each student's course audit and missing count; a student who clears all subjects advances to Proposal Development.",
    "research-gate":
      "Reads the student's stored PDF evidence for the selected gate. Staff can evaluate existing files and adviser revisions, but cannot manually mark an absent document as received.",
    "panel-matching":
      "Reads the body text of all three uploaded concept papers, extracts significant keywords, then ranks faculty expertise with availability, college fit, and current panel load. Research titles and filenames are excluded.",
    "defense-scheduling":
      "Opens only after panel matching. The date spread compares adviser and panel availability, respects weekday work hours, and shows weekends only when faculty recorded an explicit override.",
    practicum:
      "Available only for programs marked with practicum requirements. Staff record MOA receipt, review certificates and hours, request additional certificates when hours are short, and route completed reports to the Dean.",
    withdrawal:
      "Withdrawal is a lifecycle-exit process. A Dean denial keeps the student Active. An approval moves through coordinator follow-through, student requirements, fee/registrar confirmation, and only then marks the student Withdrawn.",
    graduation:
      "This is the Graduate School monitoring and endorsement layer. It checks coursework, research completion evidence, practicum when required, and pending tasks before staff send the endorsement list for Dean review and Registrar handoff.",
  };
  return map[slug] || "";
}
