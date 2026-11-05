// The students behind a number (I-141: "every count opens the students behind it"). One dialog for the whole Reports
// area: it either asks the server for a list (and offers the same list as Excel and PDF) or shows rows the page already
// holds (and offers a CSV of them).
import { AlertTriangle, FileSpreadsheet, FileText, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, DataTable, EmptyState, Modal, SkeletonTable } from "../../components/ui/index.js";
import { columnsFor } from "./ReportPanel.jsx";

export const STUDENT_COLUMNS = [
  { key: "student", label: "Student" }, { key: "program", label: "Program" }, { key: "stage", label: "Stage" }, { key: "detail", label: "Why it is in this list" },
];

/** One count that opens its list. A zero is only a number: there is nothing behind it. */
export function CountButton({ count, label, onClick }) {
  if (!count) return <span className="text-slate-400">0</span>;
  return (
    <button type="button" aria-label={label} onClick={onClick} className="cursor-pointer rounded-md px-1.5 font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:bg-brand-50 max-sm:min-h-11">
      {count}
    </button>
  );
}

function Rows({ title, count, columns, rows, downloads, csvName }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="meta" aria-live="polite">{count} {count === 1 ? "row" : "rows"}</p>
        {downloads}
      </div>
      <DataTable
        caption={title}
        columns={columns}
        rows={rows}
        rowKey={(row, index) => `${row.student_id ?? row.student}-${index}`}
        minWidth="md"
        pageSize={10}
        csv={downloads ? undefined : { filename: csvName }}
        empty={{ icon: Users, title: "Nobody is in this list", hint: "Change the filters at the top of the page to see more." }}
      />
    </div>
  );
}

function Remote({ title, endpoint, params, pick, columns, filterRows }) {
  const { data, error } = useApi(() => api.reportV2(endpoint, params), [endpoint, JSON.stringify(params)]);
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load this list" hint={error} />;
  if (!data) return <SkeletonTable />;
  const rows = (pick ? pick(data) : data.rows).filter(filterRows || (() => true));
  const downloads = (
    <div className="flex flex-wrap gap-2">
      <Button as="a" href={api.reportV2Url(endpoint, params, "xlsx")} download variant="secondary" size="sm" icon={FileSpreadsheet}>Download Excel</Button>
      <Button as="a" href={api.reportV2Url(endpoint, params, "pdf")} download variant="secondary" size="sm" icon={FileText}>Download PDF</Button>
    </div>
  );
  return <Rows title={title} count={rows.length} columns={columnsFor({ columns: columns || data.columns })} rows={rows} downloads={filterRows ? null : downloads} csvName={title} />;
}

/**
 * @param title     what the list is (the dialog's name)
 * @param endpoint  the report path after /reports/ (the server lists and exports it) - or
 * @param rows      rows the page already holds, with `columns` [{ key, label }]
 * @param pick      for an endpoint: which part of the answer is the list (default `rows`)
 * @param filterRows  keep only some of an endpoint's rows (then the download is the page's CSV, not the server's file)
 */
export default function ListDialog({ title, subtitle, endpoint, params = {}, pick, columns = STUDENT_COLUMNS, rows, filterRows, onClose }) {
  return (
    <Modal title={title} subtitle={subtitle} size="xl" onClose={onClose} closeLabel={`Close ${title}`}>
      {endpoint ? (
        <Remote title={title} endpoint={endpoint} params={params} pick={pick} columns={columns} filterRows={filterRows} />
      ) : (
        <Rows title={title} count={rows.length} columns={columnsFor({ columns })} rows={rows} csvName={title} />
      )}
    </Modal>
  );
}
