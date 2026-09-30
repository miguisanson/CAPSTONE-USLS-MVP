import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An accessible modal: focus moves in, Tab stays inside, Escape closes (only the top-most
 * dialog reacts, so a confirm box opened over the case window closes first), and focus
 * returns to where it was. Put `data-autofocus` on a field to focus it first.
 */
export default function ModalShell({
  id,
  title,
  badge,
  subtitle,
  onClose,
  children,
  footer,
  size = "default",
  layer = "z-50",
  closeLabel = "Close",
}) {
  const shellRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = shellRef.current?.querySelector("[data-autofocus]") || closeButtonRef.current;
    first?.focus();

    function onKeyDown(event) {
      const dialog = shellRef.current;
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (!dialog || dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [id]);

  const width = size === "wide" ? "max-w-4xl" : "max-w-xl";

  return (
    <div className={`fixed inset-0 ${layer} flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6`}>
      <section
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={subtitle ? `${id}-description` : undefined}
        className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p id={`${id}-description`} className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onCloseRef.current()}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:ring-2 focus:ring-brand-500"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
