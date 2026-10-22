import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, DataTable, StatusChip } from "../../components/ui/index.js";
import { plural } from "../leave/leaveHelpers";

const REPORT_STATUSES = [
  "Return Approved",
  "Extension Approved - Refresher Required",
  "Re-enrollment Required",
  "Re-enrollment Completed",
  "Residency",
  "Residency Completed",
];

const COLUMNS = [
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
  { key: "kind", header: "Type", cell: (item) => item.kind_label },
  { key: "status", header: "Status", cell: (item) => <StatusChip status={item.status_label} dot={false} /> },
  {
    key: "report",
    header: <span className="sr-only">Report</span>,
    align: "right",
    cell: (item) => (
      <Button
        as="a"
        href={`/api/${item.kind === "RESIDENCY" ? "residency" : "awol"}/${item.record_id}/registrar-report`}
        variant="secondary"
        size="sm"
        icon={Download}
      >
        Download report
      </Button>
    ),
  },
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
          <h3 id="registrar-heading" className="card-title">Registrar list</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Approved returns and residency semesters go to the Registrar. The portal does not send any email: download the report and
            email it through the official channel. Enrollment itself stays a separate Academic Coordinator step.
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing to send to the Registrar yet. Approved returns and recorded residency appear here.</p>
          ) : (
            <>
              <p className="meta mt-3">{plural(rows.length, "report")} available.</p>
              <DataTable className="mt-2" caption="Reports for the Registrar" columns={COLUMNS} rows={rows} minWidth="sm" pageSize={0} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
