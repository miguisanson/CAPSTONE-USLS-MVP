import { BellRing } from "lucide-react";
import { formatDate } from "../../lib/format";
import { LeaveStatusBadge } from "../../components/leaveStatus";
import { plural } from "./leaveHelpers";

/**
 * Leaves that are due to end or have ended (Return Due, or an AWOL proposal).
 * Only a proposal: staff confirm it with a comment, through the same confirm box as
 * every other step.
 */
export default function FollowUpStrip({ cases, onOpen, onRunAction }) {
  const rows = cases.filter((item) => item.status === "Return Due" || item.awol_proposed);
  if (!rows.length) return null;
  return (
    <section aria-label="Needs follow-up" className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">Needs follow-up ({rows.length})</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            The leave ended and no return was filed. This is only a proposal - you confirm it.
          </p>
          <ul className="mt-3 divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white">
            {rows.map((item) => {
              const confirm = (item.actions || []).find((action) => action.action === "confirm_awol");
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {item.student.name}{" "}
                      <span className="text-xs font-normal text-slate-500">{item.student.student_number}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Leave ends {formatDate(item.period?.end_date)}</span>
                      {item.overdue_days > 0 && (
                        <LeaveStatusBadge label={`Overdue ${plural(item.overdue_days, "day")}`} tone="bad" className="!text-[11px]" />
                      )}
                      {item.awol_proposed && (
                        <LeaveStatusBadge label="AWOL proposed" tone="warn" className="!text-[11px]" />
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => onOpen(item)} className="btn-ghost cursor-pointer px-3 py-1.5">
                      View details
                    </button>
                    {confirm && (
                      <button
                        type="button"
                        onClick={() => onRunAction(item, confirm)}
                        className="btn bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
                      >
                        Confirm AWOL
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
