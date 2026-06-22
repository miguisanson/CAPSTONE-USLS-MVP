import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Users, SlidersHorizontal, GitMerge, AlertTriangle, GraduationCap } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { initials } from "../lib/format";

export default function Students() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: meta } = useApi(() => api.meta(), []);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [stage, setStage] = useState(searchParams.get("stage") || "");
  const [risk, setRisk] = useState(searchParams.get("risk") || "");
  const [standing, setStanding] = useState(searchParams.get("standing") || "");
  const [programId, setProgramId] = useState(searchParams.get("program_id") || "");
  const [studentStatus, setStudentStatus] = useState(searchParams.get("student_status") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // reset to page 1 when a filter changes
  useEffect(() => setPage(1), [debouncedQ, stage, risk, standing, programId, studentStatus]);

  useEffect(() => {
    const params = {};
    if (debouncedQ) params.q = debouncedQ;
    if (stage) params.stage = stage;
    if (risk) params.risk = risk;
    if (standing) params.standing = standing;
    if (programId) params.program_id = programId;
    if (studentStatus) params.student_status = studentStatus;
    if (page > 1) params.page = page;
    setSearchParams(params, { replace: true });
  }, [debouncedQ, stage, risk, standing, programId, studentStatus, page, setSearchParams]);

  const { data, loading, error, refetch } = useApi(
    () => api.students({ q: debouncedQ, stage, risk, standing, program_id: programId, student_status: studentStatus, page, page_size: 25 }),
    [debouncedQ, stage, risk, standing, programId, studentStatus, page]
  );
  const { data: duplicateData, loading: duplicatesLoading, refetch: refetchDuplicates } = useApi(
    () => api.duplicateStudents(),
    []
  );
  const [mergeBusy, setMergeBusy] = useState("");
  const [mergeMessage, setMergeMessage] = useState("");

  async function mergeDuplicate(targetId, sourceId, overwriteProfile = false) {
    const key = `${targetId}-${sourceId}-${overwriteProfile ? "overwrite" : "keep"}`;
    setMergeBusy(key);
    setMergeMessage("");
    try {
      const res = await api.mergeStudents({ target_id: targetId, source_id: sourceId, overwrite_profile: overwriteProfile });
      setMergeMessage(res.message);
      refetch();
      refetchDuplicates();
    } catch (err) {
      setMergeMessage(err.message || "Could not merge duplicate records.");
    } finally {
      setMergeBusy("");
    }
  }

  const activeFilters = useMemo(
    () => [debouncedQ, stage, risk, standing, programId, studentStatus].filter(Boolean).length,
    [debouncedQ, stage, risk, standing, programId, studentStatus]
  );

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Students</h1>
        <p className="mt-1 text-sm text-slate-500">Search and filter the monitored graduate population, then open a record for the full lifecycle view.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, student number, email, or program…"
              aria-label="Search students"
              className="field-input pl-10"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Select label="Student status" value={studentStatus} onChange={setStudentStatus} options={[
              { value: "compre-eligible", label: "Compre exam eligible" },
              { value: "awol", label: "AWOL" },
              { value: "loa", label: "LOA" },
            ]} />
            <Select label="Stage" value={stage} onChange={setStage} options={meta?.stages || []} />
            <Select label="Risk" value={risk} onChange={setRisk} options={["Low", "Medium", "High", "Critical", "Medium/High/Critical"]} />
            <Select label="Standing" value={standing} onChange={setStanding} options={["Active", "On Leave", "Withdrawn", "Completed"]} />
            <Select
              label="Program"
              value={programId}
              onChange={setProgramId}
              options={(meta?.programs || []).map((p) => ({ value: String(p.id), label: p.code }))}
            />
          </div>
        </div>
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setStage("");
              setRisk("");
              setStanding("");
              setProgramId("");
              setStudentStatus("");
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </Card>

      <DuplicateReview
        groups={duplicateData?.groups || []}
        loading={duplicatesLoading}
        busy={mergeBusy}
        message={mergeMessage}
        onMerge={mergeDuplicate}
      />

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading students…" />
        ) : error ? (
          <EmptyState icon={Users} title="Could not load students" hint={error} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Search} title="No students match your filters" hint="Try clearing a filter or broadening your search." />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-ink">{data.items.length}</span> of{" "}
                <span className="font-semibold text-ink">{data.total}</span> students
              </p>
              <p className="text-sm text-slate-400">
                Page {data.page} of {data.pages}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Student</th>
                    <th className="px-3 py-3">Program</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Enrollment</th>
                    <th className="px-3 py-3">Standing</th>
                    <th className="px-3 py-3">Risk</th>
                    <th className="px-3 py-3">Compre exam</th>
                    <th className="px-3 py-3">Adviser</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/students/${s.id}`)}
                      className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-brand-50/50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {initials(s.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{s.name}</p>
                            <p className="text-xs text-slate-400">{s.student_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-700">{s.program_code}</p>
                        <p className="text-xs text-slate-400">{s.college}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{s.current_stage}</td>
                      <td className="px-3 py-3">
                        {s.enrollment_tag ? <StatusBadge value={s.enrollment_tag} dot={false} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge value={s.standing} dot={false} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge value={s.risk_level} />
                      </td>
                      <td className="px-3 py-3">
                        {s.compre_eligibility?.passed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                            <GraduationCap className="h-3.5 w-3.5" /> Passed
                          </span>
                        ) : s.compre_eligibility?.eligible ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Eligible to take</span>
                        ) : (
                          <span className="text-xs text-slate-400">{s.compre_eligibility?.completed_units || 0}/21 units</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{s.adviser_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-ghost"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {data.page} / {data.pages}
              </span>
              <button
                type="button"
                disabled={data.page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function DuplicateReview({ groups, loading, busy, message, onMerge }) {
  if (loading) return null;
  if (!groups.length) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-ink">Duplicate review</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Verify likely duplicate identities first. Existing verified profile values are kept unless overwrite is selected.
          </p>
        </div>
      </div>
      {message && <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>}
      <div className="space-y-3">
        {groups.map((group, i) => {
          const primary = group.students[0];
          const duplicates = group.students.slice(1);
          return (
            <div key={`${group.reason}-${i}`} className="rounded-xl border border-slate-100 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{group.reason}</p>
              <div className="space-y-2">
                {group.students.map((s, index) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {index === 0 ? "Primary: " : "Duplicate: "}{s.name}
                      </p>
                      <p className="text-xs text-slate-500">{s.student_number} · {s.program_code} · Entry {s.entry_year}</p>
                    </div>
                    {index > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onMerge(primary.id, s.id, false)}
                          disabled={!!busy}
                          className="btn-ghost"
                        >
                          <GitMerge className="h-4 w-4" /> Merge · keep existing
                        </button>
                        <button
                          type="button"
                          onClick={() => onMerge(primary.id, s.id, true)}
                          disabled={!!busy}
                          className="btn-primary"
                        >
                          Overwrite after verification
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {duplicates.length > 1 && (
                <p className="mt-2 text-xs text-slate-400">Merge duplicates one at a time into the primary record; verify first and keep existing values unless overwrite is intentional.</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Select({ label, value, onChange, options }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input cursor-pointer" aria-label={label}>
        <option value="">All {label.toLowerCase()}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
