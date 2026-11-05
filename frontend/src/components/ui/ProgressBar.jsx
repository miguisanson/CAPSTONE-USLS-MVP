// A thin horizontal progress bar. `value` is 0-100 (clamped). Moved here from the old components/ui.jsx (Phase 5 P8).
export function ProgressBar({ value, className = "" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
