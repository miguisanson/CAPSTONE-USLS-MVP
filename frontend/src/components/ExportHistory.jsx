import { api } from "../api";
import { useApi } from "../hooks";
import { formatDateTime } from "../lib/format";
import { DataTable, InlineNotice, Spinner } from "./ui/index.js";

// Every Registrar list downloaded for one process, newest first (Leave, Readmission, and since 2026-11-08 Graduation
// and Withdrawal). `detailsHeader` names the "what was in it" column: the batches (Graduation) or the students (Withdrawal).
// Remount it (change its `key`) after a new export so the list reloads.
export default function ExportHistory({ slug, detailsHeader = "", countHeader = "Requests", caption = "Registrar lists downloaded" }) {
  const { data, loading, error } = useApi(() => api.leaveExportLog(slug), [slug]);
  if (loading) return <Spinner label="Loading export history…" />;
  if (error) return <InlineNotice tone="danger">{error}</InlineNotice>;
  const columns = [
    { key: "file_name", header: "File", cell: (row) => <span className="break-all font-medium text-ink">{row.file_name}</span> },
    ...(detailsHeader ? [{ key: "details", header: detailsHeader, cell: (row) => <span className="break-words text-slate-700">{row.details || "—"}</span> }] : []),
    { key: "case_count", header: countHeader },
    { key: "exported_by", header: "Downloaded by" },
    { key: "exported_at", header: "When", cell: (row) => <span className="whitespace-nowrap text-slate-500">{formatDateTime(row.exported_at)}</span> },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={data?.items || []}
      minWidth="sm"
      pageSize={10}
      empty={{ title: "No lists downloaded yet", hint: "Each download is recorded here." }}
    />
  );
}
