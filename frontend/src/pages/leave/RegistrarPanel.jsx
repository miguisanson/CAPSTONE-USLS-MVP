import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, MailCheck, Send } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { formatDate, formatDateTime } from "../../lib/format";
import { Button, DataTable, EmptyState, HistoryPanel, InlineNotice, Spinner, StatusChip } from "../../components/ui/index.js";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import { plural, whenText } from "./leaveHelpers";

const HANDOFF_TONE = {
  "Pending Handoff": "warn",
  "Exported - Ready to Send": "info",
  "Sent to Registrar": "info",
  Acknowledged: "good",
};

const EXPORTABLE = ["Pending Handoff", "Exported - Ready to Send"];

const HISTORY_COLUMNS = [
  { key: "file_name", header: "File", cell: (row) => <span className="font-medium text-ink">{row.file_name}</span> },
  { key: "case_count", header: "Requests" },
  { key: "exported_by", header: "Downloaded by" },
  { key: "exported_at", header: "When", cell: (row) => <span className="text-slate-500">{formatDateTime(row.exported_at)}</span> },
];

function ExportHistory({ slug }) {
  const { data, loading, error } = useApi(() => api.leaveExportLog(slug), [slug]);
  if (loading) return <Spinner label="Loading export history..." />;
  if (error) return <InlineNotice tone="danger">{error}</InlineNotice>;
  return (
    <DataTable
      caption="Registrar lists downloaded"
      columns={HISTORY_COLUMNS}
      rows={data?.items || []}
      minWidth="sm"
      pageSize={0}
      empty={{ title: "No lists downloaded yet", hint: "Each download is recorded here." }}
    />
  );
}

/**
 * The Registrar list: Dean-approved requests, one step at a time
 * (list downloaded -> sent by email -> Registrar acknowledged).
 */
export default function RegistrarPanel({ slug, cases, onChanged }) {
  const rows = useMemo(() => cases.filter((item) => item.registrar?.status && item.registrar.status !== "Not Ready"), [cases]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null); // { tone, text, skipped }
  const [followUp, setFollowUp] = useState(null); // { filename }
  const [historyKey, setHistoryKey] = useState(0);

  const selectedRows = rows.filter((item) => selected.has(item.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const readmission = slug === "readmission";

  function toggle(item) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((item) => item.id)));
  }

  async function download(format) {
    // With nothing ticked the server lists every approved request still waiting to go out.
    const ticked = selectedRows.filter((item) => EXPORTABLE.includes(item.registrar.status));
    if (selectedRows.length && !ticked.length) {
      setMessage({ tone: "error", text: "The ticked requests were already sent. Tick requests that are Pending Handoff or Exported - Ready to Send." });
      return;
    }
    setBusy(format);
    setMessage(null);
    try {
      const result = await api.exportLeaveRegistrarList(slug, format, ticked.map((item) => item.id));
      setFollowUp({ filename: result.filename });
      setHistoryKey((value) => value + 1);
      setSelected(new Set());
      await onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error.message || "The list could not be downloaded." });
    } finally {
      setBusy("");
    }
  }

  async function advance(status) {
    if (!selectedRows.length) {
      setMessage({ tone: "error", text: "Tick at least one request first." });
      return;
    }
    setBusy(status);
    setMessage(null);
    try {
      const result = await api.leaveHandoff(
        selectedRows.map((item) => item.id),
        status,
      );
      setMessage({ tone: result.updated?.length ? "success" : "error", text: result.message, skipped: result.skipped || [] });
      setSelected(new Set());
      await onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error.message || "That step was refused." });
    } finally {
      setBusy("");
    }
  }

  const columns = [
    {
      key: "select",
      width: "2.5rem",
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          aria-label="Tick every request in the Registrar list"
        />
      ),
      cell: (item) => (
        <input
          type="checkbox"
          checked={selected.has(item.id)}
          onChange={() => toggle(item)}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          aria-label={`Tick ${item.student.name}`}
        />
      ),
    },
    {
      key: "student",
      header: "Student",
      cell: (item) => (
        <>
          <p className="font-semibold text-ink">{item.student.name}</p>
          <p className="meta">
            {item.student.student_number} · {item.student.program_code}
          </p>
        </>
      ),
    },
    { key: "period", header: readmission ? "Return semester" : "Leave period", cell: (item) => whenText(item) },
    { key: "decided", header: "Dean decision", cell: (item) => formatDate(item.decided_at) },
    {
      key: "handoff",
      header: "Handoff",
      cell: (item) => <StatusChip status={item.registrar.status} tone={HANDOFF_TONE[item.registrar.status] || "muted"} dot={false} />,
    },
  ];

  return (
    <section aria-labelledby="registrar-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 id="registrar-heading" className="card-title">Registrar list</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Dean-approved requests that go to the Registrar. The portal does not send any email: download the list, email it yourself,
            then mark it as sent. Mark it as acknowledged when the Registrar confirms.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {message && (
          <InlineNotice tone={message.tone} icon onDismiss={() => setMessage(null)}>
            <p>{message.text}</p>
            {message.skipped?.length > 0 && (
              <div className="mt-2 font-normal">
                <p className="font-semibold">Skipped:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {message.skipped.map((row) => (
                    <li key={row.case_id}>
                      {row.student_name || `Request ${row.case_id}`} - {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </InlineNotice>
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing to send to the Registrar yet"
            hint="Approved requests appear here after the Dean decides."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={Download} loading={busy === "xlsx"} onClick={() => download("xlsx")} disabled={Boolean(busy)}>
                {busy === "xlsx" ? "Preparing..." : "Download list (Excel)"}
              </Button>
              <Button variant="secondary" icon={Download} loading={busy === "csv"} onClick={() => download("csv")} disabled={Boolean(busy)}>
                {busy === "csv" ? "Preparing..." : "Download list (CSV)"}
              </Button>
              <Button variant="secondary" icon={Send} onClick={() => advance("Sent to Registrar")} disabled={Boolean(busy) || !selectedRows.length}>
                Mark as sent
              </Button>
              <Button variant="secondary" icon={MailCheck} onClick={() => advance("Acknowledged")} disabled={Boolean(busy) || !selectedRows.length}>
                Mark as acknowledged
              </Button>
            </div>
            <p className="meta">
              {selectedRows.length
                ? `${plural(selectedRows.length, "request")} ticked.`
                : "Nothing ticked: a download includes every request still waiting to go out."}
            </p>

            <DataTable caption="Dean-approved requests for the Registrar" columns={columns} rows={rows} minWidth="md" pageSize={0} />
          </>
        )}

        <HistoryPanel label="Export history" hideLabel="Hide export history">
          <ExportHistory key={historyKey} slug={slug} />
        </HistoryPanel>
      </div>

      {followUp && (
        <ExportFollowUpModal
          id="leave-registrar-export"
          title="Registrar list downloaded"
          filename={followUp.filename}
          actorLabel="Graduate School staff"
          fileLabel={readmission ? "readmission list" : "leave of absence list"}
          onClose={() => setFollowUp(null)}
        />
      )}
    </section>
  );
}
