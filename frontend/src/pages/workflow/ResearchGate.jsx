import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Clock, FileCheck, UserRoundCheck } from "lucide-react";
import { Button, Card, Field, Input, SectionTitle, Select, StatCard, Stepper, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import { toneOf } from "../../lib/tone";
import { useAuth } from "../../auth";
import { Form1EndorsementQueue } from "../Form1Endorsements";
import { SubmitButton, WorkflowSubmitFeedback } from "./shared";

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
  const stageSteps = (progress.stages || []).map((stage, index) => ({
    key: stage.name,
    label: stage.name,
    hint: stage.status,
    state: index === progress.stage_index ? "current" : stage.complete ? "complete" : "upcoming",
  }));

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
          <StatCard key={label} size="sm" tone="neutral" label={label} value={value} />
        ))}
      </div>

      <Stepper title="Automatic research progress" steps={stageSteps} />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard size="sm" tone="success" icon={CheckCircle2} label="Completed requirements" value={completed.length} />
        <StatCard size="sm" tone={pending.length ? "warning" : "success"} icon={pending.length ? Clock : CheckCircle2} label="Pending requirements" value={pending.length} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="field-label">{progress.stage || "Current"} requirements</p>
            <p className="meta">Uploaded and pending documents appear together. Open any file to preview it.</p>
          </div>
          <StatusChip status={progress.status || "Pending"} dot={false} />
        </div>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {requirements.map((requirement) => (
            <li key={requirement.item_name} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                  <p className="meta mt-0.5">{requirement.description}</p>
                  <p className="micro mt-1 font-medium uppercase tracking-wide">{requirement.student_upload ? `Student upload · ${requirement.file_count}/${requirement.required_file_count} files` : "Staff / system managed"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <StatusChip status={requirement.status_label} dot={false} />
                  {requirement.source_type === "coordinator_endorsement" && user?.role === "academic_coordinator" && (
                    <Button as="a" href="#form1-endorsement-queue" icon={UserRoundCheck} className="justify-center whitespace-nowrap">
                      Form 1 endorsements
                    </Button>
                  )}
                  {requirement.item_name === "Ethics Clearance" && user?.role === "research_coordinator" && (
                    <Button
                      variant="secondary"
                      icon={FileCheck}
                      disabled={!requirement.files?.length}
                      onClick={() => document.getElementById("ethics-clearance-record")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="justify-center whitespace-nowrap"
                    >
                      Record clearance
                    </Button>
                  )}
                </div>
              </div>
              {(requirement.files || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {requirement.files.map((file) => (
                    <Button key={file.id} as="a" href={file.url} target="_blank" rel="noreferrer" variant="secondary" size="sm" className="border-brand-200 text-brand-700">
                      {file.name} · PDF · {formatDate(file.uploaded_at)} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {requirements.some((item) => item.item_name === "Ethics Clearance") && (
        <Card as="section" id="ethics-clearance-record" pad="sm" className="bg-slate-50 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Research Protocol Form 5.2 ethics clearance</p>
              <p className="meta mt-1">Opens after the proposal defense is passed. Preview Form 5.1 and the signed Ethics Office form (Form 5.2, due within one month of the defense), then record the clearance status and date. Ethics clearance is needed before the Final Defense.</p>
            </div>
            <StatusChip status={requirements.find((item) => item.item_name === "Ethics clearance status and date")?.status_label || "Pending"} dot={false} />
          </div>
          {user?.role === "research_coordinator" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Clearance status">
                <Select value={ethicsReview.status} onChange={(event) => setEthicsReview((current) => ({ ...current, status: event.target.value }))} placeholder="" options={["Cleared", "Returned", "Not cleared"]} />
              </Field>
              <Field label="Clearance date">
                <Input type="date" value={ethicsReview.date} onChange={(event) => setEthicsReview((current) => ({ ...current, date: event.target.value }))} />
              </Field>
              <Button disabled={submitting} onClick={recordEthicsClearance} icon={CheckCircle2}>
                Record ethics clearance
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card pad="sm" className="bg-slate-50 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Panel Matching</p>
            <p className="meta">System-generated from the active paper body after required clearances.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={panel.status || "Not yet generated"} dot={false} />
            <Button as={Link} to={`/workflow/panel-matching?student_id=${studentId}`} variant="secondary">
              Open matching <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        {panel.recommendations?.length > 0 && <p className="meta mt-2 text-slate-600">{panel.recommendations.map((item) => item.faculty_name).filter(Boolean).join(" · ")}</p>}
      </Card>

      <SubmitButton submitting={submitting}>Verify submitted requirements</SubmitButton>
      <WorkflowSubmitFeedback result={result} error={submitError} />

      {outcomeRequirement && (
        <section className={`rounded-2xl border p-4 sm:p-5 ${toneOf(outcomeRequirement.status === "Complete" ? "success" : "warning").notice}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Defense result gate</p>
              <h3 className="card-title mt-1">{outcomeRequirement.label}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {scheduleRequirement?.status === "Complete"
                  ? "Record whether the scheduled defense was passed before the student can move to the next Research Gate stage."
                  : "Confirm the defense schedule first. The student cannot move to the next Research Gate stage until a passing result is recorded."}
              </p>
            </div>
            <StatusChip status={outcomeRequirement.status_label} dot={false} />
          </div>
          {user?.role === "staff" && <p className="mt-4 text-xs font-semibold text-slate-600">Read-only for GS staff. The assigned panel chair or panel lead submits the verdict from the Faculty Portal.</p>}
        </section>
      )}

      {user?.role === "academic_coordinator" && (
        <Card as="section" id="form1-endorsement-queue" pad="lg" className="scroll-mt-24">
          <Form1EndorsementQueue embedded />
        </Card>
      )}
    </form>
  );
}
