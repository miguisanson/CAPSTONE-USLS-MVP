import { UserRoundCheck } from "lucide-react";
import { formatDateTime } from "../../lib/format";

/** "Recorded by <staff name> for the panel" with the reason and time, shown wherever a verdict is shown (I-361).
 *  Nothing when the panel chair recorded it. */
export function PanelStamp({ verdict, className = "mt-2" }) {
  if (!verdict?.recorded_for_panel_by) return null;
  return (
    <p data-testid="panel-stamp" className={`${className} flex items-start gap-1.5 text-xs text-slate-700`}>
      <UserRoundCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
      <span>
        <span className="font-semibold">{verdict.recorded_for_panel_label}</span>
        {verdict.recorded_for_panel_at ? ` · ${formatDateTime(verdict.recorded_for_panel_at)}` : ""}
        {verdict.recorded_for_panel_reason ? `. Reason: ${verdict.recorded_for_panel_reason}` : ""}
      </span>
    </p>
  );
}
