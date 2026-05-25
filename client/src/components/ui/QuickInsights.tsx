import { Info, Lightbulb } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";

type Props = {
  title: string;
  summary: string;
  points?: string[];
  recommendation?: string;
  className?: string;
};

export const QuickInsights = ({ title, summary, points, recommendation, className }: Props) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onWindowClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    if (!open) return;
    window.addEventListener("mousedown", onWindowClick);
    return () => window.removeEventListener("mousedown", onWindowClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`Quick insights: ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gs-primary)] text-white shadow-sm transition hover:bg-[var(--gs-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gs-primary)] focus-visible:ring-offset-2"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label="Quick Insights panel"
          className="absolute left-1/2 top-8 z-40 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-[var(--gs-border)] bg-white p-3 shadow-xl sm:left-auto sm:right-0 sm:w-80 sm:translate-x-0"
        >
          <div className="mb-2 flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 text-[var(--gs-primary)]" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">Section-level context</p>
            </div>
          </div>
          <p className="text-sm text-slate-700">{summary}</p>
          {points?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {points.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          ) : null}
          {recommendation ? (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
              <span className="font-semibold">What to do:</span> {recommendation}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
