import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarOff, CalendarPlus, Clock3, Inbox, Trash2 } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, ErrorNote, InlineNotice, PageHeader, SectionTitle, Spinner, StatusBadge } from "../../components/ui";
import { Field, Input, RadioRow } from "../../components/forms";
import { useConfirm } from "../../components/confirm";
import { formatDateTime } from "../../lib/format";
import { isoDay } from "../../components/calendar/CalendarView";
import { FacultyCalendarConnection } from "./FacultyCalendar";
import { formatDay, formatTimeRange, useFaculty } from "./FacultyContext";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function toRows(workingHours) {
  return WEEKDAYS.map((day, weekday) => {
    const row = (workingHours || []).find((item) => item.weekday === weekday) || {};
    return { weekday, day, enabled: Boolean(row.enabled), start: row.start || "", end: row.end || "" };
  });
}

function rangeProblem(start, end) {
  if (!start || !end) return "Enter both a start and an end time.";
  if (end <= start) return "The end time must be later than the start time.";
  return "";
}

function WeeklyHours({ data, onSaved }) {
  const [rows, setRows] = useState(() => toRows(data.working_hours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setRows(toRows(data.working_hours));
  }, [data]);

  const update = (weekday, patch) => {
    setNotice("");
    setRows((current) => current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  };

  const copyMonday = () => {
    setNotice("");
    setRows((current) => {
      const monday = current[0];
      return current.map((row) => (row.weekday >= 1 && row.weekday <= 4 ? { ...row, enabled: monday.enabled, start: monday.start, end: monday.end } : row));
    });
  };

  const save = async () => {
    setError("");
    setNotice("");
    for (const row of rows) {
      if (!row.enabled) continue;
      const problem = rangeProblem(row.start, row.end);
      if (problem) {
        setError(`${row.day}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    try {
      await api.saveFacultyWorkingHours(
        rows.map((row) => ({
          weekday: row.weekday,
          enabled: row.enabled,
          start: row.enabled ? row.start : row.start || null,
          end: row.enabled ? row.end : row.end || null,
        })),
      );
      setNotice("Weekly hours saved.");
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not save your weekly hours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <SectionTitle
        title="Weekly hours"
        subtitle="Tick the days you can sit in a defense and set the hours. All times are Philippine time."
        icon={Clock3}
      />
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.weekday} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${row.enabled ? "border-brand-200 bg-brand-50/40" : "border-slate-100"}`}>
            <label className="flex w-36 items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={row.enabled}
                onChange={(event) => update(row.weekday, { enabled: event.target.checked })}
              />
              {row.day}
            </label>
            {row.enabled ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  From
                  <input type="time" className="field-input w-32" value={row.start} onChange={(event) => update(row.weekday, { start: event.target.value })} aria-label={`${row.day} start time`} />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  To
                  <input type="time" className="field-input w-32" value={row.end} onChange={(event) => update(row.weekday, { end: event.target.value })} aria-label={`${row.day} end time`} />
                </label>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Not available</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-3">
        <ErrorNote message={error} />
        {notice && <InlineNotice>{notice}</InlineNotice>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save weekly hours"}</button>
          <button type="button" className="btn-ghost" onClick={copyMonday} disabled={saving}>Copy Monday to weekdays</button>
        </div>
      </div>
    </Card>
  );
}

const EMPTY_FORM = { kind: "unavailable", start_date: "", end_date: "", start: "", end: "", note: "" };

function SpecificDates({ data, onSaved }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = isoDay(new Date());
  const only = form.kind === "available";

  const set = (patch) => {
    setNotice("");
    setForm((current) => ({ ...current, ...patch }));
  };

  const exceptions = (data.exceptions || [])
    .filter((item) => (item.end_date || item.start_date) >= today)
    .sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));

  const add = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.start_date) return setError("Choose the first date.");
    if (form.start_date < today) return setError("You cannot add a date that has already passed.");
    if (form.end_date && form.end_date < form.start_date) return setError("The last date cannot be before the first date.");
    if (only || form.start || form.end) {
      const problem = rangeProblem(form.start, form.end);
      if (problem) return setError(only ? `Available only these hours: ${problem}` : problem);
    }
    const payload = { kind: form.kind, start_date: form.start_date };
    if (form.end_date) payload.end_date = form.end_date;
    if (form.start && form.end) {
      payload.start = form.start;
      payload.end = form.end;
    }
    if (form.note.trim()) payload.note = form.note.trim();
    setSaving(true);
    try {
      await api.addAvailabilityException(payload);
      setForm(EMPTY_FORM);
      setNotice("Date saved.");
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not save this date.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: "Remove this date?",
      message: `${describeException(item)} will be removed and your weekly hours will apply again.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setError("");
    setNotice("");
    try {
      await api.deleteAvailabilityException(item.id);
      setNotice("Date removed.");
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not remove this date.");
    }
  };

  return (
    <Card className="p-6">
      <SectionTitle
        title="Specific dates"
        subtitle="Vacations, travel or one-off changes. Specific hours on a date replace your weekly hours for that day."
        icon={CalendarOff}
      />
      <form onSubmit={add} className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4" aria-label="Add a specific date">
        <div>
          <p className="field-label">What applies on these dates?</p>
          <RadioRow
            name="kind"
            value={form.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: "unavailable", label: "I am NOT available" },
              { value: "available", label: "I am available ONLY these hours" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="First date" required>
            <Input type="date" min={today} value={form.start_date} onChange={(event) => set({ start_date: event.target.value })} />
          </Field>
          <Field label="Last date" hint="Optional. Fill it in for a range, such as a vacation.">
            <Input type="date" min={form.start_date || today} value={form.end_date} onChange={(event) => set({ end_date: event.target.value })} />
          </Field>
          <Field label="From (Philippine time)" required={only} hint={only ? "" : "Leave empty for the whole day."}>
            <Input type="time" value={form.start} onChange={(event) => set({ start: event.target.value })} />
          </Field>
          <Field label="To (Philippine time)" required={only}>
            <Input type="time" value={form.end} onChange={(event) => set({ end: event.target.value })} />
          </Field>
        </div>
        <Field label="Note" hint="Optional. For example: Out of town.">
          <Input type="text" maxLength={200} value={form.note} onChange={(event) => set({ note: event.target.value })} />
        </Field>
        <ErrorNote message={error} />
        {notice && <InlineNotice>{notice}</InlineNotice>}
        <button type="submit" className="btn-primary" disabled={saving}>
          <CalendarPlus className="h-4 w-4" /> {saving ? "Saving..." : "Add date"}
        </button>
      </form>
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-ink">Your dates</h3>
        {exceptions.length ? (
          <ul className="space-y-2">
            {exceptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{describeException(item)}</p>
                  {item.note && <p className="text-xs text-slate-500">{item.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={item.kind === "available" ? "Only these hours" : "Not available"} dot={false} />
                  <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs text-red-600" onClick={() => remove(item)} aria-label={`Remove ${describeException(item)}`}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No specific dates. Your weekly hours apply. Dates that have passed are not shown.</p>
        )}
      </div>
    </Card>
  );
}

function describeException(item) {
  const first = formatDay(item.start_date);
  const dates = item.end_date && item.end_date !== item.start_date ? `${first} to ${formatDay(item.end_date)}` : first;
  const hours = item.all_day || !item.start ? "whole day" : formatTimeRange(item.start, item.end);
  return `${dates}, ${hours}`;
}

function Requests({ data, onSaved }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const requests = (data.requests || []).filter((item) => item.status === "Open");

  const answer = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await api.answerAvailabilityRequest(id);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not send your answer.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-6">
      <SectionTitle
        title="Requests from the Graduate School"
        subtitle="Saving your weekly hours or a specific date also answers these requests."
        icon={Inbox}
      />
      <ErrorNote message={error} />
      {requests.length ? (
        <ul className="mt-2 space-y-2.5">
          {requests.map((item) => (
            <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {item.student_name ? `For ${item.student_name}'s defense` : "Availability request"}
              </p>
              {item.message && <p className="mt-1 text-sm text-amber-900">{item.message}</p>}
              <p className="mt-1 text-xs text-amber-800">
                {item.window_start || item.window_end
                  ? `Dates needed: ${formatDay(item.window_start)}${item.window_end ? ` to ${formatDay(item.window_end)}` : ""}.`
                  : "No specific dates given."}
                {item.requested_by ? ` Asked by ${item.requested_by}.` : ""}
              </p>
              <button type="button" className="btn-ghost mt-3 px-3 py-1.5 text-xs" disabled={busyId === item.id} onClick={() => answer(item.id)}>
                {busyId === item.id ? "Saving..." : "I already entered my hours - keep them"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No open requests. The Graduate School is not waiting on you.</p>
      )}
    </Card>
  );
}

export default function FacultyAvailabilityEditor() {
  const { data: portal, refetch: refetchPortal } = useFaculty();
  const { data, loading, error, refetch } = useApi(() => api.facultyAvailability(), []);

  const refreshAll = async () => {
    refetch();
    await refetchPortal();
  };

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <PageHeader title="My availability" icon={CalendarDays} />
        <Card className="p-6"><Spinner label="Loading your availability..." /></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader title="My availability" icon={CalendarDays} />
        <ErrorNote message={error || "Could not load your availability."} />
      </div>
    );
  }

  const otherWindows = data.other_windows || [];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My availability"
        description="Tell the Graduate School when you can sit in a defense. All times are Philippine time."
        icon={CalendarDays}
        actions={<Link to="/faculty-portal/calendar" className="btn-ghost"><CalendarDays className="h-4 w-4" /> See your calendar</Link>}
      />
      {data.entered ? (
        <InlineNotice>
          {data.updated_at ? `Last updated ${formatDateTime(data.updated_at)}.` : "Availability entered."}{data.google_connected ? " Google Calendar connected." : ""}
        </InlineNotice>
      ) : (
        <InlineNotice tone="warn">
          You have not entered any availability. The Graduate School cannot check your time, so it will ask you first.
        </InlineNotice>
      )}
      <ErrorNote message={error} />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <WeeklyHours data={data} onSaved={refreshAll} />
          <SpecificDates data={data} onSaved={refreshAll} />
          <Requests data={data} onSaved={refreshAll} />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <FacultyCalendarConnection calendar={portal?.faculty?.calendar} />
          {otherWindows.length > 0 && (
            <Card className="p-6">
              <SectionTitle title="Other open windows" subtitle="Read only. Times the Graduate School has on record." icon={Clock3} />
              <ul className="space-y-1.5">
                {otherWindows.map((slot, index) => (
                  <li key={`${slot.date}-${slot.start}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="font-semibold text-ink">{formatDay(slot.date)}</span>
                    <span className="text-slate-600">{formatTimeRange(slot.start, slot.end)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
