import { Link } from "react-router-dom";
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
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { CHART_COLORS, RISK_COLORS, SCHEDULE_COLORS, formatDate, relativeDays } from "../lib/format";

function Kpi({ icon: Icon, label, value, sub, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 24px rgba(15,23,42,0.10)",
  fontSize: 13,
};

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.dashboard(), []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load dashboard" hint={error} />;

  const k = data.kpis;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Graduate School Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every figure below is computed live from recorded transactions — student handoffs, audits, gates, panels, and schedules.
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Students monitored" value={k.total_students} sub={`${k.active_students} active`} tone="brand" />
        <Kpi icon={AlertTriangle} label="Needing attention" value={k.at_risk} sub={`${k.high_risk} high risk`} tone="amber" />
        <Kpi icon={ListTodo} label="Open tasks" value={k.pending_tasks} sub={`${k.overdue_tasks} overdue`} tone="red" />
        <Kpi icon={CalendarCheck} label="Confirmed defenses" value={k.confirmed_schedules} sub={`${k.needs_availability} awaiting availability`} tone="blue" />
      </div>

      {/* Secondary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat icon={UserCheck} label="Active" value={k.active_students} />
        <MiniStat icon={CalendarOff} label="On leave" value={k.on_leave} />
        <MiniStat icon={CheckCircle2} label="Completed" value={k.completed} />
        <MiniStat icon={Clock} label="Overdue tasks" value={k.overdue_tasks} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
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
              <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#0f7a44" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk level" subtitle="Computed from monitoring signals">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.risk_distribution}
                dataKey="count"
                nameKey="risk"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={2}
              >
                {data.risk_distribution.map((entry) => (
                  <Cell key={entry.risk} fill={RISK_COLORS[entry.risk] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Students by college" subtitle="Program clusters under monitoring">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.college_distribution} margin={{ left: -16, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="college" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-12} textAnchor="end" height={56} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#1c9a59" barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Research gate position" subtitle="Active research cases by gate">
          {data.gate_distribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.gate_distribution} dataKey="count" nameKey="gate" outerRadius={92} paddingAngle={2}>
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
        </ChartCard>

        <ChartCard title="Defense scheduling" subtitle="Outcome of scheduling requests">
          {data.schedule_distribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.schedule_distribution} dataKey="count" nameKey="status" innerRadius={50} outerRadius={92} paddingAngle={2}>
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
        </ChartCard>
      </div>

      {/* Open work queue by owner */}
      <ChartCard title="Open work queue by owner" subtitle="Who currently owns the next action">
        {data.tasks_by_owner.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.tasks_by_owner} margin={{ left: -16, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="owner" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#0f7a44" barSize={48} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No open tasks" />
        )}
      </ChartCard>

      {/* Activity + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Recent activity" subtitle="Latest recorded transactions" icon={Clock} />
          {data.recent_logs.length ? (
            <ul className="space-y-3">
              {data.recent_logs.map((log) => (
                <li key={log.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{log.result}</p>
                    <p className="truncate text-xs text-slate-500">
                      {log.student_name || log.source_reference || "Workflow"} · next: {log.next_owner || "—"} · {formatDate(log.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" hint="Complete a workflow to populate this feed." />
          )}
          <Link to="/activity" className="btn-ghost mt-4 w-full">
            View full activity log <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Open work queue" subtitle="Highest-priority pending tasks" icon={ListTodo} />
          {data.open_tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {data.open_tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.owner_role} · {task.student_name || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge value={task.overdue ? "Overdue" : "Pending"} />
                    <p className="mt-1 text-xs text-slate-400">{relativeDays(task.due_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No pending tasks" />
          )}
          <Link to="/work-queue" className="btn-ghost mt-4 w-full">
            Open the work queue <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-xl font-semibold leading-none text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

