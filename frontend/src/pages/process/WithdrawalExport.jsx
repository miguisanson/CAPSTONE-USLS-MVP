import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { api } from "../../api";
import { Button, DataTable, InlineNotice, Modal, StatusChip } from "../../components/ui/index.js";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import { plural } from "../leave/leaveHelpers";

const TAGGED = "Subject Tagged - Registrar Preparation";
const EXPORTED = "Exported - Ready to Send";

/**
 * The Withdrawal page's Registrar follow-up: tagged withdrawals wait for the Excel list.
 * Dragging a card into "Excel export", or its "Prepare the Excel export" button, opens the
 * same window as the strip below (`signal.type === "export"`).
 */
export default function WithdrawalExport({ ctx }) {
  const rows = useMemo(() => ctx.cases.filter((item) => [TAGGED, EXPORTED].includes(item.status)), [ctx.cases]);
  const pending = useMemo(() => rows.filter((item) => item.status === TAGGED), [rows]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState(null);

  const signalled = ctx.signal?.type === "export";
  const open = (pickerOpen || signalled) && ctx.isStaff;
  const signalItem = signalled ? ctx.signal.item : null;

  // Opened by a drag or by the button in the request window: start with that card ticked.
  useEffect(() => {
    if (!signalItem) return;
    setSelected(new Set([signalItem.id, ...pending.map((item) => item.id)]));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalItem]);

  function openPicker() {
    setSelected(new Set(pending.map((item) => item.id)));
    setError("");
    setPickerOpen(true);
  }

  function close() {
    if (busy) return;
    setPickerOpen(false);
    if (signalled) ctx.clearSignal();
  }

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download() {
    const ids = rows.filter((item) => selected.has(item.id)).map((item) => item.id);
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      const exported = await api.exportWithdrawalXlsx(ids);
      setFollowUp({ filename: exported.filename, count: exported.count });
      setPickerOpen(false);
      if (signalled) ctx.clearSignal();
      setSelected(new Set());
      await ctx.reload();
      ctx.banner("success", `${plural(exported.count, "approved subject withdrawal")} exported as ${exported.filename}.`);
    } catch (err) {
      setError(err.message || "Could not export the approved-withdrawals workbook.");
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "tick",
      width: "2.5rem",
      header: <span className="sr-only">Tick</span>,
      cell: (item) => (
        <input
          type="checkbox"
          checked={selected.has(item.id)}
          onChange={() => toggle(item.id)}
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
          <p className="meta">{item.student.student_number} · {item.student.program_code}</p>
        </>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      cell: (item) => (
        <>
          <p className="font-semibold text-slate-700">{item.subject?.code || "Subject pending"}</p>
          <p className="meta">{item.subject?.title || ""}</p>
        </>
      ),
    },
    {
      key: "term",
      header: "Semester / deadline",
      cell: (item) => (
        <div className="text-xs text-slate-600">
          <p className="font-semibold">{item.term_label || "Not recorded"}</p>
          <p>Deadline: {item.window?.deadline || "Not recorded"}</p>
        </div>
      ),
    },
    {
      key: "fee",
      header: "Fee",
      cell: (item) => (
        <span className="text-xs font-semibold text-brand-700">
          {item.window?.fee_percent != null ? `${item.window.fee_percent}% of term (${item.window.fee_tier})` : "Fee not stated"}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (item) => <StatusChip status={item.status_label} dot={false} /> },
  ];

  return (
    <>
      {ctx.isStaff && (
        <section aria-labelledby="registrar-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="registrar-heading" className="card-title">Registrar list</h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Dean-approved withdrawals whose subject is tagged go to the Registrar. The portal does not send any email: download the
                Excel list, email it through the official channel, and wait for the Registrar to acknowledge.
              </p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nothing to send to the Registrar yet. Tagged withdrawals appear here.</p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button icon={FileSpreadsheet} onClick={openPicker}>Prepare Excel export</Button>
                  <p className="text-sm text-slate-600">
                    {plural(pending.length, "tagged withdrawal")} waiting for the Excel list
                    {rows.length > pending.length ? `, ${plural(rows.length - pending.length, "withdrawal")} already exported` : ""}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {open && (
        <Modal
          size="xl"
          title="Approved subject withdrawals"
          subtitle={`${plural(selected.size, "request")} ticked · export the Excel list for the manual Registrar email`}
          onClose={close}
          dismissible={!busy}
          closeLabel="Close the export window"
          footer={
            <>
              <Button variant="secondary" onClick={close} disabled={busy}>Close</Button>
              <Button icon={Download} loading={busy} onClick={download} disabled={busy || !selected.size}>
                {busy ? "Exporting..." : "Download Excel list"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Every ticked subject already shows Withdrawn in Official Offered Subjects. Fees are settled with the Business Office.
            </p>
            {error && <InlineNotice tone="danger">{error}</InlineNotice>}
            <DataTable
              caption="Approved subject withdrawals"
              columns={columns}
              rows={rows}
              minWidth="md"
              pageSize={0}
              empty={{ title: "No tagged withdrawals yet" }}
            />
          </div>
        </Modal>
      )}

      {followUp && (
        <ExportFollowUpModal
          id="withdrawal-export-follow-up"
          title="Withdrawal Excel export complete"
          filename={followUp.filename}
          actorLabel="Graduate School Staff"
          fileLabel="withdrawal update"
          onClose={() => setFollowUp(null)}
        />
      )}
    </>
  );
}
