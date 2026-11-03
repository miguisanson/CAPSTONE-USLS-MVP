import { useEffect, useState } from "react";
import { api } from "../api";
import { InlineNotice, Select } from "../components/ui/index.js";

// Schedule assistance stays inside the existing offering row and its Save action.
export default function TeachingSchedule({ offering, facultyId, termId, value, onChange, disabled, refreshKey, conflict }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.teachingSchedules({ mode: "options", offering_id: offering.id, faculty_id: facultyId || "", term_id: termId }).then((response) => {
      if (!Array.isArray(response.options)) throw new Error("Restart the app to load the schedule dropdown, then refresh this page.");
      if (active) setOptions(response.options);
    }).catch((err) => { if (active) { setError(err.message); setOptions([]); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offering.id, facultyId, termId, refreshKey]);
  const choices = options.map((option) => ({
    value: option.label,
    label: option.label,
    className: option.recommended ? "bg-brand-50 font-semibold text-brand-800" : undefined,
    disabled: option.selectable === false,
  }));
  const selected = options.find((option) => option.label === value);
  return <div className="w-72 max-w-full space-y-1">
    <Select aria-label={`Schedule for ${offering.code}`} value={selected ? value : ""} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || Boolean(error)} placeholder={loading ? "Loading schedules…" : "Choose a class schedule"} options={choices} />
    {value && !selected && !loading && !error && <InlineNotice tone="warning">The saved schedule does not match the current available choices. Choose a time within the faculty member’s availability.</InlineNotice>}
    {value && selected?.caution && <InlineNotice tone="warning">{selected.caution}</InlineNotice>}
    {!loading && !error && !options.length && <p className="text-sm text-slate-600">No class schedule fits the recorded available days and hours.</p>}
    {conflict && <p role="alert" className="text-sm text-red-700">{conflict}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
