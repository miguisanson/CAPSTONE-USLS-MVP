import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

// In-app confirmation dialog (replaces the browser's native window.confirm, which
// looks different on every OS/browser). Usage:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, tone: "danger" })) { ... }
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        title: options.title || "Are you sure?",
        message: options.message || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
        resolve,
      });
    });
  }, []);

  const close = useCallback(
    (result) => {
      setDialog((current) => {
        if (current) current.resolve(result);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
      if (event.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const danger = dialog?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={() => close(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lift animate-fade-up">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-ink">{dialog.title}</h2>
                {dialog.message && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => close(false)} className="btn-ghost">
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={
                  danger
                    ? "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer"
                    : "btn-primary"
                }
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used within a ConfirmProvider");
  return confirm;
}
