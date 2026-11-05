import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button, DataTable, StatusChip } from "../../components/ui/index.js";
import RegistrarPanel from "../leave/RegistrarPanel";
import { plural } from "../leave/leaveHelpers";

const REPORT_STATUSES = ["Residency", "Residency Completed"];

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
        href={`/api/residency/${item.record_id}/registrar-report`}
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
 * The AWOL & Residency page's Registrar follow-up. Approved AWOL returns use the same Registrar list as Leave of Absence
 * and Readmission (download, mark as sent, mark as acknowledged). Residency semesters have no handoff steps: each has its
 * report to download and send through the official channel.
 */
export default function AwolRegistrar({ ctx }) {
  const residency = useMemo(() => ctx.cases.filter((item) => REPORT_STATUSES.includes(item.status) && item.record_id), [ctx.cases]);
  if (!ctx.isStaff) return null;
  return (
    <div className="space-y-4">
      <RegistrarPanel slug="awol" cases={ctx.cases} onChanged={() => ctx.reload()} focusStudentId={ctx.registrarFocus} />
      {residency.length > 0 && (
        <section aria-labelledby="residency-reports-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 id="residency-reports-heading" className="card-title">Residency reports</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Recorded residency semesters go to the Registrar. Download the report and email it through the official channel.
          </p>
          <p className="meta mt-3">{plural(residency.length, "report")} available.</p>
          <DataTable className="mt-2" caption="Residency reports for the Registrar" columns={COLUMNS} rows={residency} minWidth="sm" pageSize={0} />
        </section>
      )}
    </div>
  );
}
