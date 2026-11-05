import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, ListChecks } from "lucide-react";
import { Button, DataTable, EmptyState, PageHeader, SectionCard, StatCard, StatusChip } from "../../components/ui/index.js";
import { ProgressBar } from "../../components/ui/ProgressBar.jsx";
import { useStudentPortal } from "./StudentPortalContext";
import { ProgressPanel, WorkflowStatusPanel } from "./Panels";
import { PAGE } from "../../lib/labels.js";

const SUBJECT_COLUMNS = [
  {
    key: "code",
    header: "Subject",
    cell: (subject) => (
      <>
        <span className="font-semibold text-ink">{subject.code}</span> <span className="text-slate-500">{subject.title}</span>
      </>
    ),
  },
  { key: "units", header: "Units" },
  { key: "recommended_term", header: "Suggested term", cell: (subject) => subject.recommended_term || "-", className: "text-slate-500" },
  {
    key: "status",
    header: "Status",
    cell: (subject) => <StatusChip status={subject.status === "Missing" ? "Not taken" : subject.status} dot={false} />,
  },
];

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
    <SectionCard
      pad="lg"
      title="Curriculum progress"
      subtitle="Every subject in your program and where you stand on it"
      icon={BookOpenCheck}
      action={<Button as={Link} to="/student/enrollment" variant="secondary" size="sm">Enroll in subjects</Button>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Units completed</span>
            <span className="font-semibold text-brand-700">{audit.completed_units} / {audit.total_units}</span>
          </div>
          <ProgressBar value={audit.units_rate} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard size="sm" tone="success" label="Completed" value={audit.completed.length} />
          <StatCard size="sm" tone="info" label="Current" value={audit.current.length} />
          <StatCard size="sm" tone={audit.missing_count ? "warning" : "neutral"} label="Missing" value={audit.missing_count} />
        </div>
      </div>
      {subjects.length ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, rows]) => (
            <section key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="card-title">{category}</h3>
                <span className="meta">{rows.length} subject{rows.length === 1 ? "" : "s"}</span>
              </div>
              <DataTable caption={`${category} subjects and their status`} columns={SUBJECT_COLUMNS} rows={rows} pageSize={0} dense />
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpenCheck} title="No curriculum is available" hint="Ask the Academic Coordinator to confirm your curriculum version." />
      )}
    </SectionCard>
  );
}

export default function StudentProgress() {
  const { data } = useStudentPortal();
  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.myProgress}
        description="Your lifecycle stage, requirement status, and curriculum, read from the monitoring record."
        icon={ListChecks}
      />
      <ProgressPanel data={data} />
      <WorkflowStatusPanel data={data} />
      <CurriculumProgress data={data} />
    </div>
  );
}
