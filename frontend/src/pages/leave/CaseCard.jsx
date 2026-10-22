import { Eye } from "lucide-react";
import { Button, DataTable, StatusChip } from "../../components/ui/index.js";
import { leaveCaseStatusBadge } from "../../components/leaveStatus";
import { caseFlags, cardLines, whenDates } from "./leaveHelpers";

export function FlagList({ item, role }) {
  const flags = caseFlags(item, role);
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Things to know about this request">
      {flags.map((flag) => (
        <li key={flag.key}>
          <StatusChip label={flag.text} tone={flag.tone} size="sm" dot={false} />
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
          <p className="meta truncate">
            {item.student.student_number} · {item.student.program_code}
          </p>
        </div>
        {item.kind === "LOA_EXTENSION" && <StatusChip label="Extension" tone="muted" size="sm" dot={false} />}
      </div>

      {cardLines(item).map((line, index) => (
        <p key={index} className={index === 0 ? "mt-2.5 text-xs font-medium text-slate-700" : "meta mt-0.5"}>{line}</p>
      ))}

      <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">{ownerText(item)}</p>

      <div className="mt-2">
        <FlagList item={item} role={role} />
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={Eye}
        onClick={() => onOpen(item)}
        className="mt-3 w-full"
        aria-label={`View details for ${item.student.name}`}
      >
        View details
      </Button>
    </article>
  );
}

// The same requests as a table (for people who prefer a list).
export function CaseTable({ items, role, selectableIds, selectedIds, onToggle, onToggleAll, onOpen }) {
  const selectable = items.filter((item) => selectableIds.has(item.id));
  const allSelected = selectable.length > 0 && selectable.every((item) => selectedIds.has(item.id));
  const columns = [
    {
      key: "select",
      width: "2.5rem",
      header:
        selectable.length > 0 ? (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onToggleAll(selectable, !allSelected)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            aria-label="Select every request that can be moved as a group"
          />
        ) : (
          <span className="sr-only">Select</span>
        ),
      cell: (item) =>
        selectableIds.has(item.id) ? (
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => onToggle(item)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            aria-label={`Select ${item.student.name} for a batch step`}
          />
        ) : null,
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
    { key: "kind", header: "Type", cell: (item) => item.kind_label },
    {
      key: "about",
      header: "What it is about",
      cell: (item) => (
        <>
          {cardLines(item).map((line, index) => (
            <p key={index} className={index === 0 ? "" : "meta"}>{line}</p>
          ))}
          {whenDates(item) && <p className="meta">{whenDates(item)}</p>}
        </>
      ),
    },
    { key: "status", header: "Status", cell: (item) => leaveCaseStatusBadge(item) },
    { key: "owner", header: "Next", cell: (item) => item.owner || "-" },
    { key: "notes", header: "Notes", cell: (item) => <FlagList item={item} role={role} /> },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      cell: (item) => (
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpen(item)} aria-label={`View details for ${item.student.name}`}>
          View
        </Button>
      ),
    },
  ];
  return <DataTable caption="Requests" columns={columns} rows={items} minWidth="md" pageSize={0} />;
}
