import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AlertTriangle, Download, PieChart, FileText, GraduationCap, ListTodo, ClipboardCheck, Briefcase, LogOut, Activity, FlaskConical, RefreshCw, Printer, CheckSquare, Square, BarChart3, Clock, Users, CalendarClock, TrendingDown, Gauge, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Button, Card, DataTable, EmptyState, Field, InlineNotice, Input, PageHeader, SectionCard, Select, Spinner, StatCard, StatusChip } from "../components/ui/index.js";
import { csvCell, downloadBlob } from "../lib/format";
import { printDataTable } from "../lib/print";
import AnalyticsSection from "./reports/AnalyticsSection.jsx";
import { PAGE } from "../lib/labels.js";

const REPORT_TABS = [
  { id: "summary", label: "Dashboard summary", icon: FileText },
  { id: "daily_changes", label: "Daily changes", icon: RefreshCw },
  { id: "graduation_candidates", label: "Graduation candidates", icon: GraduationCap },
  { id: "missing_requirements", label: "Missing requirements", icon: ClipboardCheck },
  { id: "practicum_monitoring", label: "Practicum monitoring", icon: Briefcase },
  { id: "withdrawal_requests", label: "Withdrawal requests", icon: LogOut },
  { id: "loa_readmission", label: "LOA/readmission", icon: Activity },
  { id: "at_risk", label: "At-risk", icon: AlertTriangle },
  { id: "open_overdue_tasks", label: "Open/overdue tasks", icon: ListTodo },
  { id: "research_completion", label: "Research completion", icon: FlaskConical },
];

// Module 5 (Analytics and Decision Support) and Module 7 (Reporting and
// Dashboards). These are computed from recorded event history and are fetched
// separately so the operational reports above keep their load time.
const ANALYTICS_TABS = [
  { id: "queue_aging", label: "Queue aging & backlog", icon: Clock },
  { id: "stage_bottlenecks", label: "Stage bottlenecks", icon: BarChart3 },
  { id: "owner_workload", label: "Workload & turnaround", icon: Users },
  { id: "residency_watchlist", label: "Residency watchlist", icon: ShieldCheck },
  { id: "completion_attrition", label: "Completion & attrition", icon: TrendingDown },
  { id: "scheduling_cycle_time", label: "Scheduling cycle time", icon: CalendarClock },
  { id: "followup_closure", label: "Follow-up closure", icon: Gauge },
];

// The charts that used to fill the staff home (IM20). They use the dashboard API, which is the Graduate School's
// (staff and administrator), so the tab is offered only to them. It is not in the Workflow filter: it is not a report.
const CHARTS_TAB = { id: "analytics", label: "Analytics", icon: PieChart };
const CHARTS_ROLES = new Set(["staff", "admin"]);

const ANALYTICS_IDS = new Set(ANALYTICS_TABS.map((tab) => tab.id));
const PAGED_TABS = new Set(REPORT_TABS.filter((tab) => !["summary", "daily_changes"].includes(tab.id)).map((tab) => tab.id));
const RISK_OPTIONS = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"];
const STANDING_OPTIONS = ["Active", "On Leave", "AWOL", "Withdrawn"];
const WORKFLOW_OPTIONS = REPORT_TABS.filter((tab) => tab.id !== "summary").map((tab) => ({ value: tab.id, label: tab.label }));

export default function Reports() {
  const { user } = useAuth();
  const canSeeCharts = CHARTS_ROLES.has(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [active, setActive] = useState(() => {
    const wanted = searchParams.get("workflow_type") || "summary";
    return wanted === CHARTS_TAB.id && !canSeeCharts ? "summary" : wanted;
  });
  const filters = useMemo(
    () => ({
      program_id: searchParams.get("program_id") || "",
      stage: searchParams.get("stage") || "",
      risk: searchParams.get("risk") || "",
      standing: searchParams.get("standing") || "",
      workflow_type: searchParams.get("workflow_type") || "",
    }),
    [searchParams]
  );
  const [page, setPage] = useState(1);
  const pagedTab = PAGED_TABS.has(active) ? active : "";
  const { data, loading, error } = useApi(
    () => api.reports({ ...filters, tab: pagedTab, page: pagedTab && page > 1 ? page : "" }),
    [filters.program_id, filters.stage, filters.risk, filters.standing, filters.workflow_type, pagedTab, page]
  );

  // Analytics is loaded only once an analytics tab is opened, and reloaded when
  // the student filters change.
  const analyticsWanted = ANALYTICS_IDS.has(active);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const analyticsKey = `${filters.program_id}|${filters.stage}|${filters.risk}|${filters.standing}`;

  useEffect(() => {
    if (!analyticsWanted) return undefined;
    let alive = true;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    api
      .reportsAnalytics({
        program_id: filters.program_id,
        stage: filters.stage,
        risk: filters.risk,
        standing: filters.standing,
      })
      .then((res) => alive && setAnalytics(res))
      .catch((err) => alive && setAnalyticsError(err.message || "Could not load analytics."))
      .finally(() => alive && setAnalyticsLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsWanted, analyticsKey]);

  function updateFilter(key, value) {
    setPage(1);
    if (key === "workflow_type") setActive(value || "summary");
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function chooseTab(id) {
    setPage(1);
    setActive(id);
    if (id === "summary") updateFilter("workflow_type", "");
    else updateFilter("workflow_type", id);
  }

  if (loading && !data) return <Spinner label="Loading reports..." />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load reports" hint={error} />;

  const activeTab =
    (active === CHARTS_TAB.id && CHARTS_TAB) ||
    REPORT_TABS.find((tab) => tab.id === active) ||
    ANALYTICS_TABS.find((tab) => tab.id === active) ||
    REPORT_TABS[0];
  const tabData = PAGED_TABS.has(active) ? data?.[active] : null;
  const rows = active === "summary" || analyticsWanted ? [] : tabData?.rows || [];
  const analyticsReport = analyticsWanted ? analytics?.[active] : null;

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.reportsAnalytics}
        description="Filterable monitoring reports generated from student records, tasks, and workflow cases."
        actions={<Button as={Link} to="/" variant="secondary">Back to dashboard</Button>}
      />

      <ReportFilters data={data} filters={filters} updateFilter={updateFilter} clear={() => setSearchParams({}, { replace: true })} />

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => {
          const count = (tab.id === "summary" || tab.id === "daily_changes") ? null : data?.[tab.id]?.count || 0;
          return (
            <TabButton key={tab.id} tab={tab} selected={activeTab.id === tab.id} count={count} onClick={() => chooseTab(tab.id)} />
          );
        })}
      </div>

      <div>
        <p className="eyebrow px-1 pb-2">Analytics &amp; decision support</p>
        <div className="flex flex-wrap gap-2">
          {canSeeCharts && <TabButton tab={CHARTS_TAB} selected={active === CHARTS_TAB.id} count={null} onClick={() => chooseTab(CHARTS_TAB.id)} />}
          {ANALYTICS_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              selected={activeTab.id === tab.id}
              count={analytics?.[tab.id]?.count ?? null}
              onClick={() => chooseTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {active === CHARTS_TAB.id ? (
        <AnalyticsSection filters={filters} />
      ) : active === "daily_changes" ? (
        <DailyChangesReport />
      ) : analyticsWanted ? (
        <AnalyticsPanel
          tab={activeTab}
          report={analyticsReport}
          kpis={analytics?.kpis}
          studentCount={analytics?.student_count}
          loading={analyticsLoading}
          error={analyticsError}
        />
      ) : (
        <SectionCard
          title={activeTab.label}
          icon={activeTab.icon}
          action={active !== "summary" && rows.length ? <Button variant="secondary" icon={Download} onClick={() => exportCsv(active, rows)}>Export CSV</Button> : null}
        >
          {active === "summary" ? (
            <SummaryReport summary={data.summary} />
          ) : (
            <ReportTable
              type={active}
              rows={rows}
              pagination={tabData && tabData.count > 0 ? {
                page: tabData.page || 1,
                pageCount: tabData.pages || Math.max(1, Math.ceil(tabData.count / (tabData.page_size || Math.max(1, rows.length)))),
                total: tabData.count,
                pageSize: tabData.page_size || Math.max(1, rows.length),
                onPage: setPage,
              } : undefined}
            />
          )}
        </SectionCard>
      )}
    </div>
  );
}

// One report / analytics switch: pressed = the primary look, not pressed = the secondary look.
function TabButton({ tab, selected, count, onClick }) {
  return (
    <Button size="sm" variant={selected ? "primary" : "secondary"} icon={tab.icon} aria-pressed={selected} onClick={onClick}>
      {tab.label}{count !== null && count !== undefined ? ` · ${count}` : ""}
    </Button>
  );
}

function ReportFilters({ data, filters, updateFilter, clear }) {
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Field label="Program">
          <Select
            placeholder="All programs"
            value={filters.program_id}
            onChange={(e) => updateFilter("program_id", e.target.value)}
            options={(data?.programs || []).map((program) => ({ value: String(program.id), label: program.code }))}
          />
        </Field>
        <Field label="Progress">
          <Select placeholder="All progress" value={filters.stage} onChange={(e) => updateFilter("stage", e.target.value)} options={data?.stages || []} />
        </Field>
        <Field label="Risk">
          <Select placeholder="All risk" value={filters.risk} onChange={(e) => updateFilter("risk", e.target.value)} options={RISK_OPTIONS} />
        </Field>
        <Field label="Standing">
          <Select placeholder="All standings" value={filters.standing} onChange={(e) => updateFilter("standing", e.target.value)} options={STANDING_OPTIONS} />
        </Field>
        <Field label="Workflow">
          <Select placeholder="All workflows" value={filters.workflow_type} onChange={(e) => updateFilter("workflow_type", e.target.value)} options={WORKFLOW_OPTIONS} />
        </Field>
      </div>
      {active > 0 && (
        <button type="button" onClick={clear} className="mt-3 cursor-pointer text-xs font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11">
          Clear report filters
        </button>
      )}
    </Card>
  );
}

function SummaryReport({ summary }) {
  const cards = [
    ["Students monitored", summary.total_students],
    ["Needing attention", summary.at_risk],
    ["Open tasks", summary.pending_tasks],
    ["Overdue tasks", summary.overdue_tasks],
    ["Practicum records", summary.practicum_records],
    ["Withdrawal requests", summary.withdrawal_requests],
    ["Graduation candidates", summary.graduation_candidates],
    ["Confirmed defenses", summary.confirmed_schedules],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(([label, value]) => (
        <StatCard key={label} tone="neutral" label={label} value={value} />
      ))}
    </div>
  );
}

function AnalyticsPanel({ tab, report, kpis, studentCount, loading, error }) {
  if (loading) return <Spinner label={`Computing ${tab.label.toLowerCase()}...`} />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load analytics" hint={error} />;
  const rows = report?.rows || [];
  const columns = report?.columns || [];
  const tableColumns = columns.map((col) => ({
    key: col.key,
    header: col.label,
    cell: (row) => formatAnalyticsCell(row[col.key]),
  }));
  return (
    <div className="page-stack">
      {kpis?.length ? <KpiStrip kpis={kpis} /> : null}
      <SectionCard
        title={tab.label}
        icon={tab.icon}
        action={rows.length ? <Button variant="secondary" icon={Download} onClick={() => exportAnalyticsCsv(tab.id, columns, rows)}>Export CSV</Button> : null}
      >
        <p className="meta -mt-2">
          Computed from recorded event history for {studentCount ?? 0} student(s) matching the filters.
        </p>
        {report?.totals ? <TotalsRow totals={report.totals} /> : null}
        <DataTable
          caption={tab.label}
          columns={tableColumns}
          rows={rows}
          rowKey={(row, index) => index}
          minWidth="md"
          pageSize={0}
          empty={{ icon: FileText, title: "Nothing to report", hint: "No records match the current filters." }}
        />
      </SectionCard>
    </div>
  );
}

function KpiStrip({ kpis }) {
  return (
    <SectionCard title="Module KPI measurements" icon={Gauge}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const tone = kpi.met === null ? "text-slate-500" : kpi.met ? "text-brand-700" : "text-amber-700";
          return (
            <div key={kpi.kpi} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="eyebrow">{kpi.module}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{kpi.kpi}</p>
              <p className={`page-title mt-2 ${tone}`}>
                {kpi.value}{kpi.unit}
              </p>
              <p className="meta">Target {kpi.target}</p>
              <p className="meta mt-1">{kpi.basis}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function TotalsRow({ totals }) {
  const entries = Object.entries(totals || {});
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
          {key.replace(/_/g, " ")}: {formatAnalyticsCell(value)}
        </span>
      ))}
    </div>
  );
}

function formatAnalyticsCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(1);
  return String(value);
}

function downloadCsv(filename, lines) {
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), filename);
}

function exportAnalyticsCsv(type, columns, rows) {
  const lines = [columns.map((col) => csvCell(col.label)).join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((col) => csvCell(row[col.key])).join(","));
  });
  downloadCsv(`${type}.csv`, lines);
}

// The student a row belongs to: name links to the record, number and program underneath.
function StudentCell({ student }) {
  return (
    <>
      <Link to={`/students/${student.id}`} className="font-semibold text-brand-700 hover:underline">{student.name}</Link>
      <p className="meta">{student.student_number} · {student.program_code}</p>
    </>
  );
}

const studentColumn = { key: "student", header: "Student", cell: (row) => <StudentCell student={row.student} /> };
const chipColumn = (key, header, value) => ({ key, header, cell: (row) => <StatusChip status={value(row)} dot={false} /> });

// One entry per report: the columns, how a row is keyed, and the screen-reader caption.
const REPORT_TABLES = {
  graduation_candidates: {
    caption: "Graduation candidates",
    rowKey: (row) => row.id,
    columns: [
      studentColumn,
      { key: "window", header: "Window", cell: (row) => row.review_window },
      chipColumn("coursework", "Coursework", (row) => row.coursework_status),
      chipColumn("research", "Research", (row) => row.research_status),
      chipColumn("practicum", "Practicum", (row) => row.practicum_status),
      chipColumn("status", "Status", (row) => row.endorsement_status),
    ],
  },
  missing_requirements: {
    caption: "Students with missing requirements",
    rowKey: (row) => row.student.id,
    columns: [
      studentColumn,
      { key: "coursework", header: "Coursework", cell: (row) => (row.coursework.length ? row.coursework.join("; ") : "None") },
      { key: "research", header: "Research", cell: (row) => (row.research.length ? row.research.join("; ") : "None") },
      { key: "practicum", header: "Practicum", cell: (row) => row.practicum || "None" },
      { key: "owner", header: "Next owner", cell: (row) => row.next_owner },
    ],
  },
  practicum_monitoring: {
    caption: "Practicum monitoring",
    rowKey: (row) => row.id,
    columns: [
      studentColumn,
      { key: "site", header: "Site", cell: (row) => row.practicum_site || "—" },
      { key: "hours", header: "Hours", cell: (row) => `${row.completed_hours}/${row.required_hours}` },
      chipColumn("documents", "Documents", (row) => row.document_status),
      { key: "certificates", header: "Certificates", cell: (row) => row.certificate_count },
      chipColumn("status", "Status", (row) => row.status),
    ],
  },
  withdrawal_requests: {
    caption: "Withdrawal requests",
    rowKey: (row) => row.id,
    columns: [
      studentColumn,
      {
        key: "subject",
        header: "Subject / semester",
        cell: (row) => (
          <>
            <span className="font-semibold text-ink">{row.subject?.course_code || "—"}</span>
            <span className="meta block">{row.effective_term || "—"}</span>
          </>
        ),
      },
      {
        key: "window",
        header: "Window",
        cell: (row) => (
          <span className="meta">
            {row.withdrawal_window?.status || "—"}
            <span className="block">Deadline: {row.withdrawal_window?.deadline || "—"}</span>
            <span className="block">Fee: {row.withdrawal_window?.fee_percent != null ? `${row.withdrawal_window.fee_percent}% of term` : "—"}</span>
          </span>
        ),
      },
      chipColumn("dean", "Dean", (row) => row.dean_decision),
      chipColumn("registrar", "Sent to Registrar", (row) => row.registrar_status),
      { key: "record", header: "Academic record", cell: (row) => <span className="meta font-semibold text-brand-700">{row.academic_record_effect || "—"}</span> },
      chipColumn("status", "Status", (row) => row.status),
    ],
  },
  loa_readmission: {
    caption: "Leave of absence and readmission requests",
    rowKey: (row) => row.id,
    columns: [
      studentColumn,
      { key: "request", header: "Request", cell: (row) => row.kind_label },
      chipColumn("status", "Status", (row) => row.status_label || row.status),
      { key: "period", header: "Period / return semester", cell: (row) => row.period_text || "—" },
      { key: "owner", header: "Next owner", cell: (row) => row.owner || "—" },
      { key: "registrar", header: "Registrar list", cell: (row) => (row.registrar_status && row.registrar_status !== "Not Ready" ? row.registrar_status : "—") },
    ],
  },
  at_risk: {
    caption: "At-risk students",
    rowKey: (row) => row.student.id,
    columns: [
      studentColumn,
      chipColumn("risk", "Risk", (row) => row.student.risk_level),
      { key: "recommendation", header: "Recommendation", cell: (row) => row.top_recommendation?.recommendation || "No recommendation" },
      { key: "owner", header: "Owner", cell: (row) => row.top_recommendation?.owner || "—" },
    ],
  },
  open_overdue_tasks: {
    caption: "Open and overdue tasks",
    rowKey: (row) => row.id,
    columns: [
      { key: "task", header: "Task", cell: (row) => <span className="font-semibold text-ink">{row.title}</span> },
      { key: "student", header: "Student", cell: (row) => row.student_name || "—" },
      { key: "owner", header: "Owner", cell: (row) => row.owner_role },
      { key: "due", header: "Due", cell: (row) => row.due_at },
      chipColumn("status", "Status", (row) => (row.overdue ? "Overdue" : row.status)),
    ],
  },
  research_completion: {
    caption: "Research completion",
    rowKey: (row) => row.case.id,
    columns: [
      studentColumn,
      { key: "case", header: "Case", cell: (row) => row.case.title },
      { key: "gate", header: "Gate", cell: (row) => row.case.current_gate_label },
      chipColumn("status", "Status", (row) => row.case.status),
    ],
  },
};

function ReportTable({ type, rows, pagination }) {
  const table = REPORT_TABLES[type];
  if (!table) return null;
  return (
    <DataTable
      caption={table.caption}
      columns={table.columns}
      rows={rows}
      rowKey={table.rowKey}
      minWidth="md"
      pageSize={0}
      pagination={pagination}
      empty={{ icon: FileText, title: "No rows match the filters" }}
    />
  );
}

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function changeText(item) {
  if (item.previous_status && item.new_status && item.previous_status !== item.new_status) {
    return `${item.detail} (${item.previous_status} → ${item.new_status})`;
  }
  return item.detail;
}

function DailyChangesReport() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load(targetDate) {
    setLoading(true);
    setError("");
    try {
      const res = await api.dailyChanges(targetDate);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function toggleReflected(item) {
    setBusyId(item.id);
    try {
      const next = !item.reflected_in_aims;
      await api.markChangeReflected(item.id, next);
      setData((current) => ({
        ...current,
        items: current.items.map((row) => (row.id === item.id ? { ...row, reflected_in_aims: next } : row)),
        summary: {
          ...current.summary,
          reflected: current.summary.reflected + (next ? 1 : -1),
          pending: current.summary.pending + (next ? -1 : 1),
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const items = data?.items || [];
  const summary = data?.summary || { total: 0, reflected: 0, pending: 0 };

  function exportChangesCsv() {
    const headers = ["Time", "Change type", "Student", "Student No", "Program", "Change", "By", "Sent to Registrar"];
    const lines = [headers.join(",")];
    items.forEach((item) => {
      lines.push([
        item.time, item.change_type, item.student_name, item.student_number,
        item.program_code, changeText(item), item.actor, item.reflected_in_aims ? "Yes" : "No",
      ].map(csvCell).join(","));
    });
    downloadCsv(`daily-changes-${date}.csv`, lines);
  }

  function printChanges() {
    printDataTable({
      title: "Daily changes list",
      subtitle: `Date: ${date}`,
      columns: ["Time", "Change type", "Student", "Student No", "Program", "Change", "By", "Sent"],
      rows: items.map((item) => [
        item.time ? new Date(item.time).toLocaleTimeString() : "",
        item.change_type, item.student_name, item.student_number, item.program_code,
        changeText(item), item.actor, item.reflected_in_aims ? "Yes" : "No",
      ]),
    });
  }

  const columns = [
    {
      key: "time",
      header: "Time",
      cell: (item) => <span className="whitespace-nowrap text-slate-500">{item.time ? new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>,
    },
    { key: "type", header: "Change type", cell: (item) => <StatusChip status={item.change_type} dot={false} /> },
    {
      key: "student",
      header: "Student",
      cell: (item) => (
        <>
          <Link to={`/students/${item.student_id}`} className="font-semibold text-brand-700 hover:underline">{item.student_name}</Link>
          <p className="meta">{item.student_number} · {item.program_code}</p>
        </>
      ),
    },
    { key: "change", header: "Change", cell: (item) => changeText(item) },
    { key: "by", header: "By", cell: (item) => <span className="text-slate-500">{item.actor}</span> },
    {
      key: "sent",
      header: "Sent to Registrar",
      align: "right",
      cell: (item) => (
        <Button
          size="sm"
          variant="secondary"
          icon={item.reflected_in_aims ? CheckSquare : Square}
          disabled={busyId === item.id}
          onClick={() => toggleReflected(item)}
          className={`whitespace-nowrap ${item.reflected_in_aims ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : ""}`}
        >
          {item.reflected_in_aims ? "Sent" : "Mark as sent"}
        </Button>
      ),
    },
  ];

  return (
    <SectionCard
      title="Daily changes"
      subtitle="Every change made in this system on the selected date. Export or print the list for the Registrar, then mark each change as sent."
      icon={RefreshCw}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="max-w-44" aria-label="Change report date" />
          <Button variant="secondary" icon={Download} onClick={exportChangesCsv} disabled={!items.length}>CSV</Button>
          <Button variant="secondary" icon={Printer} onClick={printChanges} disabled={!items.length}>Print</Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <StatCard tone="neutral" label="Changes today" value={summary.total} />
        <StatCard tone="success" label="Sent to Registrar" value={summary.reflected} />
        <StatCard tone="warning" label="Not yet sent" value={summary.pending} />
      </div>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      {loading ? (
        <Spinner label="Loading changes…" />
      ) : (
        <DataTable
          caption="Changes recorded on the selected date"
          columns={columns}
          rows={items}
          rowKey="id"
          minWidth="md"
          pageSize={0}
          empty={{
            icon: FileText,
            title: "No changes on this date",
            hint: "Pick another date, or make changes in Enrollment, Withdrawal, or the standing-change workflows.",
          }}
        />
      )}
    </SectionCard>
  );
}

function exportCsv(type, rows) {
  const flattened = rows.map((row) => flattenRow(type, row));
  const headers = Object.keys(flattened[0] || {});
  const lines = [headers.join(",")];
  flattened.forEach((row) => {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  });
  downloadCsv(`${type}.csv`, lines);
}

function flattenRow(type, row) {
  if (row.student) {
    return {
      student: row.student.name,
      student_number: row.student.student_number,
      program: row.student.program_code,
      status: row.status || row.endorsement_status || row.dean_decision || "",
      detail: row.review_window || row.practicum_site || row.effective_term || row.title || "",
    };
  }
  if (row.case) return { student: row.student.name, program: row.student.program_code, gate: row.case.current_gate_label, status: row.case.status };
  return {
    student: row.student?.name,
    program: row.student?.program_code,
    status: row.student?.risk_level || row.standing || row.status || "",
    detail: row.top_recommendation?.recommendation || row.next_owner || row.title || "",
  };
}
