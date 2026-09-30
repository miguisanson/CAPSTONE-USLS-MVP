import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckSquare, Download, Eye, GraduationCap, Printer, Users } from "lucide-react";
import { api } from "../../api";
import { PageHeader, StatusBadge } from "../../components/ui";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import { DeanFeedback, DeanGate, useDean } from "./DeanContext";
import { casePath, useDeanFilters } from "./DeanShared";
import {
  DeanGraduationBatchModal,
  DeanGraduationBatchStudentList,
  DeanGraduationStageModal,
  DeanGraduationWorkspace,
  DeanListFilters,
  DeanWorkflowBoard,
} from "./DeanParts";
import {
  deanGraduationCurrentStage,
  graduationBatchExportPayload,
  graduationBatchLabel,
  graduationBatchReadyToSend,
  groupGraduationItemsByBatch,
  printGraduationBatch,
  sortSelectedDeanItems,
} from "./deanHelpers";

// Endorsement batches: the Dean's group actions, stage checks, print and CSV
// export for graduation candidates (previously part of the single approvals page).
function DeanGraduationBatches() {
  const navigate = useNavigate();
  const { workflowOverview, refetch, busy, setBusy, setMsg, setActErr } = useDean();
  const [batchOpen, setBatchOpen] = useState(false);
  const [stageBatch, setStageBatch] = useState(null);
  const [selectedGraduationIds, setSelectedGraduationIds] = useState(() => new Set());
  const [expandedGraduationBatches, setExpandedGraduationBatches] = useState(() => new Set());
  const [exportedGraduationBatches, setExportedGraduationBatches] = useState(() => new Set());
  const [exportNotice, setExportNotice] = useState(null);
  const graduationItems = workflowOverview.filter((item) => item.type === "graduation");
  const { filters, setFilters, programs, statuses, apply, matches } = useDeanFilters(graduationItems);
  const visibleGraduation = apply(graduationItems);
  const boardWorkflowRows = sortSelectedDeanItems(visibleGraduation, selectedGraduationIds);
  const approvedGraduation = graduationItems.filter((item) => item.status === "Dean Approved" && matches(item));
  const readyGraduation = visibleGraduation.filter((item) => item.status === "Ready for Dean Review");
  const selectedGraduation = sortSelectedDeanItems(graduationItems.filter((item) => selectedGraduationIds.has(item.student?.id)), selectedGraduationIds);
  const readyGraduationBatches = groupGraduationItemsByBatch(readyGraduation);
  const approvedGraduationBatches = groupGraduationItemsByBatch(approvedGraduation);

  function toggleGraduationBatchStudents(label) {
    setExpandedGraduationBatches((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function toggleGraduation(studentId) {
    setSelectedGraduationIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  async function exportApproved({ reviewWindow = "", endorsementIds = [], batchLabel = "Selected approved candidates" }) {
    const key = `export-${batchLabel || reviewWindow || "all"}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const result = await api.exportGraduationCsv(reviewWindow, endorsementIds);
      setExportedGraduationBatches((current) => new Set(current).add(batchLabel));
      setExportNotice({ filename: result.filename, batchLabel });
      setMsg(`${batchLabel} exported as ${result.filename}. The Dean must email the file to the Registrar and wait for acknowledgement.`);
      await refetch();
    } catch (error) {
      setActErr(error.message || "Could not export the endorsed list.");
    } finally {
      setBusy(0);
    }
  }

  async function batchSaved(result) {
    const skipped = result.skipped?.length || 0;
    setMsg(`${result.message}${skipped ? ` Review ${skipped} skipped candidate${skipped === 1 ? "" : "s"} before retrying.` : ""}`);
    setSelectedGraduationIds(new Set());
    setBatchOpen(false);
    await refetch();
  }

  return (
    <div>
      <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
        {readyGraduation.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <span className="mr-auto text-sm font-semibold text-slate-700">{selectedGraduationIds.size} graduation candidate{selectedGraduationIds.size === 1 ? "" : "s"} selected</span>
            <button type="button" onClick={() => setSelectedGraduationIds(new Set(readyGraduation.map((item) => item.student.id)))} className="btn-ghost cursor-pointer px-3 py-2">Select all ready</button>
            {selectedGraduationIds.size > 0 && <button type="button" onClick={() => setSelectedGraduationIds(new Set())} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
            <button type="button" disabled={!selectedGraduationIds.size} onClick={() => setBatchOpen(true)} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> Apply Dean group action</button>
          </div>
        )}
        {selectedGraduation.length > 0 && (
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected graduation candidates</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedGraduation.map((item) => (
                <span key={item.student.id} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-brand-100">
                  {item.student.name} · {item.student.student_number} · {graduationBatchLabel(item)}
                </span>
              ))}
            </div>
          </div>
        )}
        {readyGraduationBatches.length > 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-ink">Ready graduation batches</p>
                <p className="text-xs text-slate-500">Select or process a whole batch while still seeing every student in it.</p>
              </div>
              <StatusBadge value={`${readyGraduationBatches.length} batch${readyGraduationBatches.length === 1 ? "" : "es"}`} dot={false} />
            </div>
            <div className="space-y-2">
              {readyGraduationBatches.map((batch) => {
                const currentStage = deanGraduationCurrentStage(batch);
                const names = batch.rows.map((item) => item.student.name).slice(0, 4).join(", ");
                const hiddenCount = batch.rows.length - Math.min(batch.rows.length, 4);
                const expanded = expandedGraduationBatches.has(batch.label);
                return (
                  <div
                    key={batch.label}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", `graduation-batch:${batch.label}`);
                    }}
                    className="cursor-grab rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 transition-colors hover:border-emerald-500 active:cursor-grabbing"
                  >
                    <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(230px,0.95fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                        <p className="text-xs text-slate-500">{batch.rows.length} candidate{batch.rows.length === 1 ? "" : "s"}</p>
                        <span className="mt-1 inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span>
                      </div>
                      <p className="truncate text-xs text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                        <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                        <button type="button" onClick={() => setStageBatch(batch)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${batch.label}`}><Eye className="h-4 w-4" /></button>
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                        <button type="button" onClick={() => toggleGraduationBatchStudents(batch.label)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>
                        <button type="button" onClick={() => printGraduationBatch(batch)} className="btn-ghost cursor-pointer px-2.5 py-1"><Printer className="h-4 w-4" /> Print endorsement</button>
                        <button type="button" onClick={() => setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id)))} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>
                        <button type="button" onClick={() => { setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id))); setBatchOpen(true); }} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left"><CheckSquare className="h-4 w-4 shrink-0" /> Review endorsement list</button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <DeanGraduationBatchStudentList rows={batch.rows} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {boardWorkflowRows.length > 0 && (
          <DeanWorkflowBoard rows={boardWorkflowRows} onOpen={(item) => navigate(casePath(item))} selectedIds={selectedGraduationIds} onToggle={toggleGraduation} />
        )}
        {approvedGraduationBatches.length > 0 && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-ink">Approved graduation batches</p>
                <p className="text-xs text-slate-500">Export the Dean-approved list, then email it to the Registrar and wait for acknowledgement.</p>
              </div>
              <StatusBadge value={`${approvedGraduation.length} approved`} dot={false} />
            </div>
            <div className="space-y-2">
              {approvedGraduationBatches.map((batch) => {
                const payload = graduationBatchExportPayload(batch);
                const currentStage = deanGraduationCurrentStage(batch);
                const names = batch.rows.map((item) => item.student.name).slice(0, 4).join(", ");
                const hiddenCount = batch.rows.length - Math.min(batch.rows.length, 4);
                const expanded = expandedGraduationBatches.has(batch.label);
                const readyToSend = graduationBatchReadyToSend(batch, exportedGraduationBatches);
                const exportBusy = busy === `export-${batch.label}`;
                return (
                  <div key={`approved-${batch.label}`} className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-1.5">
                    <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(320px,1.25fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                        <p className="text-xs text-slate-500">{batch.rows.length} approved candidate{batch.rows.length === 1 ? "" : "s"}</p>
                      </div>
                      <p className="truncate text-xs text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                        <StatusBadge value={readyToSend ? "Exported" : `Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                        <button type="button" onClick={() => setStageBatch(batch)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${batch.label}`}><Eye className="h-4 w-4" /></button>
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                        <button type="button" onClick={() => toggleGraduationBatchStudents(batch.label)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>
                        <button type="button" disabled={exportBusy} onClick={() => exportApproved(payload)} className="btn min-w-0 cursor-pointer whitespace-normal bg-emerald-600 px-2.5 py-1 text-left text-white hover:bg-emerald-700"><Download className="h-4 w-4 shrink-0" /> {exportBusy ? "Exporting..." : readyToSend ? "Export again" : "Export approved list"}</button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-2 border-t border-emerald-100 pt-2">
                        <DeanGraduationBatchStudentList rows={batch.rows} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {!readyGraduationBatches.length && !approvedGraduationBatches.length && !boardWorkflowRows.length && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No graduation endorsement batches match these filters.</p>
      )}
      {batchOpen && selectedGraduation.length > 0 && <DeanGraduationBatchModal rows={selectedGraduation} onClose={() => setBatchOpen(false)} onSaved={batchSaved} />}
      {stageBatch && <DeanGraduationStageModal batch={stageBatch} onClose={() => setStageBatch(null)} />}
      {exportNotice && (
        <ExportFollowUpModal
          id="dean-graduation-export-follow-up"
          title="Graduation CSV export complete"
          filename={exportNotice.filename}
          actorLabel="The Dean"
          fileLabel="endorsed graduation list"
          onClose={() => setExportNotice(null)}
        />
      )}
    </div>
  );
}

const TABS = [
  { id: "roster", label: "Roster & workflow" },
  { id: "batches", label: "Endorsement batches" },
];

export function DeanGraduationPage() {
  return (
    <DeanGate>
      <DeanGraduationBody />
    </DeanGate>
  );
}

function DeanGraduationBody() {
  const [params, setParams] = useSearchParams();
  const { counts } = useDean();
  const tab = TABS.some((item) => item.id === params.get("tab")) ? params.get("tab") : "roster";
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Graduation Endorsement"
        description="Review the endorsement lists prepared by Graduate School staff, approve or return them, then export the approved list for the Registrar."
        icon={GraduationCap}
        badge={<StatusBadge value={`${counts.pendingGraduation} waiting`} dot={false} />}
        actions={<Link to="/dean/approvals" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> All approvals</Link>}
      />
      <DeanFeedback />
      <div role="tablist" aria-label="Graduation views" className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === "roster" ? {} : { tab: item.id }, { replace: true })}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === item.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-brand-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "roster" ? <DeanGraduationWorkspace /> : <DeanGraduationBatches />}
    </div>
  );
}
