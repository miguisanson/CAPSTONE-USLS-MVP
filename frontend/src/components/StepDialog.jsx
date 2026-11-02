// StepDialog (I-152): the one dialog for a staff or Dean step that needs a confirm, a reason or a decision. Process boards,
// Practicum, Graduation and the gate panels all open this, so every step looks and behaves alike.
//
//   <StepDialog title="Return to student" subtitle="Maria Cruz - Leave of Absence" from="Under review" to="Returned"
//     explanation="The request goes back to the student."
//     actions={[{ key: "return", label: "Return to student", tone: "return", requireComment: true }]}
//     reasonLabel="What should the student fix?" onConfirm={(key, reason) => api.step(key, reason)} onCancel={close} />
//
// It is a Modal holding a DecisionPanel: the reason box asks for the reason in words (no native `required`; the refusal is a
// role="alert" next to the box and the box takes the focus), one button per action, Cancel. The focus goes back to the button
// that opened it (Modal does that). `onConfirm(key, reason)` must throw to refuse: the message is shown inside the dialog and
// the dialog stays open; when it returns the caller closes the dialog.
//
// Slots: `children` sit above the panel (what is being decided: the move, candidates); `extra` sits between the reason box
// and the buttons (a select, a checklist, batch fields).
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { DecisionPanel, Modal } from "./ui/index.js";

export const REASON_REQUIRED = "Please write the reason first. It is required for this step.";

export default function StepDialog({
  title,
  subtitle,
  from,
  to,
  explanation,
  actions,
  onConfirm,
  onCancel,
  withReason = true,
  reasonLabel,
  reasonHint,
  reasonRows,
  reasonPlaceholder,
  requiredMessage = REASON_REQUIRED,
  initialReason = "",
  error,
  validate,
  size = "md",
  children,
  extra,
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(initialReason);
  const needsReason = withReason && actions.some((action) => action.requireComment);

  async function decide(key, text) {
    setBusy(true);
    try {
      await onConfirm(key, text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} size={size} onClose={onCancel} dismissible={!busy} closeLabel="Cancel this step">
      <div className="space-y-4">
        {from && to && (
          <p className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700">
            <span>{from}</span>
            <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="text-brand-700">{to}</span>
          </p>
        )}
        {explanation && <p className="text-sm text-slate-600">{explanation}</p>}
        {children}
        <DecisionPanel
          variant="plain"
          actions={actions.map((action) => ({ confirm: false, ...action }))} // this dialog is the confirmation
          onDecide={decide}
          busy={busy}
          error={error}
          withComment={withReason}
          comment={reason}
          onCommentChange={setReason}
          commentLabel={reasonLabel || (needsReason ? "Reason" : "Note (optional)")}
          commentHint={reasonHint !== undefined ? reasonHint : actions.length > 1 ? undefined : needsReason ? "Required for this step." : "Kept with this step in the history."}
          commentPlaceholder={reasonPlaceholder}
          commentAutoFocus
          commentRows={reasonRows || (needsReason ? 4 : 3)}
          commentRequiredMessage={requiredMessage}
          validate={validate}
          onCancel={onCancel}
        >
          {extra}
        </DecisionPanel>
      </div>
    </Modal>
  );
}
