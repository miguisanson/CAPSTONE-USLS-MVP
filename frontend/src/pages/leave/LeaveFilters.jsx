import { Columns3, List, X } from "lucide-react";
import { Button, Card, FilterBar, FilterSelect } from "../../components/ui/index.js";
import { EMPTY_FILTERS } from "./leaveHelpers";

export function ViewToggle({ value, onChange }) {
  const button = (key, label, Icon) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      aria-pressed={value === key}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
        value === key ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Choose how to show the requests">
      {button("board", "Board", Columns3)}
      {button("table", "Table", List)}
    </div>
  );
}

/**
 * The line above every board: the filter box and the Board/Table toggle. One layout for all boards, so they wrap alike:
 * the box never shrinks below ~18 rem (it takes the whole row when it must), and on a phone the toggle drops to its own row.
 */
/**
 * Owner feedback 2026-11-23 (stage 5): every staff board sits in one card with its filters, as the Research Gate board does.
 */
export function BoardFrame({ children, className = "" }) {
  return (
    <Card pad="lg" data-board-frame="" className={`flex min-w-0 flex-col gap-3 ${className}`}>
      {children}
    </Card>
  );
}

export function BoardFilterRow({ children, toggle }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-72">{children}</div>
      {toggle}
    </div>
  );
}

/**
 * UX-16 (2026-11-20): `extra` (Export CSV / Print) sits on the filter box's bottom line, beside "Showing ...";
 * `moreFilters` adds a control to the grid (Research Gate's year admitted), so the box is the one filter row.
 */
export default function LeaveFilters({ filters, setFilters, programs, statusOptions, reasons = [], kindOptions, count, total, noun = "requests", extra = null, moreFilters = null }) {
  const active = Object.values(filters).filter(Boolean).length;
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const update = (key) => (event) => set(key, event.target.value);
  return (
    <FilterBar
      search={{ value: filters.query, onChange: (value) => set("query", value), placeholder: "Search students", label: "Search requests by name, student number or program" }}
      active={active}
      onClear={() => setFilters(EMPTY_FILTERS)}
      summary={total != null ? `Showing ${count} of ${total} ${noun}` : null}
      chips={filters.open && (
        <Button variant="secondary" size="sm" icon={X} aria-label="Open requests only: select to show every request" onClick={() => set("open", false)}>
          Open requests only
        </Button>
      )}
      actions={extra}
    >
      <FilterSelect label="Program" value={filters.program} onChange={update("program")} options={programs} placeholder="All programs" aria-label="Filter by program" />
      <FilterSelect label="Status" value={filters.status} onChange={update("status")} options={statusOptions} placeholder="All statuses" aria-label="Filter by status" />
      {reasons.length > 0 && (
        <FilterSelect label="Reason" value={filters.reason} onChange={update("reason")} options={reasons} placeholder="All reasons" aria-label="Filter by reason" />
      )}
      {kindOptions.length > 1 && (
        <FilterSelect label="Type of request" value={filters.kind} onChange={update("kind")} options={kindOptions} placeholder="All types" aria-label="Filter by type of request" />
      )}
      {moreFilters}
    </FilterBar>
  );
}
