// The Analytics tab of Reports (IM20): four charts that moved off the staff home - lifecycle stage, risk level, students
// by college, research gate position - narrowed by the same filters as every other Reports tab (program, progress,
// risk, standing). Clicking a bar, a slice, or the chip under a chart opens the students behind that category.
// Every bar is labelled: the axis shows every category (interval 0, a label column wide enough for the longest
// name) and the figure sits at the end of the bar, so nothing has to be read off a grid.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Legend, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, DataTable, EmptyState, InlineNotice, Modal, SectionCard, Spinner, StatusChip } from "../../components/ui/index.js";
import { CHART_COLORS, RISK_COLORS, formatDate } from "../../lib/format";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 24px rgba(15,23,42,0.10)",
  fontSize: 13,
};
const AXIS_TICK = { fontSize: 12, fill: "#334155" };
const LABEL_WIDTH = 190; // wide enough for "Withdrawal In Progress" on one line (recharts wraps a tick well before its width)
const ROW_HEIGHT = 30;

/** One horizontal bar per category, every category labelled. */
function CategoryBars({ data, labelKey, onSelect, rowHeight = ROW_HEIGHT, ariaLabel }) {
  const height = data.length * rowHeight + 16;
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32, top: 4, bottom: 4 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey={labelKey} width={LABEL_WIDTH} interval={0} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="count" name="Students" isAnimationActive={false} radius={[0, 6, 6, 0]} fill={CHART_COLORS[0]} cursor="pointer" onClick={(entry) => onSelect(entry?.[labelKey])}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The chips under a chart: the keyboard and screen-reader way to open a category, with the figure in words. */
function CategoryChips({ items, onClick }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Chart categories">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onClick(item.label)}
          aria-label={`Show ${item.label}: ${item.count} records`}
          className="cursor-pointer rounded-lg bg-slate-50 px-2 py-1 text-2xs font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 max-sm:min-h-11"
        >
          {item.label} · {item.count}
        </button>
      ))}
    </div>
  );
}

function ChartBlock({ title, subtitle, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="meta">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AnalyticsSection({ filters }) {
  const params = { program_id: filters.program_id, stage: filters.stage, risk: filters.risk, standing: filters.standing };
  const { data, loading, error, refetch } = useApi(() => api.dashboard(params), [params.program_id, params.stage, params.risk, params.standing]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function openDetail(type, value) {
    if (!value) return;
    setDetail({ type, value, title: `${value}`, rows: [] });
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await api.dashboardDrilldown({ type, value, ...params }));
    } catch (err) {
      setDetailError(err.message || "Could not load the students in this category.");
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading && !data) return <Spinner label="Computing analytics…" />;
  if (error) {
    return (
      <InlineNotice tone="danger" title="Could not load analytics">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>
        </div>
      </InlineNotice>
    );
  }

  const stages = data.stage_distribution;
  const risks = data.risk_distribution;
  const colleges = data.college_distribution;
  const gates = data.gate_distribution;

  return (
    <>
      <SectionCard
        title="Analytics"
        subtitle="Computed live from recorded transactions, for the students the filters above select. Select a bar, a slice or a chip to see the students."
        icon={BarChart3}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
          <ChartBlock title="Lifecycle stage distribution" subtitle="Where students currently sit in the graduate lifecycle">
            <CategoryBars data={stages} labelKey="stage" onSelect={(value) => openDetail("stage", value)} ariaLabel="Students per lifecycle stage" />
            <CategoryChips items={stages.map((item) => ({ label: item.stage, count: item.count }))} onClick={(value) => openDetail("stage", value)} />
          </ChartBlock>

          <div className="space-y-8">
            <ChartBlock title="Risk level" subtitle="Computed from monitoring signals">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={risks} isAnimationActive={false} dataKey="count" nameKey="risk" innerRadius={56} outerRadius={88} paddingAngle={2} cursor="pointer" onClick={(entry) => openDetail("risk", entry?.risk)}>
                    {risks.map((entry) => (
                      <Cell key={entry.risk} fill={RISK_COLORS[entry.risk] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <CategoryChips items={risks.map((item) => ({ label: item.risk, count: item.count }))} onClick={(value) => openDetail("risk", value)} />
            </ChartBlock>

            <ChartBlock title="Students by college" subtitle="Program clusters under monitoring">
              {colleges.length ? (
                <CategoryBars data={colleges} labelKey="college" onSelect={(value) => openDetail("college", value)} ariaLabel="Students per college" />
              ) : (
                <EmptyState size="sm" title="No students match the filters" />
              )}
              <CategoryChips items={colleges.map((item) => ({ label: item.college, count: item.count }))} onClick={(value) => openDetail("college", value)} />
            </ChartBlock>

            <ChartBlock title="Research gate position" subtitle="Active research cases by gate">
              {gates.length ? (
                <CategoryBars data={gates} labelKey="gate" rowHeight={40} onSelect={(value) => openDetail("gate", value)} ariaLabel="Research cases per gate" />
              ) : (
                <EmptyState size="sm" title="No research cases yet" />
              )}
              <CategoryChips items={gates.map((item) => ({ label: item.gate, count: item.count }))} onClick={(value) => openDetail("gate", value)} />
            </ChartBlock>
          </div>
        </div>
      </SectionCard>
      {detail && <CategoryModal detail={detail} loading={detailLoading} error={detailError} onClose={() => setDetail(null)} />}
    </>
  );
}

// The dialog behind every chart category: the students in it, each linked to the record.
function CategoryModal({ detail, loading, error, onClose }) {
  return (
    <Modal title={detail.title} subtitle={detail.definition} size="xl" onClose={onClose} closeLabel="Close dashboard details">
      {loading ? (
        <Spinner label="Loading filtered details…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load details" hint={error} />
      ) : !detail.rows?.length ? (
        <EmptyState title="No records in this category" hint="The category is valid, but no matching records are available under the current data." />
      ) : (
        <DataTable caption="Students in this category" columns={STUDENT_COLUMNS} rows={detail.rows} minWidth="md" pageSize={0} />
      )}
    </Modal>
  );
}

const STUDENT_COLUMNS = [
  {
    key: "name",
    header: "Student",
    cell: (row) => (
      <>
        <Link to={`/students/${row.id}`} className="font-semibold text-brand-700 hover:underline">{row.name}</Link>
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
