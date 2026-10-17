import { createContext, useCallback, useContext, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./ui/Modal.jsx";

// In-app confirmation dialog (replaces the browser's native window.confirm, which
// looks different on every OS/browser). Usage:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, tone: "danger" })) { ... }
//
// Built on ui/Modal (size sm, confirm layer). Keyboard: Escape and the backdrop cancel. Enter does whatever the
// focused button does, and the focus starts on the SAFE button of a destructive dialog (Cancel), so pressing Enter
// can never confirm a destructive action (UI-SPEC AD1); a normal dialog starts on its confirm button.
const ConfirmContext = createContext(null);

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
