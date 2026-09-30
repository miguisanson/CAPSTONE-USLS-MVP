import { useEffect, useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "../../api";
import { ErrorNote } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import ModalShell from "./ModalShell";
import { statusLabelFor } from "./leaveHelpers";

const COMMENT_LABELS = {
  return: "What should the student fix? (the student will see this)",
  revoke: "Why is this leave being cancelled? (the student will see this)",
  confirm_awol: "Confirm the student is AWOL: what did you do to reach them?",
};

const CONFIRM_TEXT = {
  confirm_awol:
    "The leave ended and no return was filed. Confirming records that the student did not come back. Only continue if you are sure.",
  revoke: "This cancels an approved leave before it begins. The student is told.",
  return: "The request goes back to the student, who corrects it and sends it again.",
  forward: "The request goes to the Dean, who decides. Nothing is decided yet.",
};

/**
 * The one confirm box behind every step that needs a comment, a choice or a check:
 * the buttons in the case window, "Move to..." and drag and drop all open this.
 * `onConfirm(payload)` must call api.leaveCaseTransition; if it throws, the message is
 * shown here and the box stays open.
 */
export default function ActionDialog({ item, action, vocabulary, detail: detailProp = null, onCancel, onConfirm }) {
  const formId = useId();
  const isForward = action.action === "forward";
  const checklist = item.checklist || [];
  const showChecklist = isForward && item.kind === "READMISSION" && checklist.length > 0;

  const [detail, setDetail] = useState(detailProp);
  const [comment, setComment] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [staffNotes, setStaffNotes] = useState(item.staff_notes || "");
  const [verified, setVerified] = useState(() => new Set(checklist.filter((row) => row.confirmed).map((row) => row.item)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The policy check's advice is only on the full case, so fetch it when forwarding.
  useEffect(() => {
    if (!isForward || detailProp) return undefined;
    let active = true;
    api
      .leaveCase(item.id)
      .then((res) => active && setDetail(res.case))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isForward, detailProp, item.id]);

  const recommendation = detail?.policy_review?.recommendation || "";
  const unverified = showChecklist ? checklist.filter((row) => !verified.has(row.item)) : [];
  const fromLabel = item.status_label;
  const toLabel = statusLabelFor(vocabulary, action.to);

  function toggleVerified(name) {
    setVerified((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (action.needs_comment && !comment.trim()) {
      setError("Please write the reason first. It is required for this step.");
      return;
    }
    const payload = { action: action.action };
    if (action.needs_comment || comment.trim()) payload.comment = comment.trim();
    if (isForward) {
      if (eligibility) payload.eligibility_result = eligibility;
      if (staffNotes.trim()) payload.staff_notes = staffNotes.trim();
      if (showChecklist) payload.confirmed_items = checklist.filter((row) => verified.has(row.item)).map((row) => row.item);
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(payload);
    } catch (err) {
      setError(err?.message || "That step was refused.");
      setBusy(false);
    }
  }

  const confirmStyle =
    action.tone === "danger"
      ? "btn bg-red-600 text-white hover:bg-red-700"
      : action.tone === "warn"
        ? "btn bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200"
        : "btn-primary";

  return (
    <ModalShell
      id={`leave-action-${item.id}-${action.action}`}
      title={action.label}
      subtitle={`${item.student.name} - ${item.kind_label}`}
      onClose={() => !busy && onCancel()}
      layer="z-[60]"
      closeLabel="Cancel this step"
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost px-4 py-2">
            Cancel
          </button>
          <button type="submit" form={formId} disabled={busy} className={`${confirmStyle} px-4 py-2`}>
            {busy ? "Working..." : action.label}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700">
          <span>{fromLabel}</span>
          <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="text-brand-700">{toLabel}</span>
        </p>
        {CONFIRM_TEXT[action.action] && <p className="text-sm text-slate-600">{CONFIRM_TEXT[action.action]}</p>}

        {isForward && (
          <>
            <Field
              label="Eligibility result"
              hint={
                recommendation
                  ? `Advice from the policy check: ${recommendation}. The Dean decides.`
                  : "The policy check decides this for you unless you choose a result."
              }
            >
              <Select
                value={eligibility}
                onChange={(event) => setEligibility(event.target.value)}
                options={vocabulary?.eligibility_results || []}
                placeholder={`Use the policy check result${recommendation ? ` (${recommendation})` : ""}`}
              />
            </Field>

            {showChecklist && (
              <fieldset className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-700">Return checklist</legend>
                <p className="mb-2 text-xs text-slate-500">
                  Tick each item you have checked yourself. Anything left unticked reaches the Dean as Needs Review.
                </p>
                <ul className="space-y-2">
                  {checklist.map((row) => (
                    <li key={row.item}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={verified.has(row.item)}
                          onChange={() => toggleVerified(row.item)}
                          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-ink">{row.item}</span>
                          <span className="block text-xs text-slate-500">
                            {row.checked ? "The student ticked this." : "The student has not ticked this."} Tick to mark it verified by staff.
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {unverified.length > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    {unverified.length} item{unverified.length === 1 ? " is" : "s are"} not verified yet.
                  </p>
                )}
              </fieldset>
            )}

            <Field label="Note for the Dean" hint="Optional. Staff and the Dean can see it.">
              <Textarea value={staffNotes} onChange={(event) => setStaffNotes(event.target.value)} rows={3} />
            </Field>
          </>
        )}

        {action.needs_comment && (
          <Field label={COMMENT_LABELS[action.action] || "Reason"} required>
            <Textarea
              data-autofocus=""
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              required
              aria-invalid={Boolean(error) && !comment.trim()}
            />
          </Field>
        )}

        <div aria-live="polite">
          <ErrorNote message={error} />
        </div>
      </form>
    </ModalShell>
  );
}
