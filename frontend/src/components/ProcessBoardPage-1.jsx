import { refusalMessage } from "../lib/refusal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatDateTime } from "../lib/format";
import ListExportButtons from "./ListExportButtons";
import { nextWithdrawalBatchName } from "../pages/process/WithdrawalExport";
import { useConfirm } from "./confirm";
import { Button, EmptyState, InlineNotice, Modal, PageHeader, SkeletonBoard, StatusChip } from "./ui/index.js";
import { HelpButton, PageHelpDrawer } from "./PageHelp";
import StageBoard, { BoardNotice, BoardSummary, boardSummaryLine, useBoardNotice } from "./StageBoard";
import { GroupCard, StageColumnHeader } from "./process";
import { GUIDES, PROCESS_CONFIG } from "./processConfig";
import ActionDialog from "../pages/leave/ActionDialog";
import BatchBar, { BatchResult } from "../pages/leave/BatchBar";
import CaseCard, { CaseTable } from "../pages/leave/CaseCard";
import CaseDetailModal from "../pages/leave/CaseDetailModal";
import LeaveFilters, { BoardFilterRow, BoardFrame, ViewToggle } from "../pages/leave/LeaveFilters";
import {
  EMPTY_FILTERS,
  actionsIntoColumn,
  batchActionsOf,
  checkMoveFor,
  lockReasonFor,
  commonBatchActions,
  matchesFilters,
  openCaseOfStudent,
  plural,
} from "../pages/leave/leaveHelpers";

// UX-29 (Phase 5b): the final columns of each board, folded behind one "Closed" strip at the end of the board.
const CLOSED_COLUMNS = {
  "leave-of-absence": ["ended", "not_approved"],
  readmission: ["approved", "not_approved"],
  awol: ["back", "not_approved", "residency_closed"],
  withdrawal: ["acknowledged", "not_approved"],
};

const getItemId = (item) => item.id;
// The stage for the green "New for you" mark: the status and when the request was filed (a new or reset request is new).
const getItemStatus = (item) => `${item.status}|${item.submitted_at || item.created_at || ""}`;
const getItemStudentName = (item) => item.student?.name || "this request";
// When a card last changed: the newest is at the top of its column (owner 2026-11-19). A batch is as new as its newest student.
const getItemTime = (item) =>
  item.kind === "batch"
    ? item.items.map((row) => row.last_activity_at || row.updated_at || "").sort().pop()
    : item.last_activity_at || item.updated_at || item.submitted_at || "";
// Owner 2026-11-19: on the Withdrawal board a card moves to the next column only by the approval steps (it can be reordered
// inside its column), and it is green while it is new and waits on the signed-in person. The other process boards are unchanged.
const COLUMN_LOCKED_SLUGS = new Set(["withdrawal"]);
// Owner 2026-11-19: from the Excel export on, the withdrawals exported together travel as one batch card (like Graduation).
const REGISTRAR_STATUSES = new Set(["Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"]);
const casesOf = (columnItems) => columnItems.flatMap((item) => (item.kind === "batch" ? item.items : [item]));

// One exported withdrawal batch on the board: the batch name, its students (each with View) and the Registrar dates.
function WithdrawalBatchCard({ batch, onOpen, actions = null }) {
  const first = batch.items[0];
  const registrar = first.registrar || {};
  const facts = [
    { label: "Students", value: batch.items.map((item) => item.student.name).join(", ") },
    { label: "Next", value: first.owner || "No further step" },
    ...(registrar.exported_at ? [{ label: "Exported", value: formatDateTime(registrar.exported_at) }] : []),
    ...(registrar.sent_at ? [{ label: "Sent to the Registrar", value: formatDateTime(registrar.sent_at) }] : []),
    ...(registrar.acknowledged_at ? [{ label: "Acknowledged", value: formatDateTime(registrar.acknowledged_at) }] : []),
  ];
  return (
    <div data-batch-count={batch.items.length}>
      <GroupCard
        title={batch.batch_name}
        count={plural(batch.items.length, "student")}
        chip={<StatusChip status={first.status_label} size="sm" dot={false} />}
        facts={facts}
        actions={actions}
      >
        <ul className="space-y-1.5" aria-label={`Students in ${batch.batch_name}`}>
          {batch.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold text-ink">{item.student.name}</span>
                <span className="meta block break-words">{item.subject?.code ? `${item.subject.code} - ${item.subject.title}` : item.student.student_number}</span>
              </span>
              <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpen(item)} aria-label={`View details for ${item.student.name}`}>View</Button>
            </li>
          ))}
        </ul>
      </GroupCard>
    </div>
  );
}
const NO_ACTIONS = [];

function GuideWindow({ slug, policyQuestions, onClose }) {
  const guide = GUIDES[slug];
  const Line = ({ label, children }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
  return (
    <Modal
      size="lg"
      title={`How ${PROCESS_CONFIG[slug].title} works`}
      onClose={onClose}
      closeLabel="Close the guide"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
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
            <p className="eyebrow">Main stages</p>
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {guide.stages.map((stage, index) => (
                <li key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                  <span className="meta grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700">{index + 1}</span>
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
            {COLUMN_LOCKED_SLUGS.has(slug)
              ? "a card moves to the next column by itself when a step is done in the request window. Drag a card up or down to reorder it inside its column."
              : <>drag it to the next column, or use &quot;Move to…&quot; on the card. Both do exactly what the buttons in the request window do, and the server refuses a move the rules do not allow.</>}
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
    </Modal>
  );
}

function ActivityWindow({ logs, onClose }) {
  return (
    <Modal
      size="lg"
      title="Recent activity"
      onClose={onClose}
      closeLabel="Close recent activity"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
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
                <time className="meta" dateTime={log.created_at || undefined}>{formatDateTime(log.created_at)}</time>
              </div>
              <p className="meta mt-1">{log.actor_role}{log.student_name ? ` · ${log.student_name}` : ""}</p>
              {(log.previous_status || log.new_status) && (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {log.previous_status || "-"} <span className="mx-1 font-normal text-slate-500">to</span> {log.new_status || "-"}
                </p>
              )}
              {log.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{log.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
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
 * `headerBadge` is the chip beside the title (the Dean's pages pass "N waiting"); `config.deanDescription` is the
 * Dean's own one-line description (finding 10, IM24).
 *
 * Every move, from every place, goes through `submitTransition`, which makes the one
 * guarded call (api.processCaseTransition). The server refuses anything illegal again.
 */
export default function ProcessBoardPage({ slug, onChanged = null, headerBadge = null }) {
  const config = PROCESS_CONFIG[slug];
  const { user } = useAuth();
  const role = user?.role || "";
  const isStaff = role === "staff" || role === "admin"; // an administrator acts as Graduate School staff
  const Icon = config.icon;
  const columnLocked = COLUMN_LOCKED_SLUGS.has(slug);

  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [view, setView] = useState("board");
  // The address can open the board on the open requests (?show=open, the dashboard's link); clearing the filter drops it again (I-196).
  const [urlParams, setUrlParams] = useSearchParams();
  const urlFilters = () => ({ ...EMPTY_FILTERS, open: urlParams.get("show") === "open" });
  const [filters, setFilters] = useState(urlFilters);
  useEffect(() => {
    if (filters.open || urlParams.get("show") !== "open") return;
    const next = new URLSearchParams(urlParams);
    next.delete("show");
    setUrlParams(next, { replace: true });
  }, [filters.open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState(() => new Set());
  const [detailId, setDetailId] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [registrarFocus, setRegistrarFocus] = useState(""); // a student id: the Registrar list scrolls into view with that row ticked
  const [detailFocus, setDetailFocus] = useState(""); // "messages": the Message button opens the window on the note box
  const [dialog, setDialog] = useState(null); // { item, action, detail }
  const boardNotice = useBoardNotice(); // the one place a step says what happened (the board shows it above its columns)
  const dismissNotice = boardNotice.dismiss;
  const [batchResult, setBatchResult] = useState(null);
  const [signal, setSignal] = useState(null); // an extra window a step opens instead of a confirm box
  const [support, setSupport] = useState(""); // "guide" | "activity"
  const [helpOpen, setHelpOpen] = useState(false); // UX-14: the Help panel

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
    dismissNotice();
    setBatchResult(null);
    setSignal(null);
    setFilters(urlFilters());
    (async () => {
      const res = await load({ quiet: true });
      // ?student_id= (a dashboard task about one student's request) opens that request's window, once (I-348).
      const studentId = urlParams.get("student_id");
      if (active && res && studentId) {
        const toRegistrar = urlParams.get("section") === "registrar"; // a "send to the Registrar" task: the list, not the case window (I-375)
        const target = openCaseOfStudent(res.cases, studentId);
        if (toRegistrar) setRegistrarFocus(studentId);
        else if (target) setDetailId(target.id);
        const next = new URLSearchParams(urlParams);
        next.delete("student_id");
        next.delete("section");
        setUrlParams(next, { replace: true });
      }
      if (active && config.afterOpen) await config.afterOpen({ isStaff, reload: () => load({ quiet: true }) });
    })();
    return () => {
      active = false;
    };
  }, [slug, isStaff, load, config, dismissNotice]);

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
  // The board's cards: on the Withdrawal board the exported withdrawals of one batch are one card per batch and stage.
  const boardItems = useMemo(() => {
    if (slug !== "withdrawal") return filtered;
    const out = [];
    const batches = new Map();
    filtered.forEach((item) => {
      if (!REGISTRAR_STATUSES.has(item.status) || !item.batch_name) {
        out.push(item);
        return;
      }
      const key = `batch:${item.batch_name}:${item.status}`;
      if (!batches.has(key)) {
        const batch = {
          kind: "batch", id: key, batch_name: item.batch_name, status: item.status, status_label: item.status_label,
          owner: item.owner, actions: item.actions || NO_ACTIONS, submitted_at: item.registrar?.exported_at || item.updated_at,
          student: { name: item.batch_name }, items: [],
        };
        batches.set(key, batch);
        out.push(batch);
      }
      batches.get(key).items.push(item);
    });
    return out;
  }, [filtered, slug]);

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

  const summaryLine = useMemo(() => boardSummaryLine(columns, totals, config.noun), [columns, totals, config.noun]);

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
    setDetailId(null); // the case window would hide the notice
    boardNotice.show("success", `${current.item.student.name}: ${result.message || "Done."}`);
  }

  const checkMove = useCallback((item, column) => checkMoveFor(item, column, vocabulary), [vocabulary]);

  const lockReason = useCallback((item) => lockReasonFor(item, vocabulary), [vocabulary]);

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
      setBatchResult({ updated: [], skipped: [], message: refusalMessage(error.message, "The group step was refused.") });
    }
  }

  // Owner 2026-11-19: the batch's Registrar step is a button on the batch card itself.
  const batchStepRef = useRef(null); // runBatchStep is made further down; the card button calls it through this ref
  const batchStepButton = useCallback(
    (batch) => {
      if (!isStaff) return null;
      const step = ["send", "acknowledge"].find((key) => (batch.actions || NO_ACTIONS).some((action) => action.action === key));
      if (!step) return null;
      const words = step === "send"
        ? { button: "Mark as sent to the Registrar", title: "Sent this list to the Registrar?", message: "Use this after the Excel list was emailed to the Registrar. The batch moves to Waiting for Registrar acknowledgement." }
        : { button: "Mark as acknowledged", title: "Registrar acknowledged this list?", message: "Use this only after the Registrar confirmed receipt of the emailed list. The batch moves to Acknowledged by Registrar." };
      return (
        <Button
          size="sm"
          variant={step === "acknowledge" ? "primary" : "secondary"}
          className="w-full"
          aria-label={`${words.button}: ${batch.batch_name}`}
          onClick={() => batchStepRef.current?.(batch.items, step, batch.batch_name, words)}
        >
          {words.button}
        </Button>
      );
    },
    [isStaff],
  );

  // ---- board pieces ------------------------------------------------------------------
  // Owner 2026-11-19: on the Withdrawal board staff tick cards in "Excel export" and make one batch of them.
  const isExportable = useCallback(
    (item) => slug === "withdrawal" && isStaff && (item.actions || NO_ACTIONS).some((action) => action.action === "export"),
    [slug, isStaff],
  );
  const renderCard = useCallback(
    (item, column) => item.kind === "batch" ? (
      <WithdrawalBatchCard batch={item} onOpen={(row) => { setDetailFocus(""); setDetailId(row.id); }} actions={batchStepButton(item)} />
    ) : (
      <CaseCard
        item={item}
        role={role}
        columnLabel={column?.label}
        // Owner 2026-11-19: on the Withdrawal board each request is forwarded and decided one at a time; the only
        // checkboxes are in "Excel export", where staff make a batch.
        selectable={slug === "withdrawal" ? isExportable(item) : batchActionsOf(item).length > 0}
        selected={selected.has(item.id)}
        onToggleSelect={toggleSelect}
        onOpen={(row) => { setDetailFocus(""); setDetailId(row.id); }}
        onMessage={(row) => { setDetailFocus("messages"); setDetailId(row.id); }}
      />
    ),
    [role, selected, isExportable, slug, batchStepButton],
  );

  // Khloe's header (components/process): the stage's number, its name, what it holds and how many cards.

  // Owner 2026-11-19 (Withdrawal): the Registrar hand-off is done per export batch, with one button per batch.
  const confirmStep = useConfirm();
  const runBatchStep = useCallback(
    async (items, action, batchName, words) => {
      const sure = await confirmStep({
        title: words.title,
        message: `${batchName}: ${items.map((item) => item.student.name).join(", ")}\n\n${words.message}`,
        confirmLabel: words.button,
      });
      if (!sure) return;
      try {
        const result = await api.processCasesBatch(slug, { case_ids: items.map((item) => item.id), action });
        await load({ quiet: true });
        setDetailVersion((value) => value + 1);
        if (onChanged) await onChanged();
        boardNotice.show(result.updated?.length === 0 ? "error" : "success", `${batchName}: ${result.message || "Done."}`);
      } catch (error) {
        boardNotice.show("error", refusalMessage(error.message, "The batch step was refused."));
      }
    },
    [confirmStep, slug, load, onChanged, boardNotice],
  );
  batchStepRef.current = runBatchStep;

  const exportBatch = useCallback(
    async (items) => {
      const batchName = nextWithdrawalBatchName(cases);
      const sure = await confirmStep({
        title: "Create this batch and download the Excel list?",
        highlights: [{ label: "Batch", value: `${batchName} · ${plural(items.length, "student")}` }],
        message: `${items.map((item) => item.student.name).join(", ")}\n\nThe Excel list downloads now and the batch moves to Exported - Ready to Send. Then email the file to the Registrar.`,
        confirmLabel: "Create batch and download",
      });
      if (!sure) return;
      setSelected(new Set());
      setSignal({ type: "export-batch", ids: items.map((item) => item.id) });
    },
    [cases, confirmStep],
  );

  const renderColumnFooter = useCallback(
    (column, columnItems) => {
      if (slug === "withdrawal") return null; // the Excel export column has its own controls at the top
      if (!columnItems.length || !columnItems.every((item) => batchActionsOf(item).length)) return null;
      const allOn = columnItems.every((item) => selected.has(item.id));
      return (
        <>
        <button
          type="button"
          onClick={() => setMany(columnItems, !allOn)}
          className="mt-3 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 max-sm:min-h-11"
        >
          {allOn ? "Clear selection in this column" : "Select all in this column"}
        </button>
        </>
      );
    },
    [selected, slug],
  );

  // Owner 2026-11-19 (Withdrawal): the column's group steps sit at the top, under the column title, like Graduation.
  const columnTopControls = useCallback(
    (column, columnItems) => {
      if (slug !== "withdrawal" || !isStaff) return null;
      if (column.key !== "export") return null; // the Registrar steps are buttons on each batch card
      {
        const exportable = columnItems.filter(isExportable);
        if (!exportable.length) return null;
        const ticked = exportable.filter((item) => selected.has(item.id));
        const allOn = ticked.length === exportable.length;
        return (
          <div className="mb-3 space-y-2">
            <button
              type="button"
              onClick={() => setMany(exportable, !allOn)}
              className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 max-sm:min-h-11"
            >
              {allOn ? "Clear selection in this column" : "Select all in this column"}
            </button>
            <Button size="sm" className="w-full" disabled={!ticked.length} onClick={() => exportBatch(ticked)}>
              {`Create batch and download Excel list (${ticked.length})`}
            </Button>
            {/* CHANGED BY owner feedback 2026-11-23: no "Tick the students" hint */}
          </div>
        );
      }
    },
    [selected, slug, isStaff, isExportable, exportBatch],
  );

  const renderColumnHeader = useCallback(
    (column, columnItems) => {
      const total = totals[column.key] || 0;
      const shown = casesOf(columnItems).length; // a batch card counts its students
      return (
        <>
          <StageColumnHeader
            column={columnLocked ? { ...column, hyphenate: true } : column} // a long title ("acknowledgement") breaks with a hyphen
            count={shown}
            total={total}
            number={columns.findIndex((entry) => entry.key === column.key) + 1}
            countLabel={shown === total ? plural(total, "request") : null}
          />
          {columnTopControls(column, columnItems)}
        </>
      );
    },
    [totals, columns, columnLocked, columnTopControls],
  );

  // ---- extras a process brings ---------------------------------------------------------
  const ctx = {
    slug,
    role,
    isStaff,
    cases,
    data,
    reload: () => load({ quiet: true }),
    registrarFocus,
    openDetail: (item) => { setDetailFocus(""); setDetailId(item.id); },
    runAction,
    banner: boardNotice.show,
    signal,
    clearSignal: () => setSignal(null),
  };
  const HeaderActions = config.HeaderActions;
  const AboveBoard = config.AboveBoard;
  const BelowBoard = config.BelowBoard;

  // ---- states ------------------------------------------------------------------------
  if (state.loading && !data) {
    return (
      <div className="page-stack">
        <PageHeader title={config.title} icon={Icon} badge={headerBadge} />
        <SkeletonBoard columns={4} label="Loading requests" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3">
        <InlineNotice tone="danger">{state.error || "The requests could not be loaded."}</InlineNotice>
        <Button variant="secondary" icon={RefreshCw} onClick={() => load()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="page-stack animate-fade-up">
      {/* Header: the same in every process */}
      <PageHeader
        title={config.title}
        icon={Icon}
        badge={headerBadge}
        actions={<HelpButton onClick={() => setHelpOpen(true)} />}
      />

      <BoardSummary
        line={summaryLine}
        actions={HeaderActions ? <div className="flex flex-wrap gap-2"><HeaderActions ctx={ctx} /></div> : null}
      />

      {state.error && <InlineNotice tone="danger">{state.error}</InlineNotice>}
      {!(view === "board" && cases.length > 0) && <BoardNotice notice={boardNotice.notice} onDismiss={boardNotice.dismiss} />}

      {AboveBoard && <AboveBoard ctx={ctx} />}

      {cases.length === 0 ? (
        <EmptyState title={config.emptyTitle} hint={config.emptyHint} />
      ) : (
        <BoardFrame>
          <BoardFilterRow toggle={<ViewToggle value={view} onChange={setView} />}>
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
              extra={<ListExportButtons
                            title={config.title}
                            subtitle={`${filtered.length} of ${cases.length} ${config.noun}`}
                            filename={slug}
                            columns={["Student ID", "Student name", "Program", "Type", "Status", "Next", "Updated"]}
                            rows={filtered.map((item) => [item.student.student_number, item.student.name, item.student.program_code, item.kind_label || "", item.status || "", item.owner || "", formatDateTime(item.last_activity_at || item.updated_at)])}
                />}
            />
          </BoardFilterRow>

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
              closedKeys={CLOSED_COLUMNS[slug] || []}
              numbered
              items={boardItems}
              getItemId={getItemId}
              getColumnKey={getColumnKey}
              renderCard={renderCard}
              canDrag={(item) => (item.actions || NO_ACTIONS).length > 0}
              lockReason={lockReason}
              checkMove={checkMove}
              onMove={onMove}
              renderColumnHeader={renderColumnHeader}
              renderColumnFooter={renderColumnFooter}
              emptyText={`No ${config.noun} here`}
              ariaLabel={config.boardLabel}
              boardNotice={boardNotice}
              columnLocked={columnLocked}
              freshWhen={columnLocked ? "needsMe" : "moved"}
              getStageKey={columnLocked ? getItemStatus : null}
              getItemLabel={getItemStudentName}
              getItemTime={columnLocked ? getItemTime : null}
            />
          ) : filtered.length ? (
            <CaseTable
              items={filtered}
              role={role}
              selectableIds={selectableIds}
              selectedIds={selected}
              onToggle={toggleSelect}
              onToggleAll={setMany}
              onOpen={(item) => { setDetailFocus(""); setDetailId(item.id); }}
            />
          ) : (
            <EmptyState title={`No ${config.noun} match these filters`} hint="Clear a filter to see more." />
          )}
        </BoardFrame>
      )}

      {BelowBoard && <BelowBoard ctx={ctx} />}

      {detailId !== null && (
        <CaseDetailModal
          caseId={detailId}
          focus={detailFocus}
          slug={slug}
          vocabulary={vocabulary}
          version={detailVersion}
          onClose={() => setDetailId(null)}
          onAction={(detail, action) => runAction(detail, action, detail)}
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

      {helpOpen && (
        <PageHelpDrawer
          board={columnLocked ? "locked" : "move"}
          title={config.title}
          forms={slug}
          rulesProcess={config.rulesProcess}
          onGuide={() => setSupport("guide")}
          onActivity={() => setSupport("activity")}
          onClose={() => setHelpOpen(false)}
        />
      )}
      {support === "guide" && <GuideWindow slug={slug} policyQuestions={data.policy_questions || []} onClose={() => setSupport("")} />}
      {support === "activity" && <ActivityWindow logs={data.recent_activity || []} onClose={() => setSupport("")} />}
    </div>
  );
}
