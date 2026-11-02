import { useRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/**
 * Tabs (I-157): the one page-level tab strip. Every page that switches between a few views of the same page uses it, so the
 * look and the keyboard are the same everywhere.
 *
 *   <Tabs label="Graduation views" tabs={[{ key: "roster", label: "Roster", icon: Users, count: 3 }]} value={tab} onChange={setTab} />
 *
 * A tablist: one tab stop (the selected tab), Left / Right move the selection and the focus (wrapping), Home / End jump to the
 * first / last. The caller shows the content of the selected tab.
 */
export function Tabs({ label, tabs, value, onChange, className = "" }) {
  const refs = useRef([]);

  function onKeyDown(event, index) {
    const last = tabs.length - 1;
    const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target].key);
    refs.current[target]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cx("flex flex-wrap gap-2", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key || "main"}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 max-sm:min-h-11",
              selected ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {tab.count ? <span className={cx("rounded-full px-1.5 py-0.5 text-2xs", selected ? "bg-white/25" : "bg-slate-100 text-slate-600")}>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
