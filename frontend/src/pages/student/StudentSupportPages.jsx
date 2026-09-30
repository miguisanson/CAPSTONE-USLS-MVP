import { Link, useNavigate } from "react-router-dom";
import { BookPlus, Bot, FileUp, History, Mail, UserRound } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatusBadge } from "../../components/ui";
import { useStudentPortal } from "./StudentPortalContext";
import { RESEARCH_GATE_KEYS } from "./shared";
import { ActivityPanel, AdministrativeDocumentsPanel } from "./Panels";
import { MyCoursesPanel } from "./MyCourses";
import { StudentPolicyAssistant } from "./StudentAssistant";
import { StudentInbox } from "./StudentInbox";
import { STUDENT_REQUEST_PATHS } from "./requestMeta";

export function StudentEnrollmentPage() {
  const { data, refetch } = useStudentPortal();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Enrollment"
        description="Choose the published subjects you are taking this semester. Subjects already on your record stay locked."
        icon={BookPlus}
        actions={<Link to="/student/progress" className="btn-ghost">View my progress</Link>}
      />
      <MyCoursesPanel data={data} onSaved={refetch} />
    </div>
  );
}

export function StudentMessagesPage() {
  const { data, refetch } = useStudentPortal();
  const navigate = useNavigate();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Messages"
        description="Clarification requests, staff replies and questions about your active requests."
        icon={Mail}
      />
      <StudentInbox data={data} onSaved={refetch} onOpenRequest={(view) => navigate(STUDENT_REQUEST_PATHS[view] || "/student/requests")} />
    </div>
  );
}

export function StudentDocumentsPage() {
  const { data, refetch } = useStudentPortal();
  const hasAdministrative = Object.keys(data.documents_by_gate || {}).some((gate) => !RESEARCH_GATE_KEYS.has(gate));
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Documents"
        description="Admission and general records, and the files you have submitted. Research milestone files are managed on the Research page."
        icon={FileUp}
        actions={<Link to="/student/research" className="btn-ghost">Research uploads</Link>}
      />
      {hasAdministrative ? (
        <AdministrativeDocumentsPanel documentsByGate={data.documents_by_gate} onSaved={refetch} />
      ) : (
        <Card className="p-6">
          <EmptyState icon={FileUp} title="No administrative documents on file" hint="Admission and general records will appear here when the Graduate School requests or records them." />
        </Card>
      )}
    </div>
  );
}

export function StudentActivityPage() {
  const { data } = useStudentPortal();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Activity History"
        description="Every submission, decision and hand-off on your record, with who owns the next step."
        icon={History}
      />
      <ActivityPanel logs={data.logs} />
    </div>
  );
}

export function StudentAssistantPage() {
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Policy Assistant"
        description="Ask about the Graduate School manual, procedures, or your own academic record."
        icon={Bot}
      />
      <StudentPolicyAssistant />
    </div>
  );
}

function ProfileRow({ label, children }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

export function StudentProfilePage() {
  const { data } = useStudentPortal();
  const { student } = data;
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My Profile"
        description="Your identity and enrollment details as recorded by the Graduate School. Contact the office to correct anything here."
        icon={UserRound}
      />
      <Card className="p-6">
        <SectionTitle title={student.name} subtitle={`${student.student_number} · ${student.program_name}`} icon={UserRound} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ProfileRow label="Student number">{student.student_number}</ProfileRow>
          <ProfileRow label="Email">{student.email}</ProfileRow>
          <ProfileRow label="Program">{student.program_code} · {student.program_name}</ProfileRow>
          <ProfileRow label="College">{student.college || "Not recorded"}</ProfileRow>
          <ProfileRow label="Academic year of entry">{student.academic_year_entry || "Not recorded"}</ProfileRow>
          <ProfileRow label="Course year">{student.course_year_label || "Not available"}</ProfileRow>
          <ProfileRow label="Lifecycle stage">{student.current_stage}</ProfileRow>
          <ProfileRow label="Standing"><StatusBadge value={student.standing} dot={false} /></ProfileRow>
          <ProfileRow label="Enrollment tag">{student.enrollment_tag || "None"}</ProfileRow>
          <ProfileRow label="Adviser">{student.adviser_name || data.research_case?.adviser_name || "Not assigned"}</ProfileRow>
          <ProfileRow label="Comprehensive exam">{student.comprehensive_exam_status || "Not recorded"}</ProfileRow>
          <ProfileRow label="Progress status"><StatusBadge value={data.progress_status?.level || "Not yet assessed"} dot={false} /></ProfileRow>
        </div>
      </Card>
    </div>
  );
}
