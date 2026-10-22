import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, CalendarDays, Eye, ExternalLink, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { Button, InlineNotice, Modal, StatusChip } from "../../components/ui/index.js";

export function FacultyCalendarConnection({ calendar }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const connected = Boolean(calendar?.connected);
  const sectionRef = useRef(null);
  const wasOpen = useRef(false);

  // When the preview closes, the focus goes back to the connect button (the button is disabled while it waits for
  // Google, so the dialog cannot remember it as the opener).
  useEffect(() => {
    if (preview) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      sectionRef.current?.querySelector("[data-connect]")?.focus();
    }
  }, [preview]);

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
    <section ref={sectionRef} className="rounded-xl border border-brand-200 bg-brand-50 p-3" aria-label="Google Calendar connection">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100">
          <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="card-title">Google Calendar</p>
          <p className={`mt-0.5 text-xs font-semibold ${connected || previewOpened ? "text-brand-700" : "text-slate-500"}`}>
            {connected ? "Connected" : previewOpened ? "Integration preview opened" : "Not connected"}
          </p>
          {connected && calendar?.connected_email && (
            <p className="meta mt-0.5 truncate" title={calendar.connected_email}>{calendar.connected_email}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        {connected
          ? "Busy classes, appointments, and personal events automatically block defense times."
          : "Connect once so staff checks your real busy times instead of the profile schedule."}
      </p>
      <Button data-connect="" icon={CalendarCheck2} loading={busy} onClick={connectCalendar} className="mt-3 w-full">
        {busy ? "Opening Google..." : connected ? "Reconnect calendar" : "Connect Google Calendar"}
      </Button>
      {error && <InlineNotice tone="danger" className="mt-2">{error}</InlineNotice>}
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
  function openGoogleCalendar() {
    window.open(preview.calendar_url, "_blank", "noopener,noreferrer");
    onOpened();
  }

  const permissionIcons = [CalendarDays, Eye, ShieldCheck];

  return (
    <Modal
      title="Allow USLS Graduate School to use your calendar availability?"
      subtitle="This previews the permission step faculty will complete when live Google OAuth is enabled."
      icon={CalendarCheck2}
      badge={<StatusChip label="Integration preview" tone="info" dot={false} size="sm" />}
      closeLabel="Close Google Calendar preview"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Not now</Button>
          <Button data-autofocus="" icon={ExternalLink} onClick={openGoogleCalendar}>
            {opened ? "Open Google Calendar again" : "Continue to Google Calendar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="eyebrow">How your calendar will be used</p>
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

        <InlineNotice tone="warning" role="note" title="Demo-safe preview">
          <span className="text-xs leading-relaxed">
            Opening Google Calendar does not mark this account as connected and does not change Panel Matching or Defense Scheduling. The existing profile schedule remains active.
          </span>
        </InlineNotice>

        {opened && (
          <InlineNotice tone="success">
            Google Calendar opened in a new tab. Return here to continue the system demonstration.
          </InlineNotice>
        )}
      </div>
    </Modal>
  );
}
