import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ErrorNote } from "../ui";

// Confirmation with a required reason, used before changing an imported value or
// removing a row. Esc cancels, Ctrl+Enter confirms, focus starts in the reason box.
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
  const areaRef = useRef(null);
  const titleId = useId();
  const danger = tone === "danger";
  const canConfirm = !busy && (!requireReason || reason.trim().length >= 3);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canConfirm) onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lift animate-fade-up">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold text-ink">{title}</h2>
            {message && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>}
          </div>
        </div>
        <label className="mt-4 block">
          <span className="field-label">Reason {requireReason && <span className="text-red-500">*</span>}</span>
          <textarea
            ref={areaRef}
            className="field-input min-h-24 resize-y"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: corrected against the registrar printout of 1 Oct 2026"
            maxLength={500}
          />
          <span className="mt-1 block text-xs text-slate-500">Kept in the change history with your name and the time. Ctrl+Enter to confirm.</span>
        </label>
        {error && <div className="mt-3"><ErrorNote message={error} /></div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
            className={danger
              ? "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              : "btn-primary"}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
