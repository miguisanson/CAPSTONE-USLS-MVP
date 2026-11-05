import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Inbox } from "lucide-react";
import { Button, DataTable, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import { deanDateMatches, deanItemDate, graduationBatchLabel, sortDeanItems } from "./deanHelpers";
import { DEAN_PROCESSES } from "./DeanContext";

const EMPTY_FILTERS = { query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" };

export function daysSince(value) {
  const stamp = new Date(value || 0).getTime();
  if (!Number.isFinite(stamp) || stamp <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - stamp) / 86400000));
}

export function ageLabel(value) {
  const days = daysSince(value);
  if (days === null) return "";
  if (days === 0) return "today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function processLabel(type) {
  const key = Object.keys(DEAN_PROCESSES).find((name) => DEAN_PROCESSES[name].types.includes(type));
  return key ? DEAN_PROCESSES[key].label : type;
}

// Search / program / status / date filtering shared by every Dean list page.
export function useDeanFilters(items) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const programs = useMemo(
    () => [...new Set(items.map((item) => item.student?.program_code || item.program_code).filter(Boolean))].sort(),
    [items],
  );
  const statuses = useMemo(
    () => [...new Set(items.flatMap((item) => [item.status, item.workflow_status]).filter(Boolean))].sort(),
    [items],
  );
  function matches(item) {
    const program = item.student?.program_code || item.program_code || "";
    const text = `${item.title || ""} ${item.subtitle || ""} ${item.student?.name || ""} ${item.student?.student_number || ""} ${program} ${graduationBatchLabel(item, "")}`.toLowerCase();
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (!filters.program || program === filters.program)
      && (!filters.status || item.status === filters.status || item.workflow_status === filters.status)
      && deanDateMatches(deanItemDate(item), filters.dateFrom, filters.dateTo);
  }
  function apply(list) {
    return sortDeanItems(list.filter(matches), filters.sort);
  }
  return { filters, setFilters, programs, statuses, matches, apply };
}

// How long a case has waited: grey until a week, amber from 8 days, red from 15 (the status chip's own tones).
export function AgeBadge({ value }) {
  const days = daysSince(value);
  if (days === null) return null;
  return <StatusChip label={ageLabel(value)} tone={days >= 15 ? "bad" : days >= 8 ? "warn" : "muted"} size="sm" dot={false} />;
}

export function casePath(item) {
  return `/dean/case/${item.type}/${item.id}`;
}

// Compact table of workflow cases; the row (and its Review button) opens the case detail page.
export function CaseTable({ items, emptyTitle = "Nothing to review here", emptyHint = "Submitted items for this process will appear here.", showProcess = false }) {
  const columns = [
    {
      key: "student",
      header: "Student",
      sortValue: (item) => item.student?.name || item.title,
      cell: (item) => (
        <>
          <span className="block">{item.student?.name || item.title}</span>
          <span className="meta inline-block font-normal">{item.student?.student_number} · {item.student?.program_code}</span>
        </>
      ),
    },
    {
      key: "request",
      header: "Request",
      sortValue: (item) => item.title,
      cell: (item) => (
        <>
          <p className="font-medium text-slate-700">{item.title}</p>
          <p className="meta">{showProcess ? `${processLabel(item.type)} · ` : ""}{item.subtitle}</p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (item) => item.workflow_status || item.status,
      cell: (item) => <StatusChip status={item.workflow_status || item.status} dot={false} />,
    },
    {
      key: "waiting",
      header: "Waiting",
      sortValue: (item) => item.submitted_at || deanItemDate(item),
      cell: (item) => (
        <div className="space-y-1">
          <p className="meta">{formatDate(item.submitted_at || deanItemDate(item))}</p>
          <AgeBadge value={item.submitted_at || deanItemDate(item)} />
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (item) => (
        <Button as={Link} to={casePath(item)} variant="secondary" size="sm" icon={Eye} aria-label={`Review ${item.title}`}>
          Review
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      caption="Workflow cases waiting for the Dean"
      columns={columns}
      rows={items}
      rowKey={(item) => `${item.type}-${item.id}`}
      rowHref={casePath}
      pageSize={25}
      empty={{ icon: Inbox, title: emptyTitle, hint: emptyHint }}
    />
  );
}
