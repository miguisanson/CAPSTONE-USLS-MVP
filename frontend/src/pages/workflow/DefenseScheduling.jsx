import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  MapPin,
  Users,
} from "lucide-react";
import { api } from "../../api";
import { Button, Card, Field, HistoryPanel, InlineNotice, Input, SectionCard, Select, StatusChip, Textarea } from "../../components/ui/index.js";
import SlotCheck, { useSlotCheck } from "../../components/scheduling/SlotCheck";
import AvailabilityRequestPanel, { InvitationChip } from "../../components/scheduling/AvailabilityRequestPanel";
import { availabilityLabel, isAvailabilityEntered } from "../../components/scheduling/dates";
import { AvailabilityWorkspace } from "./AvailabilityWorkspace";
import { WorkflowSubmitFeedback, shortDate, timeRange } from "./shared";

// ---------------------------------------------------------------------------
// Defense Scheduling
// ---------------------------------------------------------------------------
export function DefenseSchedulingForm({ context, studentId, submit, submitting, result, submitError, refetch }) {
  const availability = context.availability || {};
  const readiness = context.schedule_readiness || {};
  const participants = availability.participants || [];
  const possibleSlots = availability.possible_slots || [];
  const schedules = context.schedules || [];
  const [form, setForm] = useState({
    preferred_date: "",
    preferred_end_date: "",
    selected_start: "",
    selected_end: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
    override_requirements: false,
    override_conflicts: false,
    override_reason: "",
    manuscript_received_on: "",
    panel_change_reason: "",
    reason: "",
    requested_by: "GS Office",
  });
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [window, setWindow] = useState({ start: "", end: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const panel = context.assigned_panel || [];
  const requiredPanelCount = context.panel_roles?.length || 4;
  const panelComplete = panel.length >= requiredPanelCount;
  const facultyDirectory = context.faculty_directory || [];
  const panelRoleLabels = context.panel_roles || [];
  const [editingPanel, setEditingPanel] = useState(false);
  const [panelEditIds, setPanelEditIds] = useState([]);
  const chosenPanelIds = panelEditIds.filter((id) => id);
  const panelSelectionValid = chosenPanelIds.length === requiredPanelCount && new Set(chosenPanelIds).size === requiredPanelCount;
  function updatePanel() {
    if (!panelSelectionValid) return;
    submit({ student_id: studentId, panel_faculty_ids: chosenPanelIds, reassign_only: true, panel_change_reason: form.panel_change_reason });
    setEditingPanel(false);
  }
  const schedulableTypes = context.schedulable_types || [];
  const stageOutcome = context.verdict_outcome || null;
  const activeSchedule = schedules.find((schedule) => schedule.is_active && schedule.defense_type === form.defense_type);
  const flaggedSchedule = schedules.find((schedule) => schedule.needs_reconfirmation && schedule.defense_type === form.defense_type);
  const isRetry = !activeSchedule && schedules.some(
    (schedule) => schedule.defense_type === form.defense_type && ["Failed", "Provisional pass - re-defense required"].includes(schedule.defense_outcome)
  );
  const usesManuscriptDate = form.defense_type !== "Title Defense";
  const overrideNeedsReason = form.override_requirements || form.override_conflicts;
  const leadReference = context.lead_reference || {};
  const invitations = context.panel_invitations || [];
  // Live warnings for the chosen slot: hard ones block, soft ones need the override box and a reason.
  const check = useSlotCheck({
    studentId,
    date: form.preferred_date,
    start: form.selected_start,
    end: form.selected_end,
    defenseType: form.defense_type,
    venue: form.venue,
    manuscriptReceivedOn: usesManuscriptDate ? form.manuscript_received_on : "",
  });
  const softWithoutOverride = check.needsOverride && !form.override_conflicts;

  async function runScheduleAction(action, successMessage) {
    setActionBusy(true);
    setActionError("");
    setActionMessage("");
    try {
      await action();
      setActionMessage(successMessage);
      await refetch?.();
    } catch (err) {
      setActionError(err.message || "Could not complete that action.");
    } finally {
      setActionBusy(false);
    }
  }

  function cancelActiveSchedule(schedule) {
    const reason = globalThis.prompt("Why is this defense being cancelled? (required, recorded with the schedule)");
    if (!reason || !reason.trim()) return;
    const requestedBy = globalThis.prompt("Who asked for the cancellation? (student, adviser, panel, GS office...)", "GS Office") || "";
    runScheduleAction(() => api.cancelDefense(schedule.id, { reason: reason.trim(), requested_by: requestedBy.trim() }), "Defense cancelled. Book a new schedule when a date is agreed.");
  }

  useEffect(() => {
    setWindow({
      start: availability.window_start || "",
      end: availability.window_end || "",
    });
    setForm((current) => ({
      ...current,
      preferred_date: "",
      preferred_end_date: availability.window_end || "",
      selected_start: "",
      selected_end: "",
      defense_type: context.defense_type || schedulableTypes[0] || readiness.stage || "Proposal Defense",
      override_requirements: false,
      override_conflicts: false,
      override_reason: "",
    }));
  }, [studentId, availability.window_start, availability.window_end, readiness.stage, context.defense_type]);

  useEffect(() => {
    setPanelEditIds(panel.map((member) => member.faculty_id));
    setEditingPanel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, panel.map((member) => member.faculty_id).join(",")]);

  const filteredSlots = useMemo(
    () =>
      possibleSlots
        .filter(
          (slot) =>
            slot.conflict_free !== false &&
            (!window.start || slot.date >= window.start) &&
            (!window.end || slot.date <= window.end)
        )
        .sort((left, right) => `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`)),
    [possibleSlots, window]
  );
  const blockedSlots = useMemo(
    () =>
      possibleSlots.filter(
        (slot) =>
          slot.conflict_free === false &&
          (!window.start || slot.date >= window.start) &&
          (!window.end || slot.date <= window.end)
      ),
    [possibleSlots, window]
  );

  const visibleDates = useMemo(() => {
    const recordedDates = new Set();
    participants.forEach((participant) => {
      participant.slots.forEach((slot) => {
        recordedDates.add(slot.date);
      });
    });
    if (!window.start || !window.end) return [...recordedDates].sort().slice(0, 14);
    const dates = [];
    const cursor = new Date(`${window.start}T00:00:00`);
    const end = new Date(`${window.end}T00:00:00`);
    while (cursor <= end && dates.length < 14) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      if (!weekend || recordedDates.has(isoDate)) dates.push(isoDate);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [participants, window]);

  const possibleDates = useMemo(
    () => new Set(filteredSlots.map((slot) => slot.date)),
    [filteredSlots]
  );

  function chooseSlot(slot) {
    setForm((current) => ({
      ...current,
      preferred_date: slot.date,
      selected_start: slot.start,
      selected_end: slot.end,
    }));
  }

  function onSubmit(e) {
    e.preventDefault();
    if (activeSchedule) {
      runScheduleAction(
        () => api.rescheduleDefense(activeSchedule.id, {
          preferred_date: form.preferred_date,
          selected_start: form.selected_start,
          selected_end: form.selected_end,
          mode: form.mode,
          venue: form.venue,
          constraints: form.constraints,
          manuscript_received_on: form.manuscript_received_on,
          override_requirements: form.override_requirements,
          override_conflicts: form.override_conflicts,
          override_reason: form.override_reason,
          reason: form.reason,
          requested_by: form.requested_by,
        }),
        "Defense rescheduled. The previous booking is kept in the history."
      );
      return;
    }
    submit({ student_id: studentId, ...form, preferred_end_date: window.end || form.preferred_date });
  }

  const submitDisabled = submitting || actionBusy || !schedulableTypes.length || !form.preferred_date || !panelComplete || (!readiness.ready && !form.override_requirements) || (overrideNeedsReason && !form.override_reason.trim()) || (activeSchedule && !form.reason.trim()) || check.blocked || softWithoutOverride;
  const checkbox = "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500";

  return (
    <form onSubmit={onSubmit} className="page-stack">
      <SectionCard
        title="Coordinate the defense schedule"
        subtitle="Review readiness and the matched panel, compare overlap, then make the final staff decision"
        icon={CalendarCheck}
      >
        <section aria-labelledby="student-readiness-heading" className={`rounded-xl border p-4 ${readiness.ready ? "border-brand-200 bg-brand-50/60" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="student-readiness-heading" className="eyebrow">Student readiness</p>
              <h3 className="card-title mt-1">{readiness.stage || "Research stage unavailable"}</h3>
              <p className="mt-1 text-sm text-slate-600">{readiness.research_title || "Research title not recorded"}</p>
              <p className="meta mt-1">Adviser: {readiness.adviser_name || "Not assigned"}</p>
            </div>
            <StatusChip status={readiness.ready ? "Requirements complete" : readiness.status || "Pending requirements"} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(readiness.requirements || []).map((item) => (
              <div key={item.item_name} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                {item.status === "Complete" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{item.label || item.item_name}</p>
                  <p className="meta">{item.status_label || item.status}</p>
                </div>
              </div>
            ))}
          </div>
          {!readiness.ready && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white px-3.5 py-3 text-sm text-amber-900">
              <input type="checkbox" checked={form.override_requirements} onChange={(e) => setForm((current) => ({ ...current, override_requirements: e.target.checked }))} className={checkbox} />
              <span><strong>Staff override:</strong> I reviewed the pending Research Gate requirements and still want to schedule this defense.</span>
            </label>
          )}
        </section>

        {stageOutcome && !stageOutcome.complete && (
          <InlineNotice tone="warning" title={`Last verdict: ${stageOutcome.label}`}>{stageOutcome.verdict?.follow_up}</InlineNotice>
        )}
        {flaggedSchedule && (
          <InlineNotice tone="warning" title="Needs re-confirmation: the panel changed after this defense was booked.">
            <p>{flaggedSchedule.conflict_reason}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={actionBusy} onClick={() => runScheduleAction(() => api.reconfirmDefense(flaggedSchedule.id), "Schedule re-confirmed.")}>Re-confirm with the new panel</Button>
              <Button variant="secondary" size="sm" disabled={actionBusy} onClick={() => cancelActiveSchedule(flaggedSchedule)}>Cancel this booking</Button>
            </div>
          </InlineNotice>
        )}
      </SectionCard>

      <SectionCard
        title="Panel members"
        subtitle="Matched panel is the default — you can reassign from the full faculty list"
        icon={Users}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusChip status={panelComplete ? "Complete" : "Pending"} label={panelComplete ? `${panel.length} selected` : `${panel.length}/${requiredPanelCount} selected`} />
            <Button variant="secondary" size="sm" onClick={() => setEditingPanel((value) => !value)}>{editingPanel ? "Close" : "Change panel"}</Button>
          </div>
        }
      >
        {editingPanel && (
          <Card pad="sm" className="space-y-3 border-brand-200 bg-brand-50/50">
            <p className="text-sm font-semibold text-brand-700">Reassign the defense panel — pick {requiredPanelCount} faculty from the full directory. This updates the student's official panel for this gate, then availability recomputes.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: requiredPanelCount }).map((_, idx) => (
                <Field key={idx} label={panelRoleLabels[idx] || `Panel member ${idx + 1}`}>
                  <Select
                    placeholder="Select faculty…"
                    value={panelEditIds[idx] || ""}
                    onChange={(event) => {
                      const next = [...panelEditIds];
                      next[idx] = event.target.value ? Number(event.target.value) : "";
                      setPanelEditIds(next);
                    }}
                    options={facultyDirectory.map((faculty) => ({
                      value: faculty.faculty_id,
                      label: `${faculty.name}${faculty.specialization ? ` — ${faculty.specialization}` : ""} · ${faculty.upcoming_windows} slot${faculty.upcoming_windows === 1 ? "" : "s"} · load ${faculty.workload}`,
                      disabled: panelEditIds.includes(faculty.faculty_id) && panelEditIds[idx] !== faculty.faculty_id,
                    }))}
                  />
                </Field>
              ))}
            </div>
            <Field label="Reason for changing the panel (required when a panel already exists; recorded, and a booked schedule must then be re-confirmed)">
              <Input value={form.panel_change_reason} onChange={set("panel_change_reason")} placeholder="e.g. external panelist withdrew" />
            </Field>
            {facultyDirectory.length === 0 && <InlineNotice tone="warning">No faculty with an active login are available to assign yet.</InlineNotice>}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={updatePanel} disabled={submitting || !panelSelectionValid}>{submitting ? "Updating…" : "Update panel"}</Button>
              <Button variant="secondary" onClick={() => { setPanelEditIds(panel.map((member) => member.faculty_id)); setEditingPanel(false); }}>Cancel</Button>
              {!panelSelectionValid && <span className="meta">Choose {requiredPanelCount} different faculty to enable Update.</span>}
            </div>
          </Card>
        )}
        {panel.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {panel.map((member) => {
              const participant = participants.find((item) => item.faculty_id === member.faculty_id);
              const invitation = invitations.find((item) => item.faculty_id === member.faculty_id);
              return (
                <Card key={member.id} pad="sm" className="rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{member.faculty_name}</p>
                      <p className="meta font-semibold text-brand-700">{member.panel_role}</p>
                    </div>
                    <StatusChip status={isAvailabilityEntered(participant) ? "Entered" : "Not entered"} dot={false} size="sm" />
                  </div>
                  <p className="meta mt-3">{member.college || "Department not recorded"}</p>
                  <p className="mt-1 text-sm text-slate-700">{member.specialization || "Specialization not recorded"}</p>
                  <p className="meta mt-1">{availabilityLabel(participant)}</p>
                  <InvitationChip invitation={invitation} />
                </Card>
              );
            })}
          </div>
        ) : (
          <InlineNotice tone="warning">No final panel is available. Complete Panel Matching before scheduling.</InlineNotice>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="meta">Availability comes only from what each person entered (weekly hours and dates) or their connected Google Calendar. Nobody is assumed free. All times are Philippine time.</span>
        <span className="flex flex-wrap items-center gap-3">
          <Link to="/workflow/defense-scheduling?view=calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">Open the defense calendar <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          <Link to="/faculty" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">View faculty profiles <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </span>
      </div>
      <AvailabilityRequestPanel context={context} studentId={studentId} refetch={refetch} />
      <AvailabilityWorkspace
        availability={availability}
        participants={participants}
        filteredSlots={filteredSlots}
        blockedSlots={blockedSlots}
        visibleDates={visibleDates}
        possibleDates={possibleDates}
        window={window}
        setWindow={setWindow}
        form={form}
        chooseSlot={chooseSlot}
      />

      <SectionCard title="Final schedule" subtitle="Only staff can finalize this stage schedule.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Selected date" required>
            <Input type="date" value={form.preferred_date} min={availability.today || window.start} max={window.end} onChange={set("preferred_date")} required />
          </Field>
          <Field label="Start time" required>
            <Input type="time" value={form.selected_start} onChange={set("selected_start")} required />
          </Field>
          <Field label="End time" required>
            <Input type="time" value={form.selected_end} min={form.selected_start} onChange={set("selected_end")} required />
          </Field>
          <Field label="Defense type" required>
            <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={schedulableTypes.length ? schedulableTypes : [form.defense_type]} />
          </Field>
          {usesManuscriptDate && (
            <Field label="Date the panel received the manuscript">
              <Input type="date" value={form.manuscript_received_on} max={availability.today} onChange={set("manuscript_received_on")} />
            </Field>
          )}
          <Field label="Mode" required>
            <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
          </Field>
          <Field label="Venue / meeting link">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input className="pl-9" value={form.venue} onChange={set("venue")} placeholder="GS Conference Room / Zoom link" />
            </div>
          </Field>
        </div>
        <Field label="Scheduling constraints">
          <Textarea value={form.constraints} onChange={set("constraints")} placeholder="e.g. external panel only available afternoons" />
        </Field>
        <SlotCheck check={check} />
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${softWithoutOverride ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          <input type="checkbox" checked={form.override_conflicts} onChange={(e) => setForm((current) => ({ ...current, override_conflicts: e.target.checked }))} className={checkbox} />
          <span><strong>Warning override:</strong> finalize despite the warnings (before the lead time, or a panelist who has not entered availability) and record why. Double-booked panelists or rooms, people outside their entered hours, a declined invitation, and slots in the past cannot be overridden.</span>
        </label>
        {overrideNeedsReason && (
          <Field label="Reason for the staff override (required, recorded with the schedule)" required>
            <Textarea value={form.override_reason} onChange={set("override_reason")} placeholder="Why is the override justified?" />
          </Field>
        )}
        {leadReference.label && (
          <p className="meta">Lead time ({leadReference.days} days) is counted from {leadReference.label}{leadReference.date ? `: ${shortDate(leadReference.date)}` : ""}.</p>
        )}
        {activeSchedule && (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:grid-cols-2">
            <p className="text-sm font-semibold text-blue-900 sm:col-span-2">This stage is already booked for {shortDate(activeSchedule.preferred_date)}. Saving will reschedule it: the old record is kept and linked.</p>
            <Field label="Reason for rescheduling" required>
              <Input value={form.reason} onChange={set("reason")} placeholder="e.g. panelist unavailable" required />
            </Field>
            <Field label="Requested by" required>
              <Select value={form.requested_by} onChange={set("requested_by")} placeholder="" options={context.change_requesters || ["GS Office"]} />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="secondary" size="sm" disabled={actionBusy} onClick={() => cancelActiveSchedule(activeSchedule)}>Cancel this booking instead</Button>
            </div>
          </div>
        )}
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
        <Button type="submit" loading={submitting || actionBusy} disabled={submitDisabled} className="w-full sm:w-auto">
          {submitting || actionBusy ? "Saving…" : activeSchedule ? "Reschedule defense" : isRetry ? "Book the re-defense" : "Set defense schedule"}
        </Button>
        {!schedulableTypes.length && <p className="text-xs font-semibold text-amber-800">No defense can be booked at this stage right now{stageOutcome && !stageOutcome.complete ? ` (${stageOutcome.label})` : ""}.</p>}
        {actionMessage && <InlineNotice tone="success" icon={CheckCircle2}>{actionMessage}</InlineNotice>}
        {actionError && <InlineNotice tone="danger">{actionError}</InlineNotice>}
        <WorkflowSubmitFeedback result={result} error={submitError} />
      </SectionCard>

      {schedules.length > 0 && <ScheduleHistory schedules={schedules} />}
    </form>
  );
}

function ScheduleHistory({ schedules }) {
  return (
    <HistoryPanel label="View schedule history" hideLabel="Hide schedule history" count={schedules.length}>
      <div className="space-y-2">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{schedule.defense_type || "Defense"} · {shortDate(schedule.preferred_date)} {schedule.start_time ? `· ${timeRange(schedule.start_time, schedule.end_time)}` : ""}</p>
              <p className="meta mt-0.5">{schedule.mode} · {schedule.venue || "Arrangement pending"} · Forms: {schedule.required_forms_status || "Not recorded"}</p>
              {schedule.display_conflict_reason && <p className="mt-1 text-xs font-semibold text-amber-800">Warning/override: {schedule.display_conflict_reason}</p>}
              {schedule.rescheduled_from_id && <p className="meta mt-1">Rescheduled from booking #{schedule.rescheduled_from_id}{schedule.requested_by ? ` · requested by ${schedule.requested_by}` : ""}</p>}
              {schedule.change_reason && <p className="meta mt-1">Reason: {schedule.change_reason}</p>}
              {schedule.override_reason && <p className="meta mt-1">Override reason: {schedule.override_reason}</p>}
              {schedule.panelists?.length > 0 && <p className="meta mt-1">Panel: {schedule.panelists.map((item) => item.name).join(", ")}</p>}
              {(schedule.attention || []).map((line) => <p key={line} className="mt-1 text-xs font-semibold text-amber-800">{line}</p>)}
              {schedule.ics_url && schedule.is_active && <a href={schedule.ics_url} download className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">Add to calendar (.ics)</a>}
            </div>
            <StatusChip status={schedule.display_status || schedule.status} />
          </div>
        ))}
      </div>
    </HistoryPanel>
  );
}
