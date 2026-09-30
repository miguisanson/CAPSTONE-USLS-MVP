import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../api";

// In-app notification bell for the top bar of the shared shell (every role). Opening the bell asks
// the server for the person's notifications; the server also creates any reminder that is due, so
// no background scheduler is needed. Checked again every minute and whenever the page changes.
const POLL_MS = 60000;

function when(value) {
  if (!value) return "";
  const date = new Date(value); // the server stamps local (Asia/Manila) time without an offset
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const wrapper = useRef(null);

  const load = useCallback(async () => {
    try {
      const body = await api.notifications({ limit: 30 });
      setItems(body.items || []);
      setUnread(body.unread_count || 0);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load notifications.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(item) {
    setOpen(false);
    if (!item.read_at) {
      setItems((list) => list.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)));
      setUnread((count) => Math.max(0, count - 1));
      api.markNotificationRead(item.id).catch(() => {});
    }
    if (item.link) navigate(item.link);
  }

  async function readAll() {
    try {
      await api.markAllNotificationsRead();
      setItems((list) => list.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); if (!open) load(); }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[1.1rem] text-white" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="region" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-display text-sm font-semibold text-ink">Notifications</p>
            <button type="button" onClick={readAll} disabled={!unread} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:cursor-default disabled:text-slate-300 disabled:no-underline">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />Mark all read
            </button>
          </div>
          {error && <p className="px-4 py-3 text-xs font-semibold text-red-700">{error}</p>}
          <ul className="max-h-[24rem] divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && !error && <li className="px-4 py-8 text-center text-sm text-slate-500">You have no notifications.</li>}
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item)} className={`block w-full cursor-pointer px-4 py-3 text-left hover:bg-slate-50 ${item.read_at ? "" : "bg-brand-50/40"}`}>
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-snug ${item.read_at ? "font-semibold text-slate-700" : "font-bold text-ink"}`}>{item.title}</span>
                    {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                  </span>
                  {item.body && <span className="mt-0.5 line-clamp-3 block text-xs text-slate-500">{item.body}</span>}
                  <span className="mt-1 block text-[11px] font-semibold text-slate-400">{when(item.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
