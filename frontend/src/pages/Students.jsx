import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, GitMerge, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { stageWords } from "../lib/stages";
import { Button, DataTable, FilterBar, FilterSelect, InlineNotice, PageHeader, SectionCard, StatusChip } from "../components/ui/index.js";
import { initials } from "../lib/format";
import { PAGE } from "../lib/labels.js";

const PAGE_SIZE = 25;
const STATUS_FILTER = [
  { value: "compre-eligible", label: "Compre exam eligible" }, // leave and AWOL are the Standing and Stage filters, not a third copy (I-430)
];
const RISK_FILTER = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"];
const STANDING_FILTER = ["Active", { value: "On Leave", label: "On leave" }, "AWOL", "Withdrawn"];

// I-075: what stands between a student and the Compre exam, in the API's own words. The eligibility rule is by
// category (the units needed differ by program), so no unit total is printed here.
function compreProgress(compre) {
  const left = compre?.missing_subjects || 0;
  if (left > 0) return `Compre: eligible after ${left} more subject${left === 1 ? "" : "s"}`;
  const failed = compre?.failed_subjects || 0;
  return failed > 0 ? `Not eligible: ${failed} failed subject${failed === 1 ? "" : "s"}` : "Not eligible";
}

// One column per field of the old table, same order. The first cell links to the record, so the row is also keyboard reachable.
const COLUMNS = [
  {
    key: "name",
    header: "Student",
    cell: (s) => (
      <div className="flex items-center gap-3">
        <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 2xl:grid">
          {initials(s.name)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{s.name}</p>
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
  { key: "current_stage", header: "Stage", cell: (s) => <span className="block">{stageWords(s.current_stage)}</span> },
  { key: "enrollment_tag", header: "Enrollment", cell: (s) => (s.enrollment_tag ? <StatusChip status={s.enrollment_tag} size="sm" /> : null) },
  { key: "standing", header: "Standing", cell: (s) => <StatusChip status={s.standing} size="sm" /> },
  { key: "risk_level", header: "Risk", cell: (s) => <StatusChip status={s.risk_level} size="sm" /> },
  {
    key: "compre",
    header: "Compre exam",
    cell: (s) =>
      s.compre_eligibility?.passed ? (
        <StatusChip status="Passed" size="sm" />
      ) : s.compre_eligibility?.eligible ? (
        <StatusChip status="Eligible to take" size="sm" />
      ) : (
        <span className="meta block min-w-20">{compreProgress(s.compre_eligibility)}</span>
      ),
  },
  { key: "adviser_name", header: "Adviser", cell: (s) => <span className="block min-w-20">{s.adviser_name}</span> },
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
    { label: "Program", all: "All programs", value: programId, onChange: setProgramId, options: (meta?.programs || []).map((p) => ({ value: String(p.id), label: p.code })) },
    { label: "Student status", all: "All statuses", value: studentStatus, onChange: setStudentStatus, options: STATUS_FILTER },
    { label: "Stage", all: "All stages", value: stage, onChange: setStage, options: (meta?.stages || []).map((v) => ({ value: v, label: stageWords(v) })) },
    { label: "Risk", all: "All risk levels", value: risk, onChange: setRisk, options: RISK_FILTER },
    { label: "Standing", all: "All standings", value: standing, onChange: setStanding, options: STANDING_FILTER },
  ];

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.students}
      />

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Name, number or program", label: "Search students" }}
        active={activeFilters}
        onClear={() => {
          setQ("");
          setStage("");
          setRisk("");
          setStanding("");
          setProgramId("");
          setStudentStatus("");
        }}
      >
        {filterControls.map((f) => (
          <FilterSelect
            key={f.label}
            label={f.label}
            placeholder={f.all} // the visible label names the control (owner feedback 2026-11-23; was the I-395 aria-label)
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            options={f.options}
          />
        ))}
      </FilterBar>

      {data?.integrity && (
        <InlineNotice tone={data.integrity.issue_count ? "warning" : "success"} icon={data.integrity.issue_count ? AlertTriangle : ShieldCheck}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {data.integrity.issue_count
                ? `${data.integrity.issue_count} enrollment/profile inconsistency item(s) require review.`
                : "Student, enrollment and monitoring records agree."}
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
        <div className="[&_td]:!px-[5px] [&_th]:!px-[5px]"> {/* tighter cells so the eight columns fit at 125% zoom (I-406); 5px since the plainer status words (IM51, "On leave" for "LOA") */}
        <DataTable
          caption="Monitored graduate students"
          columns={COLUMNS}
          rows={data?.items || []}
          rowKey="id"
          rowHref={(s) => `/students/${s.id}`}
          minWidth="md"
          stackOnPhone="md"
          loading={loading}
          empty={{ icon: Search, title: "No students match your filters", hint: "Try clearing a filter or broadening your search." }}
          pagination={{ page: data?.page || page, pageCount: data?.pages || 1, total: data?.total || 0, pageSize: PAGE_SIZE, onPage: setPage, noun: "students" }}
        />
        </div>
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
      subtitle="Verified values are kept unless you choose overwrite."
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
