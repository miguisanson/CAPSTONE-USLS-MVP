import { createContext, useCallback, useContext, useId, useRef, useState } from "react";
import { AlertTriangle, Eye, FileText } from "lucide-react";
import { Modal } from "./ui/Modal.jsx";

// In-app confirmation dialog (replaces the browser's native window.confirm, which
// looks different on every OS/browser). Usage:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, tone: "danger" })) { ... }
// `files: [{ name, url }]` (optional) lists the documents being confirmed, each with a View link that opens it in a new tab.
//
// Built on ui/Modal (size sm, confirm layer). Keyboard: Escape and the backdrop cancel. Enter does whatever the
// focused button does, and the focus starts on the SAFE button of a destructive dialog (Cancel), so pressing Enter
// can never confirm a destructive action (UI-SPEC AD1); a normal dialog starts on its confirm button.
export const ConfirmContext = createContext(null); // also read by ui/Modal (the "Discard your changes?" question)

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const current = useRef(null);
  const sequence = useRef(0);
  const messageId = useId();

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      // A second confirm replaces the first one: the first answer is "no", never left hanging.
      current.current?.resolve(false);
      sequence.current += 1;
      const next = {
        key: sequence.current,
        title: options.title || "Are you sure?",
        message: options.message || "",
        files: (options.files || []).filter((file) => file && file.url),
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
        resolve,
      };
      current.current = next;
      setDialog(next);
    });
  }, []);

  const close = useCallback((result) => {
    const open = current.current;
    current.current = null;
    setDialog(null);
    open?.resolve(result);
  }, []);

  const danger = dialog?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <Modal
          key={dialog.key}
          size="sm"
          layer="confirm"
          icon={AlertTriangle}
          tone={danger ? "danger" : "default"}
          title={dialog.title}
          describedBy={dialog.message ? messageId : undefined}
          onClose={() => close(false)}
          footer={
            <>
              <button type="button" className="btn-ghost" data-autofocus={danger ? "" : undefined} onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
              <button type="button" className={danger ? "btn-danger" : "btn-primary"} data-autofocus={danger ? undefined : ""} onClick={() => close(true)}>
                {dialog.confirmLabel}
              </button>
            </>
          }
        >
          {dialog.message && (
            <p id={messageId} className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>
          )}
          {dialog.files.length > 0 && (
            <div className="mt-3">
              <p className="eyebrow">{dialog.files.length === 1 ? "Attached document" : "Attached documents"}</p>
              <ul className="mt-1.5 space-y-1.5">
                {dialog.files.map((file) => (
                  <li key={file.url} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold text-ink">{file.name || "Uploaded PDF"}</span>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={`View ${file.name || "the uploaded PDF"} (opens in a new tab)`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used within a ConfirmProvider");
  return confirm;
}
