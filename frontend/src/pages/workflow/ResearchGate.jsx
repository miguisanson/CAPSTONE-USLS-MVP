import { useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck, CheckCircle2, ArrowUpRight, UserRoundCheck } from "lucide-react";
import { SectionTitle, StatusBadge } from "../../components/ui";
import { Field, Input, Select } from "../../components/forms";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../auth";
import { Form1EndorsementQueue } from "../Form1Endorsements";
import { MiniBox, SubmitButton, WorkflowSubmitFeedback } from "./shared";

// ---------------------------------------------------------------------------
// Research Gate
// ---------------------------------------------------------------------------
export function ResearchGateForm({ context, studentId, submit, submitting, result, submitError }) {
  const { user } = useAuth();
  const student = context.selected_student || {};
  const researchCase = context.research_case || {};
  const progress = context.research_progress || {};
  const milestone = context.current_milestone || progress.milestone || {};
  const requirements = milestone.requirements || [];
  const [ethicsReview, setEthicsReview] = useState({ status: "Cleared", date: new Date().toISOString().slice(0, 10) });
  const completed = requirements.filter((item) => item.status === "Complete");
  const pending = requirements.filter((item) => item.status !== "Complete");
  const panel = context.panel_status || {};
  const scheduleRequirement = requirements.find((item) => item.source_type?.includes("schedule"));
  const outcomeRequirement = requirements.find((item) => item.source_type === "system_defense_result");

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId });
  }

  function recordEthicsClearance() {
    submit({
      student_id: studentId,
      ethics_clearance_status: ethicsReview.status,
      ethics_clearance_date: ethicsReview.date,
    });
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
                  {requirement.item_name === "Ethics Clearance" && user?.role === "research_coordinator" && (
                    <button type="button" disabled={!requirement.files?.length} onClick={() => document.getElementById("ethics-clearance-record")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="btn-ghost cursor-pointer justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
                      <FileCheck className="h-4 w-4" /> Record clearance
                    </button>
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

      {requirements.some((item) => item.item_name === "Ethics Clearance") && (
        <section id="ethics-clearance-record" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Research Protocol Form 5.2 ethics clearance</p>
              <p className="mt-1 text-xs text-slate-500">Opens after the proposal defense is passed. Preview Form 5.1 and the signed Ethics Office form (Form 5.2, due within one month of the defense), then record the clearance status and date. Ethics clearance is needed before the Final Defense.</p>
            </div>
            <StatusBadge value={requirements.find((item) => item.item_name === "Ethics clearance status and date")?.status_label || "Pending"} dot={false} />
          </div>
          {user?.role === "research_coordinator" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Clearance status">
                <Select value={ethicsReview.status} onChange={(event) => setEthicsReview((current) => ({ ...current, status: event.target.value }))} options={["Cleared", "Returned", "Not cleared"]} />
              </Field>
              <Field label="Clearance date">
                <Input type="date" value={ethicsReview.date} onChange={(event) => setEthicsReview((current) => ({ ...current, date: event.target.value }))} />
              </Field>
              <button type="button" disabled={submitting} onClick={recordEthicsClearance} className="btn-primary mt-6 cursor-pointer px-4 py-2">
                <CheckCircle2 className="h-4 w-4" /> Record ethics clearance
              </button>
            </div>
          )}
        </section>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Panel Matching</p><p className="text-xs text-slate-500">System-generated from the active paper body after required clearances.</p></div>
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
          {user?.role === "staff" && <p className="mt-4 text-xs font-semibold text-slate-600">Read-only for GS staff. The assigned panel chair or panel lead submits the verdict from the Faculty Portal.</p>}
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
