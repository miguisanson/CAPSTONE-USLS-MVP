// HistoryPanel (UI-SPEC section 4 "HistoryPanel" row, idea X-05): the one way to show a record's history / audit trail.
//
//   <HistoryPanel entries={[{ id, title, at, actor, actorRole, from, to, note }]} label="View history" count={n} />
//   <HistoryPanel label="Who did what">any free content</HistoryPanel>        (what components/HistoryDisclosure.jsx is)
//
// A HistoryPanel is a disclosure: a full-width toggle button with a clock icon, an optional count bubble and a chevron,
// and the content under it. The content is either the `entries` list (newest first) or the `children` the caller gives.
// The toggle is a real button (Enter and Space), carries aria-expanded / aria-controls, and its look is exactly the old
// HistoryDisclosure, which is now a thin wrapper around this file.
import { useId, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, History } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import { Button } from "./Button.jsx";
import { EmptyState } from "./Feedback.jsx";
import { StatusChip } from "./StatusChip.jsx";

const timeOf = (entry) => {
  const t = new Date(entry?.at).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Newest first. Entries with no usable time keep their given order, after the ones that have one. Stable. */
function newestFirst(entries) {
  return entries
    .map((entry, index) => ({ entry, index, t: timeOf(entry) }))
    .sort((a, b) => {
      if (a.t === null && b.t === null) return a.index - b.index;
      if (a.t === null) return 1;
      if (b.t === null) return -1;
      return b.t - a.t || a.index - b.index;
    })
    .map((row) => row.entry);
}

function Entry({ entry }) {
  const { title, at, actor, actorRole, from, to, note } = entry;
  const who = [actor, actorRole && actor ? `(${actorRole})` : actorRole].filter(Boolean).join(" ");
  const changed = (from || to) && from !== to;
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 break-words font-semibold text-ink">{title || "Update"}</p>
        {at && (
          <time className="shrink-0 text-xs text-slate-500" dateTime={at}>
            {formatDateTime(at)}
          </time>
        )}
      </div>
      {who && <p className="mt-0.5 break-words text-xs text-slate-500">{who}</p>}
      {changed && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {from && <StatusChip status={from} size="sm" dot={false} />}
          {from && to && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
          {to && <StatusChip status={to} size="sm" dot={false} />}
        </p>
      )}
      {note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{note}</p>}
    </li>
  );
}

/** The entry list on its own (no toggle). Used by HistoryPanel; exported for a page that must show it always open. */
export function HistoryList({ entries = [], title, emptyText = "Nothing has happened on this record yet.", limit, sort = "newest", className = "" }) {
  const [all, setAll] = useState(false);
  const titleId = useId();
  const rows = useMemo(() => (sort === "newest" ? newestFirst(entries) : entries), [entries, sort]);
  const cut = Number.isFinite(limit) && limit > 0 && !all && rows.length > limit;
  const shown = cut ? rows.slice(0, limit) : rows;
  return (
    <div className={className}>
      {title && (
        <p id={titleId} className="eyebrow mb-2">
          {title}
        </p>
      )}
      {!rows.length ? (
        <EmptyState size="sm" title={emptyText} />
      ) : (
        <>
          <ol aria-labelledby={title ? titleId : undefined} className="space-y-2">
            {shown.map((entry, index) => (
              <Entry key={entry.id ?? `${entry.at}-${index}`} entry={entry} />
            ))}
          </ol>
          {cut && (
            <Button variant="secondary" size="sm" className="mt-2 w-full sm:w-auto" onClick={() => setAll(true)}>
              Show all {rows.length}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param entries          [{ id, title, at (ISO time), actor, actorRole, from, to (status words), note }]; shown newest first
 * @param title            small heading above the list ("Stage history")
 * @param label, hideLabel the toggle's words when closed / open (defaults "View history" / "Hide history")
 * @param count            number in the bubble; defaults to entries.length when `entries` is used; none for children
 * @param defaultOpen      start open
 * @param emptyText        what an empty trail says (default "Nothing has happened on this record yet.")
 * @param limit            show only the newest N, with a "Show all" button
 * @param sort             "newest" (default) | "given" (keep the order the caller sent)
 * @param children         free content instead of `entries` (this is how HistoryDisclosure uses it)
 * @param contentClassName classes of the box under the toggle (default "mt-3")
 */
export function HistoryPanel({
  entries,
  title,
  label = "View history",
  hideLabel = "Hide history",
  count,
  defaultOpen = false,
  emptyText,
  limit,
  sort = "newest",
  children,
  className = "",
  contentClassName = "mt-3",
  ...rest
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const bubble = count !== undefined ? count : Array.isArray(entries) ? entries.length : undefined;
  return (
    <div className={className} {...rest}>
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
          {Number.isFinite(bubble) && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-bold leading-5 text-slate-500">{bubble}</span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div id={contentId} className={contentClassName}>
          {Array.isArray(entries) && children == null ? (
            <HistoryList entries={entries} title={title} emptyText={emptyText} limit={limit} sort={sort} />
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
