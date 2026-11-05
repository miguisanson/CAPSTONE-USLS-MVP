import { useState } from "react";
import { Button, StatusChip } from "../ui/index.js";
import { StageCheckStrip } from "./StageCheck.jsx";

// Khloe's "Created graduation batches": one row per group, so every group and where it stands is visible without scrolling the board.
// `groups`: [{ id, label, count, updated, students, next, chip, badges, stages }]. `onOpen(group)` opens the stage-check window.
export function GroupOverview({ title, hint, ariaLabel = title, noun = "batch", nounPlural = "batches", groups, onOpen, openLabel = (group) => `Open stage check for ${group.label}`, limit = 4 }) {
  const [all, setAll] = useState(false);
  if (!groups.length) return null;
  const shown = all ? groups : groups.slice(0, limit);
  return (
    <section aria-label={ariaLabel} className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {hint && <p className="meta mt-0.5">{hint}</p>}
        </div>
        <StatusChip status={`${groups.length} ${groups.length === 1 ? noun : nounPlural}`} tone="neutral" dot={false} />
      </div>
      <ul className="space-y-2">
        {shown.map((group) => (
          <li key={group.id} className={`rounded-xl border px-3 py-2 ${group.ready ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50/60"}`}>
            <div className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,1fr)_minmax(260px,1.2fr)] lg:items-center">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{group.label}</p>
                <p className="meta">{group.count}{group.updated ? ` · Updated ${group.updated}` : ""}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">{group.chip}{group.badges}</div>
              </div>
              <div className="min-w-0 text-xs text-slate-600">
                <p className="break-words"><span className="font-semibold text-slate-700">Students:</span> {group.students}</p>
                <p className="mt-0.5 break-words font-semibold text-brand-700">Next: {group.next}</p>
              </div>
              <StageCheckStrip stages={group.stages} onOpen={() => onOpen(group)} openLabel={openLabel(group)} />
            </div>
          </li>
        ))}
      </ul>
      {groups.length > limit && (
        <Button variant="secondary" size="sm" className="mt-3" aria-expanded={all} onClick={() => setAll((value) => !value)}>
          {all ? "Show fewer" : `Show all ${groups.length}`}
        </Button>
      )}
    </section>
  );
}
