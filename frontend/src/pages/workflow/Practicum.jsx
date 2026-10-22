import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Info,
  ArrowUpRight,
  Eye,
  MessageSquare,
} from "lucide-react";
import { SectionTitle, StatusBadge, EmptyState, ErrorNote } from "../../components/ui";
import { Field, Input, Textarea, Select } from "../../components/forms";
import WorkflowTimeline from "../../components/WorkflowTimeline";
import StageBoard from "../../components/StageBoard";
import { ViewToggle } from "../leave/LeaveFilters";
import { formatDate } from "../../lib/format";
import { CaseMessageHistory, DemoResetButton, DemoResetFeedback, Detail, RosterFilters, SubmitButton, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, WorkflowSubmitFeedback, uniqueValues, useDemoCaseReset } from "./shared";

function WorkflowTransitionModal({ slug, student, action, busy, onClose, onConfirm }) {
  const [comment, setComment] = useState(action.reason || "");
  const [error, setError] = useState("");
  const requiresReason = Boolean(action.requireReason);
  const requiresComment = requiresReason || Boolean(action.requireComment);
  const showsTransitionComment = requiresComment || ["practicum", "withdrawal", "graduation"].includes(slug);

  async function confirm(event) {
    event.preventDefault();
    const cleanComment = comment.trim();
    if (requiresComment && !cleanComment) {
      setError(action.commentRequiredError || (requiresReason ? "Enter the exact reason before moving this request." : "Enter the required follow-through details before moving this request."));
      return;
    }
    setError("");
    const payload = {
      ...action.payload,
      ...(cleanComment ? { workflow_comment: cleanComment } : {}),
      ...(requiresReason ? {
        return_reason: cleanComment,
        staff_remarks: cleanComment,
      } : {}),
    };
    const saved = await onConfirm(payload);
    if (saved) onClose();
  }

  return (
    <WorkflowCaseModal
      id={`${slug}-confirm-transition-${student.id}`}
      title={`Confirm: ${action.label}`}
      subtitle={`${student.name} · ${student.student_number} · ${slug}`}
      onClose={onClose}
      size={["practicum", "graduation"].includes(slug) ? "wide" : "default"}
      footer={<button type="submit" form={`${slug}-confirm-transition-form`} disabled={busy} className={action.destructive ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}>{busy ? "Saving…" : action.label}</button>}
    >
      <form id={`${slug}-confirm-transition-form`} onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow movement</p>
          <p className="mt-2 text-sm font-semibold text-ink">{action.fromStatus || "Current stage"} <span className="mx-1 text-slate-300">→</span> {action.toStatus || action.label}</p>
          <p className="mt-1 text-xs text-slate-500">This action is recorded against your signed-in account and preserves the submitted fields and files.</p>
        </div>
        {showsTransitionComment && (
          <Field label={action.commentLabel || (requiresReason ? "Message / reason" : "Comment sent with this action")} required={requiresComment}>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required={requiresComment}
              placeholder={action.commentPlaceholder || (requiresReason ? "Tell the student what to correct or upload next." : "Add instructions or context for the next reviewer. Leave blank if there is nothing to add.")}
            />
          </Field>
        )}
      </form>
    </WorkflowCaseModal>
  );
}

const PRACTICUM_BOARD_COLUMNS = [
  { label: "Awaiting Submission", statuses: ["Not Submitted"] },
  { label: "Submitted", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", statuses: ["MOA Under Review"] },
  { label: "Documents Review", statuses: ["Documents Submitted", "Documents Under Review"] },
  { label: "In Progress", statuses: ["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"] },
  { label: "Completion Review", statuses: ["Completed"] },
  { label: "Completed", statuses: ["Report Sent to Dean", "Dean Reviewed"] },
  { label: "Returned", statuses: ["Returned for Clarification", "Not Accepted - New Organization Required"] },
];

// The same columns for the shared StageBoard (each needs a key).
const PRACTICUM_STAGE_COLUMNS = PRACTICUM_BOARD_COLUMNS.map((column) => ({ ...column, key: column.label }));
const practicumBoardItemId = (row) => row.student.id;
const practicumBoardColumnKey = (row) =>
  PRACTICUM_STAGE_COLUMNS.find((column) => column.statuses.includes(row.record?.status || "Not Submitted"))?.key || "";

function practicumReadyForDeanReview(row) {
  return row.record?.status === "Report Sent to Dean";
}

function withdrawalReadyForDeanReview(item) {
  return item.status === "Dean Review";
}

function PracticumBoardCard({ row, onOpen, onMessage }) {
  const record = row.record;
  const readyForDean = practicumReadyForDeanReview(row);
  const ready = Boolean(row.has_submitted_documents) || readyForDean;
  const latestMessage = row.messages?.[0];
  return (
    <article key={row.student.id} className={`rounded-xl border p-3 shadow-sm transition-colors ${ready ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{row.student.name}</p><p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p></div>{readyForDean ? <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span> : !ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span>{record?.practicum_site || "Site pending"}</span><span className="text-right">{record ? `${record.completed_hours}/${record.required_hours} hrs` : "No hours yet"}</span><span>{row.eligibility.status}</span><span className="text-right">Updated {formatDate(row.last_activity_at || record?.updated_at)}</span><span className="col-span-2">{record ? `Submitted ${formatDate(record.created_at)}` : "No practicum documents submitted"}</span></div>
      {row.messages?.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{row.messages.length} visible message{row.messages.length === 1 ? "" : "s"}</p><p className="mt-1 line-clamp-2 text-xs text-amber-900">{latestMessage?.comment || latestMessage?.template}</p></div>}
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {row.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button>{record && <button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button>}</div>
    </article>
  );
}

export function PracticumRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [pendingAction, setPendingAction] = useState(null);
  const [moveRow, setMoveRow] = useState(null); // the card a drop or "Move to..." opened the confirm window for
  const reset = useDemoCaseReset("practicum", refetch);
  const rows = (context.roster || []).filter((row) => row.eligibility?.eligible === true);
  const [filters, setFilters] = useState({ query: "", program: "", status: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")), [rows]);
  const filteredRows = useMemo(() => sortWorkflowRows(rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.secondary || row.eligibility.status === filters.secondary)
      && dateMatches(row.last_activity_at || row.record?.updated_at || row.record?.created_at, filters.dateFrom, filters.dateTo);
  }), filters.sort, (row) => row.last_activity_at || row.record?.updated_at || row.record?.created_at, (row) => row.student.name), [rows, filters]);

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
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" }, requireReason: true };
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

  // ---- the board: a move is the same step as the button in the case window ---------------
  // The step for a card is the one actionFor() gives; it can be moved only to the column that
  // step really leads to. A step that stays in the same column is done from the case window.
  function practicumMoveFor(row) {
    const action = actionFor(row);
    if (!action) return null;
    const from = practicumBoardColumnKey(row);
    const to = PRACTICUM_STAGE_COLUMNS.find((column) => column.statuses.includes(action.payload.status));
    return to && to.key !== from ? { action, to } : null;
  }
  function practicumLockReason(row) {
    if (!row.record) return "Waiting for: Student";
    const action = actionFor(row);
    if (action) return `Open the case to: ${action.label}`;
    return `Waiting for: ${row.next_action_owner || "the next reviewer"}`;
  }
  function practicumCheckMove(row, column) {
    const move = practicumMoveFor(row);
    if (move && move.to.key === column.key) return { allowed: true };
    if (move) return { allowed: false, reason: `From here you can: ${move.action.label}.` };
    return { allowed: false, reason: practicumLockReason(row) };
  }
  function movePracticumRow(row) {
    const move = practicumMoveFor(row);
    if (!move) throw new Error(practicumLockReason(row));
    setMoveRow(row);
    setPendingAction({ ...move.action, fromStatus: row.record.status, toStatus: move.action.payload.status });
    return undefined;
  }

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Practicum student submissions" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · Psychology and MSGC students only`} icon={Briefcase} />
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Program scope: Psychology and MSGC only</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-800">
            {context.practicum_program_scope?.description || "This roster includes only Psychology programs and the Master of Science in Guidance and Counseling (MSGC)."} Students from every other program are excluded from the practicum roster and actions.
          </p>
        </div>
      </div>
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not eligible", "Needs verification"]} count={filteredRows.length} total={rows.length} />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      {filteredRows.length > 0 && viewMode === "board" ? (
        <StageBoard
          ariaLabel="Practicum workflow board"
          columns={PRACTICUM_STAGE_COLUMNS}
          items={filteredRows}
          getItemId={practicumBoardItemId}
          getColumnKey={practicumBoardColumnKey}
          renderCard={(row) => <PracticumBoardCard key={row.student.id} row={row} onOpen={() => openCase(row.student.id)} onMessage={() => setMessageRow(row)} />}
          canDrag={(row) => Boolean(practicumMoveFor(row))}
          lockReason={practicumLockReason}
          checkMove={practicumCheckMove}
          onMove={movePracticumRow}
          emptyText="No requests here"
          columnClassName="w-[300px]"
        />
      ) : viewMode === "board" ? <EmptyState title="No recent practicum submissions match the filters." /> : <WorkflowTable
        headers={["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]}
        empty="No eligible Psychology or MSGC practicum students found."
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
          size="wide"
          footer={(
            <>
              {accountRole === "staff" && selectedRow.record && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedRow.record && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedAction ? (
                <div><button type="button" disabled={submitting || refreshing} onClick={() => setPendingAction({ ...selectedAction, fromStatus: selectedRow.record.status, toStatus: selectedAction.payload.status })} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>{selectedAction.label === "Request additional certificates" && <p className="mt-1 text-xs font-semibold text-red-600">*Incomplete hours</p>}</div>
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
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="practicum" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {pendingAction && (moveRow || selectedRow) && <WorkflowTransitionModal slug="practicum" student={(moveRow || selectedRow).student} action={pendingAction} busy={submitting || refreshing} onClose={() => { setPendingAction(null); setMoveRow(null); }} onConfirm={submit} />}
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
            <p className="mt-1 text-xs text-slate-500">System-detected certificate submissions: {record?.certificate_count || 0}</p>
            {record?.remarks && <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Latest student submission remark</p><p className="mt-1 text-sm text-emerald-900">{record.remarks}</p></div>}
            <div className="mt-2 flex flex-wrap gap-2">{record?.moa_attachment?.file_exists && <a className="btn-ghost px-3 py-1.5" href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA <ArrowUpRight className="h-3.5 w-3.5" /></a>}{record?.completion_attachments?.map((file, index) => file.file_exists && <a key={file.id} className="btn-ghost px-3 py-1.5" href={file.url} target="_blank" rel="noreferrer">Certificate file {index + 1} <ArrowUpRight className="h-3.5 w-3.5" /></a>)}{(record?.moa_attachment?.file_exists === false || record?.certificate_attachment?.file_exists === false) && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">One or more saved files are unavailable</span>}</div>
          </div>
      </div>
      <WorkflowTimeline steps={timeline} title="Practicum workflow timeline" />
      <WorkflowFileHistory files={record?.attachments || []} />
    </div>
  );
}

function WorkflowTable({ headers, rows, render, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

function dateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

function sortWorkflowRows(rows, sort, dateFor, nameFor) {
  return [...rows].sort((left, right) => {
    if (sort === "student") return nameFor(left).localeCompare(nameFor(right));
    const leftDate = new Date(dateFor(left) || 0).getTime();
    const rightDate = new Date(dateFor(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

function StudentCell({ student }) {
  return <td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p></td>;
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
    status: "Under Review",
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
      status: current?.status || "Under Review",
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
        hint={`${selected.program_code} is outside the Psychology and MSGC practicum scope.`}
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Certificates detected by system</p><p className="mt-1 text-lg font-semibold text-emerald-950">{current?.certificate_count || 0}</p></div>
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
      <p className="text-xs text-slate-500">Reviewer comments are added through the case discussion so the sender, recipient, date, and time remain visible.</p>
      {!completeEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Completed hours are below the requirement. Saving will keep this case incomplete and queue the student for additional certificates.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save practicum status</SubmitButton>
    </form>
  );
}
