import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Field, InlineNotice, Modal, Textarea } from "../ui/index.js";

// Confirmation with a required reason, used before changing an imported value or
// removing a row. Esc cancels, Ctrl+Enter confirms, focus starts in the reason box.
// The window itself (focus, Tab trap, Esc, backdrop, scroll lock) is the library Modal; it stacks over the
// record panel, so only this window answers to Esc while it is open. Closing is blocked while it saves.
export default function ReasonDialog({
  title,
  message,
  confirmLabel = "Confirm",
  tone = "default",
  requireReason = true,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState("");
  const messageId = useId();
  const danger = tone === "danger";
  const canConfirm = !busy && (!requireReason || reason.trim().length >= 3);

  function onKeyDown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canConfirm) onConfirm(reason.trim());
  }

  return (
    <Modal
      title={title}
      icon={AlertTriangle}
      tone={danger ? "danger" : "default"}
      size="sm"
      onClose={onCancel}
      dismissible={!busy}
      closeLabel="Close"
      describedBy={message ? messageId : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} disabled={!canConfirm} onClick={() => onConfirm(reason.trim())}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {message && <p id={messageId} className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>}
        <Field label="Reason" required={requireReason} hint="Kept in the change history with your name and the time. Ctrl+Enter to confirm.">
          <Textarea
            data-autofocus=""
            className="min-h-24 resize-y"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: corrected against the registrar printout of 1 Oct 2026"
            maxLength={500}
          />
        </Field>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </div>
    </Modal>
  );
}
