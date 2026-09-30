import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  Eye,
  ShieldCheck,
  ExternalLink,
  X,
} from "lucide-react";
import { api } from "../../api";

export function FacultyCalendarConnection({ calendar }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const connected = Boolean(calendar?.connected);

  async function connectCalendar() {
    setBusy(true);
    setError("");
    try {
      const result = await api.googleCalendarAuthorization();
      if (result.mode === "preview") {
        setPreview(result);
        setBusy(false);
        return;
      }
      window.location.assign(result.authorization_url);
    } catch (err) {
      setError(err.message || "Could not start the Google Calendar connection.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-3 shadow-sm" aria-label="Google Calendar connection">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100">
          <CalendarCheck2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Google Calendar</p>
          <p className={`mt-0.5 text-xs font-semibold ${connected ? "text-emerald-700" : previewOpened ? "text-brand-700" : "text-slate-500"}`}>
            {connected ? "Connected" : previewOpened ? "Integration preview opened" : "Not connected"}
          </p>
          {connected && calendar?.connected_email && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500" title={calendar.connected_email}>{calendar.connected_email}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
        {connected
          ? "Busy classes, appointments, and personal events automatically block defense times."
          : "Connect once so staff checks your real busy times instead of the profile schedule."}
      </p>
      <button
        type="button"
        onClick={connectCalendar}
        disabled={busy}
        className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-wait disabled:opacity-70"
      >
        <CalendarCheck2 className="h-4 w-4" />
        {busy ? "Opening Google..." : connected ? "Reconnect calendar" : "Connect Google Calendar"}
      </button>
      {error && <p className="mt-2 text-xs font-semibold leading-relaxed text-red-700" role="alert">{error}</p>}
      {preview && (
        <GoogleCalendarPreviewDialog
          preview={preview}
          opened={previewOpened}
          onOpened={() => setPreviewOpened(true)}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

export function GoogleCalendarPreviewDialog({ preview, opened, onOpened, onClose }) {
  const primaryButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = primaryButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog
        ? [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
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
  }, []);

  function openGoogleCalendar() {
    window.open(preview.calendar_url, "_blank", "noopener,noreferrer");
    onOpened();
  }

  const permissionIcons = [CalendarDays, Eye, ShieldCheck];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-preview-title"
        aria-describedby="calendar-preview-description"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 bg-gradient-to-r from-brand-800 to-brand-700 px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <CalendarCheck2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/20">
                Integration preview
              </span>
              <h2 id="calendar-preview-title" className="mt-2 font-display text-xl font-semibold">
                Allow USLS Graduate School to use your calendar availability?
              </h2>
              <p id="calendar-preview-description" className="mt-1 text-sm leading-relaxed text-white/80">
                This previews the permission step faculty will complete when live Google OAuth is enabled.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close Google Calendar preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">How your calendar will be used</p>
            <div className="mt-3 space-y-2">
              {(preview.permissions || []).map((permission, index) => {
                const Icon = permissionIcons[index] || ShieldCheck;
                return (
                  <div key={permission} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="pt-1 text-sm font-medium leading-relaxed text-slate-700">{permission}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Demo-safe preview</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              Opening Google Calendar does not mark this account as connected and does not change Panel Matching or Defense Scheduling. The existing profile schedule remains active.
            </p>
          </div>

          {opened && (
            <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
              Google Calendar opened in a new tab. Return here to continue the system demonstration.
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-ghost min-h-11 cursor-pointer justify-center px-4">
            Not now
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={openGoogleCalendar}
            className="btn-primary min-h-11 cursor-pointer justify-center px-4"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {opened ? "Open Google Calendar again" : "Continue to Google Calendar"}
          </button>
        </footer>
      </section>
    </div>
  );
}
