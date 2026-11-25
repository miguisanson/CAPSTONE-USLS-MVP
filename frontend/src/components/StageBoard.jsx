import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Inbox, Loader2, Lock, Move } from "lucide-react";
import { useIsPhone } from "../hooks";
import { EmptyState, InlineNotice, StatusLegend } from "./ui/index.js";
import { StageColumnHeader } from "./process/StageColumnHeader.jsx";
import { refusalMessage } from "../lib/refusal";
import { useAuth } from "../auth";
import { useSeenMarks } from "../lib/seenMarks";

/**
 * A staged board with real drag and drop (native HTML5, no dependency).
 *
 * Every move goes through the same function, whether it comes from a drop or from the
 * "Move to..." menu on a card (the keyboard and touch alternative): `attemptMove`.
 * The board never changes an item itself. It asks `checkMove` first (so an illegal
 * drop is refused with a visible reason) and then calls `onMove`, which must call the
 * same guarded server step that the buttons call. The server refuses anything illegal
 * again, so the screen can never move a case the rules do not allow.
 *
 * Props
 *   columns        [{ key, label, description?, tone? }]  - left to right
 *   items          the things on the board
 *   getItemId      (item) => stable id
 *   getColumnKey   (item) => the key of the column the item is in now
 *   renderCard     (item, column) => node (the card body; the board adds drag and the move menu)
 *   canDrag        (item) => boolean (default true)
 *   lockReason     (item) => string: why a card that cannot be moved cannot be moved, e.g.
 *                  "Waiting for: Student". A card that cannot be dragged shows a lock and this text
 *                  (real text, not a tooltip) and has no "Move to..." menu - the same on every board.
 *   needsMe        (item) => boolean: the card waits on the signed-in role (default: canDrag). Phone list: only stages with such a card start open.
 *   isFinished     (item) => boolean: the card is done (default: its lock reason starts with "Finished"). Phone list: stages of only such cards sit behind "Show finished (n)".
 *   showMoveMenu   (item) => boolean (default true): the "Move to..." button under a card
 *   checkMove      (item, toColumn) => { allowed: boolean, reason?: string }
 *                  default: allowed everywhere else
 *   onMove         async (item, toColumn, fromColumn) => { message?: string } | void
 *                  throw an Error (its message is shown) to refuse
 *   renderColumnHeader  (column, items) => node, to replace the default header
 *   renderColumnFooter  (column, items) => node
 *   emptyText      text for an empty column (shown with the shared EmptyState)
 *   columnClassName  classes for each column (width etc.); the default is a narrow column so more stages fit
 *                    A column is as tall as its cards (at least 14rem); "Select all" sits right under the last card.
 *   columnBodyClassName classes for each column's card list (height, overflow, spacing, etc.)
 *   fitColumns     lets a small set of columns share the full desktop width while keeping a readable minimum width
 *   closedKeys     UX-29: the keys of the final columns (Ended, Not approved ...). They sit behind one "Closed" strip at the
 *                  end of the board, folded; a click opens it, and a card dragged over it opens it (drag works as before).
 *                  UX-28: on the desktop board an empty column is a narrow strip (its name and 0) that still takes a drop.
 *
 * On a phone (below 640 px) every board is the same stacked list instead: one group per stage that has cards, in the
 * board's order, each card with the same "Move to..." menu or lock reason and no dragging (I-199, IM24).
 *
 * When the stages are wider than the screen the board says so: a line above it ("3 more stages to the right"),
 * "Scroll board left/right" buttons (keyboard reachable) and a soft fade at the cut edge. Column titles wrap, never cut.
 *   ariaLabel      label for the scrolling region
 *   phoneAriaLabel label of the stacked list a phone gets instead (default: ariaLabel)
 *   readOnly       turns drag and the menu off
 *   boardNotice    the result of useBoardNotice() when the page reports other things (a dialog, a group step) in the same
 *                  place. The board shows it above its columns; a page renders <BoardNotice> itself only when it shows no
 *                  board (the table view, no cases), so there is one notice on screen, never two.
 *
 * Owner 2026-11-19 (Withdrawal, Practicum and Graduation only - every other board keeps the defaults):
 *   columnLocked   true: a card never moves to another column by hand (it moves by itself as the request is approved);
 *                  it can be dragged (or moved with the up/down buttons) to a new place inside its own column. That order
 *                  is kept in this browser, per account. No "Move to..." menu.
 *   freshWhen      "needsMe": a card is green ("New for you") while it waits on the signed-in person (needsMe) and the
 *                  person has not opened it at this stage yet. Cards that wait on someone else are never green.
 *   getItemTime    (item) => when the card last changed (ISO); columnLocked boards list the newest first
 *   getItemLabel   (item) => a name for the card's up/down buttons ("Move Elena Navarro up")
 *   getStageKey    (item) => the stage a card is at, for "freshWhen" (default: its column). Use the status when one
 *                  column holds several steps, so a step that stays in the column still counts as new.
 */
export default function StageBoard({
  columns,
  items,
  getItemId,
  getColumnKey,
  renderCard,
  canDrag = () => true,
  needsMe = canDrag,
  isFinished = (item) => /^Finished/.test((lockReason && lockReason(item)) || ""),
  lockReason,
  showMoveMenu = () => true,
  checkMove,
  onMove,
  renderColumnHeader,
  renderColumnFooter,
  emptyText = "Nothing here",
  columnClassName = "w-[248px]",
  columnBodyClassName = "",
  fitColumns = false,
  closedKeys = [],
  numbered = false, // the page numbers its columns (1 Submitted, 2 In staff review ...): an empty strip keeps its number
  ariaLabel = "Stage board",
  phoneAriaLabel = ariaLabel,
  readOnly = false,
  boardNotice = null,
  columnLocked = false,
  freshWhen = "moved",
  getStageKey = null,
  getItemLabel = null,
  getItemTime = null,
}) {
  const phone = useIsPhone();
  const boardId = useId().replace(/:/g, "");
  const [phoneOpen, setPhoneOpen] = useState({}); // phone list: stage key -> opened/closed by the viewer
  const [closedOpen, setClosedOpen] = useState(false); // UX-29: the folded "Closed" group
  const [showFinished, setShowFinished] = useState(false);
  const [chip, setChip] = useState(null); // phone filter: "mine" | "others" | "done"; null = not chosen yet (default below)
  const [dragging, setDragging] = useState(null); // { id, from }
  const [hoverColumn, setHoverColumn] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // columnLocked: { id, before } - where a dragged card would land in its column
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null); // { id, label }: a move that is under way or waits on its confirm dialog
  const [settledId, setSettledId] = useState(null); // the card that has just arrived in its column (1 s ring)
  const ownNotice = useBoardNotice();
  const activeNotice = boardNotice || ownNotice; // a page that reports its own steps passes useBoardNotice()
  const { show } = activeNotice;
  const settleTimer = useRef(null);
  const moveRef = useRef(null); // { id, toKey, at }: the move to look for in the next items
  const watchRef = useRef(null); // { observer, timer }: waits for the confirm dialog to close
  const regionRef = useRef(null);
  const [hidden, setHidden] = useState({ left: 0, right: 0 }); // stages not fully in view on each side

  const columnByKey = useMemo(() => Object.fromEntries(columns.map((column) => [column.key, column])), [columns]);
  const itemById = useMemo(() => new Map(items.map((item) => [String(getItemId(item)), item])), [items, getItemId]);

  // Owner 2026-11-08: a card that moved by itself (someone else's step, a student submission, an export) is green in its
  // new column until this person opens or touches it. This browser remembers, per account, the column each card was
  // last seen in (per copy of the demo data). The first visit only records where everything is; moves this person makes never turn green.
  const { user } = useAuth();
  const needsMode = freshWhen === "needsMe";
  const stageKeyOf = useCallback((item) => String((getStageKey || getColumnKey)(item) ?? ""), [getStageKey, getColumnKey]);
  // The value remembered for a card: the column it was seen in (default), or the stage it was opened at ("needsMe").
  const seenValueOf = useCallback((item) => (needsMode ? stageKeyOf(item) : getColumnKey(item)), [needsMode, stageKeyOf, getColumnKey]);
  // The data id changes on a reseed or a demo reset, so cards a reset put back are not counted as moved.
  const seen = useSeenMarks(`${needsMode ? "board-needs" : "board"}:${ariaLabel}:${user?.id || "guest"}:${user?.data_id || ""}`);
  const order = useSeenMarks(`board-order:${ariaLabel}:${user?.id || "guest"}:${user?.data_id || ""}`); // columnLocked only
  const touchedRef = useRef(new Set()); // cards this person clicked or moved in this page view
  const hasMarks = Object.keys(seen.marks).length > 0;
  const freshIds = useMemo(() => {
    const fresh = new Set();
    if (readOnly) return fresh;
    if (needsMode) {
      // Owner 2026-11-19: green = waiting on me and not opened at this stage yet (e.g. staff see a new withdrawal green; once
      // forwarded it is white for staff and green for the Dean).
      for (const item of items) {
        const id = String(getItemId(item));
        // Not "touched in this page view": a card that my own step moves to a stage that still waits on me (Practicum
        // "Completion review", Graduation "Approved, ready to export") turns green there too.
        if (needsMe(item) && seen.marks[id] !== stageKeyOf(item)) fresh.add(id);
      }
      return fresh;
    }
    if (!hasMarks) return fresh;
    for (const item of items) {
      const id = String(getItemId(item));
      if (seen.marks[id] !== getColumnKey(item) && !touchedRef.current.has(id)) fresh.add(id);
    }
    return fresh;
  }, [items, getItemId, getColumnKey, seen.marks, hasMarks, readOnly, needsMode, needsMe, stageKeyOf]);
  const { markMany: markSeenMany, mark: markSeen } = seen;
  useEffect(() => {
    const pairs = [];
    for (const item of items) {
      const id = String(getItemId(item));
      const value = seenValueOf(item);
      // "needsMe": a card waiting on someone else is recorded as seen where it is, so it turns green when it comes back to me.
      const record = needsMode ? !needsMe(item) : !hasMarks || touchedRef.current.has(id);
      if (record && seen.marks[id] !== value) pairs.push([id, value]);
    }
    if (pairs.length) markSeenMany(pairs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const touchCard = useCallback((id, value) => {
    touchedRef.current.add(id);
    markSeen(id, value);
  }, [markSeen]);

  // columnLocked: the viewer's own order of the cards in each column ("id,id,id"). Cards not placed yet come first.
  const orderedIn = useCallback(
    (columnKey, columnItems) => {
      if (!columnLocked) return columnItems;
      // Owner 2026-11-19: the newest card is at the top of its column (for every role); the viewer's own order wins after that.
      const timeOf = (item) => {
        const value = getItemTime ? getItemTime(item) : "";
        const at = value ? new Date(value).getTime() : 0;
        return Number.isFinite(at) ? at : 0;
      };
      const newestFirst = getItemTime ? [...columnItems].sort((a, b) => timeOf(b) - timeOf(a)) : columnItems;
      const saved = (order.marks[columnKey] || "").split(",").filter(Boolean);
      if (!saved.length) return newestFirst;
      columnItems = newestFirst;
      const position = new Map(saved.map((id, index) => [id, index]));
      const placed = columnItems.filter((item) => position.has(String(getItemId(item))));
      placed.sort((a, b) => position.get(String(getItemId(a))) - position.get(String(getItemId(b))));
      return [...columnItems.filter((item) => !position.has(String(getItemId(item)))), ...placed];
    },
    [columnLocked, order.marks, getItemId, getItemTime],
  );
  const { mark: markOrder } = order;
  const placeCard = useCallback(
    (columnKey, columnItems, movedId, targetId, before = true) => {
      const ids = orderedIn(columnKey, columnItems).map((item) => String(getItemId(item)));
      const from = ids.indexOf(movedId);
      if (from < 0) return;
      ids.splice(from, 1);
      let at = targetId ? ids.indexOf(targetId) : ids.length;
      if (at < 0) at = ids.length;
      else if (!before) at += 1;
      ids.splice(at, 0, movedId);
      markOrder(columnKey, ids.join(","));
    },
    [orderedIn, getItemId, markOrder],
  );
  const columnLockedReason = "Cards move to the next column by themselves as the request is approved. Drag a card up or down to reorder it inside its column.";

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      stopWatching();
    },
    [],
  );

  // After a move that succeeded the card is in its new column: ring it for a second and bring it into view.
  useEffect(() => {
    const move = moveRef.current;
    if (!move) return;
    if (Date.now() - move.at > 8000) {
      moveRef.current = null;
      return;
    }
    const item = itemById.get(move.id);
    if (!item || getColumnKey(item) !== move.toKey) return;
    moveRef.current = null;
    setPending(null);
    setSettledId(move.id);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettledId(null), 1000);
    regionRef.current?.querySelector(`[data-card-id="${CSS.escape(move.id)}"]`)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [items, itemById, getColumnKey]);

  function stopWatching() {
    const watch = watchRef.current;
    if (!watch) return;
    watch.observer.disconnect();
    window.clearTimeout(watch.timer);
    watchRef.current = null;
  }

  // A step that needs a confirm dialog opens it after onMove returns. The card keeps "Moving to ..." until that dialog
  // (a [data-modal-backdrop] in <body>) has appeared and gone again, i.e. until the person confirmed or cancelled.
  // A move that opens no dialog is done after a short grace.
  function watchDialog() {
    stopWatching();
    let seen = false;
    const done = () => {
      stopWatching();
      setPending(null);
    };
    const check = () => {
      const open = Boolean(document.querySelector("[data-modal-backdrop]"));
      if (open) seen = true;
      else if (seen) done();
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    watchRef.current = { observer, timer: window.setTimeout(() => (seen ? undefined : done()), 400) };
    check();
  }

  // Count the stages that are cut off (or out of sight) on each side of the scrolling box.
  const measureHidden = useCallback(() => {
    const region = regionRef.current;
    if (!region) return;
    const view = region.getBoundingClientRect();
    let left = 0;
    let right = 0;
    region.querySelectorAll(":scope > div > section").forEach((section) => {
      const box = section.getBoundingClientRect();
      if (box.left < view.left - 1) left += 1;
      else if (box.right > view.right + 1) right += 1;
    });
    setHidden((old) => (old.left === left && old.right === right ? old : { left, right }));
  }, []);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return undefined;
    measureHidden();
    region.addEventListener("scroll", measureHidden, { passive: true });
    window.addEventListener("resize", measureHidden);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measureHidden) : null;
    if (observer) {
      observer.observe(region);
      if (region.firstElementChild) observer.observe(region.firstElementChild);
    }
    return () => {
      region.removeEventListener("scroll", measureHidden);
      window.removeEventListener("resize", measureHidden);
      if (observer) observer.disconnect();
    };
  }, [measureHidden, columns.length, phone]);

  const scrollBoard = useCallback((direction) => {
    const region = regionRef.current;
    if (!region) return;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    region.scrollBy({ left: direction * Math.max(200, region.clientWidth * 0.8), behavior: smooth ? "smooth" : "auto" });
  }, []);

  const verdict = useCallback(
    (item, toKey) => {
      const fromKey = getColumnKey(item);
      if (fromKey === toKey) return { allowed: false, reason: "", same: true };
      if (!checkMove) return { allowed: true };
      const result = checkMove(item, columnByKey[toKey]) || { allowed: true };
      return result;
    },
    [checkMove, columnByKey, getColumnKey],
  );

  const lockText = useCallback((item) => (lockReason && lockReason(item)) || "Not movable right now.", [lockReason]);

  const attemptMove = useCallback(
    async (item, toKey) => {
      const fromKey = getColumnKey(item);
      const target = columnByKey[toKey];
      if (!target || fromKey === toKey) return;
      if (!readOnly && !canDrag(item)) {
        show("error", refusalMessage(`${lockText(item).replace(/\.$/, "")}. This card cannot be moved right now.`));
        return;
      }
      const check = verdict(item, toKey);
      if (!check.allowed) {
        show("error", refusalMessage(check.reason || `This item cannot move to "${target.label}".`));
        return;
      }
      const id = String(getItemId(item));
      touchedRef.current.add(id); // this person's own move: the card is not "moved by itself"
      setBusyId(id);
      setPending({ id, label: target.label });
      moveRef.current = { id, toKey, at: Date.now() };
      let failed = false;
      try {
        const result = await onMove(item, target, columnByKey[fromKey]);
        if (result && result.message) show("success", result.message);
      } catch (error) {
        failed = true;
        show("error", refusalMessage(error?.message, "That move was refused."));
      } finally {
        setBusyId(null);
        if (failed) {
          moveRef.current = null;
          stopWatching();
          setPending(null);
        } else watchDialog();
      }
    },
    [canDrag, columnByKey, getColumnKey, getItemId, lockText, onMove, readOnly, show, verdict],
  );

  function onDragStart(event, item) {
    const id = String(getItemId(item));
    setDragging({ id, from: getColumnKey(item) });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function onDragEnd() {
    setDragging(null);
    setHoverColumn(null);
    setDropTarget(null);
  }

  function onDragOver(event, column) {
    if (!dragging) return;
    const item = itemById.get(dragging.id);
    if (!item) return;
    const check = columnLocked ? lockedVerdict(column.key) : verdict(item, column.key);
    // Always allow the drop event so a refused move can explain itself.
    event.preventDefault();
    event.dataTransfer.dropEffect = check.allowed ? "move" : "none";
    if (hoverColumn !== column.key) setHoverColumn(column.key);
  }

  function onDrop(event, column) {
    event.preventDefault();
    const id = dragging?.id || event.dataTransfer.getData("text/plain");
    const item = itemById.get(String(id));
    const target = dropTarget;
    setDragging(null);
    setHoverColumn(null);
    setDropTarget(null);
    if (!item) return;
    if (columnLocked) {
      if (getColumnKey(item) !== column.key) {
        show("error", columnLockedReason);
        return;
      }
      const columnItems = items.filter((entry) => getColumnKey(entry) === column.key);
      touchedRef.current.add(String(id));
      placeCard(column.key, columnItems, String(id), target && target.id !== String(id) ? target.id : null, target ? target.before : true);
      return;
    }
    attemptMove(item, column.key);
  }

  // columnLocked: a drop is allowed only inside the card's own column.
  function lockedVerdict(toKey) {
    if (!dragging) return { allowed: false, reason: "" };
    return dragging.from === toKey ? { allowed: true } : { allowed: false, reason: columnLockedReason };
  }

  // columnLocked: hovering over another card of the same column shows where the dragged card will land.
  function onCardDragOver(event, id, columnKey) {
    if (!columnLocked || !dragging || dragging.from !== columnKey || dragging.id === id) return;
    const box = event.currentTarget.getBoundingClientRect();
    const before = event.clientY < box.top + box.height / 2;
    if (!dropTarget || dropTarget.id !== id || dropTarget.before !== before) setDropTarget({ id, before });
  }

  // One card with its drag handle, "Moving to ..." line and move menu (or lock reason): the same on the board and in the phone list.
  function renderItem(item, column, columnItems = null, index = 0) {
    const id = String(getItemId(item));
    const movable = !readOnly && canDrag(item);
    // a phone moves a card with "Move to...", never by dragging; a columnLocked board drags any card, only inside its column
    const draggable = columnLocked ? !readOnly && !phone : movable && !phone;
    const fresh = freshIds.has(id);
    const landing = columnLocked && dropTarget?.id === id ? (dropTarget.before ? "before" : "after") : "";
    return (
      <div
        key={id}
        draggable={draggable}
        data-fresh={fresh ? "true" : undefined}
        data-drop={landing || undefined}
        // After the click, not during it: a re-render inside the click reset a ticked checkbox on a green card.
        onClickCapture={() => {
          const value = seenValueOf(item);
          if (needsMode) window.setTimeout(() => touchCard(id, value), 0);
          else touchCard(id, value);
        }}
        onDragStart={draggable ? (event) => onDragStart(event, item) : undefined}
        onDragOver={columnLocked ? (event) => onCardDragOver(event, id, column.key) : undefined}
        onDragEnd={onDragEnd}
        data-card-id={id}
        aria-busy={busyId === id}
        data-locked={!readOnly && !movable ? "true" : undefined}
        // A long chip on a card (e.g. "Registrar: Exported - Ready to Send" in a 248px column) wraps inside the card instead of
        // sticking out; chips elsewhere (tables, headers) keep their one-line look.
        className={`rounded-xl transition-[opacity,transform] duration-150 ease-out motion-safe:hover:-translate-y-0.5 hover:relative hover:z-10 focus-within:relative focus-within:z-10 [&_[data-status-tone]]:max-w-full [&_[data-status-tone]]:!whitespace-normal [&_[data-status-tone]]:break-words ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
          dragging?.id === id ? "scale-95 opacity-60" : busyId === id ? "opacity-60" : ""
        } ${pending?.id === id ? "ring-2 ring-brand-400" : fresh ? "bg-emerald-50 p-1.5 ring-2 ring-emerald-400" : ""} ${settledId === id ? "animate-card-settle" : ""} ${
          landing === "before" ? "shadow-[0_-4px_0_0_#0f7a44]" : landing === "after" ? "shadow-[0_4px_0_0_#0f7a44]" : ""
        } ${
          // "needsMe" boards: only a card that is new and waits on me is green; every other card is white (owner 2026-11-19),
          // whatever its own "ready" colour says.
          needsMode ? (fresh ? "[&>article]:!border-emerald-300 [&>article]:!bg-emerald-50" : "[&>article]:!border-slate-200 [&>article]:!bg-white") : ""
        }`}
      >
        {fresh && (
          <p className="mb-1.5 inline-flex items-center rounded-full bg-emerald-800 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            {needsMode ? "New for you" : "Moved here · new"}
          </p>
        )}
        {renderCard(item, column)}
        {pending?.id === id && (
          <p data-testid="card-moving" className="mt-1.5 flex items-center justify-end gap-1.5 px-2 text-xs font-semibold text-brand-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{`Moving to ${pending.label}`}</span>
          </p>
        )}
        {columnLocked && !readOnly ? (
          <>
            {!movable && <LockedNote reason={lockText(item)} />}
            {columnItems && columnItems.length > 1 && (
              <ReorderButtons
                label={(getItemLabel && getItemLabel(item)) || "this card"}
                first={index === 0}
                last={index === columnItems.length - 1}
                onMove={(step) => {
                  const ordered = columnItems.map((entry) => String(getItemId(entry)));
                  const target = ordered[index + step];
                  if (!target) return;
                  touchedRef.current.add(id);
                  placeCard(column.key, columnItems, id, target, step < 0);
                }}
              />
            )}
          </>
        ) : !readOnly && !movable ? (
          <LockedNote reason={lockText(item)} />
        ) : !readOnly && showMoveMenu(item) && (
          <MoveMenu
            item={item}
            columns={columns}
            fromKey={column.key}
            verdict={verdict}
            busy={busyId === id}
            onPick={(toKey) => attemptMove(item, toKey)}
          />
        )}
      </div>
    );
  }

  const draggedItem = dragging ? itemById.get(dragging.id) : null;
  const hoverVerdict = draggedItem && hoverColumn ? (columnLocked ? lockedVerdict(hoverColumn) : verdict(draggedItem, hoverColumn)) : null;

  if (phone) {
    // F5-05: only the stages that hold a card waiting on the signed-in role start open; finished stages wait behind
    // "Show finished (n)" at the end. A card is "mine" when the viewer can move it (canDrag); a stage is finished when
    // every card in it reads "Finished ..." (lockReason).
    // Filter chips (like Slate bins): what waits on me, what waits on others, what is finished. Default: mine when any, else all.
    const isMine = (item) => needsMe(item);
    const isDone = (item) => isFinished(item) && !needsMe(item);
    const kinds = {
      mine: items.filter(isMine),
      others: items.filter((item) => !isMine(item) && !isDone(item)),
      done: items.filter(isDone),
    };
    const chosen = chip === null ? (kinds.mine.length ? "mine" : "all") : chip;
    const shown = chosen === "all" ? items : kinds[chosen];
    const groups = columns.map((column) => ({ column, columnItems: shown.filter((item) => getColumnKey(item) === column.key) })).filter((group) => group.columnItems.length);
    const stageFinished = ({ columnItems }) => columnItems.every((item) => isFinished(item) && !needsMe(item));
    const live = groups.filter((group) => !stageFinished(group));
    const finished = groups.filter(stageFinished);
    const finishedCount = finished.reduce((sum, group) => sum + group.columnItems.length, 0);
    const isOpen = (group) => (group.column.key in phoneOpen ? phoneOpen[group.column.key] : chosen !== "all" || group.columnItems.some((item) => needsMe(item)));
    const renderGroup = (group) => {
      const { column, columnItems } = group;
      const open = isOpen(group);
      const bodyId = `${boardId}-${column.key}`;
      return (
        <section key={column.key} aria-label={column.label} className="space-y-3">
          <header className="flex items-center gap-2">
            <h3 className="section-title min-w-0 flex-1 break-words">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => setPhoneOpen((current) => ({ ...current, [column.key]: !open }))}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
                <span className="min-w-0 break-words">{column.label}</span>
              </button>
            </h3>
            <span data-testid="stage-count" className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200">{column.count ?? columnItems.length}</span>
          </header>
          {open && (
            <>
              <div id={bodyId} data-testid="stage-scroll" className={columnBodyClassName ? `space-y-2 ${columnBodyClassName}` : "space-y-3"}>{orderedIn(column.key, columnItems).map((item, index, list) => renderItem(item, column, list, index))}</div>
              {renderColumnFooter ? renderColumnFooter(column, columnItems) : null}
            </>
          )}
        </section>
      );
    };
    return (
      <div data-testid="stage-board">
        <BoardNotice notice={activeNotice.notice} onDismiss={activeNotice.dismiss} />
        <StatusLegend className="mb-3" />
        {items.length > 0 && (
          <div role="group" aria-label="Filter cards" className="mb-3 flex flex-wrap gap-2">
            {[["mine", "Needs my action"], ["others", "Waiting on others"], ["done", "Finished"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={chosen === key}
                onClick={() => setChip(chosen === key ? "all" : key)}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-safe:active:scale-[0.97] ${
                  chosen === key ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {`${label} (${kinds[key].length})`}
              </button>
            ))}
          </div>
        )}
        <div ref={regionRef} role="region" aria-label={phoneAriaLabel} className="space-y-5">
          {groups.length ? (
            <>
              {live.map(renderGroup)}
              {finished.length > 0 && (
                <div data-testid="finished-stages" className="space-y-3">
                  {chosen === "all" && <button
                    type="button"
                    aria-expanded={showFinished}
                    onClick={() => setShowFinished((current) => !current)}
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {showFinished ? `Hide finished (${finishedCount})` : `Show finished (${finishedCount})`}
                  </button>}
                  {(showFinished || chosen !== "all") && finished.map(renderGroup)}
                </div>
              )}
            </>
          ) : (
            <div data-testid="board-empty">
              <EmptyState size="sm" icon={Inbox} title={emptyText} className="px-1" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // UX-28/29: one column of the desktop board (a full column, or a narrow strip when it is empty)
  const closedSet = new Set(closedKeys);
  const closedColumns = columns.filter((column) => closedSet.has(column.key));
  const closedCount = closedColumns.reduce(
    (sum, column) => sum + (column.count ?? items.filter((item) => getColumnKey(item) === column.key).length),
    0,
  );
  function renderColumn(column) {
            const columnItems = orderedIn(column.key, items.filter((item) => getColumnKey(item) === column.key));
            const isHover = hoverColumn === column.key && Boolean(draggedItem);
            const allowedHere = isHover && hoverVerdict?.allowed;
            const refusedHere = isHover && hoverVerdict && !hoverVerdict.allowed && !hoverVerdict.same;
            // UX-28: an empty column is a narrow strip - its name and 0 - that still takes a drop (its handlers are the same)
            if (!fitColumns && !columnItems.length && !(column.count > 0)) {
              return (
                <section
                  key={column.key}
                  aria-label={column.label}
                  data-empty-strip=""
                  title={column.description ? `${column.label}: ${column.description}` : column.label}
                  onDragOver={readOnly ? undefined : (event) => onDragOver(event, column)}
                  onDragLeave={readOnly ? undefined : (event) => {
                    if (columnLocked && !(event.relatedTarget && event.currentTarget.contains(event.relatedTarget))) setDropTarget(null);
                    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
                    if (hoverColumn === column.key) setHoverColumn(null);
                  }}
                  onDrop={readOnly ? undefined : (event) => onDrop(event, column)}
                  className={`flex min-h-[14rem] w-14 shrink-0 flex-col items-center gap-2 rounded-2xl border px-1 py-3 transition-colors duration-150 ${
                    allowedHere
                      ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200"
                      : refusedHere
                        ? "border-dashed border-red-300 bg-red-50/40"
                        : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  {numbered && (
                    <span data-testid="stage-number" className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-xs font-bold text-white" aria-hidden="true">
                      {columns.findIndex((entry) => entry.key === column.key) + 1}
                    </span>
                  )}
                  <span data-testid="stage-count" className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200">0</span>
                  <h3 className="section-title max-h-56 text-slate-500 [writing-mode:vertical-rl]">{column.label}</h3>
                </section>
              );
            }
            return (
              <section
                key={column.key}
                aria-label={column.label}
                onDragOver={readOnly ? undefined : (event) => onDragOver(event, column)}
                onDragLeave={readOnly ? undefined : (event) => {
                  if (columnLocked && !(event.relatedTarget && event.currentTarget.contains(event.relatedTarget))) setDropTarget(null);
                  // Moving between the column's own cards and notice fires dragleave too; only a real exit clears the hover,
                  // or the red "Nothing was changed" notice blinks out mid-drag.
                  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
                  if (hoverColumn === column.key) setHoverColumn(null);
                }}
                onDrop={readOnly ? undefined : (event) => onDrop(event, column)}
                className={`${columnClassName} ${fitColumns ? "min-w-64 flex-1 basis-0" : "min-h-[14rem] shrink-0"} flex flex-col rounded-2xl border bg-slate-50/70 p-3 transition-colors duration-150 ${
                  allowedHere
                    ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200"
                    : refusedHere
                      ? "border-dashed border-red-300 bg-red-50/40"
                      : "border-slate-200"
                }`}
              >
                {renderColumnHeader ? (
                  renderColumnHeader(column, columnItems)
                ) : (
                  // Owner feedback 2026-11-23 (stage 5): the Research Gate header - the number in a circle when the board is numbered
                  <StageColumnHeader
                    column={column}
                    count={column.count ?? columnItems.length}
                    number={numbered ? columns.findIndex((entry) => entry.key === column.key) + 1 : null}
                  />
                )}
                {refusedHere && (
                  <InlineNotice tone="danger" role="status" className="mb-2 px-2.5 py-2 text-xs">
                    {refusalMessage(hoverVerdict.reason, "That move is not allowed.")}
                  </InlineNotice>
                )}
                {/* UX-04: a long column scrolls inside itself, so a tall column out of sight cannot stretch the board. */}
                <div data-testid="stage-scroll" className={columnBodyClassName ? `flex-1 space-y-2 ${columnBodyClassName}` : DEFAULT_COLUMN_BODY}>
                  {columnItems.length ? (
                    columnItems.map((item, index) => renderItem(item, column, columnItems, index))
                  ) : (
                    <div data-testid="board-empty">
                      {column.empty ? (
                        <EmptyState size="sm" icon={Inbox} title="Nothing here" hint={column.empty} className="px-1" />
                      ) : (
                        <EmptyState size="sm" icon={Inbox} title={emptyText} className="px-1" />
                      )}
                    </div>
                  )}
                </div>
                {renderColumnFooter ? renderColumnFooter(column, columnItems) : null}
              </section>
            );
  }

  return (
    <div data-testid="stage-board">
      <BoardNotice notice={activeNotice.notice} onDismiss={activeNotice.dismiss} />
      {/* UX-15: the colour key and the "more stages" hint share one line */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusLegend />
        {(hidden.left > 0 || hidden.right > 0) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p data-testid="board-scroll-hint" className="meta font-medium text-slate-600">
            {hidden.right > 0
              ? `${hidden.right} more ${hidden.right === 1 ? "stage" : "stages"} to the right →${
                  hidden.left > 0 ? ` · ${hidden.left} to the left` : ""
                }`
              : `← ${hidden.left} ${hidden.left === 1 ? "stage" : "stages"} to the left`}
          </p>
          <ScrollButton direction="left" disabled={hidden.left === 0} onClick={() => scrollBoard(-1)} />
          <ScrollButton direction="right" disabled={hidden.right === 0} onClick={() => scrollBoard(1)} />
        </div>
        )}
      </div>
      <div className="relative">
      <div
        ref={regionRef}
        className="relative max-w-full overflow-x-auto rounded-xl pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <div className={fitColumns ? "flex w-full gap-3" : "flex w-max items-start gap-3"}>
          {columns.filter((column) => !closedSet.has(column.key)).map((column) => renderColumn(column))}
          {closedColumns.length > 0 && (
            closedOpen ? (
              <div data-closed-strip="open" className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-2">
                <button
                  type="button"
                  aria-expanded="true"
                  onClick={() => setClosedOpen(false)}
                  className="flex min-h-[14rem] w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl px-1 py-3 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="section-title [writing-mode:vertical-rl]">Closed</span>
                  <span className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200">{closedCount}</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {closedColumns.map((column) => renderColumn(column))}
              </div>
            ) : (
              <div
                data-closed-strip="folded"
                onDragEnter={readOnly ? undefined : () => setClosedOpen(true)}
                onDragOver={readOnly ? undefined : () => setClosedOpen(true)}
                className="min-h-[14rem] w-14 shrink-0 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70"
              >
                <button
                  type="button"
                  aria-expanded="false"
                  title={`Show ${closedColumns.map((column) => column.label).join(", ")}`}
                  onClick={() => setClosedOpen(true)}
                  className="flex h-full min-h-[14rem] w-full cursor-pointer flex-col items-center gap-2 rounded-2xl px-1 py-3 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="section-title [writing-mode:vertical-rl]">Closed</span>
                  <span className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200">{closedCount}</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
      {hidden.right > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-xl bg-gradient-to-l from-canvas to-transparent" />
      )}
      {hidden.left > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-xl bg-gradient-to-r from-canvas to-transparent" />
      )}
      </div>
    </div>
  );
}

function reducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * The text a board says about what just happened: `{ tone: "success" | "error", text }`, gone after 6 s (9 s for an error).
 * A board page that has actions of its own (a dialog, a group step) calls this once, renders <BoardNotice> above the
 * board or table, and passes the result to StageBoard as `boardNotice`, so a drop, a dialog and a group step all report
 * in the same place.
 */
export function useBoardNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setNotice(null);
  }, []);
  const show = useCallback((tone, text) => {
    setNotice({ tone, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), tone === "error" ? 9000 : 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { notice, show, dismiss };
}

// The one place a board says what happened to a move (done, or refused and why). At the top of the board, role="status",
// and brought into view when it appears, so it is not lost off-screen on a long page. StageBoard's own API is unchanged.
export function BoardNotice({ notice, onDismiss }) {
  const ref = useRef(null);
  useEffect(() => {
    // scroll-mt-20 on the wrapper keeps it clear of the sticky page header
    if (notice) ref.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [notice]);
  return (
    <div ref={ref} className="mb-3 min-h-[1px] scroll-mt-20">
      {notice && (
        <InlineNotice role="status" data-testid="board-notice" tone={notice.tone === "error" ? "danger" : "success"} icon onDismiss={onDismiss}>
          {notice.text}
        </InlineNotice>
      )}
    </div>
  );
}

// The line every board carries above its filters: how many cards are in each column ("1 submitted, 2 on leave") and how
// a card is moved. Process boards, Practicum and Graduation all use it, so the boards read alike (IM24).
export function boardSummaryLine(columns, totals, noun) {
  const parts = columns.filter((column) => (totals[column.key] || 0) > 0).map((column) => `${totals[column.key]} ${column.label}`); // a stage name stays as written: "AWOL", "With the Dean"
  return parts.length ? parts.join(", ") : `No ${noun} yet`;
}

export function BoardSummary({ line, actions = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3" data-testid="board-summary">
      <div className="min-w-0">
        {/* UX-03: the column headers carry the counts on screen; the sentence stays for screen readers (it is live). */}
        <p data-summary-line className="sr-only" aria-live="polite">
          {line}
        </p>
        {/* UX-20 (IM50): the drag and "Move to..." hint is in the page's Help panel (BOARD_HELP), not above every board. */}
      </div>
      {actions}
    </div>
  );
}

// "Scroll board left/right": a real button, so a keyboard, a screen reader and a phone can reach stages that are out of sight.
function ScrollButton({ direction, disabled, onClick }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Scroll board ${direction}`}
      className="inline-grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 max-sm:h-11 max-sm:w-11"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

// UX-04: the card list of a desktop column, when the page does not set its own (Research Gate uses the same idea).
export const DEFAULT_COLUMN_BODY = "max-h-[34rem] space-y-3 overflow-y-auto overscroll-contain pr-1";

// The words a columnLocked board (Withdrawal, Practicum, Graduation) shows above its filters.
/**
 * UX-20: how the board works, said once, in the Help panel of every page with a board. Three kinds (owner 2026-11-19):
 * "move" boards take a drag or "Move to..." into another column; "locked" boards (Withdrawal, Practicum, Graduation) move a
 * card by themselves and only reorder inside a column; "view" boards (Research Gate) are read only.
 */
export const BOARD_HELP = {
  move: 'Drag a card to another column, or use "Move to..." on the card; both do the same as the buttons in its window.',
  locked: "A card moves to the next column by itself as each step is approved. Drag a card up or down to reorder it inside its column.",
  view: "A card moves to the next column by itself as each step is recorded; this board is for viewing.",
};

// columnLocked: the keyboard and touch alternative to dragging a card up or down inside its column.
function ReorderButtons({ label, first, last, onMove }) {
  const base =
    "inline-grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 max-sm:h-11 max-sm:w-11";
  return (
    <div className="mt-1 flex justify-end gap-1" role="group" aria-label={`Reorder ${label}`}>
      <button type="button" className={base} disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${label} up`} title="Move up">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" className={base} disabled={last} onClick={() => onMove(1)} aria-label={`Move ${label} down`} title="Move down">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// Shown instead of the drag handle and the "Move to..." menu on a card that cannot be moved.
// The reason is plain text so a screen reader and a keyboard user get it too.
function LockedNote({ reason }) {
  return (
    <p className="mt-1.5 flex items-start justify-end gap-1.5 px-2 py-1 text-xs font-semibold text-slate-600">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{reason}</span>
    </p>
  );
}

// "Move to..." - the keyboard and touch alternative to dragging. It lists every other
// column and says why a move is not possible, instead of hiding it.
function MoveMenu({ item, columns, fromKey, verdict, onPick, busy }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [place, setPlace] = useState(null); // { left, top, width, maxHeight }: where the open menu sits on the screen

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);

  // The menu is placed on the screen (position: fixed), not inside the column: a card in the first column used to open it
  // past the left edge, and the board's scroller cut it off. It keeps an 8px gap from every edge and opens above the
  // button when there is no room below.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return undefined;
    }
    function measure() {
      const button = buttonRef.current?.getBoundingClientRect();
      if (!button) return;
      const gap = 8;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const width = Math.min(288, vw - gap * 2);
      const left = Math.min(Math.max(gap, button.right - width), vw - width - gap);
      const height = menuRef.current?.scrollHeight || 0;
      const below = vh - button.bottom - gap - 4;
      const above = button.top - gap - 4;
      const up = height > below && above > below;
      const room = Math.max(120, up ? above : below);
      setPlace({ left, width, maxHeight: room, top: up ? Math.max(gap, button.top - 4 - Math.min(height, room)) : button.bottom + 4 });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    menuItems()[0]?.focus(); // the focus moves into the menu
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // ArrowUp/ArrowDown (wrapping), Home and End move between the items; Tab leaves the menu. Enter and Space press the
  // focused item, as they do on any button.
  function onMenuKeyDown(event) {
    const entries = menuItems();
    const at = entries.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = entries[(at + 1) % entries.length];
    else if (event.key === "ArrowUp") next = entries[(at - 1 + entries.length) % entries.length];
    else if (event.key === "Home") next = entries[0];
    else if (event.key === "End") next = entries[entries.length - 1];
    else if (event.key === "Tab") {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  }

  return (
    <div ref={wrapRef} className="relative mt-1.5 flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Move className="h-3.5 w-3.5" />} Move to…
      </button>
      {/* Rendered on <body> (owner feedback 2026-11-23, stage 8): the card lifts 2px on hover, and a transformed ancestor
          becomes the box a position: fixed menu is placed in - the menu then opened off the right edge, under the board. */}
      {open && createPortal(
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          style={place ? { left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight } : { opacity: 0, left: 0, top: 0 }}
          className="fixed z-header overflow-y-auto animate-notice-in rounded-xl border border-slate-200 bg-white p-1 shadow-lift"
        >
          {columns
            .filter((column) => column.key !== fromKey)
            .map((column) => {
              const check = verdict(item, column.key);
              return (
                <li key={column.key} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={!check.allowed}
                    onClick={() => {
                      setOpen(false);
                      buttonRef.current?.focus(); // a dialog opened by the move hands the focus back here
                      onPick(column.key);
                    }}
                    className={`flex w-full cursor-pointer flex-col rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      check.allowed ? "text-ink hover:bg-brand-50" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{column.label}</span>
                    {!check.allowed && check.reason && <span className="text-xs font-normal text-red-700 break-words">{refusalMessage(check.reason)}</span>}
                  </button>
                </li>
              );
            })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
