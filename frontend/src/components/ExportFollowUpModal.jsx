import { useEffect, useRef } from "react";
import { CheckCircle2, Clock3, Mail, X } from "lucide-react";

export default function ExportFollowUpModal({
  id,
  title,
  filename,
  actorLabel,
  fileLabel,
  onClose,
}) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog
        ? [...dialog.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [id]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">{title}</h2>
            <p id={`${id}-description`} className="mt-1 text-sm text-slate-500">
              The file was downloaded successfully. No email was sent by the portal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close export instructions"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Exported file</p>
            <p className="mt-1 break-all text-sm font-semibold text-emerald-950">{filename}</p>
          </div>

          <ol className="space-y-3">
            <li className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Email the {fileLabel} to the Registrar</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {actorLabel} must attach the downloaded file and send it through the official email channel.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Wait for Registrar acknowledgement</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Keep the case at “Exported — Ready to Send” until the Registrar acknowledges the email outside the portal.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="btn-primary cursor-pointer px-4 py-2"
          >
            Got it
          </button>
        </footer>
      </section>
    </div>
  );
}
