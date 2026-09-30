import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CheckSquare, Eye, RotateCcw, AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import { StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { DeanDialog } from "./DeanParts";
import { AgeBadge, casePath } from "./DeanShared";
import { isLeaveDecisionDue } from "./DeanLeaveParts";

const ACTIONS = {
  approve: { label: "Approve selected", confirm: "Approve selected", needsComment: false },
  return: { label: "Return selected", confirm: "Return selected for revision", needsComment: true },
  deny: { label: "Deny selected", confirm: "Deny selected", needsComment: true },
};

// Table of Leave / Readmission / AWOL cases waiting for the Dean, with a tick box on every
// case that can be part of a group decision.
export function LeavePendingTable({ items, selectedIds, onToggle, onToggleAll }) {
  const selectable = items.filter(isLeaveDecisionDue);
  const allSelected = selectable.length > 0 && selectable.every((item) => selectedIds.has(item.id));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
            <th className="w-10 px-3 py-2">
              {selectable.length > 0 && (
                <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(selectable, !allSelected)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label="Select every case waiting for a decision" />
              )}
            </th>
            <th className="px-3 py-2">Student</th>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Waiting</th>
            <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canSelect = isLeaveDecisionDue(item);
            return (
              <tr key={`${item.type}-${item.id}`} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-3">
                  {canSelect && (
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${item.student?.name || item.title} for a group decision`} />
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{item.student?.name || item.title}</p>
                  <p className="text-xs text-slate-400">{item.student?.student_number} · {item.student?.program_code}</p>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  <p className="font-medium text-slate-700">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.case ? `Case #${item.case.id} · ` : ""}{item.subtitle}</p>
                </td>
                <td className="px-3 py-3">
                  {item.case ? leaveCaseStatusBadge(item.case) : <StatusBadge value={item.workflow_status || item.status} dot={false} />}
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs text-slate-500">{formatDate(item.submitted_at)}</p>
                  <AgeBadge value={item.submitted_at} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Link to={casePath(item)} className="btn-ghost px-3 py-1.5 text-xs" aria-label={`Review ${item.title}`}>
                    <Eye className="h-3.5 w-3.5" /> Review
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Buttons shown above the table once at least one case is ticked.
export function LeaveBatchBar({ count, onPick, onClear }) {
  if (!count) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2">
      <p className="mr-auto text-sm font-semibold text-brand-800">{count} selected</p>
      <button type="button" onClick={() => onPick("approve")} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> {ACTIONS.approve.label}</button>
      <button type="button" onClick={() => onPick("return")} className="btn-ghost px-3 py-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> {ACTIONS.return.label}</button>
      <button type="button" onClick={() => onPick("deny")} className="btn-ghost px-3 py-1.5 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {ACTIONS.deny.label}</button>
      <button type="button" onClick={onClear} className="text-xs font-semibold text-brand-700 hover:underline">Clear selection</button>
    </div>
  );
}

// Confirm dialog: one decision (and one comment) for every selected case.
export function LeaveBatchModal({ action, rows, onClose, onSaved }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const spec = ACTIONS[action] || ACTIONS.approve;

  async function submit(event) {
    event.preventDefault();
    if (spec.needsComment && !comment.trim()) {
      setError(action === "deny" ? "Enter the reason for denying these requests." : "Enter what the students need to fix.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.leaveCasesBatch({ case_ids: rows.map((item) => item.id), action, comment: comment.trim() });
      setResult(response);
      await onSaved(response);
    } catch (err) {
      setError(err.message || "Could not apply the group decision.");
    } finally {
      setBusy(false);
    }
  }

  const skipped = result?.skipped || [];
  const updated = result?.updated || [];
  return (
    <DeanDialog
      id="dean-leave-batch"
      title={result ? "Group decision finished" : `Confirm: ${spec.label}`}
      subtitle={`${rows.length} selected request${rows.length === 1 ? "" : "s"}. The same decision and comment apply to every one.`}
      onClose={onClose}
      footer={result
        ? <button type="button" onClick={onClose} className="btn-primary cursor-pointer px-4 py-2">Done</button>
        : <button type="submit" form="dean-leave-batch-form" disabled={busy} className={action === "deny" ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}><CheckSquare className="h-4 w-4" /> {busy ? "Saving…" : spec.confirm}</button>}
    >
      {result ? (
        <div className="space-y-4">
          <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{result.message || `${updated.length} request${updated.length === 1 ? "" : "s"} updated.`}</p>
          {updated.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">Updated</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">{updated.map((row) => <li key={row.case_id}>{row.student_name} · Case #{row.case_id}</li>)}</ul>
            </div>
          )}
          {skipped.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Not changed</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">{skipped.map((row) => <li key={row.case_id}>{row.student_name} · Case #{row.case_id}: {row.reason}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <form id="dean-leave-batch-form" onSubmit={submit} className="space-y-4">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              {spec.needsComment ? (action === "deny" ? "Reason for denying (required)" : "What needs to be fixed (required)") : "Comment for the students (optional)"}
            </span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} required={spec.needsComment} className="field-input min-h-28" />
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">Selected requests</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {rows.map((item) => (
                <li key={item.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <p className="font-semibold text-ink">{item.student?.name}</p>
                  <p className="text-xs text-slate-500">{item.student?.student_number} · {item.student?.program_code} · {item.title} · Case #{item.id}</p>
                  {item.case?.policy_review?.suggested_dean_action && <p className="mt-1 text-xs text-slate-500">Policy advice: {item.case.policy_review.suggested_dean_action} (advice only)</p>}
                </li>
              ))}
            </ul>
          </div>
        </form>
      )}
    </DeanDialog>
  );
}
