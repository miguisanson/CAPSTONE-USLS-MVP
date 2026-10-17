// DataTable (UI-SPEC section 4 and 5): one table for the whole app. It scrolls sideways INSIDE its own wrapper (the
// page never does), has sticky-able headers with scope="col", optional sort / search / pagination / CSV export done
// on the client, and hooks to let the server do paging and sorting instead.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Inbox } from "lucide-react";
import { csvCell, downloadBlob } from "../../lib/format";
import { Button } from "./Button.jsx";
import { EmptyState, Pagination, SearchInput, SkeletonTable } from "./Feedback.jsx";

const cx = (...parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

// Class strings are written out in full so Tailwind sees them.
const MIN_WIDTH = { sm: "min-w-[640px]", md: "min-w-[760px]", lg: "min-w-[960px]" };
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

function SortIcon({ dir }) {
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return <Icon className={cx("h-3.5 w-3.5 shrink-0", dir ? "text-brand-700" : "text-slate-400")} aria-hidden="true" />;
}

/**
 * @param columns   [{ key, header, cell(row, index), align, sortable, sortValue(row), hideBelow, className, width }]
 *                  `header` is text or a node. `cell` defaults to row[key]. `sortValue` defaults to row[key] and is
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
  sort,
  onSort,
  className = "",
  ...rest
}) {
  const serverPaged = Boolean(pagination);
  const sortControlled = typeof onSort === "function";
  const searchControlled = Boolean(searchable && typeof searchable === "object" && "value" in searchable);

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
        data-table-scroll=""
        className={cx("relative overflow-x-auto rounded-xl border border-slate-200 bg-white", stickyHeader && "max-h-[70dvh] overflow-y-auto")}
      >
        {loading ? (
          <SkeletonTable rows={Math.min(size || 5, 8)} />
        ) : noRows ? (
          <EmptyState {...emptyCopy} size="sm" />
        ) : (
          <table className={cx("w-full text-sm", MIN_WIDTH[minWidth] || MIN_WIDTH.sm)}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className={cx("bg-slate-50", stickyHeader && "sticky top-0 z-10")}>
              <tr>
                {columns.map((col, ci) => {
                  const dir = sortState && sortState.key === col.key ? sortState.dir : null;
                  const align = col.align || "left";
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={col.sortable ? (dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none") : undefined}
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
                      {col.sortable ? (
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
            <tbody>
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
                  className={cx("border-t border-slate-100 hover:bg-slate-50", clickable && "cursor-pointer")}
                >
                  {columns.map((col, ci) => (
                    <td
                      key={col.key}
                      className={cx(
                        "min-w-0 break-words px-3 text-slate-700",
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
