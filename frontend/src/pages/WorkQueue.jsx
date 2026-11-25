import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ListTodo, AlertTriangle, Flag, CheckCircle2, ShieldCheck, RefreshCw, ArrowRight, ShieldAlert } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DataTable, EmptyState, Field, FilterBar, FilterSelect, InlineNotice, PageHeader, Pagination, SkeletonTable, StatCard, StatusChip, Textarea } from "../components/ui/index.js";
import { formatDate, relativeDays, SEVERITY } from "../lib/format";
import { useAuth } from "../auth";
import { PAGE, openPageLabel } from "../lib/labels.js";
import { officeOf, sortByUrgency, taskTarget } from "../lib/staffHome.js";
import { arrowLabel } from "../components/RoleHome.jsx";

const OWNERS = ["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean", "Student"];
const PAGE_SIZE = 200; // the most the tasks API returns; the rows are sorted like the home's list (UX-24)
const CONFLICT_ROLES = ["staff", "academic_coordinator"];
// UX-23 (Phase 4): whose tasks. Mine is the default; the home's "Needs your action" is its first rows (UX-24).
const VIEWS = [
  { key: "mine", label: "Mine" },
  { key: "others", label: "Waiting on others" },
  { key: "all", label: "All" },
];

export default function WorkQueue() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Suggested next steps come from the staff-only decision-support endpoint.
  const canSeeAtRisk = user?.role === "staff" || user?.role === "admin";
  const [tab, setTab] = useState(() => (searchParams.get("tab") === "at-risk" && canSeeAtRisk ? "at-risk" : "tasks"));
  const canSeeConflicts = CONFLICT_ROLES.includes(user?.role);
  // Research Coordinators cannot read conflicts (the server refuses), so do not ask.
  const conflicts = useApi(
    () => (canSeeConflicts ? api.monitoringConflicts({ status: "Open" }) : Promise.resolve({ items: [], summary: {} })),
    [canSeeConflicts],
  );
  const openConflicts = conflicts.data?.summary?.open_total ?? 0;

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.workQueue}
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={ListTodo}>Tasks</TabButton>
        {canSeeAtRisk && <TabButton active={tab === "at-risk"} onClick={() => setTab("at-risk")} icon={ShieldAlert}>At-risk students</TabButton>}
        {canSeeConflicts && <TabButton active={tab === "conflicts"} onClick={() => setTab("conflicts")} icon={Flag} badge={openConflicts}>Conflicts</TabButton>}
      </div>

      {tab === "at-risk" && canSeeAtRisk ? <AtRiskPanel /> : tab === "conflicts" && canSeeConflicts ? <ConflictsPanel state={conflicts} /> : <TasksPanel user={user} />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge > 0 && (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold ${active ? "bg-brand-600 text-white" : "bg-amber-100 text-amber-700"}`}>{badge}</span>
      )}
    </button>
  );
}

// One row per flagged student with the single next step the system recommends
// (the highest-scoring recommendation). The system suggests; people decide.
function AtRiskPanel() {
  const { data, loading, error } = useApi(() => api.decisionSupport(), []);
  const [severity, setSeverity] = useState("");

  const students = useMemo(() => {
    const byStudent = new Map();
    for (const item of data?.items || []) {
      const entry = byStudent.get(item.student_id);
      if (!entry) byStudent.set(item.student_id, { ...item, others: 0 });
      else entry.others += 1;
    }
    return [...byStudent.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [data]);
  const shown = students.filter((row) => !severity || row.severity === severity);
  const counts = { high: 0, medium: 0, low: 0 };
  students.forEach((row) => { counts[row.severity] = (counts[row.severity] || 0) + 1; });

  if (loading) return <SkeletonTable />;
  if (error) return <InlineNotice tone="danger" title="Could not load at-risk students">{error}</InlineNotice>;

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={severity === ""} onClick={() => setSeverity("")}>All flagged ({students.length})</FilterChip>
        {["high", "medium", "low"].filter((key) => counts[key] > 0).map((key) => (
          <FilterChip key={key} active={severity === key} onClick={() => setSeverity(key)}>{SEVERITY[key].label} priority ({counts[key]})</FilterChip>
        ))}
      </div>
      <p className="meta">
        Students who are delayed, stalled, overdue or missing documents. Each row shows the one next step to take; open the student to see every flag.
      </p>
      <DataTable
        caption="Students flagged as at risk, with the suggested next step for each"
        columns={AT_RISK_COLUMNS}
        rows={shown}
        rowKey="student_id"
        minWidth="md"
        pageSize={0}
        empty={{ icon: CheckCircle2, title: "No students flagged", hint: "Nobody needs a follow-up right now." }}
      />
    </div>
  );
}

// Priority chip tone: the server's severity words stand in for the status words.
const SEVERITY_TONE = { high: "bad", medium: "warn", low: "good" };

const AT_RISK_COLUMNS = [
  {
    key: "student_name",
    header: "Student",
    cell: (row) => (
      <>
        <p className="font-semibold text-ink">{row.student_name}</p>
        <p className="meta">{row.program_code} · {row.stage}</p>
      </>
    ),
  },
  {
    key: "severity",
    header: "Priority",
    cell: (row) => {
      const sev = SEVERITY[row.severity] || SEVERITY.low;
      return <StatusChip status={sev.label} tone={SEVERITY_TONE[row.severity] || "good"} />;
    },
  },
  {
    key: "recommendation",
    header: "Suggested next step",
    cell: (row) => (
      <>
        <p className="font-semibold text-ink">{row.recommendation}</p>
        <p className="meta mt-0.5">Why: {row.trigger}{row.others > 0 ? ` · ${row.others} more flag${row.others === 1 ? "" : "s"}` : ""}</p>
      </>
    ),
  },
  { key: "owner", header: "Owner" },
  {
    key: "open",
    header: <span className="sr-only">Open</span>,
    align: "right",
    cell: (row) => (
      <Link to={`/students/${row.student_id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
        {openPageLabel(`/students/${row.student_id}`)} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    ),
  },
];

function TasksPanel({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const office = officeOf(user?.role);
  // Old links: ?owner=<this office> is Mine, ?owner= (empty) is All, ?owner=<another office> is Waiting on others for it.
  const [view, setView] = useState(() => {
    const asked = searchParams.get("view");
    if (VIEWS.some((v) => v.key === asked)) return asked;
    if (!searchParams.has("owner")) return "mine";
    const owner = searchParams.get("owner");
    return owner === "" ? "all" : owner === office ? "mine" : "others";
  });
  const [owner, setOwner] = useState(() => {
    const asked = searchParams.get("owner") || "";
    return asked && asked !== office ? asked : "";
  });
  const [status, setStatus] = useState(searchParams.get("status") || "");
  // ?q= pre-fills the search box (the staff home's grouped alert row links here with the alert's title)
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(1);
  const params = view === "mine" ? { owner: office } : view === "others" ? { not_owner: office, owner } : { owner };
  const { data, loading, error } = useApi(() => api.tasks({ ...params, status, page, page_size: PAGE_SIZE }), [view, owner, status, page]);
  const items = data?.items || [];
  const total = data?.total ?? items.length;
  const currentPage = data?.page || page;
  const pageSize = data?.page_size || PAGE_SIZE;
  const pages = data?.pages || Math.max(1, Math.ceil(total / pageSize));
  const filtered = sortByUrgency(items.filter((task) => `${task.title} ${task.student_name || ""} ${task.owner_role}`.toLowerCase().includes(query.toLowerCase())));
  const canOpenStudent = CONFLICT_ROLES.includes(user?.role);
  const yours = (task) => String(task.owner_role || "").trim() === office;

  const columns = [
    { key: "title", header: "Task", sortValue: (task) => task.title, cell: (task) => <span className={yours(task) ? "font-semibold text-ink" : "font-medium"}>{task.title}</span> },
    // IM50: on Mine every row is this office's, so the Owner column would say the same thing on every row
    ...(view === "mine" ? [] : [{ key: "owner_role", header: "Owner" }]),
    {
      key: "student_name",
      header: "Student",
      sortValue: (task) => task.student_name || "",
      cell: (task) =>
        !task.student_id ? null : canOpenStudent ? (
          <Link to={`/students/${task.student_id}`} className="font-semibold text-brand-700 hover:underline">{task.student_name}</Link>
        ) : (
          <span className="font-semibold">{task.student_name}</span>
        ),
    },
    {
      key: "due_at",
      header: "Due",
      sortValue: (task) => task.due_at || "",
      cell: (task) => (
        // UX-13: "Overdue since <date>" in red says it once; no second Overdue chip
        task.overdue
          ? <span className="font-semibold text-red-700">Overdue since {formatDate(task.due_at)}</span>
          : <>{formatDate(task.due_at)} <span className="text-slate-500">· {relativeDays(task.due_at)}</span></>
      ),
    },
    {
      key: "action",
      header: <span className="sr-only">Open</span>,
      align: "right",
      cell: (task) => <ActionCell task={task} role={user?.role} />,
    },
  ];

  function update(next) {
    const merged = { view, owner, status, ...next };
    setView(merged.view);
    setOwner(merged.view === "mine" ? "" : merged.owner || "");
    setStatus(merged.status || "");
    setPage(1);
    const search = { view: merged.view };
    if (merged.view !== "mine" && merged.owner) search.owner = merged.owner;
    if (merged.status) search.status = merged.status;
    if (query) search.q = query;
    setSearchParams(search, { replace: true });
  }
  const ownerChoices = OWNERS.filter((o) => view !== "others" || o !== office);

  return (
    <div className="page-stack">
      <div role="tablist" aria-label="Whose tasks" className="inline-flex w-fit flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => update({ view: v.key, owner: "" })}
            className={`min-h-9 cursor-pointer rounded-lg px-3 text-sm font-semibold transition ${view === v.key ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: "Task, student or owner", label: "Search work queue" }}
        active={[query, view !== "mine" && owner, status].filter(Boolean).length}
        onClear={() => { setQuery(""); update({ owner: "", status: "" }); }}
        chips={<FilterChip active={status === "Overdue"} onClick={() => update({ status: status === "Overdue" ? "" : "Overdue" })}>Overdue only</FilterChip>}
      >
        {view !== "mine" && (
          <FilterSelect
            label="Office"
            value={owner}
            onChange={(event) => update({ owner: event.target.value })}
            aria-label="Filter by office"
            placeholder={view === "others" ? "Every other office" : "Every office"}
            options={ownerChoices}
          />
        )}
      </FilterBar>

      {error ? (
        <InlineNotice tone="danger" title="Could not load tasks">{error}</InlineNotice>
      ) : (
        <DataTable
          caption="Open and recent tasks"
          columns={columns}
          rows={filtered}
          rowKey="id"
          loading={loading}
          pageSize={0}
          stackOnPhone // a phone shows each task as a card, the arrow in reach (no sideways scroll)
          // finding 15: a header click sorts; until then the rows keep the home's order (most urgent first)
          // UX-23: a task another office holds is greyed; the Owner column says who holds it
          rowProps={(task) => (yours(task) ? {} : { "data-not-yours": "true", className: "text-slate-500" })}
          empty={{ icon: ListTodo, title: "No tasks match the selected filters" }}
        />
      )}

      {!loading && !error && total > 0 && (
        <Pagination page={currentPage} pageCount={pages} total={total} pageSize={pageSize} shown={items.length} onPage={setPage} noun={total === 1 ? "task" : "tasks"} />
      )}
    </div>
  );
}

// UX-23 (owner 2026-11-20): the task's title says what to do, so the link is an arrow named for screen readers, as on
// the home. A Dean task has a Dean-only page the other roles cannot open, so it has no arrow; the Owner column says who.
function ActionCell({ task, role }) {
  const owner = String(task.owner_role || "").trim();
  let target = null;
  if (task.action_url) target = { to: task.action_url, label: openPageLabel(task.action_url, task.action_label || "Open") };
  else if (owner !== "Dean" && owner !== "Student") {
    const page = taskTarget(task, role);
    if (page.to.split("?")[0] !== "/work-queue") target = page;
  }
  if (!target) return null;
  const name = arrowLabel(target.label, task.title);
  return (
    <Link
      to={target.to}
      aria-label={name}
      title={name}
      className="inline-grid h-9 w-9 place-items-center rounded-lg text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:h-11 max-sm:w-11"
    >
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function ConflictsPanel({ state }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = state;
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const canResolve = user?.role === "staff" || user?.role === "academic_coordinator";

  const items = data?.items || [];
  const summary = data?.summary || { open_total: 0, auto_resolvable: 0, needs_action: 0 };

  async function resolve(item) {
    setBusy(true);
    setActionError("");
    try {
      await api.resolveMonitoringFlag(item.student_id, item.id, { resolution_note: note });
      setResolvingId(null);
      setNote("");
      await refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SkeletonTable />;
  if (error) return <InlineNotice tone="danger" title="Could not load conflicts">{error}</InlineNotice>;

  return (
    <div className="page-stack">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Flag} label="Open conflicts" value={summary.open_total} tone="neutral" />
        <StatCard icon={ShieldCheck} label="Auto-resolve on re-import" value={summary.auto_resolvable} tone="success" />
        <StatCard icon={AlertTriangle} label="Need coordinator action" value={summary.needs_action} tone="warning" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="meta">Source-correctable conflicts clear automatically after a corrected monitoring sheet is re-imported. The rest need coordinator review.</p>
        <Button variant="secondary" icon={RefreshCw} onClick={refetch} className="shrink-0">Refresh</Button>
      </div>

      {items.length === 0 ? (
        <Card pad="none" className="overflow-hidden"><EmptyState icon={CheckCircle2} title="No open conflicts" hint="Every flagged discrepancy has been resolved." /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{item.category}</span>
                    {item.auto_resolvable ? (
                      <StatusChip
                        status="Auto-resolves on re-import"
                        tone="good"
                        dot={false}
                        label={<><ShieldCheck className="h-3 w-3" aria-hidden="true" /> Auto-resolves on re-import</>}
                      />
                    ) : (
                      <StatusChip
                        status="Needs coordinator action"
                        tone="warning"
                        dot={false}
                        label={<><Flag className="h-3 w-3" aria-hidden="true" /> Needs coordinator action</>}
                      />
                    )}
                    {item.system_generated && <StatusChip status="System" tone="muted" dot={false} />}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {CONFLICT_ROLES.includes(user?.role) ? (
                      <Link to={`/students/${item.student_id}`} className="text-brand-700 hover:underline">{item.student_name}</Link>
                    ) : (
                      <span>{item.student_name}</span>
                    )}
                    <span className="text-slate-500"> · {item.student_number} · {item.program_code}</span>
                  </p>
                  <p className="meta mt-0.5 font-medium">On: {item.target_label || "Whole record"}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  <p className="meta mt-1">{item.source} · {item.created_by} · {formatDate(item.created_at)}</p>
                </div>
                {canResolve && resolvingId !== item.id && (
                  <Button variant="secondary" icon={CheckCircle2} className="shrink-0" onClick={() => { setResolvingId(item.id); setNote(""); setActionError(""); }}>
                    Resolve
                  </Button>
                )}
              </div>
              {resolvingId === item.id && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <Field label="How was this resolved?">
                    <Textarea
                      className="min-h-24 resize-y"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Describe the corrected source, advising outcome, or verified resolution."
                    />
                  </Field>
                  {actionError && <InlineNotice tone="danger">{actionError}</InlineNotice>}
                  <div className="flex flex-wrap gap-2">
                    <Button icon={CheckCircle2} loading={busy} disabled={!note.trim()} onClick={() => resolve(item)}>
                      {busy ? "Saving…" : "Resolve conflict"}
                    </Button>
                    <Button variant="secondary" onClick={() => { setResolvingId(null); setNote(""); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// A toggle chip: pressed = the primary look, not pressed = the secondary look (the library Button, small size).
function FilterChip({ active, onClick, children }) {
  return (
    <Button size="sm" variant={active ? "primary" : "secondary"} aria-pressed={active} onClick={onClick}>
      {children}
    </Button>
  );
}
