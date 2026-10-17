// Field, Input, Select, Textarea (UI-SPEC sections 4 and 5). A Field wraps one control with its label, hint and error
// and tells the control, through context, which hint/error element describes it and whether it is required or invalid.
// Input, Select and Textarea also work on their own (outside a Field) exactly like the plain elements.
import { createContext, forwardRef, useContext, useId } from "react";

const FieldContext = createContext(null);

/**
 * @param label     the visible label text
 * @param hint      help text under the control (`.meta`)
 * @param error     error text under the control; marks the control invalid and is announced (role="alert")
 * @param required  adds the red * and aria-required on the control (it does not add the native `required` attribute)
 */
export function Field({ label, hint, error, required, children }) {
  const base = useId();
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ describedBy, invalid: Boolean(error), required: Boolean(required) }}>
      <label className="block">
        <span className="field-label">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {children}
        {hint && <span id={hintId} className="meta mt-1 block">{hint}</span>}
        {error && <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
      </label>
    </FieldContext.Provider>
  );
}

// aria props from the surrounding Field; props the caller passes always win. Returns only the ones that apply.
function useFieldProps(props, invalidProp) {
  const field = useContext(FieldContext);
  const describedBy = props["aria-describedby"] ?? field?.describedBy;
  const required = props["aria-required"] ?? (field?.required ? true : undefined);
  const invalid = props["aria-invalid"] ?? (invalidProp || field?.invalid ? true : undefined);
  const aria = {};
  if (describedBy) aria["aria-describedby"] = describedBy;
  if (required !== undefined) aria["aria-required"] = required;
  if (invalid !== undefined) aria["aria-invalid"] = invalid;
  return { aria, isInvalid: invalid === true || invalid === "true" };
}

const INVALID = "border-red-400 ring-2 ring-red-100";
const join = (...parts) => parts.filter(Boolean).join(" ");

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  const { aria, isInvalid } = useFieldProps(props, invalid);
  return <input ref={ref} {...props} {...aria} className={join("field-input", isInvalid && INVALID, className)} />;
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  const { aria, isInvalid } = useFieldProps(props, invalid);
  return <textarea ref={ref} {...props} {...aria} rows={rows} className={join("field-input", isInvalid && INVALID, className)} />;
});

export const Select = forwardRef(function Select({ options = [], placeholder = "Select…", className, invalid, ...props }, ref) {
  const { aria, isInvalid } = useFieldProps(props, invalid);
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select ref={ref} {...props} {...aria} className={join("field-input cursor-pointer", isInvalid && INVALID, className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value} disabled={Boolean(o.disabled)}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
