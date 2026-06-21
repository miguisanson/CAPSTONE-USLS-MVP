import { useEffect, useMemo, useState } from "react";
import { Gavel, LogOut, CheckCircle2, RotateCcw, AlertTriangle, Inbox, Clock, LayoutDashboard, Briefcase, GraduationCap, CalendarOff, BarChart3, Download, Search, SlidersHorizontal } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import RoleSidebar from "../components/RoleSidebar";

const DEAN_NAV = [
  { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
  { id: "practicum", label: "Practicum Reports", icon: Briefcase },
  { id: "graduation", label: "Graduation Review", icon: GraduationCap },
  { id: "withdrawal", label: "Withdrawal Requests", icon: LogOut },
  { id: "leave", label: "LOA / Readmission", icon: CalendarOff },
  { id: "reports", label: "Reports / Analytics", icon: BarChart3 },
];

export default function DeanApprovals() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.approvals(), []);
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState("");
  const [actErr, setActErr] = useState("");
  const [view, setView] = useState("overview");
  const [filters, setFilters] = useState({ query: "", program: "", status: "" });
  const workflowPending = data?.workflow_pending || [];
  const workflowRecent = data?.workflow_recent || [];
  const workflowOverview = data?.workflow_overview || [];
  const baseWorkflowPending = view === "overview" ? workflowPending : workflowPending.filter((item) => item.type === view);
  const baseWorkflowRecent = view === "overview" ? workflowRecent : workflowOverview.filter((item) => item.type === view);
  const matchesFilters = (item) => {
    const program = item.student?.program_code || item.program_code || "";
    const text = `${item.title || ""} ${item.subtitle || ""} ${item.student?.name || ""} ${item.student?.student_number || ""} ${program}`.toLowerCase();
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (!filters.program || program === filters.program)
      && (!filters.status || item.status === filters.status);
  };
  const visibleWorkflowPending = baseWorkflowPending.filter(matchesFilters);
  const visibleWorkflowRecent = baseWorkflowRecent.filter(matchesFilters);
  const pendingPlans = (data?.pending || []).filter(matchesFilters);
  const recentPlans = (data?.recent || []).filter(matchesFilters);
  const programs = useMemo(() => [...new Set([
    ...(data?.pending || []).map((item) => item.program_code),
    ...(data?.recent || []).map((item) => item.program_code),
    ...workflowOverview.map((item) => item.student?.program_code),
  ].filter(Boolean))].sort(), [data, workflowOverview]);
  const statuses = useMemo(() => [...new Set([
    ...(view === "overview" ? [...(data?.pending || []), ...workflowOverview] : workflowOverview.filter((item) => item.type === view)).map((item) => item.status),
  ].filter(Boolean))].sort(), [data, workflowOverview, view]);
  const approvedGraduation = workflowOverview.filter((item) => item.type === "graduation" && item.status === "Dean Approved" && matchesFilters(item));

  useEffect(() => {
    setFilters((current) => ({ ...current, status: "" }));
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

  async function decideWorkflow(item, decision) {
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideWorkflowApproval(item.type, item.id, { decision, note: note[key] || "" });
      setMsg(res.message);
      refetch();
    } catch (e) {
      setActErr(e.message);
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
      refetch();
    } catch (error) {
      setActErr(error.message || "Could not export the endorsed list.");
    } finally {
      setBusy(0);
    }
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

      <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold text-ink">Items awaiting your approval</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review what the Graduate School submitted, then approve or return it. Your decision is recorded against your account.
          </p>
        </div>

        <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
        {approvedGraduation.length > 0 && (view === "overview" || view === "graduation") && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-sm font-medium text-brand-800">{approvedGraduation.length} approved candidate{approvedGraduation.length === 1 ? " is" : "s are"} ready for Dean export and Registrar handoff.</p>
            <button type="button" disabled={String(busy).startsWith("export-")} onClick={() => exportApproved("", approvedGraduation.map((item) => item.id))} className="btn-primary"><Download className="h-4 w-4" /> Export filtered approved list</button>
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
                    busy={busy}
                    onDecide={decideWorkflow}
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
                      <span className="flex items-center gap-2"><StatusBadge value={item.status} dot={false} />{item.type === "graduation" && item.status === "Dean Approved" && <button type="button" disabled={busy === `export-${item.review_window}`} onClick={() => exportApproved(item.review_window, [item.id])} className="btn-ghost px-3 py-1.5"><Download className="h-3.5 w-3.5" /> Export</button>}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  );
}

function DeanListFilters({ filters, setFilters, programs, statuses }) {
  const active = Object.values(filters).filter(Boolean).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Card className="mb-4 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="relative block">
          <span className="sr-only">Search Dean review lists</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search student, ID, or item…" aria-label="Search Dean review lists" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter Dean list by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter Dean list by status"><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
      </div>
      {active > 0 && <div className="mt-2 flex justify-end"><button type="button" onClick={() => setFilters({ query: "", program: "", status: "" })} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button></div>}
    </Card>
  );
}

function WorkflowApprovalCard({ item, note, setNote, busy, onDecide }) {
  const key = `${item.type}-${item.id}`;
  const isBusy = busy === key;
  const approveLabel = item.type === "practicum" ? "Mark reviewed" : item.type === "withdrawal" ? "Approve" : "Approve & send";
  const returnLabel = item.type === "withdrawal" ? "Return" : "Return for revision";
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
      <input
        value={note[key] || ""}
        onChange={(e) => setNote((n) => ({ ...n, [key]: e.target.value }))}
        placeholder="Optional note to Graduate School staff..."
        className="field-input mt-3"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={isBusy} onClick={() => onDecide(item, item.type === "practicum" ? "review" : "approve")} className="btn-primary">
          <CheckCircle2 className="h-4 w-4" /> {approveLabel}
        </button>
        {item.type === "withdrawal" && (
          <button type="button" disabled={isBusy} onClick={() => onDecide(item, "deny")} className="btn-ghost text-red-600">
            <AlertTriangle className="h-4 w-4" /> Deny
          </button>
        )}
        <button type="button" disabled={isBusy} onClick={() => onDecide(item, "return")} className="btn-ghost">
          <RotateCcw className="h-4 w-4" /> {returnLabel}
        </button>
      </div>
    </Card>
  );
}
