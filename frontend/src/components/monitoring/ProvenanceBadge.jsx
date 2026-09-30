import { FileUp, PencilLine, Cog } from "lucide-react";
import { formatDateTime } from "../../lib/format";

// Where a monitoring value came from. The label is always visible text (colour is
// never the only signal); who / when / why is in the tooltip and read by screen
// readers through the title-derived aria-label.
const SOURCES = {
  "Manual entry": { icon: PencilLine, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  Imported: { icon: FileUp, cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  System: { icon: Cog, cls: "bg-blue-50 text-blue-700 ring-blue-200" },
};

export function provenanceTitle({ source, by, at, reason, evidence }) {
  if (source === "Manual entry") {
    return [
      "Manual entry",
      by ? `by ${by}` : "",
      at ? `on ${formatDateTime(at)}` : "",
      reason ? `. Reason: ${reason}` : "",
    ].join(" ").replace(/\s+\./, ".").trim();
  }
  if (source === "Imported") return `Imported from a monitoring sheet or source file${evidence ? ` (${evidence})` : ""}.`;
  if (source === "System") return `Set by another workflow${evidence ? ` (${evidence})` : ""}.`;
  return "";
}

export default function ProvenanceBadge({ source, by, at, reason, evidence, className = "" }) {
  if (!source) return null;
  const style = SOURCES[source] || SOURCES.System;
  const Icon = style.icon;
  const title = provenanceTitle({ source, by, at, reason, evidence });
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.cls} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {source}
    </span>
  );
}
