import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FilePenLine, FileText, Lock, Scale, Search, ShieldCheck, X } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, Spinner } from "../components/ui";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { RuleBadges, formatRuleValue } from "../components/PolicyRules";
import { formatDate } from "../lib/format";

const FILTERS = [
  { id: "all", label: "All rules" },
  { id: "enforced", label: "Enforced by the system" },
  { id: "documented", label: "Documented only" },
  { id: "review", label: "Needs review" },
  { id: "official", label: "Official (locked)" },
  { id: "adjustable", label: "Pending validation" },
];

// "Official — Handbook p. 49" / "Official — Research Protocol": the lock badge text.
function officialLabel(rule) {
  const title = String(rule.source_title || "");
  const page = String(rule.source_page || "").trim();
  if (title.includes("Handbook")) {
    const pages = /[-,]/.test(page) ? "pp." : "p.";
    return page ? `Official — Handbook ${pages} ${page}` : "Official — Handbook";
  }
  if (title.includes("Protocol")) return "Official — Research Protocol";
  return "Official";
}

// The register the workflows read from: every rule, its value, and the policy
// document page it comes from. Read-only except for Graduate School staff/admin.
export default function BusinessRules() {
  const { data, loading, error, refetch } = useApi(() => api.businessRules(), []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const canEdit = Boolean(data?.can_edit);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (rule) => {
      if (filter === "enforced" && !rule.enforced) return false;
      if (filter === "documented" && rule.enforced) return false;
      if (filter === "review" && rule.status !== "needs_review") return false;
      if (filter === "official" && !rule.locked) return false;
      if (filter === "adjustable" && rule.locked) return false;
      if (!term) return true;
      return [rule.title, rule.description, rule.key, rule.source_title, rule.source_section, rule.citation]
        .some((value) => String(value || "").toLowerCase().includes(term));
    };
    return (data?.processes || [])
      .map((process) => ({ ...process, rules: (data?.items || []).filter((rule) => rule.process === process.key && matches(rule)) }))
      .filter((group) => group.rules.length);
  }, [data, query, filter]);

  async function save(payload) {
    const result = await api.updateBusinessRule(editing.id, payload);
    setNotice(result.message);
    setEditing(null);
    await refetch();
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-6 text-white sm:p-8">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Scale className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h1 className="font-display text-2xl font-semibold">Business rules</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/85">
                The rules the workflows follow, each with the handbook or protocol page it comes from. The Graduate School Handbook 2022-2023 is in force; where the system and the handbook disagree, the handbook wins. Rules set by the Handbook or the Research Protocol are locked: they change only when the Graduate School issues a new policy (upload it under Policy Documents). {canEdit ? "Prototype rules awaiting Graduate School validation can be adjusted; every change is recorded with your reason." : "Only Graduate School staff and the administrator can adjust the prototype rules."}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
          <Summary icon={Scale} label="Rules in the register" value={data?.summary?.total ?? 0} />
          <Summary icon={ShieldCheck} label="Enforced by the system" value={data?.summary?.enforced ?? 0} />
          <Summary icon={FileText} label="Documented only" value={data?.summary?.documented_only ?? 0} />
          <Summary icon={AlertTriangle} label="Need review" value={data?.summary?.needs_review ?? 0} tone="amber" />
        </div>
      </Card>

      <ErrorNote message={error} />
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
          <span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rules">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${filter === item.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative block lg:w-80">
            <span className="sr-only">Search rules</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-9" placeholder="Search rules or pages" />
          </label>
        </div>
      </Card>

      {loading ? <Spinner label="Loading business rules..." /> : !groups.length ? (
        <Card><EmptyState icon={Scale} title="No rules match" hint="Try another filter or search." /></Card>
      ) : groups.map((group) => (
        <Card key={group.key} className="p-5">
          <h2 className="font-display text-lg font-semibold text-ink">{group.label}</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {group.rules.map((rule) => <RuleRow key={rule.id} rule={rule} canEdit={canEdit} onEdit={() => setEditing(rule)} />)}
          </div>
        </Card>
      ))}

      {editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function Summary({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 bg-white px-6 py-4">
      <Icon className={`h-5 w-5 ${tone === "amber" ? "text-amber-600" : "text-brand-600"}`} aria-hidden="true" />
      <div><p className="text-xl font-bold text-ink">{value}</p><p className="text-xs font-semibold text-slate-500">{label}</p></div>
    </div>
  );
}

function RuleRow({ rule, canEdit, onEdit }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{rule.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{rule.description}</p>
          <p className="mt-2 text-xs font-semibold text-brand-800">
            Source: {rule.citation}{rule.source_section ? ` · ${rule.source_section}` : ""}
            {rule.policy_document ? ` · linked to "${rule.policy_document.title}"` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RuleBadges rule={rule} />
            {rule.locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-white" title={rule.lock_message}>
                <Lock className="h-3 w-3" aria-hidden="true" /> {officialLabel(rule)}
              </span>
            )}
          </div>
          {rule.locked && <p className="mt-1.5 text-xs text-slate-500">{rule.lock_message}</p>}
          {!rule.locked && rule.edit_label && <p className="mt-1.5 text-xs font-semibold text-slate-600">{rule.edit_label}</p>}
          {!rule.enforced && rule.not_enforced_reason && <p className="mt-1.5 text-xs text-slate-500">Not enforced: {rule.not_enforced_reason}</p>}
          {rule.status === "needs_review" && <p className="mt-1.5 text-xs font-semibold text-amber-800">Check this value against the policy, then confirm or adjust it to clear the flag.</p>}
          <p className="mt-1.5 text-[11px] text-slate-400">
            {rule.key}{rule.updated_by ? ` · last changed by ${rule.updated_by} on ${formatDate(rule.updated_at)}` : ""}{rule.effective_date ? ` · effective ${formatDate(rule.effective_date)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <span className="rounded-xl bg-brand-600 px-3.5 py-1.5 text-sm font-bold text-white">{formatRuleValue(rule)}</span>
          {canEdit && !rule.locked && (
            <button type="button" onClick={onEdit} className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
              <FilePenLine className="h-4 w-4" aria-hidden="true" /> {rule.status === "needs_review" ? "Confirm or adjust" : "Adjust value"}
            </button>
          )}
        </div>
      </div>
      <HistoryDisclosure className="mt-3" label="Change history" hideLabel="Hide change history" count={rule.history.length}>
        {rule.history.length ? (
          <ol className="space-y-2">
            {rule.history.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-ink">{item.old_value} → {item.new_value}</span> · {item.changed_by || "Unknown"} · {formatDate(item.changed_at)}
                <span className="block text-slate-500">Reason: {item.reason}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-xs text-slate-500">No changes yet. This is the value from the policy document.</p>}
      </HistoryDisclosure>
    </div>
  );
}

function RuleEditor({ rule, onClose, onSave }) {
  const [value, setValue] = useState(rule.value_type === "bool" ? String(rule.value) : String(rule.value));
  const [reason, setReason] = useState("");
  const [sourceTitle, setSourceTitle] = useState(rule.source_title || "");
  const [sourcePage, setSourcePage] = useState(rule.source_page || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { value: rule.value_type === "bool" ? value === "true" : value, reason: reason.trim() };
      if (sourceTitle.trim() !== (rule.source_title || "")) payload.source_title = sourceTitle.trim();
      if (sourcePage.trim() !== (rule.source_page || "")) payload.source_page = sourcePage.trim();
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rule-editor-title">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="rule-editor-title" className="font-display text-xl font-semibold text-ink">{rule.title}</h2>
            <p className="mt-1 text-sm text-slate-500">Current source: {rule.citation}. The workflows use the new value as soon as you save.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="field-label">New value{rule.unit ? ` (${rule.unit})` : ""}</span>
            {rule.value_type === "bool" ? (
              <select value={value} onChange={(event) => setValue(event.target.value)} className="field-input cursor-pointer">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : rule.value_type === "text" ? (
              <textarea required value={value} onChange={(event) => setValue(event.target.value)} className="field-input min-h-24 resize-y" maxLength={500} />
            ) : (
              <input required type="number" min="0" step={rule.value_type === "decimal" ? "0.01" : "1"} value={value} onChange={(event) => setValue(event.target.value)} className="field-input" />
            )}
          </label>
          <label className="block">
            <span className="field-label">Reason for the change <span className="text-red-500">*</span></span>
            <textarea required minLength={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="field-input min-h-24 resize-y" placeholder="Who decided this and which memo, handbook page or meeting it comes from" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2"><span className="field-label">Source document</span><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} className="field-input" maxLength={220} /></label>
            <label className="block"><span className="field-label">Page</span><input value={sourcePage} onChange={(event) => setSourcePage(event.target.value)} className="field-input" maxLength={40} placeholder="e.g. 49" /></label>
          </div>
          <ErrorNote message={error} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost cursor-pointer">Cancel</button>
          <button type="submit" disabled={busy || reason.trim().length < 3} className="btn-primary cursor-pointer">{busy ? "Saving..." : "Save and record the change"}</button>
        </div>
      </form>
    </div>
  );
}
