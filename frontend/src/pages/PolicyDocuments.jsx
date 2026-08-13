import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  Database,
  Eye,
  FilePenLine,
  FileText,
  LibraryBig,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "../components/ui";
import { useConfirm } from "../components/confirm";

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "Bundled source";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PolicyDocuments() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.policyDocuments(), []);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const replaceInput = useRef(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

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

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data?.items || [];
    return (data?.items || []).filter((item) =>
      [item.title, item.description, item.original_name, item.uploaded_by].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [data, query]);

  async function saveEditor(payload) {
    setWorking(true); setNotice("");
    try {
      const result = payload.id
        ? await api.updatePolicyDocument(payload.id, payload)
        : await api.createPolicyDocument(payload);
      setNotice(result.message);
      setEditor(null);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setWorking(false); }
  }

  async function replaceFile(file) {
    if (!file || !replaceTarget) return;
    setWorking(true); setNotice("");
    try {
      const result = await api.replacePolicyDocument(replaceTarget.id, file);
      setNotice(result.message);
      await refetch();
    } catch (err) { setNotice(err.message); } finally {
      setWorking(false); setReplaceTarget(null);
      if (replaceInput.current) replaceInput.current.value = "";
    }
  }

  async function remove(item) {
    const ok = await confirm({
      title: "Remove this policy document?",
      message: `${item.title}\n\nThis document will stop being used by the Policy Assistant. This cannot be undone.`,
      confirmLabel: "Remove document",
      tone: "danger",
    });
    if (!ok) return;
    setWorking(true); setNotice("");
    try {
      const result = await api.deletePolicyDocument(item.id);
      setNotice(result.message);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setWorking(false); }
  }

  return <div className="space-y-5 animate-fade-up">
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><LibraryBig className="h-6 w-6" /></span>
            <div><h1 className="font-display text-2xl font-semibold">Policy document library</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/80">Manage the approved PDF and Word documents the Policy Assistant searches when answering handbook and procedure questions.</p></div>
          </div>
          <button type="button" onClick={() => setEditor({})} className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-sm hover:bg-brand-50"><Plus className="h-4 w-4" /> Add document</button>
        </div>
      </div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
        <Summary icon={Database} label="All sources" value={data?.summary?.total || 0} />
        <Summary icon={Upload} label="Staff uploads" value={data?.summary?.managed || 0} />
        <Summary icon={BookOpenCheck} label="Ready for assistant" value={data?.summary?.ready || 0} />
      </div>
    </Card>

    <ErrorNote message={error} />
    {notice && <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}

    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-lg font-semibold text-ink">Current documents</h2><p className="mt-0.5 text-sm text-slate-500">Staff uploads can be edited, replaced, or removed. Bundled sources remain view-only.</p></div>
        <label className="relative block sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-9" placeholder="Search documents" /></label>
      </div>
    </Card>

    {loading ? <Spinner label="Loading policy documents..." /> : !items.length ? <Card><EmptyState icon={FileText} title="No documents found" hint={query ? "Try a different search." : "Add the first policy document to begin."} /></Card> : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) =>
      <Card key={`${item.kind}-${item.id}`} className="p-5">
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.file_type === "DOCX" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}><FileText className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="truncate font-semibold text-ink">{item.title}</h3><p className="mt-0.5 truncate text-xs text-slate-400">{item.original_name}</p></div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge value={item.status} />
                {(item.url || item.can_edit || item.can_delete) && <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu((current) => current === item.id ? null : item.id)}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink"
                    aria-label={`Actions for ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === item.id}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {openMenu === item.id && <div role="menu" className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift">
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpenMenu(null)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> View document</a>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setEditor(item); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><FilePenLine className="h-4 w-4" /> Edit details</button>}
                    {item.can_edit && <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); setReplaceTarget(item); replaceInput.current?.click(); }} disabled={working} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Replace file</button>}
                    {item.can_delete && <><div className="my-1 border-t border-slate-100" /><button type="button" role="menuitem" onClick={() => { setOpenMenu(null); remove(item); }} disabled={working} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /> Remove</button></>}
                  </div>}
                </div>}
              </div>
            </div>
            <p className="mt-3 min-h-10 text-sm leading-relaxed text-slate-600">{item.description || "No description added."}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{item.file_type || "Document"}</span><span>{formatBytes(item.file_size)}</span>{item.page_count > 0 && <span>{item.page_count} page{item.page_count === 1 ? "" : "s"}</span>}{item.chunk_count != null && <span>{item.chunk_count} searchable section{item.chunk_count === 1 ? "" : "s"}</span>}</div>
            <p className="mt-2 text-xs text-slate-400">{item.uploaded_by} · {formatDate(item.updated_at)}</p>
          </div>
        </div>
      </Card>
    )}</div>}
    <input ref={replaceInput} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx" className="hidden" onChange={(event) => replaceFile(event.target.files?.[0])} />
    {editor && <DocumentEditor initial={editor} maxMb={data?.max_upload_mb || 20} busy={working} onClose={() => !working && setEditor(null)} onSave={saveEditor} />}
  </div>;
}

function Summary({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 bg-white px-6 py-4"><Icon className="h-5 w-5 text-brand-600" /><div><p className="text-xl font-bold text-ink">{value}</p><p className="text-xs font-semibold text-slate-500">{label}</p></div></div>;
}

function DocumentEditor({ initial, maxMb, busy, onClose, onSave }) {
  const isEdit = Boolean(initial.id);
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [file, setFile] = useState(null);
  function submit(event) {
    event.preventDefault();
    if (!isEdit && !file) return;
    onSave({ id: initial.id, title: title.trim(), description: description.trim(), file });
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="policy-document-editor-title">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lift">
      <div className="flex items-start justify-between gap-3"><div><h2 id="policy-document-editor-title" className="font-display text-xl font-semibold text-ink">{isEdit ? "Edit document details" : "Add policy document"}</h2><p className="mt-1 text-sm text-slate-500">{isEdit ? "Update how this source appears in the library." : `PDF or DOCX, up to ${maxMb} MB. The file must contain readable text.`}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 space-y-4">
        {!isEdit && <label><span className="field-label">PDF or DOCX file</span><input required type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx" onChange={(event) => { const picked = event.target.files?.[0] || null; setFile(picked); if (picked && !title) setTitle(picked.name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " ")); }} className="field-input cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-700" /></label>}
        <label><span className="field-label">Document title</span><input required maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} className="field-input" placeholder="e.g. Graduate Student Handbook 2026" /></label>
        <label><span className="field-label">Description <span className="font-normal text-slate-400">(optional)</span></span><textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="field-input min-h-28 resize-y" placeholder="What policies or procedures does this document cover?" /></label>
      </div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={busy} className="btn-ghost cursor-pointer">Cancel</button><button type="submit" disabled={busy || !title.trim() || (!isEdit && !file)} className="btn-primary cursor-pointer">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Upload className="h-4 w-4" />}{busy ? "Saving..." : isEdit ? "Save changes" : "Upload and index"}</button></div>
    </form>
  </div>;
}
