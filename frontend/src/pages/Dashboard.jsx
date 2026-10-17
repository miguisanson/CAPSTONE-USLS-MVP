import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  Users,
  UserCheck,
  AlertTriangle,
  ListTodo,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DataTable, EmptyState, Field, InlineNotice, Modal, PageHeader, SectionCard, Select, Spinner, StatCard, StatusChip } from "../components/ui/index.js";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { CHART_COLORS, RISK_COLORS, SCHEDULE_COLORS, formatDate, relativeDays } from "../lib/format";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 24px rgba(15,23,42,0.10)",
  fontSize: 13,
};

const OWNERS = ["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean", "Student"];

const RISK_LEVELS = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed", "At Risk of Delay/Delayed"];
const STANDINGS = ["Active", "On Leave", "AWOL", "Withdrawn"];

function DashboardFilters({ filters, meta, onChange, onClear }) {
  const active = Object.values(filters).filter(Boolean).length;
  const controls = [
    { key: "program_id", label: "Program", all: "All programs", options: (meta?.programs || []).map((program) => ({ value: String(program.id), label: program.code })) },
    { key: "stage", label: "Progress", all: "All stages", options: meta?.stages || [] },
    { key: "risk", label: "Risk", all: "All risk levels", options: RISK_LEVELS },
    { key: "standing", label: "Standing", all: "All standings", options: STANDINGS },
    { key: "owner", label: "Owner", all: "All owners", options: OWNERS },
  ];
  return (
    <Card>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {controls.map((c) => (
          <Field key={c.key} label={c.label}>
            <Select placeholder={c.all} value={filters[c.key]} onChange={(e) => onChange(c.key, e.target.value)} options={c.options} />
          </Field>
        ))}
      </div>
      {active > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11"
        >
          Clear dashboard filters
        </button>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const filters = useMemo(
    () => ({
      program_id: searchParams.get("program_id") || "",
      stage: searchParams.get("stage") || "",
      risk: searchParams.get("risk") || "",
      standing: searchParams.get("standing") || "",
      owner: searchParams.get("owner") || "",
    }),
    [searchParams]
  );
  const { data, loading, error, refetch } = useApi(
    () => api.dashboard(filters),
    [filters.program_id, filters.stage, filters.risk, filters.standing, filters.owner]
  );
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function openDetail(type, value) {
    if (!value) return;
    setDetail({ type, value, title: `${value}`, rows: [] });
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await api.dashboardDrilldown({ type, value, ...filters }));
    } catch (err) {
      setDetailError(err.message || "Could not load dashboard details.");
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) {
    return (
      <InlineNotice tone="danger" title="Could not load dashboard">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>
        </div>
      </InlineNotice>
    );
  }

  const k = data.kpis;

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title="Graduate School Overview"
        description="Every figure below is computed live from recorded transactions — student handoffs, audits, gates, panels, schedules, and completion workflows."
        actions={
          <Button as={Link} to="/reports" variant="secondary" icon={FileText}>
            Reports
          </Button>
        }
      />

      <DashboardFilters
        filters={filters}
        meta={meta}
        onChange={(key, value) => {
          const next = new URLSearchParams(searchParams);
          if (value) next.set(key, value);
          else next.delete(key);
          setSearchParams(next, { replace: true });
        }}
        onClear={() => setSearchParams({}, { replace: true })}
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Students monitored" value={k.total_students} sub={`${k.active_students} active`} tone="success" to="/students" />
        <StatCard icon={AlertTriangle} label="At risk or delayed" value={k.at_risk} sub={`${k.high_risk} delayed`} tone="warning" to="/students?risk=At Risk of Delay/Delayed" />
        <StatCard icon={ListTodo} label="Open tasks" value={k.pending_tasks} sub={`${k.overdue_tasks} overdue`} tone="danger" to="/work-queue" />
        <StatCard icon={CalendarCheck} label="Confirmed defenses" value={k.confirmed_schedules} sub={`${k.needs_availability} awaiting availability`} tone="info" to="/reports" />
      </div>

      {/* Secondary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard size="sm" tone="neutral" icon={UserCheck} label="Active" value={k.active_students} to="/students?standing=Active" />
        <StatCard size="sm" tone="neutral" icon={CalendarOff} label="On leave" value={k.on_leave} to="/students?standing=On+Leave" />
        <StatCard size="sm" tone="neutral" icon={CheckCircle2} label="Completed" value={k.completed} to="/reports?workflow_type=graduation_candidates" />
        <StatCard size="sm" tone="neutral" icon={Clock} label="Overdue tasks" value={k.overdue_tasks} to="/work-queue?status=Overdue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Lifecycle stage distribution"
          subtitle="Where students currently sit in the graduate lifecycle"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.stage_distribution} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#eef2f6" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis
                type="category"
                dataKey="stage"
                width={130}
                tick={{ fontSize: 12, fill: "#334155" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#0f7a44" barSize={18} cursor="pointer" onClick={(entry) => openDetail("stage", entry?.stage)} />
            </BarChart>
          </ResponsiveContainer>
          <ChartDrilldownButtons items={data.stage_distribution.map((item) => ({ label: item.stage, count: item.count }))} onClick={(value) => openDetail("stage", value)} />
        </SectionCard>

        <SectionCard title="Risk level" subtitle="Computed from monitoring signals">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.risk_distribution}
                dataKey="count"
                nameKey="risk"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={2}
                cursor="pointer"
                onClick={(entry) => openDetail("risk", entry?.risk)}
              >
                {data.risk_distribution.map((entry) => (
                  <Cell key={entry.risk} fill={RISK_COLORS[entry.risk] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <ChartDrilldownButtons items={data.risk_distribution.map((item) => ({ label: item.risk, count: item.count }))} onClick={(value) => openDetail("risk", value)} />
        </SectionCard>

        <SectionCard title="Students by college" subtitle="Program clusters under monitoring">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.college_distribution} margin={{ left: -16, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="college" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-12} textAnchor="end" height={56} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#1c9a59" barSize={34} cursor="pointer" onClick={(entry) => openDetail("college", entry?.college)} />
            </BarChart>
          </ResponsiveContainer>
          <ChartDrilldownButtons items={data.college_distribution.map((item) => ({ label: item.college, count: item.count }))} onClick={(value) => openDetail("college", value)} />
        </SectionCard>

        <SectionCard title="Research gate position" subtitle="Active research cases by gate">
          {data.gate_distribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.gate_distribution} dataKey="count" nameKey="gate" outerRadius={92} paddingAngle={2} cursor="pointer" onClick={(entry) => openDetail("gate", entry?.gate)}>
                  {data.gate_distribution.map((entry, i) => (
                    <Cell key={entry.gate} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No research cases yet" />
          )}
          <ChartDrilldownButtons items={data.gate_distribution.map((item) => ({ label: item.gate, count: item.count }))} onClick={(value) => openDetail("gate", value)} />
        </SectionCard>

        <SectionCard title="Defense scheduling" subtitle="Outcome of scheduling requests">
          {data.schedule_distribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.schedule_distribution} dataKey="count" nameKey="status" innerRadius={50} outerRadius={92} paddingAngle={2} cursor="pointer" onClick={(entry) => openDetail("schedule", entry?.status)}>
                  {data.schedule_distribution.map((entry) => (
                    <Cell key={entry.status} fill={SCHEDULE_COLORS[entry.status] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No schedule requests yet" />
          )}
          <ChartDrilldownButtons items={data.schedule_distribution.map((item) => ({ label: item.status, count: item.count }))} onClick={(value) => openDetail("schedule", value)} />
        </SectionCard>
      </div>

      {/* Open work queue by owner */}
      <SectionCard title="Open work queue by owner" subtitle="Who currently owns the next action">
        {data.tasks_by_owner.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.tasks_by_owner} margin={{ left: -16, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="owner" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#0f7a44" barSize={48} cursor="pointer" onClick={(entry) => openDetail("owner", entry?.owner)} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No open tasks" />
        )}
        <ChartDrilldownButtons items={data.tasks_by_owner.map((item) => ({ label: item.owner, count: item.count }))} onClick={(value) => openDetail("owner", value)} />
      </SectionCard>

      {/* Activity + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Recent activity" subtitle="Latest recorded transactions" icon={Clock}>
          {data.recent_logs.length ? (
            <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={data.recent_logs.length}>
              <ul className="space-y-3">
                {data.recent_logs.map((log) => (
                  <li key={log.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{log.result}</p>
                      <p className="meta truncate">
                        {log.student_name || log.source_reference || "Workflow"} · next: {log.next_owner || "—"} · {formatDate(log.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Button as={Link} to="/activity" variant="secondary" className="mt-4 w-full">
                Open full activity log <ArrowRight className="h-4 w-4" />
              </Button>
            </HistoryDisclosure>
          ) : (
            <EmptyState title="No activity yet" hint="Complete a workflow to populate this feed." />
          )}
        </SectionCard>

        <SectionCard title="Open work queue" subtitle="Highest-priority pending tasks" icon={ListTodo}>
          {data.open_tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {data.open_tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                    <p className="meta">
                      {task.owner_role} · {task.student_name || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusChip status={task.overdue ? "Overdue" : "Pending"} />
                    <p className="meta mt-1">{relativeDays(task.due_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No pending tasks" />
          )}
          <Button as={Link} to="/work-queue" variant="secondary" className="w-full">
            Open the work queue <ArrowRight className="h-4 w-4" />
          </Button>
        </SectionCard>
      </div>
      {detail && <DashboardDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={() => setDetail(null)} />}
    </div>
  );
}

// The drill-down dialog behind every chart category. Which table it shows depends on what was clicked.
function DashboardDetailModal({ detail, loading, error, onClose }) {
  const empty = !detail.rows?.length;
  return (
    <Modal title={detail.title} subtitle={detail.definition} size="xl" onClose={onClose} closeLabel="Close dashboard details">
      {loading ? (
        <Spinner label="Loading filtered details…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load details" hint={error} />
      ) : empty ? (
        <EmptyState title="No records in this category" hint="The dashboard category is valid, but no matching records are available under the current data." />
      ) : detail.type === "schedule" ? (
        <ScheduleDetailTable rows={detail.rows} />
      ) : detail.type === "owner" ? (
        <TaskDetailList rows={detail.rows} />
      ) : (
        <StudentDetailTable rows={detail.rows} />
      )}
    </Modal>
  );
}

function ChartDrilldownButtons({ items, onClick }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Chart categories">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onClick(item.label)}
          aria-label={`Show ${item.label}: ${item.count} records`}
          className="cursor-pointer rounded-lg bg-slate-50 px-2 py-1 text-2xs font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700"
        >
          {item.label} · {item.count}
        </button>
      ))}
    </div>
  );
}

const recordLink = (to, text) => (
  <Link to={to} className="font-semibold text-brand-700 hover:underline">{text}</Link>
);

const STUDENT_COLUMNS = [
  {
    key: "name",
    header: "Student",
    cell: (row) => (
      <>
        {recordLink(`/students/${row.id}`, row.name)}
        <p className="meta">{row.student_number}</p>
      </>
    ),
  },
  { key: "program_code", header: "Program" },
  {
    key: "stage",
    header: "Stage / status",
    cell: (row) => (
      <>
        <p className="font-medium text-slate-700">{row.stage}</p>
        <p className="meta">{row.status}</p>
      </>
    ),
  },
  { key: "risk", header: "Risk", cell: (row) => <StatusChip status={row.risk} dot={false} /> },
  { key: "relevant_date", header: "Relevant date", cell: (row) => formatDate(row.relevant_date) },
];

const SCHEDULE_COLUMNS = [
  {
    key: "student",
    header: "Student",
    cell: (row) => (
      <>
        {recordLink(`/students/${row.student.id}`, row.student.name)}
        <p className="meta">{row.student.student_number}</p>
      </>
    ),
  },
  { key: "defense_type", header: "Defense" },
  {
    key: "adviser",
    header: "Adviser / panel",
    cell: (row) => (
      <>
        {row.adviser || "—"}
        <p className="meta">{row.panel?.join(", ") || "Panel pending"}</p>
      </>
    ),
  },
  { key: "status", header: "Status", cell: (row) => <StatusChip status={row.status} dot={false} /> },
  {
    key: "date",
    header: "Date / venue",
    cell: (row) => (
      <>
        {formatDate(row.date)}
        <p className="meta">{row.venue || "Venue pending"}</p>
      </>
    ),
  },
  { key: "missing_action", header: "Action needed" },
];

function StudentDetailTable({ rows }) {
  return <DataTable caption="Students in this category" columns={STUDENT_COLUMNS} rows={rows} minWidth="md" pageSize={0} />;
}

function ScheduleDetailTable({ rows }) {
  return <DataTable caption="Defense schedules in this category" columns={SCHEDULE_COLUMNS} rows={rows} minWidth="lg" pageSize={0} />;
}

function TaskDetailList({ rows }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
          <div>
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="meta">{row.student_name} · {row.owner_role}</p>
          </div>
          <div className="text-right">
            <StatusChip status={row.overdue ? "Overdue" : row.status} />
            <p className="meta mt-1">{formatDate(row.due_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
