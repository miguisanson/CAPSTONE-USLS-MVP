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
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import {
  Button,
  Card,
  EmptyState,
  Field,
  InlineNotice,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SectionCard,
  Select,
  Spinner,
  StatCard,
  StatusChip,
  Textarea,
} from "../components/ui/index.js";
import { useConfirm } from "../components/confirm";
import { formatDate, formatDateTime } from "../lib/format";
import { PAGE } from "../lib/labels.js";

const ACCEPT = "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx";
const STATUS_LABELS = { active: "Active", draft: "Draft", archived: "Archived" };
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const TEST_QUESTIONS = [
  "What is the maximum residence period for a master's program?",
  "When may a student withdraw a subject?",
  "Who nominates the panel for a title defense?",
];
const TAG = "rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold tracking-wide text-slate-600";

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file) {
  return Boolean(file) && /\.(pdf|docx)$/i.test(file.name);
}

function StatusPill({ status, size }) {
  const key = STATUS_LABELS[status] ? status : "active";
  return <StatusChip status={STATUS_LABELS[key]} size={size} dot={false} />;
}

export default function PolicyDocuments() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.policyDocuments(), []);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editor, setEditor] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [notice, setNotice] = useState({ tone: "success", text: "" });
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

  function say(text, tone = "success") {
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
    } catch (err) { say(err.message, "danger"); } finally { setWorking(false); }
  }

  function toggleHistory(id) {
    setHistoryOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const summary = data?.summary || {};
  const menuItem = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11";

  return <div className="page-stack animate-fade-up">
    <PageHeader
      icon={LibraryBig}
      title={PAGE.policyDocuments}
      description="Manage the approved PDF and Word documents the Policy Assistant searches. Every answer names the document and page or section it came from. Drafts are searched but flagged as pending validation."
      actions={<Button icon={Plus} onClick={() => setEditor({})}>Add document</Button>}
    />

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={Database} label="All sources" value={summary.total || 0} tone="neutral" />
      <StatCard icon={Upload} label="Staff uploads" value={summary.managed || 0} tone="info" />
      <StatCard icon={FilePenLine} label="Drafts pending validation" value={summary.draft || 0} tone="warning" />
      <StatCard icon={BookOpenCheck} label="Ready for assistant" value={summary.ready || 0} tone="success" />
    </div>

    {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {notice.text && <InlineNotice tone={notice.tone} onDismiss={() => say("")}>{notice.text}</InlineNotice>}

    <TestQuestion />

    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="section-title">Documents</h2><p className="mt-0.5 text-sm text-slate-500">Staff uploads can be edited, replaced, or removed. Built-in sources are view-only.</p></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_10rem_9rem]">
          <SearchInput value={query} onChange={setQuery} placeholder="Search documents" label="Search documents" />
          <Select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} placeholder="All categories" options={categories} />
          <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="All statuses" options={STATUS_OPTIONS} />
        </div>
      </div>
    </Card>

    {loading ? <Spinner label="Loading policy documents..." /> : !items.length ? <Card><EmptyState icon={FileText} title="No documents found" hint={query || categoryFilter || statusFilter ? "Try a different search or clear the filters." : "Add the first policy document to begin."} /></Card> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{items.map((item) =>
      <Card key={`${item.kind}-${item.id}`} className={item.status === "archived" ? "opacity-75" : ""}>
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.file_type === "DOCX" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}><FileText className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="card-title truncate" title={item.title}>{item.title}</h3><p className="meta mt-0.5 truncate">{item.original_name}</p></div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusPill status={item.status} />
                {(item.url || item.can_edit || item.can_delete) && <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="icon"
                    icon={MoreVertical}
                    onClick={() => setOpenMenu((current) => current === `${item.kind}-${item.id}` ? null : `${item.kind}-${item.id}`)}
                    aria-label={`Actions for ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === `${item.kind}-${item.id}`}
                    className="border-transparent text-slate-500"
                  />
                  {openMenu === `${item.kind}-${item.id}` && <div role="menu" className="absolute right-0 top-11 z-10 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift">
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpenMenu(null)} className={`${menuItem} text-slate-700`}><Eye className="h-4 w-4" aria-hidden="true" /> View document</a>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setEditor(item); }} className={`${menuItem} text-slate-700`}><FilePenLine className="h-4 w-4" aria-hidden="true" /> Edit details</button>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setReplaceTarget(item); }} disabled={working} className={`${menuItem} text-slate-700`}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Replace file</button>}
                    {item.can_delete && <><div className="my-1 border-t border-slate-100" /><button type="button" role="menuitem" onClick={() => { setOpenMenu(null); remove(item); }} disabled={working} className={`${menuItem} text-red-600 hover:bg-red-50`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</button></>}
                  </div>}
                </div>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={TAG}>{item.category}</span>
              {item.effective_date && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-2xs font-semibold tracking-wide text-brand-700">Effective {formatDate(item.effective_date)}</span>}
              {item.version && <span className={TAG}>Version {item.version}</span>}
              {item.index_status === "Unavailable" && <span className="rounded-md bg-red-50 px-2 py-0.5 text-2xs font-semibold tracking-wide text-red-700">File unavailable</span>}
            </div>
            {item.status === "draft" && <InlineNotice tone="warning" icon={AlertTriangle} className="mt-3 text-xs">{data?.draft_warning || "Draft — pending Graduate School validation"}. Assistant answers that use this document say so.{item.validation_note ? ` Note: ${item.validation_note}` : ""}</InlineNotice>}
            {item.status === "archived" && <p className="meta mt-3 font-semibold">Archived: kept for the record, not searched by the assistant.</p>}
            <p className="mt-3 min-h-10 text-sm leading-relaxed text-slate-600">{item.description || "No description added."}</p>
            <div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1"><span>{item.file_type || "Document"}</span><span>{formatBytes(item.file_size)}</span>{item.page_count > 0 && <span>{item.page_count} page{item.page_count === 1 ? "" : "s"}</span>}{item.chunk_count != null && <span>{item.chunk_count} searchable section{item.chunk_count === 1 ? "" : "s"}</span>}</div>
            <p className="meta mt-2">{item.uploaded_by} · {item.updated_at ? formatDateTime(item.updated_at) : "Bundled source"}</p>
            {item.versions?.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => toggleHistory(item.id)} aria-expanded={historyOpen.has(item.id)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11"><History className="h-4 w-4" aria-hidden="true" /> Version history ({item.versions.length})</button>
              {historyOpen.has(item.id) && <ol className="mt-2 space-y-2">{item.versions.map((version) =>
                <li key={version.version} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">Version {version.version}{version.is_current && <StatusChip status="Active" label="Current, searched" size="sm" dot={false} />}</p>
                    <p className="truncate text-slate-500">{version.original_name} · {formatBytes(version.file_size)}</p>
                    <p className="text-slate-500">{version.uploaded_by} · {formatDateTime(version.created_at)}</p>
                    {version.note && <p className="mt-0.5 text-slate-700">“{version.note}”</p>}
                  </div>
                  {version.file_exists ? <Button as="a" variant="secondary" size="sm" icon={Eye} href={version.url} target="_blank" rel="noreferrer">View</Button> : <span className="shrink-0 text-slate-500">File missing</span>}
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

  return <SectionCard
    icon={FlaskConical}
    title="Test a question"
    subtitle="Type a question to see which passages the Policy Assistant would use, and from which document. Use it after an upload to confirm the new policy is found."
  >
    <form onSubmit={(event) => { event.preventDefault(); run(); }} className="flex flex-col gap-2 sm:flex-row">
      <Input aria-label="Question to test" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} className="flex-1" placeholder="e.g. How many semesters can I take as leave of absence?" />
      <Button type="submit" icon={Search} loading={busy} disabled={!question.trim()}>{busy ? "Searching..." : "Find passages"}</Button>
    </form>
    <div className="flex flex-wrap gap-2">{TEST_QUESTIONS.map((sample) => <button key={sample} type="button" onClick={() => run(sample)} disabled={busy} className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11">{sample}</button>)}</div>
    {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {result && <div className="space-y-3" aria-live="polite">
      {result.message && <InlineNotice tone="warning">{result.message}</InlineNotice>}
      {!result.items.length && !result.message && <EmptyState icon={Search} title="No passage matches this question" hint="The assistant would fall back to its short built-in guidance. If you expected your upload to answer it, check that the wording of the question and of the document share key terms." />}
      {result.items.length > 0 && <>
        <p className="meta font-semibold">{result.items.length} passage{result.items.length === 1 ? "" : "s"} found by {result.mode === "vector" ? "meaning (AI search)" : "keyword search"} among {result.passages_indexed} indexed sections.</p>
        {result.answer_preview && <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4"><p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Answer preview (extracted from the passages, no AI)</p><p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{result.answer_preview}</p></div>}
        <ol className="space-y-2">{result.items.map((hit) => <li key={`${hit.rank}-${hit.source}`} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">{hit.rank}. {hit.title}</p><span className="flex items-center gap-2"><StatusPill status={hit.status} size="sm" /><span className="meta">{hit.source.replace(`${hit.title}, `, "")}</span></span></div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{hit.excerpt}</p>
          {hit.warning && <p className="mt-1.5 text-xs font-semibold text-amber-800">{hit.warning}</p>}
        </li>)}</ol>
      </>}
    </div>}
  </SectionCard>;
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 ${dragging ? "border-brand-500 bg-brand-50" : file ? "border-brand-300 bg-brand-50/50" : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40"}`}
    >
      <UploadCloud className={`h-6 w-6 ${file ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />
      {file ? <p className="text-sm font-semibold text-ink">{file.name} <span className="font-normal text-slate-500">· {formatBytes(file.size)}</span></p> : <p className="text-sm font-semibold text-slate-700">Drag a PDF or Word file here, or click to choose</p>}
      <p className="meta">{hint}</p>
      <input ref={input} type="file" accept={ACCEPT} aria-label="Choose a PDF or Word file" className="sr-only" tabIndex={-1} onChange={(event) => { take(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
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

  return <Modal
    title={isEdit ? "Edit document details" : "Add policy document"}
    subtitle={isEdit ? "Update how this source appears in the library. Use Replace file to upload a new version." : `PDF or DOCX, up to ${maxMb} MB. Scanned PDFs are read with OCR when it is installed.`}
    icon={FilePenLine}
    size="md"
    onClose={onClose}
    dismissible={!busy}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button type="submit" form="policy-document-form" icon={Upload} loading={busy} disabled={!title.trim() || (!isEdit && !file)}>{busy ? "Saving..." : isEdit ? "Save changes" : "Upload and index"}</Button>
    </>}
  >
    <form id="policy-document-form" onSubmit={submit} className="space-y-4">
      {!isEdit && <DropZone file={file} onFile={pick} error={fileError} hint={`PDF or DOCX, up to ${maxMb} MB`} />}
      <Field label="Document title"><Input required maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Graduate Student Handbook 2026" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category"><Select value={category} onChange={(event) => setCategory(event.target.value)} placeholder={null} options={categories} /></Field>
        <Field label="Effective date"><Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></Field>
        <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value)} placeholder={null} options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft (pending validation)" }, { value: "archived", label: "Archived (not searched)" }]} /></Field>
      </div>
      {status === "draft" && <Field label="Validation note (optional)"><Input maxLength={2000} value={validationNote} onChange={(event) => setValidationNote(event.target.value)} placeholder="Who still has to validate this, and by when?" /></Field>}
      <Field label="Description (optional)"><Textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-20 resize-y" placeholder="What policies or procedures does this document cover?" /></Field>
      {!isEdit && <Field label="Version note (optional)"><Input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. First upload of the 2026 memo" /></Field>}
      {formError && <InlineNotice tone="danger">{formError}</InlineNotice>}
      {busy && !isEdit && <p className="text-sm font-semibold text-slate-500" role="status">Reading the file and building the search index. A scanned PDF can take a minute...</p>}
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

  return <Modal
    title="Replace file"
    subtitle={`${item.title} is now version ${item.version}. The new file becomes version ${(item.version || 1) + 1}; the current one stays in the version history and is no longer searched.`}
    icon={RefreshCw}
    size="md"
    onClose={onClose}
    dismissible={!busy}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button type="submit" form="policy-replace-form" icon={RefreshCw} loading={busy} disabled={!file}>{busy ? "Replacing..." : "Replace and re-index"}</Button>
    </>}
  >
    <form id="policy-replace-form" onSubmit={submit} className="space-y-4">
      <DropZone file={file} onFile={pick} error={fileError} hint={`PDF or DOCX, up to ${maxMb} MB`} />
      <Field label="What changed? (optional)"><Input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Corrected the maximum residence period" /></Field>
      {formError && <InlineNotice tone="danger">{formError}</InlineNotice>}
    </form>
  </Modal>;
}
