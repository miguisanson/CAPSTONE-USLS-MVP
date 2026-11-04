import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
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
  { key: "Completion", label: "Final Defense", description: "Final defense requirements and panel decision." },
];

export default function ResearchGateOverview({ onOpen, selectedId }) {
  const { data, loading, error } = useApi(() => api.researchGateOverview(), []);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const allRows = data?.items || [];
  const rows = useMemo(
    () => allRows.filter((row) => {
      const searchable = `${row.student.name} ${row.student.student_number || ""} ${row.student.program_code || ""} ${row.status || ""} ${row.reason || ""}`.toLowerCase();
      return (!state || row.state === state) && (!deferredSearch || searchable.includes(deferredSearch));
    }),
    [allRows, deferredSearch, state],
  );
  const boardColumns = useMemo(
    () => BOARD_COLUMNS.map((column) => ({
      ...column,
      count: allRows.filter((row) => row.board_stage === column.key).length,
    })),
    [allRows],
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
      return <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500">No students match</p>;
    }
    return (
      <article className={`overflow-hidden rounded-lg border bg-white ${row.student.id === selectedId ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"}`}>
        <button
          type="button"
          onClick={() => onOpen(row.student)}
          aria-label={`Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`}
          className="group min-h-16 w-full cursor-pointer p-3 text-left transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold text-ink group-hover:text-brand-800">{row.student.name}</span>
              <span className="meta mt-0.5 block">{row.student.program_code} · {row.student.student_number}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <StatusChip status={STATE_LABEL[row.state] || row.status} dot={false} />
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
            </span>
          </span>
          <span className="mt-1.5 block truncate text-xs font-medium text-slate-600">{row.status}</span>
          <span className="sr-only">{row.reason}. {row.waiting_on ? `Waiting on ${row.waiting_on}.` : ""} {STATE_HELP[row.state]}</span>
        </button>
      </article>
    );
  }

  return (
    <Card pad="lg" id="research-gate-overview" className="min-w-0 overflow-hidden">
      <SectionTitle
        title="Who is at the Research Gate"
        subtitle="Students are grouped into the three Research Gate stages. Select a name to open the progress record below."
        icon={ClipboardList}
      />
      {error && !data ? (
        <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>
      ) : (
        <div className="mt-4 min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Search students">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, student number, program, status, or waiting reason" />
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
          <p className="meta" role="status">Showing {rows.length} of {allRows.length} students. The number beside each stage is the total in that stage.</p>
          {loading && !data ? (
            <p role="status" className="py-8 text-center text-sm text-slate-600">Loading Research Gate stages…</p>
          ) : (
            <StageBoard
              columns={boardColumns}
              items={boardItems}
              getItemId={(item) => item._empty ? item.id : item.student.id}
              getColumnKey={(item) => item.board_stage}
              renderCard={renderCard}
              onMove={async () => undefined}
              readOnly
              ariaLabel="Research Gate stages"
              phoneAriaLabel="Research Gate stages"
              columnClassName=""
              columnBodyClassName="max-h-[26rem] overflow-y-auto overscroll-contain pr-1 max-sm:max-h-72"
              fitColumns
              emptyText="No students here"
            />
          )}
        </div>
      )}
    </Card>
  );
}
