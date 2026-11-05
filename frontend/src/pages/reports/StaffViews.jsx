// The staff and coordinator report views (I-141, F2): S1 what holds students back, S2 where they get stuck, S4 how fast
// offices close requests, S8 records to fix. Each answers one question, says what to do with the answer, has a table
// of the same numbers, and says why when it is empty. Every count opens the students behind it.
import { useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, DataTable, EmptyState, Spinner } from "../../components/ui/index.js";
import { BLUE, BarsChart, ChartCard, ChartChips, GREEN, AMBER, ORANGE, RED, ListSection } from "./ChartParts.jsx";
import ListDialog, { CountButton } from "./ListDialog.jsx";
import { columnsFor } from "./ReportPanel.jsx";

const Loading = ({ error, label }) => (error ? <EmptyState icon={AlertTriangle} title="Could not load this report" hint={error} /> : <Spinner label={label} />);
const dash = (value) => (value == null ? "-" : value);

// ---------------------------------------------------------------- S1 Needs attention
const ATTENTION_COLUMNS = [
  { key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "stage", label: "Stage" }, { key: "level", label: "Risk" },
  { key: "detail", label: "Main reason" }, { key: "days_in_stage", label: "Days in stage" }, { key: "owner", label: "Next owner" },
];

export function AttentionView({ scope, scopeKey, params, setParam }) {
  const { data, error } = useApi(() => api.reportV2("attention", scope), [scopeKey]);
  if (!data) return <Loading error={error} label="Loading the students who need attention…" />;
  const cause = params.get("cause") || "";
  const chosen = data.causes.find((c) => c.key === cause);
  const rows = cause ? data.rows.filter((row) => row.causes.includes(cause)) : data.rows;
  const select = (key) => setParam("cause", key === cause ? "" : key);
  const askAbout = (c) => `Show ${c.label}: ${c.count} students`;

  const chart = (
    <>
      <p className="text-sm text-slate-600">
        {data.rows.length} students need attention: {data.levels.Delayed} delayed and {data.levels["At Risk of Delay"]} at risk of delay. A student can have more than one cause.
      </p>
      <BarsChart
        data={data.causes}
        categoryKey="label"
        series={[{ key: "count", name: "Students", color: BLUE }]}
        onSelect={(row) => select(data.causes.find((c) => c.label === row.label)?.key)}
        ariaLabel="Students per cause"
      />
      <ChartChips items={data.causes.map((c) => ({ key: c.key, label: c.label, count: c.count, aria: askAbout(c) }))} onClick={(item) => select(item.key)} ariaLabel="Causes" />
    </>
  );
  const table = {
    caption: "What is holding students back? (table)",
    rowKey: "key",
    columns: [
      { key: "label", header: "Cause" },
      { key: "count", header: "Students", align: "right", cell: (c) => <CountButton count={c.count} label={askAbout(c)} onClick={() => select(c.key)} /> },
    ],
    rows: data.causes,
  };
  const params2 = { ...scope, ...(cause ? { cause } : {}) };
  const downloads = (
    <div className="flex flex-wrap gap-2">
      <Button as="a" href={api.reportV2Url("attention", params2, "xlsx")} download variant="secondary" icon={FileSpreadsheet} disabled={!rows.length}>Download Excel</Button>
      <Button as="a" href={api.reportV2Url("attention", params2, "pdf")} download variant="secondary" icon={FileText} disabled={!rows.length}>Download PDF</Button>
    </div>
  );
  return (
    <div className="page-stack">
      <ChartCard
        question="What is holding students back?"
        hint="Start with the longest bar: that cause affects the most students. Select a bar to list those students."
        empty={data.causes.length ? null : { title: "No students need attention for these filters", hint: "Nobody is marked At Risk of Delay or Delayed. Change the program, year started or period to look elsewhere." }}
        chart={chart}
        table={table}
      />
      <ListSection
        title="Students who need attention"
        hint={chosen ? `Showing only: ${chosen.label}.` : "Most delayed first, then longest in the same stage. The next owner is the office that can move the student on."}
        count={rows.length}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {chosen && <Button variant="secondary" size="sm" onClick={() => select(cause)}>Show all causes</Button>}
            {downloads}
          </div>
        }
      >
        <DataTable
          caption="Students who need attention"
          columns={columnsFor({ columns: ATTENTION_COLUMNS })}
          rows={rows}
          rowKey="student_id"
          minWidth="lg"
          pageSize={10}
          empty={{ title: "No students in this list", hint: "Nobody is marked At Risk of Delay or Delayed for these filters." }}
        />
      </ListSection>
    </div>
  );
}

// ---------------------------------------------------------------- S2 Where students get stuck
const ZONES = [
  { key: "green", word: "on time", head: "On time", color: GREEN, text: "#fff" },
  { key: "yellow", word: "slow", head: "Slow", color: AMBER, text: "#0f172a" },
  { key: "red", word: "stuck", head: "Stuck", color: RED, text: "#fff" },
];
const STAGE_LIST_COLUMNS = [
  { key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "stage", label: "Stage" },
  { key: "days_in_stage", label: "Days in stage" }, { key: "zone", label: "Zone" },
];

export function StagesView({ scope, scopeKey }) {
  const { data, error } = useApi(() => api.reportV2("stages", scope), [scopeKey]);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading the stage clock…" />;
  const { warn, high } = data.thresholds;
  const rows = data.rows.filter((r) => r.students > 0);
  const ask = (row, zone) => `Show ${zone ? row[zone.key] : row.students} students in ${row.stage}${zone ? ` who are ${zone.word}` : ""}`;
  const show = (row, zone) => setOpen({ row, zone });
  const table = {
    caption: "Stage clock",
    rowKey: "stage",
    minWidth: "lg",
    columns: [
      { key: "stage", header: "Stage" },
      { key: "students", header: "Students", align: "right", cell: (r) => <CountButton count={r.students} label={ask(r)} onClick={() => show(r)} /> },
      { key: "median_days", header: "Median days", align: "right", cell: (r) => dash(r.median_days) },
      { key: "p90_days", header: "Slowest 10% (days)", align: "right", cell: (r) => dash(r.p90_days) },
      { key: "longest_days", header: "Longest (days)", align: "right", cell: (r) => dash(r.longest_days) },
      ...ZONES.map((zone) => ({ key: zone.key, header: zone.head, align: "right", cell: (r) => <CountButton count={r[zone.key]} label={ask(r, zone)} onClick={() => show(r, zone)} /> })),
    ],
    rows: data.rows,
  };
  return (
    <>
      <ChartCard
        question="Where do students wait the longest?"
        hint="Look for stages with slow or stuck students, open each stage, and ask the next owner what is blocking each one."
        empty={rows.length ? null : { title: "No active students for these filters", hint: "Change the program, year started or period to look elsewhere." }}
        chart={
          <>
            <BarsChart data={rows} categoryKey="stage" series={ZONES.map((z) => ({ key: z.key, name: z.head, color: z.color, text: z.text }))} ariaLabel="Students per stage, split by days in the stage" />
            <p className="meta">On time: under {warn} days in the stage. Slow: {warn} to {high - 1} days. Stuck: {high} days or more. Days in a stage are counted from the day the student entered it.</p>
          </>
        }
        table={table}
        tableBelow
      />
      {open && (
        <ListDialog
          title={`${open.row.stage}: ${open.zone ? `${open.zone.head.toLowerCase()} students` : "all students"}`}
          endpoint="stages"
          params={{ ...scope, stage: open.row.stage, zone: open.zone?.key || "" }}
          pick={(d) => d.students}
          columns={STAGE_LIST_COLUMNS}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- S4 Office speed
const AGE_SERIES = [
  { key: "bucket_0_7", name: "0-7 days", color: GREEN, text: "#fff" },
  { key: "bucket_8_14", name: "8-14 days", color: AMBER, text: "#0f172a" },
  { key: "bucket_15_30", name: "15-30 days", color: ORANGE, text: "#fff" },
  { key: "bucket_over_30", name: "Over 30 days", color: RED, text: "#fff" },
];
const CASE_COLUMNS = [
  { key: "student", label: "Student" }, { key: "process_area", label: "Request" }, { key: "days", label: "Days waiting" }, { key: "next_owner", label: "Next owner" },
];

export function SpeedView({ scope, scopeKey }) {
  const { data, error } = useApi(() => api.reportV2("cycle-times", scope), [scopeKey]);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading office speed…" />;
  const withOpen = data.rows.filter((r) => r.open_cases > 0);
  const ask = (r) => `Show ${r.open_cases} open requests in ${r.process_area}`;
  const table = {
    caption: "Office cycle times",
    rowKey: "slug",
    minWidth: "lg",
    columns: [
      { key: "process_area", header: "Office" },
      { key: "open_cases", header: "Open requests", align: "right", cell: (r) => <CountButton count={r.open_cases} label={ask(r)} onClick={() => setOpen(r)} /> },
      ...AGE_SERIES.map((s) => ({ key: s.key, header: s.name, align: "right" })),
      { key: "median_age_days", header: "Median wait now (days)", align: "right", cell: (r) => dash(r.median_age_days) },
      { key: "oldest_age_days", header: "Longest wait now (days)", align: "right", cell: (r) => dash(r.oldest_age_days) },
      { key: "closed_cases", header: "Closed", align: "right" },
      { key: "median_cycle_days", header: "Median days to close", align: "right", cell: (r) => dash(r.median_cycle_days) },
      { key: "p90_cycle_days", header: "Slowest 10% to close (days)", align: "right", cell: (r) => dash(r.p90_cycle_days) },
    ],
    rows: data.rows,
  };
  return (
    <>
      <ChartCard
        question="Which offices are slow to close requests?"
        hint="Offices with a long red bar have requests waiting over 30 days: ask those offices first. The table gives the days an office takes to close a request."
        empty={withOpen.length ? null : { title: "No open requests for these filters", hint: "Every request in scope has been closed. Change the program or year started to look elsewhere." }}
        chart={<BarsChart data={withOpen} categoryKey="process_area" series={AGE_SERIES} ariaLabel="Open requests per office, by days waited" />}
        table={table}
        tableBelow
      />
      {open && (
        <ListDialog
          title={`Open requests: ${open.process_area}`}
          columns={CASE_COLUMNS}
          rows={data.cases.filter((c) => c.slug === open.slug)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- S8 Records to fix
const MISSING = [
  { key: "", label: "All" },
  { key: "research_case", label: "No research record" },
  { key: "adviser", label: "No adviser" },
];
const FIX_COLUMNS = [{ key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "stage", label: "Stage" }, { key: "detail", label: "What is missing" }];

export function RecordsView({ scope, scopeKey, params, setParam }) {
  const { data, error } = useApi(() => api.reportV2("records-to-fix", scope), [scopeKey]);
  if (!data) return <Loading error={error} label="Loading the records to fix…" />;
  const missing = params.get("missing") || "";
  const rows = missing ? data.rows.filter((row) => row.missing.includes(missing)) : data.rows;
  const query = { ...scope, ...(missing ? { missing } : {}) };
  return (
    <ListSection
      title="Which research students have records missing?"
      hint="Open each student and add the missing research record or adviser; the student then leaves this list."
      count={rows.length}
      action={
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={api.reportV2Url("records-to-fix", query, "xlsx")} download variant="secondary" icon={FileSpreadsheet} disabled={!rows.length}>Download Excel</Button>
          <Button as="a" href={api.reportV2Url("records-to-fix", query, "pdf")} download variant="secondary" icon={FileText} disabled={!rows.length}>Download PDF</Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="What is missing">
        {MISSING.map((kind) => {
          const n = kind.key ? data.counts[kind.key] : data.count;
          const on = missing === kind.key;
          return (
            <button
              key={kind.key || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setParam("missing", kind.key)}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 max-sm:min-h-11 ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-brand-50 hover:text-brand-700"}`}
            >
              {kind.label} · {n}
            </button>
          );
        })}
      </div>
      <DataTable
        caption="Records to fix"
        columns={columnsFor({ columns: FIX_COLUMNS })}
        rows={rows}
        rowKey="student_id"
        minWidth="md"
        pageSize={10}
        empty={{ title: "No records to fix for these filters", hint: "Every research-stage student has a research record and an adviser." }}
      />
    </ListSection>
  );
}
