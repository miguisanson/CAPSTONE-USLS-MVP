import { MessageSquare } from "lucide-react";
import { StatusChip } from "../ui/index.js";

// The pieces of Khloe's single-case card (practicum now; LOA, readmission, AWOL, withdrawal and residency next):
// name and number, a ready/waiting mark, a two-column facts grid, the amber message box, "Next:" and the footer buttons.

/** The green "Ready for ..." mark, or the grey "Waiting for documents" mark; nothing when neither applies. */
export function ReadyMark({ ready, readyLabel = "Ready for Dean review", waiting = false, waitingLabel = "Waiting for documents" }) {
  if (ready) return <StatusChip status="Approved" label={readyLabel} size="sm" dot={false} />;
  if (waiting) return <StatusChip status="Waiting for documents" label={waitingLabel} tone="neutral" size="sm" dot={false} />;
  return null;
}

/** A two-column grid of short facts. `facts` is [text] or [{ text, wide, strong, testId }]; empty ones are skipped. */
export function CaseCardFacts({ facts }) {
  const shown = facts.map((fact) => (typeof fact === "string" ? { text: fact } : fact)).filter((fact) => fact.text);
  return (
    <ul data-testid="case-facts" className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-600">
      {shown.map((fact, index) => (
        <li
          key={index}
          data-testid={fact.testId}
          className={`min-w-0 break-words ${fact.wide ? "col-span-2" : index % 2 ? "text-right" : ""} ${fact.strong ? "text-sm font-semibold text-ink" : ""}`}
        >
          {fact.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * The amber box with how many messages there are and the latest one (two lines). Give `messages` (newest first) or, when a list only
 * carries the number, `count` and the `latest` text; with a count and no text the box says where to read them.
 */
export function MessageNote({ messages = [], count = messages.length, latest = messages[0]?.comment || messages[0]?.template || "", unreadHint = "Open Message to read and reply." }) {
  if (!count) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
      <p className="eyebrow !text-amber-800">
        <MessageSquare className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        {count} visible message{count === 1 ? "" : "s"}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-amber-900">{latest || unreadHint}</p>
    </div>
  );
}

/** "Next: owner" with the rule above it, in the brand colour. */
export function NextOwner({ owner }) {
  return <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {owner}</p>;
}

/** The card shell: green when it can move on, white otherwise. */
export function CaseCardShell({ ready = false, selected = false, children }) {
  return (
    <article className={`rounded-xl border p-3 shadow-sm transition-colors ${ready ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : "border-slate-200 bg-white hover:border-slate-300"} ${selected ? "ring-2 ring-brand-300" : ""}`}>
      {children}
    </article>
  );
}
