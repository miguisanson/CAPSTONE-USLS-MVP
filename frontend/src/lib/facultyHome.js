// What the faculty home lists (IM19 + AD7, packet P7.2): the "Needs your action" rows, the "Waiting on others" rows,
// the key numbers and the upcoming defenses, all built from the portal context the faculty pages already load
// (/api/faculty-portal/context) - no new data. Plain JavaScript on purpose: Node can import it
// (scripts/faculty-home.test.mjs).
//
// A row's `target` is { to, label }. Dates stay raw ("YYYY-MM-DD", "HH:MM"); the page formats them.

/** The most "Needs your action" rows shown. */
export const MAX_ACTIONS = 8;
const BASE = "/faculty-portal";
const REVISING = "Awaiting revisions";
const WAITING_ON_COORDINATOR = { "Needs Re-confirmation": "reconfirm", "Pending scheduling": "scheduling" };

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayOf = (defense) => (defense?.preferred_date ? `${defense.preferred_date}T${defense.start_time || "00:00"}` : "9999");
const byDefenseDate = (a, b) => dayOf(a.defense).localeCompare(dayOf(b.defense));
const defenseLabel = (defense) => defense?.defense_type || "Defense";

/**
 * What the member must do, most urgent first: verdicts to record (oldest defense first), revisions to confirm,
 * panel invitations, adviser requests, advisee documents to sign, missing availability.
 * @param data the faculty portal context
 * @returns { items (at most `limit`), total } - total counts units of work (a verdict, an invitation, a document), not rows
 */
export function facultyActions(data, { limit = MAX_ACTIONS } = {}) {
  const panels = data?.panels || [];
  const advisees = data?.advisees || [];
  const rows = [];
  for (const panel of [...panels].filter((p) => p.can_submit_verdict).sort(byDefenseDate)) {
    rows.push({
      key: `verdict-${panel.student.id}-${panel.gate}`,
      kind: "verdict",
      title: `Record the verdict for ${panel.student.name}`,
      detail: `${defenseLabel(panel.defense)} · you are ${panel.panel_role}`,
      units: 1,
      tone: "danger",
      status: "Verdict due",
      target: { to: `${BASE}/verdicts`, label: "Submit verdict" },
    });
  }
  for (const panel of panels.filter((p) => p.can_confirm_revisions)) {
    rows.push({
      key: `revisions-${panel.student.id}-${panel.gate}`,
      kind: "revisions",
      title: `Confirm the revisions of ${panel.student.name}`,
      detail: `${defenseLabel(panel.defense)} · the student submitted the revised paper`,
      units: 1,
      tone: "warning",
      status: "Revisions submitted",
      target: { to: `${BASE}/verdicts`, label: "Confirm revisions" },
    });
  }
  const invitations = data?.counts?.pending_invitations || 0;
  if (invitations > 0) {
    rows.push({
      key: "invitations",
      kind: "invitations",
      title: `${plural(invitations, "panel invitation")} waiting for your answer`,
      detail: "Accept or decline a seat on a student's panel",
      units: invitations,
      tone: "warning",
      status: "Invited",
      target: { to: `${BASE}/invitations`, label: "Answer invitations" },
    });
  }
  const requests = data?.counts?.pending_adviser_requests || 0;
  if (requests > 0) {
    rows.push({
      key: "adviser-requests",
      kind: "adviser",
      title: `${plural(requests, "adviser request")} waiting for your answer`,
      detail: "Students asking you to be their research adviser",
      units: requests,
      tone: "warning",
      status: "Applied",
      target: { to: `${BASE}/advisees`, label: "Open requests" },
    });
  }
  for (const row of advisees.filter((a) => a.pending_count > 0)) {
    rows.push({
      key: `signatures-${row.student.id}`,
      kind: "signatures",
      title: `Sign ${row.student.name}'s paper`,
      detail: `${plural(row.pending_count, "document")} waiting for your signature`,
      units: row.pending_count,
      tone: "warning",
      status: "Needs signature",
      target: { to: `${BASE}/signatures`, label: "Review and sign" },
    });
  }
  if (data?.faculty?.availability_entered === false) {
    rows.push({
      key: "availability",
      kind: "availability",
      title: "Enter your availability",
      detail: "Staff cannot book defenses with you until you do.",
      units: 1,
      tone: "warning",
      status: "Not entered",
      target: { to: `${BASE}/availability`, label: "Enter availability" },
    });
  }
  return { items: rows.slice(0, limit), total: rows.reduce((sum, row) => sum + row.units, 0) };
}

/**
 * Items held by someone else, so the member has nothing to do yet: an advisee revising after the defense (the
 * student), a defense to re-confirm or still to be scheduled (the Research Coordinator).
 * @returns { items (all), total }
 */
export function facultyWaiting(data) {
  const items = [];
  for (const row of data?.advisees || []) {
    for (const review of row.revision_reviews || []) {
      if (review.revision_status !== REVISING) continue;
      items.push({
        key: `revising-${review.id}`,
        kind: "revising",
        title: `${row.student.name} is revising the paper`,
        detail: `With the student. ${review.gate || "The defense"} revisions are due before the panel can approve.`,
        tone: "neutral",
        status: REVISING,
        target: { to: `${BASE}/advisees`, label: "My advisees" },
      });
    }
  }
  for (const panel of data?.panels || []) {
    const kind = WAITING_ON_COORDINATOR[panel.defense?.status];
    if (!kind) continue;
    items.push({
      key: `${kind}-${panel.defense.id}`,
      kind,
      title: `${panel.student.name}: ${defenseLabel(panel.defense)}`,
      detail: `With the Research Coordinator. ${kind === "reconfirm" ? "The panel changed, so the schedule must be re-confirmed." : "The date is not set yet."}`,
      tone: "neutral",
      status: panel.defense.status,
      target: { to: `${BASE}/defenses`, label: "Defense schedule" },
    });
  }
  return { items, total: items.length };
}

/**
 * The four key numbers, each once: open items, advisees, panel committees, upcoming defenses.
 * @returns [{ key, label, value, sub, tone, to }]
 */
export function facultyStats(data) {
  const open = facultyActions(data, { limit: Infinity }).total;
  const upcoming = data?.upcoming_defenses || [];
  const advisees = data?.advisees || [];
  const panels = data?.panels || [];
  return [
    { key: "open", label: "Your open items", value: open, sub: open ? "Waiting on you" : "You are all caught up", tone: open ? "warning" : "success", to: `${BASE}/invitations` },
    { key: "advisees", label: "Advisees", value: advisees.length, sub: "Students you advise", tone: "info", to: `${BASE}/advisees` },
    { key: "panels", label: "Panel committees", value: panels.length, sub: "Committees you sit on", tone: "info", to: `${BASE}/panels` },
    { key: "defenses", label: "Upcoming defenses", value: upcoming.length, sub: upcoming.length ? "Booked, still to come" : "None scheduled", tone: "neutral", to: `${BASE}/defenses` },
  ];
}

/**
 * The next defenses the member sits on, in date order.
 * @returns [{ key, title (the student), detail, date, start, end, status, to }]
 */
export function facultyUpcoming(data, limit = 5) {
  return [...(data?.upcoming_defenses || [])]
    .sort(byDefenseDate)
    .slice(0, limit)
    .map((entry) => ({
      key: `defense-${entry.defense.id}`,
      title: entry.student.name,
      detail: [defenseLabel(entry.defense), entry.my_role, entry.defense.venue || entry.defense.mode].filter(Boolean).join(" · "),
      date: entry.defense.preferred_date,
      start: entry.defense.start_time,
      end: entry.defense.end_time,
      status: entry.defense.display_status || entry.defense.status,
      to: `${BASE}/defenses`,
    }));
}
