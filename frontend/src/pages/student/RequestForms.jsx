import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { InlineNotice, StatusBadge } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import { formatDate } from "../../lib/format";
import WorkflowTimeline, { withdrawalTimelineSteps } from "../../components/WorkflowTimeline";
import { useSubmitRequest, StageCard, SavedWorkflowFiles, SubmitState } from "./shared";
import {
  EarlierCases,
  LOA_KINDS,
  LeaveBanner,
  LeaveCaseCard,
  LeaveReasonNote,
  OPEN_LEAVE_STATUSES,
  READMISSION_KINDS,
  pluralize,
  splitLeaveCases,
} from "./LeaveCaseCards";

// ---- Leave of Absence and leave extension ------------------------------------------------

// A leave that starts in the second half of a running semester marks the subjects W with no refund.
const FILING_WARNING = /marked W|refund/i;

function semesterOption(option) {
  const state = option.state === "Running" ? "Running" : "Upcoming";
  return { value: option.label, label: `${option.label} · ${state} (${formatDate(option.start_date)} to ${formatDate(option.end_date)})` };
}

// A returned request may name a semester that is no longer in the list; keep it selectable so the form still shows it.
function withCurrentValue(options, value) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: `${value} (your earlier choice)` }];
}

function SuccessNote({ message }) {
  if (!message) return null;
  return <InlineNotice>{message}</InlineNotice>;
}

export function LoaRequestForm({ data, onSaved }) {
  const submitState = useSubmitRequest("leave-of-absence", onSaved);
  const overview = data.leave_overview;
  if (!overview) {
    return <LeaveReasonNote>Your leave information could not be loaded. Please refresh the page.</LeaveReasonNote>;
  }
  const cases = overview.cases || [];
  const { shown, earlier } = splitLeaveCases(overview, LOA_KINDS);
  const editable = cases.find((item) => item.editable && LOA_KINDS.includes(item.kind)) || null;
  const canFile = overview.can_file || {};
  let mode = null;
  if (editable) mode = editable.kind === "LOA_EXTENSION" ? "extension" : "new";
  else if (canFile.extension?.allowed) mode = "extension";
  else if (canFile.loa?.allowed) mode = "new";
  const parentId = editable?.linked_case?.id ?? canFile.extension?.parent_case_id ?? overview.active_case_id ?? null;
  const parent = mode === "extension" ? cases.find((item) => item.id === parentId) || null : null;
  const requestInProgress = shown.some((item) => OPEN_LEAVE_STATUSES.includes(item.status));
  const leaveRunning = shown.some((item) => ["Leave Scheduled", "On Leave", "Return Due"].includes(item.status));
  const reason = requestInProgress ? "" : (leaveRunning ? canFile.extension?.reason : "") || canFile.loa?.reason || "";

  return (
    <div className="space-y-4">
      <LeaveBanner banner={overview.banner} />
      {mode === null && <SuccessNote message={submitState.message} />}
      {shown.map((item) => (
        <LeaveCaseCard key={item.id} item={item} onChanged={onSaved} />
      ))}
      {mode !== null ? (
        <LoaForm
          key={`${mode}-${editable?.id || "new"}`}
          data={data}
          overview={overview}
          mode={mode}
          editable={editable}
          parent={parent}
          submitState={submitState}
        />
      ) : (
        <LeaveReasonNote>{reason}</LeaveReasonNote>
      )}
      <EarlierCases cases={earlier} onChanged={onSaved} />
    </div>
  );
}

function LoaForm({ data, overview, mode, editable, parent, submitState }) {
  const { busy, error, message, submit } = submitState;
  const extension = mode === "extension";
  const all = overview.loa_semester_options || [];
  const rules = overview.rules || {};
  const maxPeriod = Number(rules.max_period_semesters) || 0;
  const maxTotal = Number(rules.max_total_semesters) || 0;
  const remaining = Number(overview.can_file?.extension?.remaining_semesters) || 0;
  const parentEnd = extension ? parent?.period?.end_date : null;
  // An extension always starts the semester right after the current leave ends.
  const startChoices = extension && parentEnd ? all.filter((option) => option.start_date > parentEnd).slice(0, 1) : all;
  const span = maxPeriod > 0 ? (extension && remaining > 0 ? Math.min(maxPeriod, remaining) : maxPeriod) : all.length;

  const [form, setForm] = useState(() => ({
    effective_start: editable?.period?.start_label || (extension && startChoices.length === 1 ? startChoices[0].label : ""),
    effective_end: editable?.period?.end_label || (extension && startChoices.length === 1 ? startChoices[0].label : ""),
    reason_category: editable?.reason_category || "",
    reason_remarks: editable?.reason_text || "",
  }));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const startIndex = all.findIndex((option) => option.label === form.effective_start);
  const endIndex = all.findIndex((option) => option.label === form.effective_end);
  const startOption = startIndex >= 0 ? all[startIndex] : null;
  const endChoices = startIndex >= 0 ? all.slice(startIndex, startIndex + span) : [];
  const startOptions = withCurrentValue(startChoices.map(semesterOption), form.effective_start);
  const endOptions = withCurrentValue(endChoices.map(semesterOption), form.effective_end);
  const semesterCount = startIndex >= 0 && endIndex >= startIndex ? endIndex - startIndex + 1 : 0;

  function changeStart(event) {
    const value = event.target.value;
    const index = all.findIndex((option) => option.label === value);
    const allowed = index >= 0 ? all.slice(index, index + span).map((option) => option.label) : [];
    setForm((current) => ({
      ...current,
      effective_start: value,
      effective_end: allowed.includes(current.effective_end) ? current.effective_end : value,
    }));
  }

  // The filing-date rule applies to a new leave, not to more time on a leave that already runs.
  const filingFail = !extension && startOption?.filing_status === "Fail";
  const filingWarning = !extension && startOption?.state === "Running" && startOption.filing_status === "Pass" && FILING_WARNING.test(startOption.filing_detail || "");
  const noLaterSemester = extension && Boolean(parentEnd) && startChoices.length === 0;
  const incomplete = !form.effective_start || !form.effective_end || !form.reason_category || !form.reason_remarks.trim();
  const disabled = incomplete || filingFail || noLaterSemester;

  let hint = "";
  if (noLaterSemester) hint = "No later semester is set up yet. Please ask Graduate School staff.";
  else if (filingFail) hint = "You cannot send this request for the semester you chose. Choose another semester.";
  else if (incomplete) hint = "Choose the semesters, a reason, and explain your situation before sending.";

  const rulesText = [
    maxPeriod > 0 ? `A leave can last up to ${pluralize(maxPeriod, "semester")} at a time.` : "",
    "It can be renewed once.",
    maxTotal > 0 ? `All your leave together can never be more than ${pluralize(maxTotal, "semester")}.` : "",
  ].filter(Boolean).join(" ");

  const title = editable ? "Correct your request and send it again" : extension ? "Ask for more time" : "Ask for a leave of absence";
  const label = editable ? "Send again" : extension ? "Send request for more time" : "Submit leave request";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label={title}>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {editable
          ? "Change what the comment above asks for, then send your request again."
          : extension
            ? `Your leave can be renewed once, and never beyond ${maxTotal > 0 ? pluralize(maxTotal, "semester") : "the total the handbook allows"} in all. The extra time starts in the semester after your current leave ends${parentEnd ? ` (${formatDate(parentEnd)})` : ""}.`
            : "Choose the semesters you want to be away and tell us why. Graduate School staff check your request first, then the Dean decides."}
      </p>
      {!(extension && !editable) && <p className="mt-1 text-sm text-slate-600">{rulesText}</p>}
      {extension && !editable && remaining > 0 && <p className="mt-1 text-sm text-slate-600">You can ask for up to {pluralize(span, "more semester")} now.</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit({
            effective_start: form.effective_start,
            effective_end: form.effective_end,
            reason_category: form.reason_category,
            reason_remarks: form.reason_remarks,
          });
        }}
        className="mt-4 space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={extension ? "Extra time starts" : "Leave starts"} required>
            <Select value={form.effective_start} onChange={changeStart} placeholder="Choose a semester" options={startOptions} required />
          </Field>
          <Field label={extension ? "Extra time ends" : "Leave ends"} required hint={semesterCount ? `That is ${pluralize(semesterCount, "semester")}.` : ""}>
            <Select value={form.effective_end} onChange={set("effective_end")} placeholder={startIndex >= 0 ? "Choose a semester" : "Choose when it starts first"} options={endOptions} disabled={startIndex < 0 && !form.effective_end} required />
          </Field>
        </div>

        {filingFail && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {startOption.filing_detail}
          </div>
        )}
        {filingWarning && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-bold">Please read before you send this request</p>
            <p className="mt-1">{startOption.filing_detail}</p>
          </div>
        )}

        <Field label="Reason" required>
          <Select value={form.reason_category} onChange={set("reason_category")} placeholder="Choose a reason" options={data.loa_allowed_reasons || []} required />
        </Field>
        <Field label="Tell us what is happening" required>
          <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} placeholder="Explain your situation in a few sentences." required />
        </Field>
        <SubmitState busy={busy} error={error} message={message} disabled={disabled} disabledHint={hint} label={label} />
      </form>
    </section>
  );
}

// ---- Readmission -------------------------------------------------------------------------

export function ReadmissionRequestForm({ data, onSaved }) {
  const submitState = useSubmitRequest("readmission", onSaved);
  const overview = data.leave_overview;
  if (!overview) {
    return <LeaveReasonNote>Your leave information could not be loaded. Please refresh the page.</LeaveReasonNote>;
  }
  const cases = overview.cases || [];
  const { shown, earlier } = splitLeaveCases(overview, READMISSION_KINDS);
  const editable = cases.find((item) => item.editable && READMISSION_KINDS.includes(item.kind)) || null;
  const can = overview.can_file?.readmission || {};
  const showForm = Boolean(can.allowed) || Boolean(editable);
  const requestInProgress = shown.some((item) => OPEN_LEAVE_STATUSES.includes(item.status));
  const reason = requestInProgress ? "" : can.reason || "Readmission is for students on an approved leave of absence.";

  return (
    <div className="space-y-4">
      <LeaveBanner banner={overview.banner} />
      {!showForm && <SuccessNote message={submitState.message} />}
      {shown.map((item) => (
        <LeaveCaseCard key={item.id} item={item} onChanged={onSaved} />
      ))}
      {showForm ? (
        <ReadmissionForm
          key={editable?.id || "new"}
          data={data}
          overview={overview}
          can={can}
          editable={editable}
          submitState={submitState}
        />
      ) : (
        <LeaveReasonNote>{reason}</LeaveReasonNote>
      )}
      <EarlierCases cases={earlier} onChanged={onSaved} />
    </div>
  );
}

function ReadmissionForm({ data, overview, can, editable, submitState }) {
  const { busy, error, message, submit } = submitState;
  const requirements = data.readmission_requirements || [];
  const previousSemesters = data.semester_options || [];
  const needsPreviousLeave = !can.linked_case_id;
  const returnOptions = withCurrentValue(
    (overview.return_semester_options || []).map((name) => ({ value: name, label: name })),
    editable?.target_term || "",
  );
  const [form, setForm] = useState(() => ({
    target_return_term: editable?.target_term || "",
    return_intent: editable?.return_intent || "",
    previous_loa_start: editable?.period?.start_label || "",
    previous_loa_end: editable?.period?.end_label || "",
  }));
  const [selectedItems, setSelectedItems] = useState(() => (
    editable
      ? requirements.filter((item) => (editable.checklist || []).some((entry) => entry.item === item && entry.checked))
      : []
  ));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggleItem = (item) => setSelectedItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));

  const checklistDone = requirements.every((item) => selectedItems.includes(item));
  const complete = Boolean(
    form.target_return_term
    && form.return_intent.trim()
    && checklistDone
    && (!needsPreviousLeave || (form.previous_loa_start && form.previous_loa_end)),
  );
  let hint = "";
  if (!complete) {
    hint = !form.target_return_term
      ? "Choose the semester you want to return in."
      : !form.return_intent.trim()
        ? "Tell us why you are ready to come back."
        : needsPreviousLeave && !(form.previous_loa_start && form.previous_loa_end)
          ? "Choose the semesters your leave covered."
          : "Tick every item on the checklist.";
  }

  function onSubmit(event) {
    event.preventDefault();
    const payload = {
      target_return_term: form.target_return_term,
      return_intent: form.return_intent,
      readmission_items: selectedItems,
    };
    if (needsPreviousLeave) {
      payload.previous_loa_start = form.previous_loa_start;
      payload.previous_loa_end = form.previous_loa_end;
    }
    submit(payload);
  }

  const title = editable ? "Correct your request and send it again" : "Ask to come back";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label={title}>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {editable
          ? "Change what the comment above asks for, then send your request again."
          : "Graduate School staff check your request first, then the Dean decides."}
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {can.linked_case_id ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-semibold">You are ending your leave: {can.leave_period || "your leave of absence"}.</p>
            {can.leave_end && <p className="mt-0.5">It runs until {formatDate(can.leave_end)}.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your leave started in" required>
              <Select
                value={form.previous_loa_start}
                onChange={(event) => setForm((current) => ({ ...current, previous_loa_start: event.target.value, previous_loa_end: current.previous_loa_end || event.target.value }))}
                placeholder="Choose a semester"
                options={previousSemesters}
                required
              />
            </Field>
            <Field label="Your leave ended in" required>
              <Select value={form.previous_loa_end} onChange={set("previous_loa_end")} placeholder="Choose a semester" options={previousSemesters} required />
            </Field>
          </div>
        )}

        <Field
          label="Semester you want to return in"
          required
          hint="You can ask to return before your leave ends, but the Dean decides whether that is allowed."
        >
          <Select value={form.target_return_term} onChange={set("target_return_term")} placeholder={returnOptions.length ? "Choose a semester" : "No upcoming semester is set up yet"} options={returnOptions} required />
        </Field>

        <Field label="Why you are ready to come back" required>
          <Textarea value={form.return_intent} onChange={set("return_intent")} placeholder="Say that you want to return and briefly explain how you are ready to continue your studies." required />
        </Field>

        {requirements.length > 0 && (
          <div>
            <p className="field-label">Before you send this, confirm each item</p>
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

        <SubmitState busy={busy} error={error} message={message} disabled={!complete} disabledHint={hint} label={editable ? "Send again" : "Submit readmission request"} />
      </form>
    </section>
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">When you can withdraw a subject</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900">{(selectedSubject || activeSubjects[0])?.withdrawal_window?.policy || "You may withdraw a subject until the end of the second week of classes (14 calendar days). 10% of the term's total is charged in the first week and 20% in the second; afterwards you may withdraw from all subjects at full fees or file a Leave of Absence."}</p>
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
                      {selectedSubject.withdrawal_eligible ? "Withdrawal deadline" : "Withdrawal availability"}
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
                    {selectedSubject.withdrawal_window.fee_consequence && <p className="mt-2 text-xs font-semibold">Fee: {selectedSubject.withdrawal_window.fee_consequence}</p>}
                    {selectedSubject.withdrawal_window.rule_source && <p className="mt-1 text-[11px] opacity-80">Rule: {selectedSubject.withdrawal_window.rule_source}</p>}
                  </div>
                </div>
              )}
              {!eligibleSubjects.length && <p role="alert" className="mt-2 text-xs font-semibold text-amber-700">No active subject is currently inside the withdrawal window (until the end of the second week of classes). Contact Graduate School staff if the recorded semester dates are incorrect.</p>}
            </Field>
            <Field label="Reason for withdrawing from this subject" required>
              <Textarea value={form.reason} onChange={set("reason")} required />
            </Field>
            <SubmitState
              busy={busy}
              error={error}
              message={message}
              disabled={!form.subject_enrollment_id || !selectedSubject?.withdrawal_eligible}
              disabledHint={!eligibleSubjects.length ? "No subject is currently inside the withdrawal window." : !form.subject_enrollment_id ? "Choose an eligible enrolled subject before submitting." : ""}
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
                <p className="mt-1 text-xs font-semibold text-emerald-800">{existing?.withdrawal_window?.status || "Eligibility recorded"}</p>
                {existing?.withdrawal_window?.fee_consequence && <p className="mt-1 text-xs text-emerald-900">Fee: {existing.withdrawal_window.fee_consequence}</p>}
              </div>
            </div>
            <p className="text-sm text-slate-600">{existing?.reason || "No reason recorded."}</p>
          </div>
        )}
      </StageCard>
      <StageCard number={2} title="GS Staff Forwards Request to Dean" state={status === "Submitted to GS Staff" ? "pending" : staffForwarded || denied ? "complete" : returned ? "returned" : "locked"} helper={status === "Submitted to GS Staff" ? "Graduate School staff is recording your structured request and forwarding it to the Dean." : staffForwarded || denied ? "Graduate School staff forwarded the request to the Dean." : "Available after Step 1 is submitted."} />
      <StageCard number={3} title="Dean Reviews Request" state={denied ? "rejected" : deanPending ? "pending" : deanApproved ? "complete" : "locked"} helper={denied ? "The Dean denied this request. The subject remains enrolled and your record is unchanged." : deanPending ? "The Dean is reviewing the selected subject, request date, and eligibility window." : deanApproved ? "The Dean approved the request and returned it to Graduate School staff for subject tagging." : "Available after GS Staff forwards the request."} />
      <StageCard number={4} title="GS Staff Tags Subject as Withdrawn" state={subjectTagged ? "complete" : deanApproved ? "pending" : "locked"} helper={subjectTagged ? `${existing?.subject?.course_code || "The selected subject"} now shows Withdrawn in Official Offered Subjects. Any fee is settled with the Business Office and any grade mark is applied by the Registrar. Your other subjects and active program standing remain unchanged.` : deanApproved ? "Graduate School staff must tag you as Withdrawn from the selected subject before any Registrar Excel list can be prepared." : denied ? "This step does not open for a denied request." : "Available after Dean approval."} />
      <StageCard number={5} title="GS Staff Exports Approved Excel List" state={excelReady ? "complete" : subjectTagged ? "pending" : "locked"} helper={excelReady ? "Your tagged withdrawal was included in the Excel list for the Registrar." : subjectTagged ? "The official subject status is updated, so Graduate School staff can now prepare the Excel list." : "Available after GS Staff tags the selected subject as Withdrawn."} />
      <StageCard number={6} title="GS Staff Emails Update and Waits for Acknowledgement" state={registrarAcknowledged ? "complete" : excelReady ? "pending" : "locked"} helper={registrarAcknowledged ? "Registrar acknowledgement was recorded." : excelReady ? "Graduate School staff must email the downloaded Excel list through the official channel and wait for the Registrar's acknowledgement. The portal does not send this email." : "Available after the approved list is exported."} />
      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} />}
      <WorkflowTimeline steps={withdrawalSteps} title="Detailed withdrawal timeline" />
    </form>
  );
}
