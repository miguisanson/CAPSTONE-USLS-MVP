import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Button, SectionCard, StatusChip } from "../../components/ui/index.js";

/**
 * The "Adviser and panel" card of Research Progress and Defense Schedule: the adviser, then the matched panel in two
 * columns. Names wrap (a long name is never cut). `showSpecialization` adds each member's specialization or college under
 * the name (Research Progress); `showScheduleLink` adds the link to the Defense Schedule page (not on that page itself,
 * where a link to the page you are on goes nowhere, I-086).
 */
export default function AdviserPanelCard({ data, showSpecialization = true, showScheduleLink = true }) {
  const panel = data.panel || [];
  return (
    <SectionCard
      pad="lg"
      title="Adviser and panel"
      subtitle="Assigned after Panel Matching; scheduling opens once a panel is in place"
      icon={Users}
      action={showScheduleLink ? <Button as={Link} to="/student/defense-schedule" variant="secondary" size="sm">Defense schedule <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Button> : null}
    >
      <p className="text-sm text-slate-600">Adviser: <span className="font-semibold text-ink">{data.student.adviser_name || data.research_case?.adviser_name || "Not assigned"}</span></p>
      {panel.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {panel.map((member) => (
            <li key={member.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{member.faculty_name}</p>
                {showSpecialization && <p className="meta break-words">{member.specialization || member.college}</p>}
              </div>
              <StatusChip status={member.panel_role} tone="neutral" dot={false} className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta">No panel has been matched yet. The Research Coordinator does this after your title-defense package is endorsed.</p>
      )}
    </SectionCard>
  );
}
