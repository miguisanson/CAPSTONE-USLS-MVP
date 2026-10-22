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
import { Button, Card, DataTable, EmptyState, Field, HistoryPanel, InlineNotice, Input, SectionTitle, StatusChip } from "../../components/ui/index.js";
import HandoffResult from "../../components/HandoffResult";
import { formatDate } from "../../lib/format";
import { toneOf } from "../../lib/tone";
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
        action={<Button as={Link} to="/monitoring-sheet" variant="secondary" icon={Table2} className="shrink-0">Full sheet</Button>}
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
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </span>
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="min-w-0 break-all font-semibold text-ink">{file.name}</span>
            <Button variant="icon" icon={X} aria-label="Remove file" onClick={() => setFile(null)} />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Drag &amp; drop your .xlsx here</p>
            <p className="meta">or</p>
          </>
        )}
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="sr-only peer"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <span className="btn-ghost cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">{file ? "Choose a different file" : "Browse files"}</span>
        </label>
        <p className="meta mt-3">
          Expected format: AC Student Monitoring template — program in cell A1, one student per row.
        </p>
      </div>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={runImport} disabled={!file} loading={busy} icon={UploadCloud} className="w-full sm:w-auto">
          {busy ? "Importing…" : isAudit ? "Update audits" : "Import students"}
        </Button>
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

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="card-title flex items-center gap-2"><History className="h-4 w-4 text-brand-700" aria-hidden="true" /> Upload history</h3>
            <p className="meta mt-1">Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record.</p>
          </div>
          <StatusChip tone="neutral" status={`${uploadHistory?.items?.length || 0} ${uploadHistory?.items?.length === 1 ? "backup" : "backups"}`} dot={false} />
        </div>
        {uploadHistory?.items?.length ? (
          <HistoryPanel label="View upload history" hideLabel="Hide upload history" count={uploadHistory.items.length}>
            <div className="space-y-2">
              {uploadHistory.items.map((upload) => (
                <details key={upload.id} className="group rounded-xl border border-slate-200 p-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{upload.original_name}</p>
                      <p className="meta">{upload.program} · {upload.rows} students · {formatDate(upload.uploaded_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={upload.unresolved_count ? `${upload.unresolved_count} unresolved` : "Validated"} tone={upload.unresolved_count ? "warning" : "success"} dot={false} />
                      <Button
                        as="a"
                        href={upload.download_url}
                        onClick={(event) => event.stopPropagation()}
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        aria-label={`Download ${upload.original_name}`}
                      >
                        Backup
                      </Button>
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
          </HistoryPanel>
        ) : (
          <EmptyState size="sm" title="No monitoring-sheet backups yet." />
        )}
      </Card>
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

function DiscrepancyList({ issue }) {
  const rows = issue.discrepancies?.length
    ? issue.discrepancies
    : [{ type: issue.issue, messages: issue.details || [issue.summary].filter(Boolean) }];
  return (
    <div className="space-y-1.5">
      {rows.map((item, index) => (
        <div key={`${item.type}-${index}`} className={`rounded-lg border px-2.5 py-2 ${toneOf("warning").notice}`}>
          <p className="text-xs font-semibold">{item.type}</p>
          {(item.messages || []).map((message, messageIndex) => (
            <p key={messageIndex} className="meta mt-0.5 leading-relaxed text-slate-600">{message}</p>
          ))}
        </div>
      ))}
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

  const nameOf = (issue) => issue.incoming_name || issue.existing?.name || `Row ${issue.row_number}`;
  const columns = [
    {
      key: "select",
      width: "3rem",
      header: (
        <input
          type="checkbox"
          checked={allUnresolvedSelected}
          onChange={toggleAll}
          disabled={!unresolved.length}
          className="h-4 w-4 cursor-pointer accent-brand-600"
          aria-label="Select all unresolved students"
        />
      ),
      cell: (issue) => (
        <input
          type="checkbox"
          checked={selectedIds.has(issue.id)}
          onChange={() => toggleIssue(issue.id)}
          disabled={issue.status !== "Unresolved"}
          className="h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
          aria-label={`Select ${nameOf(issue)}`}
        />
      ),
    },
    {
      key: "student",
      header: "Student",
      cell: (issue) => (
        <div>
          <p className="font-semibold text-ink">{nameOf(issue)}</p>
          <p className="meta">{issue.incoming_student_number || "No student ID"}</p>
        </div>
      ),
    },
    { key: "discrepancies", header: "Discrepancies", className: "max-w-lg", cell: (issue) => <DiscrepancyList issue={issue} /> },
    { key: "status", header: "Status", cell: (issue) => <StatusChip status={issue.status} dot={false} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (issue) => <Button variant="secondary" size="sm" onClick={() => onOpen(issue)}>Compare</Button>,
    },
  ];

  return (
    <section className={`rounded-xl border ${compact ? "border-slate-200" : "border-amber-200 bg-white"}`}>
      {(title || !compact) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="card-title flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /> {title || "Validation issues"}
            </h3>
            <p className="meta mt-0.5">Each student can have several discrepancies. Select rows to resolve several students with one corrected workbook.</p>
          </div>
          <StatusChip tone="warning" status={`${unresolved.length} unresolved`} dot={false} />
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Bulk resolution</p>
              <p className="meta mt-0.5">Select students below, then upload one corrected monitoring workbook containing those students.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="neutral" status={`${selectedUnresolved.length} selected`} dot={false} />
              <label className={`btn-ghost cursor-pointer ${selectedUnresolved.length ? "" : "pointer-events-none opacity-50"}`}>
                <FileUp className="h-4 w-4" aria-hidden="true" /> {correctionFile ? "Change file" : "Choose corrected file"}
                <input type="file" accept=".xlsx,.xlsm" className="sr-only" disabled={!selectedUnresolved.length || uploading} onChange={(event) => chooseCorrectionFile(event.target.files?.[0])} />
              </label>
              <Button onClick={uploadCorrection} disabled={!correctionFile || !selectedUnresolved.length} loading={uploading}>
                {uploading ? "Checking…" : "Apply to selected students"}
              </Button>
            </div>
          </div>
          {correctionFile && <p className="mt-2 text-xs font-semibold text-brand-700">Selected file: {correctionFile.name}</p>}
          {uploadMessage && <InlineNotice tone="success" className="mt-2">{uploadMessage}</InlineNotice>}
          {uploadError && <InlineNotice tone="danger" className="mt-2">{uploadError}</InlineNotice>}
        </div>
      )}
      <div className="hidden p-3 md:block">
        <DataTable
          caption={title || "Validation issues"}
          columns={columns}
          rows={ordered}
          rowKey="id"
          minWidth="sm"
          empty={{ title: "No validation issues", hint: "Every row of this workbook matched an existing record." }}
        />
      </div>
      {/* Phones: one card per student, so nothing needs sideways scrolling. */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {ordered.map((issue) => (
          <li key={issue.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selectedIds.has(issue.id)}
              onChange={() => toggleIssue(issue.id)}
              disabled={issue.status !== "Unresolved"}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
              aria-label={`Select ${nameOf(issue)}`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{nameOf(issue)}</p>
                  <p className="meta">{issue.incoming_student_number || "No student ID"}</p>
                </div>
                <StatusChip status={issue.status} dot={false} size="sm" />
              </div>
              <DiscrepancyList issue={issue} />
              <Button variant="secondary" size="sm" onClick={() => onOpen(issue)}>Compare records</Button>
            </div>
          </li>
        ))}
      </ul>
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
      <Button variant="secondary" disabled={busy} onClick={() => onResolve("keep_existing")} icon={Database}>Keep Existing</Button>
      <Button variant="secondary" disabled={busy} onClick={() => onResolve("use_uploaded")} icon={FileUp} className="border-brand-200 text-brand-700">Use Uploaded</Button>
      {editMode ? (
        <Button disabled={busy} onClick={() => onResolve("edit", edited)} loading={busy}>{busy ? "Saving…" : "Save Edited Record"}</Button>
      ) : (
        <Button disabled={busy} onClick={() => setEditMode(true)} icon={Pencil}>Edit</Button>
      )}
    </>
  ) : <span className="text-sm font-semibold text-brand-700">Resolved: {(issue.resolution_action || "").replaceAll("_", " ")}</span>;
  const subjectColumns = [
    { key: "code", header: "Subject", cell: (row) => <span className="font-semibold text-ink">{row.code}</span> },
    { key: "existing", header: "Existing" },
    {
      key: "uploaded",
      header: "Uploaded",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {row.uploaded}
          {row.regression && <StatusChip tone="warning" status="Needs review" size="sm" dot={false} />}
        </span>
      ),
    },
  ];
  return (
    <WorkflowCaseModal
      title={issue.incoming_name || existing.name || `Monitoring row ${issue.row_number}`}
      subtitle={`Row ${issue.row_number || "—"} · ${issue.issue}`}
      status={issue.status}
      onClose={onClose}
      footer={footer}
      size="wide"
    >
      <div className="space-y-5">
        <InlineNotice tone="warning" title="Detected discrepancies">
          <div className="mt-2 space-y-2">
            {(issue.discrepancies?.length ? issue.discrepancies : [{ type: issue.issue, messages: issue.details || [issue.summary] }]).map((item, index) => (
              <div key={`${item.type}-${index}`} className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-sm font-semibold text-amber-950">{item.type}</p>
                {(item.messages || []).map((message, messageIndex) => <p key={messageIndex} className="meta mt-0.5 text-slate-600">{message}</p>)}
              </div>
            ))}
          </div>
        </InlineNotice>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <div className="grid gap-4 lg:grid-cols-2">
          <ComparisonRecord title="Existing record" icon={Database} record={existing} empty="No matching student record" />
          <ComparisonRecord title="Uploaded record" icon={FileUp} record={uploaded} />
        </div>
        {subjectRows.length > 0 && (
          <section>
            <h3 className="card-title mb-2">Subject comparison</h3>
            <DataTable caption="Subject comparison" columns={subjectColumns} rows={subjectRows} rowKey="code" dense stickyHeader pageSize={0} />
          </section>
        )}
        {editMode && (
          <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <h3 className="card-title flex items-center gap-2"><Pencil className="h-4 w-4 text-brand-700" aria-hidden="true" /> Edit uploaded values</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[["student_number", "Student ID"], ["first_name", "First name"], ["last_name", "Last name"], ["academic_year_entry", "School Year / AY Entry"]].map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input value={edited[key]} onChange={(event) => setEdited((current) => ({ ...current, [key]: event.target.value }))} />
                </Field>
              ))}
            </div>
            {Object.keys(edited.subjects).length > 0 && (
              <fieldset className="mt-4">
                <legend className="field-label">Completed subjects</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.keys(edited.subjects).sort().map((code) => (
                    <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input type="checkbox" checked={Boolean(edited.subjects[code])} onChange={(event) => setEdited((current) => ({ ...current, subjects: { ...current.subjects, [code]: event.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      <span>{code}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </section>
        )}
      </div>
    </WorkflowCaseModal>
  );
}

function ComparisonRecord({ title, icon: Icon, record, empty = "No values supplied" }) {
  if (!record || !Object.keys(record).length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4">
        <h3 className="card-title flex items-center gap-2"><Icon className="h-4 w-4 text-slate-500" aria-hidden="true" /> {title}</h3>
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      </div>
    );
  }
  // A subject count of 0 is a real answer, so only a missing value shows a dash.
  const completed = record.completed_count
    ?? record.completed_subjects?.length
    ?? (record.subjects ? Object.values(record.subjects).filter(Boolean).length : undefined);
  const rows = [
    ["Name", record.name || `${record.first_name || ""} ${record.last_name || ""}`.trim()],
    ["Student ID", record.student_number],
    ["School Year", record.academic_year_entry],
    ["Completed subjects", completed],
  ];
  return (
    <Card as="section" pad="sm" className="shadow-none">
      <h3 className="card-title flex items-center gap-2"><Icon className="h-4 w-4 text-brand-700" aria-hidden="true" /> {title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800">{value || value === 0 ? value : "—"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
