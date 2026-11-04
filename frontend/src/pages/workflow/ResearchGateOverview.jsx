import { useDeferredValue, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "../../api";
import StageBoard from "../../components/StageBoard";
import { useApi } from "../../hooks";
import { Card, Field, InlineNotice, Input, SectionTitle, Select, StatusChip } from "../../components/ui/index.js";

const STATE_LABEL = { ready: "Ready", blocked: "Blocked", waiting: "Waiting", done: "Done" };
const STATE_HELP = {
  ready: "Documents are in; the next step is the Research Coordinator's.",
  blocked: "The student has to act first.",
  waiting: "Someone else has to review, sign or record a verdict.",
  done: "The stage is complete.",
};
const BOARD_COLUMNS = [
  { key: "Title Defense", label: "Title Defense", description: "Title requirements and the first panel decision." },
  { key: "Proposal Defense", label: "Proposal Defense", description: "Proposal requirements, ethics steps, and panel decision." },
  { key: "Completion", label: "Completion", description: "Final Defense and completion evidence." },
];

export default function ResearchGateOverview({ onOpen, selectedId }) {
  const { data, loading, error } = useApi(() => api.researchGateOverview(), []);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const rows = useMemo(
    () => (data?.items || []).filter((row) => {
      const searchable = `${row.student.name} ${row.student.program_code || ""} ${row.status || ""} ${row.reason || ""}`.toLowerCase();
      return (!state || row.state === state) && (!deferredSearch || searchable.includes(deferredSearch));
    }),
    [data, deferredSearch, state],
  );
  const boardItems = useMemo(() => {
    const items = [...rows];
    for (const column of BOARD_COLUMNS) {
      if (!items.some((item) => item.board_stage === column.key)) {
        items.push({ _empty: true, id: `empty:${column.key}`, board_stage: column.key });
      }
    }
    return items;
  }, [rows]);

  function renderCard(row) {
    if (row._empty) {
      return <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-sm text-slate-500">No students here</p>;
    }
    return (
      <article className={`rounded-xl border bg-white p-4 shadow-sm ${row.student.id === selectedId ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"}`}>
        <button
          type="button"
          onClick={() => onOpen(row.student)}
          aria-label={`Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`}
          className="min-h-11 w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="block break-words font-semibold text-ink">{row.student.name}</span>
          <span className="meta mt-0.5 block">{row.student.program_code} · {row.student.student_number}</span>
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip status={STATE_LABEL[row.state] || row.status} dot={false} />
          <span className="text-xs font-medium text-slate-600">{row.status}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">{row.reason}</p>
        {row.waiting_on && <p className="mt-2 text-xs font-semibold text-slate-600">Waiting on: {row.waiting_on}</p>}
        <p className="sr-only">{STATE_HELP[row.state]}</p>
      </article>
    );
  }

  return (
    <Card pad="lg" id="research-gate-overview" className="min-w-0 overflow-hidden">
      <SectionTitle
        title="Who is at the Research Gate"
        subtitle="Students are grouped into the three Research Gate stages. Choose a student to open the progress record."
        icon={ClipboardList}
      />
      {error && !data ? (
        <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>
      ) : (
        <div className="mt-4 min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Search students">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, program, status, or waiting reason" />
            </Field>
            <Field label="Status">
              <Select
                value={state}
                onChange={(event) => setState(event.target.value)}
                placeholder="All statuses"
                options={Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label: `${label} (${data?.counts?.[value] ?? 0})` }))}
              />
            </Field>
          </div>
          {loading && !data ? (
            <p role="status" className="py-8 text-center text-sm text-slate-600">Loading Research Gate stages…</p>
          ) : (
            <StageBoard
              columns={BOARD_COLUMNS}
              items={boardItems}
              getItemId={(item) => item._empty ? item.id : item.student.id}
              getColumnKey={(item) => item.board_stage}
              renderCard={renderCard}
              onMove={async () => undefined}
              readOnly
              ariaLabel="Research Gate stages"
              phoneAriaLabel="Research Gate stages"
              columnClassName="w-[min(22rem,calc(100vw-3rem))]"
              emptyText="No students here"
            />
          )}
        </div>
      )}
    </Card>
  );
}
