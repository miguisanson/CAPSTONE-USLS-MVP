import { BookText, Info, Sparkles } from "lucide-react";

// Shared by the staff, dean, faculty and student assistant screens: where the answer came from.

export function AnswerBadge({ source }) {
  if (!source) return null;
  return (
    <div className="space-y-1">
      <div
        title={source.detail}
        aria-label={`Answer source: ${source.label}. ${source.detail}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
      >
        {source.ai_used ? <Sparkles className="h-3 w-3 text-brand-600" /> : <Info className="h-3 w-3 text-slate-500" />}
        {source.label}
      </div>
      {source.note && <p className="text-[11px] leading-snug text-slate-400">{source.note}</p>}
    </div>
  );
}

function locationLine(c) {
  const parts = [];
  if (c.page != null) parts.push(`Page ${c.page}`);
  if (c.section) parts.push(c.section.replaceAll(">", "›"));
  return parts.join(" · ");
}

export function SourceList({ citations, heading = "Sources" }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        <BookText className="h-3.5 w-3.5" /> {heading} ({citations.length})
      </p>
      <div className="space-y-1.5">
        {citations.map((c, index) => {
          const where = locationLine(c);
          return (
            <details key={`${c.id}-${index}`} className="group rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">
                <span>{c.title}</span>
                <span className="ml-2 text-[10px] font-medium text-slate-400">{where || c.source}</span>
              </summary>
              {c.warning && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-800">{c.warning}</p>}
              {where && <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{c.title} · {where}</p>}
              <blockquote className="mt-1.5 whitespace-pre-line border-l-2 border-brand-200 pl-2.5 leading-relaxed text-slate-600">
                {c.quote || c.text}
              </blockquote>
            </details>
          );
        })}
      </div>
    </div>
  );
}
