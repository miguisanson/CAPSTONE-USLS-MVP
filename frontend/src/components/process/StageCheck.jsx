import { Eye } from "lucide-react";
import { StatusChip } from "../ui/index.js";

// Khloe's stage check (packet khloe-ui): the ordered steps of one group (a graduation batch...) and where the group stands.
// `stages` is [{ number, label, detail, state }], state one of Complete / Current / Mixed / Needs action / Pending.
// Any process that works in groups gives its own list of steps and gets the strip, the window body and the overview for free.

const OPEN_STATES = ["Needs action", "Current", "Mixed", "Pending"];

export function stageCheckSummary(stages) {
  const current = stages.find((stage) => OPEN_STATES.includes(stage.state)) || stages[stages.length - 1];
  const completed = stages.filter((stage) => stage.state === "Complete").length;
  return { current, completed, total: stages.length, progress: stages.length ? Math.round((completed / stages.length) * 100) : 0 };
}

const NUMBER_CLASS = {
  Complete: "bg-brand-600 text-white",
  Current: "bg-amber-100 text-amber-800",
  Mixed: "bg-amber-100 text-amber-800",
  "Needs action": "bg-red-100 text-red-700",
};

/** The short form on a card: current step, "n/total", an eye button and a progress bar. */
export function StageCheckStrip({ stages, onOpen, openLabel = "Open stage check", label = "Stage check" }) {
  const { current, completed, total, progress } = stageCheckSummary(stages);
  return (
    <div role="group" aria-label={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{label}</p>
          <p className="mt-0.5 break-words text-sm font-semibold text-ink">Step {current.number}: {current.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusChip status={`${completed}/${total}`} tone="neutral" dot={false} size="sm" />
          {onOpen && (
            <button type="button" onClick={onOpen} aria-label={openLabel} className="btn-ghost inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center px-2 py-1.5 max-sm:min-h-11 max-sm:min-w-11">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200" data-testid="stage-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${completed} of ${total} steps complete`}>
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/** The full list: one row per step, a numbered circle, the state chip and a line saying what happens. */
export function StageCheck({ title, subtitle, stages }) {
  const { current } = stageCheckSummary(stages);
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {subtitle && <p className="meta">{subtitle}</p>}
        </div>
        <StatusChip status={`Step ${current.number}: ${current.state}`} tone="neutral" dot={false} />
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-2 2xl:grid-cols-2">
        {stages.map((stage) => (
          <li key={stage.label} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${NUMBER_CLASS[stage.state] || "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{stage.number}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                <StatusChip status={stage.state} dot={false} />
              </div>
              <p className="meta mt-1">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
