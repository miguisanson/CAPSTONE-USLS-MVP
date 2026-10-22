// "Preview class list": what an uploaded class list would do, row by row, before anything is imported.
import { AlertTriangle, CheckCircle2, Table2 } from "lucide-react";
import { Button, DataTable, InlineNotice, Modal } from "../../components/ui/index.js";
import { toneOf } from "../../lib/tone";

const COUNT_TONE = { neutral: "neutral", ready: "success", warning: "warning", error: "danger" };

function PreviewCount({ label, value, tone }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneOf(COUNT_TONE[tone]).chip}`}>
      {label}: {value}
    </span>
  );
}

const RESULT_TEXT = { ready: "text-brand-700", warning: "text-amber-700", error: "text-red-700" };

const studentName = (row) => [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown student";

const COLUMNS = [
  { key: "row", header: "Row", align: "center", width: "4rem", className: "text-xs font-semibold text-slate-500" },
  {
    key: "student",
    header: "Student",
    sortValue: (row) => `${studentName(row)} ${row.student_id || ""}`,
    cell: (row) => (
      <>
        <p className="font-semibold text-ink">{studentName(row)}</p>
        <p className="meta mt-0.5">{row.student_id || "No student ID"}</p>
      </>
    ),
  },
  { key: "program", header: "Program", className: "font-medium text-slate-600" },
  { key: "subject_code", header: "Subject", className: "font-semibold text-slate-700" },
  { key: "faculty", header: "Faculty", className: "text-slate-600" },
  {
    key: "result",
    header: "Import result",
    className: "min-w-[16rem]",
    sortValue: (row) => `${row.status} ${row.message}`,
    cell: (row) => (
      <div className="flex items-start gap-2">
        {row.status === "ready" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        ) : (
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${row.status === "warning" ? "text-amber-600" : "text-red-600"}`} aria-hidden="true" />
        )}
        <p className={`text-xs font-medium leading-relaxed ${RESULT_TEXT[row.status] || RESULT_TEXT.error}`}>{row.message}</p>
      </div>
    ),
  },
];

export default function ClassListPreviewDialog({ preview, busy, onClose, onImport }) {
  return (
    <Modal
      title="Preview class list"
      subtitle={`${preview.filename} · ${preview.term}`}
      icon={Table2}
      size="xl"
      closeLabel="Close class list preview"
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <p className="meta max-sm:text-center sm:mr-auto sm:self-center">
            Rows that need review are skipped. Valid rows and faculty assignments are saved when you confirm.
          </p>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Choose another file</Button>
          <Button onClick={onImport} disabled={!preview.total_rows} loading={busy}>
            {busy ? "Importing..." : "Confirm import"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <PreviewCount label="Rows detected" value={preview.total_rows} tone="neutral" />
          <PreviewCount label="Ready" value={preview.ready_count} tone="ready" />
          <PreviewCount label="Already enrolled" value={preview.warning_count} tone="warning" />
          <PreviewCount label="Needs review" value={preview.error_count} tone="error" />
        </div>
        <DataTable
          caption="Class list rows and what the import would do with each"
          columns={COLUMNS}
          rows={preview.rows}
          rowKey={(row) => `${row.row}-${row.student_id}-${row.subject_code}`}
          minWidth="lg"
          pageSize={25}
          searchable={{ placeholder: "Search rows", label: "Search class list rows" }}
          empty={{ icon: Table2, title: "No rows were found in this file", hint: "Check that the file has the class list columns, then choose it again." }}
        />
        {preview.truncated && (
          <InlineNotice tone="warning">Showing the first 300 rows. All detected rows will still be processed.</InlineNotice>
        )}
      </div>
    </Modal>
  );
}
