import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { api } from "../../api";
import { InlineNotice } from "../ui/index.js";
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
      {waiting && !result && <p className="meta">Checking this slot against the panel and the room...</p>}
      {error && <InlineNotice tone="neutral" icon={Info} className="text-xs">{error}</InlineNotice>}
      {result && hard.length > 0 && (
        <InlineNotice tone="danger" icon={XCircle} title="Cannot be booked" className="px-4">
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs">
            {hard.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </InlineNotice>
      )}
      {result && soft.length > 0 && (
        <InlineNotice tone="warning" icon={AlertTriangle} title="Needs a reason" className="px-4">
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs">
            {soft.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="mt-1.5 text-xs">To book anyway, tick the override box below and write why.</p>
        </InlineNotice>
      )}
      {result && hard.length === 0 && soft.length === 0 && (
        <InlineNotice tone="success" icon={CheckCircle2} className="px-4">
          No conflicts found <span className="text-xs font-normal">({result.matched_count} of {result.participant_count} checked)</span>
        </InlineNotice>
      )}
      {result?.earliest_date && (
        <p className="meta">
          Earliest allowed date: {longDate(result.earliest_date)}{result.lead_days ? ` (${result.lead_days}-day lead time)` : ""}.
          {" "}Times are Philippine time.
        </p>
      )}
    </div>
  );
}
