import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, ListChecks } from "lucide-react";
import { Card, EmptyState, PageHeader, ProgressBar, SectionTitle, StatusBadge } from "../../components/ui";
import { useStudentPortal } from "./StudentPortalContext";
import { ProgressPanel, WorkflowStatusPanel } from "./Panels";

// Read-only view of the student's curriculum and subject statuses, grouped by
// category. Official grades and statuses stay in their source systems.
function CurriculumProgress({ data }) {
  const subjects = data.curriculum_subjects || [];
  const audit = data.course_audit;
  const grouped = useMemo(
    () =>
      subjects.reduce((groups, subject) => {
        const category = subject.category || "Other";
        (groups[category] = groups[category] || []).push(subject);
        return groups;
      }, {}),
    [subjects],
  );
  return (
    <Card className="p-6">
      <SectionTitle
        title="Curriculum progress"
        subtitle="Every subject in your program and where you stand on it"
        icon={BookOpenCheck}
        action={<Link to="/student/enrollment" className="btn-ghost px-3 py-1.5 text-xs">Enroll in subjects</Link>}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Units completed</span>
            <span className="font-bold text-brand-700">{audit.completed_units} / {audit.total_units}</span>
          </div>
          <ProgressBar value={audit.units_rate} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Completed", audit.completed.length],
            ["Current", audit.current.length],
            ["Missing", audit.missing_count],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2">
              <p className="font-display text-xl font-semibold text-ink">{value}</p>
              <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
      {subjects.length ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, rows]) => (
            <section key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{category}</h3>
                <span className="text-xs text-slate-500">{rows.length} subject{rows.length === 1 ? "" : "s"}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Subject</th>
                      <th className="px-3 py-2">Units</th>
                      <th className="px-3 py-2">Suggested term</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((subject) => (
                      <tr key={subject.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2"><span className="font-semibold text-ink">{subject.code}</span> <span className="text-slate-500">{subject.title}</span></td>
                        <td className="px-3 py-2 text-slate-600">{subject.units}</td>
                        <td className="px-3 py-2 text-slate-500">{subject.recommended_term || "-"}</td>
                        <td className="px-3 py-2"><StatusBadge value={subject.status === "Missing" ? "Not taken" : subject.status} dot={false} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpenCheck} title="No curriculum is available" hint="Ask the Academic Coordinator to confirm your curriculum version." />
      )}
    </Card>
  );
}

export default function StudentProgress() {
  const { data } = useStudentPortal();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My Progress"
        description="Your lifecycle stage, requirement status, and curriculum, read from the monitoring record."
        icon={ListChecks}
      />
      <ProgressPanel data={data} />
      <WorkflowStatusPanel data={data} />
      <CurriculumProgress data={data} />
    </div>
  );
}
