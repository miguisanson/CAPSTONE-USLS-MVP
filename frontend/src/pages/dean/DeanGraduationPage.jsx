import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckSquare, Download, Eye, GraduationCap, Printer, Users } from "lucide-react";
import { api } from "../../api";
import { Button, Card, EmptyState, PageHeader, StatusChip } from "../../components/ui/index.js";
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
  STAGE_TONE,
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
        <Card pad="sm" className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-slate-700">{selectedGraduationIds.size} graduation candidate{selectedGraduationIds.size === 1 ? "" : "s"} selected</span>
          <Button variant="secondary" onClick={() => setSelectedGraduationIds(new Set(readyGraduation.map((item) => item.student.id)))}>Select all ready</Button>
          {selectedGraduationIds.size > 0 && <Button variant="secondary" onClick={() => setSelectedGraduationIds(new Set())}>Clear selection</Button>}
          <Button icon={CheckSquare} disabled={!selectedGraduationIds.size} onClick={() => setBatchOpen(true)}>Apply Dean group action</Button>
        </Card>
      )}
      {selectedGraduation.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <p className="eyebrow text-brand-700">Selected graduation candidates</p>
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
        <Card pad="none" className="mb-5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title">Ready graduation batches</h2>
              <p className="meta">Select or process a whole batch while still seeing every student in it.</p>
            </div>
            <StatusChip status={`${readyGraduationBatches.length} batch${readyGraduationBatches.length === 1 ? "" : "es"}`} tone="muted" dot={false} />
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
                  className="cursor-grab rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 transition-colors hover:border-brand-500 active:cursor-grabbing"
                >
                  <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(230px,0.95fr)] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                      <p className="meta">{batch.rows.length} candidate{batch.rows.length === 1 ? "" : "s"}</p>
                      <div className="mt-1"><StatusChip status="Ready" label="Ready for Dean review" size="sm" dot={false} /></div>
                    </div>
                    <p className="meta truncate text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="meta truncate font-semibold text-slate-700">{currentStage.label}</p>
                      <StatusChip status={`Step ${currentStage.number}: ${currentStage.state}`} tone={STAGE_TONE[currentStage.state]} dot={false} />
                      <Button variant="icon" icon={Eye} onClick={() => setStageBatch(batch)} aria-label={`View graduation stage check for ${batch.label}`} />
                    </div>
                    <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                      <Button variant="secondary" size="sm" icon={Users} onClick={() => toggleGraduationBatchStudents(batch.label)}>{expanded ? "Hide students" : "View students"}</Button>
                      <Button variant="secondary" size="sm" icon={Printer} onClick={() => printGraduationBatch(batch)}>Print endorsement</Button>
                      <Button variant="secondary" size="sm" onClick={() => setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id)))}>Select batch</Button>
                      <Button size="sm" icon={CheckSquare} className="min-w-0 whitespace-normal text-left" onClick={() => { setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id))); setBatchOpen(true); }}>Review endorsement list</Button>
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
        </Card>
      )}
      {boardWorkflowRows.length > 0 && (
        <DeanWorkflowBoard rows={boardWorkflowRows} onOpen={(item) => navigate(casePath(item))} selectedIds={selectedGraduationIds} onToggle={toggleGraduation} />
      )}
      {approvedGraduationBatches.length > 0 && (
        <Card pad="none" className="mb-5 border-brand-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title">Approved graduation batches</h2>
              <p className="meta">Export the Dean-approved list, then email it to the Registrar and wait for acknowledgement.</p>
            </div>
            <StatusChip status={`${approvedGraduation.length} approved`} tone="muted" dot={false} />
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
                <div key={`approved-${batch.label}`} className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-1.5">
                  <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(320px,1.25fr)] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                      <p className="meta">{batch.rows.length} approved candidate{batch.rows.length === 1 ? "" : "s"}</p>
                    </div>
                    <p className="meta truncate text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="meta truncate font-semibold text-slate-700">{currentStage.label}</p>
                      {readyToSend
                        ? <StatusChip status="Exported - Ready to Send" label="Exported" dot={false} />
                        : <StatusChip status={`Step ${currentStage.number}: ${currentStage.state}`} tone={STAGE_TONE[currentStage.state]} dot={false} />}
                      <Button variant="icon" icon={Eye} onClick={() => setStageBatch(batch)} aria-label={`View graduation stage check for ${batch.label}`} />
                    </div>
                    <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                      <Button variant="secondary" size="sm" icon={Users} onClick={() => toggleGraduationBatchStudents(batch.label)}>{expanded ? "Hide students" : "View students"}</Button>
                      <Button size="sm" icon={Download} loading={exportBusy} className="min-w-0 whitespace-normal text-left" onClick={() => exportApproved(payload)}>{exportBusy ? "Exporting..." : readyToSend ? "Export again" : "Export approved list"}</Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-2 border-t border-brand-100 pt-2">
                      <DeanGraduationBatchStudentList rows={batch.rows} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!readyGraduationBatches.length && !approvedGraduationBatches.length && !boardWorkflowRows.length && (
        <Card pad="none">
          <EmptyState size="sm" title="No graduation endorsement batches match these filters." hint="Try a different search or filter." />
        </Card>
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
        badge={<StatusChip status={`${counts.pendingGraduation} waiting`} tone="muted" dot={false} />}
        actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>All approvals</Button>}
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
