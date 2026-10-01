import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { StatusBadge } from "../../components/ui";
import { plural } from "../leave/leaveHelpers";

const REPORT_STATUSES = [
  "Return Approved",
  "Extension Approved - Refresher Required",
  "Re-enrollment Required",
  "Re-enrollment Completed",
  "Residency",
  "Residency Completed",
];

/**
 * The AWOL & Residency page's Registrar follow-up, in the same place and with the same heading
 * as the Registrar list on the Leave and Withdrawal pages: approved returns and residency
 * semesters, each with its report to download and send through the official channel.
 */
export default function AwolRegistrar({ ctx }) {
  const rows = useMemo(() => ctx.cases.filter((item) => REPORT_STATUSES.includes(item.status) && item.record_id), [ctx.cases]);
  if (!ctx.isStaff) return null;
  return (
    <section aria-labelledby="registrar-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="registrar-heading" className="text-base font-semibold text-ink">Registrar list</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Approved returns and residency semesters go to the Registrar. The portal does not send any email: download the report and
            email it through the official channel. Enrollment itself stays a separate Academic Coordinator step.
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing to send to the Registrar yet. Approved returns and recorded residency appear here.</p>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500">{plural(rows.length, "report")} available.</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-3 py-2.5">Student</th>
                      <th scope="col" className="px-3 py-2.5">Type</th>
                      <th scope="col" className="px-3 py-2.5">Status</th>
                      <th scope="col" className="px-3 py-2.5"><span className="sr-only">Report</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-ink">{item.student.name}</p>
                          <p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code}</p>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700">{item.kind_label}</td>
                        <td className="px-3 py-3 align-top"><StatusBadge value={item.status_label} dot={false} /></td>
                        <td className="px-3 py-3 align-top text-right">
                          <a
                            href={`/api/${item.kind === "RESIDENCY" ? "residency" : "awol"}/${item.record_id}/registrar-report`}
                            className="btn-ghost px-3 py-1.5"
                          >
                            <Download className="h-3.5 w-3.5" /> Download report
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
