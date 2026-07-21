import { useId, useState } from "react";
import { ChevronDown, History } from "lucide-react";

export default function HistoryDisclosure({
  label = "View logs",
  hideLabel = "Hide logs",
  count,
  children,
  className = "",
  contentClassName = "mt-3",
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-brand-700" />
          <span>{open ? hideLabel : label}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          {Number.isFinite(count) && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
              {count}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div id={contentId} className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  );
}
