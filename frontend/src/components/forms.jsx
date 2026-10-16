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
        <option key={o.value} value={o.value} disabled={Boolean(o.disabled)}>
          {o.label}
        </option>
      ))}
    </select>
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
