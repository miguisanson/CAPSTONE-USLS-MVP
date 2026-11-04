import { Info } from "lucide-react";

// Khloe's blue note above a board when a process covers only some programs ("Program scope: Psychology and MSGC only").
export function ProcessScopeNote({ title, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-900">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-800">{children}</p>
      </div>
    </div>
  );
}
