// Feedback components (UI-SPEC sections 3, 4, 5, 6): EmptyState, Spinner, Skeleton / SkeletonTable, InlineNotice,
// SearchInput and Pagination. `components/ui.jsx` re-exports Spinner, EmptyState and InlineNotice so old imports work.
import { useId } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Search, X } from "lucide-react";
import { toneOf } from "../../lib/tone";
import { Button } from "./Button.jsx";

const cx = (...parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------------------------------------ EmptyState */

/**
 * @param icon    a lucide icon component shown in a grey tile
 * @param title   what is missing, e.g. "No requests to show"
 * @param hint    one short sentence on what to do or when items will appear
 * @param action  a node (usually a Button) shown under the hint
 * @param size    "md" (default, a page or card) | "sm" (inside a table or a small panel)
 */
export function EmptyState({ icon: Icon, title, hint, action, size = "md", className = "" }) {
  const small = size === "sm";
  return (
    <div className={cx("flex flex-col items-center justify-center text-center", small ? "py-6" : "py-12", className)}>
      {Icon && (
        <span className={cx("grid place-items-center rounded-2xl bg-slate-100 text-slate-400", small ? "mb-2 h-10 w-10" : "mb-3 h-12 w-12")}>
          <Icon className={small ? "h-5 w-5" : "h-6 w-6"} aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------------------- Spinner / Skeleton */

/**
 * @param label  words next to the wheel (also what a screen reader announces)
 * @param size   "md" (default, a whole panel: py-16) | "sm" (small: py-6, for a table or a card)
 */
export function Spinner({ label = "Loading…", size = "md", className = "" }) {
  const small = size === "sm";
  return (
    <div role="status" className={cx("flex items-center justify-center gap-3 text-slate-500", small ? "py-6" : "py-16", className)}>
      <span
        aria-hidden="true"
        className={cx("animate-spin rounded-full border-2 border-slate-300 border-t-brand-600", small ? "h-4 w-4" : "h-5 w-5")}
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/** Placeholder lines for text or a card while data loads. The last line is shorter. Reserve the final height. */
export function Skeleton({ lines = 3, className = "", ...rest }) {
  return (
    <div role="status" aria-busy="true" className={cx("space-y-3", className)} {...rest}>
      <span className="sr-only">Loading</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          data-skeleton-line=""
          aria-hidden="true"
          className={cx("h-4 animate-pulse rounded-lg bg-slate-100", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Placeholder for a table: a header bar and `rows` row bars, each as tall as a real row (about 48px). */
export function SkeletonTable({ rows = 5, className = "" }) {
  return (
    <div role="status" aria-busy="true" data-skeleton-table="" className={cx("divide-y divide-slate-100", className)}>
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="h-10 animate-pulse bg-slate-50" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex h-12 items-center gap-4 px-3">
          <div className="h-3 w-1/4 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-3 w-1/6 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-3 flex-1 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- InlineNotice */

const TONE_ICON = { success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle, info: Info, neutral: Info };

/**
 * @param tone       "info" (default, blue) | "success" | "warning" | "danger"; the old names warn and error still work
 * @param title      bold first line; the children then follow in normal weight
 * @param onDismiss  shows a close button that calls this
 * @param icon       a lucide component, or `true` for the tone's own icon; none by default (the words carry the meaning)
 *
 * role="alert" only for danger (read out at once); every other tone is role="status" (read out politely).
 */
export function InlineNotice({ tone = "info", title, onDismiss, icon, children, className = "", ...rest }) {
  const t = toneOf(tone);
  const Icon = icon === true ? TONE_ICON[t.label] : icon || null;
  return (
    <div
      role={t.label === "danger" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", t.notice, className)}
      {...rest}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className={cx("min-w-0 flex-1 break-words", !title && "font-semibold")}>
        {title && <p className="font-semibold">{title}</p>}
        {children != null && children !== false && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {onDismiss && (
        <Button
          variant="icon"
          icon={X}
          aria-label="Dismiss"
          onClick={onDismiss}
          className="-my-2 -mr-2 border-transparent bg-transparent text-current hover:bg-black/5"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- SearchInput */

/**
 * A search field: magnifier on the left, a clear button once there is text, Escape clears.
 * `onChange` receives the new TEXT (not the event): `<SearchInput value={q} onChange={setQ} />`.
 * @param label  accessible name (visually hidden); default "Search"
 */
export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", className = "", inputClassName = "", ...rest }) {
  const id = useId();
  const text = value ?? "";
  return (
    <div className={cx("relative", className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        {...rest}
        id={id}
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          rest.onKeyDown?.(e);
          if (e.key === "Escape" && text) {
            e.preventDefault();
            onChange?.("");
          }
        }}
        className={cx("field-input pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none", inputClassName)}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange?.("")}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- Pagination */

/**
 * "Showing 21–30 of 95" on the left, Previous / "Page 3 of 10" / Next on the right. Pages count from 1.
 * @param page       current page (1-based)
 * @param pageCount  number of pages; the buttons only show when there is more than one
 * @param total      number of items in all pages; shows the "Showing a–b of n" text (with `pageSize`)
 * @param pageSize   items per page; with `shown` (items on this page) it gives the range
 * @param onPage     called with the new page number
 */
export function Pagination({ page = 1, pageCount = 1, total, pageSize, shown, onPage, className = "", ...rest }) {
  const count = Math.max(1, pageCount || 1);
  const current = Math.min(Math.max(1, page), count);
  let summary = null;
  if (typeof total === "number") {
    if (total === 0) {
      summary = "Showing 0 of 0";
    } else {
      const size = pageSize || Math.ceil(total / count);
      const from = (current - 1) * size + 1;
      const to = Math.min(total, shown ? from + shown - 1 : current * size);
      summary = `Showing ${from}–${to} of ${total}`;
    }
  }
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-3", className)} {...rest}>
      {summary ? (
        <p data-pagination-summary="" aria-live="polite" className="meta">{summary}</p>
      ) : (
        <span />
      )}
      {count > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={current <= 1} onClick={() => onPage?.(current - 1)}>
            Previous
          </Button>
          <span className="meta whitespace-nowrap px-1">Page {current} of {count}</span>
          <Button variant="secondary" size="sm" disabled={current >= count} onClick={() => onPage?.(current + 1)}>
            Next
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
