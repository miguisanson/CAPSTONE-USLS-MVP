import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, CalendarDays, CalendarX2, Eye, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { Button, InlineNotice, Modal, StatusChip } from "../../components/ui/index.js";
import { formatDateTime } from "../../lib/format";

export function FacultyCalendarConnection({ calendar, onChanged }) {
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
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
    setOperation("connect");
    setError("");
    try {
      const result = await api.googleCalendarAuthorization();
      if (result.mode === "preview") {
        setPreview(result);
        setOperation("");
        return;
      }
      window.location.assign(result.authorization_url);
    } catch (err) {
      setError(err.message || "Could not start the Google Calendar connection.");
      setOperation("");
    }
  }

  async function syncCalendar() {
    setOperation("sync");
    setError("");
    try {
      await api.syncGoogleCalendar();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Could not check Google Calendar.");
    } finally {
      setOperation("");
    }
  }

  async function disconnectCalendar() {
    setOperation("disconnect");
    setError("");
    try {
      await api.disconnectGoogleCalendar();
      await onChanged?.();
      setDisconnectOpen(false);
    } catch (err) {
      setError(err.message || "Could not disconnect Google Calendar.");
    } finally {
      setOperation("");
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
          {connected && (
            <p className="meta mt-0.5">
              Last checked: {calendar?.last_synced_at ? formatDateTime(calendar.last_synced_at) : "Not checked yet"}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        {connected
          ? "Google busy periods remove conflicts from your entered hours. Defenses scheduled in the system are also kept blocked on this Google Calendar."
          : "Connect once to block Google conflicts in defense scheduling and add system-scheduled defenses to this Google Calendar."}
      </p>
      {connected ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button data-connect="" icon={CalendarCheck2} loading={operation === "connect"} disabled={Boolean(operation)} onClick={connectCalendar}>
            Reconnect calendar
          </Button>
          <Button variant="secondary" icon={RefreshCw} loading={operation === "sync"} disabled={Boolean(operation)} onClick={syncCalendar}>
            Check calendar now
          </Button>
          <Button variant="danger" icon={CalendarX2} disabled={Boolean(operation)} onClick={() => setDisconnectOpen(true)} className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            Disconnect calendar
          </Button>
        </div>
      ) : (
        <Button data-connect="" icon={CalendarCheck2} loading={operation === "connect"} onClick={connectCalendar} className="mt-3 w-full">
          Connect Google Calendar
        </Button>
      )}
      {connected && calendar?.last_error && (
        <InlineNotice tone="warning" className="mt-2">Last check failed: {calendar.last_error}</InlineNotice>
      )}
      {error && <InlineNotice tone="danger" className="mt-2">{error}</InlineNotice>}
      {preview && (
        <GoogleCalendarPreviewDialog
          preview={preview}
          opened={previewOpened}
          onOpened={() => setPreviewOpened(true)}
          onClose={() => setPreview(null)}
        />
      )}
      {disconnectOpen && (
        <Modal
          title="Disconnect Google Calendar?"
          subtitle="The system will stop checking busy periods and remove its defense events from this Google Calendar."
          icon={CalendarX2}
          tone="danger"
          size="sm"
          dismissible={operation !== "disconnect"}
          closeLabel="Close disconnect confirmation"
          onClose={() => setDisconnectOpen(false)}
          footer={
            <>
              <Button variant="secondary" disabled={operation === "disconnect"} onClick={() => setDisconnectOpen(false)}>Keep connected</Button>
              <Button data-autofocus="" variant="danger" loading={operation === "disconnect"} onClick={disconnectCalendar}>Disconnect calendar</Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-slate-700">
            Your entered working hours and availability exceptions will stay in place. Unrelated Google Calendar events will not be changed.
          </p>
        </Modal>
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
            Opening Google Calendar does not mark this account as connected. Your entered working hours and availability exceptions remain the source of possible defense times.
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
