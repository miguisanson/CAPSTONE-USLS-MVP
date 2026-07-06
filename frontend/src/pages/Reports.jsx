import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AlertTriangle, Download, FileText, GraduationCap, ListTodo, ClipboardCheck, Briefcase, LogOut, Activity, FlaskConical } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, SectionTitle, Spinner, StatusBadge } from "../components/ui";

const REPORT_TABS = [
  { id: "summary", label: "Dashboard summary", icon: FileText },
  { id: "graduation_candidates", label: "Graduation candidates", icon: GraduationCap },
  { id: "missing_requirements", label: "Missing requirements", icon: ClipboardCheck },
  { id: "practicum_monitoring", label: "Practicum monitoring", icon: Briefcase },
  { id: "withdrawal_requests", label: "Withdrawal requests", icon: LogOut },
  { id: "loa_readmission", label: "LOA/readmission", icon: Activity },
  { id: "at_risk", label: "At-risk", icon: AlertTriangle },
  { id: "open_overdue_tasks", label: "Open/overdue tasks", icon: ListTodo },
  { id: "research_completion", label: "Research completion", icon: FlaskConical },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [active, setActive] = useState(searchParams.get("workflow_type") || "summary");
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
  const { data, loading, error } = useApi(
    () => api.reports(filters),
    [filters.program_id, filters.stage, filters.risk, filters.standing, filters.workflow_type]
  );

  function updateFilter(key, value) {
    if (key === "workflow_type") setActive(value || "summary");
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function chooseTab(id) {
    setActive(id);
    if (id === "summary") updateFilter("workflow_type", "");
    else updateFilter("workflow_type", id);
  }

  if (loading) return <Spinner label="Loading reports..." />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load reports" hint={error} />;

  const activeTab = REPORT_TABS.find((tab) => tab.id === active) || REPORT_TABS[0];
  const rows = active === "summary" ? [] : data?.[active]?.rows || [];

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Filterable monitoring reports generated from student records, tasks, and workflow cases.</p>
        </div>
        <Link to="/" className="btn-ghost">Back to dashboard</Link>
      </div>

      <ReportFilters data={data} filters={filters} updateFilter={updateFilter} clear={() => setSearchParams({}, { replace: true })} />

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab.id === tab.id;
          const count = tab.id === "summary" ? null : data?.[tab.id]?.count || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => chooseTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                selected ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50"
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}{count !== null ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      <Card className="p-5">
        <SectionTitle
          title={activeTab.label}
          icon={activeTab.icon}
          action={active !== "summary" && rows.length ? <button type="button" onClick={() => exportCsv(active, rows)} className="btn-ghost"><Download className="h-4 w-4" /> Export CSV</button> : null}
        />
        {active === "summary" ? <SummaryReport summary={data.summary} /> : <ReportTable type={active} rows={rows} />}
      </Card>
    </div>
  );
}

function ReportFilters({ data, filters, updateFilter, clear }) {
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Select label="Program" value={filters.program_id} onChange={(value) => updateFilter("program_id", value)}>
          <option value="">All programs</option>
          {(data?.programs || []).map((program) => <option key={program.id} value={program.id}>{program.code}</option>)}
        </Select>
        <Select label="Progress" value={filters.stage} onChange={(value) => updateFilter("stage", value)}>
          <option value="">All progress</option>
          {(data?.stages || []).map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </Select>
        <Select label="Risk" value={filters.risk} onChange={(value) => updateFilter("risk", value)}>
          <option value="">All risk</option>
          {["Low", "Medium", "High", "Critical", "Medium/High/Critical"].map((risk) => <option key={risk} value={risk}>{risk}</option>)}
        </Select>
        <Select label="Standing" value={filters.standing} onChange={(value) => updateFilter("standing", value)}>
          <option value="">All standings</option>
          {["Active", "On Leave", "Withdrawn", "Completed"].map((standing) => <option key={standing} value={standing}>{standing}</option>)}
        </Select>
        <Select label="Workflow" value={filters.workflow_type} onChange={(value) => updateFilter("workflow_type", value)}>
          <option value="">All workflows</option>
          {REPORT_TABS.filter((tab) => tab.id !== "summary").map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </Select>
      </div>
      {active > 0 && <button type="button" onClick={clear} className="mt-3 text-xs font-semibold text-brand-700">Clear report filters</button>}
    </Card>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input cursor-pointer">{children}</select>
    </label>
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
        <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="font-display text-2xl font-semibold text-ink">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ReportTable({ type, rows }) {
  if (!rows.length) return <EmptyState icon={FileText} title="No rows match the filters" />;
  if (type === "graduation_candidates") return <GraduationTable rows={rows} />;
  if (type === "missing_requirements") return <MissingTable rows={rows} />;
  if (type === "practicum_monitoring") return <PracticumTable rows={rows} />;
  if (type === "withdrawal_requests") return <WithdrawalTable rows={rows} />;
  if (type === "loa_readmission") return <LoaTable rows={rows} />;
  if (type === "at_risk") return <RiskTable rows={rows} />;
  if (type === "open_overdue_tasks") return <TaskTable rows={rows} />;
  if (type === "research_completion") return <ResearchTable rows={rows} />;
  return null;
}

function BaseTable({ headers, rows, render }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
            {headers.map((header) => <th key={header} className="px-4 py-2.5">{header}</th>)}
          </tr>
        </thead>
        <tbody>{rows.map(render)}</tbody>
      </table>
    </div>
  );
}

function StudentCell({ student }) {
  return (
    <td className="px-4 py-2.5">
      <Link to={`/students/${student.id}`} className="font-semibold text-brand-700 hover:underline">{student.name}</Link>
      <p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p>
    </td>
  );
}

function GraduationTable({ rows }) {
  return <BaseTable headers={["Student", "Window", "Coursework", "Research", "Practicum", "Status"]} rows={rows} render={(row) => (
    <tr key={row.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5 text-slate-600">{row.review_window}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.coursework_status} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.research_status} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.practicum_status} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.endorsement_status} dot={false} /></td>
    </tr>
  )} />;
}

function MissingTable({ rows }) {
  return <BaseTable headers={["Student", "Coursework", "Research", "Practicum", "Next owner"]} rows={rows} render={(row) => (
    <tr key={row.student.id} className="border-b border-slate-50 align-top">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5 text-slate-600">{row.coursework.length ? row.coursework.join("; ") : "None"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.research.length ? row.research.join("; ") : "None"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.practicum || "None"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.next_owner}</td>
    </tr>
  )} />;
}

function PracticumTable({ rows }) {
  return <BaseTable headers={["Student", "Site", "Hours", "Documents", "Certificates", "Status"]} rows={rows} render={(row) => (
    <tr key={row.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5 text-slate-600">{row.practicum_site || "—"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.completed_hours}/{row.required_hours}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.document_status} dot={false} /></td>
      <td className="px-4 py-2.5 text-slate-600">{row.certificate_count}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.status} dot={false} /></td>
    </tr>
  )} />;
}

function WithdrawalTable({ rows }) {
  return <BaseTable headers={["Student", "Effective semester", "Dean", "Requirements", "Fees", "Status"]} rows={rows} render={(row) => (
    <tr key={row.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5 text-slate-600">{row.effective_term || "—"}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.dean_decision} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.requirement_status} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.fee_status} dot={false} /></td>
      <td className="px-4 py-2.5"><StatusBadge value={row.status} dot={false} /></td>
    </tr>
  )} />;
}

function LoaTable({ rows }) {
  return <BaseTable headers={["Student", "Standing", "Stage", "Latest readmission"]} rows={rows} render={(row) => (
    <tr key={row.student.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5"><StatusBadge value={row.standing} dot={false} /></td>
      <td className="px-4 py-2.5 text-slate-600">{row.stage}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.latest_readmission?.result || "No readmission action"}</td>
    </tr>
  )} />;
}

function RiskTable({ rows }) {
  return <BaseTable headers={["Student", "Risk", "Recommendation", "Owner"]} rows={rows} render={(row) => (
    <tr key={row.student.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5"><StatusBadge value={row.student.risk_level} dot={false} /></td>
      <td className="px-4 py-2.5 text-slate-600">{row.top_recommendation?.recommendation || "No recommendation"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.top_recommendation?.owner || "—"}</td>
    </tr>
  )} />;
}

function TaskTable({ rows }) {
  return <BaseTable headers={["Task", "Student", "Owner", "Due", "Status"]} rows={rows} render={(row) => (
    <tr key={row.id} className="border-b border-slate-50">
      <td className="px-4 py-2.5 font-semibold text-ink">{row.title}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.student_name || "—"}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.owner_role}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.due_at}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.overdue ? "Overdue" : row.status} dot={false} /></td>
    </tr>
  )} />;
}

function ResearchTable({ rows }) {
  return <BaseTable headers={["Student", "Case", "Gate", "Status"]} rows={rows} render={(row) => (
    <tr key={row.case.id} className="border-b border-slate-50">
      <StudentCell student={row.student} />
      <td className="px-4 py-2.5 text-slate-600">{row.case.title}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.case.current_gate_label}</td>
      <td className="px-4 py-2.5"><StatusBadge value={row.case.status} dot={false} /></td>
    </tr>
  )} />;
}

function exportCsv(type, rows) {
  const flattened = rows.map((row) => flattenRow(type, row));
  const headers = Object.keys(flattened[0] || {});
  const lines = [headers.join(",")];
  flattened.forEach((row) => {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
