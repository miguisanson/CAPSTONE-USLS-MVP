// One report (IM20): its filters, a sortable and paged table of the rows the API gives, and the two downloads.
// The columns come from the API, so the screen, the Excel file and the PDF always show the same fields. The downloads
// are plain links to the same address with the same filters plus `format`, so they hold exactly the rows on screen.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, DataTable, EmptyState, SectionCard, Spinner, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import ReportFilters from "./ReportFilters.jsx";

const STATUS_COLUMNS = new Set(["risk", "eligibility", "when", "batch_status", "kind"]);
const DATE_COLUMNS = new Set(["since", "date"]);
const NUMBER_COLUMNS = new Set(["days_late", "days_waiting", "total"]);
const WIDE_TEXT = new Set(["reason", "missing", "panel", "item"]);

const isCount = (key) => NUMBER_COLUMNS.has(key) || key.startsWith("s_");

/** The cell for one column of one row. */
function cellFor(key, row) {
  const value = row[key];
  if (key === "student") {
    return (
      <>
        <Link to={`/students/${row.student_id}`} className="font-semibold text-brand-700 hover:underline">{row.student}</Link>
        <p className="meta">{row.student_number}</p>
      </>
    );
  }
  if (key === "verdict" && value !== "Not yet recorded") return <StatusChip status={value} dot={false} />;
  if (STATUS_COLUMNS.has(key)) return <StatusChip status={value} dot={false} />;
  if (DATE_COLUMNS.has(key)) return formatDate(value);
  if (isCount(key)) return <span className={value === 0 ? "text-slate-400" : "font-semibold text-ink"}>{value}</span>;
  if (WIDE_TEXT.has(key)) return <span className="block min-w-48 whitespace-normal">{value || "-"}</span>;
  return value === "" || value == null ? "-" : value;
}

function columnsFor(data) {
  return data.columns.map((column) => ({
    key: column.key,
    header: column.label,
    sortable: true,
    align: isCount(column.key) ? "right" : "left",
    className: column.key === "student" ? "min-w-40" : DATE_COLUMNS.has(column.key) ? "whitespace-nowrap" : undefined,
    sortValue: (row) => (column.key === "student" ? row.student : row[column.key]),
    cell: (row) => cellFor(column.key, row),
  }));
}

export default function ReportPanel({ report, params, setParam, clearFilters }) {
  const query = useMemo(() => {
    const picked = {};
    for (const spec of report.filters) if (params.get(spec.key)) picked[spec.key] = params.get(spec.key);
    return picked;
  }, [report, params]);
  const queryKey = JSON.stringify(query);
  const { data, loading, error } = useApi(() => api.report(report.id, query), [report.id, queryKey]);

  if (error) return <EmptyState icon={AlertTriangle} title="Could not load this report" hint={error} />;
  if (!data) return <Spinner label="Loading the report…" />;

  const count = data.count;
  const filtered = Object.keys(query).length > 0;
  const downloads = count > 0 ? (
    <div className="flex flex-wrap gap-2">
      <Button as="a" href={api.reportDownloadUrl(report.id, query, "xlsx")} download variant="secondary" icon={FileSpreadsheet}>Download Excel</Button>
      <Button as="a" href={api.reportDownloadUrl(report.id, query, "pdf")} download variant="secondary" icon={FileText}>Download PDF</Button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" icon={FileSpreadsheet} disabled>Download Excel</Button>
      <Button variant="secondary" icon={FileText} disabled>Download PDF</Button>
    </div>
  );

  return (
    <div className="page-stack">
      <ReportFilters specs={report.filters} options={data.options} params={params} onChange={setParam} onClear={clearFilters} />
      <SectionCard title={data.title} subtitle={report.about} action={downloads} aria-busy={loading}>
        <p className="meta" aria-live="polite">
          {count} {count === 1 ? "row" : "rows"}
          {filtered ? " match the filters" : ""}
        </p>
        <DataTable
          caption={data.title}
          columns={columnsFor(data)}
          rows={data.rows}
          rowKey={(row, index) => `${row.student_id ?? row.program}-${row.entry ?? ""}-${row.since ?? row.date ?? ""}-${index}`}
          minWidth={data.columns.length > 8 ? "lg" : "md"}
          pageSize={10}
          empty={{
            icon: FileText,
            title: data.empty,
            hint: filtered ? "Remove a filter to see more rows." : "Rows appear here as the records change.",
          }}
        />
      </SectionCard>
    </div>
  );
}
