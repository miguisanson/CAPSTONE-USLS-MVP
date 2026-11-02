import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, DataTable, Field, InlineNotice, SectionTitle, Select, StatusChip } from "../../components/ui/index.js";

// I-205 / I-158 (AD12): the Research Gate opens on a list of who is ready, blocked or waiting, and why, like the other
// workflow pages; choosing a row opens the per-student record below.
const STATE_LABEL = { ready: "Ready", blocked: "Blocked", waiting: "Waiting", done: "Done" };
const STATE_HELP = {
  ready: "Documents are in; the next step is the Research Coordinator's.",
  blocked: "The student has to act first.",
  waiting: "Someone else has to review, sign or record a verdict.",
  done: "The stage is complete.",
};

export default function ResearchGateOverview({ onOpen, selectedId }) {
  const { data, loading, error } = useApi(() => api.researchGateOverview(), []);
  const [state, setState] = useState("");
  const [stage, setStage] = useState("");
  const rows = useMemo(
    () => (data?.items || []).filter((row) => (!state || row.state === state) && (!stage || row.stage === stage)),
    [data, state, stage],
  );

  const columns = [
    {
      key: "name",
      header: "Student",
      sortValue: (row) => row.student.name,
      cell: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row.student)}
          aria-label={`Open the Research Gate record of ${row.student.name}`}
          className={`cursor-pointer text-left font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${row.student.id === selectedId ? "text-brand-800" : "text-ink"}`}
        >
          {row.student.name}
          <span className="meta block font-normal">{row.student.program_code}</span>
        </button>
      ),
    },
    { key: "stage", header: "Stage", hideBelow: "sm" },
    {
      key: "state",
      header: "Status",
      sortValue: (row) => STATE_LABEL[row.state],
      cell: (row) => (
        <span title={STATE_HELP[row.state]}>
          <StatusChip status={STATE_LABEL[row.state]} dot={false} />
        </span>
      ),
    },
    { key: "waiting_on", header: "Waiting on", hideBelow: "md", cell: (row) => row.waiting_on || "—" },
    { key: "reason", header: "Why", hideBelow: "md", cell: (row) => <span className="text-sm text-slate-700">{row.reason}</span> },
  ];

  return (
    <Card pad="lg" id="research-gate-overview">
      <SectionTitle
        title="Who is at the Research Gate"
        subtitle="Every active student with a research case, the stage they are at, and what they are waiting for. Choose a student to open their record."
        icon={ClipboardList}
      />
      {error && !data ? (
        <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>
      ) : (
        <div className="mt-3">
          <DataTable
            caption="Students at each Research Gate stage, with their status and what they are waiting for"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.student.id}
            minWidth="md"
            pageSize={10}
            loading={loading && !data}
            searchable="Search students"
            empty={{ icon: ClipboardList, title: "No students match", hint: "Change the status or stage filter." }}
            toolbar={
              <>
                <div className="w-full sm:w-48">
                  <Field label="Status">
                    <Select
                      value={state}
                      onChange={(event) => setState(event.target.value)}
                      placeholder="All statuses"
                      options={Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label: `${label} (${data?.counts?.[value] ?? 0})` }))}
                    />
                  </Field>
                </div>
                <div className="w-full sm:w-48">
                  <Field label="Stage">
                    <Select value={stage} onChange={(event) => setStage(event.target.value)} placeholder="All stages" options={data?.stages || []} />
                  </Field>
                </div>
              </>
            }
          />
        </div>
      )}
    </Card>
  );
}
