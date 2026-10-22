import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FilePenLine, FileText, Lock, Scale, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import {
  Button, Card, EmptyState, Field, InlineNotice, Input, Modal, PageHeader, SearchInput, SectionCard, Select, Spinner, StatCard, Textarea,
} from "../components/ui/index.js";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { RuleBadges, formatRuleValue } from "../components/PolicyRules";
import { formatDate } from "../lib/format";
import { PAGE } from "../lib/labels.js";

const FILTERS = [
  { id: "all", label: "All rules" },
  { id: "enforced", label: "Enforced by the system" },
  { id: "documented", label: "Documented only" },
  { id: "review", label: "Needs review" },
  { id: "official", label: "Official (locked)" },
  { id: "adjustable", label: "Pending validation" },
];

const BOOL_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
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

  const editNote = canEdit
    ? "Prototype rules awaiting Graduate School validation can be adjusted; every change is recorded with your reason."
    : "Only Graduate School staff and the administrator can adjust the prototype rules.";

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={Scale}
        title={PAGE.businessRules}
        description={`The rules the workflows follow, each with the handbook or protocol page it comes from. The Graduate School Handbook 2022-2023 is in force; where the system and the handbook disagree, the handbook wins. Rules set by the Handbook or the Research Protocol are locked: they change only when the Graduate School issues a new policy (upload it under Policy Documents). ${editNote}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Scale} label="Rules in the register" value={data?.summary?.total ?? 0} />
        <StatCard icon={ShieldCheck} label="Enforced by the system" value={data?.summary?.enforced ?? 0} />
        <StatCard icon={FileText} label="Documented only" value={data?.summary?.documented_only ?? 0} />
        <StatCard icon={AlertTriangle} label="Need review" value={data?.summary?.needs_review ?? 0} tone="warning" />
      </div>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {notice && (
        <InlineNotice tone="success" icon={CheckCircle2} onDismiss={() => setNotice("")}>
          {notice}
        </InlineNotice>
      )}

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rules">
            {FILTERS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={filter === item.id ? "primary" : "secondary"}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search rules or pages"
            label="Search rules"
            className="lg:w-80"
          />
        </div>
      </Card>

      {loading ? <Spinner label="Loading business rules..." /> : !groups.length ? (
        <Card><EmptyState icon={Scale} title="No rules match" hint="Try another filter or search." /></Card>
      ) : groups.map((group) => (
        <SectionCard key={group.key} title={group.label}>
          <div className="divide-y divide-slate-100">
            {group.rules.map((rule) => <RuleRow key={rule.id} rule={rule} canEdit={canEdit} onEdit={() => setEditing(rule)} />)}
          </div>
        </SectionCard>
      ))}

      {editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function RuleRow({ rule, canEdit, onEdit }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="card-title">{rule.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{rule.description}</p>
          <p className="mt-2 text-xs font-semibold text-brand-800">
            Source: {rule.citation}{rule.source_section ? ` · ${rule.source_section}` : ""}
            {rule.policy_document ? ` · linked to "${rule.policy_document.title}"` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RuleBadges rule={rule} />
            {rule.locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-2xs font-semibold text-white" title={rule.lock_message}>
                <Lock className="h-3 w-3" aria-hidden="true" /> {officialLabel(rule)}
              </span>
            )}
          </div>
          {rule.locked && <p className="meta mt-1.5">{rule.lock_message}</p>}
          {!rule.locked && rule.edit_label && <p className="meta mt-1.5 font-semibold text-slate-600">{rule.edit_label}</p>}
          {!rule.enforced && rule.not_enforced_reason && <p className="meta mt-1.5">Not enforced: {rule.not_enforced_reason}</p>}
          {rule.status === "needs_review" && <p className="mt-1.5 text-xs font-semibold text-amber-800">Check this value against the policy, then confirm or adjust it to clear the flag.</p>}
          <p className="micro mt-1.5">
            {rule.key}{rule.updated_by ? ` · last changed by ${rule.updated_by} on ${formatDate(rule.updated_at)}` : ""}{rule.effective_date ? ` · effective ${formatDate(rule.effective_date)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <span className="rounded-xl bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white">{formatRuleValue(rule)}</span>
          {canEdit && !rule.locked && (
            <Button variant="secondary" size="sm" icon={FilePenLine} onClick={onEdit}>
              {rule.status === "needs_review" ? "Confirm or adjust" : "Adjust value"}
            </Button>
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
        ) : <p className="meta">No changes yet. This is the value from the policy document.</p>}
      </HistoryDisclosure>
    </div>
  );
}

function RuleEditor({ rule, onClose, onSave }) {
  const [value, setValue] = useState(String(rule.value));
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
    <Modal
      title={rule.title}
      subtitle={`Current source: ${rule.citation}. The workflows use the new value as soon as you save.`}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="rule-editor-form" loading={busy} disabled={busy || reason.trim().length < 3}>
            {busy ? "Saving..." : "Save and record the change"}
          </Button>
        </>
      }
    >
      <form id="rule-editor-form" onSubmit={submit} className="space-y-4">
        <Field label={`New value${rule.unit ? ` (${rule.unit})` : ""}`}>
          {rule.value_type === "bool" ? (
            <Select placeholder={null} value={value} onChange={(event) => setValue(event.target.value)} options={BOOL_OPTIONS} />
          ) : rule.value_type === "text" ? (
            <Textarea required value={value} onChange={(event) => setValue(event.target.value)} className="min-h-24 resize-y" maxLength={500} />
          ) : (
            <Input required type="number" min="0" step={rule.value_type === "decimal" ? "0.01" : "1"} value={value} onChange={(event) => setValue(event.target.value)} />
          )}
        </Field>
        <Field label="Reason for the change" required>
          <Textarea
            required
            minLength={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24 resize-y"
            placeholder="Who decided this and which memo, handbook page or meeting it comes from"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Source document">
              <Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} maxLength={220} />
            </Field>
          </div>
          <Field label="Page">
            <Input value={sourcePage} onChange={(event) => setSourcePage(event.target.value)} maxLength={40} placeholder="e.g. 49" />
          </Field>
        </div>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
    </Modal>
  );
}
