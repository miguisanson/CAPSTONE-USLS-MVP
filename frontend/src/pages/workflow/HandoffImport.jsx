import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  X,
  History,
  Download,
  Pencil,
  Database,
  FileUp,
} from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { SectionTitle, StatusBadge, ErrorNote } from "../../components/ui";
import { Select } from "../../components/forms";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import HandoffResult from "../../components/HandoffResult";
import { formatDate } from "../../lib/format";
import { WorkflowCaseModal } from "./shared";

// ---------------------------------------------------------------------------
// Student Handoff — AIMS export import & reconciliation (no manual student creation).
// Students come from the official AIMS export only (checklist items 2, 5, 66).
// ---------------------------------------------------------------------------
export function HandoffPanel() {
  return (
    <div className="space-y-6">
      <HandoffImport />
    </div>
  );
}

function HandoffImport({ context }) {
  const isAudit = context === "audit";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolvingIssue, setResolvingIssue] = useState(false);
  const [issueError, setIssueError] = useState("");
  const { data: uploadHistory, refetch: refetchUploadHistory } = useApi(() => api.monitoringUploads(), []);

  function pick(f) {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      setError("Please choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.importHandoff(file);
      setResult(res);
      setFile(null);
      refetchUploadHistory();
    } catch (err) {
      setError(err.message || "Could not import the file.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveIssue(action, edited = null) {
    if (!selectedIssue) return;
    setResolvingIssue(true);
    setIssueError("");
    try {
      const response = await api.resolveMonitoringIssue(selectedIssue.id, { action, edited });
      setResult((current) => current ? {
        ...current,
        validation_issues: (current.validation_issues || []).map((item) =>
          item.id === response.issue.id ? response.issue : item
        ),
        unresolved_count: Math.max(0, (current.unresolved_count || 0) - 1),
        conflict_count: Math.max(0, (current.conflict_count || 0) - 1),
      } : current);
      setSelectedIssue(null);
      refetchUploadHistory();
    } catch (err) {
      setIssueError(err.message || "Could not resolve this validation issue.");
    } finally {
      setResolvingIssue(false);
    }
  }

  function applyBulkResolution(response) {
    const updatedById = new Map((response.issues || []).map((item) => [item.id, item]));
    setResult((current) => {
      if (!current) return current;
      const validationIssues = (current.validation_issues || []).map((item) => updatedById.get(item.id) || item);
      const unresolvedCount = validationIssues.filter((item) => item.status === "Unresolved").length;
      return {
        ...current,
        validation_issues: validationIssues,
        unresolved_count: unresolvedCount,
        conflict_count: unresolvedCount,
      };
    });
    if (selectedIssue && updatedById.has(selectedIssue.id)) {
      setSelectedIssue(updatedById.get(selectedIssue.id));
    }
    refetchUploadHistory();
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={isAudit ? "Update audits from monitoring sheet" : "Import from monitoring sheet"}
        subtitle={
          isAudit
            ? "Upload the latest AC Student Monitoring sheet — each student's completed subjects are updated from it"
            : "Upload the AC Student Monitoring Excel file — students, programs, and course audits are created automatically"
        }
        icon={FileSpreadsheet}
        action={
          <Link to="/monitoring-sheet" className="btn-ghost shrink-0">
            <Table2 className="h-4 w-4" /> Full sheet
          </Link>
        }
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <UploadCloud className="h-6 w-6" />
        </span>
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-brand-600" />
            <span className="font-semibold text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600 cursor-pointer"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Drag &amp; drop your .xlsx here</p>
            <p className="text-xs text-slate-500">or</p>
          </>
        )}
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <span className="btn-ghost cursor-pointer">{file ? "Choose a different file" : "Browse files"}</span>
        </label>
        <p className="mt-3 text-xs text-slate-400">
          Expected format: AC Student Monitoring template — program in cell A1, one student per row.
        </p>
      </div>

      <ErrorNote message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={runImport} disabled={!file || busy} className="btn-primary w-full sm:w-auto">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Importing…
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" /> {isAudit ? "Update audits" : "Import students"}
            </>
          )}
        </button>
      </div>

      {result && (
        <HandoffResult
          result={result}
          isAudit={isAudit}
          issues={result.validation_issues?.length > 0 ? (
            <ValidationIssueTable
              issues={result.validation_issues}
              onOpen={setSelectedIssue}
              onBulkResolved={applyBulkResolution}
              title="Validation results"
            />
          ) : null}
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-ink"><History className="h-4 w-4 text-brand-600" /> Upload history</h3>
            <p className="mt-1 text-xs text-slate-500">Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record.</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{uploadHistory?.items?.length || 0} backups</span>
        </div>
        {uploadHistory?.items?.length ? (
          <HistoryDisclosure label="View upload history" hideLabel="Hide upload history" count={uploadHistory.items.length}>
          <div className="space-y-2">
            {uploadHistory.items.map((upload) => (
              <details key={upload.id} className="group rounded-xl border border-slate-200 p-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{upload.original_name}</p>
                    <p className="text-xs text-slate-500">{upload.program} · {upload.rows} students · {formatDate(upload.uploaded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={upload.unresolved_count ? `${upload.unresolved_count} unresolved` : "Validated"} dot={false} />
                    <a href={upload.download_url} onClick={(event) => event.stopPropagation()} className="btn-ghost px-2.5 py-1.5" aria-label={`Download ${upload.original_name}`}>
                      <Download className="h-3.5 w-3.5" /> Backup
                    </a>
                  </div>
                </summary>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {upload.issues?.length ? (
                    <ValidationIssueTable issues={upload.issues} onOpen={setSelectedIssue} onBulkResolved={applyBulkResolution} compact />
                  ) : (
                    <p className="text-sm text-slate-500">This version matches existing records or added new students without conflicts.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
          </HistoryDisclosure>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No monitoring-sheet backups yet.</p>
        )}
      </div>
      {selectedIssue && (
        <MonitoringIssueModal
          issue={selectedIssue}
          busy={resolvingIssue}
          error={issueError}
          onClose={() => { setSelectedIssue(null); setIssueError(""); }}
          onResolve={resolveIssue}
        />
      )}
    </div>
  );
}

function ValidationIssueTable({ issues = [], onOpen, onBulkResolved, title = "", compact = false }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [correctionFile, setCorrectionFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const ordered = [...issues].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Unresolved" ? -1 : 1;
    return (a.row_number || 0) - (b.row_number || 0);
  });
  const unresolved = ordered.filter((item) => item.status === "Unresolved");
  const selectedUnresolved = unresolved.filter((item) => selectedIds.has(item.id));
  const allUnresolvedSelected = unresolved.length > 0 && selectedUnresolved.length === unresolved.length;

  useEffect(() => {
    const unresolvedIds = new Set(issues.filter((item) => item.status === "Unresolved").map((item) => item.id));
    setSelectedIds((current) => new Set([...current].filter((id) => unresolvedIds.has(id))));
  }, [issues]);

  function toggleIssue(issueId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId); else next.add(issueId);
      return next;
    });
    setUploadError("");
    setUploadMessage("");
  }

  function toggleAll() {
    setSelectedIds(allUnresolvedSelected ? new Set() : new Set(unresolved.map((item) => item.id)));
    setUploadError("");
    setUploadMessage("");
  }

  function chooseCorrectionFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setUploadError("Choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setCorrectionFile(file);
    setUploadError("");
    setUploadMessage("");
  }

  async function uploadCorrection() {
    if (!correctionFile || !selectedUnresolved.length) return;
    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    try {
      const response = await api.resolveMonitoringIssuesWithFile(
        selectedUnresolved.map((item) => item.id),
        correctionFile,
      );
      setUploadMessage(response.message);
      setCorrectionFile(null);
      setSelectedIds(new Set());
      onBulkResolved?.(response);
    } catch (err) {
      setUploadError(err.message || "Could not check the corrected workbook.");
    } finally {
      setUploading(false);
    }
  }

  function DiscrepancyList({ issue }) {
    const rows = issue.discrepancies?.length
      ? issue.discrepancies
      : [{ type: issue.issue, messages: issue.details || [issue.summary].filter(Boolean) }];
    return (
      <div className="space-y-1.5">
        {rows.map((item, index) => (
          <div key={`${item.type}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
            <p className="text-xs font-bold text-amber-900">{item.type}</p>
            {(item.messages || []).map((message, messageIndex) => (
              <p key={messageIndex} className="mt-0.5 text-xs leading-relaxed text-slate-600">{message}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className={`rounded-xl border ${compact ? "border-slate-200" : "border-amber-200 bg-white"}`}>
      {(title || !compact) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> {title || "Validation issues"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Each student can have several discrepancies. Select rows to resolve several students with one corrected workbook.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            {ordered.filter((item) => item.status === "Unresolved").length} unresolved
          </span>
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Bulk resolution</p>
              <p className="mt-0.5 text-xs text-slate-500">Select students below, then upload one corrected monitoring workbook containing those students.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{selectedUnresolved.length} selected</span>
              <label className={`btn-ghost cursor-pointer ${selectedUnresolved.length ? "" : "pointer-events-none opacity-50"}`}>
                <FileUp className="h-4 w-4" /> {correctionFile ? "Change file" : "Choose corrected file"}
                <input type="file" accept=".xlsx,.xlsm" className="sr-only" disabled={!selectedUnresolved.length || uploading} onChange={(event) => chooseCorrectionFile(event.target.files?.[0])} />
              </label>
              <button type="button" onClick={uploadCorrection} disabled={!correctionFile || !selectedUnresolved.length || uploading} className="btn-primary cursor-pointer">
                {uploading ? "Checking…" : "Apply to selected students"}
              </button>
            </div>
          </div>
          {correctionFile && <p className="mt-2 text-xs font-semibold text-brand-700">Selected file: {correctionFile.name}</p>}
          {uploadMessage && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{uploadMessage}</p>}
          {uploadError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{uploadError}</p>}
        </div>
      )}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr><th className="w-12 px-4 py-2.5"><input type="checkbox" checked={allUnresolvedSelected} onChange={toggleAll} disabled={!unresolved.length} className="h-4 w-4 cursor-pointer accent-brand-600" aria-label="Select all unresolved students" /></th><th className="px-4 py-2.5">Student</th><th className="px-4 py-2.5">Discrepancies</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map((issue) => (
              <tr key={issue.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 align-top"><input type="checkbox" checked={selectedIds.has(issue.id)} onChange={() => toggleIssue(issue.id)} disabled={issue.status !== "Unresolved"} className="h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`Select ${issue.incoming_name || issue.existing?.name || `row ${issue.row_number}`}`} /></td>
                <td className="px-4 py-3"><p className="font-semibold text-ink">{issue.incoming_name || issue.existing?.name || `Row ${issue.row_number}`}</p><p className="text-xs text-slate-500">{issue.incoming_student_number || "No student ID"}</p></td>
                <td className="max-w-lg px-4 py-3"><DiscrepancyList issue={issue} /></td>
                <td className="px-4 py-3"><StatusBadge value={issue.status} dot={false} /></td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => onOpen(issue)} className="btn-ghost cursor-pointer px-3 py-1.5">Compare</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {ordered.map((issue) => (
          <div key={issue.id} className="px-4 py-3">
            <div className="flex items-start gap-3"><input type="checkbox" checked={selectedIds.has(issue.id)} onChange={() => toggleIssue(issue.id)} disabled={issue.status !== "Unresolved"} className="mt-1 h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`Select ${issue.incoming_name || issue.existing?.name || `row ${issue.row_number}`}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{issue.incoming_name || issue.existing?.name || `Row ${issue.row_number}`}</p><p className="text-xs text-slate-500">{issue.incoming_student_number || "No student ID"}</p></div><StatusBadge value={issue.status} dot={false} /></div><div className="mt-2"><DiscrepancyList issue={issue} /></div><button type="button" onClick={() => onOpen(issue)} className="btn-ghost mt-2 cursor-pointer px-3 py-1.5">Compare records</button></div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonitoringIssueModal({ issue, busy, error, onClose, onResolve }) {
  const uploaded = issue.uploaded || {};
  const existing = issue.existing || {};
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState({
    student_number: uploaded.student_number || "",
    first_name: uploaded.first_name || "",
    last_name: uploaded.last_name || "",
    academic_year_entry: uploaded.academic_year_entry || "",
    subjects: { ...(uploaded.subjects || {}) },
  });
  const subjectRows = issue.subject_comparison || [];
  const unresolved = issue.status === "Unresolved";
  const footer = unresolved ? (
    <>
      <button type="button" disabled={busy} onClick={() => onResolve("keep_existing")} className="btn-ghost cursor-pointer">
        <Database className="h-4 w-4" /> Keep Existing
      </button>
      <button type="button" disabled={busy} onClick={() => onResolve("use_uploaded")} className="btn-ghost cursor-pointer border-brand-200 text-brand-700">
        <FileUp className="h-4 w-4" /> Use Uploaded
      </button>
      {editMode ? (
        <button type="button" disabled={busy} onClick={() => onResolve("edit", edited)} className="btn-primary cursor-pointer">
          {busy ? "Saving…" : "Save Edited Record"}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => setEditMode(true)} className="btn-primary cursor-pointer">
          <Pencil className="h-4 w-4" /> Edit
        </button>
      )}
    </>
  ) : <span className="text-sm font-medium text-emerald-700">Resolved: {(issue.resolution_action || "").replaceAll("_", " ")}</span>;
  return (
    <WorkflowCaseModal
      id={`monitoring-issue-${issue.id}`}
      title={issue.incoming_name || existing.name || `Monitoring row ${issue.row_number}`}
      subtitle={`Row ${issue.row_number || "—"} · ${issue.issue}`}
      status={issue.status}
      onClose={onClose}
      footer={footer}
      size="wide"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Detected discrepancies</p>
          <div className="mt-2 space-y-2">
            {(issue.discrepancies?.length ? issue.discrepancies : [{ type: issue.issue, messages: issue.details || [issue.summary] }]).map((item, index) => (
              <div key={`${item.type}-${index}`} className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-sm font-semibold text-amber-950">{item.type}</p>
                {(item.messages || []).map((message, messageIndex) => <p key={messageIndex} className="mt-0.5 text-xs text-slate-600">{message}</p>)}
              </div>
            ))}
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ComparisonRecord title="Existing record" icon={Database} record={existing} empty="No matching student record" />
          <ComparisonRecord title="Uploaded record" icon={FileUp} record={uploaded} />
        </div>
        {subjectRows.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Subject comparison</h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Existing</th><th className="px-3 py-2">Uploaded</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{subjectRows.map((row) => <tr key={row.code} className={row.regression ? "bg-amber-50" : ""}><td className="px-3 py-2 font-semibold text-ink">{row.code}</td><td className="px-3 py-2 text-slate-600">{row.existing}</td><td className="px-3 py-2 text-slate-600">{row.uploaded}{row.regression ? " · needs review" : ""}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}
        {editMode && (
          <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-ink"><Pencil className="h-4 w-4 text-brand-700" /> Edit uploaded values</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[['student_number', 'Student ID'], ['first_name', 'First name'], ['last_name', 'Last name'], ['academic_year_entry', 'School Year / AY Entry']].map(([key, label]) => (
                <label key={key} htmlFor={`monitoring-${issue.id}-${key}`} className="text-sm font-semibold text-slate-700">{label}<input id={`monitoring-${issue.id}-${key}`} value={edited[key]} onChange={(event) => setEdited((current) => ({ ...current, [key]: event.target.value }))} className="input mt-1 w-full" /></label>
              ))}
            </div>
            {Object.keys(edited.subjects).length > 0 && <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">Completed subjects</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.keys(edited.subjects).sort().map((code) => <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(edited.subjects[code])} onChange={(event) => setEdited((current) => ({ ...current, subjects: { ...current.subjects, [code]: event.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /><span>{code}</span></label>)}</div></fieldset>}
          </section>
        )}
      </div>
    </WorkflowCaseModal>
  );
}

function ComparisonRecord({ title, icon: Icon, record, empty = "No values supplied" }) {
  if (!record || !Object.keys(record).length) return <div className="rounded-xl border border-dashed border-slate-300 p-4"><h3 className="flex items-center gap-2 font-semibold text-ink"><Icon className="h-4 w-4 text-slate-500" /> {title}</h3><p className="mt-4 text-sm text-slate-500">{empty}</p></div>;
  return <section className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-ink"><Icon className="h-4 w-4 text-brand-700" /> {title}</h3><dl className="mt-4 space-y-3 text-sm">{[["Name", record.name || `${record.first_name || ""} ${record.last_name || ""}`.trim()], ["Student ID", record.student_number], ["School Year", record.academic_year_entry], ["Completed subjects", record.completed_count ?? (record.completed_subjects || []).length]].map(([label, value]) => <div key={label} className="grid grid-cols-[8rem_1fr] gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value || "—"}</dd></div>)}</dl></section>;
}
