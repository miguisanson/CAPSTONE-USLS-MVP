import { Columns3, List, SlidersHorizontal } from "lucide-react";
import { Button, SearchInput, Select } from "../../components/ui/index.js";
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
export function BoardFilterRow({ children, toggle }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-72">{children}</div>
      {toggle}
    </div>
  );
}

export default function LeaveFilters({ filters, setFilters, programs, statusOptions, reasons = [], kindOptions, count, total, noun = "requests" }) {
  const active = Object.values(filters).filter(Boolean).length;
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const update = (key) => (event) => set(key, event.target.value);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.query}
          onChange={(value) => set("query", value)}
          placeholder="Search students"
          label="Search requests by name, student number or program"
        />
        <Select value={filters.program} onChange={update("program")} options={programs} placeholder="All programs" aria-label="Filter by program" />
        <Select value={filters.status} onChange={update("status")} options={statusOptions} placeholder="All statuses" aria-label="Filter by status" />
        {reasons.length > 0 && (
          <Select value={filters.reason} onChange={update("reason")} options={reasons} placeholder="All reasons" aria-label="Filter by reason" />
        )}
        {kindOptions.length > 1 && (
          <Select value={filters.kind} onChange={update("kind")} options={kindOptions} placeholder="All types" aria-label="Filter by type of request" />
        )}
      </div>
      <div className="meta mt-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          Showing {count} of {total} {noun}
        </span>
        {active > 0 && (
          <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear {active} filter{active === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </div>
  );
}
