import { Button } from "../../components/ui/index.js";

// Small shared pieces for the leave screen. (The success / error banner is InlineNotice from the library.)

// One step button of a case: the server's tone picks the look (primary, danger; "warn" is the secondary look like
// every other return button in the app).
const VARIANT = { primary: "primary", danger: "danger", warn: "secondary", secondary: "secondary" };

export function ActionButton({ action, onClick, disabled, children }) {
  return (
    <Button variant={VARIANT[action?.tone] || "secondary"} onClick={onClick} disabled={disabled}>
      {children || action.label}
    </Button>
  );
}

export function Block({ title, icon: Icon, hint, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="eyebrow flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />} {title}
      </h3>
      {hint && <p className="meta mt-1">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
