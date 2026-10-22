import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Scale } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { StatusChip } from "./ui/index.js";

// "14 days", "Yes", "1.75 grade" — one place so the page and the workflow
// screens always show a rule value the same way.
export function formatRuleValue(rule) {
  if (rule.value_type === "bool") return rule.value ? "Yes" : "No";
  if (rule.value_type === "text") return String(rule.value);
  return rule.unit ? `${rule.value} ${rule.unit}` : String(rule.value);
}

export function RuleBadges({ rule }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {rule.enforced ? (
        <StatusChip status="Enforced by the system" tone="good" size="sm" dot={false} />
      ) : (
        <StatusChip status="Documented only" tone="muted" size="sm" dot={false} />
      )}
      {rule.status === "needs_review" && <StatusChip status="Needs review" size="sm" dot={false} />}
    </span>
  );
}

// Shows the business rules a workflow screen applies and where each comes from
// (handbook page, protocol section). Pass the process key from the register:
// enrollment, course_adjustment, withdrawal, dropping, loa, readmission,
// awol_residency, research, defense, practicum, graduation, faculty.
export default function PolicyRules({ process, title = "Rules applied on this screen", className = "", defaultOpen = false, onlyEnforced = false }) {
  const { user } = useAuth();
  const { data } = useApi(() => (process ? api.businessRules({ process }) : Promise.resolve({ items: [] })), [process]);
  const [open, setOpen] = useState(defaultOpen);
  const items = (data?.items || []).filter((rule) => !onlyEnforced || rule.enforced);
  if (!items.length) return null;
  const canOpenPage = user && user.role !== "student" && user.role !== "faculty";
  const needsReview = items.filter((rule) => rule.status === "needs_review").length;

  return (
    <section className={`rounded-2xl border border-brand-100 bg-brand-50/40 ${className}`} aria-label={title}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Scale className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{title}</span>
            <span className="meta block truncate">
              {items.length} rule{items.length === 1 ? "" : "s"} from the Graduate School policies{needsReview ? ` · ${needsReview} need${needsReview === 1 ? "s" : ""} review` : ""}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-brand-100 px-4 pb-4 pt-3">
          {items.map((rule) => (
            <div key={rule.key} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{rule.title}</p>
                <span className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">{formatRuleValue(rule)}</span>
              </div>
              <p className="meta mt-1 leading-relaxed text-slate-600">{rule.description}</p>
              <p className="meta mt-1.5 font-semibold text-brand-800">Source: {rule.citation}{rule.source_section ? ` (${rule.source_section})` : ""}</p>
              <div className="mt-1.5"><RuleBadges rule={rule} /></div>
              {!rule.enforced && rule.not_enforced_reason && <p className="micro mt-1">{rule.not_enforced_reason}</p>}
            </div>
          ))}
          {canOpenPage && (
            <p className="meta text-right"><Link to="/business-rules" className="font-semibold text-brand-700 underline-offset-2 hover:underline">See every business rule and its history</Link></p>
          )}
        </div>
      )}
    </section>
  );
}
