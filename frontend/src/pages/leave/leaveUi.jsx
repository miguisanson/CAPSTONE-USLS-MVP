import { AlertTriangle, CheckCircle2, X } from "lucide-react";

// Small shared pieces for the leave screen.

export function ActionButton({ action, onClick, disabled, children }) {
  const tone = action?.tone || "secondary";
  const styles = {
    primary: "btn-primary",
    danger: "btn bg-red-600 text-white hover:bg-red-700",
    warn: "btn bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200",
    secondary: "btn-ghost",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${styles[tone] || styles.secondary} px-4 py-2`}>
      {children || action.label}
    </button>
  );
}

export function Banner({ tone = "success", children, onDismiss }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
        error ? "border-red-200 bg-red-50 text-red-700" : "border-brand-200 bg-brand-50 text-brand-800"
      }`}
    >
      {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="cursor-pointer rounded p-0.5 hover:bg-black/5" aria-label="Dismiss message">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Block({ title, icon: Icon, hint, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />} {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
