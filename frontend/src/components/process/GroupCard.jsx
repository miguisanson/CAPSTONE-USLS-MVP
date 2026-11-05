import { StatusChip } from "../ui/index.js";
import { StageCheckStrip } from "./StageCheck.jsx";

// Khloe's group card (a graduation batch; later any list a process works through together).
// Anatomy, top to bottom: checkbox + name + "n candidates" + selection words + ONE status chip + badges;
// "Students:" and "Next:"; the stage-check strip; the footer buttons; the student list that opens in place.

/** A small mark under the title: tone "ready" (green), "warning" (amber) or "neutral". */
export function GroupBadge({ children, tone = "neutral" }) {
  const status = tone === "ready" ? "Approved" : tone === "warning" ? "Pending" : "Waiting for documents";
  return <StatusChip status={status} tone={tone === "ready" ? "success" : tone === "warning" ? "warning" : "neutral"} label={children} size="sm" dot={false} />;
}

export function selectionWords(selectedCount, total) {
  if (selectedCount === 0) return "Select batch";
  return selectedCount === total ? "Batch selected" : `${selectedCount}/${total} selected`;
}

/**
 * @param checkbox   the group's checkbox node (or null)
 * @param title      the group's name
 * @param count      "3 candidates" (words, already counted)
 * @param selection  the selection words, e.g. selectionWords(...)
 * @param chip       the ONE status chip
 * @param badges     array of <GroupBadge> nodes
 * @param facts      [{ label, value }]: "Students", "Next"
 * @param stages     the stage-check steps (see StageCheck) and `onOpenStages` opens the window
 * @param actions    footer buttons
 * @param children   what opens in place (the member list)
 */
export function GroupCard({ checkbox = null, title, count, selection = "", chip, badges = [], facts = [], stages, onOpenStages, openStagesLabel, actions = null, ready = false, selected = false, children = null }) {
  return (
    <article className={`rounded-xl border p-3 shadow-sm transition-colors ${ready ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : selected ? "border-brand-300 bg-brand-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        {checkbox}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-ink">{title}</p>
          <p className="meta mt-0.5">{count}{selection ? ` · ${selection}` : ""}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chip}
        {badges}
      </div>
      {facts.length > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-slate-200/70 pt-2 text-xs text-slate-600">
          {facts.map((fact) => (
            <p key={fact.label} className={fact.label === "Next" ? "break-words font-semibold text-brand-700" : "break-words"}>
              <span className={fact.label === "Next" ? "" : "font-semibold text-slate-700"}>{fact.label}:</span> {fact.value}
            </p>
          ))}
        </div>
      )}
      {stages && <div className="mt-3"><StageCheckStrip stages={stages} onOpen={onOpenStages} openLabel={openStagesLabel} /></div>}
      {actions && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-3">{actions}</div>}
      {children && <div className="mt-3 border-t border-slate-200/70 pt-3">{children}</div>}
    </article>
  );
}
