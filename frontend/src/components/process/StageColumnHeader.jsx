// The header of a board column in Khloe's layout: an optional number in a circle (only for the stages before the real workflow
// starts), the stage name, one sentence of what the column holds, and the count. Use it as StageBoard's `renderColumnHeader`.
// `total` (when a filter hides some cards) shows "2 of 5"; `countLabel` replaces the screen-reader name of the count.
export function StageColumnHeader({ column, count, total = count, number = null, countLabel = null, children = null }) {
  return (
    <header className="mb-3 space-y-2">
      <div className="flex items-start gap-2.5">
        {number != null && (
          <span data-testid="stage-number" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700 text-sm font-bold text-white">{number}</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="section-title break-words">{column.label}</h3>
          {column.description && <p className="meta mt-1 leading-relaxed">{column.description}</p>}
        </div>
        <span className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200" aria-label={countLabel || (total !== count ? `${count} shown of ${total}` : `${count} in ${column.label}`)}>{total !== count ? `${count} of ${total}` : count}</span>
      </div>
      {children}
    </header>
  );
}
