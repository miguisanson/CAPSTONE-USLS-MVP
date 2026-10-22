import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, KeyRound, Table2, Users } from "lucide-react";
import { Button, InlineNotice, StatCard, StatusChip } from "./ui/index.js";

// Result of a monitoring-sheet import (Student Handoff / course audit update).
// Counts first, then each kind of detail in its own collapsed section, so a large
// import reads as a summary rather than a wall of text. `issues` is the validation
// table supplied by the page (it owns the resolve actions).
export default function HandoffResult({ result, isAudit = false, issues = null }) {
  const unresolved = result.unresolved_count ?? result.conflict_count ?? 0;
  const accounts = (result.accounts || []).filter((account) => account.must_change_password);
  const fromNote = result.standing_from_note || [];
  const needsReview = result.standing_needs_review || [];
  const duplicates = result.duplicates || [];
  const sample = result.sample || [];

  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-2 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0">{result.message}</span>
        </div>
        {(result.program || result.subjects != null) && (
          <StatusChip
            status={`${result.program || "Program"}${result.subjects != null ? ` · ${result.subjects} subjects` : ""}`}
            tone="muted"
            dot={false}
            className="max-w-full truncate"
            title={`${result.program || ""} · ${result.subjects ?? 0} subjects`}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard size="sm" label={isAudit ? "Students updated" : "New students"} value={result.created ?? 0} />
        <StatCard size="sm" label="Already in system" value={result.skipped ?? 0} />
        <StatCard size="sm" label="Year level refreshed" value={result.updated ?? 0} />
        <StatCard size="sm" label="Subject cells changed" value={result.subject_changes ?? 0} />
        <StatCard size="sm" label="Need your decision" value={result.conflict_count ?? 0} icon={AlertTriangle} tone={unresolved > 0 ? "warning" : "neutral"} />
      </div>

      {unresolved > 0 && (
        <InlineNotice tone="warning" icon>
          {unresolved} record{unresolved === 1 ? "" : "s"} differ from what is already stored. Nothing was overwritten; open the validation results below and choose what to keep.
        </InlineNotice>
      )}

      {result.program_id && (
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/monitoring-sheet?program_id=${result.program_id}`} icon={Table2}>Open Monitoring Sheet</Button>
          <Button as={Link} to="/students" variant="secondary" icon={Users}>View Students</Button>
        </div>
      )}

      <div className="space-y-2">
        {accounts.length > 0 && (
          <Section icon={KeyRound} title="New student logins - shown only now" count={accounts.length} tone="amber" defaultOpen>
            <p className="mb-2 text-sm text-amber-900">
              Each student has their own initial password. Copy this list and give each password to its student; it cannot be shown again, and the student must choose a new password at first sign-in.
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
              {result.accounts.map((account) => (
                <li key={account.email} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-white px-3 py-1.5">
                  <span className="min-w-0 truncate font-semibold text-ink" title={`${account.name} · ${account.email}`}>{account.name} · {account.email}</span>
                  <code className="shrink-0 font-mono text-ink">{account.password}</code>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {issues}

        {needsReview.length > 0 && (
          <Section title="NOTE suggests a different standing (nothing changed)" count={needsReview.length} tone="amber">
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm text-amber-900">
              {needsReview.map((item) => (
                <li key={item.student_number} className="rounded-lg bg-white px-3 py-1.5">
                  <span className="font-semibold">{item.name}</span> · {item.student_number}
                  <span className="meta block text-slate-600">Note &quot;{item.note}&quot; suggests {item.suggested_standing}. Use the matching workflow if it is right.</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {fromNote.length > 0 && (
          <Section title="Standing read from the NOTE column" count={fromNote.length}>
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm text-slate-700">
              {fromNote.map((item) => (
                <li key={item.student_number} className="rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="font-semibold text-ink">{item.name}</span> · {item.student_number}
                  <span className="meta block">{item.standing} (note: &quot;{item.note}&quot;)</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {duplicates.length > 0 && (
          <Section title="Already in the system - not imported again" count={duplicates.length}>
            <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {duplicates.map((d) => (
                <li key={`${d.incoming_student_number}-${d.matched_student.id}`} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="truncate font-semibold text-ink" title={d.incoming_name || d.matched_student.name}>{d.incoming_name || d.matched_student.name} · {d.incoming_student_number}</p>
                  <p className="meta truncate" title={`${d.matched_student.name} · ${d.matched_student.student_number}`}>In the system as {d.matched_student.name} · {d.matched_student.student_number}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {sample.length > 0 && (
          <Section title={isAudit ? "Updated students" : "Imported students"} count={sample.length}>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto pr-1">
              {sample.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                    <p className="meta truncate">{s.student_number} · {s.program_code} · {s.stage} · {s.completed}/{s.total_subjects} subjects</p>
                  </div>
                  <Button as={Link} to={`/students/${s.id}`} variant="secondary" size="sm" className="shrink-0">
                    Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

// A collapsed detail block: title and count always visible, the list only when opened.
export function Section({ title, count, icon: Icon, tone = "slate", defaultOpen = false, children }) {
  const frame = tone === "amber" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white";
  return (
    <details className={`group rounded-xl border ${frame}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
          <span className="min-w-0 truncate" title={title}>{title}</span>
          {count != null && <StatusChip status={String(count)} tone="muted" size="sm" dot={false} className="shrink-0" />}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">{children}</div>
    </details>
  );
}
