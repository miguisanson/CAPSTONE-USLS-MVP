// The filter bar shared by every report and by Analytics: one labelled list per filter, the choices from the report's
// own options, and one "Clear filters" button when any is on.
import { Card, Field, Select } from "../../components/ui/index.js";
import { choicesFor } from "./reportConfig.js";

export default function ReportFilters({ specs, options, params, onChange, onClear }) {
  const active = specs.filter((spec) => params.get(spec.key)).length;
  return (
    <Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {specs.map((spec) => (
          <Field key={spec.key} label={spec.label}>
            <Select
              placeholder={spec.any || `Any ${spec.label.toLowerCase()}`}
              value={params.get(spec.key) || ""}
              onChange={(event) => onChange(spec.key, event.target.value)}
              options={choicesFor(spec, options)}
            />
          </Field>
        ))}
      </div>
      {active > 0 && (
        <button type="button" onClick={onClear} className="mt-3 cursor-pointer text-xs font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11">
          Clear filters
        </button>
      )}
    </Card>
  );
}
