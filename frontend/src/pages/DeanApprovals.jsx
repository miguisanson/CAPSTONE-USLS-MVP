import { useEffect, useMemo, useRef, useState } from "react";
import { Gavel, LogOut, CheckCircle2, RotateCcw, AlertTriangle, Inbox, Clock, LayoutDashboard, Briefcase, GraduationCap, CalendarOff, BarChart3, Download, Search, SlidersHorizontal, ArrowUpRight, Eye, MessageSquare, X, CheckSquare } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import RoleSidebar from "../components/RoleSidebar";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../components/WorkflowTimeline";

const DEAN_NAV = [
  { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
  { id: "practicum", label: "Practicum Reports", icon: Briefcase },
  { id: "graduation", label: "Graduation Review", icon: GraduationCap },
  { id: "withdrawal", label: "Withdrawal Requests", icon: LogOut },
  { id: "leave", label: "LOA / Readmission / AWOL", icon: CalendarOff },
  { id: "reports", label: "Reports / Analytics", icon: BarChart3 },
];

const CLARIFICATION_TEMPLATES = [
  "Please upload the correct document.",
  "The submitted file is unreadable. Please re-upload a clearer copy.",
  "Please complete the missing required fields.",
  "The document needs the proper signature before approval.",
  "Please clarify the information entered in this section.",
  "Returned for revision. Please review the comments and resubmit.",
  "Forwarding this request for dean review.",
  "Sending this back to the previous stage for correction.",
  "Other / Custom comment",
];

function deanItemDate(item) {
  return item.last_activity_at || item.submitted_at || item.record?.updated_at || "";
}

function deanDateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

function sortDeanItems(items, sort) {
  return [...items].sort((left, right) => {
    if (sort === "student") return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    const leftDate = new Date(deanItemDate(left) || 0).getTime();
    const rightDate = new Date(deanItemDate(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

export default function DeanApprovals() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.approvals(), []);
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState({});
  const [template, setTemplate] = useState({});
  const [recipient, setRecipient] = useState({});
  const [visibility, setVisibility] = useState({});
  const [msg, setMsg] = useState("");
  const [actErr, setActErr] = useState("");
  const [view, setView] = useState("overview");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [pendingExport, setPendingExport] = useState(null);
  const [selectedGraduationIds, setSelectedGraduationIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [filters, setFilters] = useState({ query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" });
  const workflowPending = data?.workflow_pending || [];
  const workflowRecent = data?.workflow_recent || [];
  const workflowOverview = data?.workflow_overview || [];
  const isStandingChange = (item) => ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  const belongsToView = (item) => view === "overview" || (view === "leave" ? isStandingChange(item) : item.type === view);
  const baseWorkflowPending = workflowPending.filter(belongsToView);
  const baseWorkflowRecent = (view === "overview" ? workflowRecent : workflowOverview).filter(belongsToView);
  const matchesFilters = (item) => {
    const program = item.student?.program_code || item.program_code || "";
    const text = `${item.title || ""} ${item.subtitle || ""} ${item.student?.name || ""} ${item.student?.student_number || ""} ${program}`.toLowerCase();
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (!filters.program || program === filters.program)
      && (!filters.status || item.status === filters.status || item.workflow_status === filters.status)
      && deanDateMatches(deanItemDate(item), filters.dateFrom, filters.dateTo);
  };
  const visibleWorkflowPending = sortDeanItems(baseWorkflowPending.filter(matchesFilters), filters.sort);
  const visibleWorkflowRecent = sortDeanItems(baseWorkflowRecent.filter(matchesFilters), filters.sort);
  const visibleWorkflowOverview = sortDeanItems(workflowOverview.filter(belongsToView).filter(matchesFilters), filters.sort);
  const boardWorkflowRows = visibleWorkflowOverview.filter((item) => !isStandingChange(item));
  const pendingPlans = (data?.pending || []).filter(matchesFilters);
  const recentPlans = (data?.recent || []).filter(matchesFilters);
  const programs = useMemo(() => [...new Set([
    ...(data?.pending || []).map((item) => item.program_code),
    ...(data?.recent || []).map((item) => item.program_code),
    ...workflowOverview.map((item) => item.student?.program_code),
  ].filter(Boolean))].sort(), [data, workflowOverview]);
  const statuses = useMemo(() => [...new Set([
    ...(view === "overview" ? [...(data?.pending || []), ...workflowOverview] : workflowOverview.filter(belongsToView)).flatMap((item) => [item.status, item.workflow_status]),
  ].filter(Boolean))].sort(), [data, workflowOverview, view]);
  const approvedGraduation = workflowOverview.filter((item) => item.type === "graduation" && item.status === "Dean Approved" && matchesFilters(item));
  const readyGraduation = visibleWorkflowOverview.filter((item) => item.type === "graduation" && item.status === "Ready for Dean Review");
  const selectedGraduation = workflowOverview.filter((item) => selectedGraduationIds.has(item.student?.id));

  useEffect(() => {
    setFilters((current) => ({ ...current, status: "" }));
    setSelectedGraduationIds(new Set());
  }, [view]);

  async function decide(plan, decision) {
    setBusy(plan.id);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideApproval(plan.id, { decision, note: note[plan.id] || "" });
      setMsg(res.message);
      refetch();
    } catch (e) {
      setActErr(e.message);
    } finally {
      setBusy(0);
    }
  }

  function requestWorkflowDecision(item, decision) {
    const key = `${item.type}-${item.id}`;
    const selectedTemplate = template[key] || "";
    const customNote = note[key] || "";
    const combinedNote = [selectedTemplate !== "Other / Custom comment" ? selectedTemplate : "", customNote].filter(Boolean).join(" · ");
    if (["return", "deny"].includes(decision) && !combinedNote.trim()) {
      setActErr("Choose a reason or enter a comment before returning or denying the request.");
      return;
    }
    setActErr("");
    setPendingDecision({ item, decision, note: combinedNote });
  }

  async function confirmWorkflowDecision() {
    if (!pendingDecision) return;
    const { item, decision, note: decisionNote } = pendingDecision;
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideWorkflowApproval(item.type, item.id, { decision, note: decisionNote });
      setMsg(res.message);
      await refetch();
      setPendingDecision(null);
      setSelectedWorkflow(null);
    } catch (e) {
      setActErr(e.message);
    } finally {
      setBusy(0);
    }
  }

  async function messageWorkflow(item) {
    const key = `${item.type}-${item.id}`;
    const selectedTemplate = template[key] || "";
    const customNote = (note[key] || "").trim();
    const messageTemplate = selectedTemplate || (customNote ? "Other / Custom comment" : "");
    if (!messageTemplate || (messageTemplate === "Other / Custom comment" && !customNote)) {
      setActErr("Choose a message template or enter a custom comment.");
      return;
    }
    setBusy(`message-${key}`);
    setMsg("");
    setActErr("");
    try {
      const res = await api.sendWorkflowMessage(item.type, {
        student_id: item.student.id,
        action_type: "note",
        recipient_role: recipient[key] || "Graduate School Staff",
        visibility: (recipient[key] || "Graduate School Staff") === "Student" ? "student_visible" : (visibility[key] || "internal"),
        template: messageTemplate,
        comment: customNote,
      });
      setMsg(res.message);
      await refetch();
      setSelectedWorkflow(null);
    } catch (error) {
      setActErr(error.message || "Could not save the workflow comment.");
    } finally {
      setBusy(0);
    }
  }

  async function exportApproved(reviewWindow = "", endorsementIds = []) {
    const key = `export-${reviewWindow || "all"}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const result = await api.exportGraduationCsv(reviewWindow, endorsementIds);
      setMsg(`${result.count} Dean-approved candidate${result.count === 1 ? "" : "s"} exported and marked sent to the Registrar.`);
      await refetch();
      setPendingExport(null);
    } catch (error) {
      setActErr(error.message || "Could not export the endorsed list.");
    } finally {
      setBusy(0);
    }
  }

  function toggleGraduation(studentId) {
    setSelectedGraduationIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  async function batchSaved(result) {
    const skipped = result.skipped?.length || 0;
    setMsg(`${result.message}${skipped ? ` Review ${skipped} skipped candidate${skipped === 1 ? "" : "s"} before retrying.` : ""}`);
    setSelectedGraduationIds(new Set());
    setBatchOpen(false);
    await refetch();
  }

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar roleLabel="Dean Portal" items={DEAN_NAV} active={view} onChange={setView} />
      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-display text-[15px] font-semibold text-ink">Dean · Approvals</p>
          <p className="text-[11px] text-slate-400">{user?.full_name}</p>
        </div>
        <button type="button" onClick={logout} className="btn-ghost">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold text-ink">Items awaiting your approval</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review what the Graduate School submitted, then approve or return it. Your decision is recorded against your account.
          </p>
        </div>

        <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
        {(view === "overview" || view === "graduation") && readyGraduation.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <span className="mr-auto text-sm font-semibold text-slate-700">{selectedGraduationIds.size} graduation candidate{selectedGraduationIds.size === 1 ? "" : "s"} selected</span>
            <button type="button" onClick={() => setSelectedGraduationIds(new Set(readyGraduation.map((item) => item.student.id)))} className="btn-ghost cursor-pointer px-3 py-2">Select all ready</button>
            {selectedGraduationIds.size > 0 && <button type="button" onClick={() => setSelectedGraduationIds(new Set())} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
            <button type="button" disabled={!selectedGraduationIds.size} onClick={() => setBatchOpen(true)} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> Apply Dean group action</button>
          </div>
        )}
        {boardWorkflowRows.length > 0 && (
          <DeanWorkflowBoard rows={boardWorkflowRows} onOpen={setSelectedWorkflow} selectedIds={selectedGraduationIds} onToggle={toggleGraduation} />
        )}
        {approvedGraduation.length > 0 && (view === "overview" || view === "graduation") && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-sm font-medium text-brand-800">{approvedGraduation.length} approved candidate{approvedGraduation.length === 1 ? " is" : "s are"} ready for Dean export and Registrar handoff.</p>
            <button type="button" disabled={String(busy).startsWith("export-")} onClick={() => setPendingExport({ reviewWindow: "", endorsementIds: approvedGraduation.map((item) => item.id), count: approvedGraduation.length })} className="btn-primary"><Download className="h-4 w-4" /> Export filtered approved list</button>
          </div>
        )}

        {msg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {msg}
          </div>
        )}
        {actErr && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{actErr}</div>
        )}

        {loading ? (
          <Spinner label="Loading approvals…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load approvals" hint={error} />
        ) : (
          <>
            {(view !== "overview" || pendingPlans.length === 0) && visibleWorkflowPending.length === 0 ? (
              <Card className="p-6">
                <EmptyState icon={Inbox} title="Nothing to review in this section" hint={view === "leave" ? "LOA and readmission reviews will appear here when routed to the Dean." : view === "reports" ? "No report items are awaiting a Dean decision." : "Submitted items for this role will appear here."} />
              </Card>
            ) : (
              <div className="space-y-4">
                {view === "overview" && pendingPlans.map((plan) => {
                  const offered = plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested");
                  return (
                    <Card key={plan.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-display text-lg font-semibold text-ink">
                            Course offerings · {plan.program_code}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}
                          </p>
                        </div>
                        <StatusBadge value={plan.status} dot={false} />
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2">Subject</th>
                              <th className="px-3 py-2">Demand</th>
                              <th className="px-3 py-2">Sections</th>
                              <th className="px-3 py-2">Decision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.offerings.map((o) => (
                              <tr key={o.id} className="border-b border-slate-50">
                                <td className="px-4 py-2">
                                  <span className="font-semibold text-ink">{o.code}</span>
                                  <span className="ml-1 text-slate-500">{o.title}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{o.demand_count}</td>
                                <td className="px-3 py-2 text-slate-600">{o.section_count}</td>
                                <td className="px-3 py-2"><StatusBadge value={o.status} dot={false} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <input
                        value={note[plan.id] || ""}
                        onChange={(e) => setNote((n) => ({ ...n, [plan.id]: e.target.value }))}
                        placeholder="Optional note to the Graduate School…"
                        aria-label={`Optional decision note for ${plan.program_code} ${plan.term_label}`}
                        className="field-input mt-3"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "approve")} className="btn-primary">
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </button>
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "return")} className="btn-ghost">
                          <RotateCcw className="h-4 w-4" /> Return for revision
                        </button>
                      </div>
                    </Card>
                  );
                })}
                {visibleWorkflowPending.map((item) => (
                  <WorkflowApprovalCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    note={note}
                    setNote={setNote}
                    template={template}
                    setTemplate={setTemplate}
                    recipient={recipient}
                    setRecipient={setRecipient}
                    visibility={visibility}
                    setVisibility={setVisibility}
                    busy={busy}
                    onDecide={requestWorkflowDecision}
                    onMessage={messageWorkflow}
                  />
                ))}
              </div>
            )}

            {view === "overview" && recentPlans.length > 0 && (
              <Card className="mt-6 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Recent decisions
                </p>
                <ul className="divide-y divide-slate-100">
                  {recentPlans.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">
                        {p.program_code} · {p.term_label}
                        {p.approved_by && <span className="text-slate-400"> · by {p.approved_by}</span>}
                      </span>
                      <StatusBadge value={p.status} dot={false} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {visibleWorkflowRecent.length > 0 && (
              <Card className="mt-6 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Recent workflow decisions
                </p>
                <ul className="divide-y divide-slate-100">
                  {visibleWorkflowRecent.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{item.title}</span>
                      <span className="flex items-center gap-2"><StatusBadge value={item.status} dot={false} />{item.type === "graduation" && item.status === "Dean Approved" && <button type="button" disabled={busy === `export-${item.review_window}`} onClick={() => setPendingExport({ reviewWindow: item.review_window, endorsementIds: [item.id], count: 1 })} className="btn-ghost px-3 py-1.5"><Download className="h-3.5 w-3.5" /> Export</button>}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
      {selectedWorkflow && (
        <DeanDialog id={`dean-workflow-${selectedWorkflow.type}-${selectedWorkflow.id}`} title={selectedWorkflow.title} subtitle="Request details, files, messages, history, and Dean actions" onClose={() => setSelectedWorkflow(null)}>
            <WorkflowApprovalCard
              item={selectedWorkflow}
              note={note}
              setNote={setNote}
              template={template}
              setTemplate={setTemplate}
              recipient={recipient}
              setRecipient={setRecipient}
              visibility={visibility}
              setVisibility={setVisibility}
              busy={busy}
              onDecide={requestWorkflowDecision}
              onMessage={messageWorkflow}
            />
        </DeanDialog>
      )}
      {pendingDecision && <DeanDecisionModal pending={pendingDecision} busy={busy === `${pendingDecision.item.type}-${pendingDecision.item.id}`} onClose={() => setPendingDecision(null)} onConfirm={confirmWorkflowDecision} />}
      {pendingExport && <DeanExportModal pending={pendingExport} busy={String(busy).startsWith("export-")} onClose={() => setPendingExport(null)} onConfirm={() => exportApproved(pendingExport.reviewWindow, pendingExport.endorsementIds)} />}
      {batchOpen && selectedGraduation.length > 0 && <DeanGraduationBatchModal rows={selectedGraduation} templates={CLARIFICATION_TEMPLATES} onClose={() => setBatchOpen(false)} onSaved={batchSaved} />}
      </div>
    </div>
  );
}

function DeanDialog({ id, title, subtitle, onClose, children, footer = null }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function keydown(event) {
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (dialog && dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">{title}</h2><p id={`${id}-description`} className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-brand-500" aria-label="Close dialog"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">{footer}</footer>}
      </section>
    </div>
  );
}

function DeanDecisionModal({ pending, busy, onClose, onConfirm }) {
  const { item, decision, note } = pending;
  const label = decision === "approve" || decision === "review" ? "Approve current stage" : decision === "deny" ? "Deny request" : "Return for revision";
  return (
    <DeanDialog
      id={`dean-confirm-${item.type}-${item.id}`}
      title={`Confirm: ${label}`}
      subtitle={`${item.student?.name} · ${item.student?.student_number} · ${item.type}`}
      onClose={onClose}
      footer={<button type="button" disabled={busy} onClick={onConfirm} className={decision === "deny" ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}>{busy ? "Saving…" : label}</button>}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow movement</p><p className="mt-2 text-sm font-semibold text-ink">{item.workflow_status || item.status} <span className="mx-1 text-slate-300">→</span> {decision === "approve" || decision === "review" ? "Approved / reviewed" : decision === "deny" ? "Denied" : "Returned for revision"}</p></div>
        {note ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Recorded comment</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{note}</p></div> : <p className="text-sm text-slate-600">No optional comment was entered. A student-visible status notice will still be recorded.</p>}
      </div>
    </DeanDialog>
  );
}

function DeanExportModal({ pending, busy, onClose, onConfirm }) {
  return (
    <DeanDialog
      id="dean-confirm-registrar-handoff"
      title="Confirm Registrar handoff"
      subtitle={`${pending.count} Dean-approved graduation candidate${pending.count === 1 ? "" : "s"}`}
      onClose={onClose}
      footer={<button type="button" disabled={busy} onClick={onConfirm} className="btn-primary cursor-pointer px-4 py-2"><Download className="h-4 w-4" /> {busy ? "Exporting…" : "Export and mark sent"}</button>}
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This downloads the endorsed CSV and moves the selected records to Sent to Registrar. The handoff is recorded in workflow history.
      </div>
    </DeanDialog>
  );
}

function DeanGraduationBatchModal({ rows, templates, onClose, onSaved }) {
  const [form, setForm] = useState({ action: "approve", recipient_role: "Graduate School Staff", visibility: "internal", template: "Returned for revision. Please review the comments and resubmit.", comment: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (form.action === "return" && !form.comment.trim()) {
      setError("Enter one return reason for the selected candidates.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.graduationBatchAction({ student_ids: rows.map((item) => item.student.id), ...form });
      await onSaved(result);
    } catch (err) {
      setError(err.message || "Could not apply the Dean group action.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DeanDialog
      id="dean-graduation-batch"
      title="Confirm Dean graduation group action"
      subtitle={`${rows.length} selected candidate${rows.length === 1 ? "" : "s"} · backend stage checks apply to every record`}
      onClose={onClose}
      footer={<button type="submit" form="dean-graduation-batch-form" disabled={busy} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> {busy ? "Applying…" : "Apply group action"}</button>}
    >
      <form id="dean-graduation-batch-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Action</span><select value={form.action} onChange={update("action")} className="field-input cursor-pointer"><option value="approve">Approve selected candidates</option><option value="return">Return selected candidates to Graduate School staff</option><option value="note">Add an internal shared note</option></select></label>
        {form.action !== "approve" && <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Message template</span><select value={form.template} onChange={update("template")} className="field-input cursor-pointer">{templates.map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{form.action === "return" ? "Required reason" : "Optional Dean comment"}</span><textarea value={form.comment} onChange={update("comment")} required={form.action === "return" || (form.action === "note" && form.template === "Other / Custom comment")} className="field-input min-h-28" /></label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-ink">Selected candidates</p><ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{rows.map((item) => <li key={item.student.id}>{item.student.name} · {item.student.student_number}</li>)}</ul></div>
      </form>
    </DeanDialog>
  );
}

function DeanListFilters({ filters, setFilters, programs, statuses }) {
  const active = Object.entries(filters).filter(([key, value]) => Boolean(value) && !(key === "sort" && value === "newest")).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Card className="mb-4 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search Dean review lists</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search student, ID, or item…" aria-label="Search Dean review lists" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter Dean list by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter Dean list by stage or status"><option value="">All stages / statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated from</span><input type="date" value={filters.dateFrom} onChange={update("dateFrom")} className="field-input" /></label>
        <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated through</span><input type="date" value={filters.dateTo} onChange={update("dateTo")} className="field-input" /></label>
        <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Sort</span><select value={filters.sort} onChange={update("sort")} className="field-input cursor-pointer"><option value="newest">Newest updated</option><option value="oldest">Oldest updated</option><option value="student">Student name</option></select></label>
      </div>
      {active > 0 && <div className="mt-2 flex justify-end"><button type="button" onClick={() => setFilters({ query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" })} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button></div>}
    </Card>
  );
}

function WorkflowApprovalCard({ item, note, setNote, template, setTemplate, recipient, setRecipient, visibility, setVisibility, busy, onDecide, onMessage }) {
  const key = `${item.type}-${item.id}`;
  const isBusy = busy === key;
  const standingChange = ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  const approveLabel = item.type === "practicum" ? "Mark reviewed" : standingChange || item.type === "withdrawal" ? "Approve" : "Approve & send";
  const returnLabel = item.type === "withdrawal" ? "Return" : "Return for revision";
  const timeline = standingChange
    ? null
    : item.type === "practicum"
    ? (item.timeline || []).map((step) => ({ ...step, optional: ["Hours Incomplete", "Additional Certificates Requested"].includes(step.label) }))
    : item.type === "withdrawal"
      ? withdrawalTimelineSteps(item.workflow_status)
      : graduationTimelineSteps(item.status, item.eligibility || { eligible: true, coursework_status: "Complete" });
  const timelineTitle = standingChange
    ? ""
    : item.type === "practicum"
    ? "Practicum workflow timeline"
    : item.type === "withdrawal"
      ? "Withdrawal workflow timeline"
      : "Graduation endorsement timeline";
  const files = item.record?.attachments || [];
  const canDecide = (
    (item.type === "practicum" && item.status === "Report Sent to Dean")
    || (item.type === "withdrawal" && item.status === "Pending" && item.workflow_status === "Dean Review")
    || (item.type === "graduation" && item.status === "Ready for Dean Review")
    || (standingChange && item.workflow_status === "Dean Review")
  );
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
          <p className="text-sm text-slate-500">{item.subtitle} · submitted {formatDate(item.submitted_at)}</p>
        </div>
        <StatusBadge value={item.status} dot={false} />
      </div>
      <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
        {item.details}
      </p>
      {timeline && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <WorkflowTimeline steps={timeline} title={timelineTitle} />
      </div>}
      {files.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Submitted files</p>
          <ul className="mt-2 space-y-2">{files.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-ink">{file.name}</p><p className="text-xs text-slate-500">Uploaded by {file.uploaded_by || "Uploader not recorded"} ({file.uploaded_by_role || "role not recorded"}) · {formatDate(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p></div>{file.file_exists !== false ? <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5"><Eye className="h-3.5 w-3.5" /> View <ArrowUpRight className="h-3.5 w-3.5" /></a> : <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">File unavailable</span>}</li>)}</ul>
        </div>
      )}
      {item.messages?.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><MessageSquare className="h-4 w-4" /> Saved messages</p>
          <ul className="mt-2 space-y-2">{[...item.messages].reverse().map((message) => <li key={message.id} className="rounded-lg bg-slate-50 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">{message.template}</p><span className="flex flex-wrap gap-1.5"><StatusBadge value={message.visibility === "internal" ? "Internal" : "Student visible"} dot={false} /><StatusBadge value={message.status} dot={false} /></span></div><p className="mt-1 text-xs text-slate-500">{message.sender_name || message.sender_role} ({message.sender_role}) → {message.recipient_role} · {formatDate(message.created_at)}</p>{message.comment && <p className="mt-2 text-sm text-slate-600">{message.comment}</p>}</li>)}</ul>
        </div>
      )}
      {item.history?.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stage history · Request #{item.request_id || item.id}</p>
          <ol className="mt-2 space-y-2">{[...item.history].reverse().map((entry) => <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-semibold text-ink">{entry.result}</p><p className="mt-1 text-xs text-slate-500">{entry.actor_role}{entry.actor_user_id ? ` · User #${entry.actor_user_id}` : ""}{entry.action_type ? ` · ${entry.action_type}` : ""} · {entry.previous_status || "—"} → {entry.new_status || "—"} · {formatDate(entry.created_at)}</p>{entry.notes && <p className="mt-1 text-xs text-slate-600">{entry.notes}</p>}</li>)}</ol>
        </div>
      )}
      {!standingChange && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <select value={template[key] || ""} onChange={(e) => setTemplate((current) => ({ ...current, [key]: e.target.value }))} className="field-input cursor-pointer" aria-label="Clarification message template">
        <option value="">Optional message template</option>
        {CLARIFICATION_TEMPLATES.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={recipient[key] || "Graduate School Staff"} onChange={(e) => { const value = e.target.value; setRecipient((current) => ({ ...current, [key]: value })); setVisibility((current) => ({ ...current, [key]: value === "Student" ? "student_visible" : "internal" })); }} className="field-input cursor-pointer" aria-label="Message recipient">
        {["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Student"].map((role) => <option key={role}>{role}</option>)}
      </select>
      <select value={(recipient[key] || "Graduate School Staff") === "Student" ? "student_visible" : (visibility[key] || "internal")} onChange={(e) => setVisibility((current) => ({ ...current, [key]: e.target.value }))} disabled={(recipient[key] || "Graduate School Staff") === "Student"} className="field-input cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100" aria-label="Message visibility"><option value="internal">Internal reviewers only</option><option value="student_visible">Visible to student</option></select>
      <input
        value={note[key] || ""}
        onChange={(e) => setNote((n) => ({ ...n, [key]: e.target.value }))}
        placeholder={template[key] === "Other / Custom comment" ? "Enter a custom clarification message..." : "Comment or return reason..."}
        aria-label={`Comment or return reason for ${item.student?.name || item.title}`}
        className="field-input"
      />
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canDecide && (
          <>
            <button type="button" disabled={isBusy} onClick={() => onDecide(item, item.type === "practicum" ? "review" : "approve")} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" /> {approveLabel}
            </button>
            {(item.type === "withdrawal" || standingChange) && (
              <button type="button" disabled={isBusy} onClick={() => onDecide(item, "deny")} className="btn-ghost text-red-600">
                <AlertTriangle className="h-4 w-4" /> Deny
              </button>
            )}
            <button type="button" disabled={isBusy} onClick={() => onDecide(item, "return")} className="btn-ghost">
              <RotateCcw className="h-4 w-4" /> {returnLabel}
            </button>
          </>
        )}
        {!standingChange && <button type="button" disabled={busy === `message-${key}`} onClick={() => onMessage(item)} className="btn-ghost">
          <MessageSquare className="h-4 w-4" /> Add comment
        </button>}
        {!canDecide && (
          <span className="self-center text-xs font-semibold text-slate-500">
            No Dean decision is due at this stage.
          </span>
        )}
      </div>
    </Card>
  );
}

const DEAN_BOARD_COLUMNS = [
  "New / Submitted",
  "Pending Dean Review",
  "Returned for Revision",
  "Approved / Completed",
  "Rejected / Withdrawn",
];

function deanBoardGroup(item) {
  const workflowStatus = item.workflow_status || item.status;
  if (["Report Sent to Dean", "Ready for Dean Review", "Dean Review"].includes(workflowStatus)) return "Pending Dean Review";
  if (["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(item.status)
    || ["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(workflowStatus)) return "Returned for Revision";
  if (["Dean Approved", "Dean Reviewed", "Approved", "Sent to Registrar", "Registrar Received", "Withdrawn Confirmed"].includes(item.status)
    || ["Dean Approved", "Dean Reviewed", "Approved", "Sent to Registrar", "Registrar Received", "Withdrawn Confirmed"].includes(workflowStatus)) return "Approved / Completed";
  if (["Denied", "Rejected", "Cancelled"].includes(item.status) || ["Denied", "Rejected", "Cancelled"].includes(workflowStatus)) return "Rejected / Withdrawn";
  return "New / Submitted";
}

function DeanWorkflowBoard({ rows, onOpen, selectedIds, onToggle }) {
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-display text-lg font-semibold text-ink">Grouped workflow board</p><p className="text-xs text-slate-500">Open a card to review files, history, messages, and role-appropriate actions.</p></div><StatusBadge value={`${rows.length} requests`} dot={false} /></div>
      <div className="max-w-full overflow-x-auto pb-3">
        <div className="flex w-max snap-x gap-4">
        {DEAN_BOARD_COLUMNS.map((column) => {
          const items = rows.filter((item) => deanBoardGroup(item) === column);
          return (
            <section key={column} className="w-[285px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <header className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-700">{column}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span></header>
              <div className="space-y-3">{items.length ? items.map((item) => {
                const selectable = item.type === "graduation" && item.status === "Ready for Dean Review";
                return <article key={`${item.type}-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"><div className="flex items-start gap-2">{selectable && <input type="checkbox" checked={selectedIds.has(item.student.id)} onChange={() => onToggle(item.student.id)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${item.student.name} for Dean group action`} />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{item.student?.name || item.title}</p><p className="text-xs text-slate-400">{item.student?.student_number} · {item.student?.program_code}</p></div>{item.unresolved_messages > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{item.unresolved_messages}</span>}</div><div className="mt-3"><StatusBadge value={item.workflow_status || item.status} dot={false} /></div><p className="mt-2 text-xs text-slate-500">{item.type} · updated {formatDate(item.last_activity_at || item.submitted_at)}</p><button type="button" onClick={() => onOpen(item)} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 focus:ring-2 focus:ring-brand-500">View full request <Eye className="h-3.5 w-3.5" /></button></article>;
              }) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">No requests</p>}</div>
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}
