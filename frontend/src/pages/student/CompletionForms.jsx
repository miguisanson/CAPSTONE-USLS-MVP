import { useEffect, useState } from "react";
import {
  Briefcase,
} from "lucide-react";
import { Field, InlineNotice, Input, StatusChip, Textarea } from "../../components/ui/index.js";
import { requestStateLabel } from "./requestMeta";
import { ErrorSummary, useFormErrors, useSubmitRequest, StageCard, SavedWorkflowFiles, RequestPdfUpload, SubmitState } from "./shared";

export function PracticumRequestForm({ data, onSaved }) {
  const existing = data.practicum_record;
  const eligibility = data.practicum_eligibility || {};
  const scope = data.practicum_program_scope || eligibility.program_scope || {};
  const status = existing?.status || "Not Submitted";
  const latestReturn = (data.workflow_messages || []).find((message) => message.transaction_slug === "practicum" && message.recipient_role === "Student" && message.action_type === "return" && message.status === "Open");
  const newOrganizationRequired = status === "Not Accepted - New Organization Required";
  const returned = status === "Returned for Clarification" || newOrganizationRequired;
  const completionStatuses = new Set(["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"]);
  const returnedToCompletion = returned && !newOrganizationRequired && (["Practicum In Progress", "Hours Incomplete", "Documents Submitted", "Documents Under Review", "Additional Certificates Requested", "Completed"].includes(latestReturn?.previous_status) || Boolean(existing?.certificate_attachment));
  const eligibilityReady = eligibility.eligible || Boolean(existing);
  const moaEditable = eligibilityReady && (!existing || (returned && !returnedToCompletion));
  const completionEditable = completionStatuses.has(status) || returnedToCompletion;
  const moaPending = ["MOA Submitted", "MOA Received", "MOA Under Review"].includes(status);
  const documentsPending = ["Documents Submitted", "Documents Under Review"].includes(status);
  const reviewComplete = ["Completed", "Report Sent to Dean", "Dean Reviewed"].includes(status);
  const completionPreviouslySubmitted = Boolean(existing?.certificate_attachment) && !moaPending && !newOrganizationRequired;
  const additionalCompletionPdfRequired = ["Hours Incomplete", "Additional Certificates Requested"].includes(status);
  const [form, setForm] = useState({
    attachment_id: existing?.moa_attachment?.id || null,
    certificate_attachment_id: additionalCompletionPdfRequired ? null : existing?.certificate_attachment?.id || null,
    practicum_site: existing?.practicum_site || "",
    supervisor_name: existing?.supervisor_name || "",
    required_hours: existing?.required_hours || 200,
    completed_hours: existing?.reported_hours ?? 0,
    remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("practicum", onSaved);
  const { errors, fail, clear, messageFor } = useFormErrors();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    setForm({
      attachment_id: existing?.moa_attachment?.id || null,
      certificate_attachment_id: additionalCompletionPdfRequired ? null : existing?.certificate_attachment?.id || null,
      practicum_site: existing?.practicum_site || "",
      supervisor_name: existing?.supervisor_name || "",
      required_hours: existing?.required_hours || 200,
      completed_hours: existing?.reported_hours ?? 0,
      remarks: "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at, additionalCompletionPdfRequired]);

  function onSubmit(e) {
    e.preventDefault();
    const found = [];
    if (moaEditable) {
      if (!form.practicum_site.trim()) found.push({ id: "practicum-site", message: "Enter the practicum site or company." });
      if (!form.attachment_id) found.push({ id: "practicum-moa", message: "Upload the signed MOA as a PDF." });
    } else if (completionEditable) {
      const hours = Number(form.completed_hours);
      const mostHours = Number(form.required_hours) * 2; // twice the requirement is the most that can be real
      if (String(form.completed_hours).trim() === "" || !Number.isInteger(hours) || hours < 0) found.push({ id: "practicum-hours", message: "Enter the hours you have completed as a whole number, 0 or more." });
      else if (hours > mostHours) found.push({ id: "practicum-hours", message: `Hours cannot be more than ${mostHours} hours (twice the ${form.required_hours} required). Check the number.` });
      if (!form.certificate_attachment_id) found.push({ id: "practicum-certificates", message: additionalCompletionPdfRequired ? "Upload the new certificates or hours proof as a PDF." : "Upload the completion certificates as a PDF." });
    }
    if (found.length) {
      fail(found);
      return;
    }
    clear();
    const { required_hours: requiredHours, ...sent } = form; // the program sets the required hours and the server reads them, so they are not posted
    submit(
      sent,
      {
        lines: moaEditable
          ? ["Practicum: MOA submission", `Site: ${form.practicum_site}`]
          : ["Practicum: completion documents", `Hours completed: ${form.completed_hours} of ${requiredHours}`],
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <ErrorSummary errors={errors} />
      <InlineNotice tone="info" icon={Briefcase} title="Psychology and MSGC students only">
        <p className="text-xs leading-relaxed">
          {scope.description || "Practicum is restricted to Psychology programs and the Master of Science in Guidance and Counseling (MSGC)."} Your program, {data.student.program_code} — {data.student.program_name}, is within this scope.
        </p>
      </InlineNotice>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current practicum stage</p><p className="meta mt-1">Only the requirements due now can be edited. Completed submissions stay available below.</p></div><StatusChip status={requestStateLabel(status)} dot={false} /></div></div>

      <StageCard number={1} title="Eligibility Check / Pre-Practicum Requirements" state={eligibilityReady ? "complete" : "pending"} helper={existing ? "The eligibility gate was completed for this request. The values below continue to reflect the latest monitoring and research records." : "Automatically checked from your monitoring sheet and research milestones."}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div><p className="text-sm font-semibold text-ink">Eligibility recommendation</p><p className="meta">Based on the encoded course audit and research milestone records.</p></div>
          <StatusChip status={eligibility.eligible ? "Verified" : eligibility.status || "Needs verification"} dot={false} />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(eligibility.checklist || []).map((item) => {
            const actual = String(item.actual_value ?? item.actual ?? "No source data");
            const value = item.required_value != null ? `${actual} / ${item.required_value}` : actual;
            return (
              <div key={item.key} className="grid gap-2 border-b border-slate-100 px-3 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-700">{item.label}</p><p className="meta truncate">Source: {item.source_field || "Not recorded"}</p></div>
                <p className="whitespace-nowrap text-sm font-semibold text-slate-700">{value}</p>
                <StatusChip status={item.passed === true ? "Verified" : item.passed === false ? "Not eligible" : "Needs verification"} dot={false} />
              </div>
            );
          })}
        </div>
      </StageCard>

      <StageCard number={2} title="MOA Submission" state={moaEditable ? (returned ? "returned" : "active") : moaPending ? "pending" : existing?.moa_attachment ? "complete" : "locked"} helper={!eligibilityReady ? "Available after the eligibility requirements in Step 1 are verified." : moaEditable ? "What you need to submit now: practicum site details and the signed MOA PDF." : moaPending ? "Your MOA is saved and waiting for staff / Academic Coordinator review." : "Completed MOA information is read-only while you continue to the next stage."}>
        {moaEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Practicum site / company" required error={messageFor("practicum-site")}><Input id="practicum-site" value={form.practicum_site} onChange={set("practicum_site")} /></Field><Field label="Supervisor name"><Input value={form.supervisor_name} onChange={set("supervisor_name")} /></Field></div><RequestPdfUpload id="practicum-moa" invalid={messageFor("practicum-moa")} requestType="practicum" label="Practicum MOA PDF" initialAttachment={existing?.moa_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add a message for the staff reviewing this submission." /></Field><SubmitState busy={busy} error={error} message={message} label={returned ? "Resubmit MOA stage" : "Submit MOA stage"} /></div> : <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><p className="eyebrow">Practicum site</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.practicum_site || "Not provided"}</p></div><div><p className="eyebrow">Supervisor</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.supervisor_name || "Not provided"}</p></div></div>{existing?.moa_attachment && <SavedWorkflowFiles files={[existing.moa_attachment]} />}</div>}
      </StageCard>

      <StageCard number={3} title="Practicum Document Submission" state={completionEditable ? (returned ? "returned" : "active") : documentsPending ? "pending" : completionPreviouslySubmitted ? "complete" : "locked"} helper={completionEditable ? (additionalCompletionPdfRequired ? "What you need to submit now: upload a new PDF for the requested additional certificates. Earlier uploaded PDFs stay in the file history." : "What you need to submit now: completed hours and one PDF containing the required completion documents.") : documentsPending ? "Your completion documents are saved and under review." : newOrganizationRequired || moaPending ? "A replacement or pending MOA must be approved before completion documents can be submitted again." : "Available after the MOA is approved and the practicum is marked in progress."}>
        {completionEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><p className="field-label">Required hours</p><p className="mt-1 text-sm font-semibold text-ink">{form.required_hours}</p></div><Field label="Hours you completed (your own report)" required hint="The Academic Coordinator checks this against your certificates and enters the verified hours." error={messageFor("practicum-hours")}><Input id="practicum-hours" type="number" min="0" max={Number(form.required_hours) * 2} step="1" inputMode="numeric" value={form.completed_hours} onChange={set("completed_hours")} /></Field></div><InlineNotice tone="success" title="Certificates are counted automatically"><p className="text-xs">The system currently detects {existing?.certificate_count || 0} submitted certificate file{existing?.certificate_count === 1 ? "" : "s"}. Uploading an additional file updates this count.</p></InlineNotice><RequestPdfUpload id="practicum-certificates" invalid={messageFor("practicum-certificates")} requestType="practicum" label={additionalCompletionPdfRequired ? "New additional certificates / hours proof PDF" : "Completion certificates / forms / hours proof PDF"} initialAttachment={additionalCompletionPdfRequired ? null : existing?.certificate_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, certificate_attachment_id: attachment?.id || null }))} />{additionalCompletionPdfRequired && existing?.completion_attachments?.length > 0 && <SavedWorkflowFiles files={existing.completion_attachments} empty="No previous practicum files submitted yet." />}<Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add any context the reviewer should see with these files." /></Field><SubmitState busy={busy} error={error} message={message} label={returned ? "Resubmit completion stage" : "Submit completion stage"} /></div> : existing?.certificate_attachment ? <div className="space-y-3"><p className="text-sm text-slate-600">Reported by you: {existing.reported_hours} hours · {existing.verified_hours == null ? "not verified yet" : `verified by the Academic Coordinator: ${existing.verified_hours}/${existing.required_hours}`} · {existing.certificate_count} submitted certificate file{existing.certificate_count === 1 ? "" : "s"}</p><SavedWorkflowFiles files={existing.completion_attachments?.length ? existing.completion_attachments : [existing.certificate_attachment]} /></div> : null}
      </StageCard>

      <StageCard number={4} title="Review / Approval" state={reviewComplete ? "complete" : documentsPending ? "pending" : "locked"} helper={documentsPending ? "Graduate School staff and the Academic Coordinator are checking the submitted hours and documents." : reviewComplete ? "The completion evidence was accepted." : "Available after Step 3 is submitted."} />
      <StageCard number={5} title="Completion / Final Verification" state={status === "Dean Reviewed" ? "complete" : ["Completed", "Report Sent to Dean"].includes(status) ? "pending" : "locked"} helper={status === "Dean Reviewed" ? "Final practicum monitoring review is complete." : status === "Report Sent to Dean" ? "The status report is awaiting Dean review." : "Available after the completion review is approved."} />

      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} empty="No practicum files submitted yet." />}
    </form>
  );
}

// Everything still missing for graduation, at the top of the page; folded after 5 so a long list does not push the form away (I-428).
function WhatIsLeft({ items }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 5);
  return (
    <InlineNotice tone="warning" title={`What is left (${items.length})`}>
      <ul className="space-y-1 text-sm">{shown.map((item) => <li key={item}>• {item}</li>)}</ul>
      {items.length > 5 && <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${items.length}`}</button>}
    </InlineNotice>
  );
}

export function GraduationRequestForm({ data, onSaved }) {
  const existing = data.graduation_endorsement;
  // The school year is the open one; the server fills it in, so it is shown here and not sent.
  const activeReviewWindow = data.graduation_default_review_window || (data.graduation_review_windows || [])[0] || "";
  const [form, setForm] = useState({
    attachment_id: existing?.request_attachment?.id || null,
    remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("graduation", onSaved);
  const { errors, fail, clear, messageFor } = useFormErrors();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const eligibility = data.graduation_eligibility || {};
  const status = existing?.endorsement_status || "Not Submitted";
  const exported = existing?.registrar_status === "Exported - Ready to Send";
  const eligibilityReady = Boolean(eligibility.eligible);
  const applicationEditable = eligibilityReady && (!existing || ["Not Eligible", "Returned for Clarification"].includes(status));
  const returned = status === "Returned for Clarification";
  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => `Coursework: ${item}`),
    ...(eligibility.missing_research_requirements || []).map((item) => `Research: ${item}`),
    ...(eligibility.missing_practicum_requirement ? [`Practicum: ${eligibility.missing_practicum_requirement}`] : []),
  ];

  function onSubmit(e) {
    e.preventDefault();
    const found = [];
    if (!activeReviewWindow) found.push({ id: "graduation-year", message: "No school year is open for graduation applications yet." });
    if (!form.attachment_id) found.push({ id: "graduation-pdf", message: "Upload your signed graduation application as a PDF." });
    if (found.length) {
      fail(found);
      return;
    }
    clear();
    submit({ ...form }, { lines: ["Graduation endorsement application", `School year: ${activeReviewWindow}`] });
  }

  useEffect(() => setForm({ attachment_id: existing?.request_attachment?.id || null, remarks: "" }), [data.student.id, existing?.id, existing?.updated_at]);

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <ErrorSummary errors={errors} />
      <WhatIsLeft items={missing} />
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current graduation stage</p><p className="meta mt-1">Your application stays visible while each reviewing office completes its part.</p></div><StatusChip status={requestStateLabel(status)} dot={false} /></div></div>
      <StageCard number={1} title="Application / Review Window" state={!eligibilityReady && !existing ? "locked" : applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={!eligibilityReady && !existing ? "This step opens only after coursework, research, completion documents, and any required practicum are complete." : applicationEditable ? "What you need to submit now: the review window and signed graduation application / review-window PDF." : "Your submitted application is saved and read-only during review."}>
        {applicationEditable ? <div className="space-y-4"><div id="graduation-year"><p className="field-label">Graduation school year</p><p className="mt-1 text-sm font-semibold text-ink">{activeReviewWindow || "None open yet"}</p><p className="meta mt-1">This is the school year that is open now.</p>{messageFor("graduation-year") && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{messageFor("graduation-year")}</p>}</div><RequestPdfUpload id="graduation-pdf" invalid={messageFor("graduation-pdf")} requestType="graduation" label="Signed graduation application / review-window PDF" initialAttachment={existing?.request_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add a message to the staff reviewing your graduation submission." /></Field><SubmitState busy={busy} error={error} message={message} label={returned || status === "Not Eligible" ? "Resubmit graduation application" : "Submit graduation application"} /></div> : existing ? <div className="space-y-3"><p className="text-sm font-semibold text-ink">{existing.review_window}</p><SavedWorkflowFiles files={existing.attachments || []} /></div> : <InlineNotice tone="neutral">Finish what is left (see the list at the top of this page) before you apply for graduation.</InlineNotice>}
      </StageCard>
      {applicationEditable && existing?.attachments?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <SavedWorkflowFiles files={existing.attachments} empty="No prior graduation application files." />
        </div>
      )}
      <StageCard number={2} title="Staff and Coursework Review" state={["For Review", "Coursework Review"].includes(status) ? "pending" : ["Research Review", "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved"].includes(status) ? "complete" : "locked"} helper={["For Review", "Coursework Review"].includes(status) ? "Graduate School staff and the Academic Coordinator are reviewing your coursework record." : "This stage opens after the application is submitted."} />
      <StageCard number={3} title="Requirements Validation" state={["Research Review", "Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status) ? "pending" : ["Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved"].includes(status) ? "complete" : status === "Not Eligible" ? "returned" : "locked"} helper={status === "Not Eligible" ? "Resolve the listed missing requirements before resubmitting your application." : "Coursework, research, practicum, and completion records are checked here."}>
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">Monitoring eligibility recommendation</p><StatusChip status={eligibility.status || (eligibility.eligible ? "Eligible" : "Needs verification")} dot={false} /></div>{missing.length ? <p className="meta mt-2">What is left is listed at the top of this page.</p> : <p className="mt-2 text-xs text-slate-500">No missing requirements are currently flagged by the monitoring layer.</p>}</div>
      </StageCard>
      <StageCard number={4} title="Dean Endorsement" state={status === "Returned for Revision" ? "returned" : status === "Ready for Dean Review" ? "pending" : status === "Dean Approved" ? "complete" : "locked"} helper={status === "Returned for Revision" ? "The endorsement list was returned to staff for correction. Your own submission remains saved." : status === "Ready for Dean Review" ? "The prepared endorsement is awaiting Dean action." : "Available after eligibility is confirmed and staff prepares the endorsement."} />
      <StageCard number={5} title="The list is saved as a file" state={exported ? "complete" : status === "Dean Approved" ? "pending" : "locked"} helper={exported ? "The Dean-approved endorsed list has been downloaded as a CSV file." : status === "Dean Approved" ? "The Dean-approved list is ready for export." : "Available after Dean approval."} />
      <StageCard number={6} title="The Dean sends the list to the Registrar" state={exported ? "pending" : "locked"} helper={exported ? "The Dean must email the downloaded CSV through the official channel and wait for the Registrar's acknowledgement. The portal does not send this email." : "Available after the endorsed list is exported."} />
    </form>
  );
}
