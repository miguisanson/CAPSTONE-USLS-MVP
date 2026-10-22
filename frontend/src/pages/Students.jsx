import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, GitMerge, AlertTriangle, GraduationCap, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DataTable, InlineNotice, PageHeader, SearchInput, SectionCard, Select, StatusChip } from "../components/ui/index.js";
import { initials } from "../lib/format";
import { PAGE } from "../lib/labels.js";

const PAGE_SIZE = 25;
const STATUS_FILTER = [
  { value: "compre-eligible", label: "Compre exam eligible" },
  { value: "awol", label: "AWOL" },
  { value: "loa", label: "LOA" },
];
const RISK_FILTER = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"];
const STANDING_FILTER = ["Active", "On Leave", "AWOL", "Withdrawn"];

// One column per field of the old table, same order. The first cell links to the record, so the row is also keyboard reachable.
const COLUMNS = [
  {
    key: "name",
    header: "Student",
    cell: (s) => (
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials(s.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{s.name}</p>
          <p className="meta">{s.student_number}</p>
        </div>
      </div>
    ),
  },
  {
    key: "program_code",
    header: "Program",
    cell: (s) => (
      <>
        <p className="font-semibold text-slate-700">{s.program_code}</p>
        <p className="meta">{s.college}</p>
      </>
    ),
  },
  { key: "current_stage", header: "Stage" },
  { key: "enrollment_tag", header: "Enrollment", cell: (s) => (s.enrollment_tag ? <StatusChip status={s.enrollment_tag} dot={false} /> : null) },
  { key: "standing", header: "Standing", cell: (s) => <StatusChip status={s.standing} dot={false} /> },
  { key: "risk_level", header: "Risk", cell: (s) => <StatusChip status={s.risk_level} /> },
  {
    key: "compre",
    header: "Compre exam",
    cell: (s) =>
      s.compre_eligibility?.passed ? (
        <span className="inline-flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-brand-700" aria-hidden="true" />
          <StatusChip status="Passed" dot={false} />
        </span>
      ) : s.compre_eligibility?.eligible ? (
        <StatusChip status="Eligible to take" dot={false} />
      ) : (
        <span className="meta">{s.compre_eligibility?.completed_units || 0}/21 units</span>
      ),
  },
  { key: "adviser_name", header: "Adviser" },
];

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
    () => api.students({ q: debouncedQ, stage, risk, standing, program_id: programId, student_status: studentStatus, page, page_size: PAGE_SIZE }),
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

  const filterControls = [
    { label: "Student status", value: studentStatus, onChange: setStudentStatus, options: STATUS_FILTER },
    { label: "Stage", value: stage, onChange: setStage, options: meta?.stages || [] },
    { label: "Risk", value: risk, onChange: setRisk, options: RISK_FILTER },
    { label: "Standing", value: standing, onChange: setStanding, options: STANDING_FILTER },
    { label: "Program", value: programId, onChange: setProgramId, options: (meta?.programs || []).map((p) => ({ value: String(p.id), label: p.code })) },
  ];

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.students}
        description="Search and filter the monitored graduate population, then open a record for the full lifecycle view."
      />

      <Card>
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search by name, student number, email, or program…"
            label="Search students"
            className="flex-1 2xl:min-w-64"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {filterControls.map((f) => (
              <Select
                key={f.label}
                aria-label={f.label}
                placeholder={`All ${f.label.toLowerCase()}`}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                options={f.options}
              />
            ))}
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
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </Card>

      {data?.integrity && (
        <InlineNotice tone={data.integrity.issue_count ? "warning" : "success"} icon={data.integrity.issue_count ? AlertTriangle : ShieldCheck}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {data.integrity.issue_count
                ? `${data.integrity.issue_count} enrollment/profile inconsistency item(s) require review.`
                : "Students, enrollment, and monitoring records are synchronized."}
            </span>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/enrollment${programId ? `?program_id=${programId}` : ""}`)}>
              Review enrollment
            </Button>
          </div>
        </InlineNotice>
      )}

      <DuplicateReview
        groups={duplicateData?.groups || []}
        loading={duplicatesLoading}
        busy={mergeBusy}
        message={mergeMessage}
        onMerge={mergeDuplicate}
      />

      {error ? (
        <InlineNotice tone="danger" title="Could not load students">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>
          </div>
        </InlineNotice>
      ) : (
        <DataTable
          caption="Monitored graduate students"
          columns={COLUMNS}
          rows={data?.items || []}
          rowKey="id"
          rowHref={(s) => `/students/${s.id}`}
          minWidth="md"
          loading={loading}
          empty={{ icon: Search, title: "No students match your filters", hint: "Try clearing a filter or broadening your search." }}
          pagination={{ page: data?.page || page, pageCount: data?.pages || 1, total: data?.total || 0, pageSize: PAGE_SIZE, onPage: setPage }}
        />
      )}
    </div>
  );
}

function DuplicateReview({ groups, loading, busy, message, onMerge }) {
  if (loading) return null;
  if (!groups.length) return null;

  return (
    <SectionCard
      title="Duplicate review"
      subtitle="Verify likely duplicate identities first. Existing verified profile values are kept unless overwrite is selected."
      icon={AlertTriangle}
    >
      {message && <InlineNotice tone="neutral">{message}</InlineNotice>}
      <div className="space-y-3">
        {groups.map((group, i) => {
          const primary = group.students[0];
          const duplicates = group.students.slice(1);
          return (
            <div key={`${group.reason}-${i}`} className="rounded-xl border border-slate-100 p-3">
              <p className="eyebrow mb-2">{group.reason}</p>
              <div className="space-y-2">
                {group.students.map((s, index) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {index === 0 ? "Primary: " : "Duplicate: "}{s.name}
                      </p>
                      <p className="meta">{s.student_number} · {s.program_code} · Entry {s.entry_year}</p>
                    </div>
                    {index > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" icon={GitMerge} onClick={() => onMerge(primary.id, s.id, false)} disabled={!!busy}>
                          Merge · keep existing
                        </Button>
                        <Button onClick={() => onMerge(primary.id, s.id, true)} disabled={!!busy}>
                          Overwrite after verification
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {duplicates.length > 1 && (
                <p className="meta mt-2">Merge duplicates one at a time into the primary record; verify first and keep existing values unless overwrite is intentional.</p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
