import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  FileText,
  FileUp,
  GraduationCap,
  Eye,
  LogOut,
  Mail,
  UserX,
} from "lucide-react";
import { api } from "../../api";
import { Card, EmptyState, ProgressBar, SectionTitle, StatusBadge } from "../../components/ui";
import { formatDate, initials } from "../../lib/format";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import { RESEARCH_GATE_KEYS } from "./shared";

export function StudentHero({ data }) {
  const { student, course_audit, research_case } = data;
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl font-bold text-brand-700">
            {initials(student.name)}
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{student.name}</h2>
            <p className="text-sm text-slate-500">
              {student.student_number} - {student.program_name}
            </p>
            <p className="mt-1 text-xs font-semibold text-brand-700">AY Entry {student.academic_year_entry || "Not recorded"} · {student.course_year_label || "Course year unavailable"}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" /> {student.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
          <MiniStat label="Stage" value={student.current_stage} />
          <MiniStat label="Progress" value={data.progress_status?.level || "Not yet assessed"} badge />
          <MiniStat label="Coursework" value={`${course_audit.completion_rate}%`} />
          <MiniStat label="Research" value={research_case?.status || "Not started"} badge />
        </div>
      </div>
    </Card>
  );
}

export function MiniStat({ label, value, badge }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <div className="mt-1 min-h-6">
        {badge ? <StatusBadge value={value} dot={false} /> : <p className="text-sm font-semibold text-ink">{value}</p>}
      </div>
    </div>
  );
}

export function ProgressPanel({ data }) {
  const { stages, stage_index, student, course_audit, research_case } = data;
  const progressStages = stages
    .filter((stage) => stage !== "LOA")
    .map((stage) => (stage === "Completed" ? "Completion Evidence" : stage));
  const currentStage = student.current_stage === "Completed" ? "Completion Evidence" : student.current_stage;
  const displayIndex = progressStages.indexOf(currentStage);
  return (
    <Card className="p-6">
      <SectionTitle title="My Academic Status" subtitle="Your current stage, requirements, and next step" icon={ClipboardCheck} />
      {student.standing === "On Leave" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          You are on Leave of Absence, so you cannot enroll in subjects. The time on leave still counts toward your maximum residence. Readmission becomes available while this status is active.
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {progressStages.map((stage, i) => {
          const done = displayIndex >= 0 && i < displayIndex;
          const current = i === displayIndex;
          return (
            <span
              key={stage}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                current ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${current || done ? "bg-current" : "bg-slate-300"}`} />
              {stage}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Coursework completion</span>
            <span className="font-bold text-brand-700">{course_audit.completion_rate}%</span>
          </div>
          <ProgressBar value={course_audit.completion_rate} />
          <p className="mt-2 text-xs text-slate-500">
            {course_audit.completed.length} completed, {course_audit.current.length} current, {course_audit.missing_count} missing.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-ink">{research_case?.title || "No research case opened yet"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Adviser: {student.adviser_name || research_case?.adviser_name || "Not assigned"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={research_case?.current_gate_label || "Research not started"} dot={false} />
            {research_case?.status && <StatusBadge value={research_case.status} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function WorkflowStatusPanel({ data }) {
  const rows = [];
  if (data.student.program_has_practicum) {
    rows.push({
      label: "Practicum",
      icon: Briefcase,
      status: data.practicum_record?.status || "Missing",
      detail: data.practicum_record
        ? `${data.practicum_record.completed_hours}/${data.practicum_record.required_hours} hours · ${data.practicum_record.document_status}`
        : "No practicum MOA or certificates submitted yet.",
    });
  }
  rows.push({
    label: "Withdrawal",
    icon: LogOut,
    status: data.withdrawal_application?.status || "No request",
    detail: data.withdrawal_application
      ? `Dean: ${data.withdrawal_application.dean_decision} · requirements: ${data.withdrawal_application.requirement_status}`
      : "No withdrawal request is active.",
  });
  if (data.student.enrollment_tag === "AWOL" || data.student.enrollment_tag === "Residency" || data.awol_case || data.residency_record) {
    rows.push({
      label: data.student.enrollment_tag === "Residency" ? "Residency" : "AWOL / Return",
      icon: UserX,
      status: data.residency_record?.status || data.awol_case?.status || data.student.enrollment_tag,
      detail: data.residency_record
        ? `${data.residency_record.term_label} · ${data.residency_record.reason}`
        : data.awol_case?.policy_classification || "Submit your return declaration when you are ready to return.",
    });
  }
  rows.push({
    label: "Graduation Endorsement",
    icon: GraduationCap,
    status: data.graduation_endorsement?.endorsement_status || data.graduation_eligibility?.status || "Needs verification",
    detail: data.graduation_endorsement
      ? `Coursework: ${data.graduation_endorsement.coursework_status} · research: ${data.graduation_endorsement.research_status}`
      : data.graduation_eligibility?.next_action || "No graduation endorsement request submitted yet.",
  });

  return (
    <Card className="p-6">
      <SectionTitle title="Workflow Status" subtitle="Administrative and completion requests currently visible to you" icon={FileText} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" /> {row.label}
                </span>
                <StatusBadge value={row.status} dot={false} />
              </div>
              <p className="text-xs leading-relaxed text-slate-500">{row.detail}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AdministrativeDocumentsPanel({ documentsByGate, onSaved }) {
  const entries = Object.entries(documentsByGate || {}).filter(([gate]) => !RESEARCH_GATE_KEYS.has(gate));
  if (!entries.length) return null;
  return (
    <Card className="p-6">
      <SectionTitle title="Administrative Documents" subtitle="Admission and general records outside your research submissions" icon={FileText} />
      <div className="space-y-4">
        {entries.map(([gate, docs]) => (
          <div key={gate}>
            <p className="mb-2 text-sm font-semibold text-slate-700">{gate}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{doc.display_name || doc.item_name}</span>
                    <StatusBadge value={doc.status_label || doc.status} dot={false} />
                    {doc.status === "Missing" ? (
                      <MissingDocumentUpload doc={doc} onSaved={onSaved} />
                    ) : (
                      <DocumentViewButton doc={doc} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DocumentViewButton({ doc }) {
  const file = doc.files?.[0];
  const reference = file?.url || doc.evidence_reference || "";
  const canView = Boolean(reference);

  function viewReference() {
    if (!canView) return;
    if (file?.url || /^https?:\/\//i.test(reference)) {
      window.open(reference, "_blank", "noopener,noreferrer");
      return;
    }
    window.alert(`Document reference: ${reference}`);
  }

  return (
    <button
      type="button"
      onClick={viewReference}
      disabled={!canView}
      aria-label="View document"
      title={canView ? `View document: ${reference}` : "No document reference recorded yet"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  );
}

export function MissingDocumentUpload({ doc, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(file) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    try {
      await api.submitStudentDocument(doc.id, file);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not submit the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <label
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 hover:bg-brand-50"
        title="Upload PDF"
        aria-label="Upload PDF"
      >
        <FileUp className="h-3.5 w-3.5" />
        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => submit(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-1 max-w-32 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function SchedulePanel({ schedules }) {
  return (
    <Card className="p-6">
      <SectionTitle title="Schedule Requests" icon={CalendarClock} />
      {schedules.length ? (
        <ul className="space-y-2.5">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{formatDate(schedule.preferred_date)}</p>
                <StatusBadge value={schedule.status} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {schedule.mode} - {schedule.venue || "Venue/link pending"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No schedule requests" />
      )}
    </Card>
  );
}

export function RecommendationsPanel({ recommendations }) {
  return (
    <Card className="p-6">
      <SectionTitle title="Next Step" icon={ArrowRight} />
      {recommendations.length ? (
        <ul className="space-y-2.5">
          {recommendations.slice(0, 3).map((rec, i) => (
            <li key={i} className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold text-ink">{rec.recommendation}</p>
              <p className="mt-1 text-xs text-slate-500">Owner: {rec.owner}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="On track" hint="No immediate follow-up is flagged." />
      )}
    </Card>
  );
}

export function ActivityPanel({ logs }) {
  const visibleLogs = useMemo(() => logs || [], [logs]);
  return (
    <Card className="p-6">
      <SectionTitle title="Activity History" subtitle="Submissions, decisions, and next owners" icon={Activity} />
      {visibleLogs.length ? (
        <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={visibleLogs.length}>
          <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
            {visibleLogs.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
                <p className="text-sm font-semibold text-ink">{log.result}</p>
                <p className="text-xs text-slate-500">
                  {log.actor_role} - next: {log.next_owner || "Pending"} - {formatDate(log.created_at)}
                </p>
                {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
              </li>
            ))}
          </ol>
        </HistoryDisclosure>
      ) : (
        <EmptyState title="No activity yet" />
      )}
    </Card>
  );
}
