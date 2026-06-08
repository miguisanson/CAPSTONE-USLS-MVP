import { useEffect, useRef, useState } from "react";
import { Search, Check, X } from "lucide-react";
import { api } from "../api";
import { initials } from "../lib/format";

// Debounced, accessible student search used by the workflow forms.
export default function StudentPicker({ value, onChange, selectedLabel }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .students({ q, page_size: 8 })
        .then((res) => active && setResults(res.items))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, open]);

  if (value && selectedLabel) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {initials(selectedLabel.split(" - ")[1] || selectedLabel)}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Selected student</p>
            <p className="text-xs text-slate-500">{selectedLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null, "")}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 cursor-pointer"
          aria-label="Clear selected student"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search a student by name, number, or program…"
        aria-label="Search a student"
        className="field-input pl-10"
      />
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lift">
          {loading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No students found.</p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id, s.search_label);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-50 cursor-pointer"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {initials(s.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {s.student_number} · {s.program_code} · {s.current_stage}
                  </p>
                </div>
                <Check className="h-4 w-4 text-transparent" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
