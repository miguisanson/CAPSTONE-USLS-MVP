// StatusChip (UI-SPEC section 4): one coloured pill for any status word. The colour comes from lib/status.js, never from
// the caller. Colour is never the only signal: the chip always shows its words (the dot is optional decoration).
import { statusTone } from "../../lib/status";
import { toneOf } from "../../lib/tone";

const SIZES = {
  md: "px-2.5 py-0.5 text-xs",
  sm: "px-2 py-0.5 text-2xs",
};

/**
 * @param status  the status string (looked up in lib/status.js). Empty renders a dash, not an empty pill.
 * @param tone    the server's `status_tone` hint; used only when `status` is not in the client map.
 * @param label   the words to show instead of `status` (the tone still follows `status`).
 * @param dot     small round marker before the words (default true).
 * @param size    "md" (default) or "sm".
 */
export function StatusChip({ status, tone, label, dot = true, size = "md", className = "", ...rest }) {
  if (!status && !label) return <span className="text-slate-400" {...rest}>—</span>;
  const name = statusTone(status || label, tone);
  return (
    <span
      data-status-tone={name}
      {...rest}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${SIZES[size] || SIZES.md} ${toneOf(name).chip} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {label || status}
    </span>
  );
}
