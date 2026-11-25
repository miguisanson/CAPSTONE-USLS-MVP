import { SlidersHorizontal } from "lucide-react";
import { Button } from "./Button.jsx";
import { SearchInput } from "./Feedback.jsx";
import { Field, Select } from "./Field.jsx";

const cx = (...parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/**
 * FilterBar (owner feedback 2026-11-23, stage 4): the one filter row for every list and board. Search first, then the
 * selects in the same grid, then one line under them: what is shown on the left, "Clear n filters" and the page's
 * actions (Export, Print) on the right.
 *
 *   <FilterBar search={{ value: q, onChange: setQ, placeholder: "Search students", label: "Search students" }}
 *              active={2} onClear={clear} summary="Showing 12 of 40 students" actions={<Button>Export CSV</Button>}>
 *     <FilterSelect label="Program" placeholder="All programs" value={program} onChange={...} options={programs} />
 *   </FilterBar>
 *
 * Every control has a short visible label above it ("Search", "Program", "Status"), so a chosen value never hides what
 * the control filters. The search box's accessible name stays the longer `search.label`.
 *
 * @param search   props for SearchInput (value, onChange, placeholder, label); omit for no search box
 * @param active   how many filters are set; with `onClear` it shows "Clear n filters"
 * @param summary  "Showing ..." text (or a node)
 * @param chips    extra nodes after the summary (a removable "Open requests only" chip)
 * @param actions  buttons at the right end of the bottom line
 */
export function FilterBar({ search, children, active = 0, onClear, summary, chips, actions, className = "", ...rest }) {
  const clear = active > 0 && onClear;
  const foot = summary || chips || actions || clear;
  const { shownLabel = "Search", ...searchProps } = search || {};
  return (
    <div {...rest} data-filter-box="" className={cx("rounded-xl border border-slate-200 bg-slate-50/70 p-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {search && <SearchInput placeholder="Search" {...searchProps} aria-label={searchProps.label} label={shownLabel} showLabel />}
        {children}
      </div>
      {foot && (
        <div className="meta mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex flex-wrap items-center gap-2">
            {summary}
            {chips}
          </span>
          <span className="inline-flex flex-wrap items-center gap-2">
            {clear && (
              <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={onClear}>
                Clear {active} filter{active === 1 ? "" : "s"}
              </Button>
            )}
            {actions}
          </span>
        </div>
      )}
    </div>
  );
}

/** A labelled select for a FilterBar: `<FilterSelect label="Program" placeholder="All programs" ... />` (Select props). */
export function FilterSelect({ label, ...props }) {
  return (
    <Field label={label}>
      <Select {...props} />
    </Field>
  );
}
