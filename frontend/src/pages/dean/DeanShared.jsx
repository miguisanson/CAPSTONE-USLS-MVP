import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Inbox } from "lucide-react";
import { Card, EmptyState, StatusBadge } from "../../components/ui";
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

export function AgeBadge({ value }) {
  const days = daysSince(value);
  if (days === null) return null;
  const tone = days >= 15 ? "bg-red-50 text-red-700 ring-red-200" : days >= 8 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>{ageLabel(value)}</span>;
}

export function casePath(item) {
  return `/dean/case/${item.type}/${item.id}`;
}

// Compact table of workflow cases; each row opens the case detail page.
export function CaseTable({ items, emptyTitle = "Nothing to review here", emptyHint = "Submitted items for this process will appear here.", showProcess = false }) {
  if (!items.length) {
    return <EmptyState icon={Inbox} title={emptyTitle} hint={emptyHint} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">Student</th>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Waiting</th>
            <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.type}-${item.id}`} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-3">
                <p className="font-semibold text-ink">{item.student?.name || item.title}</p>
                <p className="text-xs text-slate-400">{item.student?.student_number} · {item.student?.program_code}</p>
              </td>
              <td className="px-3 py-3 text-slate-600">
                <p className="font-medium text-slate-700">{item.title}</p>
                <p className="text-xs text-slate-400">{showProcess ? `${processLabel(item.type)} · ` : ""}{item.subtitle}</p>
              </td>
              <td className="px-3 py-3"><StatusBadge value={item.workflow_status || item.status} dot={false} /></td>
              <td className="px-3 py-3">
                <p className="text-xs text-slate-500">{formatDate(item.submitted_at || deanItemDate(item))}</p>
                <AgeBadge value={item.submitted_at || deanItemDate(item)} />
              </td>
              <td className="px-3 py-3 text-right">
                <Link to={casePath(item)} className="btn-ghost px-3 py-1.5 text-xs" aria-label={`Review ${item.title}`}>
                  <Eye className="h-3.5 w-3.5" /> Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionCard({ children, className = "" }) {
  return <Card className={`p-5 ${className}`}>{children}</Card>;
}
