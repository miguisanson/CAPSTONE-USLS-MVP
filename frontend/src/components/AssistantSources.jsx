import { BookText, ChevronDown, FileQuestion, Sparkles, UserRound, WifiOff } from "lucide-react";
import { StatusChip, InlineNotice } from "./ui/index.js";

// Shared by the staff, dean, faculty and student assistant screens: where an answer came from, which documents
// it used, and the calm "the documents do not cover this" state.

/**
 * The label under an answer. One chip says how the answer was made, so it is never a guess:
 * "Answered by Gemini" (from the policy excerpts or from your own record), "Offline answer" (no Gemini was used:
 * keyword search or your record turned into words by the app) or the plain name of the rule-based source.
 */
export function AnswerBadge({ source, personal = false }) {
  if (!source) return null;
  const offline = Boolean(source.offline);
  const chip = offline
    ? { status: "Offline answer", tone: "warning" }
    : source.ai_used
      ? { status: "Answered by Gemini", tone: "success" }
      : { status: source.label, tone: "neutral" };
  return (
    <div className="space-y-1" data-testid="answer-badge" data-offline={offline ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-1.5" title={source.detail}>
        <StatusChip status={chip.status} tone={chip.tone} dot={false} />
        {personal && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> From your own record
          </span>
        )}
        {!personal && source.ai_used && !offline && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Only from the policy documents below
          </span>
        )}
        {offline && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {personal ? "Built from your record without Gemini" : "Found by keyword search; Gemini was not used"}
          </span>
        )}
      </div>
      {!offline && !source.ai_used && source.label && <p className="meta">{source.detail}</p>}
      {source.note && <p className="meta">{source.note}</p>}
    </div>
  );
}

/** The calm state for a question the policy library does not answer: no passages, a clear next step. */
export function NotCoveredNotice({ answer }) {
  return (
    <div
      data-testid="not-covered"
      className="flex items-start gap-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
        <FileQuestion className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="card-title">Not covered by the policy documents</p>
        <p className="mt-1 text-sm text-slate-700">
          The USLS policy documents in the library don&apos;t cover this. Ask the Graduate School office.
        </p>
        <p className="meta mt-2">
          No passages are shown because none of them answers your question. You can rephrase it with the name of a rule,
          stage or form (for example leave of absence, comprehensive exam or Form 1).
        </p>
        {answer && <span className="sr-only">{answer}</span>}
      </div>
    </div>
  );
}

function locationLine(c) {
  const parts = [];
  if (c.page != null) parts.push(`Page ${c.page}`);
  if (c.section) parts.push(c.section.replaceAll(">", "›"));
  return parts.join(" · ");
}

/** The documents an answer used: title, page and section on the line, the exact passage when opened. */
export function SourceList({ citations, heading = "Sources" }) {
  if (!citations || citations.length === 0) return null;
  return (
    <section aria-label={heading} className="space-y-1.5" data-testid="source-list">
      <p className="eyebrow flex items-center gap-1">
        <BookText className="h-3.5 w-3.5" aria-hidden="true" /> {heading} ({citations.length})
      </p>
      <ul className="space-y-1.5">
        {citations.map((c, index) => {
          const where = locationLine(c);
          return (
            <li key={`${c.id}-${index}`}>
              <details className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2 max-sm:min-h-11 max-sm:py-1">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800">{c.title}</span>
                    <span className="meta block break-words">{where || c.source}</span>
                  </span>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                {c.warning && (
                  <div className="mt-2">
                    <InlineNotice tone="warning">{c.warning}</InlineNotice>
                  </div>
                )}
                <blockquote className="mt-2 whitespace-pre-line break-words border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-slate-600">
                  {c.quote || c.text}
                </blockquote>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
