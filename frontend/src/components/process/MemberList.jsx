import { useState } from "react";
import { Eye, MessageSquare } from "lucide-react";
import { Button } from "../ui/index.js";
import { GroupBadge } from "./GroupCard.jsx";

// Khloe's student list of a group: it opens inside the card. Each member: name, number and program, a status chip, badges,
// the requirement boxes (`boxes`), a discussion count, then buttons: View, one toggle per detail view, Message / Return.
//
// `members`: [{ id, title, subtitle, chip, badges, ready, boxes, messageCount, details: [{ key, label, hideLabel, icon, render }] ,
//               onView, onMessage }]. A detail's `render(panelId)` returns the panel that opens under the buttons.

/** A button that opens or closes one panel (aria-expanded, aria-controls). */
export function DetailToggle({ icon, open, openLabel, closeLabel, panelId, onToggle }) {
  return (
    <Button variant="secondary" size="sm" icon={icon} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
      {open ? closeLabel : openLabel}
    </Button>
  );
}

export function MemberList({ members }) {
  const [open, setOpen] = useState(() => new Set());
  function toggle(key) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  return (
    <ul className="space-y-3">
      {members.map((member) => (
        <li key={member.id} className={`rounded-lg px-3 py-2 ring-1 ${member.ready ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-ink">{member.title}</p>
              <p className="meta">{member.subtitle}</p>
            </div>
            <span className="flex flex-wrap items-center gap-1.5">{member.chip}{member.badges}</span>
          </div>
          {member.boxes}
          {member.messageCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {member.messageCount} discussion message{member.messageCount === 1 ? "" : "s"}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {member.onView && <Button variant="secondary" size="sm" icon={Eye} onClick={member.onView} aria-label={`View ${member.title}`}>View</Button>}
            {(member.details || []).map((detail) => {
              const key = `${member.id}:${detail.key}`;
              return <DetailToggle key={detail.key} icon={detail.icon} open={open.has(key)} openLabel={detail.label} closeLabel={detail.hideLabel} panelId={`${detail.key}-panel-${member.id}`} onToggle={() => toggle(key)} />;
            })}
            {member.onMessage && <Button variant="danger" size="sm" icon={MessageSquare} onClick={member.onMessage} aria-label={`Message / Return ${member.title}`}>Message / Return</Button>}
          </div>
          {(member.details || []).map((detail) => (open.has(`${member.id}:${detail.key}`) ? <div key={detail.key}>{detail.render(`${detail.key}-panel-${member.id}`)}</div> : null))}
        </li>
      ))}
    </ul>
  );
}

export { GroupBadge };
