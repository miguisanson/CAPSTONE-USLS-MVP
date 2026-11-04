import { Select } from "../ui/index.js";

// Office hours for booking a defense: 8:00 AM to 5:00 PM in 30-minute steps (a time outside them is not offered).
const OPEN = 8 * 60;
const CLOSE = 17 * 60;
const STEP = 30;
const pad = (n) => String(n).padStart(2, "0");
const toValue = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const toLabel = (minutes) => `${Math.floor(minutes / 60) % 12 || 12}:${pad(minutes % 60)} ${minutes < 720 ? "AM" : "PM"}`;
const toMinutes = (value) => { const m = /^(\d{2}):(\d{2})/.exec(value || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** A pick of time slots instead of a typed time. `after` ("HH:MM") hides slots at or before it (use on the end time). A value already set (a suggested slot) stays offered. */
export default function TimeSlotSelect({ value, after = "", ...rest }) {
  const first = toMinutes(after) === null ? OPEN : Math.max(OPEN, toMinutes(after) + STEP);
  const last = toMinutes(after) === null ? CLOSE - STEP : CLOSE;
  const minutes = [];
  for (let m = first; m <= last; m += STEP) minutes.push(m);
  const options = minutes.map((m) => ({ value: toValue(m), label: toLabel(m) }));
  const current = toMinutes(value);
  if (current !== null && !minutes.includes(current)) options.push({ value: toValue(current), label: toLabel(current) });
  options.sort((a, b) => a.value.localeCompare(b.value));
  return <Select {...rest} value={value} options={options} placeholder="Choose time" />;
}
