import { FileUp, PencilLine, Cog } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import { StatusChip } from "../ui/index.js";

// Where a monitoring value came from. The label is always visible text (colour is
// never the only signal, and each source has its own icon); who / when / why is in
// the tooltip and read by screen readers through the title-derived aria-label.
// The chip's colour comes from the tone: a portal entry is "warn" (amber, a person
// typed it in), an imported value is "muted" (grey), a value set by another
// workflow is "info" (blue). The chip gets only a label (no status word), so the
// tone below is what colours it and lib/status.js is never consulted
// (AGENTS.md Rule 4: manual entry stays distinguishable from imported).
const SOURCES = {
  "Manual entry": { icon: PencilLine, tone: "warn" },
  Imported: { icon: FileUp, tone: "muted" },
  System: { icon: Cog, tone: "info" },
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
    <StatusChip
      tone={style.tone}
      size="sm"
      dot={false}
      label={
        <>
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {source}
        </>
      }
      title={title}
      aria-label={title}
      className={className}
    />
  );
}
