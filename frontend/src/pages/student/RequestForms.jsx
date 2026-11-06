import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Button, Field, InlineNotice, Select, Textarea } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import { ProcessCaseList } from "./ProcessCaseCard";
import { ErrorSummary, LoadError, RequestFormCard, useFormErrors, useSubmitRequest, SavedWorkflowFiles, SubmitState } from "./shared";
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


export function LoaRequestForm({ data, onSaved }) {
  const submitState = useSubmitRequest("leave-of-absence", onSaved);
  const overview = data.leave_overview;
  if (!overview) {
    return <LoadError title="Could not load your leave information" onRetry={onSaved}>Your leave information could not be loaded.</LoadError>;
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
        <LeaveReasonNote>{overview.banner?.link ? "" : reason}</LeaveReasonNote>
      )}
      <EarlierCases cases={earlier} onChanged={onSaved} />
    </div>
  );
}

function LoaForm({ data, overview, mode, editable, parent, submitState }) {
  const { busy, error, message, submit } = submitState;
  const { errors, fail, clear, messageFor } = useFormErrors();
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
  // Submit is off only when no answer can fix it; a missing answer is reported when Submit is pressed.
  const disabled = filingFail || noLaterSemester;

  let hint = "";
  if (noLaterSemester) hint = "No later semester is set up yet. Please ask Graduate School staff.";
  else if (filingFail) hint = "You cannot send this request for the semester you chose. Choose another semester.";

  function problems() {
    const found = [];
    if (!form.effective_start) found.push({ id: "loa-start", message: extension ? "Choose the semester the extra time starts in." : "Choose the semester your leave starts in." });
    else if (!form.effective_end) found.push({ id: "loa-end", message: extension ? "Choose the semester the extra time ends in." : "Choose the semester your leave ends in." });
    if (!form.reason_category) found.push({ id: "loa-reason", message: "Choose the reason for your leave." });
    if (!form.reason_remarks.trim()) found.push({ id: "loa-remarks", message: "Explain what is happening so staff can review your request." });
    return found;
  }

  const rulesText = [
    maxPeriod > 0 ? `A leave can last up to ${pluralize(maxPeriod, "semester")} at a time.` : "",
    "It can be renewed once.",
    maxTotal > 0 ? `All your leave together can never be more than ${pluralize(maxTotal, "semester")}.` : "",
  ].filter(Boolean).join(" ");

  const title = editable ? "Correct your request and send it again" : extension ? "Ask for more time" : "Ask for a leave of absence";
  const label = editable ? "Resubmit leave request" : extension ? "Submit leave extension request" : "Submit leave request";

  return (
    <RequestFormCard
      title={title}
      description={
        editable
          ? "Change what the comment above asks for, then send your request again."
          : extension
            ? `Your leave can be renewed once, and never beyond ${maxTotal > 0 ? pluralize(maxTotal, "semester") : "the total the handbook allows"} in all. The extra time starts in the semester after your current leave ends${parentEnd ? ` (${formatDate(parentEnd)})` : ""}.`
            : "Choose the semesters you want to be away and tell us why. Graduate School staff check your request first, then the Dean decides."
      }
    >
      {!(extension && !editable) && <p className="mt-1 text-sm text-slate-600">{rulesText}</p>}
      {extension && !editable && remaining > 0 && <p className="mt-1 text-sm text-slate-600">You can ask for up to {pluralize(span, "more semester")} now.</p>}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const found = problems();
          if (found.length) {
            fail(found);
            return;
          }
          clear();
          submit(
            {
              effective_start: form.effective_start,
              effective_end: form.effective_end,
              reason_category: form.reason_category,
              reason_remarks: form.reason_remarks,
            },
            { lines: [extension ? "Leave extension request" : "Leave of absence request", `From: ${form.effective_start}`, `To: ${form.effective_end}`, `Reason: ${form.reason_category}`] },
          );
        }}
        className="mt-4 space-y-4"
      >
        <ErrorSummary errors={errors} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {extension && startChoices.length === 1 && form.effective_start === startChoices[0].label ? (
            // I-254: an extension can only start the semester after the current leave ends, so it is shown, not picked.
            <Field label="Extra time starts" hint="The semester right after your current leave ends.">
              <p id="loa-start" className="text-sm font-medium text-ink">{form.effective_start}</p>
            </Field>
          ) : (
            <Field label={extension ? "Extra time starts" : "Leave starts"} required error={messageFor("loa-start")}>
              <Select id="loa-start" value={form.effective_start} onChange={changeStart} placeholder="Choose a semester" options={startOptions} />
            </Field>
          )}
          <Field label={extension ? "Extra time ends" : "Leave ends"} required hint={semesterCount ? `That is ${pluralize(semesterCount, "semester")}.` : ""} error={messageFor("loa-end")}>
            <Select id="loa-end" value={form.effective_end} onChange={set("effective_end")} placeholder={startIndex >= 0 ? "Choose a semester" : "Choose when it starts first"} options={endOptions} disabled={startIndex < 0 && !form.effective_end} />
          </Field>
        </div>

        {filingFail && <InlineNotice tone="danger">{startOption.filing_detail}</InlineNotice>}
        {filingWarning && (
          <InlineNotice tone="warning" title="Please read before you send this request">
            {startOption.filing_detail}
          </InlineNotice>
        )}

        <Field label="Reason" required error={messageFor("loa-reason")}>
          <Select id="loa-reason" value={form.reason_category} onChange={set("reason_category")} placeholder="Choose a reason" options={data.loa_allowed_reasons || []} />
        </Field>
        <Field label="Tell us what is happening" required error={messageFor("loa-remarks")}>
          <Textarea id="loa-remarks" value={form.reason_remarks} onChange={set("reason_remarks")} placeholder="Explain your situation in a few sentences." />
        </Field>
        <SubmitState busy={busy} error={error} message={message} disabled={disabled} disabledHint={hint} label={label} />
      </form>
    </RequestFormCard>
  );
}

// ---- Readmission -------------------------------------------------------------------------

export function ReadmissionRequestForm({ data, onSaved }) {
  const submitState = useSubmitRequest("readmission", onSaved);
  const overview = data.leave_overview;
  if (!overview) {
    return <LoadError title="Could not load your leave information" onRetry={onSaved}>Your leave information could not be loaded.</LoadError>;
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
        <LeaveReasonNote>{overview.banner?.link ? "" : reason}</LeaveReasonNote>
      )}
      <EarlierCases cases={earlier} onChanged={onSaved} />
    </div>
  );
}

function ReadmissionForm({ data, overview, can, editable, submitState }) {
  const { busy, error, message, submit } = submitState;
  const { errors, fail, clear, messageFor } = useFormErrors();
  const checks = data.readmission_checks || [];
  const previousSemesters = can.previous_semester_options || [];
  // The leave period comes from the leave case or the enrollment records; ask only when neither has it.
  const needsPreviousLeave = !can.leave_period;
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
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Submit is off only when no answer can fix it; a missing answer is reported when Submit is pressed.
  const noReturnSemester = returnOptions.length === 0;
  const hint = noReturnSemester ? "No upcoming semester is set up yet. Please ask Graduate School staff." : "";

  function problems() {
    const found = [];
    if (needsPreviousLeave && !form.previous_loa_start) found.push({ id: "readmission-leave-start", message: "Choose the semester your leave started in." });
    if (needsPreviousLeave && !form.previous_loa_end) found.push({ id: "readmission-leave-end", message: "Choose the semester your leave ended in." });
    if (!form.target_return_term) found.push({ id: "readmission-term", message: "Choose the semester you want to return in." });
    if (!form.return_intent.trim()) found.push({ id: "readmission-intent", message: "Say why you are ready to come back." });
    return found;
  }

  function onSubmit(event) {
    event.preventDefault();
    const found = problems();
    if (found.length) {
      fail(found);
      return;
    }
    clear();
    const payload = {
      target_return_term: form.target_return_term,
      return_intent: form.return_intent,
    };
    if (needsPreviousLeave) {
      payload.previous_loa_start = form.previous_loa_start;
      payload.previous_loa_end = form.previous_loa_end;
    }
    submit(payload, { lines: ["Readmission request", `Return in: ${form.target_return_term}`] });
  }

  const title = editable ? "Correct your request and send it again" : "Ask to come back";

  return (
    <RequestFormCard
      title={title}
      description={editable ? "Change what the comment above asks for, then send your request again." : "Graduate School staff check your request first, then the Dean decides."}
    >

      <form noValidate onSubmit={onSubmit} className="mt-4 space-y-4">
        <ErrorSummary errors={errors} />
        {!needsPreviousLeave ? (
          <InlineNotice tone="info" title={`You are ending your leave: ${can.leave_period}.`}>
            {can.leave_end && `It runs until ${formatDate(can.leave_end)}.`}
          </InlineNotice>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your leave started in" required error={messageFor("readmission-leave-start")}>
              <Select
                id="readmission-leave-start"
                value={form.previous_loa_start}
                onChange={(event) => setForm((current) => ({ ...current, previous_loa_start: event.target.value, previous_loa_end: current.previous_loa_end || event.target.value }))}
                placeholder="Choose a semester"
                options={previousSemesters}
              />
            </Field>
            <Field label="Your leave ended in" required error={messageFor("readmission-leave-end")}>
              <Select id="readmission-leave-end" value={form.previous_loa_end} onChange={set("previous_loa_end")} placeholder="Choose a semester" options={previousSemesters} />
            </Field>
          </div>
        )}

        <Field
          label="Semester you want to return in"
          required
          hint="You can ask to return before your leave ends, but the Dean decides whether that is allowed."
          error={messageFor("readmission-term")}
        >
          <Select id="readmission-term" value={form.target_return_term} onChange={set("target_return_term")} placeholder={returnOptions.length ? "Choose a semester" : "No upcoming semester is set up yet"} options={returnOptions} />
        </Field>

        <Field label="Why you are ready to come back" required error={messageFor("readmission-intent")}>
          <Textarea id="readmission-intent" value={form.return_intent} onChange={set("return_intent")} placeholder="Say that you want to return and briefly explain how you are ready to continue your studies." />
        </Field>

        {checks.length > 0 && (
          <div>
            <p className="field-label">What is checked for you</p>
            <ul className="mt-2 space-y-1.5" data-testid="readmission-checks">
              {checks.map((row) => (
                <li key={row.item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="block font-medium text-ink">{row.item}</span>
                  <span className="block text-xs text-slate-500">
                    {row.source === "system" ? "Checked by the system: " : "Confirmed by Graduate School staff: "}{row.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <SubmitState busy={busy} error={error} message={message} disabled={noReturnSemester} disabledHint={hint} label={editable ? "Resubmit readmission request" : "Submit readmission request"} />
      </form>
    </RequestFormCard>
  );
}

export function AwolReturnRequestForm({ data, onSaved }) {
  const existing = data.awol_case;
  const student = data.student;
  const awolReturn = data.awol_return || {};
  const semesters = awolReturn.return_semester_options || [];
  const [form, setForm] = useState({
    target_return_term: awolReturn.default_return_term || "",
    return_intent: existing?.return_intent || "",
    return_reason: existing?.return_reason || "",
  });
  const { busy, error, message, submit } = useSubmitRequest("awol-return", onSaved);
  const { errors, fail, clear, messageFor } = useFormErrors();
  const locked = existing && ["Return Submitted", "Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"].includes(existing.status);

  function onSubmit(event) {
    event.preventDefault();
    const found = [];
    if (!form.target_return_term) found.push({ id: "awol-term", message: "Choose your intended return semester." });
    if (!form.return_intent.trim()) found.push({ id: "awol-intent", message: "Write your intention to resume enrollment." });
    if (!form.return_reason.trim()) found.push({ id: "awol-reason", message: "Explain why you are returning and how you are ready to continue." });
    if (found.length) {
      fail(found);
      return;
    }
    clear();
    submit(form, { lines: ["Return from AWOL", `Return in: ${form.target_return_term}`] });
  }

  return (
    <div className="space-y-4">
      {/* On a phone the long notice and the rules come first; this takes the student straight to the form. */}
      {!locked && <Button type="button" variant="secondary" className="w-full sm:hidden" onClick={() => document.getElementById("awol-return-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Fill in your return</Button>}
      <LeaveBanner
        banner={data.leave_overview?.banner || ((student.standing === "AWOL" || student.enrollment_tag === "AWOL")
          ? { tone: "bad", title: "Your record is marked AWOL", text: "You cannot enroll until a return request is approved." }
          : null)}
        hideLink
      />
      {student.enrollment_tag === "Residency" && (
        <InlineNotice tone="info">
          You are enrolled in residency without subjects for an approved academic purpose. Check the workflow status for the recorded semester and purpose.
        </InlineNotice>
      )}
      {locked ? (
        <InlineNotice tone="warning">Your return declaration has already been routed for review. Watch the Inbox for the Dean's decision or a revision request.</InlineNotice>
      ) : (
        <div id="awol-return-form" className="scroll-mt-24"><RequestFormCard title="Tell us you are coming back" description="Choose the semester you want to return in and tell us why you are ready. The request goes to the Graduate School Dean.">
        <form noValidate onSubmit={onSubmit} className="mt-4 space-y-4">
          <ErrorSummary errors={errors} />
          <InlineNotice tone="info">
            The handbook requires a written intention to enroll routed through the Graduate School Dean. Complete the form below; no file needs to be uploaded.
          </InlineNotice>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intended return semester" required error={messageFor("awol-term")}>{semesters.length === 1 && semesters[0] === form.target_return_term ? <p className="text-sm font-medium text-ink" data-testid="awol-term-fixed">{semesters[0]}</p> : <Select id="awol-term" value={form.target_return_term} onChange={(event) => setForm((current) => ({ ...current, target_return_term: event.target.value }))} placeholder="Select semester" options={semesters} />}</Field>
            <Field label="Last enrolled semester" hint="Taken from your enrollment records."><p className="text-sm font-medium text-ink" data-testid="awol-last-enrolled">{awolReturn.last_enrolled_term || "Not on record"}</p></Field>
          </div>
          <Field label="Written intention to resume enrollment" hint="One sentence: you want to enroll again, and from which semester." required error={messageFor("awol-intent")}><Textarea id="awol-intent" value={form.return_intent} onChange={(event) => setForm((current) => ({ ...current, return_intent: event.target.value }))} placeholder="I intend to resume enrollment in the selected semester…" /></Field>
          <Field label="Reason for returning and readiness to continue" hint="What changed, and how you are ready to continue." required error={messageFor("awol-reason")}><Textarea id="awol-reason" value={form.return_reason} onChange={(event) => setForm((current) => ({ ...current, return_reason: event.target.value }))} /></Field>
          <SubmitState busy={busy} error={error} message={message} label={existing?.status === "Returned for Revision" ? "Resubmit return declaration" : "Submit return declaration"} />
        </form>
        </RequestFormCard></div>
      )}
      {/* The form comes first; the case facts and timeline follow (I-386). */}
      <ProcessCaseList cases={data.standalone_cases?.awol || []} returning={locked ? "" : form.target_return_term} />
    </div>
  );
}

function WithdrawalClosedNotice({ subjects }) {
  const first = subjects[0]?.withdrawal_window;
  return (
    <InlineNotice tone="info" role="status" icon={CalendarClock} title="Subject withdrawal is closed right now">
      {subjects.length ? (
        <div className="space-y-2 text-sm">
          {first?.deadline && (
            <p>
              The window closed on {formatDate(first.deadline)}. To leave the semester, file a{" "}
              <Link to="/student/requests/leave-of-absence" className="font-semibold underline">Leave of Absence</Link>.
            </p>
          )}
          <p>{first?.policy ||"You may withdraw a subject until the end of the second week of classes (14 calendar days)."}</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {subjects.map((item) => (
              <li key={item.id}>
                {item.course_code} — {item.withdrawal_window?.status || "Withdrawal window closed"}
                {item.withdrawal_window?.deadline ? ` (deadline ${formatDate(item.withdrawal_window.deadline)})` : ""}
              </li>
            ))}
          </ul>
          {first?.rule_source && <p className="micro">Rule: {first.rule_source}</p>}
          <p>
            If the recorded semester dates look wrong, ask Graduate School staff to correct them.{" "}
            <Link to="/student/messages" className="font-semibold underline">Open your Messages</Link>
          </p>
        </div>
      ) : (
        <p className="text-sm">You have no enrolled subject this semester.</p>
      )}
    </InlineNotice>
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
  const { errors, fail, clear, messageFor } = useFormErrors();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    const found = [];
    if (!form.subject_enrollment_id) found.push({ id: "withdrawal-subject", message: "Choose the subject you want to withdraw from." });
    if (!String(form.reason || "").trim()) found.push({ id: "withdrawal-reason", message: "Explain why you are withdrawing from this subject." });
    if (found.length) {
      fail(found);
      return;
    }
    clear();
    const windowInfo = selectedSubject?.withdrawal_window;
    submit({ student_id: data.student.id, ...form }, {
      lines: [
        "Subject withdrawal",
        `Subject: ${selectedSubject?.course_code || ""} — ${selectedSubject?.course_title || ""}`,
        `Semester: ${selectedSubject?.term_label || ""}`,
        windowInfo?.fee_consequence ? `Fee: ${windowInfo.fee_consequence}` : "",
      ],
    });
  }

  const status = existing?.status || "Not Submitted";
  const returned = ["Returned", "Returned for Clarification"].includes(status) && existing?.dean_decision !== "Approved";
  const applicationEditable = !existing || returned;
  const selectedSubject = activeSubjects.find((item) => String(item.id) === String(form.subject_enrollment_id));

  useEffect(() => {
    setForm({
      reason: existing?.reason || "",
      subject_enrollment_id: existing?.subject_enrollment_id || eligibleSubjects[0]?.id || "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at, eligibleSubjects[0]?.id]);

  // Submit is off only when no answer can fix it: nothing in the window, or the chosen subject's window has closed.
  const windowClosed = Boolean(selectedSubject) && !selectedSubject.withdrawal_eligible;
  const blocked = !eligibleSubjects.length || windowClosed;
  const blockedHint = !eligibleSubjects.length ? "No subject is currently inside the withdrawal window." : windowClosed ? "The withdrawal window for this subject has closed." : "";

  // Outside the window nothing can be sent, so the form is replaced by one notice: why, which window, and who to ask (I-178).
  if (applicationEditable && !eligibleSubjects.length) {
    return (
      <div className="space-y-4">
        <ProcessCaseList cases={data.standalone_cases?.withdrawal || []} />
        <WithdrawalClosedNotice subjects={activeSubjects} />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <ErrorSummary errors={errors} />
      <ProcessCaseList cases={data.standalone_cases?.withdrawal || []} />
      <InlineNotice tone="warning" title="When you can withdraw a subject">
        <p className="text-xs leading-relaxed">{(selectedSubject || activeSubjects[0])?.withdrawal_window?.policy || "You may withdraw a subject until the end of the second week of classes (14 calendar days). 10% of your total fees for this semester is charged in the first week and 20% in the second; afterwards you may withdraw from all subjects at full fees or file a Leave of Absence."}</p>
      </InlineNotice>
      <RequestFormCard
        title={applicationEditable ? "Ask to withdraw from a subject" : "Your withdrawal request"}
        description={applicationEditable ? "Choose one eligible enrolled subject and state the reason for withdrawing." : "Your selected subject and reason are saved and read-only."}
      >
        {applicationEditable ? (
          <div className="mt-4 space-y-4">
            <Field label="Enrolled subject" required error={messageFor("withdrawal-subject")}>
              <Select
                id="withdrawal-subject"
                value={form.subject_enrollment_id}
                onChange={set("subject_enrollment_id")}
                placeholder="Choose an eligible enrolled subject"
                options={activeSubjects.map((item) => ({
                  value: item.id,
                  disabled: !item.withdrawal_eligible,
                  label: `${item.course_code} — ${item.course_title} · ${item.term_label}${item.withdrawal_eligible ? ` · ELIGIBLE UNTIL ${item.withdrawal_window?.deadline || "semester deadline"}` : " · WITHDRAWAL WINDOW CLOSED"}`,
                }))}
              />
              {selectedSubject?.withdrawal_window && (
                <InlineNotice
                  tone={selectedSubject.withdrawal_eligible ? "success" : "danger"}
                  role="status"
                  icon={CalendarClock}
                  className="mt-3"
                >
                  <p className="eyebrow text-current">{selectedSubject.withdrawal_eligible ? "Withdrawal deadline" : "Withdrawal availability"}</p>
                  <p className="mt-1 font-display text-lg font-semibold leading-tight">
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
                  {selectedSubject.withdrawal_window.rule_source && <p className="micro mt-1 text-current opacity-80">Rule: {selectedSubject.withdrawal_window.rule_source}</p>}
                </InlineNotice>
              )}
              {!eligibleSubjects.length && <InlineNotice tone="info" className="mt-2">No active subject is currently inside the withdrawal window (until the end of the second week of classes). Contact Graduate School staff if the recorded semester dates are incorrect.</InlineNotice>}
            </Field>
            <Field label="Reason for withdrawing from this subject" required error={messageFor("withdrawal-reason")}>
              <Textarea id="withdrawal-reason" value={form.reason} onChange={set("reason")} />
            </Field>
            <SubmitState
              busy={busy}
              error={error}
              message={message}
              disabled={blocked}
              disabledHint={blockedHint}
              label={returned ? "Resubmit withdrawal request" : "Submit withdrawal request"}
            />
            <p className="meta" data-testid="withdrawal-next">After you send it: Graduate School staff check the request and pass it to the Dean. The Dean says yes or no. You can follow it on this page, in the Request Center, and in the bell. If the Dean says yes, pay or settle any fee at the Business Office.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-ink">{existing?.subject?.course_code || "Subject pending"} — {existing?.subject?.course_title || "Selected subject"}</p>
            <p className="text-sm text-slate-600">{existing?.effective_term || existing?.subject?.term_label || "Semester pending"} · submitted {formatDate(existing?.created_at)}</p>
            <InlineNotice tone="success" role="status" icon={CalendarClock}>
              <p className="eyebrow text-current">Eligibility recorded at submission</p>
              <p className="card-title mt-1 text-current">Eligible until {formatDate(existing?.withdrawal_window?.deadline)}</p>
              <p className="mt-1 text-xs font-semibold">{existing?.withdrawal_window?.status || "Eligibility recorded"}</p>
              {existing?.withdrawal_window?.fee_consequence && <p className="mt-1 text-xs font-normal">Fee: {existing.withdrawal_window.fee_consequence}</p>}
            </InlineNotice>
            <p className="text-sm text-slate-600">{existing?.reason || "No reason recorded."}</p>
          </div>
        )}
      </RequestFormCard>
      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} />}
    </form>
  );
}
