import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, Lock, Move } from "lucide-react";
import { EmptyState, InlineNotice } from "./ui/index.js";

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
 *   renderCard     (item) => node (the card body; the board adds drag and the move menu)
 *   canDrag        (item) => boolean (default true)
 *   lockReason     (item) => string: why a card that cannot be moved cannot be moved, e.g.
 *                  "Waiting for: Student". A card that cannot be dragged shows a lock and this text
 *                  (real text, not a tooltip) and has no "Move to..." menu - the same on every board.
 *   showMoveMenu   (item) => boolean (default true): the "Move to..." button under a card
 *   checkMove      (item, toColumn) => { allowed: boolean, reason?: string }
 *                  default: allowed everywhere else
 *   onMove         async (item, toColumn, fromColumn) => { message?: string } | void
 *                  throw an Error (its message is shown) to refuse
 *   renderColumnHeader  (column, items) => node, to replace the default header
 *   renderColumnFooter  (column, items) => node
 *   emptyText      text for an empty column (shown with the shared EmptyState)
 *   columnClassName  classes for each column (width etc.); the default is a narrow column so more stages fit
 *
 * When the stages are wider than the screen the board says so: a line above it ("3 more stages to the right"),
 * "Scroll board left/right" buttons (keyboard reachable) and a soft fade at the cut edge. Column titles wrap, never cut.
 *   ariaLabel      label for the scrolling region
 *   readOnly       turns drag and the menu off
 */
export default function StageBoard({
  columns,
  items,
  getItemId,
  getColumnKey,
  renderCard,
  canDrag = () => true,
  lockReason,
  showMoveMenu = () => true,
  checkMove,
  onMove,
  renderColumnHeader,
  renderColumnFooter,
  emptyText = "Nothing here",
  columnClassName = "w-[248px]",
  ariaLabel = "Stage board",
  readOnly = false,
}) {
  const [dragging, setDragging] = useState(null); // { id, from }
  const [hoverColumn, setHoverColumn] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, text }
  const noticeTimer = useRef(null);
  const regionRef = useRef(null);
  const [hidden, setHidden] = useState({ left: 0, right: 0 }); // stages not fully in view on each side

  const columnByKey = useMemo(() => Object.fromEntries(columns.map((column) => [column.key, column])), [columns]);
  const itemById = useMemo(() => new Map(items.map((item) => [String(getItemId(item)), item])), [items, getItemId]);

  const show = useCallback((tone, text) => {
    setNotice({ tone, text });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), tone === "error" ? 9000 : 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

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
  }, [measureHidden, columns.length]);

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
        show("error", `${lockText(item).replace(/\.$/, "")}. This card cannot be moved right now.`);
        return;
      }
      const check = verdict(item, toKey);
      if (!check.allowed) {
        show("error", check.reason || `This item cannot move to "${target.label}".`);
        return;
      }
      setBusyId(String(getItemId(item)));
      try {
        const result = await onMove(item, target, columnByKey[fromKey]);
        if (result && result.message) show("success", result.message);
      } catch (error) {
        show("error", error?.message || "That move was refused.");
      } finally {
        setBusyId(null);
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
  }

  function onDragOver(event, column) {
    if (!dragging) return;
    const item = itemById.get(dragging.id);
    if (!item) return;
    const check = verdict(item, column.key);
    // Always allow the drop event so a refused move can explain itself.
    event.preventDefault();
    event.dataTransfer.dropEffect = check.allowed ? "move" : "none";
    if (hoverColumn !== column.key) setHoverColumn(column.key);
  }

  function onDrop(event, column) {
    event.preventDefault();
    const id = dragging?.id || event.dataTransfer.getData("text/plain");
    const item = itemById.get(String(id));
    setDragging(null);
    setHoverColumn(null);
    if (item) attemptMove(item, column.key);
  }

  const draggedItem = dragging ? itemById.get(dragging.id) : null;
  const hoverVerdict = draggedItem && hoverColumn ? verdict(draggedItem, hoverColumn) : null;

  return (
    <div>
      <div aria-live="polite" className="mb-3 min-h-[1px]">
        {notice && (
          <InlineNotice tone={notice.tone === "error" ? "danger" : "success"} icon onDismiss={() => setNotice(null)}>
            {notice.text}
          </InlineNotice>
        )}
      </div>
      {(hidden.left > 0 || hidden.right > 0) && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
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
      <div className="relative">
      <div
        ref={regionRef}
        className="relative max-w-full overflow-x-auto rounded-xl pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <div className="flex w-max gap-3">
          {columns.map((column) => {
            const columnItems = items.filter((item) => getColumnKey(item) === column.key);
            const isHover = hoverColumn === column.key && Boolean(draggedItem);
            const allowedHere = isHover && hoverVerdict?.allowed;
            const refusedHere = isHover && hoverVerdict && !hoverVerdict.allowed && !hoverVerdict.same;
            return (
              <section
                key={column.key}
                aria-label={column.label}
                onDragOver={readOnly ? undefined : (event) => onDragOver(event, column)}
                onDragLeave={readOnly ? undefined : () => hoverColumn === column.key && setHoverColumn(null)}
                onDrop={readOnly ? undefined : (event) => onDrop(event, column)}
                className={`${columnClassName} flex shrink-0 flex-col rounded-2xl border bg-slate-50/70 p-3 transition-colors ${
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
                  <header className="mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="section-title min-w-0 break-words">{column.label}</h3>
                      <span className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200">{columnItems.length}</span>
                    </div>
                    {column.description && <p className="meta mt-1 leading-relaxed">{column.description}</p>}
                  </header>
                )}
                {refusedHere && (
                  <InlineNotice tone="danger" role="status" className="mb-2 px-2.5 py-2 text-xs">
                    {hoverVerdict.reason || "That move is not allowed."}
                  </InlineNotice>
                )}
                <div className="flex-1 space-y-3">
                  {columnItems.length ? (
                    columnItems.map((item) => {
                      const id = String(getItemId(item));
                      const draggable = !readOnly && canDrag(item);
                      return (
                        <div
                          key={id}
                          draggable={draggable}
                          onDragStart={draggable ? (event) => onDragStart(event, item) : undefined}
                          onDragEnd={onDragEnd}
                          aria-busy={busyId === id}
                          data-locked={!readOnly && !draggable ? "true" : undefined}
                          className={`rounded-xl transition-opacity ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
                            dragging?.id === id ? "opacity-50" : busyId === id ? "opacity-60" : ""
                          }`}
                        >
                          {renderCard(item)}
                          {!readOnly && !draggable ? (
                            <LockedNote reason={lockText(item)} />
                          ) : !readOnly && showMoveMenu(item) && (
                            <MoveMenu
                              item={item}
                              columns={columns}
                              fromKey={column.key}
                              verdict={verdict}
                              disabled={busyId === id}
                              onPick={(toKey) => attemptMove(item, toKey)}
                            />
                          )}
                        </div>
                      );
                    })
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
          })}
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

// The line every board carries above its filters: how many cards are in each column ("1 submitted, 2 on leave") and how
// a card is moved. Process boards, Practicum and Graduation all use it, so the boards read alike (IM24).
export function boardSummaryLine(columns, totals, noun) {
  const parts = columns.filter((column) => (totals[column.key] || 0) > 0).map((column) => `${totals[column.key]} ${column.label}`); // a stage name stays as written: "AWOL", "With the Dean"
  return parts.length ? parts.join(", ") : `No ${noun} yet`;
}

export function BoardSummary({ line, windowName = "request window", actions = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3" data-testid="board-summary">
      <div className="min-w-0">
        <p data-summary-line className="text-base font-semibold text-ink" aria-live="polite">
          {line}
        </p>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Dragging a card to another column does the same as the buttons in its {windowName}. On a keyboard or phone, use
          &quot;Move to...&quot; on the card.
        </p>
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
function MoveMenu({ item, columns, fromKey, verdict, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative mt-1.5 flex justify-end">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11"
      >
        <Move className="h-3.5 w-3.5" /> Move to…
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-header mt-1 w-72 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-1 shadow-lift"
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
                    aria-disabled={!check.allowed}
                    onClick={() => {
                      setOpen(false);
                      onPick(column.key);
                    }}
                    className={`flex w-full cursor-pointer flex-col rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      check.allowed ? "text-ink hover:bg-brand-50" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{column.label}</span>
                    {!check.allowed && check.reason && <span className="text-xs font-normal text-red-700">{check.reason}</span>}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
