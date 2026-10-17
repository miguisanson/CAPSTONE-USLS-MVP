import { useState } from "react";
import {
  Activity,
  Briefcase,
  ClipboardCheck,
  FileText,
  FileUp,
  GraduationCap,
  Eye,
  LogOut,
  UserX,
} from "lucide-react";
import { api } from "../../api";
import { Button, Card, EmptyState, HistoryPanel, InlineNotice, SectionTitle, StatusChip, Stepper } from "../../components/ui/index.js";
import { ProgressBar } from "../../components/ui";
import { stageSteps } from "../../lib/stages";
import { RESEARCH_GATE_KEYS } from "./shared";

export function ProgressPanel({ data }) {
  const { stages, student, course_audit, research_case } = data;
  return (
    <Card pad="lg">
      <SectionTitle title="My Academic Status" subtitle="Your current stage, requirements, and next step" icon={ClipboardCheck} />
      {student.standing === "On Leave" && (
        <InlineNotice tone="warning" className="mb-4">
          You are on Leave of Absence, so you cannot enroll in subjects. The time on leave still counts toward your maximum residence. Readmission becomes available while this status is active.
        </InlineNotice>
      )}
      <Stepper steps={stageSteps(student.current_stage, stages)} compact className="mb-5" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Coursework completion</span>
            <span className="font-semibold text-brand-700">{course_audit.completion_rate}%</span>
          </div>
          <ProgressBar value={course_audit.completion_rate} />
          <p className="meta mt-2">
            {course_audit.completed.length} completed, {course_audit.current.length} current, {course_audit.missing_count} missing.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-ink">{research_case?.title || "No research case opened yet"}</p>
          <p className="meta mt-1">
            Adviser: {student.adviser_name || research_case?.adviser_name || "Not assigned"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={research_case?.current_gate_label || "Research not started"} dot={false} />
            {research_case?.status && <StatusChip status={research_case.status} />}
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
    <Card pad="lg">
      <SectionTitle title="Workflow Status" subtitle="Administrative and completion requests currently visible to you" icon={FileText} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" /> {row.label}
                </span>
                <StatusChip status={row.status} dot={false} />
              </div>
              <p className="meta leading-relaxed">{row.detail}</p>
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
    <Card pad="lg">
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
                    <StatusChip status={doc.status_label || doc.status} dot={false} />
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
    <Button
      variant="icon"
      icon={Eye}
      onClick={viewReference}
      disabled={!canView}
      aria-label="View document"
      title={canView ? `View document: ${reference}` : "No document reference recorded yet"}
      className="shrink-0"
    />
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
        className="btn-icon cursor-pointer text-brand-700 hover:bg-brand-50"
        title="Upload PDF"
        aria-label="Upload PDF"
      >
        <FileUp className="h-4 w-4" />
        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => submit(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-1 max-w-32 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

// Each log becomes one history entry: what happened, who did it and who has it next, when, and the notes.
const logEntry = (log) => ({
  id: log.id,
  title: log.result,
  at: log.created_at,
  actor: `${log.actor_role} - next: ${log.next_owner || "Pending"}`,
  note: log.notes,
});

export function ActivityPanel({ logs }) {
  const visibleLogs = logs || [];
  return (
    <Card pad="lg">
      <SectionTitle title="Activity History" subtitle="Submissions, decisions, and next owners" icon={Activity} />
      {visibleLogs.length ? (
        <HistoryPanel label="View logs" hideLabel="Hide logs" entries={visibleLogs.map(logEntry)} sort="given" />
      ) : (
        <EmptyState title="No activity yet" />
      )}
    </Card>
  );
}
