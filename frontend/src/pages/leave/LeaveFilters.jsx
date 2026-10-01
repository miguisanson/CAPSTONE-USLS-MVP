import { Columns3, List, Search, SlidersHorizontal } from "lucide-react";
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

export default function LeaveFilters({ filters, setFilters, programs, statusOptions, reasons = [], kindOptions, count, total, noun = "requests" }) {
  const active = Object.values(filters).filter(Boolean).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={update("query")}
            className="field-input pl-10"
            placeholder="Search name, ID, program..."
            aria-label="Search requests by name, student number or program"
          />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter by program">
          <option value="">All programs</option>
          {programs.map((program) => (
            <option key={program} value={program}>{program}</option>
          ))}
        </select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter by status">
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {reasons.length > 0 && (
          <select value={filters.reason} onChange={update("reason")} className="field-input cursor-pointer" aria-label="Filter by reason">
            <option value="">All reasons</option>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        )}
        {kindOptions.length > 1 && (
          <select value={filters.kind} onChange={update("kind")} className="field-input cursor-pointer" aria-label="Filter by type of request">
            <option value="">All types</option>
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Showing {count} of {total} {noun}
        </span>
        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );
}
