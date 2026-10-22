import { X } from "lucide-react";
import { Button, Drawer, StatusChip } from "../../components/ui/index.js";
import { SubjectStudents } from "../../components/SubjectNeedsReport";

/** Everything about one subject that does not fit a table row: who needs it, who is delayed if it is withheld, who could teach it. */
export default function DetailsDrawer({ row, selection, onClose }) {
  const { need, notTaken, retakes, students } = row.needs;
  const candidates = (row.faculty_candidates || []).slice(0, 3);
  const affected = row.affected_students || [];
  const delayedIds = new Set(affected.filter((student) => student.will_be_delayed).map((student) => student.id));
  return (
    <Drawer side="right" label={`${row.course.code} details`} onClose={onClose}>
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="section-title break-words">{row.course.code}</h2>
          {row.course.title && row.course.title !== row.course.code && <p className="mt-0.5 text-sm text-slate-500">{row.course.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={selection.status || "No decision"} dot={false} />
            <span className="meta">{row.selection_source || (row.demand_count > 0 ? "Demand" : "Manual")}</span>
          </div>
        </div>
        <Button variant="icon" icon={X} onClick={onClose} aria-label="Close details" />
      </div>
      <div className="space-y-5 px-4 py-4 sm:px-6">
        <section aria-labelledby="detail-students">
          <h3 id="detail-students" className="card-title">
            {need === 1 ? "1 student needs it next term" : `${need} students need it next term`}
            <span className="meta ml-2 font-normal">
              {notTaken} not taken yet
              {retakes ? ` · ${retakes} retake${retakes === 1 ? "" : "s"}` : ""}
            </span>
          </h3>
          <p className="meta mt-0.5">
            {row.delayed_count ? `${row.delayed_count} delayed if withheld` : "Nobody is delayed if it is withheld"}
          </p>
          <div className="mt-3">
            {students.length === 0 && affected.length === 0 ? (
              <p className="text-sm text-slate-500">No student needs this subject right now. It stays available for a manual offering decision.</p>
            ) : (
              <SubjectStudents students={students} delayedIds={delayedIds} />
            )}
          </div>
        </section>
        <section aria-labelledby="detail-faculty">
          <h3 id="detail-faculty" className="card-title">Who could teach it</h3>
          {candidates.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No faculty member has the availability and teaching load for this subject yet.</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {candidates.map((candidate) => (
                  <li key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-ink">{candidate.name}{candidate.preferred ? <span className="meta ml-2 font-normal">preferred</span> : null}</span>
                    <span className="meta shrink-0">{candidate.projected_load}/24u</span>
                  </li>
                ))}
              </ul>
              <p className="meta mt-2">Recommended from preferences, availability, specialization and teaching load. The coordinator can choose anyone.</p>
            </>
          )}
        </section>
      </div>
    </Drawer>
  );
}
