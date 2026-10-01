import { Eye } from "lucide-react";
import { LeaveStatusBadge, leaveCaseStatusBadge } from "../../components/leaveStatus";
import { caseFlags, cardLines, whenDates } from "./leaveHelpers";

export function FlagList({ item, role }) {
  const flags = caseFlags(item, role);
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Things to know about this request">
      {flags.map((flag) => (
        <li key={flag.key}>
          <LeaveStatusBadge label={flag.text} tone={flag.tone} className="!text-[11px]" />
        </li>
      ))}
    </ul>
  );
}

function ownerText(item) {
  return item.owner ? `Next: ${item.owner}` : "No further step";
}

// One request on the board. The board adds dragging and the "Move to..." menu around it.
export default function CaseCard({ item, role, selectable, selected, onToggleSelect, onOpen }) {
  return (
    <article
      className={`rounded-xl border bg-white p-3 shadow-sm transition-colors ${
        selected ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            aria-label={`Select ${item.student.name} for a batch step`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{item.student.name}</p>
          <p className="truncate text-xs text-slate-500">
            {item.student.student_number} · {item.student.program_code}
          </p>
        </div>
        {item.kind === "LOA_EXTENSION" && <LeaveStatusBadge label="Extension" tone="muted" className="!text-[11px]" />}
      </div>

      {cardLines(item).map((line, index) => (
        <p key={index} className={index === 0 ? "mt-2.5 text-xs font-medium text-slate-700" : "mt-0.5 text-xs text-slate-500"}>{line}</p>
      ))}

      <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">{ownerText(item)}</p>

      <div className="mt-2">
        <FlagList item={item} role={role} />
      </div>

      <button
        type="button"
        onClick={() => onOpen(item)}
        className="btn-ghost mt-3 w-full cursor-pointer px-2 py-1.5"
        aria-label={`View details for ${item.student.name}`}
      >
        <Eye className="h-3.5 w-3.5" /> View details
      </button>
    </article>
  );
}

// The same requests as a table (for people who prefer a list).
export function CaseTable({ items, role, selectableIds, selectedIds, onToggle, onToggleAll, onOpen }) {
  const selectable = items.filter((item) => selectableIds.has(item.id));
  const allSelected = selectable.length > 0 && selectable.every((item) => selectedIds.has(item.id));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5">
              {selectable.length > 0 && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(selectable, !allSelected)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  aria-label="Select every request that can be moved as a group"
                />
              )}
            </th>
            <th scope="col" className="px-3 py-2.5">Student</th>
            <th scope="col" className="px-3 py-2.5">Type</th>
            <th scope="col" className="px-3 py-2.5">What it is about</th>
            <th scope="col" className="px-3 py-2.5">Status</th>
            <th scope="col" className="px-3 py-2.5">Next</th>
            <th scope="col" className="px-3 py-2.5">Notes</th>
            <th scope="col" className="px-3 py-2.5"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item.id} className={selectedIds.has(item.id) ? "bg-brand-50/40" : ""}>
              <td className="px-3 py-3 align-top">
                {selectableIds.has(item.id) && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggle(item)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    aria-label={`Select ${item.student.name} for a batch step`}
                  />
                )}
              </td>
              <td className="px-3 py-3 align-top">
                <p className="font-semibold text-ink">{item.student.name}</p>
                <p className="text-xs text-slate-500">
                  {item.student.student_number} · {item.student.program_code}
                </p>
              </td>
              <td className="px-3 py-3 align-top text-slate-700">{item.kind_label}</td>
              <td className="px-3 py-3 align-top text-slate-700">
                {cardLines(item).map((line, index) => (
                  <p key={index} className={index === 0 ? "" : "text-xs text-slate-500"}>{line}</p>
                ))}
                {whenDates(item) && <p className="text-xs text-slate-500">{whenDates(item)}</p>}
              </td>
              <td className="px-3 py-3 align-top">{leaveCaseStatusBadge(item)}</td>
              <td className="px-3 py-3 align-top text-slate-700">{item.owner || "-"}</td>
              <td className="px-3 py-3 align-top">
                <FlagList item={item} role={role} />
              </td>
              <td className="px-3 py-3 align-top">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="btn-ghost cursor-pointer px-3 py-1.5"
                  aria-label={`View details for ${item.student.name}`}
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
