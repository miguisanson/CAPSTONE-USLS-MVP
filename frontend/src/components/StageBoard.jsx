import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Move, X } from "lucide-react";

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
 *   showMoveMenu   (item) => boolean (default true): the "Move to..." button under a card
 *   checkMove      (item, toColumn) => { allowed: boolean, reason?: string }
 *                  default: allowed everywhere else
 *   onMove         async (item, toColumn, fromColumn) => { message?: string } | void
 *                  throw an Error (its message is shown) to refuse
 *   renderColumnHeader  (column, items) => node, to replace the default header
 *   renderColumnFooter  (column, items) => node
 *   emptyText      text for an empty column
 *   columnClassName  classes for each column (width etc.)
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
  showMoveMenu = () => true,
  checkMove,
  onMove,
  renderColumnHeader,
  renderColumnFooter,
  emptyText = "Nothing here",
  columnClassName = "w-[290px]",
  ariaLabel = "Stage board",
  readOnly = false,
}) {
  const [dragging, setDragging] = useState(null); // { id, from }
  const [hoverColumn, setHoverColumn] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, text }
  const noticeTimer = useRef(null);

  const columnByKey = useMemo(() => Object.fromEntries(columns.map((column) => [column.key, column])), [columns]);
  const itemById = useMemo(() => new Map(items.map((item) => [String(getItemId(item)), item])), [items, getItemId]);

  const show = useCallback((tone, text) => {
    setNotice({ tone, text });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), tone === "error" ? 9000 : 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

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

  const attemptMove = useCallback(
    async (item, toKey) => {
      const fromKey = getColumnKey(item);
      const target = columnByKey[toKey];
      if (!target || fromKey === toKey) return;
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
    [columnByKey, getColumnKey, getItemId, onMove, show, verdict],
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
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-800"
            }`}
          >
            {notice.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer rounded p-0.5 hover:bg-black/5" aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div
        className="max-w-full overflow-x-auto rounded-xl pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <div className="flex w-max gap-4">
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
                    ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-200"
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
                      <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{columnItems.length}</span>
                    </div>
                    {column.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{column.description}</p>}
                  </header>
                )}
                {refusedHere && (
                  <p role="status" className="mb-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700">
                    {hoverVerdict.reason || "That move is not allowed."}
                  </p>
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
                          className={`rounded-xl transition-opacity ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
                            dragging?.id === id ? "opacity-50" : busyId === id ? "opacity-60" : ""
                          }`}
                        >
                          {renderCard(item)}
                          {!readOnly && showMoveMenu(item) && (
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
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">{column.empty || emptyText}</p>
                  )}
                </div>
                {renderColumnFooter ? renderColumnFooter(column, columnItems) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
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
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Move className="h-3.5 w-3.5" /> Move to…
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-72 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
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
                      check.allowed ? "text-ink hover:bg-brand-50" : "text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{column.label}</span>
                    {!check.allowed && check.reason && <span className="text-xs font-normal text-red-600">{check.reason}</span>}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
