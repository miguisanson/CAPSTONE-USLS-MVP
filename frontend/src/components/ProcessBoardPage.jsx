import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, History, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatDateTime } from "../lib/format";
import { Card, EmptyState, ErrorNote, Spinner } from "./ui";
import PolicyRules from "./PolicyRules";
import StageBoard from "./StageBoard";
import { GUIDES, PROCESS_CONFIG } from "./processConfig";
import ActionDialog from "../pages/leave/ActionDialog";
import BatchBar, { BatchResult } from "../pages/leave/BatchBar";
import CaseCard, { CaseTable } from "../pages/leave/CaseCard";
import CaseDetailModal from "../pages/leave/CaseDetailModal";
import LeaveFilters, { ViewToggle } from "../pages/leave/LeaveFilters";
import ModalShell from "../pages/leave/ModalShell";
import { Banner } from "../pages/leave/leaveUi";
import {
  EMPTY_FILTERS,
  actionsIntoColumn,
  batchActionsOf,
  checkMoveFor,
  commonBatchActions,
  matchesFilters,
  plural,
} from "../pages/leave/leaveHelpers";

const getItemId = (item) => item.id;
const NO_ACTIONS = [];

function GuideWindow({ slug, policyQuestions, onClose }) {
  const guide = GUIDES[slug];
  const Line = ({ label, children }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
  return (
    <ModalShell
      id={`${slug}-guide`}
      size="wide"
      title={`How ${PROCESS_CONFIG[slug].title} works`}
      subtitle="A short guide for students and reviewers"
      onClose={onClose}
      closeLabel="Close the guide"
      footer={<button type="button" onClick={onClose} className="btn-ghost px-4 py-2">Close</button>}
    >
      {guide && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Line label="Purpose">{guide.purpose}</Line>
            <Line label="Who submits">{guide.submitter}</Line>
            <Line label="Who reviews">{guide.reviewers}</Line>
            <Line label="When something is incomplete">{guide.incomplete}</Line>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Main stages</p>
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {guide.stages.map((stage, index) => (
                <li key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs text-brand-700">{index + 1}</span>
                  {stage}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            <span className="font-semibold">What completion means: </span>
            {guide.final}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            <span className="font-semibold">Moving a card: </span>
            drag it to the next column, or use &quot;Move to...&quot; on the card. Both do exactly what the buttons in the request window do, and the server refuses a move the rules do not allow.
          </div>
          {policyQuestions.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Admin note · confirm with Sir De Paula / GS office before production</p>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
                {policyQuestions.map((question) => <li key={question}>• {question}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function ActivityWindow({ logs, onClose }) {
  return (
    <ModalShell
      id="process-activity"
      size="wide"
      title="Recent activity"
      subtitle="A timestamped trail of the latest steps and handoffs in this process"
      onClose={onClose}
      closeLabel="Close recent activity"
      footer={<button type="button" onClick={onClose} className="btn-ghost px-4 py-2">Close</button>}
    >
      {!logs.length ? (
        <EmptyState title="No activity yet" hint="New filings, messages and decisions will appear here." />
      ) : (
        <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
          {logs.map((log) => (
            <li key={log.id} className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <span className="absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{log.result}</p>
                <time className="text-xs text-slate-400" dateTime={log.created_at || undefined}>{formatDateTime(log.created_at)}</time>
              </div>
              <p className="mt-1 text-xs text-slate-500">{log.actor_role}{log.student_name ? ` · ${log.student_name}` : ""}</p>
              {(log.previous_status || log.new_status) && (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {log.previous_status || "-"} <span className="mx-1 text-slate-300">to</span> {log.new_status || "-"}
                </p>
              )}
              {log.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{log.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </ModalShell>
  );
}

/**
 * The one page template for a standalone process (Leave of Absence, Readmission,
 * AWOL & Residency, Withdrawal), for Graduate School staff and for the Dean.
 *
 * The four pages are this component with a different `slug`: same header (title, one line,
 * "How this works", recent activity), same rules panel, same toolbar (search, program,
 * status, Board/Table), same staged board with real drag and drop, "Move to..." and group
 * steps, same request window, same Registrar follow-up block. A process only brings its
 * stages, steps and card fields (from the server) and a few extras (processConfig.jsx).
 *
 * Every move, from every place, goes through `submitTransition`, which makes the one
 * guarded call (api.processCaseTransition). The server refuses anything illegal again.
 */
export default function ProcessBoardPage({ slug, onChanged = null }) {
  const config = PROCESS_CONFIG[slug];
  const { user } = useAuth();
  const role = user?.role || "";
  const isStaff = role === "staff" || role === "admin"; // an administrator acts as Graduate School staff
  const Icon = config.icon;

  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [view, setView] = useState("board");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [detailId, setDetailId] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [dialog, setDialog] = useState(null); // { item, action, detail }
  const [banner, setBanner] = useState(null); // { tone, text }
  const [batchResult, setBatchResult] = useState(null);
  const [signal, setSignal] = useState(null); // an extra window a step opens instead of a confirm box
  const [support, setSupport] = useState(""); // "guide" | "activity"

  // Answers that arrive after the process changed are ignored.
  const currentSlug = useRef(slug);
  currentSlug.current = slug;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const res = await api.processCases(slug);
        if (currentSlug.current !== slug) return null;
        setState({ data: res, loading: false, error: "" });
        return res;
      } catch (error) {
        if (currentSlug.current !== slug) return null;
        setState((current) => ({ ...current, loading: false, error: error.message || "The requests could not be loaded." }));
        return null;
      }
    },
    [slug],
  );

  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: "" });
    setSelected(new Set());
    setDetailId(null);
    setDialog(null);
    setBanner(null);
    setBatchResult(null);
    setSignal(null);
    setFilters(EMPTY_FILTERS);
    (async () => {
      await load({ quiet: true });
      if (active && config.afterOpen) await config.afterOpen({ isStaff, reload: () => load({ quiet: true }) });
    })();
    return () => {
      active = false;
    };
  }, [slug, isStaff, load, config]);

  const data = state.data;
  const vocabulary = data?.vocabulary;
  const cases = useMemo(() => data?.cases || [], [data]);
  const columns = useMemo(() => vocabulary?.columns?.[slug] || [], [vocabulary, slug]);

  const columnKeyByStatus = useMemo(() => {
    const map = {};
    columns.forEach((column) => column.statuses.forEach((status) => (map[status] = column.key)));
    return map;
  }, [columns]);
  const getColumnKey = useCallback((item) => columnKeyByStatus[item.status] || "other", [columnKeyByStatus]);

  const filtered = useMemo(() => cases.filter((item) => matchesFilters(item, filters)), [cases, filters]);

  const totals = useMemo(() => {
    const result = {};
    cases.forEach((item) => {
      const key = columnKeyByStatus[item.status] || "other";
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }, [cases, columnKeyByStatus]);

  const statusOptions = useMemo(() => {
    const seen = new Map();
    cases.forEach((item) => seen.set(item.status, item.status_label));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [cases]);
  const kindOptions = useMemo(() => {
    const seen = new Map();
    cases.forEach((item) => seen.set(item.kind, item.kind_label));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [cases]);

  // Cards that can be moved as a group: the server marks those steps `batch`.
  const selectableIds = useMemo(
    () => new Set(filtered.filter((item) => batchActionsOf(item).length).map((item) => item.id)),
    [filtered],
  );
  const selectedItems = useMemo(
    () => cases.filter((item) => selected.has(item.id) && batchActionsOf(item).length),
    [cases, selected],
  );
  const groupActions = useMemo(() => commonBatchActions(selectedItems), [selectedItems]);

  const summaryLine = useMemo(() => {
    const parts = columns
      .filter((column) => (totals[column.key] || 0) > 0)
      .map((column) => `${totals[column.key]} ${column.label.toLowerCase()}`);
    return parts.length ? parts.join(", ") : `No ${config.noun} yet`;
  }, [columns, totals, config.noun]);

  // ---- the one guarded step behind every button, menu choice and drop ----------------
  const submitTransition = useCallback(
    async (item, payload) => {
      const result = await api.processCaseTransition(slug, item.id, payload);
      await load({ quiet: true });
      setDetailVersion((value) => value + 1);
      if (onChanged) await onChanged();
      return result;
    },
    [slug, load, onChanged],
  );

  // A step either opens its confirm box or, for a few (like exporting a file), a window of its own.
  const runAction = useCallback((item, action, detail = null) => {
    if (action.opens) setSignal({ type: action.opens, item });
    else setDialog({ item, action, detail });
  }, []);

  async function confirmDialog(payload) {
    const current = dialog;
    const result = await submitTransition(current.item, payload);
    setDialog(null);
    setBanner({ tone: "success", text: `${current.item.student.name}: ${result.message || "Done."}` });
  }

  const checkMove = useCallback((item, column) => checkMoveFor(item, column, vocabulary), [vocabulary]);

  const onMove = useCallback(
    async (item, toColumn) => {
      const action = actionsIntoColumn(item, toColumn)[0];
      if (!action) throw new Error(checkMoveFor(item, toColumn, vocabulary).reason || "That move is not allowed.");
      if (action.action === "start_review") {
        const result = await submitTransition(item, { action: action.action });
        return { message: `${item.student.name}: ${result.message || "Review started."}` };
      }
      runAction(item, action);
      return undefined;
    },
    [submitTransition, runAction, vocabulary],
  );

  // ---- selection and group steps -----------------------------------------------------
  function toggleSelect(item) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function setMany(items, on) {
    setSelected((current) => {
      const next = new Set(current);
      items.forEach((item) => (on ? next.add(item.id) : next.delete(item.id)));
      return next;
    });
  }

  async function runBatch(action, { batchName, comment }) {
    setBatchResult(null);
    try {
      const result = await api.processCasesBatch(slug, {
        case_ids: selectedItems.map((item) => item.id),
        action: action.action,
        batch_name: batchName || undefined,
        comment: comment || undefined,
      });
      setBatchResult(result);
      setSelected(new Set());
      await load({ quiet: true });
      setDetailVersion((value) => value + 1);
      if (onChanged) await onChanged();
    } catch (error) {
      setBatchResult({ updated: [], skipped: [], message: error.message || "The group step was refused." });
    }
  }

  // ---- board pieces ------------------------------------------------------------------
  const renderCard = useCallback(
    (item) => (
      <CaseCard
        item={item}
        role={role}
        selectable={batchActionsOf(item).length > 0}
        selected={selected.has(item.id)}
        onToggleSelect={toggleSelect}
        onOpen={(row) => setDetailId(row.id)}
      />
    ),
    [role, selected],
  );

  const renderColumnHeader = useCallback(
    (column, columnItems) => {
      const total = totals[column.key] || 0;
      const filteredOut = columnItems.length !== total;
      return (
        <header className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
            <span
              className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200"
              aria-label={filteredOut ? `${columnItems.length} shown of ${total}` : `${plural(total, "request")}`}
            >
              {filteredOut ? `${columnItems.length} of ${total}` : total}
            </span>
          </div>
          {column.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{column.description}</p>}
        </header>
      );
    },
    [totals],
  );

  const renderColumnFooter = useCallback(
    (column, columnItems) => {
      if (!columnItems.length || !columnItems.every((item) => batchActionsOf(item).length)) return null;
      const allOn = columnItems.every((item) => selected.has(item.id));
      return (
        <button
          type="button"
          onClick={() => setMany(columnItems, !allOn)}
          className="mt-3 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {allOn ? "Clear selection in this column" : "Select all in this column"}
        </button>
      );
    },
    [selected],
  );

  // ---- extras a process brings ---------------------------------------------------------
  const ctx = {
    slug,
    role,
    isStaff,
    cases,
    data,
    reload: () => load({ quiet: true }),
    openDetail: (item) => setDetailId(item.id),
    runAction,
    banner: (tone, text) => setBanner({ tone, text }),
    signal,
    clearSignal: () => setSignal(null),
  };
  const HeaderActions = config.HeaderActions;
  const AboveBoard = config.AboveBoard;
  const BelowBoard = config.BelowBoard;

  // ---- states ------------------------------------------------------------------------
  if (state.loading && !data) return <Spinner label="Loading requests..." />;
  if (!data) {
    return (
      <div className="space-y-3">
        <ErrorNote message={state.error || "The requests could not be loaded."} />
        <button type="button" onClick={() => load()} className="btn-ghost px-4 py-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header: the same in every process */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{config.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto sm:justify-end">
            <button type="button" onClick={() => setSupport("guide")} className="btn-ghost cursor-pointer px-3 py-2">
              <HelpCircle className="h-4 w-4" /> How this works
            </button>
            <button type="button" onClick={() => setSupport("activity")} className="btn-ghost cursor-pointer px-3 py-2">
              <History className="h-4 w-4" /> View recent activity
            </button>
          </div>
        </div>
      </Card>

      <PolicyRules process={config.rulesProcess} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink" aria-live="polite">
            {summaryLine}
          </p>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Dragging a card to another column does the same as the buttons in its request window. On a keyboard or phone, use
            &quot;Move to...&quot; on the card.
          </p>
        </div>
        {HeaderActions && <div className="flex flex-wrap gap-2"><HeaderActions ctx={ctx} /></div>}
      </div>

      {state.error && <ErrorNote message={state.error} />}
      {banner && (
        <Banner tone={banner.tone} onDismiss={() => setBanner(null)}>
          {banner.text}
        </Banner>
      )}

      {AboveBoard && <AboveBoard ctx={ctx} />}

      {cases.length === 0 ? (
        <EmptyState title={config.emptyTitle} hint={config.emptyHint} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <LeaveFilters
                filters={filters}
                setFilters={setFilters}
                programs={data.programs || []}
                statusOptions={statusOptions}
                reasons={data.reasons || []}
                kindOptions={kindOptions}
                count={filtered.length}
                total={cases.length}
                noun={config.noun}
              />
            </div>
            <ViewToggle value={view} onChange={setView} />
          </div>

          {selectedItems.length > 0 && (
            <BatchBar
              selectedItems={selectedItems}
              slug={slug}
              actions={groupActions}
              nameBatches={Boolean(config.nameBatches)}
              onClear={() => setSelected(new Set())}
              onSubmit={runBatch}
            />
          )}
          <BatchResult result={batchResult} onDismiss={() => setBatchResult(null)} />

          {view === "board" ? (
            <StageBoard
              columns={columns}
              items={filtered}
              getItemId={getItemId}
              getColumnKey={getColumnKey}
              renderCard={renderCard}
              canDrag={(item) => (item.actions || NO_ACTIONS).length > 0}
              checkMove={checkMove}
              onMove={onMove}
              renderColumnHeader={renderColumnHeader}
              renderColumnFooter={renderColumnFooter}
              emptyText={`No ${config.noun} here`}
              columnClassName="w-[300px]"
              ariaLabel={config.boardLabel}
            />
          ) : filtered.length ? (
            <CaseTable
              items={filtered}
              role={role}
              selectableIds={selectableIds}
              selectedIds={selected}
              onToggle={toggleSelect}
              onToggleAll={setMany}
              onOpen={(item) => setDetailId(item.id)}
            />
          ) : (
            <EmptyState title={`No ${config.noun} match these filters`} hint="Clear a filter to see more." />
          )}
        </>
      )}

      {BelowBoard && <BelowBoard ctx={ctx} />}

      {detailId !== null && (
        <CaseDetailModal
          caseId={detailId}
          slug={slug}
          vocabulary={vocabulary}
          version={detailVersion}
          onClose={() => setDetailId(null)}
          onAction={(detail, action) => runAction(detail, action, detail)}
          onTransition={async (item, payload) => {
            const result = await submitTransition(item, payload);
            setBanner({ tone: "success", text: `${item.student.name}: ${result.message || "Done."}` });
            return result;
          }}
          onNoteSent={async () => {
            await load({ quiet: true });
            setDetailVersion((value) => value + 1);
          }}
        />
      )}

      {dialog && (
        <ActionDialog
          key={`${dialog.item.id}-${dialog.action.action}`}
          item={dialog.item}
          action={dialog.action}
          detail={dialog.detail}
          vocabulary={vocabulary}
          onCancel={() => setDialog(null)}
          onConfirm={confirmDialog}
        />
      )}

      {support === "guide" && <GuideWindow slug={slug} policyQuestions={data.policy_questions || []} onClose={() => setSupport("")} />}
      {support === "activity" && <ActivityWindow logs={data.recent_activity || []} onClose={() => setSupport("")} />}
    </div>
  );
}
