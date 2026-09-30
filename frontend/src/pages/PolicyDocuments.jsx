import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Database,
  Eye,
  FilePenLine,
  FileText,
  FlaskConical,
  History,
  LibraryBig,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, Spinner } from "../components/ui";
import { useConfirm } from "../components/confirm";
import { formatDate, formatDateTime } from "../lib/format";

const ACCEPT = "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx";
const STATUS_LABELS = { active: "Active", draft: "Draft", archived: "Archived" };
const STATUS_CLASSES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
};
const TEST_QUESTIONS = [
  "What is the maximum residence period for a master's program?",
  "When may a student withdraw a subject?",
  "Who nominates the panel for a title defense?",
];

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file) {
  return Boolean(file) && /\.(pdf|docx)$/i.test(file.name);
}

function StatusPill({ status }) {
  const key = STATUS_CLASSES[status] ? status : "active";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CLASSES[key]}`}>
      {STATUS_LABELS[key]}
    </span>
  );
}

export default function PolicyDocuments() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.policyDocuments(), []);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editor, setEditor] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [notice, setNotice] = useState({ tone: "ok", text: "" });
  const [working, setWorking] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(() => new Set());

  useEffect(() => {
    function closeMenu(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      setOpenMenu(null);
    }
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  const categories = data?.categories || ["Handbook", "Research Protocol", "Operations Manual", "Memo", "Form", "Other"];
  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.items || []).filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (!term) return true;
      return [item.title, item.description, item.original_name, item.uploaded_by, item.category].some((value) =>
        String(value || "").toLowerCase().includes(term)
      );
    });
  }, [data, query, categoryFilter, statusFilter]);

  function say(text, tone = "ok") {
    setNotice({ text, tone });
  }

  async function saveEditor(payload) {
    setWorking(true); say("");
    try {
      const { id, file, ...fields } = payload;
      const result = id
        ? await api.updatePolicyDocument(id, fields)
        : await api.createPolicyDocument({ file, ...fields });
      say(result.message);
      setEditor(null);
      await refetch();
    } catch (err) {
      // Keep the dialog open so the person can fix the file or the fields.
      return err.message || "The document could not be saved.";
    } finally { setWorking(false); }
    return "";
  }

  async function replaceFile({ file, note }) {
    setWorking(true); say("");
    try {
      const result = await api.replacePolicyDocument(replaceTarget.id, file, { note });
      say(result.message);
      setReplaceTarget(null);
      await refetch();
    } catch (err) {
      return err.message || "The file could not be replaced.";
    } finally { setWorking(false); }
    return "";
  }

  async function remove(item) {
    const ok = await confirm({
      title: "Remove this policy document?",
      message: `${item.title}\n\nThe document and all ${item.versions?.length || 1} stored version(s) will be deleted and the Policy Assistant will stop using them. To keep the record without searching it, set the status to Archived instead. This cannot be undone.`,
      confirmLabel: "Remove document",
      tone: "danger",
    });
    if (!ok) return;
    setWorking(true); say("");
    try {
      const result = await api.deletePolicyDocument(item.id);
      say(result.message);
      await refetch();
    } catch (err) { say(err.message, "error"); } finally { setWorking(false); }
  }

  function toggleHistory(id) {
    setHistoryOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const summary = data?.summary || {};

  return <div className="space-y-5 animate-fade-up">
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><LibraryBig className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-2xl font-semibold">Policy document library</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/85">Manage the approved PDF and Word documents the Policy Assistant searches. Every answer names the document and page or section it came from. Drafts are searched but flagged as pending validation.</p>
            </div>
          </div>
          <button type="button" onClick={() => setEditor({})} className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-sm transition-colors hover:bg-brand-50"><Plus className="h-4 w-4" /> Add document</button>
        </div>
      </div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
        <Summary icon={Database} label="All sources" value={summary.total || 0} />
        <Summary icon={Upload} label="Staff uploads" value={summary.managed || 0} />
        <Summary icon={FilePenLine} label="Drafts pending validation" value={summary.draft || 0} />
        <Summary icon={BookOpenCheck} label="Ready for assistant" value={summary.ready || 0} />
      </div>
    </Card>

    <ErrorNote message={error} />
    {notice.text && <div role="status" className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-brand-200 bg-brand-50 text-brand-800"}`}><span>{notice.text}</span><button type="button" onClick={() => say("")} aria-label="Dismiss message" className="cursor-pointer"><X className="h-4 w-4" /></button></div>}

    <TestQuestion />

    <Card className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="font-display text-lg font-semibold text-ink">Documents</h2><p className="mt-0.5 text-sm text-slate-500">Staff uploads can be edited, replaced, or removed. Built-in sources are view-only.</p></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_10rem_9rem]">
          <label className="relative block"><span className="sr-only">Search documents</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-9" placeholder="Search documents" /></label>
          <label><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field-input cursor-pointer"><option value="">All categories</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="field-input cursor-pointer"><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </div>
    </Card>

    {loading ? <Spinner label="Loading policy documents..." /> : !items.length ? <Card><EmptyState icon={FileText} title="No documents found" hint={query || categoryFilter || statusFilter ? "Try a different search or clear the filters." : "Add the first policy document to begin."} /></Card> : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) =>
      <Card key={`${item.kind}-${item.id}`} className={`p-5 ${item.status === "archived" ? "opacity-75" : ""}`}>
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.file_type === "DOCX" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}><FileText className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="truncate font-semibold text-ink" title={item.title}>{item.title}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{item.original_name}</p></div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusPill status={item.status} />
                {(item.url || item.can_edit || item.can_delete) && <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu((current) => current === `${item.kind}-${item.id}` ? null : `${item.kind}-${item.id}`)}
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
                    aria-label={`Actions for ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === `${item.kind}-${item.id}`}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {openMenu === `${item.kind}-${item.id}` && <div role="menu" className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift">
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpenMenu(null)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> View document</a>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setEditor(item); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><FilePenLine className="h-4 w-4" /> Edit details</button>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setReplaceTarget(item); }} disabled={working} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Replace file</button>}
                    {item.can_delete && <><div className="my-1 border-t border-slate-100" /><button type="button" role="menuitem" onClick={() => { setOpenMenu(null); remove(item); }} disabled={working} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /> Remove</button></>}
                  </div>}
                </div>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-600">{item.category}</span>
              {item.effective_date && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-700">Effective {formatDate(item.effective_date)}</span>}
              {item.version && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-600">Version {item.version}</span>}
              {item.index_status === "Unavailable" && <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-red-700">File unavailable</span>}
            </div>
            {item.status === "draft" && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{data?.draft_warning || "Draft — pending Graduate School validation"}. Assistant answers that use this document say so.{item.validation_note ? ` Note: ${item.validation_note}` : ""}</span></p>}
            {item.status === "archived" && <p className="mt-3 text-xs font-semibold text-slate-500">Archived: kept for the record, not searched by the assistant.</p>}
            <p className="mt-3 min-h-10 text-sm leading-relaxed text-slate-600">{item.description || "No description added."}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{item.file_type || "Document"}</span><span>{formatBytes(item.file_size)}</span>{item.page_count > 0 && <span>{item.page_count} page{item.page_count === 1 ? "" : "s"}</span>}{item.chunk_count != null && <span>{item.chunk_count} searchable section{item.chunk_count === 1 ? "" : "s"}</span>}</div>
            <p className="mt-2 text-xs text-slate-500">{item.uploaded_by} · {item.updated_at ? formatDateTime(item.updated_at) : "Bundled source"}</p>
            {item.versions?.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => toggleHistory(item.id)} aria-expanded={historyOpen.has(item.id)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800"><History className="h-4 w-4" /> Version history ({item.versions.length})</button>
              {historyOpen.has(item.id) && <ol className="mt-2 space-y-2">{item.versions.map((version) =>
                <li key={version.version} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">Version {version.version}{version.is_current && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">Current, searched</span>}</p>
                    <p className="truncate text-slate-500">{version.original_name} · {formatBytes(version.file_size)}</p>
                    <p className="text-slate-500">{version.uploaded_by} · {formatDateTime(version.created_at)}</p>
                    {version.note && <p className="mt-0.5 text-slate-700">“{version.note}”</p>}
                  </div>
                  {version.file_exists ? <a href={version.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"><Eye className="h-3.5 w-3.5" /> View</a> : <span className="shrink-0 text-slate-400">File missing</span>}
                </li>
              )}</ol>}
            </div>}
          </div>
        </div>
      </Card>
    )}</div>}

    {editor && <DocumentEditor initial={editor} categories={categories} maxMb={data?.max_upload_mb || 20} busy={working} onClose={() => !working && setEditor(null)} onSave={saveEditor} />}
    {replaceTarget && <ReplaceDialog item={replaceTarget} maxMb={data?.max_upload_mb || 20} busy={working} onClose={() => !working && setReplaceTarget(null)} onSave={replaceFile} />}
  </div>;
}

function Summary({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 bg-white px-6 py-4"><Icon className="h-5 w-5 text-brand-600" /><div><p className="text-xl font-bold text-ink">{value}</p><p className="text-xs font-semibold text-slate-500">{label}</p></div></div>;
}

// "Test a question": shows the passages the assistant would retrieve, so staff
// can prove that an upload is actually in use (also the live demo for the panel).
function TestQuestion() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run(text) {
    const asked = (text ?? question).trim();
    if (!asked || busy) return;
    setQuestion(asked); setBusy(true); setError("");
    try { setResult(await api.testPolicyQuestion(asked)); }
    catch (err) { setResult(null); setError(err.message || "The test could not run."); }
    finally { setBusy(false); }
  }

  return <Card className="p-5">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><FlaskConical className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold text-ink">Test a question</h2>
        <p className="mt-0.5 text-sm text-slate-500">Type a question to see which passages the Policy Assistant would use, and from which document. Use it after an upload to confirm the new policy is found.</p>
        <form onSubmit={(event) => { event.preventDefault(); run(); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="block flex-1"><span className="sr-only">Question to test</span><input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} className="field-input" placeholder="e.g. How many library tablets may a student borrow?" /></label>
          <button type="submit" disabled={busy || !question.trim()} className="btn-primary cursor-pointer">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Search className="h-4 w-4" />}{busy ? "Searching..." : "Find passages"}</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">{TEST_QUESTIONS.map((sample) => <button key={sample} type="button" onClick={() => run(sample)} disabled={busy} className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50">{sample}</button>)}</div>
        <div className="mt-3"><ErrorNote message={error} /></div>
        {result && <div className="mt-4 space-y-3" aria-live="polite">
          {result.message && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{result.message}</p>}
          {!result.items.length && !result.message && <EmptyState icon={Search} title="No passage matches this question" hint="The assistant would fall back to its short built-in guidance. If you expected your upload to answer it, check that the wording of the question and of the document share key terms." />}
          {result.items.length > 0 && <>
            <p className="text-xs font-semibold text-slate-500">{result.items.length} passage{result.items.length === 1 ? "" : "s"} found by {result.mode === "vector" ? "meaning (AI search)" : "keyword search"} among {result.passages_indexed} indexed sections.</p>
            {result.answer_preview && <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" /> Answer preview (extracted from the passages, no AI)</p><p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{result.answer_preview}</p></div>}
            <ol className="space-y-2">{result.items.map((hit) => <li key={`${hit.rank}-${hit.source}`} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">{hit.rank}. {hit.title}</p><span className="flex items-center gap-2"><StatusPill status={hit.status} /><span className="text-xs text-slate-500">{hit.source.replace(`${hit.title}, `, "")}</span></span></div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{hit.excerpt}</p>
              {hit.warning && <p className="mt-1.5 text-xs font-semibold text-amber-800">{hit.warning}</p>}
            </li>)}</ol>
          </>}
        </div>}
      </div>
    </div>
  </Card>;
}

function DropZone({ file, onFile, error, hint }) {
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  function take(picked) {
    if (!picked) return;
    onFile(picked);
  }
  return <div>
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); take(event.dataTransfer.files?.[0]); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-brand-500 bg-brand-50" : file ? "border-brand-300 bg-brand-50/50" : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40"}`}
    >
      <UploadCloud className={`h-7 w-7 ${file ? "text-brand-600" : "text-slate-400"}`} />
      {file ? <p className="text-sm font-semibold text-ink">{file.name} <span className="font-normal text-slate-500">· {formatBytes(file.size)}</span></p> : <p className="text-sm font-semibold text-slate-700">Drag a PDF or Word file here, or click to choose</p>}
      <p className="text-xs text-slate-500">{hint}</p>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => { take(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}

function Modal({ titleId, title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-lift">
      <div className="flex items-start justify-between gap-3"><div><h2 id={titleId} className="font-display text-xl font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
      {children}
    </div>
  </div>;
}

function DocumentEditor({ initial, categories, maxMb, busy, onClose, onSave }) {
  const isEdit = Boolean(initial.id);
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [category, setCategory] = useState(initial.category || "Other");
  const [effectiveDate, setEffectiveDate] = useState(initial.effective_date || "");
  const [status, setStatus] = useState(initial.status || "active");
  const [validationNote, setValidationNote] = useState(initial.validation_note || "");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [formError, setFormError] = useState("");

  function pick(picked) {
    if (!isAcceptedFile(picked)) { setFile(null); setFileError("Only PDF and DOCX files can be uploaded."); return; }
    if (picked.size > maxMb * 1024 * 1024) { setFile(null); setFileError(`That file is larger than ${maxMb} MB.`); return; }
    setFileError(""); setFile(picked);
    if (!title) setTitle(picked.name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " "));
  }

  async function submit(event) {
    event.preventDefault();
    if (!isEdit && !file) { setFileError("Choose the PDF or DOCX file to upload."); return; }
    setFormError("");
    const payload = { id: initial.id, title: title.trim(), description: description.trim(), category, effective_date: effectiveDate, status, validation_note: validationNote.trim() };
    if (!isEdit) { payload.file = file; payload.note = note.trim(); }
    const message = await onSave(payload);
    if (message) setFormError(message);
  }

  return <Modal titleId="policy-document-editor-title" title={isEdit ? "Edit document details" : "Add policy document"} subtitle={isEdit ? "Update how this source appears in the library. Use Replace file to upload a new version." : `PDF or DOCX, up to ${maxMb} MB. Scanned PDFs are read with OCR when it is installed.`} onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit} className="mt-5 space-y-4">
      {!isEdit && <DropZone file={file} onFile={pick} error={fileError} hint={`PDF or DOCX, up to ${maxMb} MB`} />}
      <label className="block"><span className="field-label">Document title</span><input required maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} className="field-input" placeholder="e.g. Graduate Student Handbook 2026" /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block"><span className="field-label">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="field-input cursor-pointer">{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="block"><span className="field-label">Effective date</span><input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="field-input" /></label>
        <label className="block"><span className="field-label">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="field-input cursor-pointer"><option value="active">Active</option><option value="draft">Draft (pending validation)</option><option value="archived">Archived (not searched)</option></select></label>
      </div>
      {status === "draft" && <label className="block"><span className="field-label">Validation note <span className="font-normal text-slate-400">(optional)</span></span><input maxLength={2000} value={validationNote} onChange={(event) => setValidationNote(event.target.value)} className="field-input" placeholder="Who still has to validate this, and by when?" /></label>}
      <label className="block"><span className="field-label">Description <span className="font-normal text-slate-400">(optional)</span></span><textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="field-input min-h-20 resize-y" placeholder="What policies or procedures does this document cover?" /></label>
      {!isEdit && <label className="block"><span className="field-label">Version note <span className="font-normal text-slate-400">(optional)</span></span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="field-input" placeholder="e.g. First upload of the 2026 memo" /></label>}
      {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{formError}</p>}
      {busy && !isEdit && <p className="text-sm font-semibold text-slate-500" role="status">Reading the file and building the search index. A scanned PDF can take a minute...</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button><button type="submit" disabled={busy || !title.trim() || (!isEdit && !file)} className="btn-primary">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Upload className="h-4 w-4" />}{busy ? "Saving..." : isEdit ? "Save changes" : "Upload and index"}</button></div>
    </form>
  </Modal>;
}

function ReplaceDialog({ item, maxMb, busy, onClose, onSave }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");

  function pick(picked) {
    if (!isAcceptedFile(picked)) { setFile(null); setFileError("Only PDF and DOCX files can be uploaded."); return; }
    if (picked.size > maxMb * 1024 * 1024) { setFile(null); setFileError(`That file is larger than ${maxMb} MB.`); return; }
    setFileError(""); setFile(picked);
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) { setFileError("Choose the replacement file."); return; }
    setFormError("");
    const message = await onSave({ file, note: note.trim() });
    if (message) setFormError(message);
  }

  return <Modal titleId="policy-document-replace-title" title="Replace file" subtitle={`${item.title} is now version ${item.version}. The new file becomes version ${(item.version || 1) + 1}; the current one stays in the version history and is no longer searched.`} onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <DropZone file={file} onFile={pick} error={fileError} hint={`PDF or DOCX, up to ${maxMb} MB`} />
      <label className="block"><span className="field-label">What changed? <span className="font-normal text-slate-400">(optional)</span></span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="field-input" placeholder="e.g. Corrected the borrowing limit" /></label>
      {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{formError}</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button><button type="submit" disabled={busy || !file} className="btn-primary">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <RefreshCw className="h-4 w-4" />}{busy ? "Replacing..." : "Replace and re-index"}</button></div>
    </form>
  </Modal>;
}
