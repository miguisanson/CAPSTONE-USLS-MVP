import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Eye, MessageSquare } from "lucide-react";
import { Button, DataTable, EditableText, EmptyState, Field, InlineNotice, Input, StatCard, StatusChip, Textarea } from "../../components/ui/index.js";
import StepDialog from "../../components/StepDialog";
import WorkflowTimeline from "../../components/WorkflowTimeline";
import StageBoard, { BoardNotice, BoardSummary, boardSummaryLine, useBoardNotice } from "../../components/StageBoard";
import LeaveFilters, { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { EMPTY_FILTERS } from "../leave/leaveHelpers";
import { useOpenFilters } from "../leave/useOpenFilter";
import { formatDate } from "../../lib/format";
import ListExportButtons from "../../components/ListExportButtons";
import { CaseCardFacts, CaseCardShell, MessageNote, NextOwner, ProcessScopeNote, ReadyMark } from "../../components/process";
import { CaseMessageHistory, DemoResetButton, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, uniqueValues, useDemoCaseReset } from "./shared";

// I-252: the student's hours are a claim; the Academic Coordinator's verified total is what counts.
function hoursText(record) {
  if (!record) return "No hours yet";
  const reported = record.reported_hours ?? record.completed_hours;
  if (record.verified_hours == null) return reported ? `${reported} hrs reported, not verified` : "No hours reported yet";
  return `${record.verified_hours}/${record.required_hours} hrs verified`;
}

// The Academic Coordinator enters the hours verified from the certificates (and says why if they differ from the claim).
function VerifiedHoursForm({ record, student, onSave }) {
  const reported = record.reported_hours ?? record.completed_hours ?? 0;
  const [hours, setHours] = useState(record.verified_hours == null ? "" : String(record.verified_hours));
  const [note, setNote] = useState(record.hours_verified_note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const differs = hours !== "" && Number(hours) !== Number(reported);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave({ student_id: student.id, status: "Record Verified Hours", verified_hours: hours, verified_note: note.trim() });
    } catch (err) {
      setError(err.message || "Could not save the verified hours.");
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4" aria-label="Verify practicum hours">
      <p className="eyebrow">Verify the hours</p>
      <p className="meta mt-1">Reported by the student: <span className="font-semibold">{reported} hours</span> of {record.required_hours}. Count the hours on the certificates and enter the verified total.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Verified hours (total)" required>
          <Input type="number" min="0" step="1" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} />
        </Field>
        <Field label="Note" required={differs} hint={differs ? "Required because the total differs from what the student reported." : "Optional when the total matches the report."}>
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
      {error && <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>}
      <Button className="mt-3" disabled={busy || hours === "" || (differs && !note.trim())} onClick={save}>{busy ? "Saving…" : record.verified_hours == null ? "Save verified hours" : "Update verified hours"}</Button>
      {record.verified_hours != null && record.hours_verified_by && <p className="meta mt-2">Last verified by {record.hours_verified_by}{record.hours_verified_at ? ` on ${formatDate(record.hours_verified_at)}` : ""}.</p>}
    </div>
  );
}

// The confirm window of a practicum step: the one StepDialog. `onConfirm(payload)` throws to refuse (the message is shown inside).
function WorkflowTransitionModal({ slug, student, action, onClose, onConfirm }) {
  // The certificate stated no hours number: staff read the file and enter the hours here (owner 2026-11-08).
  const [hours, setHours] = useState("");
  const requiresReason = Boolean(action.requireReason);
  const requiresComment = requiresReason || Boolean(action.requireComment);
  const showsTransitionComment = requiresComment || ["practicum", "withdrawal", "graduation"].includes(slug);

  async function confirm(_key, comment) {
    const payload = {
      ...action.payload,
      ...(action.needsHours ? { completed_hours: hours.trim() } : {}),
      ...(comment ? { workflow_comment: comment } : {}),
      ...(requiresReason ? { return_reason: comment, staff_remarks: comment } : {}),
    };
    await onConfirm(payload);
  }

  return (
    <StepDialog
      title={`Confirm: ${action.label}`}
      subtitle={`${student.name} · ${student.student_number} · ${slug}`}
      from={action.fromStatus || "Current stage"}
      to={action.toStatus || action.label}
      explanation="This action is recorded against your signed-in account and preserves the submitted fields and files."
      actions={[{ key: "confirm", label: action.label, tone: action.destructive ? "reject" : "approve", requireComment: requiresComment }]}
      onConfirm={confirm}
      onCancel={onClose}
      withReason={showsTransitionComment}
      initialReason={action.reason || ""}
      reasonLabel={action.commentLabel || (requiresReason ? "Message / reason" : "Comment sent with this action")}
      reasonHint={requiresComment ? "Required for this step." : "Optional. Leave blank if there is nothing to add."}
      reasonPlaceholder={action.commentPlaceholder || (requiresReason ? "Tell the student what to correct or upload next." : "Add instructions or context for the next reviewer. Leave blank if there is nothing to add.")}
      requiredMessage={action.commentRequiredError || (requiresReason ? "Enter the exact reason before moving this request." : "Enter the required follow-through details before moving this request.")}
      validate={action.needsHours ? () => (/^\d{1,4}$/.test(hours.trim()) ? "" : "Enter the hours completed shown on the certificate, as a whole number.") : undefined}
    >
      {action.needsHours && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <label htmlFor="practicum-staff-hours" className="field-label">Hours completed (from the certificate)</label>
          <p className="meta mt-0.5">The system could not find an hours number in the uploaded file. Open the certificate and enter the hours it states.</p>
          <input id="practicum-staff-hours" type="number" min="0" step="1" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} className="field-input mt-2 w-40" />
        </div>
      )}
    </StepDialog>
  );
}

const PRACTICUM_BOARD_COLUMNS = [
  { label: "Awaiting Submission", description: "Waiting for the student's MOA.", statuses: ["Not Submitted"] },
  { label: "Submitted", description: "Staff receive the MOA and forward it.", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", description: "The Academic Coordinator checks the MOA.", statuses: ["MOA Under Review"] },
  { label: "Documents Review", description: "Certificates and hours are being checked.", statuses: ["Documents Submitted", "Hours Incomplete", "Documents Under Review"] },
  { label: "In Progress", description: "The student is completing the hours.", statuses: ["Practicum In Progress", "Additional Certificates Requested"] },
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

// Khloe's practicum card: name and number, a green card and "Ready for Dean review" when the report is with the Dean (a grey
// "Waiting for MOA" before the MOA is sent, "Waiting for documents" after it), a facts grid, the amber message box, "Next:", then View and Message.
function PracticumBoardCard({ row, onOpen, onMessage }) {
  const record = row.record;
  const readyForDean = practicumReadyForDeanReview(row);
  const ready = Boolean(row.has_submitted_documents) || readyForDean;
  const updated = row.last_activity_at || record?.updated_at;
  return (
    <CaseCardShell ready={ready}>
      {/* The mark sits under the name, not beside it: beside it the name was squeezed to a few letters per line. */}
      <div className="flex flex-col items-start gap-1.5">
        <div className="min-w-0 max-w-full">
          <p className="break-words text-sm font-semibold text-ink">{row.student.name}</p>
          <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
        </div>
        <ReadyMark ready={readyForDean} waiting={!ready} waitingLabel={record ? "Waiting for documents" : "Waiting for MOA"} />
      </div>
      <CaseCardFacts
        facts={[
          record?.practicum_site || "Site pending",
          hoursText(record),
          row.eligibility.status,
          updated ? `Updated ${formatDate(updated)}` : "",
          { text: record ? `Submitted ${formatDate(record.created_at)}` : "No practicum documents submitted", wide: true },
        ]}
      />
      <MessageNote messages={row.messages} />
      <NextOwner owner={row.next_action_owner || (record ? "Awaiting review" : "Student")} />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" icon={Eye} onClick={onOpen} className="flex-1" aria-label={`View details for ${row.student.name}`}>View</Button>
        {record && <Button variant="secondary" size="sm" icon={MessageSquare} onClick={onMessage} className="flex-1" aria-label={`Message ${row.student.name}`}>Message</Button>}
      </div>
    </CaseCardShell>
  );
}

export function PracticumRoster({ context, submit, submitting, refreshing, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const boardNotice = useBoardNotice(); // the one place this board says what happened
  const [viewMode, setViewMode] = useState("board");
  const [pendingAction, setPendingAction] = useState(null);
  const [moveRow, setMoveRow] = useState(null); // the card a drop or "Move to..." opened the confirm window for
  const reset = useDemoCaseReset("practicum", refetch);
  // A reset answers in the board notice too. The case window closes so the notice is not hidden behind it.
  useEffect(() => {
    if (!reset.resetMessage && !reset.resetError) return;
    boardNotice.show(reset.resetError ? "error" : "success", reset.resetError || reset.resetMessage);
    setSelectedStudentId(null);
  }, [reset.resetMessage, reset.resetError]); // eslint-disable-line react-hooks/exhaustive-deps
  // Eligible students, and every student who already has a practicum case (the home lists those cases too, so the board must).
  const rows = (context.roster || []).filter((row) => row.eligibility?.eligible === true || Boolean(row.record));
  const [filters, setFilters] = useOpenFilters(EMPTY_FILTERS);
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statusOptions = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")).map((value) => ({ value, label: value })), [rows]);
  // Newest activity first, like the other boards.
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.open || (Boolean(row.record) && row.record.status !== "Dean Reviewed")); // open: filed and not yet reviewed by the Dean
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
      return { label: "Forward documents to Academic Coordinator", payload: { ...base, status: "Documents Under Review" }, needsHours: Boolean(record.hours_need_entry) };
    }
    if (accountRole === "academic_coordinator" && record.status === "Documents Under Review" && row.hours_status !== "Complete") {
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" }, requireReason: true };
    }
    if (accountRole === "academic_coordinator" && record.status === "Documents Under Review" && row.hours_status === "Complete" && (record.certificate_count || 0) > 0) {
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

  // A confirmed step: the dialogs and the case window close, the board says what happened.
  async function confirmStep(payload) {
    const saved = await submit(payload, { strict: true });
    setPendingAction(null);
    setMoveRow(null);
    setSelectedStudentId(null);
    boardNotice.show("success", saved?.message || "Saved.");
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
      <ProcessScopeNote title="Program scope: Psychology and MSGC only">
        {context.practicum_program_scope?.description || "This roster includes only Psychology programs and the Master of Science in Guidance and Counseling (MSGC)."} Students from every other program are excluded from the practicum roster and actions.
      </ProcessScopeNote>
      <BoardSummary line={summaryLine} windowName="case window" />
      <BoardFilterRow toggle={<ViewToggle value={viewMode} onChange={setViewMode} />}>
        <LeaveFilters filters={filters} setFilters={setFilters} programs={programs} statusOptions={statusOptions} kindOptions={[]} count={filteredRows.length} total={rows.length} noun="students" />
      </BoardFilterRow>
      <ListExportButtons
        title="Practicum students"
        subtitle={`${filteredRows.length} of ${rows.length} students`}
        filename="practicum-students"
        columns={["Student ID", "Student name", "Program", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report"]}
        rows={filteredRows.map((row) => [row.student.student_number, row.student.name, row.student.program_code, row.eligibility?.status, row.moa_status, row.documents_status, row.record ? hoursText(row.record) : "", row.coordinator_review_status, row.dean_report_status])}
      />
      {viewMode === "board" ? (
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
          emptyText="No practicum students here"
          boardNotice={boardNotice}
        />
      ) : filteredRows.length === 0 ? (
        <>
          <BoardNotice notice={boardNotice.notice} onDismiss={boardNotice.dismiss} />
          <EmptyState title="No students match these filters" hint={rows.length ? "Clear a filter to see more." : "No eligible Psychology or MSGC practicum students found."} />
        </>
      ) : (
        <>
        <BoardNotice notice={boardNotice.notice} onDismiss={boardNotice.dismiss} />
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
                  <p>{row.record ? hoursText(row.record) : "—"}</p>
                  <StatusChip status={row.hours_status} dot={false} />
                </div>
              ),
            },
            { key: "coordinator", header: "Coordinator", sortValue: (row) => row.coordinator_review_status, cell: (row) => <StatusChip status={row.coordinator_review_status} dot={false} /> },
            { key: "dean", header: "Dean report", sortValue: (row) => row.dean_report_status, cell: (row) => <StatusChip status={row.dean_report_status} dot={false} /> },
            {
              key: "action",
              header: "Action",
              cell: (row) => <Button variant="secondary" size="sm" icon={Eye} onClick={() => openCase(row.student.id)} aria-label={`View details for ${row.student.name}`}>View</Button>,
            },
          ]}
        />
        </>
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
            {accountRole === "academic_coordinator" && selectedRow.record?.status === "Documents Under Review" && (
              <VerifiedHoursForm key={`${selectedRow.student.id}-${selectedRow.record.verified_hours ?? "none"}`} record={selectedRow.record} student={selectedRow.student} onSave={confirmStep} />
            )}
            <PracticumCaseDetails row={selectedRow} />
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="practicum" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { boardNotice.show("success", message || "Message sent."); setSelectedStudentId(null); await refetch(); }} />}
      {pendingAction && (moveRow || selectedRow) && <WorkflowTransitionModal slug="practicum" student={(moveRow || selectedRow).student} action={pendingAction} onClose={() => { setPendingAction(null); setMoveRow(null); }} onConfirm={confirmStep} />}
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
        <StatCard size="sm" label="Hours" value={record ? (record.hours_need_entry ? "Staff to enter" : record.verified_hours == null ? `Not verified (reported ${record.reported_hours ?? record.completed_hours})` : `${record.verified_hours}/${record.required_hours} verified`) : "Not started"} />
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
          {record && <p className="meta mt-1">Hours: {record.reported_hours ?? record.completed_hours} reported by the student · {record.verified_hours == null ? "not verified yet" : `${record.verified_hours} verified${record.hours_verified_by ? ` by ${record.hours_verified_by}` : ""}`}</p>}
          {record?.hours_verified_note && <p className="meta mt-1">Verification note: {record.hours_verified_note}</p>}
          {record?.remarks && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="eyebrow">Latest student submission remark</p>
              <div className="mt-1 text-sm text-slate-700"><EditableText edit={record.edits?.remarks} value={record.remarks} /></div>
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
