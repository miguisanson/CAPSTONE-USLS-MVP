import { useEffect, useState } from "react";
import {
  CalendarClock,
  LogOut,
} from "lucide-react";
import { api } from "../../api";
import { ErrorNote, StatusBadge } from "../../components/ui";
import { useConfirm } from "../../components/confirm";
import { Field, Select, Textarea } from "../../components/forms";
import { formatDate } from "../../lib/format";
import WorkflowTimeline, { withdrawalTimelineSteps, loaTimelineSteps } from "../../components/WorkflowTimeline";
import { useSubmitRequest, StageCard, SavedWorkflowFiles, SubmitState } from "./shared";

export function LoaRequestForm({ data, semesters = [], onSaved }) {
  const studentId = data.student.id;
  const confirm = useConfirm();
  const onLeave = data.student.standing === "On Leave" || data.student.enrollment_tag === "LOA" || data.student.current_stage === "LOA";
  const latestLoaLog = (data.logs || []).find((item) => item.transaction_slug === "leave-of-absence");
  const [form, setForm] = useState({
    effective_start: "",
    effective_end: "",
    reason_category: "",
    reason_remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("leave-of-absence", onSaved);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  // The structured request is recorded in the workflow log. The student's
  // standing remains the source of truth for an approved leave.
  const status = onLeave
    ? "On Leave"
    : latestLoaLog?.new_status || (latestLoaLog?.result === "LOA application submitted" ? "Submitted" : "Not Submitted");
  const loaSteps = loaTimelineSteps(status);
  const applicationEditable = !onLeave && ["Not Submitted", "Denied", "Returned", "Returned for Revision", "Withdrawn"].includes(status);
  const canWithdraw = ["Submitted", "Dean Review"].includes(status);

  async function withdrawPendingApplication() {
    const accepted = await confirm({
      title: "Withdraw pending LOA application?",
      message: "This stops the current review before the Dean decides. It does not change your academic standing, and you may submit a new application.",
      confirmLabel: "Withdraw application",
      tone: "danger",
    });
    if (!accepted) return;
    setWithdrawing(true);
    setWithdrawError("");
    try {
      await api.withdrawStudentLoaRequest();
      await onSaved();
    } catch (err) {
      setWithdrawError(err.message || "Could not withdraw the application.");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="space-y-4">
      <WorkflowTimeline steps={loaSteps} title="Leave of Absence timeline" />

      <StageCard
        number={1}
        title="Leave of Absence Application"
        state={applicationEditable ? "active" : "complete"}
        helper={applicationEditable
          ? "Complete the structured fields below. No PDF upload or RAG document extraction is required."
          : onLeave ? "Your leave application is approved and your studies are paused." : "Your structured application is saved and awaiting the next reviewer."}
      >
        {applicationEditable ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Leave starts (semester)" required>
                <Select value={form.effective_start} onChange={(event) => setForm((current) => ({ ...current, effective_start: event.target.value, effective_end: current.effective_end || event.target.value }))} placeholder="Select semester" options={semesters} required />
              </Field>
              <Field label="Leave ends (semester)" required>
                <Select value={form.effective_end} onChange={set("effective_end")} placeholder="Select semester" options={semesters} required />
              </Field>
            </div>
            <Field label="Reason category" required>
              <Select value={form.reason_category} onChange={set("reason_category")} placeholder="Choose an allowed reason" options={data.loa_allowed_reasons || []} required />
            </Field>
            <Field label="Circumstances / remarks" required>
              <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} required />
            </Field>
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800"><span className="font-semibold">Policy format:</span> one or two consecutive semesters, beginning in the upcoming semester or later. Staff run a deterministic checklist before forwarding the request to the Dean.</div>
            <SubmitState busy={busy} error={error} message={message} disabled={!form.effective_start || !form.effective_end || !form.reason_category || !form.reason_remarks.trim()} disabledHint="Complete all structured LOA fields before submitting." label="Submit LOA application" />
          </form>
        ) : null}
        {canWithdraw && (
          <div className="space-y-2">
            <button type="button" onClick={withdrawPendingApplication} disabled={withdrawing} className="btn-ghost cursor-pointer text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> {withdrawing ? "Withdrawing…" : "Withdraw pending application"}
            </button>
            <ErrorNote message={withdrawError} />
          </div>
        )}
      </StageCard>

      <StageCard
        number={2}
        title="Staff Intake and Dean Review"
        state={onLeave ? "complete" : "pending"}
        helper={onLeave
          ? "Graduate School staff checked eligibility, the Dean approved the leave, and your standing was updated."
          : "After you submit, Graduate School staff check your LOA eligibility and forward it to the Dean for a decision."}
      />

      <StageCard
        number={3}
        title="On Leave Status"
        state={onLeave ? "complete" : "locked"}
        helper={onLeave
          ? "Your status is On Leave. When your leave ends, open Readmission to return to active status."
          : "Your record changes to On Leave when the Dean approves the request."}
      />
    </div>
  );
}

export function ReadmissionRequestForm({ data, onSaved }) {
  const requirements = data.readmission_requirements || [];
  const semesters = data.future_semesters || [];
  const allSemesters = data.semester_options || [];
  const [form, setForm] = useState({
    target_return_term: "",
    previous_loa_start: "",
    previous_loa_end: "",
    return_intent: "",
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const { busy, error, message, submit } = useSubmitRequest("readmission", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form, readmission_items: selectedItems });
  }

  const toggleItem = (item) => setSelectedItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const complete = Boolean(
    form.target_return_term
    && form.previous_loa_start
    && form.previous_loa_end
    && form.return_intent.trim()
    && requirements.every((item) => selectedItems.includes(item))
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Return semester" required>
          <Select value={form.target_return_term} onChange={set("target_return_term")} placeholder="Select semester" options={semesters} required />
        </Field>
        <Field label="Previous LOA start" required>
          <Select value={form.previous_loa_start} onChange={(event) => setForm((current) => ({ ...current, previous_loa_start: event.target.value, previous_loa_end: current.previous_loa_end || event.target.value }))} placeholder="Select semester" options={allSemesters} required />
        </Field>
        <Field label="Previous LOA end" required>
          <Select value={form.previous_loa_end} onChange={set("previous_loa_end")} placeholder="Select semester" options={allSemesters} required />
        </Field>
      </div>
      <Field label="Intention and readiness to resume studies" required>
        <Textarea value={form.return_intent} onChange={set("return_intent")} placeholder="State that you intend to return and briefly explain your readiness to continue the program." required />
      </Field>
      {requirements.length > 0 && (
        <div>
          <p className="field-label">Readmission checklist</p>
          <div className="mt-2 space-y-1.5">
            {requirements.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={selectedItems.includes(item)} onChange={() => toggleItem(item)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                {item}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">This structured form is checked with fixed rules. It does not upload or analyze a letter with RAG.</div>
      <SubmitState busy={busy} error={error} message={message} disabled={!complete} disabledHint={!complete ? "Complete the semester fields, return intention, and every checklist item." : ""} label="Submit readmission request" />
    </form>
  );
}

export function AwolReturnRequestForm({ data, onSaved }) {
  const existing = data.awol_case;
  const student = data.student;
  const semesters = data.upcoming_semesters || [];
  const allSemesters = data.semester_options || [];
  const [form, setForm] = useState({
    target_return_term: "",
    last_enrolled_term: existing?.last_enrolled_term || "",
    return_intent: existing?.return_intent || "",
    return_reason: existing?.return_reason || "",
  });
  const { busy, error, message, submit } = useSubmitRequest("awol-return", onSaved);
  const locked = existing && ["Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"].includes(existing.status);

  function onSubmit(event) {
    event.preventDefault();
    submit({ student_id: data.student.id, ...form });
  }

  return (
    <div className="space-y-4">
      {existing && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Current AWOL return case</p><p className="mt-1 text-xs text-slate-500">{existing.policy_classification || "Policy review pending"}</p></div><StatusBadge value={existing.status} dot={false} /></div>
          {existing.years_in_program !== null && existing.years_in_program !== undefined && <p className="mt-3 text-sm text-slate-600">Years in program: {existing.years_in_program} · normal limit {existing.normal_residence_years} · absolute limit {existing.absolute_residence_years}</p>}
          {existing.detection_source && <p className="mt-2 text-xs text-slate-500">Detected from: {existing.detection_source}</p>}
        </div>
      )}
      {(student.standing === "AWOL" || student.enrollment_tag === "AWOL") && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Your record was automatically flagged AWOL from an official standing or full-semester withdrawal without approved LOA. Registration privileges remain restricted until your return request is reviewed.
        </div>
      )}
      {student.enrollment_tag === "Residency" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          You are enrolled in residency without subjects for an approved academic purpose. Check the workflow status for the recorded semester and purpose.
        </div>
      )}
      {locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your structured return declaration has already been routed for review. Watch the Inbox for the Dean's decision or a revision request.</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            The handbook requires a written intention to enroll routed through the Graduate School Dean. Complete it here as structured fields; no PDF upload or RAG analysis is used.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intended return semester" required><Select value={form.target_return_term} onChange={(event) => setForm((current) => ({ ...current, target_return_term: event.target.value }))} placeholder="Select semester" options={semesters} required /></Field>
            <Field label="Last enrolled semester"><Select value={form.last_enrolled_term} onChange={(event) => setForm((current) => ({ ...current, last_enrolled_term: event.target.value }))} placeholder="Select semester" options={allSemesters} /></Field>
          </div>
          <Field label="Written intention to resume enrollment" required><Textarea value={form.return_intent} onChange={(event) => setForm((current) => ({ ...current, return_intent: event.target.value }))} placeholder="I intend to resume enrollment in the selected semester…" required /></Field>
          <Field label="Reason for returning and readiness to continue" required><Textarea value={form.return_reason} onChange={(event) => setForm((current) => ({ ...current, return_reason: event.target.value }))} required /></Field>
          <SubmitState busy={busy} error={error} message={message} disabled={!form.target_return_term || !form.return_intent.trim() || !form.return_reason.trim()} disabledHint={!form.target_return_term ? "Choose your intended return semester." : "Complete the written intention and return reason."} label={existing?.status === "Returned for Revision" ? "Resubmit return declaration" : "Submit return declaration"} />
        </form>
      )}
    </div>
  );
}

export function WithdrawalRequestForm({ data, onSaved }) {
  const existing = data.withdrawal_application;
  const activeSubjects = (data.subject_enrollments || []).filter((item) => ["Enrolled", "Current"].includes(item.status));
  const eligibleSubjects = activeSubjects.filter((item) => item.withdrawal_eligible);
  const [form, setForm] = useState({
    reason: existing?.reason || "",
    subject_enrollment_id: existing?.subject_enrollment_id || eligibleSubjects[0]?.id || "",
  });
  const { busy, error, message, submit } = useSubmitRequest("withdrawal", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form });
  }

  const status = existing?.status || "Not Submitted";
  const returned = ["Returned", "Returned for Clarification"].includes(status) && existing?.dean_decision !== "Approved";
  const applicationEditable = !existing || returned;
  const denied = existing?.dean_decision === "Denied" || status === "Denied";
  const staffForwarded = !["Not Submitted", "Submitted to GS Staff", "Returned", "Returned for Clarification"].includes(status);
  const deanPending = status === "Dean Review";
  const deanApproved = existing?.dean_decision === "Approved";
  const subjectTagged = ["Subject Tagged - Registrar Preparation", "Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"].includes(status);
  const excelReady = ["Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"].includes(status);
  const registrarAcknowledged = status === "Withdrawn Confirmed";
  const selectedSubject = activeSubjects.find((item) => String(item.id) === String(form.subject_enrollment_id));
  const withdrawalSteps = withdrawalTimelineSteps(status);

  useEffect(() => {
    setForm({
      reason: existing?.reason || "",
      subject_enrollment_id: existing?.subject_enrollment_id || eligibleSubjects[0]?.id || "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at, eligibleSubjects[0]?.id]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current subject withdrawal stage</p><p className="mt-1 text-xs text-slate-500">This process applies to one subject only and never changes your active program standing.</p></div><StatusBadge value={status} dot={false} /></div></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">Penalty-free withdrawal window</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">You may withdraw before classes begin or during the first seven calendar days of class. Once approved and forwarded, the subject carries no grade, academic penalty, or transcript mark.</p>
      </div>
      <StageCard number={1} title="Send Withdrawal Request" state={applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={applicationEditable ? "Choose one eligible enrolled subject and state the reason for withdrawing." : "Your selected subject and reason are saved and read-only."}>
        {applicationEditable ? (
          <div className="space-y-4">
            <Field label="Enrolled subject" required>
              <select className="field-input cursor-pointer" value={form.subject_enrollment_id} onChange={set("subject_enrollment_id")} required>
                <option value="">Choose an eligible enrolled subject</option>
                {activeSubjects.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.withdrawal_eligible}>
                    {item.course_code} — {item.course_title} · {item.term_label}
                    {item.withdrawal_eligible ? ` · ELIGIBLE UNTIL ${item.withdrawal_window?.deadline || "semester deadline"}` : " · WITHDRAWAL WINDOW CLOSED"}
                  </option>
                ))}
              </select>
              {selectedSubject?.withdrawal_window && (
                <div
                  role="status"
                  className={`mt-3 flex items-start gap-3 rounded-xl border px-4 py-4 ${
                    selectedSubject.withdrawal_eligible
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-red-300 bg-red-50 text-red-950"
                  }`}
                >
                  <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${selectedSubject.withdrawal_eligible ? "text-emerald-700" : "text-red-700"}`} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">
                      {selectedSubject.withdrawal_eligible ? "Penalty-free withdrawal deadline" : "Withdrawal availability"}
                    </p>
                    <p className="mt-1 text-lg font-extrabold leading-tight">
                      {selectedSubject.withdrawal_eligible
                        ? `Eligible until ${formatDate(selectedSubject.withdrawal_window.deadline)}`
                        : "Withdrawal window closed"}
                    </p>
                    <p className="mt-1 text-xs font-semibold opacity-80">
                      {selectedSubject.withdrawal_window.status}
                      {selectedSubject.withdrawal_window.term_start_date
                        ? ` · Classes begin ${formatDate(selectedSubject.withdrawal_window.term_start_date)}`
                        : ""}
                    </p>
                  </div>
                </div>
              )}
              {!eligibleSubjects.length && <p role="alert" className="mt-2 text-xs font-semibold text-amber-700">No active subject is currently inside the penalty-free withdrawal window. Contact Graduate School staff if the recorded semester dates are incorrect.</p>}
            </Field>
            <Field label="Reason for withdrawing from this subject" required>
              <Textarea value={form.reason} onChange={set("reason")} required />
            </Field>
            <SubmitState
              busy={busy}
              error={error}
              message={message}
              disabled={!form.subject_enrollment_id || !selectedSubject?.withdrawal_eligible}
              disabledHint={!eligibleSubjects.length ? "No subject is currently eligible for penalty-free withdrawal." : !form.subject_enrollment_id ? "Choose an eligible enrolled subject before submitting." : ""}
              label={returned ? "Resubmit subject withdrawal" : "Send withdrawal request"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">{existing?.subject?.course_code || "Subject pending"} — {existing?.subject?.course_title || "Selected subject"}</p>
            <p className="text-sm text-slate-600">{existing?.effective_term || existing?.subject?.term_label || "Semester pending"} · submitted {formatDate(existing?.created_at)}</p>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-950">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Eligibility recorded at submission</p>
                <p className="mt-1 text-base font-extrabold">Eligible until {formatDate(existing?.withdrawal_window?.deadline)}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">{existing?.withdrawal_window?.status || "Penalty-free eligibility recorded"}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">{existing?.reason || "No reason recorded."}</p>
          </div>
        )}
      </StageCard>
      <StageCard number={2} title="GS Staff Forwards Request to Dean" state={status === "Submitted to GS Staff" ? "pending" : staffForwarded || denied ? "complete" : returned ? "returned" : "locked"} helper={status === "Submitted to GS Staff" ? "Graduate School staff is recording your structured request and forwarding it to the Dean." : staffForwarded || denied ? "Graduate School staff forwarded the request to the Dean." : "Available after Step 1 is submitted."} />
      <StageCard number={3} title="Dean Reviews Request" state={denied ? "rejected" : deanPending ? "pending" : deanApproved ? "complete" : "locked"} helper={denied ? "The Dean denied this request. The subject remains enrolled and your record is unchanged." : deanPending ? "The Dean is reviewing the selected subject, request date, and eligibility window." : deanApproved ? "The Dean approved the request and returned it to Graduate School staff for subject tagging." : "Available after GS Staff forwards the request."} />
      <StageCard number={4} title="GS Staff Tags Subject as Withdrawn" state={subjectTagged ? "complete" : deanApproved ? "pending" : "locked"} helper={subjectTagged ? `${existing?.subject?.course_code || "The selected subject"} now shows Withdrawn in Official Offered Subjects, with no grade or academic penalty. Your other subjects and active program standing remain unchanged.` : deanApproved ? "Graduate School staff must tag you as Withdrawn from the selected subject before any Registrar Excel list can be prepared." : denied ? "This step does not open for a denied request." : "Available after Dean approval."} />
      <StageCard number={5} title="GS Staff Exports Approved Excel List" state={excelReady ? "complete" : subjectTagged ? "pending" : "locked"} helper={excelReady ? "Your tagged withdrawal was included in the Excel list for the Registrar." : subjectTagged ? "The official subject status is updated, so Graduate School staff can now prepare the Excel list." : "Available after GS Staff tags the selected subject as Withdrawn."} />
      <StageCard number={6} title="GS Staff Emails Update and Waits for Acknowledgement" state={registrarAcknowledged ? "complete" : excelReady ? "pending" : "locked"} helper={registrarAcknowledged ? "Registrar acknowledgement was recorded." : excelReady ? "Graduate School staff must email the downloaded Excel list through the official channel and wait for the Registrar's acknowledgement. The portal does not send this email." : "Available after the approved list is exported."} />
      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} />}
      <WorkflowTimeline steps={withdrawalSteps} title="Detailed withdrawal timeline" />
    </form>
  );
}
