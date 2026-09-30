import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorNote, Spinner } from "../components/ui";
import StageBoard from "../components/StageBoard";
import ActionDialog from "./leave/ActionDialog";
import BatchBar, { BatchResult } from "./leave/BatchBar";
import CaseCard, { CaseTable } from "./leave/CaseCard";
import CaseDetailModal from "./leave/CaseDetailModal";
import FollowUpStrip from "./leave/FollowUpStrip";
import LeaveFilters, { ViewToggle } from "./leave/LeaveFilters";
import RegistrarPanel from "./leave/RegistrarPanel";
import { Banner } from "./leave/leaveUi";
import {
  EMPTY_FILTERS,
  actionsIntoColumn,
  batchForwardAction,
  checkMoveFor,
  matchesFilters,
  syncSummary,
} from "./leave/leaveHelpers";

const getItemId = (item) => item.id;

/**
 * Graduate School staff screen for Leave of Absence and Readmission requests:
 * a staged board (drag and drop or "Move to..."), the same steps as buttons in the
 * request window, a batch step, leave follow-ups and the Registrar list.
 * Every move, from every place, ends in api.leaveCaseTransition (or the batch call).
 */
export default function LeaveCasesBoard({ slug }) {
  const { user } = useAuth();
  const role = user?.role || "";
  const isStaff = role === "staff" || role === "admin"; // an administrator acts as Graduate School staff
  const readmission = slug === "readmission";

  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [view, setView] = useState("board");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [detailId, setDetailId] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [dialog, setDialog] = useState(null); // { item, action, detail }
  const [banner, setBanner] = useState(null); // { tone, text }
  const [batchResult, setBatchResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Answers that arrive after the workflow changed are ignored.
  const currentSlug = useRef(slug);
  currentSlug.current = slug;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const res = await api.leaveCases(slug);
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

  // When the screen opens (or the workflow changes): load, then let the server update any
  // leave dates once, and load again only if something changed.
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: "" });
    setSelected(new Set());
    setDetailId(null);
    setDialog(null);
    setBanner(null);
    setBatchResult(null);
    setFilters(EMPTY_FILTERS);
    (async () => {
      await load({ quiet: true });
      if (!active || !isStaff) return;
      try {
        const result = await api.syncLeaveCases();
        if (active && syncSummary(result).changed) await load({ quiet: true });
      } catch {
        // The dates are only a convenience here; the board still works without them.
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, isStaff, load]);

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

  const selectableIds = useMemo(
    () => new Set(filtered.filter((item) => batchForwardAction(item)).map((item) => item.id)),
    [filtered],
  );
  // Only requests that are still there and still forwardable count as selected.
  const selectedItems = useMemo(
    () => cases.filter((item) => selected.has(item.id) && batchForwardAction(item)),
    [cases, selected],
  );

  const summaryLine = useMemo(() => {
    const count = (...statuses) => cases.filter((item) => statuses.includes(item.status)).length;
    const parts = [
      [count("Submitted", "Staff Review"), "to review"],
      [count("Returned"), "with the student"],
      [count("Dean Review"), "with the Dean"],
      [count("Leave Scheduled"), "leave scheduled"],
      [count("On Leave"), "on leave"],
      [count("Return Due"), "return due"],
      [count("Approved"), readmission ? "back in the program" : "approved extension"],
    ]
      .filter(([number]) => number > 0)
      .map(([number, label]) => `${number} ${label}`);
    return parts.length ? parts.join(", ") : `No ${readmission ? "readmission" : "leave"} requests yet`;
  }, [cases, readmission]);

  // ---- the one guarded step behind every button, menu choice and drop ----------------
  const submitTransition = useCallback(
    async (item, payload) => {
      const result = await api.leaveCaseTransition(item.id, payload);
      await load({ quiet: true });
      setDetailVersion((value) => value + 1);
      return result;
    },
    [load],
  );

  const openAction = useCallback((item, action, detail = null) => {
    setDialog({ item, action, detail });
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
      openAction(item, action);
      return undefined;
    },
    [submitTransition, openAction, vocabulary],
  );

  // ---- selection and batch -----------------------------------------------------------
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

  async function runBatch(batchName) {
    setBatchResult(null);
    try {
      const result = await api.leaveCasesBatch({
        case_ids: selectedItems.map((item) => item.id),
        action: "forward",
        batch_name: batchName || undefined,
      });
      setBatchResult(result);
      setSelected(new Set());
      await load({ quiet: true });
      setDetailVersion((value) => value + 1);
    } catch (error) {
      setBatchResult({ updated: [], skipped: [], message: error.message || "The batch step was refused." });
    }
  }

  async function refreshDates() {
    setSyncing(true);
    setBanner(null);
    try {
      const result = await api.syncLeaveCases();
      const summary = syncSummary(result);
      if (summary.changed) await load({ quiet: true });
      setBanner({ tone: "success", text: summary.text });
    } catch (error) {
      setBanner({ tone: "error", text: error.message || "The leave dates could not be checked." });
    } finally {
      setSyncing(false);
    }
  }

  // ---- board pieces ------------------------------------------------------------------
  const renderCard = useCallback(
    (item) => (
      <CaseCard
        item={item}
        role={role}
        selectable={Boolean(batchForwardAction(item))}
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
              aria-label={filteredOut ? `${columnItems.length} shown of ${total}` : `${total} requests`}
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
      if (!columnItems.length || !columnItems.every((item) => batchForwardAction(item))) return null;
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
    <div className="space-y-5">
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
        {isStaff && (
          <button type="button" onClick={refreshDates} disabled={syncing} className="btn-ghost px-4 py-2">
            <CalendarClock className="h-4 w-4" /> {syncing ? "Checking..." : "Refresh leave dates"}
          </button>
        )}
      </div>

      {state.error && <ErrorNote message={state.error} />}
      {banner && (
        <Banner tone={banner.tone} onDismiss={() => setBanner(null)}>
          {banner.text}
        </Banner>
      )}

      {!readmission && <FollowUpStrip cases={cases} onOpen={(item) => setDetailId(item.id)} onRunAction={openAction} />}

      {cases.length === 0 ? (
        <EmptyState
          title={readmission ? "No readmission requests yet" : "No leave requests yet"}
          hint="Requests appear here as soon as a student files one."
        />
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
              />
            </div>
            <ViewToggle value={view} onChange={setView} />
          </div>

          {selectedItems.length > 0 && (
            <BatchBar selectedItems={selectedItems} slug={slug} onClear={() => setSelected(new Set())} onSubmit={runBatch} />
          )}
          <BatchResult result={batchResult} onDismiss={() => setBatchResult(null)} />

          {view === "board" ? (
            <StageBoard
              columns={columns}
              items={filtered}
              getItemId={getItemId}
              getColumnKey={getColumnKey}
              renderCard={renderCard}
              canDrag={(item) => (item.actions || []).length > 0}
              checkMove={checkMove}
              onMove={onMove}
              renderColumnHeader={renderColumnHeader}
              renderColumnFooter={renderColumnFooter}
              emptyText="No requests here"
              columnClassName="w-[300px]"
              ariaLabel={readmission ? "Readmission board" : "Leave of absence board"}
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
            <EmptyState title="No requests match these filters" hint="Clear a filter to see more." />
          )}
        </>
      )}

      {isStaff && <RegistrarPanel slug={slug} cases={cases} onChanged={() => load({ quiet: true })} />}

      {detailId !== null && (
        <CaseDetailModal
          caseId={detailId}
          slug={slug}
          vocabulary={vocabulary}
          version={detailVersion}
          onClose={() => setDetailId(null)}
          onAction={(detail, action) => openAction(detail, action, detail)}
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
    </div>
  );
}
