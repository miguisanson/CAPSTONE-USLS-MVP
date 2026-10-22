import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "../../api";
import { DecisionPanel, Field, Modal, Select, Textarea } from "../../components/ui/index.js";
import { statusLabelFor } from "./leaveHelpers";

const COMMENT_LABELS = {
  return: "What should the student fix? (the student will see this)",
  deny: "Why is it denied? (the student will see this)",
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

// The server's tone for a step -> the DecisionPanel look (danger = red, warn = a return, anything else = the main button).
const PANEL_TONE = { danger: "reject", warn: "return" };

/**
 * The one confirm box behind every step that needs a comment, a choice or a check:
 * the buttons in the case window, "Move to..." and drag and drop all open this.
 * It is a Modal holding a DecisionPanel (one comment box, one button, Cancel); the box asks nothing more, so
 * the panel does not ask a second time. `onConfirm(payload)` must call api.leaveCaseTransition; if it throws,
 * the message is shown inside the panel and the box stays open.
 */
export default function ActionDialog({ item, action, vocabulary, detail: detailProp = null, onCancel, onConfirm }) {
  const isForward = action.action === "forward";
  const checklist = item.checklist || [];
  const showChecklist = isForward && item.kind === "READMISSION" && checklist.length > 0;
  // Only Leave and Readmission have an eligibility result to choose.
  const showEligibility = isForward && (vocabulary?.eligibility_results || []).length > 0;

  const [detail, setDetail] = useState(detailProp);
  const [eligibility, setEligibility] = useState("");
  const [staffNotes, setStaffNotes] = useState(item.staff_notes || "");
  const [verified, setVerified] = useState(() => new Set(checklist.filter((row) => row.confirmed).map((row) => row.item)));
  const [busy, setBusy] = useState(false);

  // The policy check's advice is only on the full case, so fetch it when forwarding.
  useEffect(() => {
    if (!isForward || detailProp) return undefined;
    let active = true;
    api
      .processCase(item.slug, item.id)
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

  // Called by the panel once the comment rule is met. A refusal from the server is thrown back into the panel.
  async function decide(_key, comment) {
    const payload = { action: action.action };
    if (action.needs_comment || comment) payload.comment = comment;
    if (isForward) {
      if (showEligibility && eligibility) payload.eligibility_result = eligibility;
      if (staffNotes.trim()) payload.staff_notes = staffNotes.trim();
      if (showChecklist) payload.confirmed_items = checklist.filter((row) => verified.has(row.item)).map((row) => row.item);
    }
    setBusy(true);
    try {
      await onConfirm(payload);
    } catch (err) {
      setBusy(false);
      throw new Error(err?.message || "That step was refused.");
    }
  }

  return (
    <Modal
      title={action.label}
      subtitle={`${item.student.name} - ${item.kind_label}`}
      size="md"
      onClose={onCancel}
      dismissible={!busy}
      closeLabel="Cancel this step"
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700">
          <span>{fromLabel}</span>
          <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="text-brand-700">{toLabel}</span>
        </p>
        {(CONFIRM_TEXT[action.action] || action.confirm) && (
          <p className="text-sm text-slate-600">{CONFIRM_TEXT[action.action] || action.confirm}</p>
        )}

        <DecisionPanel
          variant="plain"
          actions={[
            {
              key: action.action,
              label: action.label,
              tone: PANEL_TONE[action.tone] || "approve",
              requireComment: Boolean(action.needs_comment),
              confirm: false, // this box is the confirmation
            },
          ]}
          onDecide={decide}
          busy={busy}
          withComment={!isForward}
          commentLabel={action.needs_comment ? COMMENT_LABELS[action.action] || "Reason" : "Note (optional)"}
          commentHint={action.needs_comment ? "Required for this step." : "Kept with this step in the history."}
          commentRows={action.needs_comment ? 4 : 3}
          commentRequiredMessage="Please write the reason first. It is required for this step."
          onCancel={onCancel}
        >
          {isForward && (
            <>
              {showEligibility && (
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
              )}

              {showChecklist && (
                <fieldset className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">Return checklist</legend>
                  <p className="meta mb-2">
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
                            <span className="meta block">
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
        </DecisionPanel>
      </div>
    </Modal>
  );
}
