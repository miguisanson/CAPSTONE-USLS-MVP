// The Dean's report views (I-141, F4): D1 what waits and for how long, D2 how fast decisions are made, D3 what was
// decided, D4 the graduation pipeline, D5 the active students at each stage (I-189). The server counts everything (/api/reports/decisions), so the Dean home, the
// approvals queue and these pages cannot disagree. Every count opens the cases behind it.
import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { EmptyState, SkeletonTable, StatCard } from "../../components/ui/index.js";
import { AMBER, BLUE, BarsChart, ChartCard, GREEN, ORANGE, RED } from "./ChartParts.jsx";
import ListDialog, { CountButton } from "./ListDialog.jsx";
import { DEFAULT_STAGES } from "../../lib/stages.js";

// "Decide within 7 days": the same line the summary uses for a request that has waited too long (the server's
// REPORT_WAITING_DAYS). shortcut: a constant until the Graduate School puts a decision target in the Business Rules register.
export const DECIDE_WITHIN_DAYS = 7;
const NO_DECISIONS = { title: "No decisions in this period", hint: "Nothing was decided in this period for these filters. Choose a longer period at the top to see earlier decisions." };
const CASE_COLUMNS = [
  { key: "student", label: "Student" }, { key: "label", label: "Process" }, { key: "days", label: "Days" }, { key: "detail", label: "Where it stands" },
];
const BAND_COLORS = [GREEN, AMBER, ORANGE, RED];
const BAND_TEXT = ["#fff", "#0f172a", "#fff", "#fff"];

/** Loads /api/reports/decisions once per scope for the three views that read it. */
function useDecisions(scope, scopeKey) {
  return useApi(() => api.reportV2("decisions", scope), [scopeKey]);
}
const Loading = ({ error }) => (error ? <EmptyState icon={AlertTriangle} title="Could not load this report" hint={error} /> : <SkeletonTable />);
const dash = (value) => (value == null ? "-" : value);
const caseRow = (c) => ({
  ...c,
  detail: c.state === "waiting" ? `Waiting ${c.days} days (${c.band})` : `Decided in ${c.days} days: ${c.outcome}`,
});

// ---------------------------------------------------------------- D1 Waiting for my decision
export function WaitingView({ scope, scopeKey }) {
  const { data, error } = useDecisions(scope, scopeKey);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading the decisions waiting…" />;
  const { bands, rows, total } = data.waiting;
  const waiting = rows.filter((r) => r.total > 0);
  const oldest = Math.max(0, ...rows.map((r) => r.oldest_days || 0));
  const cases = (process, band) => data.cases.filter((c) => c.state === "waiting" && (!process || c.process === process) && (!band || c.band === band)).map(caseRow);
  const show = (title, process, band) => setOpen({ title, rows: cases(process, band) });
  const series = bands.map((band, i) => ({ key: band, name: band, color: BAND_COLORS[i], text: BAND_TEXT[i] }));
  const flat = waiting.map((r) => ({ label: r.label, ...r.bands }));
  const table = {
    caption: "Which decisions have waited the longest? (table)",
    rowKey: "process",
    minWidth: "lg",
    columns: [
      { key: "label", header: "Process" },
      { key: "total", header: "Waiting", align: "right", cell: (r) => <CountButton count={r.total} label={`Show ${r.total} waiting in ${r.label}`} onClick={() => show(`Waiting: ${r.label}`, r.process)} /> },
      ...bands.map((band) => ({ key: band, header: band, align: "right", sortValue: (r) => r.bands[band], cell: (r) => <CountButton count={r.bands[band]} label={`Show ${r.bands[band]} waiting ${band} in ${r.label}`} onClick={() => show(`Waiting ${band}: ${r.label}`, r.process, band)} /> })),
      { key: "oldest_days", header: "Longest wait (days)", align: "right", cell: (r) => dash(r.oldest_days) },
    ],
    rows,
  };
  return (
    <div className="page-stack">
      <StatCard
        icon={Clock}
        label="Decisions waiting"
        value={total}
        sub={total ? `Longest wait: ${oldest} days` : "Nothing is waiting for a decision"}
        tone={total ? "warning" : "success"}
        to="/dean/approvals"
      />
      <ChartCard
        question="Which decisions have waited the longest?"
        hint="Decide the red and orange bars first: those requests have waited over a week. Select a bar to see the cases."
        empty={total ? null : { title: "No decisions are waiting", hint: "Requests for the Dean's decision appear here as soon as an office sends a request." }}
        chart={
          <BarsChart
            data={flat}
            categoryKey="label"
            series={series}
            onSelect={(row, band) => {
              const found = waiting.find((r) => r.label === row.label);
              if (found) show(`Waiting ${band}: ${found.label}`, found.process, band);
            }}
            ariaLabel="Decisions waiting per process, by days waited"
          />
        }
        table={table}
      />
      {open && <ListDialog title={open.title} columns={CASE_COLUMNS} rows={open.rows} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- D2 How fast decisions are made
export function SpeedView({ scope, scopeKey }) {
  const { data, error } = useDecisions(scope, scopeKey);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading how fast decisions are made…" />;
  const decided = data.speed.rows.filter((r) => r.this_term.count > 0);
  const sooner = data.speed.overall.last_term;
  const show = (r) => setOpen({ title: `Decided: ${r.label}`, rows: data.cases.filter((c) => c.state === "decided" && c.process === r.process).map(caseRow) });
  const flat = decided.map((r) => ({ label: r.label, median: r.this_term.median_days, p90: r.this_term.p90_days }));
  const table = {
    caption: "How fast are decisions made? (table)",
    rowKey: "process",
    minWidth: "lg",
    columns: [
      { key: "label", header: "Process" },
      { key: "count", header: "Decisions", align: "right", sortValue: (r) => r.this_term.count, cell: (r) => <CountButton count={r.this_term.count} label={`Show ${r.this_term.count} decisions in ${r.label}`} onClick={() => show(r)} /> },
      { key: "median", header: "Median days", align: "right", sortValue: (r) => r.this_term.median_days, cell: (r) => dash(r.this_term.median_days) },
      { key: "p90", header: "Slowest 10% (days)", align: "right", sortValue: (r) => r.this_term.p90_days, cell: (r) => dash(r.this_term.p90_days) },
      { key: "before", header: "Median in the earlier period", align: "right", sortValue: (r) => r.last_term?.median_days, cell: (r) => dash(r.last_term?.median_days) },
      { key: "change", header: "Change (days)", align: "right", sortValue: (r) => r.change_days, cell: (r) => (r.change_days == null ? "-" : r.change_days > 0 ? `+${r.change_days}` : r.change_days) },
    ],
    rows: data.speed.rows,
  };
  return (
    <div className="page-stack">
      <ChartCard
        question="How fast are decisions made?"
        hint="A bar past the dashed line is slower than the target. A long gap between the median and the slowest 10% means a few cases wait far longer than most."
        empty={decided.length ? null : NO_DECISIONS}
        chart={
          <>
            <p className="text-sm text-slate-600">
              Target: decide within {DECIDE_WITHIN_DAYS} days. {data.speed.overall.this_term.count} decisions in this period, median {dash(data.speed.overall.this_term.median_days)} days
              {sooner ? `, against ${sooner.median_days} days in the earlier period.` : "."}
            </p>
            <BarsChart
              data={flat}
              categoryKey="label"
              stacked={false}
              series={[{ key: "median", name: "Median days", color: BLUE }, { key: "p90", name: "Slowest 10% (days)", color: AMBER }]}
              target={DECIDE_WITHIN_DAYS}
              targetLabel={`Target ${DECIDE_WITHIN_DAYS} days`}
              onSelect={(row) => show(decided.find((r) => r.label === row.label))}
              ariaLabel="Days to decide per process: median and slowest 10 percent"
            />
          </>
        }
        table={table}
      />
      {open && <ListDialog title={open.title} columns={CASE_COLUMNS} rows={open.rows} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- D3 Outcomes
const OUTCOMES = [
  { key: "approved", name: "Approved", color: GREEN, text: "#fff" },
  { key: "returned", name: "Returned", color: AMBER, text: "#0f172a" },
  { key: "denied", name: "Denied", color: RED, text: "#fff" },
];

export function OutcomesView({ scope, scopeKey }) {
  const { data, error } = useDecisions(scope, scopeKey);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading the outcomes…" />;
  const rows = data.outcomes.rows.filter((r) => r.total > 0);
  const show = (r, outcome) =>
    setOpen({ title: `${outcome ? OUTCOMES.find((o) => o.key === outcome).name : "Decided"}: ${r.label}`, rows: data.cases.filter((c) => c.state === "decided" && c.process === r.process && (!outcome || c.outcome === outcome)).map(caseRow) });
  const totals = data.outcomes.totals;
  const table = {
    caption: "What was decided? (table)",
    rowKey: "process",
    columns: [
      { key: "label", header: "Process" },
      ...OUTCOMES.map((o) => ({ key: o.key, header: o.name, align: "right", cell: (r) => <CountButton count={r[o.key]} label={`Show ${r[o.key]} ${o.name.toLowerCase()} in ${r.label}`} onClick={() => show(r, o.key)} /> })),
      { key: "total", header: "Total", align: "right", cell: (r) => <CountButton count={r.total} label={`Show ${r.total} decided in ${r.label}`} onClick={() => show(r)} /> },
    ],
    rows: data.outcomes.rows,
  };
  return (
    <div className="page-stack">
      <ChartCard
        question="What was decided?"
        hint="Many returns for one process mean its requests reach you incomplete: ask that office to check each request before sending. Select a bar to see the cases."
        empty={rows.length ? null : NO_DECISIONS}
        chart={
          <>
            <p className="text-sm text-slate-600">
              {totals.total} decisions in this period: {totals.approved} approved, {totals.returned} returned, {totals.denied} denied.
            </p>
            <BarsChart
              data={rows}
              categoryKey="label"
              series={OUTCOMES}
              onSelect={(row, outcome) => show(rows.find((r) => r.label === row.label), outcome)}
              ariaLabel="Decisions per process: approved, returned and denied"
            />
          </>
        }
        table={table}
      />
      {open && <ListDialog title={open.title} columns={CASE_COLUMNS} rows={open.rows} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- D4 Graduation pipeline
export function PipelineView({ scope, scopeKey, summary }) {
  const { data, error } = useDecisions(scope, scopeKey);
  const [open, setOpen] = useState(null);
  if (!data || !summary) return <Loading error={error} label="Loading the graduation pipeline…" />;
  const tile = summary.tiles.find((t) => t.key === "graduation");
  const graduationCases = (state) => data.cases.filter((c) => c.process === "graduation" && c.state === state).map(caseRow);
  const steps = [
    { key: "ready", label: "Ready to graduate, not yet sent to the Dean", count: tile.detail.eligible_now, open: () => setOpen({ title: "Ready, not yet sent", endpoint: "summary/graduation_ready" }) },
    { key: "sent", label: "Sent to the Dean in this period", count: tile.detail.endorsed_this_term, open: () => setOpen({ title: "Sent to the Dean", endpoint: "summary/graduation" }) },
    { key: "waiting", label: "Waiting for the Dean's decision now", count: graduationCases("waiting").length, open: () => setOpen({ title: "Waiting for the Dean", rows: graduationCases("waiting") }) },
    { key: "decided", label: "Decided in this period", count: graduationCases("decided").length, open: () => setOpen({ title: "Decided", rows: graduationCases("decided") }) },
  ];
  const total = steps.reduce((sum, s) => sum + s.count, 0);
  const table = {
    caption: "How many graduation candidates are at each step? (table)",
    rowKey: "key",
    columns: [
      { key: "label", header: "Step" },
      { key: "count", header: "Students", align: "right", cell: (s) => <CountButton count={s.count} label={`Show ${s.count} students: ${s.label}`} onClick={s.open} /> },
    ],
    rows: steps,
  };
  return (
    <div className="page-stack">
      <ChartCard
        question="How many graduation candidates are at each step?"
        hint="A step with many students and nothing in the next one is where candidates are stuck: ask that office to move those students on."
        empty={total ? null : { title: "No graduation candidates in this period", hint: "Students appear here once the student is ready to graduate or an endorsement is sent to the Dean." }}
        chart={
          <>
            <BarsChart data={steps} categoryKey="label" series={[{ key: "count", name: "Students", color: BLUE }]} onSelect={(row) => steps.find((s) => s.label === row.label)?.open()} ariaLabel="Graduation candidates per step" />
            <p className="meta">Hand-off to the Registrar is not part of this view yet.</p>
          </>
        }
        table={table}
      />
      {open && (open.endpoint
        ? <ListDialog title={open.title} endpoint={open.endpoint} params={scope} filterRows={open.keep} onClose={() => setOpen(null)} />
        : <ListDialog title={open.title} columns={CASE_COLUMNS} rows={open.rows} onClose={() => setOpen(null)} />)}
    </div>
  );
}

// ---------------------------------------------------------------- D5 Students by stage
// The Dean may read the list behind the "Active students" number (/api/reports/summary/active), so the stage counts are made
// from it. shortcut: no days-in-stage or stuck zones - those are /api/reports/stages, which only staff and the coordinators may call.
const STAGE_LIST_COLUMNS = [{ key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "detail", label: "Stage and risk" }];
const stageRank = (stage) => { const i = DEFAULT_STAGES.indexOf(stage); return i < 0 ? DEFAULT_STAGES.length : i; };

export function StagesView({ scope, scopeKey }) {
  const { data, error } = useApi(() => api.reportV2("summary/active", scope), [scopeKey]);
  const [open, setOpen] = useState(null);
  if (!data) return <Loading error={error} label="Loading the students per stage…" />;
  const byStage = {};
  for (const row of data.rows) (byStage[row.stage || "No stage"] ||= []).push(row);
  const stages = Object.entries(byStage)
    .map(([stage, rows]) => ({ stage, rows, count: rows.length }))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.stage.localeCompare(b.stage));
  const ask = (s) => `Show ${s.count} students in ${s.stage}`;
  const table = {
    caption: "How many active students are at each stage? (table)",
    rowKey: "stage",
    columns: [
      { key: "stage", header: "Stage", cell: (s) => (s.count ? <button type="button" onClick={() => setOpen(s)} className="cursor-pointer rounded-md px-1 text-left font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:bg-brand-50 max-sm:min-h-11">{s.stage}</button> : s.stage) },
      { key: "count", header: "Students", align: "right", cell: (s) => <CountButton count={s.count} label={ask(s)} onClick={() => setOpen(s)} /> },
    ],
    rows: stages,
  };
  return (
    <div className="page-stack">
      <ChartCard
        question="How many active students are at each stage?"
        hint="Select a bar or a count to see the students. A stage with many students and few in the next one is where students wait."
        empty={stages.length ? null : { title: "No active students for these filters", hint: "Change the program, year started or period to look elsewhere." }}
        chart={<BarsChart data={stages} categoryKey="stage" series={[{ key: "count", name: "Students", color: BLUE }]} onSelect={(row) => setOpen(stages.find((s) => s.stage === row.stage))} ariaLabel="Active students per stage" />}
        table={table}
      />
      {open && <ListDialog title={`${open.stage}: ${open.count} students`} columns={STAGE_LIST_COLUMNS} rows={open.rows} onClose={() => setOpen(null)} />}
    </div>
  );
}
