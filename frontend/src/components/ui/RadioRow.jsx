// A row of pill-shaped choices where exactly one is on. `options` are strings or { value, label }.
// Moved here from the old components/forms.jsx (Phase 5 P8).
export function RadioRow({ name, options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
              active ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
