// DataTable (UI-SPEC section 4 and 5): one table for the whole app. It scrolls sideways INSIDE its own wrapper (the
// page never does), has sticky-able headers with scope="col", optional sort / search / pagination / CSV export done
// on the client, and hooks to let the server do paging and sorting instead.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Inbox } from "lucide-react";
import { csvCell, downloadBlob } from "../../lib/format";
import { Button } from "./Button.jsx";
import { EmptyState, Pagination, SearchInput, SkeletonTable } from "./Feedback.jsx";

const cx = (...parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

// Class strings are written out in full so Tailwind sees them.
const MIN_WIDTH = { sm: "min-w-[640px]", md: "min-w-[760px]", lg: "min-w-[960px]" };
// stackOnPhone: true stacks below sm (640 px); "md" stacks below 768 px, for a page whose table must not scroll at 200 % zoom (I-390).
const STACK_BY = {
  sm: { table: "max-sm:block max-sm:min-w-0", head: "max-sm:sr-only", body: "max-sm:block", row: "max-sm:block max-sm:px-1 max-sm:py-2", cell: "max-sm:block max-sm:!py-1 max-sm:before:block max-sm:before:text-[11px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-wide max-sm:before:text-slate-500 max-sm:before:content-[attr(data-label)]" },
  md: { table: "max-md:block max-md:min-w-0", head: "max-md:sr-only", body: "max-md:block", row: "max-md:block max-md:px-1 max-md:py-2", cell: "max-md:block max-md:!py-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-wide max-md:before:text-slate-500 max-md:before:content-[attr(data-label)]" },
};
// A soft edge on the sides that still have more columns, so a cut-off column shows as scrollable (I-406).
const SCROLL_SHADOW = {
  background:
    "linear-gradient(to right, #fff 30%, rgba(255,255,255,0)) left center / 40px 100% no-repeat local, linear-gradient(to left, #fff 30%, rgba(255,255,255,0)) right center / 40px 100% no-repeat local, linear-gradient(to right, rgba(15,23,42,.18), rgba(15,23,42,0)) left center / 12px 100% no-repeat scroll, linear-gradient(to left, rgba(15,23,42,.18), rgba(15,23,42,0)) right center / 12px 100% no-repeat scroll, #fff",
};
const HIDE_BELOW = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };
const JUSTIFY = { left: "justify-start", right: "justify-end", center: "justify-center" };
const LOCAL_PAGE_SIZE = 10; // client-side lists
const INTERACTIVE = "a,button,input,select,textarea,label,summary,[role='button'],[role='link']";

const plain = (value) => (Array.isArray(value) ? value.join("; ") : value);
const cellValue = (col, row) => (col.sortValue ? col.sortValue(row) : plain(row[col.key]));

/** Text a column contributes to the search box: its sortValue, else the field, else nothing. */
function searchText(columns, row) {
  return columns
    .map((col) => {
      const v = cellValue(col, row);
      return v == null ? "" : String(v);
    })
    .join(" ")
    .toLowerCase();
}

function compare(a, b) {
  const blankA = a == null || a === "";
  const blankB = b == null || b === "";
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1; // blanks always last in ascending order
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const isSortableValue = (v) => typeof v === "string" || typeof v === "number" || v instanceof Date;

/**
 * Whether a column header sorts. An explicit `sortable` on the column wins. Otherwise (conformity, finding 15: every list
 * sorts alike) a column sorts when the table sorts its own rows and the column has a text header and either a
 * `sortValue` or a plain text / number / date field in the rows. Columns without a text header (an "Open" column), without
 * a field to read (an Action column built from `cell` alone) and tables the server pages or sorts are left alone.
 */
function columnSortable(col, rows, tableSorts) {
  if (col.sortable !== undefined) return Boolean(col.sortable);
  if (!tableSorts) return false;
  if (typeof col.header !== "string" || !col.header.trim()) return false;
  if (col.sortValue) return true;
  return rows.some((row) => isSortableValue(row[col.key]));
}

function SortIcon({ dir }) {
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return <Icon className={cx("h-3.5 w-3.5 shrink-0", dir ? "text-brand-700" : "text-slate-400")} aria-hidden="true" />;
}

/**
 * @param columns   [{ key, header, cell(row, index), align, sortable, sortValue(row), hideBelow, className, width }]
 *                  `sortable` is on by default for a column with a text header and a text, number or date value (see
 *                  columnSortable); `sortable: false` opts a column out. `header` is text or a node. `cell` defaults to row[key]. `sortValue` defaults to row[key] and is
 *                  also what the search box and the CSV export read. `hideBelow` ("sm" | "md" | "lg" | "xl") hides
 *                  the column on narrower screens. `width` is any CSS width.
 * @param rows      array of row objects
 * @param rowKey    field name or (row) => key; default "id"
 * @param onRowClick  (row) => void; the row becomes keyboard reachable (Tab, Enter). Put a real link in the first cell.
 * @param rowHref   (row) => path; the first cell becomes a router <Link> and the whole row opens it. Do not nest links.
 * @param empty     { icon, title, hint }; shown instead of the table when there are no rows
 * @param caption   screen-reader caption (what the table lists); strongly recommended
 * @param minWidth  "sm" (640px, default) | "md" (760px) | "lg" (960px): below this the wrapper scrolls
 * @param dense     tighter cells
 * @param stickyHeader   header row stays visible while the body scrolls (the wrapper gets a max height)
 * @param stickyFirst    first column stays visible while scrolling sideways
 * @param loading   show a skeleton instead of rows
 * @param toolbar   node shown beside the search box and the CSV button
 * @param searchable  true | placeholder text | { placeholder, label, value, onChange }. Client-side filter over every
 *                  column's text; pass value + onChange to control it (server search: then rows are not filtered here)
 * @param pageSize  rows per page for client paging; default 10; pass 0 or false for no paging
 * @param pagination  { page, pageCount, total, pageSize, onPage }: server paging. The rows are shown as given and the
 *                  caller fetches the page. (Default server page size is 25.)
 * @param csv       true | { filename, columns: [{ header, value(row) }] }: Export CSV button. Exports every row that
 *                  matches the search and sort (client mode), or the rows given (server mode)
 * @param stackOnPhone  on a phone (below sm; "md" = below 768 px) each row becomes a block of "Header: value" lines, so nothing scrolls sideways
 * @param sortable  false turns off the default sorting for the whole table (a column can still say `sortable: true`)
 * @param sort      { key, dir: "asc" | "desc" } to control sorting; with onSort(key, dir) (dir null = cleared) the
 *                  caller sorts, otherwise the table sorts its own rows
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = "id",
  onRowClick,
  rowHref,
  empty,
  caption,
  minWidth = "sm",
  dense = false,
  stickyHeader = false,
  stickyFirst = false,
  loading = false,
  toolbar,
  searchable = false,
  pageSize,
  pagination,
  csv,
  sortable = true,
  stackOnPhone = false,
  sort,
  onSort,
  className = "",
  ...rest
}) {
  const STACK = STACK_BY[stackOnPhone === "md" ? "md" : "sm"];
  const serverPaged = Boolean(pagination);
  const sortControlled = typeof onSort === "function";
  const searchControlled = Boolean(searchable && typeof searchable === "object" && "value" in searchable);
  // The table sorts its own rows unless the caller sorts (onSort) or the server pages; then only a column that says
  // `sortable: true` shows a sort button.
  const tableSorts = sortable !== false && !sortControlled && !serverPaged;
  const sortableKeys = useMemo(
    () => new Set(columns.filter((col) => columnSortable(col, rows, tableSorts)).map((col) => col.key)),
    [columns, rows, tableSorts],
  );

  const [innerSort, setInnerSort] = useState(null);
  const [innerSearch, setInnerSearch] = useState("");
  const [innerPage, setInnerPage] = useState(1);

  const sortState = (sort !== undefined ? sort : innerSort) || null;
  const search = searchControlled ? searchable.value || "" : innerSearch;
  const query = search.trim().toLowerCase();

  const searchOptions = typeof searchable === "object" ? searchable : {};
  const searchPlaceholder = typeof searchable === "string" ? searchable : searchOptions.placeholder;

  const getKey = typeof rowKey === "function" ? rowKey : (row, i) => row[rowKey] ?? i;

  // 1. filter  2. sort  (client mode only; a server-driven table shows what it was given)
  const processed = useMemo(() => {
    let list = rows;
    if (query && !searchControlled) list = list.filter((row) => searchText(columns, row).includes(query));
    if (sortState && !sortControlled && !serverPaged) {
      const col = columns.find((c) => c.key === sortState.key);
      if (col) {
        const sign = sortState.dir === "desc" ? -1 : 1;
        list = list
          .map((row, i) => [row, i])
          .sort((x, y) => {
            const a = cellValue(col, x[0]);
            const b = cellValue(col, y[0]);
            const blank = (v) => v == null || v === "";
            if (blank(a) || blank(b)) return compare(a, b); // blanks stay last in both directions
            return sign * compare(a, b) || x[1] - y[1];
          })
          .map(([row]) => row);
      }
    }
    return list;
  }, [rows, columns, query, searchControlled, sortState, sortControlled, serverPaged]);

  // 3. page
  const size = serverPaged ? pagination.pageSize || (pageSize ? pageSize : undefined) : pageSize === undefined ? LOCAL_PAGE_SIZE : pageSize;
  const pagedLocally = !serverPaged && Boolean(size) && size > 0;
  const localPageCount = pagedLocally ? Math.max(1, Math.ceil(processed.length / size)) : 1;
  const localPage = Math.min(innerPage, localPageCount);
  const visibleRows = pagedLocally ? processed.slice((localPage - 1) * size, localPage * size) : processed;

  const emptyCopy = {
    icon: Inbox,
    title: "No items to show",
    hint: "Items will appear here once there is something to list.",
    ...empty,
  };
  if (query) emptyCopy.hint = "Try a different search or filter.";

  function toggleSort(col) {
    const current = sortState && sortState.key === col.key ? sortState.dir : null;
    const next = current === null ? "asc" : current === "asc" ? "desc" : null;
    if (sortControlled) onSort(col.key, next);
    else setInnerSort(next ? { key: col.key, dir: next } : null);
    if (!serverPaged) setInnerPage(1);
  }

  function setSearch(value) {
    if (searchControlled) searchable.onChange?.(value);
    else setInnerSearch(value);
    setInnerPage(1);
  }

  function exportCsv() {
    const spec = typeof csv === "object" ? csv : {};
    const fields = spec.columns
      || columns.map((c) => ({ header: typeof c.header === "string" ? c.header : c.key, value: (row) => cellValue(c, row) }));
    const lines = [fields.map((f) => csvCell(f.header)).join(",")];
    for (const row of processed) lines.push(fields.map((f) => csvCell(f.value(row))).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, spec.filename || "export.csv");
  }

  const showToolbar = Boolean(searchable || csv || toolbar);
  const total = serverPaged ? pagination.total : processed.length;
  const noRows = !loading && visibleRows.length === 0;
  const pad = dense ? "py-2" : "py-3";
  const firstCol = columns[0]?.key;

  function renderCell(col, row, index, isFirst) {
    let content = col.cell ? col.cell(row, index) : plain(row[col.key]);
    if (content == null || content === "") content = <span className="text-slate-500">-</span>;
    if (isFirst && rowHref) {
      content = (
        <Link to={rowHref(row)} data-row-link="" className="font-semibold text-ink hover:text-brand-700 hover:underline">
          {content}
        </Link>
      );
    }
    return content;
  }

  function handleRowClick(e, row) {
    // a click on a link, button or field inside the row is that control's own; only a click on the bare row acts
    if (e.target !== e.currentTarget && e.target.closest(INTERACTIVE)) return;
    if (rowHref) e.currentTarget.querySelector("[data-row-link]")?.click();
    else onRowClick?.(row);
  }

  const clickable = Boolean(onRowClick || rowHref);

  // A box that scrolls sideways must be reachable by keyboard, or a keyboard user can never see the cut-off columns
  // (axe: scrollable-region-focusable, WCAG 2.1.1). It becomes a focusable, named region only while it really scrolls,
  // so a table that fits adds no extra Tab stop.
  const scrollRef = useRef(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [loading, noRows, visibleRows.length, columns.length]);

  return (
    <div className={cx("space-y-3", className)} {...rest}>
      {showToolbar && (
        <div data-table-toolbar="" className="flex flex-wrap items-center gap-2">
          {searchable && (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={searchPlaceholder || "Search…"}
              label={searchOptions.label || "Search table"}
              className="w-full sm:w-72"
            />
          )}
          {toolbar}
          {csv && (
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={processed.length === 0} className="sm:ml-auto">
              Export CSV
            </Button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        data-table-scroll=""
        style={scrolls ? SCROLL_SHADOW : undefined}
        tabIndex={scrolls ? 0 : undefined}
        role={scrolls ? "region" : undefined}
        aria-label={scrolls ? (caption ? `${caption} (scrolls sideways)` : "Table (scrolls sideways)") : undefined}
        className={cx(
          "relative overflow-x-auto rounded-xl border border-slate-200 bg-white focus-visible:ring-inset focus-visible:ring-offset-0",
          stickyHeader && "max-h-[70dvh] overflow-y-auto",
        )}
      >
        {loading ? (
          <SkeletonTable rows={Math.min(size || 5, 8)} />
        ) : noRows ? (
          <EmptyState {...emptyCopy} size="sm" />
        ) : (
          <table className={cx("w-full text-sm", MIN_WIDTH[minWidth] || MIN_WIDTH.sm, stackOnPhone && STACK.table)}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className={cx("bg-slate-50", stickyHeader && "sticky top-0 z-10", stackOnPhone && STACK.head)}>
              <tr>
                {columns.map((col, ci) => {
                  const dir = sortState && sortState.key === col.key ? sortState.dir : null;
                  const canSort = sortableKeys.has(col.key);
                  const align = col.align || "left";
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={canSort ? (dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none") : undefined}
                      style={col.width ? { width: col.width } : undefined}
                      className={cx(
                        "eyebrow whitespace-nowrap px-3 py-2.5",
                        ALIGN[align],
                        // a sticky <thead> does not stick in every browser, so stick the cells too
                        stickyHeader && "sticky top-0 z-10 bg-slate-50",
                        stickyFirst && ci === 0 && "sticky left-0 z-20 bg-slate-50",
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className={cx(
                            "inline-flex cursor-pointer items-center gap-1 rounded-md uppercase tracking-wide hover:text-slate-700 max-sm:min-h-11",
                            JUSTIFY[align],
                          )}
                        >
                          {col.header}
                          <SortIcon dir={dir} />
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={stackOnPhone ? STACK.body : undefined}>
              {visibleRows.map((row, ri) => (
                <tr
                  key={getKey(row, ri)}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? (e) => handleRowClick(e, row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(e, row);
                          }
                        }
                      : undefined
                  }
                  className={cx("border-t border-slate-100 hover:bg-slate-50", clickable && "cursor-pointer", stackOnPhone && STACK.row)}
                >
                  {columns.map((col, ci) => (
                    <td
                      key={col.key}
                      data-label={typeof col.header === "string" ? col.header : undefined}
                      className={cx(
                        "min-w-0 break-words px-3 text-slate-700",
                        stackOnPhone && STACK.cell,
                        pad,
                        ALIGN[col.align || "left"],
                        stickyFirst && ci === 0 && "sticky left-0 z-[1] bg-white",
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {renderCell(col, row, ri, col.key === firstCol)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && (serverPaged || pagedLocally) && total > 0 && (
        <Pagination
          data-table-footer=""
          page={serverPaged ? pagination.page : localPage}
          pageCount={serverPaged ? pagination.pageCount : localPageCount}
          total={total}
          pageSize={size}
          shown={visibleRows.length}
          onPage={serverPaged ? pagination.onPage : setInnerPage}
        />
      )}
    </div>
  );
}
