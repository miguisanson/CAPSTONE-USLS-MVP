import { Eye, MessageSquare } from "lucide-react";
import { Button, DataTable, StatusChip } from "../../components/ui/index.js";
import { leaveCaseStatusBadge } from "../../components/leaveStatus";
import { CaseCardFacts, CaseCardShell, MessageNote, NextOwner, ReadyMark, RequirementBoxes } from "../../components/process";
import { caseFacts, caseFlags, caseRequirements, cardLines, whenDates } from "./leaveHelpers";

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

// One request on the board, in Khloe's layout (components/process; the same card as Practicum): name and number, a green card with
// "Ready for Dean review" when the Dean has to decide, the five facts, the requirement boxes, the amber message box, "Next:" and
// the buttons View and Message. The board adds dragging and the "Move to..." menu around it.
export default function CaseCard({ item, role, selectable, selected, onToggleSelect, onOpen, onMessage }) {
  const requirements = caseRequirements(item);
  const withDean = item.owner === "Dean";
  const name = item.student.name;
  return (
    <CaseCardShell ready={withDean} selected={selected}>
      <div className="flex items-start gap-2.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            aria-label={`Select ${name} for a batch step`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-ink">{name}</p>
          <p className="meta break-words">
            {item.student.student_number} · {item.student.program_code}
          </p>
        </div>
      </div>
      {(withDean || item.kind === "LOA_EXTENSION" || item.kind === "RESIDENCY") && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ReadyMark ready={withDean} />
          {item.kind === "LOA_EXTENSION" && <StatusChip label="Extension" tone="muted" size="sm" dot={false} />}
          {item.kind === "RESIDENCY" && <StatusChip label="Residency" tone="muted" size="sm" dot={false} />}
        </div>
      )}

      <CaseCardFacts facts={caseFacts(item)} />

      {requirements.length > 0 && <RequirementBoxes items={requirements} ariaLabel="Requirements for this request" className="mt-3 !grid-cols-1" />}

      <div className="mt-2">
        <FlagList item={item} role={role} />
      </div>

      <MessageNote count={item.unresolved_messages || 0} latest={item.latest_message?.comment || ""} />
      <NextOwner owner={item.owner || "No further step"} />

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpen(item)} className="flex-1" aria-label={`View details for ${name}`}>
          View
        </Button>
        <Button variant="secondary" size="sm" icon={MessageSquare} onClick={() => onMessage(item)} className="flex-1" aria-label={`Message ${name}`}>
          Message
        </Button>
      </div>
    </CaseCardShell>
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
