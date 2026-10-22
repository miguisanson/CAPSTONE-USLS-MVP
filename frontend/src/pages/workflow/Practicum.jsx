import { useMemo, useState } from "react";
import { ArrowUpRight, Eye, MessageSquare } from "lucide-react";
import { Button, DataTable, EmptyState, Field, InlineNotice, StatCard, StatusChip, Textarea } from "../../components/ui/index.js";
import WorkflowTimeline from "../../components/WorkflowTimeline";
import StageBoard, { BoardSummary, boardSummaryLine } from "../../components/StageBoard";
import LeaveFilters, { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { EMPTY_FILTERS } from "../leave/leaveHelpers";
import { formatDate } from "../../lib/format";
import { CaseMessageHistory, DemoResetButton, DemoResetFeedback, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, WorkflowSubmitFeedback, uniqueValues, useDemoCaseReset } from "./shared";

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
      footer={<Button type="submit" form={`${slug}-confirm-transition-form`} variant={action.destructive ? "danger" : "primary"} loading={busy}>{busy ? "Saving…" : action.label}</Button>}
    >
      <form id={`${slug}-confirm-transition-form`} onSubmit={confirm} className="space-y-4">
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="eyebrow">Workflow movement</p>
          <p className="mt-2 text-sm font-semibold text-ink">{action.fromStatus || "Current stage"} <span className="mx-1 text-slate-400">→</span> {action.toStatus || action.label}</p>
          <p className="meta mt-1">This action is recorded against your signed-in account and preserves the submitted fields and files.</p>
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
  { label: "Awaiting Submission", description: "Waiting for the student's MOA.", statuses: ["Not Submitted"] },
  { label: "Submitted", description: "Staff receive the MOA and forward it.", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", description: "The Academic Coordinator checks the MOA.", statuses: ["MOA Under Review"] },
  { label: "Documents Review", description: "Certificates and hours are being checked.", statuses: ["Documents Submitted", "Documents Under Review"] },
  { label: "In Progress", description: "The student is completing the hours.", statuses: ["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"] },
  { label: "Completion Review", description: "Hours verified. The report goes to the Dean.", statuses: ["Completed"] },
  { label: "Completed", description: "The Dean has the report or has reviewed it.", statuses: ["Report Sent to Dean", "Dean Reviewed"] },
  { label: "Returned", description: "Sent back to the student to correct.", statuses: ["Returned for Clarification", "Not Accepted - New Organization Required"] },
];

// The same columns for the shared StageBoard (each needs a key).
const PRACTICUM_STAGE_COLUMNS = PRACTICUM_BOARD_COLUMNS.map((column) => ({ ...column, key: column.label }));
const practicumBoardItemId = (row) => row.student.id;
const practicumBoardColumnKey = (row) =>
  PRACTICUM_STAGE_COLUMNS.find((column) => column.statuses.includes(row.record?.status || "Not Submitted"))?.key || "";

function practicumReadyForDeanReview(row) {
  return row.record?.status === "Report Sent to Dean";
}

function PracticumBoardCard({ row, onOpen }) {
  const record = row.record;
  const readyForDean = practicumReadyForDeanReview(row);
  const ready = Boolean(row.has_submitted_documents) || readyForDean;
  const latestMessage = row.messages?.[0];
  const updated = row.last_activity_at || record?.updated_at;
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition-colors ${ready ? "border-brand-300 hover:border-brand-500" : "border-slate-200 hover:border-slate-300"}`}>
      <p className="text-sm font-semibold text-ink">{row.student.name}</p>
      <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
      {readyForDean ? <StatusChip className="mt-2" status="Ready for Dean review" size="sm" dot={false} /> : !ready && <StatusChip className="mt-2" status="Waiting for documents" tone="muted" size="sm" dot={false} />}
      <p className="mt-2.5 text-xs font-medium text-slate-700">{record?.practicum_site || "Site pending"}</p>
      <p className="mt-0.5 text-xs text-slate-500">{record ? `${record.completed_hours}/${record.required_hours} hrs` : "No hours yet"} · {row.eligibility.status}</p>
      <p className="mt-0.5 text-xs text-slate-500">{record ? `Submitted ${formatDate(record.created_at)}` : "No practicum documents submitted"}</p>
      {updated && <p className="mt-0.5 text-xs text-slate-500">Updated {formatDate(updated)}</p>}
      {row.messages?.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          <p className="eyebrow !text-amber-800">{row.messages.length} visible message{row.messages.length === 1 ? "" : "s"}</p>
          <p className="mt-1 line-clamp-2 text-xs text-amber-900">{latestMessage?.comment || latestMessage?.template}</p>
        </div>
      )}
      <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {row.next_action_owner || (record ? "Awaiting review" : "Student")}</p>
      <Button variant="secondary" size="sm" icon={Eye} onClick={onOpen} className="mt-3 w-full" aria-label={`View details for ${row.student.name}`}>View details</Button>
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
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statusOptions = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")).map((value) => ({ value, label: value })), [rows]);
  // Newest activity first, like the other boards.
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status);
  }).sort((left, right) => new Date(right.last_activity_at || right.record?.updated_at || 0).getTime() - new Date(left.last_activity_at || left.record?.updated_at || 0).getTime()), [rows, filters]);

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

  // How many cards sit in each column, over every eligible student (the filters below narrow the board, not this line).
  const summaryLine = useMemo(() => {
    const totals = {};
    rows.forEach((row) => {
      const key = practicumBoardColumnKey(row);
      totals[key] = (totals[key] || 0) + 1;
    });
    return boardSummaryLine(PRACTICUM_STAGE_COLUMNS, totals, "practicum students");
  }, [rows]);

  return (
    <div className="page-stack">
      {messageNotice && <InlineNotice tone="success" onDismiss={() => setMessageNotice("")}>{messageNotice}</InlineNotice>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <BoardSummary line={summaryLine} windowName="case window" />
      <BoardFilterRow toggle={<ViewToggle value={viewMode} onChange={setViewMode} />}>
        <LeaveFilters filters={filters} setFilters={setFilters} programs={programs} statusOptions={statusOptions} kindOptions={[]} count={filteredRows.length} total={rows.length} noun="students" />
      </BoardFilterRow>
      {filteredRows.length === 0 ? (
        <EmptyState title="No recent practicum submissions match the filters." hint={rows.length ? "Clear a filter to see more." : "No eligible Psychology or MSGC practicum students found."} />
      ) : viewMode === "board" ? (
        <StageBoard
          ariaLabel="Practicum workflow board"
          columns={PRACTICUM_STAGE_COLUMNS}
          items={filteredRows}
          getItemId={practicumBoardItemId}
          getColumnKey={practicumBoardColumnKey}
          renderCard={(row) => <PracticumBoardCard key={row.student.id} row={row} onOpen={() => openCase(row.student.id)} />}
          canDrag={(row) => Boolean(practicumMoveFor(row))}
          lockReason={practicumLockReason}
          checkMove={practicumCheckMove}
          onMove={movePracticumRow}
          emptyText="No requests here"
        />
      ) : (
        <DataTable
          caption="Practicum students"
          rows={filteredRows}
          rowKey={(row) => row.student.id}
          minWidth="lg"
          onRowClick={(row) => openCase(row.student.id)}
          columns={[
            {
              key: "student",
              header: "Student",
              sortValue: (row) => row.student.name,
              cell: (row) => (
                <div>
                  <p className="text-sm font-semibold text-ink">{row.student.name}</p>
                  <p className="meta">{row.student.student_number} · {row.student.program_code}</p>
                </div>
              ),
            },
            { key: "eligibility", header: "Eligibility", sortValue: (row) => row.eligibility.status, cell: (row) => <StatusChip status={row.eligibility.status} dot={false} /> },
            { key: "moa", header: "MOA", sortValue: (row) => row.moa_status, cell: (row) => <StatusChip status={row.moa_status} dot={false} /> },
            { key: "documents", header: "Documents", sortValue: (row) => row.documents_status, cell: (row) => <StatusChip status={row.documents_status} dot={false} /> },
            {
              key: "hours",
              header: "Hours",
              sortValue: (row) => row.record?.completed_hours ?? -1,
              cell: (row) => (
                <div className="space-y-1">
                  <p>{row.record ? `${row.record.completed_hours}/${row.record.required_hours}` : "—"}</p>
                  <StatusChip status={row.hours_status} dot={false} />
                </div>
              ),
            },
            { key: "coordinator", header: "Coordinator", sortValue: (row) => row.coordinator_review_status, cell: (row) => <StatusChip status={row.coordinator_review_status} dot={false} /> },
            { key: "dean", header: "Dean report", sortValue: (row) => row.dean_report_status, cell: (row) => <StatusChip status={row.dean_report_status} dot={false} /> },
            {
              key: "action",
              header: "Action",
              cell: (row) => <Button variant="secondary" size="sm" icon={Eye} onClick={() => openCase(row.student.id)}>Open case</Button>,
            },
          ]}
        />
      )}
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
              {selectedRow.record && <Button variant="secondary" icon={MessageSquare} onClick={() => setMessageRow(selectedRow)}>Message / Return</Button>}
              {selectedAction ? (
                <div>
                  <Button disabled={submitting || refreshing} onClick={() => setPendingAction({ ...selectedAction, fromStatus: selectedRow.record.status, toStatus: selectedAction.payload.status })}>
                    {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                  </Button>
                  {selectedAction.label === "Request additional certificates" && <p className="mt-1 text-xs font-semibold text-red-700">*Incomplete hours</p>}
                </div>
              ) : (
                <span className="meta self-center font-semibold">{selectedRow.record ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "Awaiting student submission."}</span>
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
  const unavailable = record?.moa_attachment?.file_exists === false || record?.certificate_attachment?.file_exists === false;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard size="sm" label="Eligibility" value={row.eligibility.status} badge />
        <StatCard size="sm" label="MOA" value={row.moa_status} badge />
        <StatCard size="sm" label="Documents" value={row.documents_status} badge />
        <StatCard size="sm" label="Hours" value={record ? `${record.completed_hours}/${record.required_hours}` : "Not started"} />
        <StatCard size="sm" label="Supervisor" value={record?.supervisor_name || "Not provided"} />
        <StatCard size="sm" label="Completion" value={record?.completion_status || "Pending"} />
      </div>
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Automatic eligibility</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {row.eligibility.checklist.map((item) => (
              <div key={item.key} className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                  {item.note && <p className="meta">{item.note}</p>}
                </div>
                <p className="meta font-semibold">{String(item.actual_value ?? item.actual)}{item.required_value != null ? ` / ${item.required_value}` : ""}</p>
                <StatusChip status={item.status || (item.complete ? "Passed" : "Not met")} dot={false} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">Student submission</p>
          <p className="mt-2 text-sm font-semibold text-ink">{record?.practicum_site || "No site submitted"}</p>
          <p className="meta mt-1">Supervisor: {record?.supervisor_name || "Not provided"}</p>
          <p className="meta mt-1">System-detected certificate submissions: {record?.certificate_count || 0}</p>
          {record?.remarks && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="eyebrow">Latest student submission remark</p>
              <p className="mt-1 text-sm text-slate-700">{record.remarks}</p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {record?.moa_attachment?.file_exists && <Button as="a" variant="secondary" size="sm" icon={ArrowUpRight} href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA</Button>}
            {record?.completion_attachments?.map((file, index) => file.file_exists && (
              <Button key={file.id} as="a" variant="secondary" size="sm" icon={ArrowUpRight} href={file.url} target="_blank" rel="noreferrer">Certificate file {index + 1}</Button>
            ))}
            {unavailable && <StatusChip status="Missing" label="One or more saved files are unavailable" dot={false} />}
          </div>
        </div>
      </div>
      <WorkflowTimeline steps={timeline} title="Practicum workflow timeline" />
      <WorkflowFileHistory files={record?.attachments || []} />
    </div>
  );
}
