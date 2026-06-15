import { Check } from "lucide-react";

export function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="field-label">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} className={`field-input ${props.className || ""}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`field-input ${props.className || ""}`} rows={props.rows || 3} />;
}

export function Select({ options, placeholder = "Select…", ...props }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select {...props} className={`field-input cursor-pointer ${props.className || ""}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Checklist of "received" items. Checked = present, unchecked = missing.
export function CheckList({ items, selected, onToggle }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const isChecked = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
              isChecked
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                isChecked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {isChecked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className="font-medium">{item}</span>
          </button>
        );
      })}
    </div>
  );
}

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
