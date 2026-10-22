import { useEffect, useState } from "react";
import { Rss, Copy, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Button, Card, InlineNotice, SectionTitle } from "../ui/index.js";
import { useConfirm } from "../confirm";

// "Subscribe in Google Calendar / Outlook / Apple Calendar": a private link that works without
// signing in. Regenerating it or turning it off stops the old link at once.
export default function CalendarFeedCard() {
  const confirm = useConfirm();
  const [feed, setFeed] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api.calendarFeed().then((body) => active && setFeed(body.feed)).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, []);

  async function run(action) {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const body = await action();
      setFeed(body.feed);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (feed) {
      const ok = await confirm({
        title: "Make a new private link?",
        message: "The current link stops working. Anything subscribed to it must be given the new link.",
        confirmLabel: "Make a new link",
      });
      if (!ok) return;
    }
    run(() => api.createCalendarFeed());
  }

  async function revoke() {
    const ok = await confirm({
      title: "Turn off the private link?",
      message: "Calendars subscribed to it stop updating. You can make a new link later.",
      confirmLabel: "Turn off",
      tone: "danger",
    });
    if (ok) run(() => api.revokeCalendarFeed());
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(feed.absolute_url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <SectionTitle title="Subscribe to this calendar" subtitle="Defenses and deadlines in your own calendar app" icon={Rss} />
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {feed === undefined ? (
        <p className="text-sm text-slate-500" role="status">Loading...</p>
      ) : feed ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="calendar-feed-url" className="field-label">Your private link</label>
            <div className="flex gap-2">
              <input id="calendar-feed-url" readOnly className="field-input font-mono text-xs" value={feed.absolute_url} onFocus={(e) => e.target.select()} />
              <Button variant="icon" icon={Copy} onClick={copy} aria-label="Copy link" />
            </div>
            {copied && <p className="mt-1 text-xs font-semibold text-brand-700" role="status">Copied.</p>}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            In Google Calendar choose "Other calendars" then "From URL" and paste the link. Anyone with the link can see your calendar, so do not share it.
            {feed.last_used_at ? ` Last read ${new Date(feed.last_used_at).toLocaleString()}.` : " Not read yet."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={RefreshCw} disabled={busy} onClick={regenerate}>New link</Button>
            <Button variant="secondary" size="sm" icon={Trash2} className="text-red-700" disabled={busy} onClick={revoke}>Turn off</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Get a private link that keeps your phone or Google Calendar up to date with your defenses and deadlines.</p>
          <Button size="sm" loading={busy} onClick={regenerate}>{busy ? "Creating..." : "Create my private link"}</Button>
        </div>
      )}
    </Card>
  );
}
