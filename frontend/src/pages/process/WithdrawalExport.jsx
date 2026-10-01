import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { api } from "../../api";
import { ErrorNote, StatusBadge } from "../../components/ui";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import ModalShell from "../leave/ModalShell";
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

  return (
    <>
      {ctx.isStaff && (
        <section aria-labelledby="registrar-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="registrar-heading" className="text-base font-semibold text-ink">Registrar list</h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Dean-approved withdrawals whose subject is tagged go to the Registrar. The portal does not send any email: download the
                Excel list, email it through the official channel, and wait for the Registrar to acknowledge.
              </p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nothing to send to the Registrar yet. Tagged withdrawals appear here.</p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={openPicker} className="btn-primary px-4 py-2">
                    <FileSpreadsheet className="h-4 w-4" /> Prepare Excel export
                  </button>
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
        <ModalShell
          id="withdrawal-registrar-handoff"
          size="wide"
          title="Approved subject withdrawals"
          subtitle={`${plural(selected.size, "request")} ticked · export the Excel list for the manual Registrar email`}
          onClose={close}
          closeLabel="Close the export window"
          footer={
            <>
              <button type="button" onClick={close} disabled={busy} className="btn-ghost px-4 py-2">Close</button>
              <button type="button" onClick={download} disabled={busy || !selected.size} className="btn-primary px-4 py-2">
                <Download className="h-4 w-4" /> {busy ? "Exporting..." : "Download Excel list"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Every ticked subject already shows Withdrawn in Official Offered Subjects. Fees are settled with the Business Office.
            </p>
            <div aria-live="polite"><ErrorNote message={error} /></div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">No tagged withdrawals yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Tick</span></th>
                      <th scope="col" className="px-3 py-2.5">Student</th>
                      <th scope="col" className="px-3 py-2.5">Subject</th>
                      <th scope="col" className="px-3 py-2.5">Semester / deadline</th>
                      <th scope="col" className="px-3 py-2.5">Fee</th>
                      <th scope="col" className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((item) => (
                      <tr key={item.id} className={selected.has(item.id) ? "bg-emerald-50/40" : ""}>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            aria-label={`Tick ${item.student.name}`}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-ink">{item.student.name}</p>
                          <p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-slate-700">{item.subject?.code || "Subject pending"}</p>
                          <p className="text-xs text-slate-500">{item.subject?.title || ""}</p>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-slate-600">
                          <p className="font-semibold">{item.term_label || "Not recorded"}</p>
                          <p>Deadline: {item.window?.deadline || "Not recorded"}</p>
                        </td>
                        <td className="px-3 py-3 align-top text-xs font-semibold text-emerald-700">
                          {item.window?.fee_percent != null ? `${item.window.fee_percent}% of term (${item.window.fee_tier})` : "Fee not stated"}
                        </td>
                        <td className="px-3 py-3 align-top"><StatusBadge value={item.status_label} dot={false} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalShell>
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
