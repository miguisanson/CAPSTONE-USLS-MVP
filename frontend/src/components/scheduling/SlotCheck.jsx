import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { api } from "../../api";
import { longDate } from "./dates";

// Live conflict check for a chosen slot. Waits ~400 ms after the last change, ignores
// answers that arrive after a newer change, and stays silent until date + both times are set.
export function useSlotCheck({ studentId, date, start, end, defenseType, venue, manuscriptReceivedOn }) {
  const [state, setState] = useState({ result: null, error: "", pending: false });
  const ticket = useRef(0);
  const ready = Boolean(studentId && date && start && end);

  useEffect(() => {
    ticket.current += 1;
    const mine = ticket.current;
    if (!ready) {
      setState({ result: null, error: "", pending: false });
      return undefined;
    }
    setState((current) => ({ ...current, pending: true }));
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkDefenseSlot({
          student_id: studentId,
          preferred_date: date,
          selected_start: start,
          selected_end: end,
          defense_type: defenseType || undefined,
          venue: venue || "",
          manuscript_received_on: manuscriptReceivedOn || "",
        });
        if (mine === ticket.current) setState({ result, error: "", pending: false });
      } catch (err) {
        if (mine === ticket.current) {
          setState({ result: null, error: err.message || "Could not check this slot.", pending: false });
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, studentId, date, start, end, defenseType, venue, manuscriptReceivedOn]);

  const hard = state.result?.hard || [];
  const soft = state.result?.soft || [];
  return {
    ...state,
    ready,
    hard,
    soft,
    blocked: hard.length > 0,
    needsOverride: soft.length > 0,
    waiting: ready && state.pending,
  };
}

export default function SlotCheck({ check, className = "" }) {
  if (!check?.ready) return null;
  const { result, error, waiting, hard, soft } = check;
  return (
    <div className={`space-y-2 ${className}`} aria-live="polite">
      {waiting && !result && <p className="text-xs text-slate-500">Checking this slot against the panel and the room...</p>}
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {result && hard.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4" /> Cannot be booked</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs">
            {hard.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
      {result && soft.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Needs a reason</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs">
            {soft.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="mt-1.5 text-xs">To book anyway, tick the override box below and write why.</p>
        </div>
      )}
      {result && hard.length === 0 && soft.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> No conflicts found
          <span className="text-xs font-normal">({result.matched_count} of {result.participant_count} checked)</span>
        </p>
      )}
      {result?.earliest_date && (
        <p className="text-xs text-slate-500">
          Earliest allowed date: {longDate(result.earliest_date)}{result.lead_days ? ` (${result.lead_days}-day lead time)` : ""}.
          {" "}Times are Philippine time.
        </p>
      )}
    </div>
  );
}
