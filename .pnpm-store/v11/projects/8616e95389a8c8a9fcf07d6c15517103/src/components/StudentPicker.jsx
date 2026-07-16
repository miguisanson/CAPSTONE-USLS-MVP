import { useEffect, useRef, useState } from "react";
import { Search, Check, X, Filter } from "lucide-react";
import { api } from "../api";
import { initials } from "../lib/format";

// Debounced, accessible student search + Program/Stage filters, used by the workflow forms.
export default function StudentPicker({ value, onChange, selectedLabel, meta }) {
  const [q, setQ] = useState("");
  const [programId, setProgramId] = useState("");
  const [stage, setStage] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const programs = meta?.programs || [];
  const stages = meta?.stages || [];
  const hasFilters = Boolean(programId || stage);

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
        .students({ q, program_id: programId, stage, page_size: 50 })
        .then((res) => {
          if (!active) return;
          setResults(res.items);
          setTotal(res.total);
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, programId, stage, open]);

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

  const filterSelect = "rounded-lg border bg-white px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search all students by name, number, or program…"
          aria-label="Search a student"
          className="field-input pl-10"
        />
      </div>

      {/* Filter row */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
          <Filter className="h-3.5 w-3.5" /> Filter
        </span>
        <select
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            setOpen(true);
          }}
          aria-label="Filter by program"
          className={`${filterSelect} ${programId ? "border-brand-400 text-brand-700" : "border-slate-300 text-slate-600"}`}
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setOpen(true);
          }}
          aria-label="Filter by lifecycle stage"
          className={`${filterSelect} ${stage ? "border-brand-400 text-brand-700" : "border-slate-300 text-slate-600"}`}
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setProgramId("");
              setStage("");
              setOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lift">
          {!loading && results.length > 0 && (
            <p className="sticky top-0 border-b border-slate-100 bg-slate-50/90 px-4 py-2 text-xs font-semibold text-slate-500 backdrop-blur">
              {total > results.length
                ? `Showing ${results.length} of ${total} students${hasFilters ? " (filtered)" : ""} — type to narrow`
                : `${total} student${total === 1 ? "" : "s"}${hasFilters ? " match the filter" : ""}`}
            </p>
          )}
          {loading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No students match. Try clearing a filter.</p>
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
                    {s.student_number} · {s.program_code} · {s.research_stage || s.current_stage}
                  </p>
                  <p className={`mt-0.5 truncate text-[11px] font-semibold ${/complete|ready/i.test(s.readiness_status || "") ? "text-emerald-600" : "text-amber-600"}`}>
                    {s.readiness_status || "Readiness not recorded"}
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
